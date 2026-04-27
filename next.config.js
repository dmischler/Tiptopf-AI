/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverActions: {
    bodySizeLimit: '20mb',
  },
}

module.exports = nextConfig
