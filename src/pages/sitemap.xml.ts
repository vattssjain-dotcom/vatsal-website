import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const now = new Date().toISOString().split('T')[0];

export const GET: APIRoute = async () => {
  const articles = await getCollection('articles');

  const staticPages = [
    { url: 'https://vatsal.arqostudio.com/', changefreq: 'weekly', priority: '1.0' },
    { url: 'https://vatsal.arqostudio.com/vault', changefreq: 'weekly', priority: '0.9' },
    { url: 'https://vatsal.arqostudio.com/static-ads', changefreq: 'weekly', priority: '0.9' },
    { url: 'https://vatsal.arqostudio.com/roast-my-ads', changefreq: 'weekly', priority: '0.9' },
    { url: 'https://vatsal.arqostudio.com/articles', changefreq: 'weekly', priority: '0.8' },
  ];

  const articlePages = articles.map((article) => ({
    url: `https://vatsal.arqostudio.com/articles/${article.id}`,
    lastmod: article.data.dateTime || now,
    changefreq: 'monthly',
    priority: '0.7',
  }));

  const allPages = [
    ...staticPages.map((p) => ({ ...p, lastmod: now })),
    ...articlePages,
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`.trim();

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
