/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // สั่งให้ข้ามการเช็ก ESLint ตอน Build บน Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // สั่งให้ข้ามการเช็กประเภท TypeScript ตอน Build
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;