import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/', // Keep search engines out of teacher approval
          '/teacher/', // Keep dashboards private
          '/api/', // Don't index internal API routes
          '/_next/', // Don't index Next.js internals
        ],
      },
      {
        userAgent: 'GPTBot', // Specifically handle AI crawlers if you want
        disallow: ['/teacher/'],
      },
    ],
    // If you have a sitemap (highly recommended for trust), link it here
    sitemap: 'https://www.civicsandmoney.com/sitemap.xml',
  };
}
