import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    date: z.string(),
    dateTime: z.string(),
    readingTime: z.string().default('5 min read'),
    category: z.string().default('Ads & Growth'),
  }),
});

export const collections = { articles };
