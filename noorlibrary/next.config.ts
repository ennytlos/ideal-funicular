import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Bunny CDN — covers all *.b-cdn.net pull zones
        protocol: 'https',
        hostname: '*.b-cdn.net',
      },
      {
        // Custom Bunny CDN hostnames (if you have a custom domain on your pull zone)
        protocol: 'https',
        hostname: '*.bunnycdn.com',
      },
    ],
  },
  // Required for react-pdf to work with Next.js (Webpack)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // Required for react-pdf to work with Next.js (Turbopack) & to silence configuration warnings
  turbopack: {
    resolveAlias: {
      canvas: './empty-module.js',
    },
  },
};

export default nextConfig;
