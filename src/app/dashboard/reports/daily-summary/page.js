'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, query, doc, getDoc, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

const statKeys = ['totalM', 'totalF', 'totalSum', 'presentM', 'presentF', 'presentSum', 'absentM', 'absentF', 'absentSum'];

export default function DailySummaryPageFinal() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [academicYears, setAcademicYears] = useState(['2569']);
    const [reportData, setReportData] = useState(null);
    const [printMode, setPrintMode] = useState('merged');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            const docSnap = await getDoc(doc(db, "system_settings", "main_config"));
            if (docSnap.exists() && docSnap.data().academicYears) {
                setAcademicYears(docSnap.data().academicYears.sort().reverse());
            }
        };
        fetchSettings();
    }, []);

    const Signatures = () => (
        <div className="flex justify-around text-center mt-12 text-[11px] w-full">
            {[
                { n: "นางสาวสุพรรัตน์ ดำเพ็ง", p: "รองผู้อำนวยการฝ่ายบริหารงานทั่วไป" },
                { n: "ดร.ประชากร บริบูรณ์", p: "ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล" }
            ].map((s, i) => (
                <div key={i} className="w-[40%]">
                    <p className="mb-4">ลงชื่อ.........................................</p>
                    <p className="font-bold">({s.n})</p>
                    <p>{s.p}</p>
                </div>
            ))}
        </div>
    );

    const generateReport = async () => {
        setIsLoading(true);
        try {
            const actSnap = await getDocs(collection(db, "activities"));
            const activity = actSnap.docs.find(d => d.data().activityName?.includes("กิจกรรมเข้าแถว"));
            if (!activity) throw new Error("ไม่พบกิจกรรมเข้าแถวหน้าเสาธง");
            
            const studSnap = await getDocs(collection(db, "students"));
            const attSnap = await getDocs(collection(db, "attendance"));
            const attMap = {};
            attSnap.docs.forEach(d => {
                const data = d.data();
                if(data.date === selectedDate && data.activityId === activity.id) attMap[data.studentId] = data.status;
            });
            
            const classSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
            const summary = {};
            classSnap.docs.forEach(d => {
                const c = `${d.data().className} ${d.data().department || ''}`.trim();
                summary[c] = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            });
            
            studSnap.docs.forEach(doc => {
                const student = doc.data();
                if (student.status === "จำหน่าย" || !summary[student.classId]) return;
                const isMale = (student.gender || 'ชาย') === 'ชาย';
                const status = attMap[doc.id];
                const data = summary[student.classId];
                if (isMale) data.totalM++; else data.totalF++;
                data.totalSum++;
                if (status && ['มา', 'สาย', 'ลาครึ่งวัน', 'ลาทั้งวัน'].includes(status)) {
                    if (isMale) data.presentM++; else data.presentF++;
                    data.presentSum++;
                } else {
                    if (isMale) data.absentM++; else data.absentF++;
                    data.absentSum++;
                }
            });
            
            const povochorTotal = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            const povosorTotal = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            const grandTotal = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            
            Object.entries(summary).forEach(([id, data]) => {
                if (id.includes('ปวช')) statKeys.forEach(k => povochorTotal[k] += data[k]);
                else if (id.includes('ปวส')) statKeys.forEach(k => povosorTotal[k] += data[k]);
                statKeys.forEach(k => grandTotal[k] += data[k]);
            });
            setReportData({ summary, povochorTotal, povosorTotal, grandTotal });
            toast.success("สร้างรายงานสำเร็จ");
        } catch (e) { toast.error("Error: " + e.message); } finally { setIsLoading(false); }
    };

    const Header = ({ title }) => (
        <div className="text-center mb-6 flex flex-col items-center">
            <img src="/logo.png" className="w-16 mb-2" alt="Logo" />
            <h2 className="font-bold text-xl">{title}</h2>
            <p>วิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
            <p>ประจำวัน {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'full' })}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 12mm; }
                    #printable-area { width: 100% !important; color: black !important; background: white !important; }
                    .page-break { break-after: page !important; }
                    .print-table { width: 100% !important; border-collapse: collapse !important; }
                    .print-table th, .print-table td { padding: 4px !important; border: 1px solid black !important; font-size: 11px !important; }
                }
            `}</style>
            <Toaster />
            
            <div className="max-w-5xl mx-auto">
                <div className="no-print bg-gray-900 p-6 rounded-3xl mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-xl font-bold flex items-center gap-3">
                            <span className="text-indigo-500">📊</span>
                            รายงานสรุปสถิติประจำวัน
                        </h1>
                        <button onClick={() => router.back()} className="bg-gray-800 px-6 py-2 rounded-xl text-white hover:bg-gray-700 transition">← ย้อนกลับ</button>

                    </div>
                    <div className="flex flex-wrap items-end gap-6">
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-gray-950 p-3 rounded-xl border border-gray-800" />
                        <select value={printMode} onChange={e => setPrintMode(e.target.value)} className="bg-gray-950 p-3 rounded-xl border border-gray-800"><option value="merged">รวมหน้าเดียว</option><option value="separated">แยก ปวช/ปวส</option></select>
                        <button onClick={generateReport} className="bg-indigo-600 px-8 py-3 rounded-xl font-bold">สร้างรายงาน</button>
                        <button onClick={() => window.print()} className="bg-white text-black px-8 py-3 rounded-xl font-bold">พิมพ์เอกสาร</button>
                    </div>
                </div>

                {reportData && (
                    <div id="printable-area" className="bg-white text-black p-8 shadow-2xl">
                        {printMode === 'merged' ? (
                            <div className="w-full">
                                <Header title="สรุปสถิติประจำวัน" />
                                <table className="w-full border-collapse border border-black text-center print-table text-[11px] mb-8">
                                    <thead>
                                        <tr className="bg-gray-200"><th rowSpan="2" className="border border-black p-2">ระดับชั้น</th><th colSpan="3" className="border border-black p-1">จำนวน นศ ทั้งหมด</th><th colSpan="3" className="border border-black p-1">จำนวน นศ ที่มา</th><th colSpan="3" className="border border-black p-1">จำนวน นศ ที่ขาด</th></tr>
                                        <tr className="bg-gray-200">{[1,2,3].map((_, i) => <Fragment key={i}><th className="border border-black p-1">ช</th><th className="border border-black p-1">ญ</th><th className="border border-black p-1">รวม</th></Fragment>)}</tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(reportData.summary).filter(k => k.includes('ปวช')).sort().map(classId => (
                                            <tr key={classId}><td className="border border-black p-2 text-left">{classId}</td>{statKeys.map(k => <td key={k} className="border border-black">{reportData.summary[classId][k]}</td>)}</tr>
                                        ))}
                                        <tr className="bg-gray-100 font-bold"><td className="border border-black p-2 text-left">รวม ปวช.</td>{statKeys.map(k => <td key={k} className="border border-black">{reportData.povochorTotal[k]}</td>)}</tr>
                                        {Object.keys(reportData.summary).filter(k => k.includes('ปวส')).sort().map(classId => (
                                            <tr key={classId}><td className="border border-black p-2 text-left">{classId}</td>{statKeys.map(k => <td key={k} className="border border-black">{reportData.summary[classId][k]}</td>)}</tr>
                                        ))}
                                        <tr className="bg-gray-100 font-bold"><td className="border border-black p-2 text-left">รวม ปวส.</td>{statKeys.map(k => <td key={k} className="border border-black">{reportData.povosorTotal[k]}</td>)}</tr>
                                        <tr className="bg-green-100 font-bold"><td className="border border-black p-2 text-left">รวมทั้งสิ้น</td>{statKeys.map(k => <td key={k} className="border border-black">{reportData.grandTotal[k]}</td>)}</tr>
                                    </tbody>
                                </table>
                                <Signatures />
                            </div>
                        ) : (
                            ['ปวช', 'ปวส'].map((type, idx) => (
                                <div key={type} className={`w-full ${idx === 0 ? 'page-break' : ''}`}>
                                    <Header title={`สรุปสถิติประจำวัน (${type})`} />
                                    <table className="w-full border-collapse border border-black text-center print-table text-[11px] mb-8">
                                        <thead>
                                            <tr className="bg-gray-200"><th rowSpan="2" className="border border-black p-2">ระดับชั้น</th><th colSpan="3" className="border border-black p-1">จำนวน นศ ทั้งหมด</th><th colSpan="3" className="border border-black p-1">จำนวน นศ ที่มา</th><th colSpan="3" className="border border-black p-1">จำนวน นศ ที่ขาด</th></tr>
                                            <tr className="bg-gray-200">{[1,2,3].map((_, i) => <Fragment key={i}><th className="border border-black p-1">ช</th><th className="border border-black p-1">ญ</th><th className="border border-black p-1">รวม</th></Fragment>)}</tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(reportData.summary).filter(k => k.includes(type)).sort().map(classId => (
                                                <tr key={classId}><td className="border border-black p-2 text-left">{classId}</td>{statKeys.map(k => <td key={k} className="border border-black">{reportData.summary[classId][k]}</td>)}</tr>
                                            ))}
                                            <tr className="bg-gray-100 font-bold"><td className="border border-black p-2 text-left">รวม {type}.</td>{statKeys.map(k => <td key={k} className="border border-black">{type === 'ปวช' ? reportData.povochorTotal[k] : reportData.povosorTotal[k]}</td>)}</tr>
                                        </tbody>
                                    </table>
                                    <Signatures />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}