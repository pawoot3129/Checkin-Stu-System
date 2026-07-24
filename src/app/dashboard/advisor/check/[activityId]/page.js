'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { FaCalendarCheck, FaArrowLeft, FaEdit, FaCheck, FaTrash, FaBriefcase, FaUserGraduate, FaCalendarDay } from 'react-icons/fa';

export default function CheckAttendancePage() {
    const router = useRouter();
    const params = useParams();
    const activityId = params?.activityId;

    const [data, setData] = useState({ name: 'กำลังโหลด...', classes: [], students: [] });
    const [academicSettings, setAcademicSettings] = useState({ years: [], semesters: [] });
    const [selectedClass, setSelectedClass] = useState('');
    const [attendance, setAttendance] = useState({});
    const [holidayNote, setHolidayNote] = useState({}); // เก็บข้อความระบุวันหยุดของแต่ละวัน
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTerm, setSelectedTerm] = useState('');
    const [isHolidayMode, setIsHolidayMode] = useState(false);
    const [holidayInputText, setHolidayInputText] = useState('');

    const statusConfig = {
        'มา': { backgroundColor: '#15803d', color: '#ffffff' },
        'ขาด': { backgroundColor: '#b91c1c', color: '#ffffff' },
        'สาย': { backgroundColor: '#a16207', color: '#ffffff' },
        'ลาครึ่งวัน': { backgroundColor: '#c2410c', color: '#ffffff' },
        'ลาเต็มวัน': { backgroundColor: '#be185d', color: '#ffffff' },
        'ฝึกงาน': { backgroundColor: '#0284c7', color: '#ffffff' },
        'ทวิภาคี': { backgroundColor: '#7c3aed', color: '#ffffff' },
        'วันหยุด': { backgroundColor: '#475569', color: '#ffffff' }
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
                let userData = {};
                const userSnapByEmail = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
                if (!userSnapByEmail.empty) {
                    userData = userSnapByEmail.docs[0].data();
                } else {
                    const userSnapByUid = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
                    if (!userSnapByUid.empty) userData = userSnapByUid.docs[0].data();
                }

                const [actSnap, stuSnap, classSnap, settingsSnap] = await Promise.all([
                    getDoc(doc(db, "activities", activityId)),
                    getDocs(collection(db, "students")),
                    getDocs(collection(db, "classrooms")),
                    getDoc(doc(db, "system_settings", "main_config"))
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
                let foundHolidayNote = "";
                snap.forEach(d => {
                    const rData = d.data();
                    saved[rData.studentId] = rData.status;
                    if (rData.holidayNote) {
                        foundHolidayNote = rData.holidayNote;
                    }
                });
                setAttendance(saved);
                if (foundHolidayNote) {
                    setIsHolidayMode(true);
                    setHolidayInputText(foundHolidayNote);
                } else {
                    setIsHolidayMode(false);
                    setHolidayInputText('');
                }
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

    const markAllStatus = async (statusText, successMessage) => {
        const newAttendance = { ...attendance };
        for (const stu of filteredStudents) {
            newAttendance[stu.id] = statusText;
            await setDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`), { activityId, date, studentId: stu.id, status: statusText, classId: selectedClass, updatedAt: new Date() });
        }
        setAttendance(newAttendance);
        toast.success(successMessage);
    };

    const saveHolidayForAll = async () => {
        if (!holidayInputText.trim()) {
            toast.error("กรุณาระบุชื่อหรือรายละเอียดวันหยุด");
            return;
        }
        try {
            const newAttendance = { ...attendance };
            for (const stu of filteredStudents) {
                newAttendance[stu.id] = 'วันหยุด';
                await setDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`), { 
                    activityId, 
                    date, 
                    studentId: stu.id, 
                    status: 'วันหยุด', 
                    holidayNote: holidayInputText.trim(),
                    classId: selectedClass, 
                    updatedAt: new Date() 
                });
            }
            setAttendance(newAttendance);
            setIsHolidayMode(true);
            toast.success("บันทึกวันหยุดพิเศษเรียบร้อยแล้ว");
        } catch (e) {
            toast.error("บันทึกวันหยุดไม่สำเร็จ");
        }
    };

    const clearHolidayForAll = async () => {
        try {
            for (const stu of filteredStudents) {
                await deleteDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`));
            }
            setAttendance({});
            setIsHolidayMode(false);
            setHolidayInputText('');
            toast.success("ยกเลิกวันหยุดและล้างข้อมูลเช็คชื่อของวันนี้แล้ว");
        } catch (e) {
            toast.error("ลบข้อมูลไม่สำเร็จ");
        }
    };

    const deleteAll = async () => {
        for (const stu of filteredStudents) await deleteDoc(doc(db, "attendance", `${activityId}_${date}_${stu.id}`));
        setAttendance({});
        setIsHolidayMode(false);
        setHolidayInputText('');
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

    return (
        <div style={{ backgroundColor: '#0a0a0a', color: '#ffffff', minHeight: '100vh', padding: '24px' }}>
            <Toaster />
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FaCalendarCheck size={24} color="#6366f1" />
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.name}</h1>
                    </div>
                    <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer', color: 'white' }}>
                        <FaArrowLeft size={12} /> ย้อนกลับ
                    </button>
                </div>

                <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>ห้องเรียน</label>
                        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: 'white' }}>
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
                        <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>จัดการวันหยุดพิเศษ / วันหยุดกิจกรรมของวันนี้</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input 
                                    type="text" 
                                    placeholder="ระบุชื่อวันหยุด (เช่น วันหยุดนักขัตฤกษ์, วันกิจกรรม)" 
                                    value={holidayInputText} 
                                    onChange={(e) => setHolidayInputText(e.target.value)}
                                    style={{ flex: 1, backgroundColor: '#0a0a0a', border: '1px solid #334155', padding: '10px 12px', borderRadius: '8px', color: 'white', minWidth: '220px' }}
                                />
                                <button onClick={saveHolidayForAll} style={{ ...buttonStyle, backgroundColor: '#475569' }}><FaCalendarDay /> บันทึกเป็นวันหยุด</button>
                                {isHolidayMode && (
                                    <button onClick={clearHolidayForAll} style={{ ...buttonStyle, backgroundColor: '#b91c1c' }}><FaTrash /> ยกเลิกวันหยุด</button>
                                )}
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => markAllStatus('มา', 'บันทึกการเข้าเรียนทั้งหมดแล้ว')} style={{ ...buttonStyle, backgroundColor: '#15803d' }}><FaCheck /> เช็คมาทั้งหมด</button>
                            <button onClick={() => markAllStatus('ฝึกงาน', 'บันทึกสถานะฝึกงานทั้งหมดแล้ว')} style={{ ...buttonStyle, backgroundColor: '#0284c7' }}><FaBriefcase /> เช็คฝึกงานทั้งหมด</button>
                            <button onClick={() => markAllStatus('ทวิภาคี', 'บันทึกสถานะทวิภาคีทั้งหมดแล้ว')} style={{ ...buttonStyle, backgroundColor: '#7c3aed' }}><FaUserGraduate /> เช็คทวิภาคีทั้งหมด</button>
                            <button onClick={deleteAll} style={{ ...buttonStyle, backgroundColor: '#b91c1c' }}><FaTrash /> ลบทั้งหมด</button>
                        </div>

                        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', overflow: 'hidden' }}>
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((stu, index) => {
                                    const studentNo = index + 1;
                                    return (
                                        <div key={stu.id} style={{ padding: '16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '14px' }}>เลขที่ {studentNo}. {stu.name}</span>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {attendance[stu.id] ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', ...statusConfig[attendance[stu.id]] }}>
                                                            {attendance[stu.id] === 'วันหยุด' ? `วันหยุด: ${holidayInputText || 'วันหยุดพิเศษ'}` : attendance[stu.id]}
                                                        </span>
                                                        <button onClick={() => handleAttendance(stu.id, null)} style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}><FaEdit size={10} /> แก้ไข</button>
                                                    </div>
                                                ) : (
                                                    Object.keys(statusConfig).map(s => (
                                                        <button key={s} onClick={() => handleAttendance(stu.id, s)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', backgroundColor: statusConfig[s].backgroundColor, border: 'none', color: 'white', cursor: 'pointer' }}>{s}</button>
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