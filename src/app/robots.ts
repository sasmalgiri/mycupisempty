import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mycupisempty.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/daily-mix/', '/subjects/', '/guru/', '/teacher/', '/assessment/', '/settings/', '/flashcards/', '/activities/', '/challenges/', '/methods/', '/pedagogy/', '/me/', '/habits/', '/reflect/', '/goals/', '/parent/', '/progress/', '/achievements/', '/style-discovery/', '/learning-dna/', '/live-quiz/', '/my-teams/', '/lifecycle/', '/badges/', '/path-discovery/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
