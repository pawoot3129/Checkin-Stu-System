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

    if (isLoading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">กำลังโหลด...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 print:bg-white print:text-black">
            <style jsx global>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                }
            `}</style>
            
            <div className="max-w-6xl mx-auto p-6 print:hidden">
                <div className="flex justify-between items-center bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-xl gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-white">🖨️ พิมพ์ระเบียนประวัติ</h1>
                    <div className="flex gap-3">
                        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="p-3 bg-gray-800 rounded-xl outline-none">{classrooms.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        <button onClick={() => window.print()} className="bg-emerald-600 px-6 py-3 rounded-xl font-bold">สั่งพิมพ์</button>
                        <button onClick={() => router.back()} className="bg-gray-800 px-6 py-3 rounded-xl">ย้อนกลับ</button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 pb-10 print:p-0">
                <div className="bg-white text-black p-8 rounded-xl shadow-2xl print:shadow-none">
                    <div className="text-center mb-6 font-serif">
                        <img src="/logo.png" className="mx-auto h-20 mb-3" onError={(e) => { e.target.style.display = 'none'; }} />
                        <h2 className="text-xl font-bold">ระเบียนประวัติและรายชื่อนักเรียน</h2>
                        <p>ห้องเรียน: <b>{selectedClass}</b> | วิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                    </div>

                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100 print:bg-gray-200">
                                <th className="border border-gray-400 p-2 text-center">ลำดับ</th>
                                <th className="border border-gray-400 p-2 text-center">รหัสนักศึกษา</th>
                                <th className="border border-gray-400 p-2 text-center">ชื่อ - นามสกุล</th>
                                <th className="border border-gray-400 p-2 text-center">เลขประจำตัวประชาชน</th>
                                <th className="border border-gray-400 p-2 text-center">ว.ด.ป. เกิด</th>
                                <th className="border border-gray-400 p-2 text-center">อายุ</th>
                                <th className="border border-gray-400 p-2 text-center">ที่อยู่</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s) => (
                                <tr key={s.id}>
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
                    
                    <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm font-serif">
                        <div>
                            <p className="mb-10">ลงชื่อ...........................................................</p>
                            <p>(.................................................................)</p>
                            <p>ครูที่ปรึกษา</p>
                        </div>
                        <div>
                            <p className="mb-10">ลงชื่อ...........................................................</p>
                            <p>(ดร.ประชากร บริบูรณ์)</p>
                            <p>ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}