'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function SemesterSummaryPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [academicYears, setAcademicYears] = useState(['2569']);
    const [systemConfig, setSystemConfig] = useState({});
    const [selectedYear, setSelectedYear] = useState('2569');
    const [selectedSemester, setSelectedSemester] = useState('1');
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const init = async () => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) return router.push('/');
                
                const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                if (!snap.empty) {
                    const prof = snap.docs[0].data();
                    setUserProfile(prof);

                    const classSnap = await getDocs(collection(db, "classrooms"));
                    const existingClassesMap = new Set(
                        classSnap.docs.map(d => {
                            const data = d.data();
                            return data.department ? `${data.className} ${data.department}` : data.className;
                        })
                    );

                    let classes = [];
                    if (prof.role === 'admin') {
                        classes = Array.from(existingClassesMap);
                    } else {
                        const assigned = prof.assignedClasses || [];
                        classes = assigned.filter(c => existingClassesMap.has(c));
                    }

                    const uniqueClasses = [...new Set(classes)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    setClassrooms(uniqueClasses);
                    if (uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
                }

                const settingsSnap = await getDoc(doc(db, "system_settings", "main_config"));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    setSystemConfig(data);
                    const years = data.academicYears || ['2569'];
                    setAcademicYears(years);
                    const currentY = years[0];
                    setSelectedYear(currentY);

                    const semestersForYear = data.semestersByYear?.[currentY] || ['1'];
                    setSelectedSemester(semestersForYear[0]);
                }
            });
        };
        init();
    }, [router]);

    const handleYearChange = (newYear) => {
        setSelectedYear(newYear);
        const semestersForYear = systemConfig.semestersByYear?.[newYear] || ['1'];
        setSelectedSemester(semestersForYear[0]);
    };

    useEffect(() => { setReportData(null); }, [selectedYear, selectedSemester, selectedClass]);

    const generateReport = async () => {
        if (!selectedClass) return toast.error("กรุณาเลือกห้องเรียน");
        setIsLoading(true);
        try {
            const weightSnap = await getDoc(doc(db, "system_settings", "evaluation_weights"));
            const weights = weightSnap.exists() ? weightSnap.data() : { 'มา': 0, 'สาย': 1, 'ลาครึ่งวัน': 0.5, 'ลาทั้งวัน': 0.5, 'ขาด': 1 };

            const acts = await getDocs(query(collection(db, "activities"), where("academicYear", "==", selectedYear), where("semester", "==", selectedSemester)));
            const semesterActivities = acts.docs.map(d => ({ id: d.id, ...d.data() }));

            const studs = await getDocs(query(collection(db, "students"), where("classId", "==", selectedClass)));
            
            const studentList = studs.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => s.status !== "จำหน่าย")
                .sort((a, b) => {
                    const numA = Number(a.studentNumber || a.number || a.no || a.code || 0);
                    const numB = Number(b.studentNumber || b.number || b.no || b.code || 0);
                    if (numA !== numB) return numA - numB;
                    return (a.name || '').localeCompare(b.name || '', 'th');
                });

            if (studentList.length === 0) {
                toast.error("ไม่พบรายชื่อนักเรียนในห้องนี้");
                setIsLoading(false);
                return;
            }

            const studentIdsSet = new Set(studentList.map(st => String(st.id).trim()));
            const actIds = semesterActivities.map(a => a.id);
            
            let allAtt = [];
            if (actIds.length > 0) {
                const actChunks = [];
                for (let i = 0; i < actIds.length; i += 30) {
                    actChunks.push(actIds.slice(i, i + 30));
                }

                for (const chunk of actChunks) {
                    const attSnap = await getDocs(query(
                        collection(db, "attendance"), 
                        where("activityId", "in", chunk)
                    ));
                    attSnap.docs.forEach(d => {
                        const data = d.data();
                        if (studentIdsSet.has(String(data.studentId).trim())) {
                            allAtt.push(data);
                        }
                    });
                }
            }

            const classStatuses = allAtt.map(r => r.status);
            const isClassDualOrInternship = selectedClass.includes('ทวิภาคี') || 
                (classStatuses.length > 0 && classStatuses.every(s => s === 'ฝึกงาน' || s === 'ทวิภาคี'));

            const mainActivityNames = [
                "กิจกรรมเข้าแถวหน้าเสาธง",
                "กิจกรรมตรวจเครื่องแต่งกาย",
                "กิจกรรมอบรมจริยธรรม (วันพุธ)",
                "กิจกรรมการออม"
            ];

            const processed = studentList.map(st => {
                const results = {};
                let hasIncomplete = false; 
                
                let mainHasFailed = false; 
                let subTotalCount = 0;
                let subFailedCount = 0;    

                const stRecsAll = allAtt.filter(r => String(r.studentId).trim() === String(st.id).trim());

                semesterActivities.forEach(act => {
                    const actName = act.activityName || '';
                    const isMain = mainActivityNames.includes(actName);

                    if (!isMain) {
                        subTotalCount++;
                    }

                    const actAttAll = allAtt.filter(r => r.activityId === act.id);
                    const actAttendance = actAttAll.filter(r => String(r.status || '').trim() !== 'วันหยุด');
                    
                    const uniqueDates = [...new Set(actAttendance.map(r => r.date))];
                    const totalSessions = uniqueDates.length;

                    if (totalSessions === 0) {
                        results[act.id] = '-';
                        hasIncomplete = true;
                        if (isMain) mainHasFailed = true;
                        else subFailedCount++;
                        return;
                    }

                    const actRecs = stRecsAll.filter(r => r.activityId === act.id && String(r.status || '').trim() !== 'วันหยุด');
                    
                    let penaltyScore = 0;
                    let isStudentInternshipOrDual = isClassDualOrInternship;
                    let statsCheckCount = 0;

                    actRecs.forEach(r => {
                        let stName = String(r.status || '').trim();
                        if (stName === 'ฝึกงาน' || stName === 'ทวิภาคี') {
                            isStudentInternshipOrDual = true;
                        }

                        if (stName === 'มา' || stName === 'ฝึกงาน' || stName === 'ทวิภาคี') {
                            statsCheckCount++;
                            penaltyScore += Number(weights['มา'] ?? 0);
                        } else if (stName === 'สาย') {
                            statsCheckCount++;
                            penaltyScore += Number(weights['สาย'] ?? 1);
                        } else if (stName.includes('ครึ่ง')) {
                            statsCheckCount++;
                            penaltyScore += Number(weights['ลาครึ่งวัน'] ?? 0.5);
                        } else if (stName.includes('ลา') || stName === 'ลาเต็ม' || stName === 'ลาทั้งวัน') {
                            statsCheckCount++;
                            penaltyScore += Number(weights['ลาทั้งวัน'] ?? 0.5);
                        } else if (stName === 'ขาด') {
                            statsCheckCount++;
                            penaltyScore += Number(weights['ขาด'] ?? 1);
                        } else {
                            statsCheckCount++;
                            penaltyScore += Number(weights['ขาด'] ?? 1);
                        }
                    });

                    if (isStudentInternshipOrDual && statsCheckCount > 0) {
                        results[act.id] = 'ผ';
                        return;
                    }

                    const percent = statsCheckCount > 0 ? ((statsCheckCount - penaltyScore) / statsCheckCount) * 100 : 100;
                    const minP = act.minPercent || 80;
                    const isPassed = percent >= minP;

                    results[act.id] = isPassed ? 'ผ' : 'มผ';
                    
                    if (!isPassed) {
                        if (isMain) {
                            mainHasFailed = true;
                        } else {
                            subFailedCount++;
                        }
                    }
                });

                const allowedSubFail = Math.ceil(subTotalCount * 0.10);
                const subPassedCriteria = subFailedCount <= allowedSubFail;

                let overall = 'ผ';
                if (semesterActivities.length === 0 || hasIncomplete || mainHasFailed || !subPassedCriteria) {
                    overall = 'มผ';
                }

                return { 
                    ...st, 
                    results, 
                    overall 
                };
            });

            const sortedActivities = [...semesterActivities].sort((a, b) => {
                const aIsMain = mainActivityNames.includes(a.activityName);
                const bIsMain = mainActivityNames.includes(b.activityName);
                if (aIsMain && !bIsMain) return -1;
                if (!aIsMain && bIsMain) return 1;
                return 0;
            });

            setReportData({ 
                students: processed, 
                activities: sortedActivities, 
                date: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }), 
                advisor: userProfile?.name || "..................................." 
            });
            toast.success("สร้างรายงานสำเร็จ");
        } catch (e) { 
            console.error(e);
            toast.error("เกิดข้อผิดพลาด"); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const availableSemesters = systemConfig.semestersByYear?.[selectedYear] || ['1'];

    const mainActivityNames = [
        "กิจกรรมเข้าแถวหน้าเสาธง",
        "กิจกรรมตรวจเครื่องแต่งกาย",
        "กิจกรรมอบรมจริยธรรม (วันพุธ)",
        "กิจกรรมการออม"
    ];

    const mainActs = reportData?.activities.filter(a => mainActivityNames.includes(a.activityName)) || [];
    const subActs = reportData?.activities.filter(a => !mainActivityNames.includes(a.activityName)) || [];

    // ฟังก์ชันแบ่งหน้าอัจฉริยะ (ถ้าเด็ก <= 28 คน ให้อยู่หน้าเดียวจบ, ถ้ามากกว่าให้หารหน้าละประมาณ 24 คน)
    const chunkStudents = (students) => {
        const total = students.length;
        if (total <= 28) {
            return [students];
        }
        const numPages = Math.ceil(total / 24);
        const pageSize = Math.ceil(total / numPages);
        const chunks = [];
        for (let i = 0; i < total; i += pageSize) {
            chunks.push(students.slice(i, i + pageSize));
        }
        return chunks;
    };

    const studentPages = reportData ? chunkStudents(reportData.students) : [];

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
                        margin: 0 !important; 
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .print-page {
                        box-sizing: border-box;
                        padding: 0.5cm !important;
                        width: 100% !important;
                    }
                    table { table-layout: fixed !important; width: 100% !important; font-size: 9.5px !important; border-collapse: collapse !important; }
                    th, td { padding: 3px !important; border: 1px solid #000000 !important; overflow: hidden; word-wrap: break-word; color: #000000 !important; }
                    th { background-color: #f3f4f6 !important; }
                    @page { size: landscape; margin: 1cm; }
                }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold">รายงานสรุปประเมินผลกิจกรรมปลายเทอม</h1><button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl">← กลับ</button></header>
                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ภาคเรียน</label>
                            <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">
                                {availableSemesters.map(sem => (
                                    <option key={sem} value={sem}>ภาคเรียนที่ {sem}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ปีการศึกษา</label>
                            <select value={selectedYear} onChange={e => handleYearChange(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">
                                {academicYears.map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">เลือกห้องเรียน</label>
                            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">{classrooms.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={generateReport} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all hover:scale-[1.02]">{isLoading ? 'กำลังโหลด...' : 'สร้างรายงาน'}</button>
                        <button onClick={() => window.print()} disabled={!reportData} className={`py-4 rounded-xl font-bold transition-all ${reportData ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]' : 'bg-gray-800 text-gray-500'}`}>พิมพ์รายงาน</button>
                    </div>
                </div>
            </div>

            {reportData && (
                <div id="printable-area" className="mt-10 bg-white p-10 rounded-3xl text-black shadow-2xl max-w-5xl mx-auto">
                    {studentPages.map((pageStudents, pageIndex) => {
                        const isLastPage = pageIndex === studentPages.length - 1;
                        const startIndex = studentPages.slice(0, pageIndex).reduce((acc, curr) => acc + curr.length, 0);

                        return (
                            <div key={pageIndex} className="print-page mb-6 pb-6">
                                <div className="flex items-center justify-center gap-6 mb-3 border-b pb-3">
                                    <img src="/logo.png" className="w-14" alt="Logo" />
                                    <div className="text-center">
                                        <h2 className="text-lg font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                                        <p className="text-xs">รายงานสรุปผลการเข้าร่วมกิจกรรม ภาคเรียนที่ {selectedSemester}/{selectedYear} {studentPages.length > 1 ? `(หน้า ${pageIndex + 1}/${studentPages.length})` : ''}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between mb-2 font-bold text-xs">
                                    <p>ห้อง: {selectedClass}</p>
                                    <p>วันที่ออกรายงาน: {reportData.date}</p>
                                </div>

                                <table className="w-full border-collapse border border-black text-center text-xs mb-3" style={{ tableLayout: 'fixed' }}>
                                    <thead className="bg-gray-200">
                                        <tr>
                                            <th rowSpan="2" className="p-1.5 border border-black" style={{ width: '40px' }}>เลขที่</th>
                                            <th rowSpan="2" className="p-1.5 border border-black">ชื่อ-นามสกุล</th>
                                            {mainActs.length > 0 && (
                                                <th colSpan={mainActs.length} className="p-1.5 border border-black">กิจกรรมหลัก</th>
                                            )}
                                            {subActs.length > 0 && (
                                                <th colSpan={subActs.length} className="p-1.5 border border-black">กิจกรรมย่อย</th>
                                            )}
                                            <th rowSpan="2" className="p-1.5 border border-black" style={{ width: '50px' }}>สรุป</th>
                                        </tr>
                                        <tr>
                                            {mainActs.map(a => <th key={a.id} className="p-1 border border-black text-[10px]">{a.activityName}</th>)}
                                            {subActs.map(a => <th key={a.id} className="p-1 border border-black text-[10px]">{a.activityName}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageStudents.map((s, index) => (
                                            <tr key={s.id}>
                                                <td className="p-1.5 border border-black">{startIndex + index + 1}</td>
                                                <td className="p-1.5 border border-black text-left">{s.name}</td>
                                                {reportData.activities.map(a => (
                                                    <td key={a.id} className="p-1.5 border border-black font-bold" style={{color: s.results[a.id] === 'มผ' ? 'red' : 'black'}}>
                                                        {s.results[a.id]}
                                                    </td>
                                                ))}
                                                <td className="p-1.5 border border-black font-bold" style={{color: s.overall === 'มผ' ? 'red' : 'black'}}>{s.overall}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {isLastPage && (
                                    <div>
                                        <div className="text-[11px] p-2 bg-gray-50 border rounded-lg mb-3">
                                            <strong>หมายเหตุเกณฑ์ประเมิน:</strong>
                                            <ul className="list-disc ml-4">
                                                <li>ผลการเข้าร่วมแต่ละกิจกรรมต้องไม่ต่ำกว่า 80% จึงจะถือว่า "ผ่าน"</li>
                                                <li><strong>กิจกรรมหลัก:</strong> ทั้ง 4 กิจกรรม (เข้าแถว, เครื่องแต่งกาย, จริยธรรม, การออม) ห้ามมีผลประเมินเป็น "มผ" เด็ดขาด ต้องผ่านทั้งหมด</li>
                                                <li><strong>กิจกรรมย่อย:</strong> อนุญาตให้มีผลการประเมินไม่ผ่าน (มผ) ได้ไม่เกิน 10% ของจำนวนกิจกรรมย่อยทั้งหมด</li>
                                            </ul>
                                        </div>

                                        <div className="flex flex-row justify-between items-end px-4 text-center text-xs mt-4">
                                            <div className="flex-1 px-2">
                                                <p>ลงชื่อ......................................................</p>
                                                <p className="mt-1">({reportData.advisor})</p>
                                                <p className="font-semibold">ครูที่ปรึกษา</p>
                                            </div>
                                            <div className="flex-1 px-2">
                                                <p>ลงชื่อ......................................................</p>
                                                <p className="mt-1">(นายภวุฒิ มันเหมาะ)</p>
                                                <p className="font-semibold">รองผู้อำนวยการฝ่ายกิจการนักเรียน นักศึกษา</p>
                                            </div>
                                            <div className="flex-1 px-2 flex flex-col items-center">
                                                <div className="relative w-full flex justify-center items-center">
                                                    <p>ลงชื่อ......................................................</p>
                                                    <img src="/ลายเซ็น-ผอ-Nobg.png" alt="ลายเซ็น ผอ." className="absolute -top-10 w-24 object-contain pointer-events-none" />
                                                </div>
                                                <p className="mt-1">(ดร.ประชากร บริบูรณ์)</p>
                                                <p className="font-semibold">ผู้อำนวยการ</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}