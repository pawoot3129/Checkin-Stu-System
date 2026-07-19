'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentManagementWrapper() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

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

    if (isLoading || !userProfile) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">กำลังโหลด...</div>;
    return <ManageStudentsPage userProfile={userProfile} />;
}

function ManageStudentsPage({ userProfile }) {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [name, setName] = useState('');
    const [num, setNum] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
            let classes = userProfile.role === 'admin' 
                ? (await getDocs(query(collection(db, "classrooms"), orderBy("className")))).docs.map(d => `${d.data().className} ${d.data().department || ''}`.trim())
                : userProfile.assignedClasses || [];
            
            // เรียงลำดับชื่อห้องให้ถูกต้องตามหลักตัวเลข
            classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            
            setClassrooms(classes);
            if (classes.length > 0) setSelectedClass(classes[0]);
        };
        fetchClasses();
    }, [userProfile]);

    useEffect(() => { fetchStudents(); }, [selectedClass]);

    const fetchStudents = async () => {
        if (!selectedClass) return;
        const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const detectGender = (name) => {
        const n = name.trim();
        return (n.startsWith('นาง') || n.startsWith('น.ส.') || n.startsWith('ด.ญ.')) ? 'หญิง' : 'ชาย';
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!num || !name) return toast.error('กรุณากรอกข้อมูล');
        await addDoc(collection(db, 'students'), { classId: selectedClass, studentNumber: parseInt(num), name: name.trim(), gender: detectGender(name), status: "ปกติ" });
        toast.success('เพิ่มสำเร็จ');
        setNum(''); setName(''); fetchStudents();
    };

    const handleWithdraw = async (id, name) => {
        if (!window.confirm(`ยืนยันการจำหน่ายนักเรียน "${name}" ออกจากระบบหรือไม่?`)) return;
        await updateDoc(doc(db, "students", id), { status: "จำหน่าย" });
        toast.success("จำหน่ายเรียบร้อย");
        fetchStudents();
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`⚠️ คำเตือน! คุณต้องการลบชื่อ "${name}" ออกจากระบบถาวรใช่หรือไม่?`)) return;
        await deleteDoc(doc(db, 'students', id));
        toast.success("ลบนักเรียนเรียบร้อย");
        fetchStudents();
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!window.confirm(`⚠️ ยืนยันการนำเข้าไฟล์ใหม่? ข้อมูลนักเรียนทั้งหมดในห้อง "${selectedClass}" จะถูกลบและแทนที่ด้วยข้อมูลใหม่!`)) return;
        
        setIsProcessing(true);
        Papa.parse(file, {
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const batch = writeBatch(db);
                    const oldDocs = await getDocs(query(collection(db, "students"), where("classId", "==", selectedClass)));
                    oldDocs.docs.forEach(d => batch.delete(d.ref));
                    results.data.forEach((row, i) => {
                        if (i === 0) return;
                        const ref = doc(collection(db, "students"));
                        batch.set(ref, { classId: selectedClass, studentNumber: parseInt(row[0]), name: row[1].trim(), gender: detectGender(row[1]), status: "ปกติ" });
                    });
                    await batch.commit();
                    toast.success('นำเข้าสำเร็จ');
                    fetchStudents();
                } catch (e) { toast.error('เกิดข้อผิดพลาด'); }
                finally { setIsProcessing(false); }
            }
        });
    };

    const handleDeleteAll = async () => {
        if (!window.confirm(`⚠️ คำเตือน! ลบนักเรียนทั้งหมดในห้อง "${selectedClass}" ออกจากฐานข้อมูลถาวร ยืนยันหรือไม่?`)) return;
        const batch = writeBatch(db);
        students.forEach(s => batch.delete(doc(db, 'students', s.id)));
        await batch.commit();
        fetchStudents();
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            <Toaster />
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
    <h1 className="text-3xl font-bold flex items-center gap-3">
        <span className="text-indigo-500">📋</span> 
        จัดการรายชื่อนักเรียน
    </h1>
    <button onClick={() => router.back()} className="bg-gray-800 px-4 py-2 rounded-xl text-white hover:bg-gray-700 transition">← ย้อนกลับ</button>
</header>

                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">เลือกห้องเรียนที่ต้องการจัดการ</label>
                    <div className="relative">
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)} 
                            className="w-full p-4 bg-gray-900 border border-gray-700 rounded-2xl text-white appearance-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                        >
                            {classrooms.length > 0 ? (
                                classrooms.map(c => <option key={c} value={c}>{c}</option>)
                            ) : (
                                <option value="">ไม่มีห้องเรียนในความดูแล</option>
                            )}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">▼</div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700">
                        <h3 className="font-bold mb-4">เพิ่มนักเรียนทีละคน</h3>
                        <form onSubmit={handleAdd} className="flex gap-2">
                            <input type="number" value={num} onChange={e => setNum(e.target.value)} placeholder="เลขที่" className="w-20 p-3 bg-gray-800 rounded-xl"/>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="flex-1 p-3 bg-gray-800 rounded-xl"/>
                            <button type="submit" className="bg-indigo-600 px-6 py-3 rounded-xl hover:bg-indigo-500 transition">เพิ่ม</button>
                        </form>
                    </div>
                    <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700">
                        <h3 className="font-bold mb-4">นำเข้าไฟล์รายชื่อ (นามสกุล .CSV)</h3>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden"/>
                        <button disabled={isProcessing} onClick={() => fileInputRef.current.click()} className="w-full py-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition disabled:opacity-50">เลือกไฟล์</button>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="font-bold">รายชื่อ ({students.length} คน)</h3>
                        <button onClick={handleDeleteAll} className="text-red-500 text-sm hover:underline">ลบทั้งหมด</button>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-800 text-gray-400"><tr><th className="p-4">เลขที่</th><th className="p-4 text-left">ชื่อ-นามสกุล</th><th className="p-4">เพศ</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead>
                        <tbody>{students.map(s => (
                            <tr key={s.id} className={`border-t border-gray-800 ${s.status === "จำหน่าย" ? "opacity-50 line-through" : ""}`}>
                                <td className="p-4 text-center">{s.studentNumber}</td>
                                <td className="p-4">{s.name}</td>
                                <td className="p-4 text-center">{s.gender}</td>
                                <td className="p-4 text-center">{s.status}</td>
                                <td className="p-4 text-center flex justify-center gap-2">
                                    {s.status !== "จำหน่าย" && <button onClick={() => handleWithdraw(s.id, s.name)} className="text-orange-400 border border-orange-900 px-2 py-1 rounded hover:bg-orange-900/20">จำหน่าย</button>}
                                    <button onClick={() => handleDelete(s.id, s.name)} className="text-red-400 border border-red-900 px-2 py-1 rounded hover:bg-red-900/20">ลบ</button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}