/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },

  reactStrictMode: false,

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
    ],
  },
}

export default nextConfig