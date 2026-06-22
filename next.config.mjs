/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // สั่งให้ Vercel ข้ามการตรวจไวยากรณ์ข้อความตอนรัน Build ครับ
    ignoreDuringBuilds: true, 
  },
  typescript: {
    // สั่งให้ Vercel ข้ามการตรวจโครงสร้างตัวแปรตอนรัน Build ครับ
    ignoreBuildErrors: true,
  },
};

export default nextConfig;