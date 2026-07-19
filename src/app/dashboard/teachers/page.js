'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function TeacherManagement() {
    const router = useRouter();
    const [teachers, setTeachers] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [formData, setFormData] = useState({ id: null, name: '', email: '', password: '', assignedClasses: [] });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const init = async () => {
            const user = auth.currentUser;
            if (!user) { router.push('/'); return; }
            const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
            if (snap.empty || snap.docs[0].data().role !== 'admin') {
                toast.error("สำหรับผู้ดูแลระบบเท่านั้น");
                router.push('/dashboard');
            } else { fetchTeachers(); fetchClassrooms(); }
        };
        init();
    }, [router]);

    const fetchTeachers = async () => {
        const snap = await getDocs(collection(db, 'users'));
        setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    // ปรับปรุงการเรียงลำดับห้องเรียน
    const fetchClassrooms = async () => {
        const snap = await getDocs(collection(db, 'classrooms'));
        const classes = snap.docs.map(d => {
            const data = d.data();
            return data.department ? `${data.className} ${data.department}` : data.className;
        });
        // เรียงลำดับตัวอักษร (เช่น ปวช.1 จะขึ้นก่อน ปวช.2)
        setClassrooms(classes.sort((a, b) => a.localeCompare(b, 'th')));
    };

    const toggleClass = (className) => {
        setFormData(prev => {
            const list = prev.assignedClasses.includes(className) 
                ? prev.assignedClasses.filter(c => c !== className)
                : [...prev.assignedClasses, className];
            return { ...prev, assignedClasses: list };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await updateDoc(doc(db, 'users', formData.id), {
                    name: formData.name,
                    assignedClasses: formData.assignedClasses
                });
                toast.success("แก้ไขข้อมูลสำเร็จ");
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    name: formData.name, email: formData.email, role: 'teacher', assignedClasses: formData.assignedClasses
                });
                toast.success("เพิ่มข้อมูลครูสำเร็จ");
            }
            resetForm();
            fetchTeachers();
        } catch (e) { toast.error("เกิดข้อผิดพลาด: " + e.message); }
    };

    const startEdit = (teacher) => {
        setFormData(teacher);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({ id: null, name: '', email: '', password: '', assignedClasses: [] });
        setIsEditing(false);
    };

    const handleDelete = async (id) => {
        if (!confirm("ยืนยันการลบบัญชีครูท่านนี้?")) return;
        try { await deleteDoc(doc(db, 'users', id)); toast.success("ลบสำเร็จ"); fetchTeachers(); } 
        catch (e) { toast.error("ลบไม่สำเร็จ"); }
    };

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">{isEditing ? 'แก้ไขข้อมูลครู' : 'จัดการบัญชีผู้ใช้งาน'}</h1>
                <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl transition">← กลับ</button>
            </header>

            <form onSubmit={handleSubmit} className="bg-gray-900 p-8 rounded-3xl border border-gray-800 mb-8 max-w-4xl mx-auto shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input type="text" placeholder="ชื่อ-นามสกุล" className="p-3 bg-gray-950 rounded-xl border border-gray-700" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    {!isEditing && <input type="email" placeholder="อีเมล" className="p-3 bg-gray-950 rounded-xl border border-gray-700" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />}
                    {!isEditing && <input type="password" placeholder="รหัสผ่าน" className="p-3 bg-gray-950 rounded-xl border border-gray-700" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />}
                </div>
                
                <p className="text-sm text-gray-400 mb-3">ห้องเรียนที่รับผิดชอบ (เลือกได้หลายห้อง):</p>
                <div className="flex flex-wrap gap-2 mb-6">
                    {classrooms.map(c => (
                        <button key={c} type="button" onClick={() => toggleClass(c)} className={`px-4 py-2 rounded-lg border transition ${formData.assignedClasses.includes(c) ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-950 border-gray-700 hover:border-gray-500'}`}>{c}</button>
                    ))}
                </div>
                <div className="flex gap-4">
                    <button type="submit" className="flex-1 bg-indigo-600 py-4 rounded-xl font-bold hover:bg-indigo-500 transition">{isEditing ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลครู'}</button>
                    {isEditing && <button type="button" onClick={resetForm} className="px-8 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition">ยกเลิก</button>}
                </div>
            </form>

            <div className="max-w-4xl mx-auto bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                <table className="w-full text-left">
                    <thead><tr className="text-gray-400 border-b border-gray-800"><th className="p-4">ชื่อ</th><th className="p-4">อีเมล</th><th className="p-4">ห้อง</th><th className="p-4 text-center">จัดการ</th></tr></thead>
                    <tbody>
                        {teachers.map(t => (
                            <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-950 transition">
                                <td className="p-4">{t.name}</td>
                                <td className="p-4 text-gray-400">{t.email}</td>
                                <td className="p-4 text-sm">{t.assignedClasses?.join(', ') || '-'}</td>
                                <td className="p-4 flex justify-center gap-2">
                                    <button onClick={() => startEdit(t)} className="bg-blue-900/50 hover:bg-blue-800 px-3 py-1 rounded-lg text-xs">แก้ไข</button>
                                    <button onClick={() => handleDelete(t.id)} className="bg-red-900/50 hover:bg-red-800 px-3 py-1 rounded-lg text-xs">ลบ</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="text-center mt-10 text-gray-600 text-sm">ระบบจัดการข้อมูลครู - สิทธิการเข้าถึงของ Admin เท่านั้น</div>
        </div>
    );
}