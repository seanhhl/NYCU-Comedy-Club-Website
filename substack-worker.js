export default {
  // Runs automatically on the Cron schedule
  async scheduled(event, env, ctx) {
    await syncSubstack(env);
  },
  
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const result = await syncSubstack(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: corsHeaders
      });
    } catch (error) {
      console.error("Crash Error:", error.stack);
      return new Response(JSON.stringify({ error: "Script crashed", details: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

async function syncSubstack(env) {
  const rssUrl = 'https://seanhhl.substack.com/feed';
  const repo = 'seanhhl/NYCU-Comedy-Club-Website';
  const token = env.GITHUB_TOKEN;

  if (!token) {
    console.error('❌ GITHUB_TOKEN is missing. Please add it to your Worker variables.');
    return { error: 'GITHUB_TOKEN is missing' };
  } else {
    console.log(`🔍 Token found! Last 8 characters are: ...${token.slice(-8)}`);
  }

  // 1. Fetch RSS Feed
  // (We removed the nocache parameter because Substack's rate limits are blocking it!
  // Normal RSS feeds cache for about 5 minutes, which is perfectly fine for our hourly cron job.)
  const rssRes = await fetch(rssUrl, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const rssText = await rssRes.text();
  
  // 2. Parse the newest post
  const itemStart = rssText.indexOf('<item>');
  const itemEnd = rssText.indexOf('</item>', itemStart);
  if (itemStart === -1) {
    console.error('❌ No posts found in RSS feed. Substack might be blocking the request.');
    return { 
      error: 'No posts found in RSS feed.', 
      status: rssRes.status, 
      preview: rssText.substring(0, 300) 
    };
  }
  
  const itemXml = rssText.slice(itemStart, itemEnd);
  const extract = (tag) => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
    const match = itemXml.match(regex);
    if (!match) return null;
    let content = match[1].trim();
    if (content.startsWith('<![CDATA[')) {
      content = content.substring(9, content.length - 3);
    }
    return content;
  };

  const title = extract('title') || 'Untitled';
  const pubDateStr = extract('pubDate');
  const guidRaw = extract('guid');
  let content = extract('content:encoded') || extract('description') || '';
  
  // 3. Generate filename
  const uniqueId = guidRaw ? guidRaw.split('/').pop().replace(/[^a-zA-Z0-9]/g, '') : Date.now().toString();
  
  // Fix: Safe date parsing to prevent crashes
  let dateObj;
  try {
    dateObj = pubDateStr ? new Date(pubDateStr) : new Date();
    if (isNaN(dateObj.getTime())) dateObj = new Date(); // Fallback if invalid
  } catch (e) {
    dateObj = new Date();
  }
  
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/(^-|-$)/g, '');
  const filename = `${yyyy}-${mm}-${dd}-${safeTitle}-${uniqueId}.md`;
  const path = `src/content/announcements/${filename}`;
  
  // 4. Check GitHub to see if this Substack ID was ALREADY synced (even if title changed!)
  const dirUrl = `https://api.github.com/repos/${repo}/contents/src/content/announcements`;
  const checkRes = await fetch(dirUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Substack-Sync-Worker'
    }
  });
  
  if (checkRes.ok) {
    const files = await checkRes.json();
    // Look for any existing file that ends with this Substack ID
    const alreadySynced = files.some(f => f.name.includes(`-${uniqueId}.md`));
    if (alreadySynced) {
      console.log(`⏩ Skipped: A post with ID ${uniqueId} was already synced.`);
      return { status: 'skipped', message: `Post already synced.` };
    }
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  
  // 5. Construct Markdown
  const escapedTitle = title.replace(/"/g, '\\"');
  
  const markdown = `---
title: "${escapedTitle}"
date: ${dateObj.toISOString()}
---
${content}`;

  // 6. Base64 Encode
  const utf8Bytes = new TextEncoder().encode(markdown);
  let binaryString = '';
  for (let i = 0; i < utf8Bytes.length; i++) binaryString += String.fromCharCode(utf8Bytes[i]);
  const encodedContent = btoa(binaryString);

  // 7. Commit to GitHub
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Substack-Sync-Worker'
    },
    body: JSON.stringify({
      message: `Auto-sync Substack post: ${title}`,
      content: encodedContent,
      branch: 'main'
    })
  });
  
  if (!putRes.ok) {
    const err = await putRes.text();
    console.error(`❌ Failed to commit to GitHub: ${err}`);
    return { error: 'Failed to commit to GitHub', details: err };
  }
  
  console.log(`✅ Success: Created ${filename}`);
  return { status: 'success', message: `Successfully created ${filename}` };
}

