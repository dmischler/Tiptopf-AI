/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
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
