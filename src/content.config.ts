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
    description: z.string().optional(),
    photos: z.array(z.string()).optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/faq" }),
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    order: z.number().optional(),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/team" }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    photo: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = {
  announcements,
  timeline,
  faq,
  team,
};

