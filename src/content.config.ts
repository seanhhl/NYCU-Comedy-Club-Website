import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const announcements = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/announcements" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
  }),
});

const timeline = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/timeline" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string().nullish(),
    photos: z.array(z.string()).nullish(),
    speaker: z.object({
      name: z.string(),
      role: z.string().nullish(),
      photo: z.string().nullish(),
      bio: z.string().nullish(),
    }).nullish(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/faq" }),
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    order: z.number().nullish(),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/team" }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    photo: z.string().nullish(),
    order: z.number().nullish(),
  }),
});

export const collections = {
  announcements,
  timeline,
  faq,
  team,
};

