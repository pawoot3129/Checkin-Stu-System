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
                    const classSnap = await getDocs(collection(db, "classrooms"));
                    let classes = profile.role === 'admin' ? classSnap.docs.map(d => d.data().className) : (profile.assignedClasses || []);
                    setClassrooms([...new Set(classes)].sort());
                }
                const settingsSnap = await getDoc(doc(db, "system_settings", "main_config"));
                if (settingsSnap.exists()) {
                    const years = settingsSnap.data().academicYears || ['2569'];
                    setAcademicYears(years);
                    setSelectedYear(years[0]);
                }
                const actSnap = await getDocs(collection(db, "activities"));
                setAllActivities(actSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        };
        init();
    }, [router]);

    useEffect(() => { setReportData(null); }, [selectedYear, selectedSemester, selectedActivityId, selectedClass]);

    const handleGenerateReport = async () => {
        if (!selectedActivityId || !selectedClass) return toast.error("กรุณาเลือกกิจกรรมและห้องเรียน");
        setIsLoading(true);
        try {
            const weightSnap = await getDoc(doc(db, "system_settings", "evaluation_weights"));
            const weights = weightSnap.exists() ? weightSnap.data() : { 'มา': 0, 'สาย': 1, 'ลาครึ่งวัน': 0.5, 'ลาทั้งวัน': 0.5, 'ขาด': 1 };
            const sSnap = await getDocs(query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber")));
            const students = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(st => st.status !== "จำหน่าย"); 
            const aSnap = await getDocs(query(collection(db, "attendance"), where("activityId", "==", selectedActivityId)));
            const attendance = aSnap.docs.map(doc => doc.data());
            const uniqueDates = [...new Set(attendance.map(r => r.date))];
            const totalSessions = uniqueDates.length;
            
            const processed = students.map(st => {
                const recs = attendance.filter(r => r.studentId === st.id);
                const stats = { 'มา': 0, 'สาย': 0, 'ลาครึ่งวัน': 0, 'ลาทั้งวัน': 0, 'ขาด': 0 };
                let penaltyScore = 0;
                recs.forEach(r => { if (stats[r.status] !== undefined) stats[r.status]++; penaltyScore += (weights[r.status] || 0); });
                const percent = totalSessions > 0 ? ((totalSessions - penaltyScore) / totalSessions) * 100 : 0;
                return { ...st, stats, totalRecs: recs.length, percent: Math.max(0, percent).toFixed(0), result: percent >= 80 ? 'ผ่าน' : 'ไม่ผ่าน' };
            });

            setReportData({ 
                activityName: allActivities.find(a => a.id === selectedActivityId)?.activityName, 
                className: selectedClass, 
                students: processed,
                totalSessions,
                printDate: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
                advisorName: userProfile?.name || "..................................." 
            });
            toast.success("สร้างรายงานสำเร็จ");
        } catch (e) { toast.error("เกิดข้อผิดพลาด"); } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <style jsx global>{`
                @media print { 
                    #non-printable { display: none !important; } 
                    #printable-area { display: block !important; color: black !important; background: white !important; width: 100% !important; padding: 10px !important; }
                    @page { size: A4 portrait; margin: 1cm; }
                    table { font-size: 11px !important; }
                }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold">รายงานรายกิจกรรม</h1>
                    <button onClick={() => router.back()} className="bg-gray-800 px-6 py-2 rounded-xl transition hover:bg-gray-700">← กลับ</button>
                </header>
                
                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="p-3 bg-gray-950 rounded-xl border border-gray-800"><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option></select>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="p-3 bg-gray-950 rounded-xl border border-gray-800">{academicYears.map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}</select>
                    <select value={selectedActivityId} onChange={e => setSelectedActivityId(e.target.value)} className="md:col-span-2 p-3 bg-gray-950 rounded-xl border border-gray-800"><option value="">-- เลือกกิจกรรม --</option>{allActivities.filter(a => String(a.academicYear) === String(selectedYear) && String(a.semester) === String(selectedSemester)).map(a => <option key={a.id} value={a.id}>{a.activityName}</option>)}</select>
                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="md:col-span-2 p-3 bg-gray-950 rounded-xl border border-gray-800"><option value="">-- เลือกห้องเรียน --</option>{classrooms.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    
                    <div className="md:col-span-2 flex gap-4 pt-4 border-t border-gray-800">
                        <button onClick={handleGenerateReport} className="flex-1 py-4 bg-indigo-600 rounded-xl font-bold transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-500">สร้างรายงาน</button>
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
                            <p className="text-sm font-semibold">รายงานสรุปผลการเข้าร่วมกิจกรรม: {reportData.activityName}</p>
                        </div>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                        <p><strong>ห้อง:</strong> {reportData.className} | <strong>ภาคเรียนที่ {selectedSemester} / {selectedYear}</strong> | <strong>รวม {reportData.totalSessions} ครั้ง</strong></p>
                        <p><strong>วันที่ออกรายงาน:</strong> {reportData.printDate}</p>
                    </div>
                    <table className="w-full border-collapse border border-gray-400 text-center mb-6">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border p-1">เลขที่</th>
                                <th className="border p-1 text-left">ชื่อ-นามสกุล</th>
                                <th className="border p-1">รวมวัน</th>
                                <th className="border p-1">มา</th>
                                <th className="border p-1">สาย</th>
                                <th className="border p-1">ลาครึ่ง</th>
                                <th className="border p-1">ลาเต็ม</th>
                                <th className="border p-1">ขาด</th>
                                <th className="border p-1">ร้อยละ</th>
                                <th className="border p-1">ผล</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.students.map(s => (
                                <tr key={s.id}>
                                    <td className="border p-1">{s.studentNumber}</td>
                                    <td className="border p-1 text-left">{s.name}</td>
                                    <td className="border p-1 font-bold">{s.totalRecs}</td>
                                    <td className="border p-1">{s.stats.มา}</td>
                                    <td className="border p-1">{s.stats.สาย}</td>
                                    <td className="border p-1">{s.stats.ลาครึ่งวัน}</td>
                                    <td className="border p-1">{s.stats.ลาทั้งวัน}</td>
                                    <td className="border p-1">{s.stats.ขาด}</td>
                                    <td className="border p-1">{s.percent}%</td>
                                    <td className="border p-1 font-bold">{s.result}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-sm mb-10 p-3 bg-gray-50 rounded-lg"><strong>หมายเหตุ:</strong> เกณฑ์ประเมินกิจกรรมต้องไม่ต่ำกว่า 80% จึงจะถือว่า "ผ่าน"</div>
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