/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/realtime-js'],
  },
}
module.exports = nextConfig
