'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { FaCalendarCheck, FaArrowLeft, FaEdit, FaCheck, FaTrash } from 'react-icons/fa';

export default function CheckAttendancePage() {
    const router = useRouter();
    const params = useParams();
    const activityId = params?.activityId;

    const [data, setData] = useState({ name: 'กำลังโหลด...', classes: [], students: [] });
    const [academicSettings, setAcademicSettings] = useState({ years: [], semesters: [] });
    const [selectedClass, setSelectedClass] = useState('');
    const [attendance, setAttendance] = useState({});
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTerm, setSelectedTerm] = useState('');

    const statusConfig = {
        'มา': { backgroundColor: '#15803d', color: '#ffffff' },
        'ขาด': { backgroundColor: '#b91c1c', color: '#ffffff' },
        'สาย': { backgroundColor: '#a16207', color: '#ffffff' },
        'ลาครึ่งวัน': { backgroundColor: '#c2410c', color: '#ffffff' },
        'ลาเต็มวัน': { backgroundColor: '#be185d', color: '#ffffff' }
    };

    const buttonStyle = {
        padding: '8px 16px', fontSize: '12px', borderRadius: '8px', border: 'none', color: 'white',
        cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '6px'
    };

    useEffect(() => {
        if (!activityId) return;
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { router.push('/login'); return; }
            try {
                const [actSnap, userSnap, stuSnap, classSnap, settingsSnap] = await Promise.all([
                    getDoc(doc(db, "activities", activityId)),
                    getDocs(query(collection(db, "users"), where("uid", "==", user.uid))),
                    getDocs(collection(db, "students")),
                    getDocs(collection(db, "classrooms")),
                    getDoc(doc(db, "system_settings", "main_config"))
                ]);
                
                const userData = !userSnap.empty ? userSnap.docs[0].data() : {};
                const assignedClasses = userData.assignedClasses || userData.classes || [];
                const assignedClassesTrimmed = assignedClasses.map(c => String(c).trim());

                // กรองห้องที่ครูรับผิดชอบ พร้อมทั้งเรียงลำดับชื่อห้องตามตัวอักษร/ระดับชั้น
                const classList = classSnap.docs
                    .map(d => ({
                        id: d.id,
                        name: d.data().className || d.id
                    }))
                    .filter(c => {
                        if (assignedClassesTrimmed.length === 0) return false;
                        return assignedClassesTrimmed.includes(c.id.trim()) || 
                               assignedClassesTrimmed.includes(c.name.trim());
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

                setData({
                    name: actSnap.exists() ? actSnap.data().activityName : "ไม่พบกิจกรรม",
                    classes: classList,
                    students: stuSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                });

                if (settingsSnap.exists()) {
                    const sData = settingsSnap.data();
                    setAcademicSettings({ years: sData.academicYears || [], semesters: sData.semesters || [] });
                    if (sData.semesters?.length > 0) {
                        const latest = sData.semesters[sData.semesters.length - 1];
                        setSelectedTerm(`${latest.semester}/${latest.year}`);
                    }
                }
            } catch (e) { toast.error("โหลดข้อมูลล้มเหลว"); }
        });
        return () => unsubscribe();
    }, [activityId, router]);

    useEffect(() => {
        const loadAttendance = async () => {
            if (!selectedClass || !date) return;
            try {
                const q = query(collection(db, "attendance"), where("activityId", "==", activityId), where("date", "==", date), where("classId", "==", selectedClass));
                const snap = await getDocs(q);
                const saved = {};
                snap.forEach(d => saved[d.data().studentId] = d.data().status);
                setAttendance(saved);
            } catch (e) { toast.error("ดึงข้อมูลเช็คชื่อล้มเหลว"); }
        };
        loadAttendance();
    }, [selectedClass, date, activityId]);

    const handleAttendance = async (studentId, status) => {
        const prevAttendance = { ...attendance };
        setAttendance(prev => ({ ...prev, [studentId]: status }));
        try {
            const docId = `${activityId}_${date}_${studentId}`;
            if (status === null) await deleteDoc(doc(db, "attendance", docId));
            else await setDoc(doc(db, "attendance", docId), { activityId, date, studentId, status, classId: selectedClass, updatedAt: new Date() });
        } catch (e) { setAttendance(prevAttendance); toast.error("บันทึกไม่สำเร็จ"); }
    };

    const markAllPresent = async () => {
        const newAttendance = { ...attendance };
        for (const stu of filteredStudents) {
            newAttendance[stu.id] = 'มา';
            await setDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`), { activityId, date, studentId: stu.id, status: 'มา', classId: selectedClass, updatedAt: new Date() });
        }
        setAttendance(newAttendance);
        toast.success("บันทึกการเข้าเรียนทั้งหมดแล้ว");
    };

    const deleteAll = async () => {
        for (const stu of filteredStudents) await deleteDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`));
        setAttendance({});
        toast.success("ลบข้อมูลเช็คชื่อของวันนี้ทั้งหมดแล้ว");
    };

    const filteredStudents = data.students
        .filter(s => {
            if (!selectedClass) return false;
            const selectedObj = data.classes.find(c => c.id === selectedClass);
            return s.classId?.trim() === selectedClass.trim() || s.classId?.trim() === selectedObj?.name?.trim();
        })
        .sort((a, b) => {
            const numA = Number(a.studentNumber || a.number || a.no || a.code || 0);
            const numB = Number(b.studentNumber || b.number || b.no || b.code || 0);
            if (numA !== numB) return numA - numB;
            return (a.name || '').localeCompare(b.name || '', 'th');
        });

    return (
        <div style={{ backgroundColor: '#0a0a0a', color: '#ffffff', minHeight: '100vh', padding: '24px' }}>
            <Toaster />
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FaCalendarCheck size={24} color="#6366f1" />
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.name}</h1>
                    </div>
                    <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155' }}>
                        <FaArrowLeft size={12} /> ย้อนกลับ
                    </button>
                </div>

                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>ห้องเรียน</label>
                        <select onChange={(e) => setSelectedClass(e.target.value)} style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: 'white' }}>
                            <option value="">-- เลือก --</option>
                            {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>วันที่เช็คชื่อ</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: 'white' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>ภาคเรียน / ปีการศึกษา</label>
                        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: 'white' }}>
                            {academicSettings.semesters.map((s, idx) => (
                                <option key={idx} value={`${s.semester}/${s.year}`}>ภาคเรียนที่ {s.semester} / {s.year}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedClass && (
                    <>
                        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                            <button onClick={markAllPresent} style={{ ...buttonStyle, backgroundColor: '#15803d' }}><FaCheck /> เช็คมาทั้งหมด</button>
                            <button onClick={deleteAll} style={{ ...buttonStyle, backgroundColor: '#b91c1c' }}><FaTrash /> ลบทั้งหมด</button>
                        </div>

                        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', overflow: 'hidden' }}>
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((stu, index) => {
                                    const studentNo = stu.studentNumber || stu.number || stu.no || stu.code || (index + 1);
                                    return (
                                        <div key={stu.id} style={{ padding: '16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '14px' }}>เลขที่ {studentNo}. {stu.name}</span>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {attendance[stu.id] ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', ...statusConfig[attendance[stu.id]] }}>{attendance[stu.id]}</span>
                                                        <button onClick={() => handleAttendance(stu.id, null)} style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'underline', background: 'none', border: 'none' }}><FaEdit size={10} /> แก้ไข</button>
                                                    </div>
                                                ) : (
                                                    Object.keys(statusConfig).map(s => (
                                                        <button key={s} onClick={() => handleAttendance(stu.id, s)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', backgroundColor: statusConfig[s].backgroundColor, border: 'none', color: 'white' }}>{s}</button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>ไม่พบรายชื่อนักเรียนในห้องนี้</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}