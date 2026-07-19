'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';
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
            const acts = await getDocs(query(collection(db, "activities"), where("academicYear", "==", selectedYear), where("semester", "==", selectedSemester)));
            const semesterActivities = acts.docs.map(d => ({ id: d.id, ...d.data() }));
            const studs = await getDocs(query(collection(db, "students"), where("classId", "==", selectedClass)));
            const studentList = studs.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== "จำหน่าย").sort((a, b) => a.studentNumber - b.studentNumber);

            const actIds = semesterActivities.map(a => a.id);
            let allAtt = [];
            if (actIds.length > 0) {
                const attSnap = await getDocs(query(collection(db, "attendance"), where("activityId", "in", actIds)));
                allAtt = attSnap.docs.map(d => d.data());
            }

            const processed = studentList.map(st => {
                const results = {};
                let passedCount = 0;
                semesterActivities.forEach(act => {
                    const recs = allAtt.filter(r => r.studentId === st.id && r.activityId === act.id);
                    const dates = [...new Set(allAtt.filter(r => r.activityId === act.id).map(r => r.date))];
                    const attended = recs.filter(r => r.status === 'มา').length;
                    const effectiveAttended = attended - recs.filter(r => r.status === 'สาย').length - (recs.filter(r => r.status === 'ลา').length / 2);
                    const percent = dates.length > 0 ? (effectiveAttended / dates.length) * 100 : 0;
                    const isPassed = percent >= (act.minPercent || 80);
                    results[act.id] = isPassed ? 'ผ' : 'มผ';
                    if (isPassed) passedCount++;
                });
                return { ...st, results, overall: passedCount === semesterActivities.length ? 'ผ' : 'มผ' };
            });

            setReportData({ students: processed, activities: semesterActivities, date: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }), advisor: userProfile.name });
            toast.success("สร้างรายงานสำเร็จ");
        } catch (e) { toast.error("เกิดข้อผิดพลาด"); } finally { setIsLoading(false); }
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
                        <button onClick={generateReport} className="bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all hover:scale-[1.02]">สร้างรายงาน</button>
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
                        <thead className="bg-gray-200"><tr><th className="p-2 border border-black" style={{ width: '40px' }}>เลขที่</th><th className="p-2 border border-black">ชื่อ-นามสกุล</th>{reportData.activities.map(a => <th key={a.id} className="p-2 border border-black">{a.activityName}</th>)}<th className="p-2 border border-black" style={{ width: '50px' }}>สรุป</th></tr></thead>
                        <tbody>{reportData.students.map(s => <tr key={s.id}><td className="p-2 border border-black">{s.studentNumber}</td><td className="p-2 border border-black text-left">{s.name}</td>{reportData.activities.map(a => <td key={a.id} className="p-2 border border-black font-bold" style={{color: s.results[a.id] === 'มผ' ? 'red' : 'black'}}>{s.results[a.id]}</td>)}<td className="p-2 border border-black font-bold">{s.overall}</td></tr>)}</tbody>
                    </table>
                    <div className="text-sm p-4 bg-gray-50 border rounded-lg mb-10">
                        <strong>หมายเหตุเกณฑ์ประเมิน:</strong>
                        <ul className="list-disc ml-5">
                            <li>ผลการเข้าร่วมแต่ละกิจกรรมต้องไม่ต่ำกว่า 80% จึงจะถือว่า "ผ่าน" (ผ)</li>
                            <li><strong>สรุปผลรวม:</strong> นักศึกษาต้องผ่าน "ทุกกิจกรรม" จึงจะถือว่ามีผลการประเมินรวมเป็น "ผ่าน" (ผ)</li>
                        </ul>
                    </div>
                    <div className="flex justify-between mt-12 px-10">
                        <div className="text-center"><p>ลงชื่อ..................................ครูที่ปรึกษา</p><p className="mt-2">({reportData.advisor})</p></div>
                        <div className="text-center"><p>ลงชื่อ..................................รองผู้อำนวยการฯ</p><p className="mt-2">(นายภวุฒิ มันเหมาะ)</p></div>
                    </div>
                </div>
            )}
        </div>
    );
}