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
    const [selectedYear, setSelectedYear] = useState('2569');
    const [selectedSemester, setSelectedSemester] = useState('1');
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                if (!snap.empty) {
                    const prof = snap.docs[0].data();
                    setUserProfile(prof);
                    const classSnap = await getDocs(collection(db, "classrooms"));
                    const classes = prof.role === 'admin' 
                        ? classSnap.docs.map(d => { const data = d.data(); return data.department ? `${data.className} ${data.department}` : data.className; })
                        : (prof.assignedClasses || []);
                    setClassrooms([...new Set(classes)].sort());
                    if (classes.length > 0) setSelectedClass(classes[0]);
                }
            } else { router.push('/'); }
        });
        return () => unsubscribe();
    }, [router]);

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
            
            // กรองสถานะจำหน่ายออกตั้งแต่ดึงข้อมูล
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
                const attSnap = await getDocs(query(collection(db, "attendance"), where("activityId", "in", actIds)));
                allAtt = attSnap.docs.map(d => d.data()).filter(r => studentIdsSet.has(String(r.studentId).trim()));
            }

            const processed = studentList.map(st => {
                const results = {};
                let hasIncomplete = false; 
                let hasFailed = false;     
                const stRecsAll = allAtt.filter(r => String(r.studentId).trim() === String(st.id).trim());

                semesterActivities.forEach(act => {
                    const actRecs = stRecsAll.filter(r => r.activityId === act.id);
                    const uniqueDates = [...new Set(allAtt.filter(r => r.activityId === act.id).map(r => r.date))];
                    const totalSessions = uniqueDates.length;

                    if (totalSessions === 0) {
                        results[act.id] = '-';
                        hasIncomplete = true;
                        return;
                    }

                    let penaltyScore = 0;
                    actRecs.forEach(r => {
                        let stName = String(r.status || '').trim();
                        if (stName === 'มา') {
                            penaltyScore += Number(weights['มา'] ?? 0);
                        } else if (stName === 'สาย') {
                            penaltyScore += Number(weights['สาย'] ?? 1);
                        } else if (stName.includes('ครึ่ง')) {
                            penaltyScore += Number(weights['ลาครึ่งวัน'] ?? 0.5);
                        } else if (stName.includes('ลา') || stName === 'ลาเต็ม' || stName === 'ลาทั้งวัน') {
                            penaltyScore += Number(weights['ลาทั้งวัน'] ?? 0.5);
                        } else if (stName === 'ขาด') {
                            penaltyScore += Number(weights['ขาด'] ?? 1);
                        } else {
                            penaltyScore += Number(weights['ขาด'] ?? 1);
                        }
                    });

                    const percent = ((totalSessions - penaltyScore) / totalSessions) * 100;
                    const minP = act.minPercent || 80;
                    const isPassed = percent >= minP;

                    results[act.id] = isPassed ? 'ผ' : 'มผ';
                    if (!isPassed) {
                        hasFailed = true;
                    }
                });

                let overall = 'ผ';
                if (semesterActivities.length === 0 || hasIncomplete || hasFailed) {
                    overall = 'มผ';
                }

                return { 
                    ...st, 
                    results, 
                    overall 
                };
            });

            setReportData({ 
                students: processed, 
                activities: semesterActivities, 
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

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <style jsx global>{`
                @media print { 
                    #non-printable { display: none !important; } 
                    #printable-area { display: block !important; color: black; background: white; width: 100% !important; margin: 0 !important; }
                    table { table-layout: fixed !important; width: 100% !important; font-size: 8px !important; }
                    th, td { padding: 2px !important; border: 1px solid black; overflow: hidden; word-wrap: break-word; }
                    @page { size: landscape; margin: 0.5cm; }
                }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold">รายงานสรุปผลกิจกรรม</h1><button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl">← กลับ</button></header>
                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ภาคเรียน</label>
                            <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800"><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option></select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ปีการศึกษา</label>
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">{['2569', '2570'].map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}</select>
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
                    <div className="flex items-center justify-center gap-6 mb-8 border-b pb-6">
                        <img src="/logo.png" className="w-20" alt="Logo" />
                        <div className="text-center">
                            <h2 className="text-2xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                            <p className="text-lg">รายงานสรุปผลการเข้าร่วมกิจกรรม ภาคเรียนที่ {selectedSemester}/{selectedYear}</p>
                        </div>
                    </div>
                    <div className="flex justify-between mb-4 font-bold">
                        <p>ห้อง: {selectedClass}</p>
                        <p>วันที่ออกรายงาน: {reportData.date}</p>
                    </div>
                    <table className="w-full border-collapse border border-black text-center text-sm mb-6" style={{ tableLayout: 'fixed' }}>
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-2 border border-black" style={{ width: '40px' }}>เลขที่</th>
                                <th className="p-2 border border-black">ชื่อ-นามสกุล</th>
                                {reportData.activities.map(a => <th key={a.id} className="p-2 border border-black">{a.activityName}</th>)}
                                <th className="p-2 border border-black" style={{ width: '50px' }}>สรุป</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.students.map((s, index) => (
                                <tr key={s.id}>
                                    {/* รันเลขที่ในตารางรายงานใหม่ต่อเนื่อง 1, 2, 3... */}
                                    <td className="p-2 border border-black">{index + 1}</td>
                                    <td className="p-2 border border-black text-left">{s.name}</td>
                                    {reportData.activities.map(a => (
                                        <td key={a.id} className="p-2 border border-black font-bold" style={{color: s.results[a.id] === 'มผ' ? 'red' : 'black'}}>
                                            {s.results[a.id]}
                                        </td>
                                    ))}
                                    <td className="p-2 border border-black font-bold" style={{color: s.overall === 'มผ' ? 'red' : 'black'}}>{s.overall}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-sm p-4 bg-gray-50 border rounded-lg mb-10">
                        <strong>หมายเหตุเกณฑ์ประเมิน:</strong>
                        <ul className="list-disc ml-5">
                            <li>ผลการเข้าร่วมแต่ละกิจกรรมต้องไม่ต่ำกว่า 80% จึงจะถือว่า "ผ่าน" (ผ)</li>
                            <li><strong>สรุปผลรวม:</strong> นักศึกษาต้องผ่าน "ทุกกิจกรรม" จึงจะถือว่ามีผลการประเมินรวมเป็น "ผ่าน" (ผ)</li>
                        </ul>
                    </div>
                    <div className="flex flex-row justify-between items-end mt-16 px-4 text-center text-xs">
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
}