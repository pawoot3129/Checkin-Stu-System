'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function FailedStudentsReportPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [academicYears, setAcademicYears] = useState(['2569']);
    const [systemConfig, setSystemConfig] = useState({});
    const [selectedYear, setSelectedYear] = useState('2569');
    const [selectedSemester, setSelectedSemester] = useState('1');
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const printDateStr = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    useEffect(() => {
        const init = async () => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) return router.push('/');
                
                const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                if (!snap.empty) {
                    const prof = snap.docs[0].data();
                    setUserProfile(prof);

                    if (prof.role !== 'admin') {
                        toast.error("สำหรับผู้ดูแลระบบเท่านั้น");
                        return router.push('/dashboard');
                    }

                    const classSnap = await getDocs(collection(db, "classrooms"));
                    const classes = classSnap.docs.map(d => {
                        const data = d.data();
                        return data.department ? `${data.className} ${data.department}` : data.className;
                    });
                    const uniqueClasses = [...new Set(classes)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    setClassrooms(uniqueClasses);
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

    const generateFailedReport = async () => {
        setIsLoading(true);
        try {
            const weightSnap = await getDoc(doc(db, "system_settings", "evaluation_weights"));
            const weights = weightSnap.exists() ? weightSnap.data() : { 'มา': 0, 'สาย': 1, 'ลาครึ่งวัน': 0.5, 'ลาทั้งวัน': 0.5, 'ขาด': 1 };

            const acts = await getDocs(query(collection(db, "activities"), where("academicYear", "==", selectedYear), where("semester", "==", selectedSemester)));
            const semesterActivities = acts.docs.map(d => ({ id: d.id, ...d.data() }));

            // กรองห้องทวิภาคีออกทันที ไม่ต้องนำมาตรวจสอบรายงาน
            const targetClasses = (selectedClass === 'all' ? classrooms : [selectedClass])
                .filter(className => !className.includes('ทวิภาคี'));

            if (targetClasses.length === 0) {
                toast.error("ไม่พบห้องเรียนที่ต้องตรวจสอบในระบบ");
                setIsLoading(false);
                return;
            }

            const mainActivityNames = [
                "กิจกรรมเข้าแถวหน้าเสาธง",
                "กิจกรรมตรวจเครื่องแต่งกาย",
                "กิจกรรมอบรมจริยธรรม (วันพุธ)",
                "กิจกรรมการออม"
            ];

            let allFailedStudents = [];

            for (const className of targetClasses) {
                const studs = await getDocs(query(collection(db, "students"), where("classId", "==", className)));
                const studentList = studs.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(s => s.status !== "จำหน่าย")
                    .sort((a, b) => {
                        const numA = Number(a.studentNumber || a.number || a.no || a.code || 0);
                        const numB = Number(b.studentNumber || b.number || b.no || b.code || 0);
                        return numA - numB;
                    });

                if (studentList.length === 0) continue;

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

                studentList.forEach(st => {
                    let hasIncomplete = false;
                    let mainHasFailed = false;
                    let subTotalCount = 0;
                    let subFailedCount = 0;

                    const stRecsAll = allAtt.filter(r => String(r.studentId).trim() === String(st.id).trim());

                    semesterActivities.forEach(act => {
                        const actName = act.activityName || '';
                        const isMain = mainActivityNames.includes(actName);

                        if (!isMain) subTotalCount++;

                        const actAttAll = allAtt.filter(r => r.activityId === act.id);
                        const actAttendance = actAttAll.filter(r => String(r.status || '').trim() !== 'วันหยุด');
                        const uniqueDates = [...new Set(actAttendance.map(r => r.date))];

                        if (uniqueDates.length === 0) {
                            hasIncomplete = true;
                            if (isMain) mainHasFailed = true;
                            else subFailedCount++;
                            return;
                        }

                        const actRecs = stRecsAll.filter(r => r.activityId === act.id && String(r.status || '').trim() !== 'วันหยุด');
                        let penaltyScore = 0;
                        let statsCheckCount = 0;

                        actRecs.forEach(r => {
                            let stName = String(r.status || '').trim();
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
                            } else {
                                statsCheckCount++;
                                penaltyScore += Number(weights['ขาด'] ?? 1);
                            }
                        });

                        const percent = statsCheckCount > 0 ? ((statsCheckCount - penaltyScore) / statsCheckCount) * 100 : 100;
                        const minP = act.minPercent || 80;
                        const isPassed = percent >= minP;

                        if (!isPassed) {
                            if (isMain) mainHasFailed = true;
                            else subFailedCount++;
                        }
                    });

                    const allowedSubFail = Math.ceil(subTotalCount * 0.10);
                    const subPassedCriteria = subFailedCount <= allowedSubFail;

                    if (semesterActivities.length === 0 || hasIncomplete || mainHasFailed || !subPassedCriteria) {
                        let reasons = [];
                        if (mainHasFailed) reasons.push("มผ กิจกรรมหลัก");
                        if (!subPassedCriteria) reasons.push("มผ กิจกรรมย่อย");

                        allFailedStudents.push({
                            id: st.id,
                            name: st.name,
                            className: className,
                            reason: reasons.join(", ") || "มผ ไม่ผ่านเกณฑ์"
                        });
                    }
                });
            }

            setReportData(allFailedStudents);
            toast.success(`ตรวจสอบเสร็จสิ้น พบผู้ไม่ผ่าน ${allFailedStudents.length} คน (ไม่รวมห้องทวิภาคี)`);
        } catch (e) {
            console.error(e);
            toast.error("เกิดข้อผิดพลาดในการประมวลผล");
        } finally {
            setIsLoading(false);
        }
    };

    const availableSemesters = systemConfig.semestersByYear?.[selectedYear] || ['1'];

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
                        background: #ffffff !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 1cm !important;
                    }
                    table { border-collapse: collapse !important; width: 100% !important; font-size: 13px !important; }
                    th, td { border: 1px solid #000000 !important; padding: 6px 8px !important; color: #000000 !important; }
                    th { background-color: #f3f4f6 !important; }
                    @page { size: A4 portrait; margin: 1cm; }
                }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">รายงานรายชื่อนักศึกษาไม่ผ่านกิจกรรม (มผ)</h1>
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl">← กลับ</button>
                </header>

                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ภาคเรียน</label>
                            <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white">
                                {availableSemesters.map(sem => <option key={sem} value={sem}>ภาคเรียนที่ {sem}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ปีการศึกษา</label>
                            <select value={selectedYear} onChange={e => handleYearChange(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white">
                                {academicYears.map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">เลือกห้องเรียน</label>
                            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white">
                                <option value="all">🌟 ทุกห้องเรียนในวิทยาลัย (ไม่รวมทวิภาคี)</option>
                                {classrooms.filter(c => !c.includes('ทวิภาคี')).map(c => <option key={c} value={c}>ห้อง {c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={generateFailedReport} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all">
                            {isLoading ? 'กำลังประมวลผลด่วน...' : '🔍 ตรวจสอบรายชื่อผู้ไม่ผ่าน'}
                        </button>
                        <button onClick={() => window.print()} disabled={!reportData || reportData.length === 0} className={`py-4 rounded-xl font-bold transition-all ${reportData && reportData.length > 0 ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-800 text-gray-500'}`}>
                            🖨️ พิมพ์รายงาน
                        </button>
                    </div>
                </div>
            </div>

            {reportData && (
                <div id="printable-area" className="mt-10 bg-white p-8 rounded-3xl text-black shadow-2xl max-w-4xl mx-auto">
                    <div className="flex items-center justify-center gap-6 mb-6 border-b pb-4">
                        <img src="/logo.png" className="w-16" alt="Logo" />
                        <div className="text-center">
                            <h2 className="text-xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                            <p className="text-sm font-semibold">รายชื่อนักศึกษาที่ไม่ผ่านเกณฑ์การประเมินกิจกรรม (ผลการประเมิน มผ)</p>
                            <p className="text-xs text-gray-600 mt-1">ภาคเรียนที่ {selectedSemester} ปีการศึกษา {selectedYear} (ไม่รวมห้องทวิภาคี)</p>
                        </div>
                    </div>

                    <div className="flex justify-between mb-4 font-bold text-sm">
                        <p>เงื่อนไข: {selectedClass === 'all' ? 'ทุกห้องเรียน (ยกเว้นทวิภาคี)' : `ห้อง ${selectedClass}`}</p>
                        <p>วันที่ออกรายงาน: {printDateStr}</p>
                    </div>

                    <table className="w-full border-collapse border border-black text-center text-sm mb-8" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2" style={{ width: '10%' }}>ลำดับ</th>
                                <th className="border border-black p-2" style={{ width: '38%' }}>ชื่อ - สกุล</th>
                                <th className="border border-black p-2" style={{ width: '22%' }}>ระดับชั้น / ห้อง</th>
                                <th className="border border-black p-2" style={{ width: '30%' }}>หมายเหตุ (ไม่ผ่าน)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? (
                                reportData.map((s, idx) => (
                                    <tr key={s.id}>
                                        <td className="border border-black p-2">{idx + 1}</td>
                                        <td className="border border-black p-2 text-left font-medium px-3">{s.name}</td>
                                        <td className="border border-black p-2">{s.className}</td>
                                        <td className="border border-black p-2 text-left text-red-600 font-semibold px-3">{s.reason}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="border border-black p-6 text-gray-500 font-semibold">🎉 ไม่พบรายชื่อนักศึกษาที่ไม่ผ่านเกณฑ์ (ผ่านกิจกรรมทั้งหมด)</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="flex justify-end text-center text-xs mt-12">
                        <div className="w-64">
                            <p>ลงชื่อ......................................................</p>
                            <p className="mt-1 font-semibold">(นายภวุฒิ มันเหมาะ)</p>
                            <p className="font-semibold">รองผู้อำนวยการฝ่ายกิจการนักเรียน นักศึกษา</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}