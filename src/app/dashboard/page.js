'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/'); return; }
            const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
            if (!snap.empty) setUserProfile(snap.docs[0].data());
        });
        return () => unsubscribe();
    }, [router]);

    const handleLogout = async () => { await signOut(auth); router.push('/'); };

    const handleResetDatabase = async () => {
        if (!confirm("⚠️ คำเตือน: ข้อมูลทั้งหมดในระบบจะถูกลบถาวร! ยืนยันหรือไม่?")) return;
        try {
            const collectionsToClear = ['students', 'attendance', 'activities', 'home_visits'];
            for (const col of collectionsToClear) {
                const snap = await getDocs(collection(db, col));
                for (const d of snap.docs) { await deleteDoc(doc(db, col, d.id)); }
            }
            toast.success("ล้างข้อมูลสำเร็จ");
        } catch (e) { toast.error("เกิดข้อผิดพลาด"); }
    };

    const menuItems = [
        { label: 'จัดการปีการศึกษา', path: '/dashboard/settings', icon: '📅', adminOnly: true },
        { label: 'กำหนดรายการกิจกรรม', path: '/dashboard/activities', icon: '📝', adminOnly: true },
        { label: 'จัดการผู้ใช้งาน', path: '/dashboard/teachers', icon: '👥', adminOnly: true },
        { label: 'จัดการห้องเรียน', path: '/dashboard/classrooms', icon: '🏫', adminOnly: true },
        // เพิ่มเมนูเยี่ยมบ้านเข้าไปตรงนี้
        { label: 'บันทึกเยี่ยมบ้าน', path: '/dashboard/home-visit', icon: '🏠', adminOnly: false },
        { label: 'เช็คกิจกรรม', path: '/dashboard/advisor', icon: '✅', adminOnly: false },
        { label: 'จัดการข้อมูลนักเรียน', path: '/dashboard/students', icon: '🎓', adminOnly: false },
        { label: 'รายงานและสถิติ', path: '/dashboard/reports', icon: '📊', adminOnly: false },
    ];

    return (
        <div className="min-h-screen bg-gray-950 p-8 text-white">
            <Toaster position="top-center" />
            
            {userProfile && (
                <div className="max-w-6xl mx-auto mb-10 bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                    <h1 className="text-4xl font-extrabold mb-4 text-white">สวัสดี, {userProfile.name}</h1>
                    <div className="flex flex-wrap gap-3">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${userProfile.role === 'admin' ? 'bg-indigo-900 text-indigo-200' : 'bg-emerald-900 text-emerald-200'}`}>
                            {userProfile.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูที่ปรึกษา'}
                        </span>
                        {userProfile.role !== 'admin' && userProfile.assignedClasses && (
                            <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-300">
                                ห้องที่รับผิดชอบ: {userProfile.assignedClasses.join(', ')}
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-6">
                {menuItems
                    .filter(item => {
                        if (userProfile?.role === 'admin') {
                            // แอดมินให้เห็นทุกอย่าง ยกเว้นเมนูเช็คกิจกรรมของครู
                            return item.path !== '/dashboard/advisor';
                        }
                        // ครูเห็นเฉพาะที่ไม่ใช่ adminOnly
                        return !item.adminOnly;
                    })
                    .map((item) => (
                        <button 
                            key={item.label} 
                            onClick={() => router.push(item.path)} 
                            className="bg-gray-900 hover:bg-gray-800 p-8 rounded-3xl border border-gray-800 hover:border-indigo-500 transition-all text-left flex items-center gap-4 w-full md:w-[320px] shadow-lg"
                        >
                            <div className="text-3xl bg-gray-950 p-4 rounded-2xl">{item.icon}</div>
                            <span className="text-lg font-bold">{item.label}</span>
                        </button>
                    ))
                }

                {userProfile?.role === 'admin' && (
                    <button onClick={handleResetDatabase} className="bg-orange-950/20 hover:bg-orange-900/40 p-8 rounded-3xl border border-orange-900/50 transition-all text-left flex items-center gap-4 w-full md:w-[320px] shadow-lg">
                        <div className="text-3xl bg-gray-950 p-4 rounded-2xl">🗑️</div>
                        <span className="text-lg font-bold text-orange-400">ล้างข้อมูลทั้งหมด</span>
                    </button>
                )}

                <button onClick={handleLogout} className="bg-red-950/20 hover:bg-red-900/40 p-8 rounded-3xl border border-red-900/50 transition-all text-left flex items-center gap-4 w-full md:w-[320px] shadow-lg">
                    <div className="text-3xl bg-gray-950 p-4 rounded-2xl">🚪</div>
                    <span className="text-lg font-bold text-red-400">ออกจากระบบ</span>
                </button>
            </div>
        </div>
    );
}