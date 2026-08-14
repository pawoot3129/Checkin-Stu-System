'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function PrintStudentsPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, 'users'), where('email', '==', user.email));
                const snap = await getDocs(q);
                if (!snap.empty) setUserProfile(snap.docs[0].data());
                else router.push('/dashboard');
            } else router.push('/');
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        const fetchClasses = async () => {
            if (!userProfile) return;
            try {
                const allClassroomsSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
                const existingClassesMap = new Set(
                    allClassroomsSnap.docs.map(d => `${d.data().className} ${d.data().department || ''}`.trim())
                );

                let classes = [];
                if (userProfile.role === 'admin') {
                    classes = Array.from(existingClassesMap);
                } else {
                    const assigned = userProfile.assignedClasses || [];
                    classes = assigned.filter(c => existingClassesMap.has(c));
                }
                
                classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setClassrooms(classes);
                if (classes.length > 0) setSelectedClass(classes[0]);
            } catch (error) {
                console.error("Error fetching classes:", error);
            }
        };
        fetchClasses();
    }, [userProfile]);

    useEffect(() => {
        const fetchStudents = async () => {
            if (!selectedClass) {
                setStudents([]);
                return;
            }
            const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
            const snap = await getDocs(q);
            setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchStudents();
    }, [selectedClass]);

    const calculateAge = (birthDateStr) => {
        if (!birthDateStr) return '-';
        const match = birthDateStr.match(/\d{2}$/); 
        if (match) {
            let birthYear = 2500 + parseInt(match[0]);
            let currentYear = new Date().getFullYear() + 543;
            return currentYear - birthYear;
        }
        return '-';
    };

    if (isLoading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">กำลังโหลด...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 print:bg-white print:text-black">
            
            {/* แถบเครื่องมือด้านบน (ซ่อนตอนพิมพ์) */}
            <div className="max-w-6xl mx-auto p-6 print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-xl gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
                        <span className="text-emerald-500">🖨️</span> พิมพ์ระเบียนประวัตินักเรียน
                    </h1>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)} 
                            className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-emerald-500 w-full md:w-64 cursor-pointer"
                        >
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button 
                            onClick={() => window.print()} 
                            className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl text-white font-bold transition shadow-lg whitespace-nowrap flex items-center gap-2"
                        >
                            สั่งพิมพ์
                        </button>
                        <button 
                            onClick={() => router.back()} 
                            className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl text-white transition whitespace-nowrap"
                        >
                            ย้อนกลับ
                        </button>
                    </div>
                </div>
            </div>

            {/* ส่วนกระดาษจำลองสำหรับพิมพ์ */}
            <div className="max-w-6xl mx-auto px-6 pb-10 print:p-0 print:max-w-none">
                <div className="bg-white text-black p-10 md:p-12 rounded-xl shadow-2xl print:shadow-none print:p-0">
                    
                    {/* หัวเอกสารพร้อมโลโก้ */}
                    <div className="text-center mb-8 font-serif">
                        <img 
                            src="/images/logo.png" 
                            alt="Logo" 
                            className="mx-auto h-20 mb-3 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }} // ซ่อนอัตโนมัติถ้ายังไม่ได้ใส่ไฟล์รูป
                        />
                        <h2 className="text-2xl font-bold mb-2">ระเบียนประวัติและรายชื่อนักเรียน</h2>
                        <p className="text-lg">ห้องเรียน: <span className="font-bold">{selectedClass}</span></p>
                        <p className="text-md text-gray-700 mt-1">วิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                    </div>

                    {/* ตารางข้อมูล */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-100 print:bg-gray-200">
                                    <th className="border border-gray-400 p-3 text-center w-16">ลำดับที่</th>
                                    <th className="border border-gray-400 p-3 text-center">รหัสนักศึกษา</th>
                                    <th className="border border-gray-400 p-3 text-left">ชื่อ - นามสกุล</th>
                                    <th className="border border-gray-400 p-3 text-center">เลขประจำตัวประชาชน</th>
                                    <th className="border border-gray-400 p-3 text-center w-24">ว.ด.ป. เกิด</th>
                                    <th className="border border-gray-400 p-3 text-center w-16">อายุ</th>
                                    <th className="border border-gray-400 p-3 text-left">ที่อยู่</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s, index) => (
                                    <tr key={s.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                                        <td className="border border-gray-400 p-3 text-center">{s.studentNumber}</td>
                                        <td className="border border-gray-400 p-3 text-center font-mono">{s.studentId || '-'}</td>
                                        <td className="border border-gray-400 p-3 font-semibold">{s.name}</td>
                                        <td className="border border-gray-400 p-3 text-center font-mono">{s.idCard || '-'}</td>
                                        <td className="border border-gray-400 p-3 text-center">{s.birthDate || '-'}</td>
                                        <td className="border border-gray-400 p-3 text-center">{calculateAge(s.birthDate)}</td>
                                        <td className="border border-gray-400 p-3 text-xs md:text-sm leading-relaxed max-w-xs">{s.address || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* ส่วนลงนามท้ายเอกสาร (ครูที่ปรึกษา & ผู้อำนวยการ) */}
                    <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm font-serif">
                        <div className="flex flex-col items-center">
                            <p className="mb-12">ลงชื่อ...........................................................</p>
                            <p>(.................................................................)</p>
                            <p className="mt-1">ครูที่ปรึกษา</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <p className="mb-12">ลงชื่อ...........................................................</p>
                            <p>(ดร.ประชากร  บริบูรณ์)</p>
                            <p className="mt-1">ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}