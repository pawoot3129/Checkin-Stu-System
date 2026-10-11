'use client';
import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();
    const [years, setYears] = useState([]);
    const [semestersByYear, setSemestersByYear] = useState({}); 
    const [newYear, setNewYear] = useState('');

    useEffect(() => { fetchSettings(); }, []);

    const fetchSettings = async () => {
        const docSnap = await getDoc(doc(db, "system_settings", "main_config"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            setYears(data.academicYears || []);
            // รองรับทั้งโครงสร้างเก่าและโครงสร้างใหม่แบบแยกรายปี
            setSemestersByYear(data.semestersByYear || {});
        }
    };

    const addYear = async () => {
        if (!newYear || years.includes(newYear)) return toast.error("กรุณาระบุปีการศึกษาให้ถูกต้อง");
        const updatedYears = [...years, newYear].sort((a, b) => b - a);
        
        await setDoc(doc(db, "system_settings", "main_config"), { 
            academicYears: updatedYears, 
            semestersByYear 
        }, { merge: true });

        setYears(updatedYears);
        setNewYear('');
        toast.success("เพิ่มปีการศึกษาแล้ว");
    };

    const deleteYear = async (yearToDelete) => {
        if (!confirm(`ยืนยันการลบปีการศึกษา ${yearToDelete} หรือไม่?`)) return;
        const updatedYears = years.themes(y => y !== yearToDelete);
        const updatedSemestersByYear = { ...semestersByYear };
        delete updatedSemestersByYear[yearToDelete];

        await setDoc(doc(db, "system_settings", "main_config"), { 
            academicYears: updatedYears, 
            semestersByYear: updatedSemestersByYear 
        }, { merge: true });

        setYears(updatedYears);
        setSemestersByYear(updatedSemestersByYear);
        toast.success("ลบปีการศึกษาสำเร็จ");
    };

    const toggleSemesterForYear = async (year, sem) => {
        const currentList = semestersByYear[year] || [];
        let updatedList = [];
        
        if (currentList.includes(sem)) {
            // ถ้ามีอยู่แล้วให้เอาออก (แต่ต้องเหลือไว้อย่างน้อย 1 ภาคเรียน)
            if (currentList.length === 1) {
                return toast.error("ต้องมีอย่างน้อย 1 ภาคเรียนในแต่ละปีการศึกษา");
            }
            updatedList = currentList.filter(s => s !== sem);
        } else {
            // ถ้ายังไม่มีให้เพิ่มเข้าไปและจัดเรียง
            updatedList = [...currentList, sem].sort((a, b) => a - b);
        }

        const updatedSemestersByYear = {
            ...semestersByYear,
            [year]: updatedList
        };

        await setDoc(doc(db, "system_settings", "main_config"), { 
            academicYears: years, 
            semestersByYear: updatedSemestersByYear 
        }, { merge: true });

        setSemestersByYear(updatedSemestersByYear);
        toast.success(`อัปเดตภาคเรียนของปี ${year} สำเร็จ`);
    };

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster />
            
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <span className="text-indigo-400">⚙️</span>
                        ตั้งค่าปีการศึกษาและภาคเรียน
                    </h1>
                    <button 
                        onClick={() => router.back()} 
                        className="bg-gray-800 px-6 py-2 rounded-xl hover:bg-gray-700 transition"
                    >
                        ← ย้อนกลับ
                    </button>
                </div>

                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 mb-6">
                    <h2 className="font-bold mb-4">เพิ่มปีการศึกษา</h2>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            value={newYear} 
                            onChange={e => setNewYear(e.target.value)} 
                            placeholder="เช่น 2569" 
                            className="p-3 bg-gray-950 rounded-xl border border-gray-700 flex-1"
                        />
                        <button onClick={addYear} className="bg-indigo-600 px-8 py-2 rounded-xl font-bold hover:bg-indigo-500 transition">เพิ่มปี</button>
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
                    <h2 className="font-bold mb-4">จัดการภาคเรียนรายปี (คลิกเลือกภาคเรียนที่เปิดใช้งาน)</h2>
                    {years.map(y => {
                        const activeSemesters = semestersByYear[y] || ['1'];
                        return (
                            <div key={y} className="p-4 bg-gray-950 rounded-2xl mb-4 border border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <span className="font-bold text-lg block">ปีการศึกษา {y}</span>
                                    <span className="text-xs text-gray-400">ภาคเรียนที่เปิดใช้งาน: <strong className="text-green-400">{activeSemesters.map(s => `ภาค ${s}`).join(', ')}</strong></span>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                                    <div className="flex gap-2">
                                        {['1', '2', '3'].map(sem => {
                                            const isActive = activeSemesters.includes(sem);
                                            return (
                                                <button 
                                                    key={sem} 
                                                    onClick={() => toggleSemesterForYear(y, sem)} 
                                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                                >
                                                    {isActive ? `✓ ภาค ${sem}` : `+ ภาค ${sem}`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button 
                                        onClick={() => deleteYear(y)} 
                                        className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/20 rounded-lg transition"
                                        title="ลบปีการศึกษา"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}