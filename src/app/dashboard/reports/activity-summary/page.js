'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function ActivitySummaryPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [allActivities, setAllActivities] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [academicYears, setAcademicYears] = useState(['2569']);
    const [systemConfig, setSystemConfig] = useState({});
    
    const [activityCategory, setActivityCategory] = useState('main'); // 'main' หรือ 'sub'
    const [selectedYear, setSelectedYear] = useState('2569');
    const [selectedSemester, setSelectedSemester] = useState('1');
    const [selectedActivityId, setSelectedActivityId] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const init = async () => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) return router.push('/');
                const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                if (!userSnap.empty) {
                    const profile = userSnap.docs[0].data();
                    setUserProfile(profile);

                    const classSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
                    const existingClassesMap = new Set(
                        classSnap.docs.map(d => `${d.data().className} ${d.data().department || ''}`.trim())
                    );

                    let classes = [];
                    if (profile.role === 'admin') {
                        classes = Array.from(existingClassesMap);
                    } else {
                        const assigned = profile.assignedClasses || [];
                        classes = assigned.filter(c => existingClassesMap.has(c));
                    }

                    classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    setClassrooms([...new Set(classes)]);
                }
            });
            const settingsSnap = await getDoc(doc(db, "system_settings", "main_config"));
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                setSystemConfig(data);
                const years = data.academicYears || ['2569'];
                setAcademicYears(years);
                const currentY = years[years.length - 1];
                setSelectedYear(currentY);

                const semestersForYear = data.semestersByYear?.[currentY] || ['1'];
                setSelectedSemester(semestersForYear[semestersForYear.length - 1]);
            }
            const actSnap = await getDocs(collection(db, "activities"));
            setAllActivities(actSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        init();
    }, [router]);

    const handleYearChange = (newYear) => {
        setSelectedYear(newYear);
        const semestersForYear = systemConfig.semestersByYear?.[newYear] || ['1'];
        setSelectedSemester(semestersForYear[semestersForYear.length - 1]);
    };

    useEffect(() => { 
        setSelectedActivityId('');
        setReportData(null); 
    }, [activityCategory, selectedYear, selectedSemester]);

    useEffect(() => { 
        setReportData(null); 
    }, [selectedClass]);

    const handleGenerateReport = async () => {
        if (!selectedActivityId || !selectedClass) return toast.error("กรุณาเลือกกิจกรรมและห้องเรียน");
        setIsLoading(true);
        try {
            const currentActivity = allActivities.find(a => a.id === selectedActivityId);
            const isSubActivity = currentActivity?.activityType === 'sub';

            const sSnap = await getDocs(query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber")));
            const students = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(st => st.status !== "จำหน่าย"); 
            
            if (students.length === 0) {
                toast.error("ไม่พบรายชื่อนักเรียนในห้องนี้");
                setIsLoading(false);
                return;
            }

            const studentIds = students.map(st => String(st.id).trim());
            const chunks = [];
            for (let i = 0; i < studentIds.length; i += 30) {
                chunks.push(studentIds.slice(i, i + 30));
            }

            let allAttendance = [];
            for (const chunk of chunks) {
                const aQuery = query(
                    collection(db, "attendance"),
                    where("activityId", "==", selectedActivityId),
                    where("studentId", "in", chunk)
                );
                const aSnap = await getDocs(aQuery);
                aSnap.docs.forEach(d => allAttendance.push(d.data()));
            }

            if (isSubActivity) {
                // หาходилวันที่จัดกิจกรรมจากบันทึกการเช็คชื่อ
                const uniqueDates = [...new Set(allAttendance.map(r => r.date))];
                let activityDateFormatted = '-';
                if (uniqueDates.length > 0) {
                    const rawDate = uniqueDates[0]; // ใช้วันที่บันทึก
                    const [year, month, day] = rawDate.split('-');
                    const thaiMonths = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
                    activityDateFormatted = `${Number(day)} ${thaiMonths[Number(month)]} ${Number(year) + 543}`;
                }

                // ประมวลผลสำหรับกิจกรรมย่อย
                const processed = students.map(st => {
                    const rec = allAttendance.find(r => String(r.studentId).trim() === String(st.id).trim());
                    const status = rec ? rec.status : '-';
                    let evalResult = '-';
                    if (status === 'เข้าร่วม') evalResult = 'ผ่าน';
                    else if (status === 'ไม่เข้าร่วม') evalResult = 'ไม่ผ่าน';

                    return {
                        ...st,
                        status,
                        result: evalResult
                    };
                });

                setReportData({ 
                    isSub: true,
                    activityName: currentActivity?.activityName, 
                    className: selectedClass, 
                    students: processed,
                    activityDate: activityDateFormatted,
                    printDate: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                    advisorName: userProfile?.name || "..................................." 
                });
            } else {
                // ประมวลผลสำหรับกิจกรรมหลัก
                const weightSnap = await getDoc(doc(db, "system_settings", "evaluation_weights"));
                const weights = weightSnap.exists() ? weightSnap.data() : { 'มา': 0, 'สาย': 1, 'ลาครึ่งวัน': 0.5, 'ลาทั้งวัน': 0.5, 'ขาด': 1 };
                
                const attendance = allAttendance.filter(r => String(r.status || '').trim() !== 'วันหยุด');
                const uniqueDates = [...new Set(attendance.map(r => r.date))];
                const totalSessions = uniqueDates.length;
                
                const classStatuses = attendance.map(r => r.status);
                const isClassDualOrInternship = selectedClass.includes('ทวิภาคี') || 
                    (classStatuses.length > 0 && classStatuses.every(s => s === 'ฝึกงาน' || s === 'ทวิภาคี'));

                const processed = students.map(st => {
                    const recs = attendance.filter(r => String(r.studentId).trim() === String(st.id).trim());
                    const stats = { 'มา': 0, 'สาย': 0, 'ลาครึ่งวัน': 0, 'ลาทั้งวัน': 0, 'ขาด': 0 };
                    let penaltyScore = 0;
                    let isStudentInternshipOrDual = isClassDualOrInternship;

                    recs.forEach(r => {
                        let stName = String(r.status || '').trim();
                        if (stName === 'ฝึกงาน' || stName === 'ทวิภาคี') {
                            isStudentInternshipOrDual = true;
                        }
                        
                        if (stName === 'มา' || stName === 'ฝึกงาน' || stName === 'ทวิภาคี') {
                            stats['มา']++;
                            penaltyScore += Number(weights['มา'] ?? 0);
                        } else if (stName === 'สาย') {
                            stats['สาย']++;
                            penaltyScore += Number(weights['สาย'] ?? 1);
                        } else if (stName.includes('ครึ่ง')) {
                            stats['ลาครึ่งวัน']++;
                            penaltyScore += Number(weights['ลาครึ่งวัน'] ?? 0.5);
                        } else if (stName.includes('ลา') || stName === 'ลาเต็ม' || stName === 'ลาทั้งวัน') {
                            stats['ลาทั้งวัน']++;
                            penaltyScore += Number(weights['ลาทั้งวัน'] ?? 0.5);
                        } else if (stName === 'ขาด') {
                            stats['ขาด']++;
                            penaltyScore += Number(weights['ขาด'] ?? 1);
                        } else {
                            stats['ขาด']++;
                            penaltyScore += Number(weights['ขาด'] ?? 1);
                        }
                    });

                    const studentActualTotalDays = stats['มา'] + stats['สาย'] + stats['ลาครึ่งวัน'] + stats['ลาทั้งวัน'] + stats['ขาด'];

                    if (studentActualTotalDays === 0) {
                        return {
                            ...st,
                            isInternshipOrDual: false,
                            stats,
                            totalRecs: 0,
                            totalAbsenceOrLate: 0,
                            percent: '-',
                            result: 'มผ'
                        };
                    }

                    if (isStudentInternshipOrDual && studentActualTotalDays > 0) {
                        return {
                            ...st,
                            isInternshipOrDual: true,
                            totalRecs: studentActualTotalDays,
                            percent: '100',
                            result: 'ผ่าน'
                        };
                    }

                    const totalAbsenceOrLate = penaltyScore;
                    const percent = ((studentActualTotalDays - penaltyScore) / studentActualTotalDays) * 100;
                    
                    return { 
                        ...st, 
                        isInternshipOrDual: false,
                        stats, 
                        totalRecs: studentActualTotalDays, 
                        totalAbsenceOrLate, 
                        percent: Math.max(0, percent).toFixed(0), 
                        result: percent >= 80 ? 'ผ่าน' : 'มผ' 
                    };
                });

                setReportData({ 
                    isSub: false,
                    activityName: currentActivity?.activityName, 
                    className: selectedClass, 
                    students: processed,
                    totalSessions,
                    printDate: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                    advisorName: userProfile?.name || "..................................." 
                });
            }
            toast.success("สร้างรายงานสำเร็จ");
        } catch (e) { 
            console.error(e);
            toast.error("เกิดข้อผิดพลาด"); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const availableSemesters = systemConfig.semestersByYear?.[selectedYear] || ['1'];
    
    const filteredActivities = allActivities.filter(a => {
        const matchYear = String(a.academicYear) === String(selectedYear);
        const matchSem = String(a.semester) === String(selectedSemester);
        const isSub = activityCategory === 'sub';
        const matchType = isSub ? (a.activityType === 'sub') : (a.activityType !== 'sub');
        return matchYear && matchSem && matchType;
    });

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <style jsx global>{`
                @media print { 
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background: transparent !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    #non-printable { display: none !important; } 
                    #printable-area { 
                        display: block !important; 
                        color: #000000 !important; 
                        background: #ffffff !important; 
                        width: 100% !important; 
                        padding: 10px !important; 
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    @page { size: A4 portrait; margin: 1cm; }
                    table { font-size: 12px !important; width: 100% !important; border-collapse: collapse !important; }
                    th, td { border: 1px solid #000000 !important; color: #000000 !important; }
                    th { background-color: #f3f4f6 !important; }
                }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold">รายงานรายกิจกรรม</h1>
                    <button onClick={() => router.back()} className="bg-gray-800 px-6 py-2 rounded-xl transition hover:bg-gray-700">← กลับ</button>
                </header>
                
                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 space-y-6">
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setActivityCategory('main')}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${activityCategory === 'main' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            📌 รายงานกิจกรรมหลัก (สะสม)
                        </button>
                        <button 
                            onClick={() => setActivityCategory('sub')}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${activityCategory === 'sub' ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            ⚡ รายงานกิจกรรมย่อย (วันเดียวจบ)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="p-3 bg-gray-950 rounded-xl border border-gray-800">
                            {availableSemesters.map(sem => (
                                <option key={sem} value={sem}>ภาคเรียนที่ {sem}</option>
                            ))}
                        </select>
                        <select value={selectedYear} onChange={e => handleYearChange(e.target.value)} className="p-3 bg-gray-950 rounded-xl border border-gray-800">
                            {academicYears.map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}
                        </select>
                        <select value={selectedActivityId} onChange={e => setSelectedActivityId(e.target.value)} className="md:col-span-2 p-3 bg-gray-950 rounded-xl border border-gray-800">
                            <option value="">-- เลือกกิจกรรม{activityCategory === 'sub' ? 'ย่อย' : 'หลัก'} --</option>
                            {filteredActivities.map(a => <option key={a.id} value={a.id}>{a.activityName}</option>)}
                        </select>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="md:col-span-2 p-3 bg-gray-950 rounded-xl border border-gray-800">
                            <option value="">-- เลือกห้องเรียน --</option>
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    
                    <div className="flex gap-4 pt-4 border-t border-gray-800">
                        <button onClick={handleGenerateReport} disabled={isLoading} className="flex-1 py-4 bg-indigo-600 rounded-xl font-bold transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-500">{isLoading ? 'กำลังโหลด...' : 'สร้างรายงาน'}</button>
                        <button onClick={() => window.print()} disabled={!reportData} className={`flex-1 py-4 rounded-xl font-bold transition-all duration-200 ${!reportData ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:scale-[1.02] hover:bg-gray-200'}`}>พิมพ์รายงาน</button>
                    </div>
                </div>
            </div>

            {reportData && (
                <div id="printable-area" className="mt-10 bg-white p-10 rounded-xl text-black shadow-2xl max-w-4xl mx-auto">
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <img src="/logo.png" className="w-16" alt="Logo" />
                        <div className="text-center">
                            <h2 className="text-xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                            <p className="text-sm font-semibold">
                                {reportData.isSub ? 'รายงานผลการเข้าร่วมกิจกรรมย่อย' : 'รายงานสรุปผลการเข้าร่วมกิจกรรม'}: {reportData.activityName}
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                        <p>
                            <strong>ห้อง:</strong> {reportData.className} | 
                            <strong> ภาคเรียนที่ {selectedSemester} / {selectedYear}</strong> 
                            {reportData.isSub ? ` | วันที่จัดกิจกรรม: ${reportData.activityDate}` : ` | รวมทั้งหมด ${reportData.totalSessions} ครั้ง`}
                        </p>
                        <p><strong>วันที่ออกรายงาน:</strong> {reportData.printDate}</p>
                    </div>

                    {reportData.isSub ? (
                        <table className="w-full border-collapse border border-gray-400 text-center mb-6">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border p-2 text-center w-16">เลขที่</th>
                                    <th className="border p-2 text-left">ชื่อ - สกุล</th>
                                    <th className="border p-2 w-32">ผลการเข้าร่วม</th>
                                    <th className="border p-2 w-32">ผลการประเมิน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.students.map((s, index) => (
                                    <tr key={s.id}>
                                        <td className="border p-2 text-center">{index + 1}</td>
                                        <td className="border p-2 text-left">{s.name}</td>
                                        <td className="border p-2 font-semibold">
                                            {s.status === 'เข้าร่วม' ? <span className="text-green-600">✔ เข้าร่วม</span> : s.status === 'ไม่เข้าร่วม' ? <span className="text-red-600">✘ ไม่เข้าร่วม</span> : '-'}
                                        </td>
                                        <td className={`border p-2 font-bold ${s.result === 'ผ่าน' ? 'text-green-700' : s.result === 'ไม่ผ่าน' ? 'text-red-600' : 'text-gray-500'}`}>
                                            {s.result}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full border-collapse border border-gray-400 text-center mb-6">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border p-1 text-center">เลขที่</th>
                                    <th className="border p-1 text-center">ชื่อ - สกุล</th>
                                    <th className="border p-1">รวมวัน</th>
                                    <th className="border p-1">มา</th>
                                    <th className="border p-1">สาย</th>
                                    <th className="border p-1">ลาครึ่ง</th>
                                    <th className="border p-1">ลาเต็ม</th>
                                    <th className="border p-1">ขาด</th>
                                    <th className="border p-1" style={{ whiteSpace: 'pre-line', lineHeight: '1.2' }}>รวม<br/>ขาด/ลา/สาย</th>
                                    <th className="border p-1">ร้อยละ</th>
                                    <th className="border p-1">ผลการประเมิน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.students.map((s, index) => (
                                    <tr key={s.id}>
                                        <td className="border p-1 text-center">{index + 1}</td>
                                        <td className="border p-1 text-left">{s.name}</td>
                                        <td className="border p-1 font-bold">{s.totalRecs === 0 ? '-' : s.totalRecs}</td>
                                        {s.isInternshipOrDual ? (
                                            <td colSpan="8" className="border p-1 font-semibold text-center bg-gray-50 text-indigo-700">
                                                นักศึกษาระบบทวิภาคี / ออกฝึกประสบการณ์วิชาชีพ
                                            </td>
                                        ) : s.totalRecs === 0 ? (
                                            <>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1">-</td>
                                                <td className="border p-1 font-bold text-red-600">{s.result}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="border p-1">{s.stats.มา}</td>
                                                <td className="border p-1">{s.stats.สาย}</td>
                                                <td className="border p-1">{s.stats.ลาครึ่งวัน}</td>
                                                <td className="border p-1">{s.stats.ลาทั้งวัน}</td>
                                                <td className="border p-1">{s.stats.ขาด}</td>
                                                <td className="border p-1 font-semibold text-red-600">{s.totalAbsenceOrLate}</td>
                                                <td className="border p-1">{s.percent}%</td>
                                                <td className="border p-1 font-bold">{s.result === 'ผ่าน' ? 'ผ่าน' : 'มผ'}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="text-sm mb-10 p-3 bg-gray-50 rounded-lg">
                        <strong>หมายเหตุ:</strong> {reportData.isSub ? 'เกณฑ์การประเมินกิจกรรมย่อย นักเรียนต้องมีสถานะ "เข้าร่วม" จึงจะถือว่าผ่านเกณฑ์' : 'เกณฑ์ประเมินกิจกรรมต้องไม่ต่ำกว่า 80% จึงจะถือว่า "ผ่าน"'}
                    </div>
                    <div className="text-center w-56 ml-auto">
                        <p>ลงชื่อ...........................................</p>
                        <p className="mt-1">({reportData.advisorName})</p>
                        <p>ครูที่ปรึกษา</p>
                    </div>
                </div>
            )}
        </div>
    );
}