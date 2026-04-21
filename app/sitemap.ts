import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.civicslab.pro';

  // Define your public-facing routes
  // Disclude /admin or /teacher routes as they shouldn't be indexed
  const routes = [
    '',
    '/fed-simulator',
    '/stock',
    '/sign-in',
    '/sign-up',
    '/waitlist',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8, // Home page is priority 1
  }));

  return [...routes];
}
