// src/app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast'; // <<< 1. เพิ่ม import ตรงนี้

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ระบบจัดการสถิติประจำวันออนไลน์",
  description: "สร้างโดย คู่หูเขียนโค้ด และ คุณทนงศักดิ์",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster position="top-right" /> {/* <<< 2. เพิ่ม Component นี้เข้าไป */}
        {children}
      </body>
    </html>
  );
}