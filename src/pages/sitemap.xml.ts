import type { APIRoute } from 'astro';

export const prerender = true;

const pages = [
  { url: 'https://vatsal.arqostudio.com/', changefreq: 'weekly', priority: '1.0' },
  { url: 'https://vatsal.arqostudio.com/vault', changefreq: 'weekly', priority: '0.9' },
  { url: 'https://vatsal.arqostudio.com/static-ads', changefreq: 'weekly', priority: '0.9' },
  { url: 'https://vatsal.arqostudio.com/roast-my-ads', changefreq: 'weekly', priority: '0.9' }
];

const now = new Date().toISOString().split('T')[0];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`.trim();

export const GET: APIRoute = () => {
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
