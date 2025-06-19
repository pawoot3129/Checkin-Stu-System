// src/app/dashboard/settings/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function SettingsPage() {
    const router = useRouter();
    const [academicYears, setAcademicYears] = useState([]);
    const [newYear, setNewYear] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const settingsDocRef = doc(db, "system_settings", "main_config");

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            const docSnap = await getDoc(settingsDocRef);
            if (docSnap.exists() && docSnap.data().academicYears) {
                setAcademicYears(docSnap.data().academicYears.sort().reverse());
            } else {
                // If doc or field doesn't exist, create it with a default value
                const defaultYear = String(new Date().getFullYear() + 543);
                await setDoc(settingsDocRef, { academicYears: [defaultYear] }, { merge: true });
                setAcademicYears([defaultYear]);
            }
            setIsLoading(false);
        };
        fetchSettings();
    }, []);

    const handleAddYear = async (e) => {
        e.preventDefault();
        const yearToAdd = newYear.trim();
        if (!yearToAdd || isNaN(yearToAdd) || yearToAdd.length !== 4) {
            return toast.error("กรุณาป้อนปีการศึกษาเป็นตัวเลข 4 หลัก (พ.ศ.)");
        }
        if (academicYears.includes(yearToAdd)) {
            return toast.error("ปีการศึกษานี้มีอยู่แล้วในระบบ");
        }
        
        const toastId = toast.loading("กำลังเพิ่มปีการศึกษา...");
        try {
            await updateDoc(settingsDocRef, {
                academicYears: arrayUnion(yearToAdd)
            });
            setAcademicYears(prev => [...prev, yearToAdd].sort().reverse());
            setNewYear('');
            toast.success("เพิ่มปีการศึกษาสำเร็จ!", { id: toastId });
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        }
    };

    const handleDeleteYear = async (yearToDelete) => {
        if (!confirm(`ยืนยันการลบปีการศึกษา "${yearToDelete}"?`)) return;

        const toastId = toast.loading("กำลังลบปีการศึกษา...");
        try {
            await updateDoc(settingsDocRef, {
                academicYears: arrayRemove(yearToDelete)
            });
            setAcademicYears(prev => prev.filter(y => y !== yearToDelete));
            toast.success("ลบปีการศึกษาสำเร็จ!", { id: toastId });
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <Toaster position="top-center" />
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">ตั้งค่าระบบ</h1>
                <button onClick={() => router.back()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md">
                    &larr; กลับ
                </button>
            </header>

            <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">จัดการปีการศึกษา</h2>
                <form onSubmit={handleAddYear} className="flex gap-4 mb-4">
                    <input 
                        type="text" 
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        placeholder="เพิ่มปี พ.ศ. (เช่น 2567)"
                        className="flex-grow px-3 py-2 bg-gray-700 rounded-md"
                    />
                    <button type="submit" className="px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-md">เพิ่ม</button>
                </form>

                <div className="space-y-2">
                    {isLoading ? <p>Loading...</p> : academicYears.map(year => (
                        <div key={year} className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
                            <span className="font-medium">{year}</span>
                            <button onClick={() => handleDeleteYear(year)} className="text-red-500 hover:text-red-400 text-xs font-bold">
                                ลบ
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
