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
    const [academicYear, setAcademicYear] = useState('2569');
    const [viewMode, setViewMode] = useState('list'); 

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

    const totalCount = students.length;
    const maleCount = students.filter(s => s.gender === 'ชาย' || (s.name && (s.name.startsWith('นาย') || s.name.startsWith('ด.ช.')))).length;
    const femaleCount = totalCount - maleCount;

    if (isLoading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">กำลังโหลด...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 print:bg-white print:text-black">
            <style jsx global>{`
                @media print {
                    @page { size: A4 ${viewMode === 'cover' ? 'portrait' : 'landscape'}; margin: 10mm; }
                    .no-print { display: none !important; }
                    .print-full-page { height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
                }
            `}</style>
            
            {/* แถบควบคุมด้านบนสุด จัดวางใหม่ให้ใช้งานง่าย */}
            <div className="max-w-6xl mx-auto p-6 no-print">
                <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl gap-4">
                    
                    {/* ฝั่งซ้าย: หัวข้อ + ปุ่มสลับหน้าปก/หน้ารายชื่อ + ปุ่มสั่งพิมพ์ */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">🖨️</span>
                            {viewMode === 'cover' ? 'พรีวิวหน้าปกรายงาน' : 'พิมพ์ระเบียนประวัติ'}
                        </h1>
                        
                        <button 
                            onClick={() => setViewMode(viewMode === 'cover' ? 'list' : 'cover')}
                            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl font-bold text-white text-sm shadow-md transition cursor-pointer flex items-center gap-1.5"
                        >
                            <span>{viewMode === 'cover' ? '📋 หน้ารายชื่อ' : '📖 หน้าปก'}</span>
                        </button>

                        <button 
                            onClick={() => window.print()} 
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-2.5 rounded-xl font-bold text-white text-sm shadow-md transition cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🖨️</span> สั่งพิมพ์{viewMode === 'cover' ? 'หน้าปก' : 'เอกสาร'}
                        </button>
                    </div>

                    {/* ฝั่งขวา: ปีการศึกษา, เลือกห้อง, ปุ่มย้อนกลับ */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-xl border border-gray-700">
                            <span className="text-xs text-gray-400">ปีการศึกษา:</span>
                            <input 
                                type="text" 
                                value={academicYear} 
                                onChange={(e) => setAcademicYear(e.target.value)}
                                className="w-14 bg-transparent text-white text-center font-bold outline-none text-sm"
                            />
                        </div>
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)} 
                            className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none cursor-pointer text-sm font-medium"
                        >
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button 
                            onClick={() => router.back()} 
                            className="bg-gray-800 hover:bg-gray-700 px-4 py-2.5 rounded-xl text-gray-300 hover:text-white border border-gray-700/50 transition font-bold text-sm flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>←</span> ย้อนกลับ
                        </button>
                    </div>
                </div>
            </div>

            {/* ส่วนกระดาษแสดงผล */}
            <div className="max-w-6xl mx-auto px-6 pb-12 print:p-0">
                {viewMode === 'cover' ? (
                    <div className="max-w-[210mm] mx-auto bg-white text-black p-8 rounded-2xl shadow-lg border border-gray-200 print:border-none print-full-page font-serif">
                        <div className="text-center">
                            <img src="/logo.png" className="mx-auto h-24 mb-4 object-contain" onError={(e) => e.target.style.display = 'none'} />
                            <h1 className="text-2xl font-bold mb-1">บัญชีเรียกชื่อนักเรียน</h1>
                            <p className="text-lg font-semibold text-gray-800">ห้องเรียน: {selectedClass}</p>
                            <p className="text-sm text-gray-600">ปีการศึกษา {academicYear}</p>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-300 space-y-2 my-4 font-sans text-sm">
                            <div className="flex justify-between border-b border-gray-200 pb-2"><span>จำนวนนักเรียนในบัญชีเรียกชื่อ:</span><span>ชาย {maleCount} คน | หญิง {femaleCount} คน | <strong>รวม {totalCount} คน</strong></span></div>
                            <div className="flex justify-between border-b border-gray-200 pb-2"><span>จำนวนนักเรียนเข้าระหว่างปี:</span><span>ชาย 0 คน | หญิง 0 คน | <strong>รวม 0 คน</strong></span></div>
                            <div className="flex justify-between pb-1"><span>จำนวนนักเรียนออกระหว่างปี:</span><span>ชาย 0 คน | หญิง 0 คน | <strong>รวม 0 คน</strong></span></div>
                        </div>

                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                            <p className="text-sm">สำนักงานคณะกรรมการการอาชีวศึกษา</p>
                            <p className="text-sm">อำเภอสิชล จังหวัดนครศรีธรรมราช</p>
                            <p className="text-sm font-medium mt-3">เริ่มใช้เมื่อวันที่ 20 เดือน พฤษภาคม พ.ศ. {academicYear}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8 text-center text-sm mt-6">
                            <div>
                                <p className="mb-8">ลงชื่อ...........................................................</p>
                                <p>({userProfile?.name || '................................'})<br/>ครูที่ปรึกษา</p>
                            </div>
                            <div>
                                <p className="mb-8">ลงชื่อ...........................................................</p>
                                <p>(ดร.ประชากร บริบูรณ์)<br/>ผู้อำนวยการวิทยาลัยฯ</p>
                            </div>
                        </div>
                    </div>
                ) : (
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
                        
                        <div className="mt-14 grid grid-cols-2 gap-8 text-center text-sm font-serif">
                            <div>
                                <p className="mb-6">ลงชื่อ...........................................................</p>
                                <p className="mb-1">({userProfile?.name || '.................................................................'})</p>
                                <p className="font-medium">ครูที่ปรึกษา</p>
                            </div>
                            <div>
                                <p className="mb-6">ลงชื่อ...........................................................</p>
                                <p className="mb-1 font-medium">(ดร.ประชากร บริบูรณ์)</p>
                                <p className="font-medium">ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}