'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, query, doc, getDoc, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

const statKeys = [
    'totalM', 'totalF', 'totalSum', 
    'presentM', 'presentF', 'presentSum', 
    'leaveM', 'leaveF', 'leaveSum', 
    'absentM', 'absentF', 'absentSum'
];

export default function DailySummaryPageFinal() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [academicYears, setAcademicYears] = useState(['2569']);
    const [reportData, setReportData] = useState(null);
    const [printMode, setPrintMode] = useState('merged');
    const [isLoading, setIsLoading] = useState(false);
    const [holidayNote, setHolidayNote] = useState('');

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
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginTop: '14px', fontSize: '11px', width: '100%' }}>
            {[
                { n: "นางสาวสุพรรัตน์ ดำเพ็ง", p: "รองผู้อำนวยการฝ่ายบริหารงานทั่วไป" },
                { n: "ดร.ประชากร บริบูรณ์", p: "ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล" }
            ].map((s, i) => (
                <div key={i} style={{ width: '40%' }}>
                    <p style={{ marginBottom: '6px' }}>ลงชื่อ.........................................</p>
                    <p style={{ fontWeight: 'bold' }}>({s.n})</p>
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
            let foundHoliday = '';

            attSnap.docs.forEach(d => {
                const data = d.data();
                if(data.date === selectedDate && data.activityId === activity.id) {
                    attMap[data.studentId] = data.status;
                    if (data.status === 'วันหยุด' && data.holidayNote) {
                        foundHoliday = data.holidayNote;
                    } else if (data.status === 'วันหยุด' && !foundHoliday) {
                        foundHoliday = 'วันหยุดราชการ / วันหยุดพิเศษ';
                    }
                }
            });

            setHolidayNote(foundHoliday);

            // ถ้าเป็นวันหยุด ไม่ต้องคำนวณสถิติตารางต่อ ให้เซ็ตข้อมูลเปล่าแต่มีสถานะวันหยุด
            if (foundHoliday) {
                setReportData({ isHoliday: true, holidayNote: foundHoliday });
                toast.success("สร้างรายงานสำเร็จ (วันหยุด)");
                setIsLoading(false);
                return;
            }
            
            const classSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
            const summary = {};
            classSnap.docs.forEach(d => {
                const c = `${d.data().className} ${d.data().department || ''}`.trim();
                summary[c] = { 
                    totalM: 0, totalF: 0, totalSum: 0, 
                    presentM: 0, presentF: 0, presentSum: 0, 
                    leaveM: 0, leaveF: 0, leaveSum: 0, 
                    absentM: 0, absentF: 0, absentSum: 0,
                    isInternshipOrDual: false
                };
            });
            
            const classStatuses = {};
            studSnap.docs.forEach(doc => {
                const student = doc.data();
                if (student.status === "จำหน่าย" || !summary[student.classId]) return;
                const status = attMap[doc.id];
                if (!classStatuses[student.classId]) classStatuses[student.classId] = [];
                if (status) classStatuses[student.classId].push(status);
            });

            Object.keys(summary).forEach(className => {
                const statuses = classStatuses[className] || [];
                const isSpecial = className.includes('ทวิภาคี') || 
                                  (statuses.length > 0 && statuses.every(s => s === 'ฝึกงาน' || s === 'ทวิภาคี'));
                summary[className].isInternshipOrDual = isSpecial;
            });

            studSnap.docs.forEach(doc => {
                const student = doc.data();
                if (student.status === "จำหน่าย" || !summary[student.classId]) return;
                const isMale = (student.gender || 'ชาย') === 'ชาย';
                const status = attMap[doc.id];
                const data = summary[student.classId];
                
                if (isMale) data.totalM++; else data.totalF++;
                data.totalSum++;

                if (data.isInternshipOrDual) {
                    if (isMale) data.presentM++; else data.presentF++;
                    data.presentSum++;
                } else {
                    if (['มา', 'สาย', 'ลาครึ่งวัน', 'ฝึกงาน', 'ทวิภาคี'].includes(status)) {
                        if (isMale) data.presentM++; else data.presentF++;
                        data.presentSum++;
                    } else if (status && (status.includes('ลา') || status === 'ลาเต็ม' || status === 'ลาทั้งวัน')) {
                        if (isMale) data.leaveM++; else data.leaveF++;
                        data.leaveSum++;
                    } else {
                        if (isMale) data.absentM++; else data.absentF++;
                        data.absentSum++;
                    }
                }
            });
            
            const povochorTotal = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, leaveM: 0, leaveF: 0, leaveSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            const povosorTotal = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, leaveM: 0, leaveF: 0, leaveSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            const grandTotal = { totalM: 0, totalF: 0, totalSum: 0, presentM: 0, presentF: 0, presentSum: 0, leaveM: 0, leaveF: 0, leaveSum: 0, absentM: 0, absentF: 0, absentSum: 0 };
            
            Object.entries(summary).forEach(([id, data]) => {
                if (id.includes('ปวช')) statKeys.forEach(k => povochorTotal[k] += data[k]);
                else if (id.includes('ปวส')) statKeys.forEach(k => povosorTotal[k] += data[k]);
                statKeys.forEach(k => grandTotal[k] += data[k]);
            });
            setReportData({ isHoliday: false, summary, povochorTotal, povosorTotal, grandTotal });
            toast.success("สร้างรายงานสำเร็จ");
        } catch (e) { toast.error("Error: " + e.message); } finally { setIsLoading(false); }
    };

    const Header = ({ title }) => (
        <div style={{ textAlign: 'center', marginBottom: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <img src="/logo.png" style={{ width: '42px', height: 'auto', marginBottom: '3px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} alt="Logo" />
            <h2 style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 2px 0', textAlign: 'center', width: '100%' }}>{title}</h2>
            <p style={{ fontSize: '11.5px', margin: '0 0 1px 0', textAlign: 'center', width: '100%' }}>วิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
            <p style={{ fontSize: '11.5px', margin: 0, textAlign: 'center', width: '100%' }}>ประจำวัน {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'full' })}</p>
        </div>
    );

    const renderTableRows = (typeFilter) => {
        return Object.keys(reportData.summary)
            .filter(k => typeFilter ? k.includes(typeFilter) : true)
            .sort()
            .map(classId => {
                const row = reportData.summary[classId];
                if (row.isInternshipOrDual) {
                    return (
                        <tr key={classId}>
                            <td className="border border-black p-1 text-left">{classId}</td>
                            <td className="border border-black p-0.5">{row.totalM}</td>
                            <td className="border border-black p-0.5">{row.totalF}</td>
                            <td className="border border-black p-0.5">{row.totalSum}</td>
                            <td colSpan="9" className="border border-black p-1 text-center font-semibold text-gray-800 bg-gray-50">
                                นักศึกษาระบบทวิภาคี / ออกฝึกประสบการณ์วิชาชีพ
                            </td>
                        </tr>
                    );
                }
                return (
                    <tr key={classId}>
                        <td className="border border-black p-1 text-left">{classId}</td>
                        {statKeys.map(k => <td key={k} className="border border-black p-0.5">{row[k]}</td>)}
                    </tr>
                );
            });
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    @page { size: A4 landscape; margin: 4mm; }
                    #printable-area { width: 100% !important; color: black !important; background: white !important; padding: 0 !important; }
                    .page-break { break-after: page !important; }
                    .print-table { width: 100% !important; border-collapse: collapse !important; }
                    .print-table th, .print-table td { padding: 1.5px 2px !important; border: 1px solid black !important; font-size: 9.5px !important; line-height: 1.05 !important; }
                }
            `}</style>
            <Toaster />
            
            <div className="max-w-6xl mx-auto">
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
                    <div id="printable-area" className="bg-white text-black p-6 shadow-2xl">
                        {reportData.isHoliday ? (
                            <div className="w-full flex flex-col justify-between" style={{ minHeight: '180px' }}>
                                <div>
                                    <Header title="สรุปสถิติประจำวัน" />
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', border: '2px dashed #cbd5e1', borderRadius: '12px', margin: '20px 0', backgroundColor: '#f8fafc' }}>
                                        <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#334155', marginBottom: '12px' }}>
                                            --- วันหยุด ---
                                        </h3>
                                        <p style={{ fontSize: '18px', color: '#475569', textAlign: 'center', fontWeight: '500' }}>
                                            {reportData.holidayNote}
                                        </p>
                                    </div>
                                </div>
                                <Signatures />
                            </div>
                        ) : (
                            printMode === 'merged' ? (
                                <div className="w-full">
                                    <Header title="สรุปสถิติประจำวัน" />
                                    <table className="w-full border-collapse border border-black text-center print-table text-[10px] mb-3">
                                        <thead>
                                            <tr className="bg-gray-200">
                                                <th rowSpan="2" className="border border-black p-1">ระดับชั้น</th>
                                                <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ทั้งหมด</th>
                                                <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ที่มา</th>
                                                <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ที่ลา</th>
                                                <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ที่ขาด</th>
                                            </tr>
                                            <tr className="bg-gray-200">{[1,2,3,4].map((_, i) => <Fragment key={i}><th className="border border-black p-0.5">ช</th><th className="border border-black p-0.5">ญ</th><th className="border border-black p-0.5">รวม</th></Fragment>)}</tr>
                                        </thead>
                                        <tbody>
                                            {renderTableRows('ปวช')}
                                            <tr className="bg-gray-100 font-bold"><td className="border border-black p-1 text-center">รวม ปวช.</td>{statKeys.map(k => <td key={k} className="border border-black p-0.5">{reportData.povochorTotal[k]}</td>)}</tr>
                                            {renderTableRows('ปวส')}
                                            <tr className="bg-gray-100 font-bold"><td className="border border-black p-1 text-center">รวม ปวส.</td>{statKeys.map(k => <td key={k} className="border border-black p-0.5">{reportData.povosorTotal[k]}</td>)}</tr>
                                            <tr className="bg-green-100 font-bold"><td className="border border-black p-1 text-center">รวมทั้งสิ้น</td>{statKeys.map(k => <td key={k} className="border border-black p-0.5">{reportData.grandTotal[k]}</td>)}</tr>
                                        </tbody>
                                    </table>
                                    <Signatures />
                                </div>
                            ) : (
                                ['ปวช', 'ปวส'].map((type, idx) => (
                                    <div key={type} className={`w-full ${idx === 0 ? 'page-break' : ''}`}>
                                        <Header title={`สรุปสถิติประจำวัน (${type})`} />
                                        <table className="w-full border-collapse border border-black text-center print-table text-[10px] mb-3">
                                            <thead>
                                                <tr className="bg-gray-200">
                                                    <th rowSpan="2" className="border border-black p-1">ระดับชั้น</th>
                                                    <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ทั้งหมด</th>
                                                    <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ที่มา</th>
                                                    <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ที่ลา</th>
                                                    <th colSpan="3" className="border border-black p-0.5">จำนวน นศ ที่ขาด</th>
                                                </tr>
                                                <tr className="bg-gray-200">{[1,2,3,4].map((_, i) => <Fragment key={i}><th className="border border-black p-0.5">ช</th><th className="border border-black p-0.5">ญ</th><th className="border border-black p-0.5">รวม</th></Fragment>)}</tr>
                                            </thead>
                                            <tbody>
                                                {renderTableRows(type)}
                                                <tr className="bg-gray-100 font-bold">
                                                    <td className="border border-black p-1 text-center">รวม {type}.</td>
                                                    {statKeys.map(k => (
                                                        <td key={k} className="border border-black p-0.5">
                                                            {type === 'ปวช' ? reportData.povochorTotal[k] : reportData.povosorTotal[k]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tbody>
                                        </table>
                                        <Signatures />
                                    </div>
                                ))
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}