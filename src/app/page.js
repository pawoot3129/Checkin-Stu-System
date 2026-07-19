'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast.success("เข้าสู่ระบบสำเร็จ");
            // บังคับเปลี่ยนเส้นทางไปหน้า dashboard เสมอ
            router.push('/dashboard');
            // ถ้า router.push ไม่ยอมเปลี่ยน ให้ลองใช้ window.location
            // window.location.href = '/dashboard'; 
        } catch (error) {
            toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) return toast.error("กรุณากรอกอีเมลก่อนกดลืมรหัสผ่าน");
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว");
        } catch (error) {
            toast.error("ไม่สามารถส่งอีเมลได้: " + error.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
            <Toaster />
            <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl">
                
                <div className="flex justify-center mb-4">
                    <img 
                        src="/logo.png" 
                        alt="Logo" 
                        className="w-32 h-32 object-contain"
                    />
                </div>

                <h2 className="text-2xl font-bold text-center mb-6">ระบบเช็คชื่อออนไลน์</h2>
                
                <input 
                    type="email" 
                    placeholder="กรอกอีเมล (Gmail)" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded-xl mb-4 border border-gray-700 focus:outline-none focus:border-blue-500"
                />
                <input 
                    type="password" 
                    placeholder="รหัสผ่าน" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded-xl mb-6 border border-gray-700 focus:outline-none focus:border-blue-500"
                />
                
                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-700 transition mb-4 disabled:opacity-50"
                >
                    {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                </button>

                <button 
                    type="button" 
                    onClick={handleForgotPassword} 
                    className="w-full text-sm text-gray-500 hover:text-blue-400 transition"
                >
                    ลืมรหัสผ่าน? (ส่งลิงก์ไปที่อีเมล)
                </button>
            </form>
        </div>
    );
}