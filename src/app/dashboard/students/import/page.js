'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import toast, { Toaster } from 'react-hot-toast';

export default function ImportStudentsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState([]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const cleanedData = results.data.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.trim();
                        newRow[cleanKey] = row[key];
                    });
                    return newRow;
                });

                const validData = cleanedData.filter(row => {
                    const name = (row['ชื่อ-นามสกุล'] || row['ชื่อ - นามสกุล'] || row['ชื่อสกุล'] || '').trim();
                    const studentId = (row['เลขประจำตัวนักเรียน'] || row['รหัสนักศึกษา'] || '').trim();
                    return name !== '' && studentId !== '';
                });

                setPreviewData(validData);
                if (validData.length > 0) {
                    toast.success(`โหลดข้อมูลจากไฟล์สำเร็จ (${validData.length} รายชื่อ)`);
                } else {
                    toast.error("ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบหัวคอลัมน์ในไฟล์ CSV");
                }
            },
            error: (error) => {
                toast.error("เกิดข้อผิดพลาดในการอ่านไฟล์: " + error.message);
            }
        });
    };

    const handleSyncToFirebase = async () => {
        if (previewData.length === 0) {
            toast.error("ยังไม่มีข้อมูลสำหรับอัปเดต");
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading("กำลังอัปเดตข้อมูลลงฐานข้อมูล...");

        try {
            const studentsSnap = await getDocs(collection(db, "students"));
            const existingStudents = [];
            studentsSnap.forEach((docSnap) => {
                existingStudents.push({ id: docSnap.id, ...docSnap.data() });
            });

            let updateCount = 0;
            let notFoundCount = 0;

            for (const row of previewData) {
                const csvName = (row['ชื่อ-นามสกุล'] || row['ชื่อ - นามสกุล'] || row['ชื่อสกุล'] || '').replace(/\s+/g, ' ').trim();
                const studentId = (row['เลขประจำตัวนักเรียน'] || row['รหัสนักศึกษา'] || '').trim();
                const idCard = (row['เลขประจำ'] || row['เลขประจำตัวประชาชน'] || row['เลขบัตรประจำตัวประชาชน'] || '').trim();
                const birthDate = (row['ว.ด.ป. เกิด'] || row['วันเกิด'] || '').trim();
                const address = (row['ที่อยู่'] || '').trim();

                if (!csvName) continue;

                const matchedStudent = existingStudents.find(s => {
                    const rawName = s.name ? s.name : `${s.firstName || ''} ${s.lastName || ''}`;
                    const dbName = rawName.replace(/\s+/g, ' ').trim();
                    return dbName === csvName;
                });

                if (matchedStudent) {
                    const studentRef = doc(db, "students", matchedStudent.id);
                    await updateDoc(studentRef, {
                        studentId: studentId || matchedStudent.studentId || '',
                        idCard: idCard || '',
                        birthDate: birthDate || '',
                        address: address || ''
                    });
                    updateCount++;
                } else {
                    notFoundCount++;
                }
            }

            toast.success(`อัปเดตสำเร็จ ${updateCount} รายชื่อ (ไม่พบในระบบเดิม ${notFoundCount} รายชื่อ)`, { id: toastId });
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <Toaster />
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6 bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl">
                    <h1 className="text-xl font-bold flex items-center gap-3">
                        <span className="text-indigo-500">📥</span>
                        อัปเดตประวัตินักเรียนผ่านไฟล์ CSV
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => router.push('/dashboard/students/print')} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition cursor-pointer">
                            🖨️ ไปหน้าพิมพ์ระเบียนประวัติ
                        </button>
                        <button onClick={() => router.back()} className="bg-gray-800 px-4 py-2.5 rounded-xl text-white text-sm hover:bg-gray-700 transition cursor-pointer">
                            ← ย้อนกลับ
                        </button>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl mb-6">
                    <label className="block text-sm text-gray-400 mb-2">เลือกไฟล์ CSV (ที่บันทึกมาจาก Excel ระเบียนประวัติ)</label>
                    <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 transition cursor-pointer bg-gray-950 p-3 rounded-xl border border-gray-800"
                    />
                    <p className="text-xs text-yellow-500 mt-3">
                        * หัวคอลัมน์ใน CSV รองรับ: ชื่อ-นามสกุล, เลขประจำตัวนักเรียน, เลขประจำ (หรือ เลขประจำตัวประชาชน), ว.ด.ป. เกิด, ที่อยู่
                    </p>
                </div>

                {previewData.length > 0 && (
                    <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-gray-200">ตัวอย่างข้อมูลที่จะอัปเดต ({previewData.length} แถว)</h2>
                            <button 
                                onClick={handleSyncToFirebase}
                                disabled={isLoading}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50 cursor-pointer"
                            >
                                {isLoading ? '⏳ กำลังซิงค์ข้อมูล...' : '🚀 ยืนยันอัปเดตลงฐานข้อมูล'}
                            </button>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm text-left">
                                <thead className="text-gray-400 uppercase bg-gray-800 sticky top-0">
                                    <tr>
                                        <th className="p-3">รหัสนักศึกษา</th>
                                        <th className="p-3">ชื่อ-นามสกุล</th>
                                        <th className="p-3">เลขประจำตัวประชาชน</th>
                                        <th className="p-3">ว.ด.ป. เกิด</th>
                                        <th className="p-3">ที่อยู่</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-800/50">
                                            <td className="p-3 font-mono text-indigo-400">{row['เลขประจำตัวนักเรียน'] || row['รหัสนักศึกษา']}</td>
                                            <td className="p-3">{row['ชื่อ-นามสกุล'] || row['ชื่อ - นามสกุล'] || row['ชื่อสกุล']}</td>
                                            <td className="p-3 font-mono">{row['เลขประจำ'] || row['เลขประจำตัวประชาชน']}</td>
                                            <td className="p-3">{row['ว.ด.ป. เกิด'] || row['วันเกิด']}</td>
                                            <td className="p-3">{row['ที่อยู่']}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}