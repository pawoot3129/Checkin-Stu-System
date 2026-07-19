'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function SystemResetPage() {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async () => {
        if (confirmText !== "RESET") return toast.error("กรุณาพิมพ์คำว่า RESET เพื่อยืนยัน");
        setIsLoading(true);
        
        try {
            const collectionsToReset = [
                'attendance', 
                'students', 
                'users', 
                'activities', 
                'evaluation_rules', 
                'classrooms'
            ];
            
            for (const colName of collectionsToReset) {
                const snap = await getDocs(collection(db, colName));
                const batch = writeBatch(db);
                snap.forEach(d => {
                    // ป้องกันการลบบัญชี Admin
                    if (colName === 'users' && d.data().role === 'admin') return; 
                    batch.delete(d.ref);
                });
                await batch.commit();
            }
            
            toast.success("ล้างฐานข้อมูลและห้องเรียนทั้งหมดสำเร็จ!");
            setConfirmText('');
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 bg-gray-950 min-h-screen text-white">
            <Toaster />
            {/* ปุ่มย้อนกลับ */}
            <div className="max-w-xl mx-auto mb-6">
                <button 
                    onClick={() => router.back()} 
                    className="text-gray-400 hover:text-white transition font-bold"
                >
                    ← ย้อนกลับ
                </button>
            </div>

            <div className="max-w-xl mx-auto bg-gray-900 p-8 rounded-2xl border border-red-900 shadow-2xl">
                <h1 className="text-2xl font-bold text-red-500 mb-4">⚠️ คำเตือน: รีเซ็ตระบบฐานข้อมูล</h1>
                <p className="text-sm text-gray-400 mb-6">
                    การกระทำนี้จะลบข้อมูลการเช็คชื่อ, รายชื่อนักเรียน, ข้อมูลครู และ <b>ข้อมูลห้องเรียนทั้งหมด</b> (ยกเว้นบัญชี Admin) ไม่สามารถกู้คืนได้!
                </p>
                
                <input 
                    type="text" 
                    placeholder="พิมพ์ RESET เพื่อยืนยัน" 
                    value={confirmText} 
                    onChange={e => setConfirmText(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded-xl mb-6 border border-gray-700 text-center uppercase"
                />
                
                {/* ปุ่มสีแดงเข้มที่ดูอันตราย */}
                <button 
                    onClick={handleReset} 
                    disabled={isLoading}
                    className="w-full bg-red-900 border-2 border-red-600 py-3 rounded-xl font-bold text-red-200 hover:bg-red-600 hover:text-white transition duration-300 shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                >
                    {isLoading ? 'กำลังดำเนินการ...' : '🚨 ยืนยันการรีเซ็ตข้อมูลทั้งหมด'}
                </button>
            </div>
        </div>
    );
}