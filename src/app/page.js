// src/app/page.js (เวอร์ชันปรับปรุงให้ใช้กับระบบปัจจุบัน)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast'; // เพิ่มการ import toast

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // เพิ่ม state สำหรับ loading
  const router = useRouter();

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!username || !password) {
      return toast.error('กรุณากรอก Username และรหัสผ่าน');
    }

    setIsLoading(true);
    const toastId = toast.loading('กำลังเข้าสู่ระบบ...');

    try {
      // 1. ค้นหา user จาก Firestore เพื่อเอา email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error('Username หรือรหัสผ่านไม่ถูกต้อง', { id: toastId });
        setIsLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      // 2. ใช้ email และ password เพื่อเข้าสู่ระบบกับ Firebase Auth
      await signInWithEmailAndPassword(auth, userEmail, password);
      
      toast.success('เข้าสู่ระบบสำเร็จ!', { id: toastId });
      router.push('/dashboard');

    } catch (error) {
      console.error('Login error:', error.code);
      // ตรวจจับ error ที่พบบ่อยจาก Firebase Auth
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          toast.error('Username หรือรหัสผ่านไม่ถูกต้อง', { id: toastId });
      } else {
          toast.error('เกิดข้อผิดพลาดในการล็อกอิน', { id: toastId });
      }
      setIsLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      {/* เพิ่ม Toaster เพื่อให้การแจ้งเตือนแสดงผลได้ */}
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-2xl shadow-lg">
        <div className="flex justify-center">
            {/* ตรวจสอบให้แน่ใจว่าไฟล์ schoollogo.png อยู่ในโฟลเดอร์ public */}
            <img 
                src="/schoollogo.png" 
                alt="School Logo" 
                className="h-24 w-auto"
                // เพิ่ม fallback เผื่อรูปไม่โหลด
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100/374151/FFFFFF?text=Logo'; e.currentTarget.alt="Placeholder Logo"}}
            />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">ระบบเช็คชื่อออนไลน์</h1>
          <p className="mt-2 text-gray-400">สำหรับครูที่ปรึกษาและผู้ดูแลระบบ</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">Username</label>
            <input 
              id="username" 
              name="username" 
              type="text" 
              autoComplete="username" 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm"
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">รหัสผ่าน</label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              autoComplete="current-password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm"
              disabled={isLoading}
            />
          </div>
          <div>
            <button 
              type="submit" 
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500"
              disabled={isLoading}
            >
              {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
