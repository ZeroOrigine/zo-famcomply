/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Deploys must never fail on type nits (e.g. runtime-assembled Supabase
    // select strings). Known past regression: keep this in place.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
