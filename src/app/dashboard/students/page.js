'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
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
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    
    // State สำหรับฟอร์มเพิ่มทีละคน (ครบทุกช่องระเบียนประวัติ)
    const [num, setNum] = useState('');
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [idCard, setIdCard] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [address, setAddress] = useState('');

    // State สำหรับ Modal แก้ไขข้อมูลทั้งหมด
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({
        studentId: '',
        name: '',
        idCard: '',
        birthDate: '',
        address: ''
    });

    useEffect(() => {
        const fetchClasses = async () => {
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
                else setSelectedClass('');
            } catch (error) {
                console.error("Error fetching classes:", error);
                toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูลห้องเรียน");
            }
        };
        fetchClasses();
    }, [userProfile]);

    useEffect(() => { fetchStudents(); }, [selectedClass]);

    const fetchStudents = async () => {
        if (!selectedClass) {
            setStudents([]);
            return;
        }
        const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const detectGender = (name) => {
        const n = name.trim();
        return (n.startsWith('นาง') || n.startsWith('น.ส.') || n.startsWith('ด.ญ.')) ? 'หญิง' : 'ชาย';
    };

    // ฟังก์ชันเพิ่มนักเรียนทีละคนพร้อมระเบียนประวัติครบถ้วน
    const handleAdd = async (e) => {
        e.preventDefault();
        if (!num || !name) return toast.error('กรุณากรอกเลขที่และชื่อ-นามสกุล');
        
        try {
            await addDoc(collection(db, 'students'), { 
                classId: selectedClass, 
                studentNumber: parseInt(num), 
                name: name.trim(), 
                studentId: studentId.trim(),
                idCard: idCard.trim(),
                birthDate: birthDate.trim(),
                address: address.trim(),
                gender: detectGender(name), 
                status: "ปกติ" 
            });
            toast.success('เพิ่มนักเรียนสำเร็จ');
            setNum(''); 
            setName(''); 
            setStudentId('');
            setIdCard('');
            setBirthDate('');
            setAddress('');
            fetchStudents();
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการเพิ่มข้อมูล");
        }
    };

    // เปิด Modal แก้ไขข้อมูล
    const openEditModal = (student) => {
        setEditingStudent(student);
        setFormData({
            studentId: student.studentId || '',
            name: student.name || '',
            idCard: student.idCard || '',
            birthDate: student.birthDate || '',
            address: student.address || ''
        });
    };

    // บันทึกข้อมูลที่แก้ไขผ่าน Modal
    const handleUpdateStudent = async (e) => {
        e.preventDefault();
        if (!editingStudent) return;
        try {
            const studentRef = doc(db, "students", editingStudent.id);
            await updateDoc(studentRef, {
                studentId: formData.studentId.trim(),
                name: formData.name.trim(),
                gender: detectGender(formData.name),
                idCard: formData.idCard.trim(),
                birthDate: formData.birthDate.trim(),
                address: formData.address.trim()
            });
            toast.success("บันทึกการแก้ไขสำเร็จ");
            setEditingStudent(null);
            fetchStudents();
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        }
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
            <div className="max-w-7xl mx-auto">
                {/* Header เหลือแค่หัวข้อกับปุ่มย้อนกลับ สะอาดตา */}
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="text-indigo-500">📋</span> 
                        จัดการรายชื่อและระเบียนประวัตินักเรียน
                    </h1>
                    <div>
                        <button onClick={() => router.back()} className="bg-gray-800 px-4 py-2 rounded-xl text-white hover:bg-gray-700 transition text-sm">← ย้อนกลับ</button>
                    </div>
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

                {/* ฟอร์มเพิ่มนักเรียน และปุ่มทางลัดด้านล่าง */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {/* ฟอร์มเพิ่มนักเรียน (กินพื้นที่ 2 คอลัมน์) */}
                    <div className="md:col-span-2 bg-gray-900 p-6 rounded-2xl border border-gray-700">
                        <h3 className="font-bold mb-4">เพิ่มนักเรียนทีละคน (พร้อมระเบียนประวัติ)</h3>
                        <form onSubmit={handleAdd} className="space-y-3">
                            <div className="flex gap-3">
                                <input type="number" value={num} onChange={e => setNum(e.target.value)} placeholder="เลขที่" className="w-28 p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-center" required />
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ - นามสกุล (เช่น นายกฤษฎา กรรฤทธิ์)" className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm" required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="รหัสนักศึกษา" className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-mono" />
                                <input value={idCard} onChange={e => setIdCard(e.target.value)} placeholder="เลขประจำตัวประชาชน 13 หลัก" className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm font-mono" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input value={birthDate} onChange={e => setBirthDate(e.target.value)} placeholder="ว.ด.ป. เกิด (เช่น 16 เม.ย. 50)" className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm" />
                                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="ที่อยู่" className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm" />
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl transition font-bold text-sm shadow-lg">➕ เพิ่มนักเรียนเข้าห้อง</button>
                            </div>
                        </form>
                    </div>

                    {/* กล่องปุ่มทางลัด (ย้ายมาไว้แทนที่ช่อง CSV เดิม) */}
                    <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold mb-2">เมนูด่วนสำหรับจัดการห้องนี้</h3>
                            <p className="text-xs text-gray-400 mb-6">พิมพ์เอกสารระเบียนประวัติ หรือจัดการข้อมูลภาพรวมของห้องเรียน</p>
                        </div>
                        <div className="space-y-3">
                            <button 
                                onClick={() => router.push('/dashboard/students/print')} 
                                className="w-full bg-emerald-600 hover:bg-emerald-500 p-3.5 rounded-xl text-white transition flex items-center justify-center gap-2 font-bold shadow-lg text-sm"
                            >
                                🖨️ ไปหน้าพิมพ์ระเบียนประวัติ
                            </button>
                            <button 
                                onClick={() => router.push('/dashboard/students/import')} 
                                className="w-full bg-indigo-600 hover:bg-indigo-500 p-3.5 rounded-xl text-white transition flex items-center justify-center gap-2 font-bold shadow-lg text-sm"
                            >
                                📥 อัปเดตระเบียนข้อมูลนักเรียน (แนบไฟล์ .csv)
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                        <h3 className="font-bold">รายชื่อและระเบียนประวัติ ({students.length} คน)</h3>
                        <button onClick={handleDeleteAll} className="text-red-400 text-sm hover:underline">ลบทั้งหมด</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                                <tr>
                                    <th className="p-4 text-center">เลขที่</th>
                                    <th className="p-4">รหัส นศ.</th>
                                    <th className="p-4">ชื่อ-นามสกุล</th>
                                    <th className="p-4 text-center">เพศ</th>
                                    <th className="p-4 text-center">เลขบัตรประชาชน</th>
                                    <th className="p-4 text-center">ว.ด.ป. เกิด</th>
                                    <th className="p-4">ที่อยู่</th>
                                    <th className="p-4 text-center">สถานะ</th>
                                    <th className="p-4 text-center">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {students.map(s => (
                                    <tr key={s.id} className={`hover:bg-gray-800/50 ${s.status === "จำหน่าย" ? "opacity-50 line-through" : ""}`}>
                                        <td className="p-4 text-center">{s.studentNumber}</td>
                                        <td className="p-4 font-mono text-indigo-400">{s.studentId || '-'}</td>
                                        <td className="p-4 font-bold">{s.name}</td>
                                        <td className="p-4 text-center">{s.gender || '-'}</td>
                                        <td className="p-4 text-center font-mono">{s.idCard || '-'}</td>
                                        <td className="p-4 text-center">{s.birthDate || '-'}</td>
                                        <td className="p-4 max-w-xs truncate text-gray-300">{s.address || '-'}</td>
                                        <td className="p-4 text-center">{s.status}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-1.5">
                                                {s.status !== "จำหน่าย" && <button onClick={() => handleWithdraw(s.id, s.name)} className="text-orange-400 border border-orange-900 px-2 py-1 rounded-lg text-xs hover:bg-orange-900/20 transition">จำหน่าย</button>}
                                                <button onClick={() => openEditModal(s)} className="text-blue-400 border border-blue-900 px-2 py-1 rounded-lg text-xs hover:bg-blue-900/20 transition">แก้ไข</button>
                                                <button onClick={() => handleDelete(s.id, s.name)} className="text-red-400 border border-red-900 px-2 py-1 rounded-lg text-xs hover:bg-red-900/20 transition">ลบ</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal สำหรับแก้ไขข้อมูลทั้งหมด */}
            {editingStudent && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 w-full max-w-lg p-6 rounded-3xl shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>✏️</span> แก้ไขข้อมูลระเบียนประวัติ
                        </h2>
                        <form onSubmit={handleUpdateStudent} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">รหัสนักศึกษา</label>
                                <input 
                                    type="text" 
                                    value={formData.studentId} 
                                    onChange={e => setFormData({...formData, studentId: e.target.value})} 
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">ชื่อ - นามสกุล</label>
                                <input 
                                    type="text" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">เลขประจำตัวประชาชน</label>
                                <input 
                                    type="text" 
                                    value={formData.idCard} 
                                    onChange={e => setFormData({...formData, idCard: e.target.value})} 
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">ว.ด.ป. เกิด (เช่น 16 เม.ย. 50)</label>
                                <input 
                                    type="text" 
                                    value={formData.birthDate} 
                                    onChange={e => setFormData({...formData, birthDate: e.target.value})} 
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">ที่อยู่</label>
                                <textarea 
                                    rows="2"
                                    value={formData.address} 
                                    onChange={e => setFormData({...formData, address: e.target.value})} 
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingStudent(null)} 
                                    className="bg-gray-800 hover:bg-gray-700 px-5 py-2.5 rounded-xl text-white text-sm transition"
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit" 
                                    className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl text-white font-bold text-sm transition"
                                >
                                    บันทึกการแก้ไข
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}