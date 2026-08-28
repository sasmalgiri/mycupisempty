/** @type {import('next').NextConfig} */

/**
 * CORS origin for /api/*.
 *
 * This used to be a hardcoded `*` alongside `Allow-Credentials: true` — a
 * combination browsers reject outright for credentialed requests, so it bought
 * nothing while advertising every student-data endpoint as world-readable.
 *
 * The app is same-origin: its own pages need no CORS headers at all. We emit
 * them only when an origin is explicitly configured, so a third-party site can
 * never be handed a signed-in child's data.
 */
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || '';

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    if (!APP_ORIGIN) return [];
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: APP_ORIGIN },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
          // Caches must not serve one origin's response to another.
          { key: 'Vary', value: 'Origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
