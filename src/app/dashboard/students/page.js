// src/app/dashboard/students/page.js (แก้ไขการลบข้อมูลสถิติ)
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
import toast, { Toaster } from 'react-hot-toast';

// Component หลักสำหรับตรวจสอบสิทธิ์ก่อนแสดงหน้า
export default function StudentManagementWrapper() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, 'users'), where('email', '==', user.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const profile = querySnapshot.docs[0].data();
                    if (profile.role === 'admin' || profile.role === 'teacher') {
                        setUserProfile(profile);
                    } else {
                        toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
                        router.push('/dashboard');
                    }
                } else {
                    toast.error("ไม่พบข้อมูลผู้ใช้ในระบบ");
                    router.push('/dashboard');
                }
            } else {
                router.push('/');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    if (isLoading || !userProfile) {
        return <div className="min-h-screen bg-gray-900 flex justify-center items-center text-xl">กำลังโหลดข้อมูลผู้ใช้...</div>;
    }

    return <ManageStudentsPage userProfile={userProfile} />;
}


// Component ของหน้าจัดการนักเรียน
function ManageStudentsPage({ userProfile }) {
    const router = useRouter();
    const fileInputRef = useRef(null);

    const [classroomsForDropdown, setClassroomsForDropdown] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [newStudentNumber, setNewStudentNumber] = useState('');
    const [newStudentName, setNewStudentName] = useState('');

    useEffect(() => {
        const fetchClassrooms = async () => {
            let availableClassrooms = [];
            if (userProfile.role === 'admin') {
                const q = query(collection(db, "classrooms"), orderBy("className"), orderBy("department"));
                const querySnapshot = await getDocs(q);
                availableClassrooms = querySnapshot.docs.map(doc => `${doc.data().className} ${doc.data().department}`);
            } else if (userProfile.role === 'teacher') {
                availableClassrooms = userProfile.assignedClasses || [];
            }
            setClassroomsForDropdown(availableClassrooms);
            if (availableClassrooms.length > 0) {
                setSelectedClass(availableClassrooms[0]);
            }
        };
        if (userProfile) fetchClassrooms();
    }, [userProfile]);

    useEffect(() => {
        const fetchStudents = async () => {
            if (!selectedClass) { setStudents([]); return; }
            setIsLoadingStudents(true);
            const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
            const querySnapshot = await getDocs(q);
            setStudents(querySnapshot.docs.map(sDoc => ({ id: sDoc.id, ...sDoc.data() })));
            setIsLoadingStudents(false);
        };
        if(selectedClass) fetchStudents();
    }, [selectedClass]);

    const handleAddStudent = async (e) => {
        e.preventDefault();
        const studentNumber = parseInt(newStudentNumber, 10);
        if (!studentNumber || !newStudentName.trim() || !selectedClass) return toast.error('กรุณากรอกเลขที่, ชื่อ และเลือกห้องเรียน');
        if (students.some(s => s.studentNumber === studentNumber)) return toast.error(`มีนักเรียนเลขที่ ${studentNumber} อยู่ในห้องนี้แล้ว`);
        const toastId = toast.loading('กำลังเพิ่มนักเรียน...');
        try {
            const docRef = await addDoc(collection(db, 'students'), { classId: selectedClass, studentNumber, name: newStudentName.trim() });
            toast.success('เพิ่มนักเรียนสำเร็จ!', { id: toastId });
            setNewStudentNumber(''); setNewStudentName('');
            setStudents(prev => [...prev, {id: docRef.id, studentNumber, name: newStudentName.trim() }].sort((a, b) => a.studentNumber - b.studentNumber));
        } catch (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message, { id: toastId }); }
    };

    const handleDeleteStudent = async (studentToDelete) => {
        if (!confirm(`ยืนยันการลบนักเรียน "${studentToDelete.name}"?\n***ข้อมูลการเช็คชื่อทั้งหมดของนักเรียนคนนี้จะถูกลบไปด้วย***`)) return;
        setIsProcessing(true);
        const toastId = toast.loading('กำลังลบนักเรียนและข้อมูลการเช็คชื่อ...');
        try {
            const batch = writeBatch(db);
            const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', studentToDelete.id));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            attendanceSnapshot.forEach(doc => batch.delete(doc.ref));
            batch.delete(doc(db, 'students', studentToDelete.id));
            await batch.commit();
            toast.success(`ลบนักเรียนและสถิติ ${attendanceSnapshot.size} รายการสำเร็จ`, { id: toastId });
            setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteAllStudents = async () => {
        if (students.length === 0) return toast.error("ไม่มีนักเรียนให้ลบ");
        if (!confirm(`*** คำเตือนรุนแรง ***\nคุณกำลังจะลบนักเรียน "ทั้งหมด" และสถิติการเช็คชื่อทั้งหมดของพวกเขาออกจากห้อง ${selectedClass}!\nการกระทำนี้ไม่สามารถย้อนกลับได้! ยืนยันหรือไม่?`)) return;
        setIsProcessing(true);
        const toastId = toast.loading(`กำลังลบนักเรียนและข้อมูลทั้งหมด...`);
        try {
            const batch = writeBatch(db);
            for (const student of students) {
                const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', student.id));
                const attendanceSnapshot = await getDocs(attendanceQuery);
                attendanceSnapshot.forEach(doc => batch.delete(doc.ref));
                batch.delete(doc(db, 'students', student.id));
            }
            await batch.commit();
            toast.success('ลบนักเรียนและสถิติทั้งหมดสำเร็จ!', { id: toastId });
            setStudents([]);
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file || !selectedClass) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        if (!confirm(`*** คำเตือนรุนแรง ***\nการนำเข้าไฟล์จะ "ลบนักเรียนเก่าและสถิติทั้งหมด" ในห้องนี้ แล้วแทนที่ด้วยข้อมูลจากไฟล์!\n\nคุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?`)) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setIsProcessing(true);
        const toastId = toast.loading('กำลังประมวลผลไฟล์...');

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                const newStudentsData = results.data
                    .map(row => ({ number: parseInt(row[0], 10), name: row[1]?.trim() }))
                    .filter(s => !isNaN(s.number) && s.name);

                if (newStudentsData.length === 0) {
                    toast.error('ไม่พบข้อมูลที่ถูกต้องในไฟล์ (รูปแบบ: เลขที่,ชื่อ)', { id: toastId });
                    setIsProcessing(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    return;
                }

                try {
                    const batch = writeBatch(db);
                    const existingStudentsQuery = query(collection(db, "students"), where("classId", "==", selectedClass));
                    const studentsSnapshot = await getDocs(existingStudentsQuery);
                    toast.loading(`กำลังลบนักเรียนเก่า ${studentsSnapshot.size} คน และสถิติ...`, { id: toastId });
                    for (const studentDoc of studentsSnapshot.docs) {
                        const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', studentDoc.id));
                        const attendanceSnapshot = await getDocs(attendanceQuery);
                        attendanceSnapshot.forEach(attDoc => batch.delete(attDoc.ref));
                        batch.delete(studentDoc.ref);
                    }
                    toast.loading(`กำลังเพิ่มนักเรียนใหม่ ${newStudentsData.length} คน...`, { id: toastId });
                    newStudentsData.forEach(student => {
                        const newStudentRef = doc(collection(db, "students"));
                        batch.set(newStudentRef, { classId: selectedClass, studentNumber: student.number, name: student.name });
                    });
                    await batch.commit();
                    toast.success(`นำเข้า ${newStudentsData.length} นักเรียนสำเร็จ!`, { id: toastId });
                    const q = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
                    const newSnapshot = await getDocs(q);
                    setStudents(newSnapshot.docs.map(sDoc => ({ id: sDoc.id, ...sDoc.data() })));
                } catch (error) {
                    toast.error('เกิดข้อผิดพลาด: ' + error.message, { id: toastId });
                } finally {
                    setIsProcessing(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
            }
        });
    };

    const handleCleanupOrphanedAttendance = async () => {
        if (!confirm(`*** คำเตือน ***\nขั้นตอนนี้จะทำการสแกนข้อมูลการเช็คชื่อทั้งหมด และลบรายการที่ไม่มีนักเรียนเจ้าของข้อมูลอยู่แล้วในระบบ\nขั้นตอนนี้อาจใช้เวลาสักครู่ และควรทำเมื่อพบว่ารายงานแสดงค่าผิดพลาดเท่านั้น\n\nคุณต้องการดำเนินการต่อหรือไม่?`)) return;

        setIsProcessing(true);
        const toastId = toast.loading('กำลังสแกนข้อมูลนักเรียนทั้งหมด...');
        
        try {
            const studentsSnapshot = await getDocs(collection(db, 'students'));
            const validStudentIds = new Set(studentsSnapshot.docs.map(doc => doc.id));
            toast.loading(`พบนักเรียน ${validStudentIds.size} คน, กำลังสแกนข้อมูลเช็คชื่อ...`, { id: toastId });

            const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
            toast.loading(`พบข้อมูลเช็คชื่อ ${attendanceSnapshot.size} รายการ, กำลังตรวจสอบ...`, { id: toastId });

            const batch = writeBatch(db);
            let orphanedCount = 0;
            attendanceSnapshot.forEach(doc => {
                if (!validStudentIds.has(doc.data().studentId)) {
                    batch.delete(doc.ref);
                    orphanedCount++;
                }
            });

            if (orphanedCount === 0) {
                toast.success('ไม่พบข้อมูลเช็คชื่อที่ผิดพลาด', { id: toastId });
                setIsProcessing(false);
                return;
            }

            toast.loading(`พบข้อมูลที่ต้องลบ ${orphanedCount} รายการ, กำลังดำเนินการ...`, { id: toastId });
            await batch.commit();

            toast.success(`ล้างข้อมูลเช็คชื่อกำพร้า ${orphanedCount} รายการสำเร็จ!`, { id: toastId });

        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">จัดการรายชื่อนักเรียน</h1>
                <button onClick={() => router.back()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors">&larr; กลับ</button>
            </header>
            
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
                <div className="bg-gray-800 rounded-lg p-4">
                     <label htmlFor="class-select" className="block text-lg font-medium mb-2">
                        {userProfile.role === 'admin' ? "เลือกห้องเรียนที่ต้องการจัดการ:" : "ห้องเรียนในความรับผิดชอบของคุณ:"}
                    </label>
                    <select id="class-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md" disabled={isProcessing || classroomsForDropdown.length === 0}>
                        {classroomsForDropdown.length === 0 && <option>ไม่มีห้องเรียนในระบบ</option>}
                        {classroomsForDropdown.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                </div>

                {selectedClass && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-4">เพิ่มนักเรียนทีละคน</h3>
                                <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-4">
                                    <input type="number" value={newStudentNumber} onChange={e => setNewStudentNumber(e.target.value)} placeholder="เลขที่" required className="sm:w-24 px-3 py-2 bg-gray-700 rounded-md" disabled={isProcessing}/>
                                    <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="ชื่อ-นามสกุล" required className="flex-grow px-3 py-2 bg-gray-700 rounded-md" disabled={isProcessing}/>
                                    <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-md disabled:bg-gray-500">เพิ่ม</button>
                                </form>
                            </div>
                             <div className="bg-gray-800 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-2">นำเข้าจากไฟล์</h3>
                                <p className="text-sm text-yellow-400 mb-3">
                                    ไฟล์ต้องเป็น .csv/.txt รูปแบบ: <code className="bg-gray-900 px-1 rounded">เลขที่,ชื่อ-นามสกุล</code>
                                </p>
                                <input type="file" id="csv-upload" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" disabled={isProcessing}/>
                                <label htmlFor="csv-upload" className={`w-full text-center block px-4 py-2 rounded-md font-medium text-sm ${isProcessing ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}>
                                    {isProcessing ? 'กำลังประมวลผล...' : 'เลือกไฟล์ (ลบของเก่าและนำเข้าใหม่)'}
                                </label>
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">รายชื่อนักเรียน ({students.length} คน)</h3>
                                {students.length > 0 && (
                                    <button onClick={handleDeleteAllStudents} disabled={isProcessing} className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-md disabled:bg-gray-500">
                                        ลบทั้งหมด
                                    </button>
                                )}
                            </div>
                            <div className="overflow-y-auto h-96">
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-700"><tr><th className="w-16 px-4 py-2 text-left">เลขที่</th><th className="px-4 py-2 text-left">ชื่อ-นามสกุล</th><th className="w-20 px-4 py-2 text-center">จัดการ</th></tr></thead>
                                    <tbody>
                                        {isLoadingStudents ? (
                                            <tr><td colSpan="3" className="text-center py-10">กำลังโหลดรายชื่อ...</td></tr>
                                        ) : students.length > 0 ? (
                                            students.map(student => (
                                                <tr key={student.id} className="border-b border-gray-700 hover:bg-gray-600/50">
                                                    <td className="px-4 py-3">{student.studentNumber}</td>
                                                    <td className="px-4 py-3 font-medium">{student.name}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button onClick={() => handleDeleteStudent(student)} disabled={isProcessing} className="text-red-500 hover:text-red-400 disabled:text-gray-500 font-medium text-xs">ลบ</button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="3" className="text-center py-10 text-gray-400">ยังไม่มีนักเรียนในห้องนี้</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                 {/* --- ส่วนที่เพิ่มเข้ามาและแก้ไข: เครื่องมือซ่อมแซม --- */}
                {userProfile && userProfile.role === 'admin' && (
                     <div className="bg-gray-800 rounded-lg p-6 mt-6 border-t-2 border-dashed border-yellow-500">
                        <h3 className="text-xl font-bold mb-2 text-yellow-400">เครื่องมือซ่อมแซมระบบ</h3>
                        <p className="text-sm text-gray-400 mb-3">
                            หากรายงานแสดงค่าผิดพลาด (เช่น ตัวเลขติดลบ) อาจมีข้อมูลการเช็คชื่อของนักเรียนที่ถูกลบไปแล้วค้างอยู่ กดปุ่มนี้เพื่อล้างข้อมูลเหล่านั้น (แนะนำให้ทำครั้งเดียวเพื่อแก้ปัญหา)
                        </p>
                        <button onClick={handleCleanupOrphanedAttendance} disabled={isProcessing} className="w-full px-4 py-2 bg-red-800 hover:bg-red-700 rounded-md disabled:bg-gray-500">
                            ล้างข้อมูลเช็คชื่อกำพร้า
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
