'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';
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
            
            const attQuery = query(
                collection(db, "attendance"),
                where("date", "==", selectedDate),
                where("activityId", "==", activity.id)
            );
            const attSnap = await getDocs(attQuery);
            
            const attMap = {};
            let holidayNoteFound = '';
            let totalCheckedCount = 0;
            let holidayStatusCount = 0;

            attSnap.docs.forEach(d => {
                const data = d.data();
                attMap[data.studentId] = data.status;
                totalCheckedCount++;
                if (data.status === 'วันหยุด') {
                    holidayStatusCount++;
                    if (data.holidayNote) {
                        holidayNoteFound = data.holidayNote;
                    }
                }
            });

            const isHolidayDay = holidayStatusCount > 0 && (holidayStatusCount >= totalCheckedCount * 0.5);

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
            
            const studSnap = await getDocs(collection(db, "students"));
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

            setReportData({ 
                isHoliday: isHolidayDay, 
                holidayNote: holidayNoteFound || 'วันหยุดราชการ / วันหยุดพิเศษ / ปิดสถานศึกษา',
                summary, povochorTotal, povosorTotal, grandTotal 
            });
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
                            <td className="border border-black p-0.5">{reportData.isHoliday ? '-' : row.totalM}</td>
                            <td className="border border-black p-0.5">{reportData.isHoliday ? '-' : row.totalF}</td>
                            <td className="border border-black p-0.5">{reportData.isHoliday ? '-' : row.totalSum}</td>
                            <td colSpan="9" className="border border-black p-1 text-center font-semibold text-gray-800 bg-gray-50">
                                {reportData.isHoliday ? '---' : 'นักศึกษาระบบทวิภาคี / ออกฝึกประสบการณ์วิชาชีพ'}
                            </td>
                        </tr>
                    );
                }
                return (
                    <tr key={classId}>
                        <td className="border border-black p-1 text-left">{classId}</td>
                        {statKeys.map(k => (
                            <td key={k} className="border border-black p-0.5">
                                {reportData.isHoliday ? '-' : row[k]}
                            </td>
                        ))}
                    </tr>
                );
            });
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <style jsx global>{`
                @media print {
                    body, html { background: white !important; color: black !important; }
                    .no-print { display: none !important; }
                    @page { size: A4 landscape; margin: 4mm; }
                    #printable-area { width: 100% !important; color: black !important; background: white !important; padding: 0 !important; box-shadow: none !important; }
                    .page-break { break-after: page !important; }
                    .print-table { width: 100% !important; border-collapse: collapse !important; }
                    /* ขยายขนาดตาราง ตัวอักษร และ padding ตามที่กำหนด */
                    .print-table th, .print-table td { padding: 4px 4px !important; border: 1px solid black !important; font-size: 11px !important; line-height: 1.2 !important; }
                }
            `}</style>
            
            <div className="no-print">
                <Toaster />
            </div>
            
            <div className="max-w-6xl mx-auto">
                <div className="no-print bg-gray-900 p-6 rounded-3xl mb-8 shadow-xl border border-gray-800">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-xl font-bold flex items-center gap-3">
                            <span className="text-indigo-500">📊</span>
                            รายงานสรุปสถิติประจำวัน
                        </h1>
                        <button onClick={() => router.back()} className="bg-gray-800 px-6 py-2 rounded-xl text-white hover:bg-gray-700 transition">← ย้อนกลับ</button>
                    </div>
                    <div className="flex flex-wrap items-end gap-6">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 font-medium">เลือกวันที่ต้องการดูรายงาน</label>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-gray-950 p-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 font-medium">รูปแบบการแสดงผล</label>
                            <select value={printMode} onChange={e => setPrintMode(e.target.value)} className="bg-gray-950 p-3 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition">
                                <option value="merged">รวมหน้าเดียว</option>
                                <option value="separated">แยก ปวช / ปวส</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={generateReport} 
                                disabled={isLoading}
                                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-7 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transform active:scale-95 transition disabled:opacity-50"
                            >
                                <span>{isLoading ? '⏳ กำลังประมวลผล...' : '🔍 สร้างรายงาน'}</span>
                            </button>
                            <button 
                                onClick={() => window.print()} 
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-7 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transform active:scale-95 transition"
                            >
                                <span>🖨️ พิมพ์เอกสาร</span>
                            </button>
                        </div>
                    </div>
                </div>

                {reportData && (
                    <div id="printable-area" className="bg-white text-black p-6 shadow-2xl relative">
                        {reportData.isHoliday && (
                            <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, width: '60%', backgroundColor: '#ffffff', border: '3px solid #1e293b', padding: '22px 28px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c', marginBottom: '6px', letterSpacing: '1px' }}>
                                    [ ประกาศวันหยุด / วันสำคัญ ]
                                </h3>
                                <p style={{ fontSize: '15px', color: '#0f172a', fontWeight: '600', margin: 0 }}>
                                    {reportData.holidayNote}
                                </p>
                            </div>
                        )}

                        {printMode === 'merged' ? (
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
                                        <tr className="bg-gray-100 font-bold"><td className="border border-black p-1 text-center">รวม ปวช.</td>{statKeys.map(k => <td key={k} className="border border-black p-0.5">{reportData.isHoliday ? '-' : reportData.povochorTotal[k]}</td>)}</tr>
                                        {renderTableRows('ปวส')}
                                        <tr className="bg-gray-100 font-bold"><td className="border border-black p-1 text-center">รวม ปวส.</td>{statKeys.map(k => <td key={k} className="border border-black p-0.5">{reportData.isHoliday ? '-' : reportData.povosorTotal[k]}</td>)}</tr>
                                        <tr className="bg-green-100 font-bold"><td className="border border-black p-1 text-center">รวมทั้งสิ้น</td>{statKeys.map(k => <td key={k} className="border border-black p-0.5">{reportData.isHoliday ? '-' : reportData.grandTotal[k]}</td>)}</tr>
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
                                                        {reportData.isHoliday ? '-' : (type === 'ปวช' ? reportData.povochorTotal[k] : reportData.povosorTotal[k])}
                                                    </td>
                                                ))}
                                            </tr>
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