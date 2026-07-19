'use client';
import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();
    const [years, setYears] = useState([]);
    const [semesters, setSemesters] = useState([]); 
    const [newYear, setNewYear] = useState('');
    const [editingYear, setEditingYear] = useState(null);

    useEffect(() => { fetchSettings(); }, []);

    const fetchSettings = async () => {
        const docSnap = await getDoc(doc(db, "system_settings", "main_config"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            setYears(data.academicYears || []);
            setSemesters(data.semesters || []);
        }
    };

    const addYear = async () => {
        if (!newYear || years.includes(newYear)) return toast.error("กรุณาระบุปีที่ถูกต้อง");
        const updatedYears = [...years, newYear].sort((a,b) => b-a);
        await setDoc(doc(db, "system_settings", "main_config"), { academicYears: updatedYears, semesters }, { merge: true });
        setYears(updatedYears);
        setNewYear('');
        toast.success("เพิ่มปีการศึกษาแล้ว");
    };

    const deleteYear = async (yearToDelete) => {
        if (!confirm(`ยืนยันการลบปีการศึกษา ${yearToDelete} หรือไม่?`)) return;
        const updatedYears = years.filter(y => y !== yearToDelete);
        const updatedSemesters = semesters.filter(s => s.year !== yearToDelete);
        await setDoc(doc(db, "system_settings", "main_config"), { academicYears: updatedYears, semesters: updatedSemesters }, { merge: true });
        setYears(updatedYears);
        setSemesters(updatedSemesters);
        toast.success("ลบปีการศึกษาสำเร็จ");
    };

    const selectSemester = async (year, sem) => {
        const otherSemesters = semesters.filter(s => s.year !== year);
        const updatedSemesters = [...otherSemesters, { year, semester: sem }];
        await setDoc(doc(db, "system_settings", "main_config"), { academicYears: years, semesters: updatedSemesters }, { merge: true });
        setSemesters(updatedSemesters);
        setEditingYear(null);
        toast.success(`ตั้งค่าปี ${year} เป็นภาคเรียนที่ ${sem} แล้ว`);
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
                    <h2 className="font-bold mb-4">จัดการภาคเรียนรายปี</h2>
                    {years.map(y => {
                        const selected = semesters.find(s => s.year === y);
                        return (
                            <div key={y} className="flex items-center justify-between p-4 bg-gray-950 rounded-2xl mb-3 border border-gray-800">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-lg">ปี {y}</span>
                                    {editingYear === y ? (
                                        <div className="flex gap-2">
                                            {['1', '2', '3'].map(sem => (
                                                <button 
                                                    key={sem} 
                                                    onClick={() => selectSemester(y, sem)} 
                                                    className="px-4 py-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition text-sm"
                                                >
                                                    ภาค {sem}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4">
                                            <span className="text-green-400 font-bold">
                                                {selected ? `ภาคเรียนที่ ${selected.semester}` : "ยังไม่ได้เลือกภาคเรียน"}
                                            </span>
                                            <button 
                                                onClick={() => setEditingYear(y)} 
                                                className="text-sm bg-gray-800 px-4 py-1 rounded-lg hover:bg-gray-700 transition"
                                            >
                                                แก้ไข
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => deleteYear(y)} 
                                    className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/20 rounded-lg transition"
                                >
                                    🗑️ ลบ
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}