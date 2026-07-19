'use client';
import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function ManageClassroomsPage() {
    const router = useRouter();
    const [classrooms, setClassrooms] = useState([]);
    const [newClassName, setNewClassName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchClassrooms = async () => {
        const q = query(collection(db, "classrooms"), orderBy("className"));
        const snap = await getDocs(q);
        setClassrooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    useEffect(() => { fetchClassrooms(); }, []);

    const addClass = async () => {
        if (!newClassName.trim()) return toast.error("กรุณากรอกชื่อห้องเรียน");
        if (classrooms.some(c => c.className === newClassName.trim())) return toast.error("ชื่อห้องนี้มีอยู่แล้วในระบบ");
        
        setIsLoading(true);
        try {
            await addDoc(collection(db, "classrooms"), { className: newClassName.trim() });
            setNewClassName('');
            fetchClassrooms();
            toast.success("เพิ่มห้องเรียนสำเร็จ");
        } catch (error) { 
            console.error(error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก"); 
        } finally { setIsLoading(false); }
    };

    const deleteClass = async (id) => {
        if (!confirm("ยืนยันการลบห้องเรียนนี้? ข้อมูลที่ผูกกับห้องนี้อาจมีผลกระทบ")) return;
        try {
            await deleteDoc(doc(db, "classrooms", id));
            fetchClassrooms();
            toast.success("ลบห้องเรียนสำเร็จ");
        } catch (error) { 
            console.error(error);
            toast.error("ไม่สามารถลบได้"); 
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            
            <div className="max-w-2xl mx-auto">
                {/* Header พร้อมปุ่มย้อนกลับที่ปรับดีไซน์แล้ว */}
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <span className="text-indigo-400">🏫</span>
                        จัดการห้องเรียน
                    </h1>
                    <button 
                        onClick={() => router.back()} 
                        className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl transition font-medium"
                    >
                        ← ย้อนกลับ
                    </button>
                </header>

                {/* ส่วนเพิ่มห้องเรียน */}
                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 mb-8 flex gap-4 shadow-xl">
                    <input 
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="กรอกชื่อห้องเรียน (เช่น ปวส.1/1)"
                        className="flex-1 bg-gray-950 p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <button 
                        onClick={addClass} 
                        disabled={isLoading} 
                        className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                        {isLoading ? 'กำลังบันทึก...' : 'เพิ่มห้องเรียน'}
                    </button>
                </div>

                {/* รายการห้องเรียน */}
                <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                    {classrooms.length > 0 ? classrooms.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-5 border-b border-gray-800 hover:bg-gray-800 transition-all">
                            <span className="font-semibold text-lg">{c.className}</span>
                            <button 
                                onClick={() => deleteClass(c.id)} 
                                className="text-red-400 hover:text-red-300 font-medium px-4 py-2 hover:bg-red-900/20 rounded-lg transition"
                            >
                                ลบ
                            </button>
                        </div>
                    )) : (
                        <div className="p-10 text-center text-gray-500">ยังไม่มีข้อมูลห้องเรียน</div>
                    )}
                </div>
            </div>
        </div>
    );
}