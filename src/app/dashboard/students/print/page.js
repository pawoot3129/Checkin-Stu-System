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
    
    // เพิ่ม State สำหรับจัดการปีการศึกษา
    const [academicYear, setAcademicYear] = useState('2569');

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
                let classes = userProfile.role === 'admin' ? Array.from(existingClassesMap) : (userProfile.assignedClasses || []).filter(c => existingClassesMap.has(c));
                classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setClassrooms(classes);
                if (classes.length > 0) setSelectedClass(classes[0]);
            } catch (error) { console.error("Error fetching classes:", error); }
        };
        fetchClasses();
    }, [userProfile]);

    useEffect(() => {
        const fetchStudents = async () => {
            if (!selectedClass) { setStudents([]); return; }
            const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
            const snap = await getDocs(q);
            setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchStudents();
    }, [selectedClass]);

    const calculateAge = (birthDateStr) => {
        if (!birthDateStr) return '-';
        const match = birthDateStr.match(/\d{2}$/); 
        return match ? (new Date().getFullYear() + 543) - (2500 + parseInt(match[0])) : '-';
    };

    if (isLoading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white font-sans">กำลังโหลดข้อมูล...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 print:bg-white print:text-black">
            <style jsx global>{`
                @media print {
                    @page { 
                        size: A4 landscape; 
                        margin: 10mm; 
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    input, select {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                    }
                }
            `}</style>
            
            {/* ส่วนควบคุมหน้าจอ (ซ่อนตอนปริ้นท์) */}
            <div className="max-w-6xl mx-auto p-6 no-print">
                <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
                        <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">🖨️</span> 
                        พิมพ์ระเบียนประวัติผู้เรียน
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-2xl border border-gray-700">
                            <span className="text-xs text-gray-400">ปีการศึกษา:</span>
                            <input 
                                type="text" 
                                value={academicYear} 
                                onChange={(e) => setAcademicYear(e.target.value)}
                                className="w-16 bg-transparent text-white text-center font-bold outline-none text-sm"
                            />
                        </div>
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)} 
                            className="p-3.5 bg-gray-800 border border-gray-700 rounded-2xl text-white outline-none focus:border-indigo-500 transition cursor-pointer font-medium"
                        >
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button 
                            onClick={() => window.print()} 
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-3.5 rounded-2xl font-bold text-white shadow-lg shadow-emerald-900/30 transform hover:-translate-y-0.5 transition active:translate-y-0 flex items-center gap-2"
                        >
                            <span>🖨️</span> สั่งพิมพ์เอกสาร
                        </button>
                        <button 
                            onClick={() => router.back()} 
                            className="bg-gray-800 hover:bg-gray-700 px-6 py-3.5 rounded-2xl text-gray-300 hover:text-white border border-gray-700/50 transition font-medium"
                        >
                            ← ย้อนกลับ
                        </button>
                    </div>
                </div>
            </div>

            {/* ส่วนกระดาษเอกสารสำหรับแสดงผลและสั่งพิมพ์ */}
            <div className="max-w-6xl mx-auto px-6 pb-10 print:p-0">
                <div className="bg-white text-black p-8 rounded-2xl shadow-2xl print:shadow-none border border-gray-200 print:border-none">
                    <div className="text-center mb-6 font-serif">
                        <img src="/logo.png" className="mx-auto h-20 mb-3 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                        <h2 className="text-xl font-bold tracking-wide">บัญชีเรียกชื่อนักเรียน</h2>
                        <p className="text-sm text-gray-700 mt-1">
                            ห้องเรียน: <span className="font-semibold text-black">{selectedClass}</span> 
                            &nbsp;|&nbsp; ปีการศึกษา: <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-14 text-center font-semibold text-black bg-transparent border-b border-dotted border-black" /> 
                            &nbsp;|&nbsp; วิทยาลัยเทคโนโลยีพณิชยการสิชล
                        </p>
                    </div>

                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100 print:bg-gray-200">
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">ลำดับ</th>
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">รหัสนักศึกษา</th>
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">ชื่อ - นามสกุล</th>
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">เลขประจำตัวประชาชน</th>
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">ว.ด.ป. เกิด</th>
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">อายุ</th>
                                <th className="border border-gray-400 p-2.5 text-center font-bold text-black">ที่อยู่</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50/50">
                                    <td className="border border-gray-400 p-2 text-center">{s.studentNumber}</td>
                                    <td className="border border-gray-400 p-2 text-center font-mono">{s.studentId || '-'}</td>
                                    <td className="border border-gray-400 p-2 font-semibold">{s.name}</td>
                                    <td className="border border-gray-400 p-2 text-center font-mono">{s.idCard || '-'}</td>
                                    <td className="border border-gray-400 p-2 text-center">{s.birthDate || '-'}</td>
                                    <td className="border border-gray-400 p-2 text-center">{calculateAge(s.birthDate)}</td>
                                    <td className="border border-gray-400 p-2 text-xs">{s.address || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* ส่วนลายเซ็นท้ายกระดาษ */}
                    <div className="mt-14 grid grid-cols-2 gap-8 text-center text-sm font-serif">
                        <div>
                            <p className="mb-6">ลงชื่อ...........................................................</p>
                            <p className="mb-1">(.................................................................)</p>
                            <p className="font-medium">ครูที่ปรึกษา</p>
                        </div>
                        <div>
                            <p className="mb-6">ลงชื่อ...........................................................</p>
                            <p className="mb-1 font-medium">(ดร.ประชากร บริบูรณ์)</p>
                            <p className="font-medium">ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}