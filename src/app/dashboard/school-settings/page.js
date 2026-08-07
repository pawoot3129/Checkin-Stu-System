'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function SchoolSettingsPage() {
    const router = useRouter();
    const [schoolName, setSchoolName] = useState('วิทยาลัยเทคโนโลยีพณิชยการสิชล');
    const [logoUrl, setLogoUrl] = useState('/logo.png');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }
            // ดึงข้อมูลการตั้งค่าปัจจุบันจาก Firebase
            try {
                setIsLoading(true);
                const docRef = doc(db, "system_settings", "main_config");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.schoolName) setSchoolName(data.schoolName);
                    if (data.logoUrl) setLogoUrl(data.logoUrl);
                }
            } catch (error) {
                console.error(error);
                toast.error("โหลดข้อมูลไม่สำเร็จ");
            } finally {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    // ฟังก์ชันแปลงรูปภาพเป็น Base64 เพื่อเก็บบันทึกง่ายๆ บน Firestore
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { // จำกัดขนาดไม่เกิน 1MB
                toast.error("ขนาดไฟล์รูปภาพใหญ่เกิน 1MB กรุณาเลือกไฟล์ที่เล็กกว่าครับ");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const docRef = doc(db, "system_settings", "main_config");
            // ใช้ setDoc แบบ merge: true เพื่ออัปเดตข้อมูลโดยไม่ทับค่าอื่นที่มีอยู่
            await setDoc(docRef, {
                schoolName: schoolName,
                logoUrl: logoUrl
            }, { merge: true });
            
            toast.success("บันทึกข้อมูลสถานศึกษาสำเร็จ");
        } catch (error) {
            console.error(error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 p-8 text-white">
            <Toaster position="top-center" />
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">จัดการข้อมูลสถานศึกษา</h1>
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl transition">
                        ← กลับ
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 text-gray-400">กำลังโหลดข้อมูล...</div>
                ) : (
                    <form onSubmit={handleSave} className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl space-y-6">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ชื่อสถานศึกษา</label>
                            <input 
                                type="text" 
                                value={schoolName} 
                                onChange={(e) => setSchoolName(e.target.value)} 
                                className="w-full p-4 bg-gray-950 rounded-xl border border-gray-800 focus:border-indigo-500 outline-none transition text-white font-medium"
                                placeholder="ระบุชื่อวิทยาลัยหรือโรงเรียน"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ตราสัญลักษณ์ (โลโก้สถานศึกษา)</label>
                            <div className="flex items-center gap-6 mt-2">
                                <div className="w-24 h-24 bg-gray-950 border border-gray-800 rounded-2xl flex items-center justify-center overflow-hidden p-2">
                                    <img src={logoUrl} alt="School Logo" className="max-h-full max-w-full object-contain" />
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handleImageChange}
                                        className="w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer transition"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">แนะนำไฟล์ภาพ PNG หรือ JPG ขนาดไม่เกิน 1MB</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-800 flex justify-end">
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                            >
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}