'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function PrintStudentsPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // ฟังก์ชันคำนวณอายุอัตโนมัติจาก ว.ด.ป. เกิด
    const calculateAge = (birthDate) => {
        if (!birthDate) return '-';
        try {
            const currentYear = new Date().getFullYear();
            const parts = birthDate.split(' ');
            let birthYear = parseInt(parts[parts.length - 1]);
            
            if (birthYear < 100) birthYear += 2500;
            
            const age = (currentYear + 543) - birthYear;
            return age > 0 ? age : '-';
        } catch (e) { return '-'; }
    };

    // เช็คสิทธิ์ผู้ใช้งาน
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

    // ดึงห้องเรียน
    useEffect(() => {
        if (!userProfile) return;
        const fetchClasses = async () => {
            try {
                const allClassroomsSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
                const existingClassesMap = new Set(allClassroomsSnap.docs.map(d => `${d.data().className} ${d.data().department || ''}`.trim()));
                let classes = userProfile.role === 'admin' ? Array.from(existingClassesMap) : (userProfile.assignedClasses || []).filter(c => existingClassesMap.has(c));
                classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setClassrooms(classes);
                if (classes.length > 0) setSelectedClass(classes[0]);
            } catch (error) { toast.error("เกิดข้อผิดพลาดในการโหลดห้องเรียน"); }
        };
        fetchClasses();
    }, [userProfile]);

    // ดึงรายชื่อนักเรียนตามห้องที่เลือก
    useEffect(() => {
        const fetchStudentsData = async () => {
            if (!selectedClass) { setStudents([]); return; }
            const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
            const snap = await getDocs(q);
            setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchStudentsData();
    }, [selectedClass]);

    if (isLoading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">กำลังโหลด...</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6 print:bg-white print:text-black">
            <Toaster />
            <div className="max-w-5xl mx-auto mb-6 print:hidden flex justify-between items-center bg-gray-900 p-6 rounded-3xl border border-gray-800">
                <h1 className="text-xl font-bold">🖨️ พิมพ์ระเบียนประวัตินักเรียน</h1>
                <div className="flex gap-2">
                    <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-gray-800 p-2 rounded-xl text-sm">
                        {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => window.print()} className="bg-indigo-600 px-5 py-2 rounded-xl font-bold">สั่งพิมพ์</button>
                    <button onClick={() => router.back()} className="bg-gray-800 px-5 py-2 rounded-xl">ย้อนกลับ</button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto bg-gray-900 print:bg-white p-8 rounded-3xl border border-gray-800 print:border-none">
                <div className="flex items-center justify-center gap-6 mb-6">
                    <img src="https://www.sichon.ac.th/images/logo.png" alt="Logo" className="h-20 w-auto print:block hidden" />
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white print:text-black">ระเบียนประวัติและรายชื่อนักเรียน</h2>
                        <p className="text-gray-400 print:text-gray-600 text-sm">ห้องเรียน: {selectedClass}</p>
                    </div>
                </div>

                <table className="w-full text-sm border-collapse border border-gray-700 print:border-gray-400">
                    <thead>
                        <tr className="bg-gray-800 print:bg-gray-200 text-gray-300 print:text-black">
                            <th className="border border-gray-400 p-2">ลำดับที่</th>
                            <th className="border border-gray-400 p-2">รหัสนักศึกษา</th>
                            <th className="border border-gray-400 p-2">ชื่อ - นามสกุล</th>
                            <th className="border border-gray-400 p-2">เลขประจำตัวประชาชน</th>
                            <th className="border border-gray-400 p-2">ว.ด.ป เกิด</th>
                            <th className="border border-gray-400 p-2">อายุ</th>
                            <th className="border border-gray-400 p-2">ที่อยู่</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s, index) => (
                            <tr key={s.id} className={s.status === "จำหน่าย" ? "opacity-50 line-through" : ""}>
                                <td className="border border-gray-400 p-2 text-center">{index + 1}</td>
                                <td className="border border-gray-400 p-2 text-center">{s.studentId || '-'}</td>
                                <td className="border border-gray-400 p-2">{s.name}</td>
                                <td className="border border-gray-400 p-2 text-center">{s.idCard || '-'}</td>
                                <td className="border border-gray-400 p-2 text-center">{s.birthDate || '-'}</td>
                                <td className="border border-gray-400 p-2 text-center">{calculateAge(s.birthDate)}</td>
                                <td className="border border-gray-400 p-2">{s.address || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}