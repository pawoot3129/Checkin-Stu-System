'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { FaCalendarCheck, FaArrowLeft, FaCheck, FaTimes, FaTrash, FaEdit } from 'react-icons/fa';

export default function SubActivityCheckPage() {
    const router = useRouter();
    const params = useParams();
    const activityId = params?.activityId;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ name: 'กำลังโหลด...', classes: [], students: [], academicYear: '2569', semester: '1' });
    const [selectedClass, setSelectedClass] = useState('');
    const [attendance, setAttendance] = useState({});
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (!activityId) return;
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/login'); return; }
            try {
                let userData = {};
                const userSnapByEmail = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
                if (!userSnapByEmail.empty) {
                    userData = userSnapByEmail.docs[0].data();
                } else {
                    const userSnapByUid = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
                    if (!userSnapByUid.empty) userData = userSnapByUid.docs[0].data();
                }

                const [actSnap, stuSnap, classSnap] = await Promise.all([
                    getDoc(doc(db, "activities", activityId)),
                    getDocs(collection(db, "students")),
                    getDocs(collection(db, "classrooms"))
                ]);
                
                const assignedClasses = userData.assignedClasses || userData.classes || [];
                const assignedClassesTrimmed = assignedClasses.map(c => String(c).trim().toLowerCase());

                const classList = classSnap.docs
                    .map(d => ({
                        id: d.id,
                        name: d.data().className || d.id
                    }))
                    .filter(c => {
                        if (userData.role === 'admin' || assignedClassesTrimmed.length === 0) return true;
                        return assignedClassesTrimmed.includes(c.id.trim().toLowerCase()) || 
                               assignedClassesTrimmed.includes(c.name.trim().toLowerCase()) ||
                               assignedClassesTrimmed.some(ac => c.name.trim().toLowerCase().includes(ac) || ac.includes(c.name.trim().toLowerCase()));
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

                const actData = actSnap.exists() ? actSnap.data() : {};

                setData({
                    name: actData.activityName || actData.name || "กิจกรรมย่อย",
                    academicYear: actData.academicYear || actData.year || '2569',
                    semester: actData.semester || actData.term || '1',
                    classes: classList,
                    students: stuSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                });
            } catch (e) { 
                console.error(e);
                toast.error("โหลดข้อมูลล้มเหลว"); 
            } finally {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [activityId, router]);

    useEffect(() => {
        const loadAttendance = async () => {
            if (!selectedClass || !date) return;
            try {
                const q = query(
                    collection(db, "attendance"), 
                    where("activityId", "==", activityId), 
                    where("date", "==", date), 
                    where("classId", "==", selectedClass)
                );
                const snap = await getDocs(q);
                const saved = {};
                snap.forEach(d => {
                    const rData = d.data();
                    saved[rData.studentId] = rData.status;
                });
                setAttendance(saved);
            } catch (e) { 
                toast.error("ดึงข้อมูลเช็คชื่อล้มเหลว"); 
            }
        };
        loadAttendance();
    }, [selectedClass, date, activityId]);

    const handleAttendance = async (studentId, status) => {
        const prevAttendance = { ...attendance };
        setAttendance(prev => ({ ...prev, [studentId]: status }));
        try {
            const docId = `${activityId}_${date}_${studentId}`;
            if (status === null) {
                await deleteDoc(doc(db, "attendance", docId));
            } else {
                await setDoc(doc(db, "attendance", docId), { 
                    activityId, 
                    date, 
                    studentId, 
                    status, 
                    classId: selectedClass, 
                    updatedAt: new Date() 
                });
            }
        } catch (e) { 
            setAttendance(prevAttendance); 
            toast.error("บันทึกไม่สำเร็จ"); 
        }
    };

    const markAllStatus = async (statusText, successMessage) => {
        const newAttendance = { ...attendance };
        for (const stu of filteredStudents) {
            newAttendance[stu.id] = statusText;
            await setDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`), { 
                activityId, 
                date, 
                studentId: stu.id, 
                status: statusText, 
                classId: selectedClass, 
                updatedAt: new Date() 
            });
        }
        setAttendance(newAttendance);
        toast.success(successMessage);
    };

    const deleteAll = async () => {
        for (const stu of filteredStudents) {
            await deleteDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`));
        }
        setAttendance({});
        toast.success("ลบข้อมูลเช็คชื่อของวันนี้ทั้งหมดแล้ว");
    };

    const filteredStudents = data.students
        .filter(s => {
            if (!selectedClass) return false;
            if (s.status === "จำหน่าย") return false;
            const selectedObj = data.classes.find(c => c.id === selectedClass);
            return s.classId?.trim() === selectedClass.trim() || s.classId?.trim() === selectedObj?.name?.trim();
        })
        .sort((a, b) => {
            const numA = Number(a.studentNumber || a.number || a.no || a.code || 0);
            const numB = Number(b.studentNumber || b.number || b.no || b.code || 0);
            if (numA !== numB) return numA - numB;
            return (a.name || '').localeCompare(b.name || '', 'th');
        });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">
                <div className="text-lg font-bold">กำลังโหลดข้อมูล...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <FaCalendarCheck size={24} className="text-amber-400" />
                        <div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">⚡ กิจกรรมย่อย (วันเดียวจบ)</span>
                            <h1 className="text-xl font-bold mt-1">{data.name}</h1>
                        </div>
                    </div>
                    <button 
                        onClick={() => router.back()} 
                        className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-700 transition"
                    >
                        <FaArrowLeft size={12} /> ย้อนกลับ
                    </button>
                </div>

                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-xl">
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold">ห้องเรียน</label>
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)} 
                            className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-white outline-none focus:border-amber-500"
                        >
                            <option value="">-- เลือกห้องเรียน --</option>
                            {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold">วันที่จัดกิจกรรม</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)} 
                            className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-white outline-none focus:border-amber-500" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold">ภาคเรียน / ปีการศึกษา</label>
                        <div className="w-full bg-gray-950 border border-gray-800 p-3 rounded-xl text-amber-400 font-bold flex items-center">
                            ภาคเรียนที่ {data.semester} / {data.academicYear}
                        </div>
                    </div>
                </div>

                {selectedClass && (
                    <>
                        <div className="mb-6 flex gap-3 flex-wrap">
                            <button 
                                onClick={() => markAllStatus('เข้าร่วม', 'เช็คเข้าร่วมทั้งหมดแล้ว')} 
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg"
                            >
                                <FaCheck /> เข้าร่วมทั้งหมด
                            </button>
                            <button 
                                onClick={() => markAllStatus('ไม่เข้าร่วม', 'เช็คไม่เข้าร่วมทั้งหมดแล้ว')} 
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg"
                            >
                                <FaTimes /> ไม่เข้าร่วมทั้งหมด
                            </button>
                            <button 
                                onClick={deleteAll} 
                                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold transition border border-gray-700"
                            >
                                <FaTrash /> ล้างข้อมูลวันนี้
                            </button>
                        </div>

                        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((stu, index) => {
                                    const currentStatus = attendance[stu.id];
                                    return (
                                        <div key={stu.id} className="p-4 border-b border-gray-800 flex justify-between items-center hover:bg-gray-800/50 transition">
                                            <span className="text-sm font-medium">
                                                <span className="text-gray-500 mr-2">{index + 1}.</span> {stu.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {currentStatus ? (
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${currentStatus === 'เข้าร่วม' ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-red-600/20 text-red-400 border border-red-600/30'}`}>
                                                            {currentStatus}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleAttendance(stu.id, null)} 
                                                            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-gray-800 px-2.5 py-1 rounded-lg transition"
                                                        >
                                                            <FaEdit size={10} /> แก้ไข
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleAttendance(stu.id, 'เข้าร่วม')} 
                                                            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600 hover:text-white transition"
                                                        >
                                                            เข้าร่วม
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAttendance(stu.id, 'ไม่เข้าร่วม')} 
                                                            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600 hover:text-white transition"
                                                        >
                                                            ไม่เข้าร่วม
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-12 text-center text-gray-500">ไม่พบรายชื่อนักเรียนในห้องนี้</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}