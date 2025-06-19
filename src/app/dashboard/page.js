// src/app/dashboard/page.js (แก้ไข TeacherView)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, orderBy, writeBatch, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

// Component จัดการห้องเรียน
function ClassroomManager() {
    const [classrooms, setClassrooms] = useState([]);
    const [newClassName, setNewClassName] = useState('');
    const [newDepartment, setNewDepartment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const fetchClassrooms = async () => { setIsLoading(true); const q = query(collection(db, "classrooms"), orderBy("className"), orderBy("department")); const querySnapshot = await getDocs(q); setClassrooms(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); };
    useEffect(() => { fetchClassrooms(); }, []);
    const handleAddClassroom = async (e) => { e.preventDefault(); if (!newClassName.trim() || !newDepartment.trim()) { return toast.error('กรุณากรอกข้อมูลห้องเรียนให้ครบถ้วน'); } const toastId = toast.loading('กำลังเพิ่มห้องเรียน...'); await addDoc(collection(db, 'classrooms'), { className: newClassName.trim(), department: newDepartment.trim() }); toast.success('เพิ่มห้องเรียนสำเร็จ!', { id: toastId }); setNewClassName(''); setNewDepartment(''); fetchClassrooms(); };
    const handleDeleteClassroom = async (roomToDelete) => {
        const confirmation = prompt(`อันตราย! การลบห้องเรียน "${roomToDelete.className} ${roomToDelete.department}" จะลบข้อมูลนักเรียนทั้งหมดในห้องนี้ และนำห้องนี้ออกจากครูที่ปรึกษาทุกคน\n\nหากแน่ใจ ให้พิมพ์คำว่า "ลบ" เพื่อยืนยัน:`);
        if (confirmation !== 'ลบ') { return toast.error('การลบถูกยกเลิก'); }
        const toastId = toast.loading('กำลังลบห้องเรียนและข้อมูลที่เกี่ยวข้อง...');
        try {
            const classId = `${roomToDelete.className} ${roomToDelete.department}`;
            const batch = writeBatch(db);
            const studentsQuery = query(collection(db, "students"), where("classId", "==", classId));
            const studentsSnapshot = await getDocs(studentsQuery);
            studentsSnapshot.forEach(studentDoc => batch.delete(studentDoc.ref));
            const teachersQuery = query(collection(db, "users"), where("role", "==", "teacher"), where("assignedClasses", "array-contains", classId));
            const teachersSnapshot = await getDocs(teachersQuery);
            teachersSnapshot.forEach(userDoc => { const newAssignedClasses = userDoc.data().assignedClasses.filter(c => c !== classId); batch.update(userDoc.ref, { assignedClasses: newAssignedClasses }); });
            batch.delete(doc(db, 'classrooms', roomToDelete.id));
            await batch.commit();
            toast.success(`ลบห้องเรียนสำเร็จ!`, { id: toastId, duration: 4000 });
            fetchClassrooms();
        } catch (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message, { id: toastId }); }
    };
    return (
        <div className="bg-gray-800 rounded-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4">จัดการห้องเรียน</h2>
            <form onSubmit={handleAddClassroom} className="flex flex-col sm:flex-row gap-4 mb-4"><input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="ระดับชั้น (เช่น ปวช.1)" className="flex-grow px-3 py-2 bg-gray-700 rounded-md"/><input type="text" value={newDepartment} onChange={e => setNewDepartment(e.target.value)} placeholder="แผนกวิชา (เช่น การบัญชี)" className="flex-grow px-3 py-2 bg-gray-700 rounded-md"/><button type="submit" className="px-6 py-2 bg-indigo-600 rounded-md">เพิ่มห้องเรียน</button></form>
            <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-gray-700 text-xs uppercase"><tr><th className="px-6 py-3">ระดับชั้น</th><th className="px-6 py-3">แผนกวิชา</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead><tbody>{isLoading ? (<tr><td colSpan="3" className="text-center py-4">Loading...</td></tr>) : (classrooms.map(room => (<tr key={room.id} className="border-b border-gray-700"><td className="px-6 py-4">{room.className}</td><td className="px-6 py-4">{room.department}</td><td className="px-6 py-4 text-right"><button onClick={() => handleDeleteClassroom(room)} className="font-medium text-red-500 hover:underline">ลบ</button></td></tr>)))}</tbody></table></div>
        </div>
    );
}

// Component จัดการครู
function TeacherManager() {
    const [classrooms, setClassrooms] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newTeacherName, setNewTeacherName] = useState('');
    const [newTeacherUsername, setNewTeacherUsername] = useState('');
    const [newTeacherEmail, setNewTeacherEmail] = useState('');
    const [newTeacherAssignedClasses, setNewTeacherAssignedClasses] = useState({});
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentTeacher, setCurrentTeacher] = useState(null);
    const [editFormData, setEditFormData] = useState({ name: '', username: '', assignedClasses: {} });
    const fetchData = async () => { setIsLoading(true); const cQuery = query(collection(db, "classrooms"), orderBy("className"), orderBy("department")); const cSnapshot = await getDocs(cQuery); setClassrooms(cSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); const tQuery = query(collection(db, "users"), where("role", "==", "teacher")); const tSnapshot = await getDocs(tQuery); setTeachers(tSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); };
    useEffect(() => { fetchData(); }, []);
    const handleAddTeacher = async (e) => { e.preventDefault(); if (!newTeacherName || !newTeacherUsername || !newTeacherEmail) { return toast.error('กรุณากรอกข้อมูลครูให้ครบถ้วน'); } const toastId = toast.loading('กำลังตรวจสอบ...'); try { const uQuery = query(collection(db, "users"), where("username", "==", newTeacherUsername.trim())); if (!(await getDocs(uQuery)).empty) { return toast.error('Username นี้มีผู้ใช้งานแล้ว', { id: toastId }); } const eQuery = query(collection(db, "users"), where("email", "==", newTeacherEmail.trim())); if (!(await getDocs(eQuery)).empty) { return toast.error('Email นี้มีผู้ใช้งานแล้ว', { id: toastId }); } const assignedClassIds = Object.keys(newTeacherAssignedClasses).filter(id => newTeacherAssignedClasses[id]); const assignedClassNames = classrooms.filter(c => assignedClassIds.includes(c.id)).map(c => `${c.className} ${c.department}`); await addDoc(collection(db, 'users'), { name: newTeacherName, username: newTeacherUsername.trim(), email: newTeacherEmail.trim(), role: 'teacher', assignedClasses: assignedClassNames }); setNewTeacherName(''); setNewTeacherUsername(''); setNewTeacherEmail(''); setNewTeacherAssignedClasses({}); fetchData(); toast.success('เพิ่มข้อมูลครูสำเร็จ!', { id: toastId }); } catch (error) { toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId }); } };
    const handleAddClassCheckboxChange = (classId) => { setNewTeacherAssignedClasses(prev => ({ ...prev, [classId]: !prev[classId] })); };
    const handleDeleteTeacher = async (teacher) => { if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบโปรไฟล์ของครู "${teacher.name}"?`)) return; const toastId = toast.loading('กำลังลบข้อมูล...'); try { await deleteDoc(doc(db, "users", teacher.id)); fetchData(); toast.success('ลบโปรไฟล์ครูสำเร็จ!', { id: toastId }); alert(`สำคัญมาก!\nโปรไฟล์ของครู ${teacher.name} ถูกลบแล้ว แต่บัญชีสำหรับล็อกอิน (Authentication) ยังคงอยู่\nกรุณาไปที่ Firebase Console > Authentication เพื่อลบบัญชีอีเมล ${teacher.email} ทิ้งด้วยตนเอง`); } catch (error) { toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId }); } };
    const openEditModal = (teacher) => { setCurrentTeacher(teacher); const initialAssigned = {}; classrooms.forEach(c => { const className = `${c.className} ${c.department}`; initialAssigned[className] = teacher.assignedClasses?.includes(className) || false; }); setEditFormData({ name: teacher.name, username: teacher.username, email: teacher.email, assignedClasses: initialAssigned }); setIsEditModalOpen(true); };
    const handleUpdateTeacher = async (e) => { e.preventDefault(); const toastId = toast.loading("กำลังอัปเดตข้อมูล..."); try { const assignedClassNames = Object.keys(editFormData.assignedClasses).filter(className => editFormData.assignedClasses[className]); const teacherRef = doc(db, 'users', currentTeacher.id); await updateDoc(teacherRef, { name: editFormData.name, username: editFormData.username, assignedClasses: assignedClassNames }); toast.success("อัปเดตข้อมูลสำเร็จ!", { id: toastId }); closeEditModal(); fetchData(); } catch (error) { toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId }); } };
    const closeEditModal = () => setIsEditModalOpen(false);
    return (
        <div className="bg-gray-800 rounded-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4">จัดการครูที่ปรึกษา</h2>
            <div className="overflow-x-auto mb-6"><table className="min-w-full text-sm text-left"><thead className="bg-gray-700 text-xs uppercase"><tr><th className="px-6 py-3">ชื่อ-นามสกุล</th><th className="px-6 py-3">Username</th><th className="px-6 py-3">ห้องที่รับผิดชอบ</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead><tbody>{isLoading ? (<tr><td colSpan="4" className="text-center py-4">Loading...</td></tr>) : (teachers.map(teacher => (<tr key={teacher.id} className="border-b border-gray-700"><td className="px-6 py-4">{teacher.name}</td><td className="px-6 py-4">{teacher.username}</td><td className="px-6 py-4">{teacher.assignedClasses?.join(', ')}</td><td className="px-6 py-4 text-right space-x-4"><button onClick={() => openEditModal(teacher)} className="font-medium text-blue-400 hover:underline">แก้ไข</button><button onClick={() => handleDeleteTeacher(teacher)} className="font-medium text-red-500 hover:underline">ลบ</button></td></tr>)))}</tbody></table></div>
            <div className="border-t border-gray-700 pt-6"><h3 className="text-xl font-bold mb-4">เพิ่มครูใหม่</h3><p className="text-sm text-yellow-400 mb-4">คำเตือน: ต้องไปสร้างบัญชีให้ครูในหน้า 'Authentication' ของ Firebase ก่อน</p><form onSubmit={handleAddTeacher} className="space-y-4"><div className="grid md:grid-cols-3 gap-4"><input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="px-3 py-2 bg-gray-700 rounded-md"/><input type="text" value={newTeacherUsername} onChange={e => setNewTeacherUsername(e.target.value)} placeholder="Username" className="px-3 py-2 bg-gray-700 rounded-md"/><input type="email" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} placeholder="Email (ต้องตรงกับใน Auth)" className="px-3 py-2 bg-gray-700 rounded-md"/></div><div><label className="block text-sm mb-2">มอบหมายห้องเรียน:</label><div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-700 p-4 rounded-md">{classrooms.map(r => (<div key={r.id} className="flex items-center"><input type="checkbox" id={`add-${r.id}`} checked={!!newTeacherAssignedClasses[r.id]} onChange={() => handleAddClassCheckboxChange(r.id)} className="w-4 h-4 text-indigo-600 rounded"/><label htmlFor={`add-${r.id}`} className="ml-2 text-sm">{`${r.className} ${r.department}`}</label></div>))}</div></div><button type="submit" className="w-full mt-4 px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-md">เพิ่มข้อมูลครู</button></form></div>
            {isEditModalOpen && currentTeacher && (<div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"><div className="bg-gray-800 rounded-lg p-8 w-full max-w-2xl"><h2 className="text-2xl font-bold mb-4">แก้ไขข้อมูล: {currentTeacher.name}</h2><form onSubmit={handleUpdateTeacher} className="space-y-4"><div className="grid md:grid-cols-2 gap-4"><div><label>ชื่อ-นามสกุล</label><input type="text" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded-md"/></div><div><label>Username</label><input type="text" value={editFormData.username} onChange={(e) => setEditFormData({...editFormData, username: e.target.value})} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded-md"/></div><div className="md:col-span-2"><label>Email (ไม่สามารถแก้ไขได้)</label><input type="email" value={editFormData.email} readOnly className="w-full mt-1 px-3 py-2 bg-gray-900 text-gray-400 rounded-md"/></div></div><div><label className="block text-sm mb-2">แก้ไขการมอบหมายห้องเรียน:</label><div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-gray-700 p-4 rounded-md">{Object.keys(editFormData.assignedClasses).map(className => (<div key={className} className="flex items-center"><input type="checkbox" id={`edit-${className}`} checked={editFormData.assignedClasses[className]} onChange={() => setEditFormData({...editFormData, assignedClasses: {...editFormData.assignedClasses, [className]: !editFormData.assignedClasses[className] }})} className="w-4 h-4 text-indigo-600 rounded"/><label htmlFor={`edit-${className}`} className="ml-2 text-sm">{className}</label></div>))}</div></div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={closeEditModal} className="px-6 py-2 bg-gray-600 rounded-md">ยกเลิก</button><button type="submit" className="px-6 py-2 bg-blue-600 rounded-md">บันทึก</button></div></form></div></div>)}
        </div>
    );
}

// Component จัดการกิจกรรม
function ActivityManager() {
    const [activities, setActivities] = useState([]); const [isLoading, setIsLoading] = useState(true); const [newActivityName, setNewActivityName] = useState(''); const [newActivityType, setNewActivityType] = useState('รายวัน'); const [newPassThreshold, setNewPassThreshold] = useState(80); const [academicYears, setAcademicYears] = useState([]); const [selectedYear, setSelectedYear] = useState(''); const [selectedSemester, setSelectedSemester] = useState('1'); const [isFetchingSettings, setIsFetchingSettings] = useState(true);
    useEffect(() => { const fetchSettingsAndActivities = async () => { setIsLoading(true); setIsFetchingSettings(true); const settingsDocRef = doc(db, "system_settings", "main_config"); const docSnap = await getDoc(settingsDocRef); if (docSnap.exists() && docSnap.data().academicYears) { const years = docSnap.data().academicYears.sort().reverse(); setAcademicYears(years); if (years.length > 0) { setSelectedYear(years[0]); } } else { toast.error("ไม่พบการตั้งค่าปีการศึกษา"); } setIsFetchingSettings(false); const q = query(collection(db, "activities"), orderBy("activityName")); const querySnapshot = await getDocs(q); setActivities(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); }; fetchSettingsAndActivities(); }, []);
    const fetchActivities = async () => { setIsLoading(true); const q = query(collection(db, "activities"), orderBy("activityName")); const querySnapshot = await getDocs(q); setActivities(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); }
    const handleAddActivity = async (e) => { e.preventDefault(); if (!newActivityName.trim() || !newPassThreshold || !selectedYear || !selectedSemester) { return toast.error('กรุณากรอกข้อมูลให้ครบ'); } const toastId = toast.loading("กำลังเพิ่ม..."); try { await addDoc(collection(db, 'activities'), { activityName: newActivityName.trim(), type: newActivityType, evaluationCriteria: { type: 'percentage', passThreshold: Number(newPassThreshold) }, academicYear: selectedYear, semester: selectedSemester }); setNewActivityName(''); setNewActivityType('รายวัน'); setNewPassThreshold(80); fetchActivities(); toast.success("เพิ่มสำเร็จ!", { id: toastId }); } catch (error) { toast.error("เกิดพลาด: " + error.message, { id: toastId }); } };
    const handleDeleteActivity = async (id) => { if (confirm('ยืนยันการลบ?')) { await deleteDoc(doc(db, 'activities', id)); fetchActivities(); toast.success('ลบสำเร็จ'); } };
    return (
        <div className="bg-gray-800 rounded-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4">จัดการกิจกรรม</h2>
            <form onSubmit={handleAddActivity} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 items-end">
                <div className="lg:col-span-3"><label className="block text-sm mb-1">ชื่อกิจกรรม</label><input type="text" value={newActivityName} onChange={e => setNewActivityName(e.target.value)} placeholder="เช่น กิจกรรมเข้าแถวหน้าเสาธง" className="w-full px-3 py-2 bg-gray-700 rounded-md"/></div>
                <div><label className="block text-sm mb-1">ปีการศึกษา</label><select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md" disabled={isFetchingSettings}>{isFetchingSettings ? <option>Loading...</option> : academicYears.map(year => <option key={year} value={year}>{year}</option>)}</select></div>
                <div><label className="block text-sm mb-1">ภาคเรียน</label><select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md"><option value="1">1</option><option value="2">2</option><option value="3">ฤดูร้อน</option></select></div>
                <div><label className="block text-sm mb-1">ประเภท</label><select value={newActivityType} onChange={e => setNewActivityType(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md"><option value="รายวัน">รายวัน</option><option value="พิเศษ">พิเศษ</option></select></div>
                 <div><label className="block text-sm mb-1">เกณฑ์ผ่าน (%)</label><input type="number" value={newPassThreshold} onChange={e => setNewPassThreshold(e.target.value)} placeholder="80" className="w-full px-3 py-2 bg-gray-700 rounded-md"/></div>
                <div className="lg:col-start-3"><button type="submit" className="w-full px-6 py-2 bg-indigo-600 rounded-md h-fit">เพิ่มกิจกรรม</button></div>
            </form>
            <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-gray-700 text-xs uppercase"><tr><th className="px-6 py-3">ชื่อกิจกรรม</th><th className="px-6 py-3">ปี/เทอม</th><th className="px-6 py-3">ประเภท</th><th className="px-6 py-3">เกณฑ์ผ่าน</th><th className="px-6 py-3 text-right">จัดการ</th></tr></thead><tbody>{isLoading ? (<tr><td colSpan="5" className="text-center py-4">Loading...</td></tr>) : (activities.map(act => (<tr key={act.id} className="border-b border-gray-700"><td className="px-6 py-4 font-medium">{act.activityName}</td><td className="px-6 py-4">{act.academicYear}/{act.semester}</td><td className="px-6 py-4">{act.type}</td><td className="px-6 py-4">{act.evaluationCriteria.passThreshold}%</td><td className="px-6 py-4 text-right"><button onClick={() => handleDeleteActivity(act.id)} className="font-medium text-red-500 hover:underline">ลบ</button></td></tr>)))}</tbody></table></div>
        </div>
    );
}

// Component สำหรับมุมมองของ Admin
function AdminView() {
    const router = useRouter(); 
    const [activeView, setActiveView] = useState('classrooms');
    const renderActiveView = () => { 
        switch (activeView) { 
            case 'classrooms': return <ClassroomManager />; 
            case 'teachers': return <TeacherManager />; 
            case 'activities': return <ActivityManager />; 
            default: return <ClassroomManager />; 
        } 
    };
    return (
        <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
            <aside className="md:w-1/4 lg:w-1/5 flex-shrink-0">
                <nav className="space-y-1">
                    <button onClick={() => setActiveView('classrooms')} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeView === 'classrooms' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>จัดการห้องเรียน</button>
                    <button onClick={() => setActiveView('teachers')} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeView === 'teachers' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>จัดการครูที่ปรึกษา</button>
                    <button onClick={() => setActiveView('activities')} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeView === 'activities' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>จัดการกิจกรรม</button>
                    <button onClick={() => router.push('/dashboard/reports')} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700`}>รายงานสรุปผล</button>
                    <div className="pt-4 mt-4 border-t border-gray-700">
                        <button onClick={() => router.push('/dashboard/settings')} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700`}>
                            ตั้งค่าระบบ
                        </button>
                    </div>
                </nav>
            </aside>
            <main className="flex-grow min-w-0">{renderActiveView()}</main>
        </div>
    );
}

// ===================================================================
// Component สำหรับมุมมองของครู (ส่วนที่อัปเกรดใหม่ทั้งหมด)
// ===================================================================
function TeacherView({ userProfile }) {
    const router = useRouter();
    const user = auth.currentUser;

    // States for filters
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('1');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // States for data
    const [activities, setActivities] = useState([]);
    const [selectedActivityId, setSelectedActivityId] = useState('');
    const [students, setStudents] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState({});

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingSettings, setIsFetchingSettings] = useState(true);

    const [editingStudentId, setEditingStudentId] = useState(null);

    // 1. Fetch academic year settings once
    useEffect(() => {
        const fetchSettings = async () => {
            setIsFetchingSettings(true);
            const settingsDocRef = doc(db, "system_settings", "main_config");
            const docSnap = await getDoc(settingsDocRef);
            if (docSnap.exists() && docSnap.data().academicYears) {
                const years = docSnap.data().academicYears.sort().reverse();
                setAcademicYears(years);
                if (years.length > 0) {
                    setSelectedYear(years[0]);
                }
            }
            setIsFetchingSettings(false);
        };
        fetchSettings();
    }, []);

    // 2. Set default class when user profile is loaded
    useEffect(() => {
        if (userProfile?.assignedClasses?.length > 0) {
            setSelectedClass(userProfile.assignedClasses[0]);
        }
    }, [userProfile]);

    // 3. Fetch activities whenever year or semester filters change
    useEffect(() => {
        const fetchActivities = async () => {
            if (!selectedYear || !selectedSemester) return;
            const q = query(
                collection(db, "activities"),
                where("academicYear", "==", selectedYear),
                where("semester", "==", selectedSemester),
                orderBy("activityName")
            );
            const querySnapshot = await getDocs(q);
            const activitiesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActivities(activitiesData);
            if (activitiesData.length > 0) {
                setSelectedActivityId(activitiesData[0].id);
            } else {
                setSelectedActivityId('');
            }
        };
        fetchActivities();
    }, [selectedYear, selectedSemester]);

    // 4. Fetch student and attendance data when primary filters change
    useEffect(() => {
        const fetchStudentAndAttendanceData = async () => {
            if (!selectedClass || !selectedActivityId || !selectedDate) {
                setStudents([]);
                setAttendanceRecords({});
                return;
            }
            setIsLoading(true);
            
            const studentsQuery = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
            const studentsSnapshot = await getDocs(studentsQuery);
            const studentData = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(studentData);
            
            const attendanceQuery = query(collection(db, "attendance"), where("classId", "==", selectedClass), where("activityId", "==", selectedActivityId), where("date", "==", selectedDate));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const records = {};
            attendanceSnapshot.forEach(doc => {
                records[doc.data().studentId] = { id: doc.id, ...doc.data() };
            });
            setAttendanceRecords(records);
            
            setIsLoading(false);
        };
        fetchStudentAndAttendanceData();
    }, [selectedClass, selectedActivityId, selectedDate]);

    // Handle attendance submission
    const handleSetAttendance = async (student, status) => {
        if (!selectedClass || !selectedActivityId || !user || !selectedDate) return;
        const studentDocId = student.id;
        const docId = `${selectedDate}_${selectedActivityId}_${studentDocId}`;
        const attendanceRef = doc(db, "attendance", docId);
        const newRecord = { studentId: studentDocId, studentName: student.name, studentNumber: student.studentNumber, status, date: selectedDate, classId: selectedClass, activityId: selectedActivityId, recordedBy: user.uid, timestamp: serverTimestamp() };
        try {
            await setDoc(attendanceRef, newRecord, { merge: true });
            setAttendanceRecords(prev => ({ ...prev, [studentDocId]: {id: docId, ...newRecord} }));
            setEditingStudentId(null);
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        }
    };
    
    // --- ฟังก์ชันใหม่: เช็คชื่อมาทั้งหมด ---
    const handleMarkAllPresent = async () => {
        if (!selectedClass || !selectedActivityId || students.length === 0) return;
        const studentsToMark = students.filter(s => !attendanceRecords[s.id]);
        if (studentsToMark.length === 0) {
            return toast.success("นักเรียนทุกคนถูกเช็คชื่อแล้ว");
        }
        if (!confirm(`ยืนยันการเช็คชื่อนักเรียนที่เหลือ ${studentsToMark.length} คนเป็น "มา" ทั้งหมด?`)) return;

        const toastId = toast.loading("กำลังเช็คชื่อทั้งหมด...");
        const batch = writeBatch(db);
        studentsToMark.forEach(student => {
            const docId = `${selectedDate}_${selectedActivityId}_${student.id}`;
            const attendanceRef = doc(db, "attendance", docId);
            batch.set(attendanceRef, { studentId: student.id, studentName: student.name, studentNumber: student.studentNumber, status: 'มา', date: selectedDate, classId: selectedClass, activityId: selectedActivityId, recordedBy: user.uid, timestamp: serverTimestamp() });
        });
        
        try {
            await batch.commit();
            // Refresh data
             const attendanceQuery = query(collection(db, "attendance"), where("classId", "==", selectedClass), where("activityId", "==", selectedActivityId), where("date", "==", selectedDate));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const records = {};
            attendanceSnapshot.forEach(doc => { records[doc.data().studentId] = { id: doc.id, ...doc.data() }; });
            setAttendanceRecords(records);
            toast.success("เช็คชื่อทั้งหมดสำเร็จ!", { id: toastId });
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        }
    };

    // --- ฟังก์ชันใหม่: ลบข้อมูลของวันนี้ ---
    const handleDeleteDaysRecords = async () => {
        if (Object.keys(attendanceRecords).length === 0) return toast.error("ไม่มีข้อมูลให้ลบ");
        if (!confirm(`*** คำเตือน ***\nคุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการเช็คชื่อ "ทั้งหมด" ของวันที่ ${selectedDate} ?\nการกระทำนี้ไม่สามารถย้อนกลับได้!`)) return;

        const toastId = toast.loading("กำลังลบข้อมูล...");
        const batch = writeBatch(db);
        Object.values(attendanceRecords).forEach(record => {
            batch.delete(doc(db, "attendance", record.id));
        });

        try {
            await batch.commit();
            setAttendanceRecords({}); // Clear UI
            toast.success("ลบข้อมูลของวันนี้สำเร็จ", { id: toastId });
        } catch(error) {
            toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
        }
    };
    
    return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                    <div>
                        <label className="block text-sm font-bold mb-1">ปีการศึกษา:</label>
                        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md" disabled={isFetchingSettings}>
                            {isFetchingSettings ? <option>Loading...</option> : academicYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">ภาคเรียน:</label>
                        <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">ฤดูร้อน</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">เลือกวันที่:</label>
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md text-white [color-scheme:dark]"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-4 border-t border-gray-700">
                    <div>
                        <label className="block text-sm font-bold mb-1">เลือกห้องเรียน:</label>
                        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md">
                            {userProfile?.assignedClasses?.length > 0 ? userProfile.assignedClasses.map((c) => (<option key={c} value={c}>{c}</option>)) : <option value="">ไม่มีห้องในความรับผิดชอบ</option>}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">เลือกกิจกรรม:</label>
                        <select value={selectedActivityId} onChange={(e) => setSelectedActivityId(e.target.value)} className="w-full px-3 py-2 bg-gray-700 rounded-md">
                            {activities.length > 0 ? activities.map((a) => (<option key={a.id} value={a.id}>{a.activityName}</option>)) : <option value="">ไม่พบกิจกรรม</option>}
                        </select>
                    </div>
                </div>
                {/* --- ส่วนที่แก้ไข: เพิ่มปุ่มจัดการและรายงาน --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                     <button onClick={() => router.push('/dashboard/students')} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold">จัดการข้อมูลนักเรียน</button>
                     <button onClick={() => router.push('/dashboard/reports')} className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm font-semibold">ดูรายงานสรุปผล</button>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl font-bold">เช็คชื่อนักเรียน ห้อง {selectedClass}</h2>
                    <div className="flex gap-2">
                         <button onClick={handleMarkAllPresent} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-xs font-semibold">เช็คชื่อมาทั้งหมด</button>
                         <button onClick={handleDeleteDaysRecords} className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-md text-xs font-semibold">ล้างข้อมูลวันนี้</button>
                    </div>
                </div>

                {isLoading ? <p className="text-center">Loading...</p> : (
                    <ul className="space-y-3">
                        {students.map((student) => {
                            const record = attendanceRecords[student.id];
                            const isEditing = editingStudentId === student.id;
                            const statusStyles = { 'มา': 'bg-green-500 text-white', 'สาย': 'bg-yellow-500 text-black', 'ลา': 'bg-blue-500 text-white', 'ขาด': 'bg-red-500 text-white' };
                            return (
                                <li key={student.id} className="p-4 bg-gray-700 rounded-lg flex justify-between items-center gap-4">
                                    <span className="font-medium">{student.studentNumber}. {student.name}</span>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        {record && !isEditing ? (
                                            <><span className={`px-4 py-1 rounded-full text-sm font-bold ${statusStyles[record.status] || 'bg-gray-500'}`}>{record.status}</span><button onClick={() => setEditingStudentId(student.id)} className="text-xs text-gray-400 hover:underline">(แก้ไข)</button></>
                                        ) : (
                                            <><button onClick={() => handleSetAttendance(student, 'มา')} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-md text-xs">มา</button><button onClick={() => handleSetAttendance(student, 'สาย')} className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 rounded-md text-xs">สาย</button><button onClick={() => handleSetAttendance(student, 'ลา')} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-xs">ลา</button><button onClick={() => handleSetAttendance(student, 'ขาด')} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-xs">ขาด</button>{isEditing && <button onClick={() => setEditingStudentId(null)} className="text-xs text-gray-400 hover:underline">ยกเลิก</button>}</>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {students.length === 0 && !isLoading && <p className="text-center text-gray-400 pt-4">ไม่พบรายชื่อนักเรียนในห้องนี้</p>}
            </div>
        </div>
    );
}

// Component หลัก
export default function DashboardPage() {
    const router = useRouter(); const [userProfile, setUserProfile] = useState(null); const [isLoading, setIsLoading] = useState(true);
    const handleLogout = async () => { await signOut(auth); router.push('/'); };
    useEffect(() => { const unsubscribe = onAuthStateChanged(auth, async (userAuth) => { if (userAuth) { const q = query(collection(db, 'users'), where('email', '==', userAuth.email)); const querySnapshot = await getDocs(q); if (!querySnapshot.empty) { setUserProfile(querySnapshot.docs[0].data()); } else { await handleLogout(); } } else { router.push('/'); } setIsLoading(false); }); return () => unsubscribe(); }, [router]);
    if (isLoading || !userProfile) { return <div className="min-h-screen bg-gray-900 flex justify-center items-center text-xl">Loading...</div>; }
    return (
        <div className="min-h-screen bg-gray-900 text-white"><Toaster position="top-center" /><header className="bg-gray-800 shadow"><div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center"><h1 className="text-2xl font-bold">{userProfile.role === 'admin' ? 'Admin Panel' : `ครู ${userProfile.name}`}</h1><button onClick={handleLogout} className="px-4 py-2 bg-red-600 rounded-md">ออกจากระบบ</button></div></header><main><div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{userProfile.role === 'admin' ? <AdminView /> : <TeacherView userProfile={userProfile} />}</div></main></div>
    );
}
