/** @type {import('next').NextConfig} */

function serverActionAllowedOrigins() {
  const origins = new Set(['localhost', '127.0.0.1'])
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (typeof siteUrl === 'string' && siteUrl.trim()) {
    try {
      const parsed = new URL(siteUrl)
      if (parsed.hostname) {
        origins.add(parsed.hostname)
      }
      if (parsed.host) {
        origins.add(parsed.host)
      }
    } catch {
      // Invalid NEXT_PUBLIC_SITE_URL is ignored for allowedOrigins.
    }
  }
  return [...origins]
}

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
      allowedOrigins: serverActionAllowedOrigins(),
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/manifest.webmanifest',
        destination: '/manifest.json',
      },
    ]
  },
}

module.exports = nextConfig
