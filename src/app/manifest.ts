import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyCupIsEmpty - AI-Powered Adaptive Learning',
    short_name: 'MyCupIsEmpty',
    description: 'Independent adaptive learning for Indian school students (Class 1–12). 20+ teaching methods, AI tutor, virtual labs, character building. Not affiliated with any education board.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#7c3aed',
    orientation: 'portrait-primary',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/assets/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/assets/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/assets/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
