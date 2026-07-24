'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

const monthsList = [
    { id: '01', name: 'เดือน มกราคม' },
    { id: '02', name: 'เดือน กุมภาพันธ์' },
    { id: '03', name: 'เดือน มีนาคม' },
    { id: '04', name: 'เดือน เมษายน' },
    { id: '05', name: 'เดือน พฤษภาคม' },
    { id: '06', name: 'เดือน มิถุนายน' },
    { id: '07', name: 'เดือน กรกฎาคม' },
    { id: '08', name: 'เดือน สิงหาคม' },
    { id: '09', name: 'เดือน กันยายน' },
    { id: '10', name: 'เดือน ตุลาคม' },
    { id: '11', name: 'เดือน พฤศจิกายน' },
    { id: '12', name: 'เดือน ธันวาคม' }
];

export default function MonthlySummaryPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [selectedYear, setSelectedYear] = useState('2569');
    const [selectedSemester, setSelectedSemester] = useState('1');
    const [selectedMonth, setSelectedMonth] = useState('01');
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

                    const classSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
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

                    classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    setClassrooms([...new Set(classes)]);
                    if (classes.length > 0) setSelectedClass(classes[0]);
                }
            } else { router.push('/'); }
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => { setReportData(null); }, [selectedYear, selectedSemester, selectedMonth, selectedClass]);

    const generateReport = async () => {
        if (!selectedClass) return toast.error("กรุณาเลือกห้องเรียน");
        setIsLoading(true);
        try {
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

            const attSnap = await getDocs(collection(db, "attendance"));
            const allAtt = attSnap.docs.map(d => d.data()).filter(r => studentIdsSet.has(String(r.studentId).trim()));

            const christYear = parseInt(selectedYear) - 543;
            const monthNum = parseInt(selectedMonth);
            const daysCount = new Date(christYear, monthNum, 0).getDate();

            const monthFilteredAtt = allAtt.filter(r => {
                if (!r.date) return false;
                const [y, m] = r.date.split('-');
                return parseInt(y) === christYear && m === selectedMonth;
            });

            const holidayDaysMap = {};
            monthFilteredAtt.forEach(r => {
                let stName = String(r.status || '').trim();
                if (stName === 'วันหยุด' && r.date) {
                    const dayNum = parseInt(r.date.split('-')[2]);
                    holidayDaysMap[dayNum] = r.holidayNote || 'วันหยุด';
                }
            });

            const isFewStudents = studentList.length <= 10;

            const processedStudents = studentList.map((st) => {
                const stRecs = monthFilteredAtt.filter(r => String(r.studentId).trim() === String(st.id).trim());
                const dailyStatus = {};
                let countPresent = 0; 
                let countEx = 0; 
                let countLeave = 0; 
                let countHalfLeave = 0;
                let countLate = 0; 

                for (let i = 1; i <= daysCount; i++) {
                    const dayStr = i < 10 ? `0${i}` : `${i}`;
                    const targetDateStr = `${christYear}-${selectedMonth}-${dayStr}`;
                    const rec = stRecs.find(r => r.date === targetDateStr);

                    if (holidayDaysMap[i]) {
                        dailyStatus[i] = { type: 'วันหยุด', text: holidayDaysMap[i] };
                    } else if (rec) {
                        let stName = String(rec.status || '').trim();
                        if (stName === 'มา') {
                            dailyStatus[i] = { type: 'มา', text: '/' };
                            countPresent++;
                        } else if (stName === 'สาย') {
                            dailyStatus[i] = { type: 'สาย', text: 'ส', hasCheck: true };
                            countLate++;
                            countPresent++;
                        } else if (stName === 'ฝึกงาน') {
                            dailyStatus[i] = { type: 'ฝึกงาน', text: 'ฝ', hasCheck: false };
                        } else if (stName === 'ทวิภาคี') {
                            dailyStatus[i] = { type: 'ทวิภาคี', text: 'ทวิ', hasCheck: false };
                        } else if (stName === 'ลาครึ่งวัน') {
                            dailyStatus[i] = { type: 'ลาครึ่งวัน', text: 'ล', hasCheck: true };
                            countHalfLeave++;
                        } else if (stName.includes('ครึ่ง') || stName.includes('ลา') || stName === 'ลาเต็ม' || stName === 'ลาทั้งวัน') {
                            dailyStatus[i] = { type: 'ลาเต็ม', text: 'ล', hasCheck: false };
                            countLeave++;
                        } else if (stName === 'ขาด') {
                            dailyStatus[i] = { type: 'ขาด', text: 'ข', hasCheck: false };
                            countEx++;
                        } else {
                            dailyStatus[i] = { type: 'ขาด', text: 'ข', hasCheck: false };
                            countEx++;
                        }
                    } else {
                        dailyStatus[i] = { type: 'empty', text: '' };
                    }
                }

                return {
                    ...st,
                    dailyStatus,
                    countPresent,
                    countEx,
                    countLeave,
                    countHalfLeave,
                    countLate
                };
            });

            const summaryDailyTotal = {};
            const summaryDailyPresent = {};
            const summaryDailyAbsent = {};
            const summaryDailyLeave = {};
            const summaryDailyHalfLeave = {};
            const summaryDailyLate = {};

            for (let i = 1; i <= daysCount; i++) {
                let p = 0, ab = 0, lv = 0, hlv = 0, lt = 0;
                let hasNormalCheck = false;
                let isHolidayDay = !!holidayDaysMap[i];

                processedStudents.forEach(st => {
                    const val = st.dailyStatus[i];
                    if (val && val.type !== 'empty') {
                        if (val.type === 'มา' || val.type === 'สาย' || val.type === 'ลา' || val.type === 'ลาครึ่งวัน' || val.type === 'ลาเต็ม' || val.type === 'ขาด') {
                            hasNormalCheck = true;
                        }
                        if (val.type === 'มา' || val.type === 'สาย') p++;
                        if (val.type === 'ขาด') ab++;
                        if (val.type === 'ลาเต็ม') lv++;
                        if (val.type === 'ลาครึ่งวัน') hlv++;
                        if (val.type === 'สาย') lt++;
                    }
                });

                summaryDailyTotal[i] = isHolidayDay ? '-' : ((hasNormalCheck || isHolidayDay) ? studentList.length : '-');
                summaryDailyPresent[i] = isHolidayDay ? '-' : (hasNormalCheck ? p : '-');
                summaryDailyAbsent[i] = isHolidayDay ? '-' : (hasNormalCheck ? ab : '-');
                summaryDailyLeave[i] = isHolidayDay ? '-' : (hasNormalCheck ? lv : '-');
                summaryDailyHalfLeave[i] = isHolidayDay ? '-' : (hasNormalCheck ? hlv : '-');
                summaryDailyLate[i] = isHolidayDay ? '-' : (hasNormalCheck ? lt : '-');
            }

            const monthObj = monthsList.find(m => m.id === selectedMonth);

            setReportData({
                students: processedStudents,
                monthName: monthObj ? monthObj.name : 'ประจำเดือน',
                daysCount,
                summaryDailyTotal,
                summaryDailyPresent,
                summaryDailyAbsent,
                summaryDailyLeave,
                summaryDailyHalfLeave,
                summaryDailyLate,
                holidayDaysMap,
                isFewStudents,
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
                    table { table-layout: auto !important; width: 100% !important; font-size: 8px !important; }
                    th.col-name, td.col-name { width: 180px !important; white-space: nowrap !important; }
                    th, td { padding: 1px !important; border: 1px solid black; vertical-align: middle; }
                    @page { size: landscape; margin: 0.5cm; }
                }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">รายงานสรุปประจำเดือน</h1>
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl">← กลับ</button>
                </header>
                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">เดือน</label>
                            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">
                                {monthsList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ปีการศึกษา</label>
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">
                                {['2569', '2570'].map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">เลือกห้องเรียน</label>
                            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800">
                                {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={generateReport} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all hover:scale-[1.02]">
                            {isLoading ? 'กำลังโหลด...' : 'สร้างรายงาน'}
                        </button>
                        <button onClick={() => window.print()} disabled={!reportData} className={`py-4 rounded-xl font-bold transition-all ${reportData ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]' : 'bg-gray-800 text-gray-500'}`}>
                            พิมพ์รายงาน
                        </button>
                    </div>
                </div>
            </div>

            {reportData && (
                <div id="printable-area" className="mt-10 bg-white p-10 rounded-3xl text-black shadow-2xl max-w-7xl mx-auto overflow-x-auto">
                    <div className="flex items-center justify-center gap-6 mb-2 border-b pb-4">
                        <img src="/logo.png" className="w-16" alt="Logo" />
                        <div className="text-center">
                            <h2 className="text-xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                            <p className="text-md">รายงานสถิติการมาเรียน {reportData.monthName} ปีการศึกษา {selectedYear} ห้อง {selectedClass}</p>
                        </div>
                    </div>
                    <div className="flex justify-end text-xs mb-4 font-semibold">
                        <p>วันที่ออกรายงาน: {reportData.date}</p>
                    </div>

                    <table className="w-full border-collapse border border-black text-center text-xs mb-8" style={{ tableLayout: 'auto' }}>
                        <thead>
                            <tr className="bg-gray-200">
                                <th rowSpan="2" className="border border-black p-1" style={{ width: '40px' }}>ลำดับ</th>
                                <th rowSpan="2" className="border border-black p-1 col-name" style={{ width: '180px', whiteSpace: 'nowrap' }}>ชื่อ - สกุล</th>
                                <th colSpan={reportData.daysCount} className="border border-black p-1">วันที่</th>
                                <th colSpan="5" className="border border-black p-1" style={{ width: '115px' }}>รวม</th>
                            </tr>
                            <tr className="bg-gray-100">
                                {Array.from({ length: reportData.daysCount }, (_, i) => (
                                    <th key={i + 1} className="border border-black p-0.5" style={{ width: '22px' }}>{i + 1}</th>
                                ))}
                                <th className="border border-black p-0.5">มา</th>
                                <th className="border border-black p-0.5">ข</th>
                                <th className="border border-black p-0.5">ล</th>
                                <th className="border border-black p-0.5">ล/ค</th>
                                <th className="border border-black p-0.5">ส</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.students.map((s, index) => {
                                const isFirstStudent = index === 0;
                                const totalStudents = reportData.students.length;

                                return (
                                    <tr key={s.id}>
                                        <td className="border border-black p-1">{index + 1}</td>
                                        <td className="border border-black p-1 text-left col-name" style={{ whiteSpace: 'nowrap', overflow: 'visible', paddingLeft: '8px' }}>{s.name}</td>
                                        {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(day => {
                                            const statusObj = s.dailyStatus[day];
                                            const isHoliday = !!reportData.holidayDaysMap[day];

                                            if (isHoliday) {
                                                if (isFirstStudent) {
                                                    let holidayText = reportData.holidayDaysMap[day];
                                                    
                                                    if (reportData.isFewStudents && holidayText.length > 8) {
                                                        holidayText = holidayText.substring(0, 8) + '..';
                                                    }

                                                    const fontSize = reportData.isFewStudents ? '8.5px' : (holidayText.length > 18 ? '9px' : holidayText.length > 10 ? '10.5px' : '12px');

                                                    return (
                                                        <td 
                                                            key={day} 
                                                            rowSpan={totalStudents} 
                                                            className="border border-black p-0.5 font-medium align-middle relative bg-red-50"
                                                            style={{ backgroundColor: '#fff5f5' }}
                                                        >
                                                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '2px', backgroundColor: '#dc2626', transform: 'translateX(-50%)', zIndex: 1 }}></div>
                                                            <div style={{ 
                                                                position: 'relative', 
                                                                zIndex: 2, 
                                                                writingMode: 'vertical-rl', 
                                                                textOrientation: 'mixed', 
                                                                fontSize: fontSize, 
                                                                fontWeight: 'bold', 
                                                                color: '#000000',
                                                                margin: '0 auto',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                height: '100%',
                                                                letterSpacing: '1px',
                                                                backgroundColor: '#ffffff',
                                                                padding: reportData.isFewStudents ? '2px 0' : '4px 0',
                                                                maxHeight: reportData.isFewStudents ? '120px' : 'none'
                                                            }}>
                                                                {holidayText}
                                                            </div>
                                                        </td>
                                                    );
                                                } else {
                                                    return null;
                                                }
                                            }

                                            return (
                                                <td key={day} className="border border-black p-0.5 font-medium align-middle" style={{ height: '22px' }}>
                                                    {statusObj && statusObj.type !== 'empty' ? (
                                                        statusObj.type === 'มา' ? (
                                                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{statusObj.text}</span>
                                                        ) : statusObj.type === 'ลาเต็ม' ? (
                                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626' }}>{statusObj.text}</span>
                                                        ) : statusObj.type === 'ลาครึ่งวัน' ? (
                                                            <div className="flex flex-col items-center justify-center leading-none" style={{ height: '20px' }}>
                                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#f97316', display: 'block' }}>{statusObj.text}</span>
                                                                <span style={{ fontSize: '10px', color: '#f97316', display: 'block', marginTop: '-1px' }}>✓</span>
                                                            </div>
                                                        ) : statusObj.type === 'สาย' ? (
                                                            <div className="flex flex-col items-center justify-center leading-none" style={{ height: '20px' }}>
                                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#d97706', display: 'block' }}>{statusObj.text}</span>
                                                                <span style={{ fontSize: '10px', color: '#d97706', display: 'block', marginTop: '-1px' }}>✓</span>
                                                            </div>
                                                        ) : statusObj.type === 'ขาด' ? (
                                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b91c1c' }}>{statusObj.text}</span>
                                                        ) : (
                                                            <span style={{ fontSize: statusObj.text === 'ทวิ' ? '7.5px' : '11px', fontWeight: 'bold' }}>{statusObj.text}</span>
                                                        )
                                                    ) : ''}
                                                </td>
                                            );
                                        })}
                                        <td className="border border-black p-0.5 text-green-700 font-bold">{s.countPresent > 0 ? s.countPresent : ''}</td>
                                        <td className="border border-black p-0.5 text-red-600 font-bold">{s.countEx > 0 ? s.countEx : ''}</td>
                                        <td className="border border-black p-0.5 text-red-600 font-bold">{s.countLeave > 0 ? s.countLeave : ''}</td>
                                        <td className="border border-black p-0.5 text-orange-600 font-bold">{s.countHalfLeave > 0 ? s.countHalfLeave : ''}</td>
                                        <td className="border border-black p-0.5 text-amber-600 font-bold">{s.countLate > 0 ? s.countLate : ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="font-bold text-sm mb-2">สรุปผล</div>
                    <table className="w-full border-collapse border border-black text-center text-xs mb-10" style={{ tableLayout: 'auto' }}>
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1 text-left pl-2" style={{ width: '220px' }}>วันที่</th>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <th key={d} className="border border-black p-0.5" style={{ width: '22px' }}>{d}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 text-left pl-2 font-semibold">จำนวนนักเรียน ทั้งหมด</td>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <td key={d} className="border border-black p-0.5">{reportData.summaryDailyTotal[d]}</td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-left pl-2 font-semibold">จำนวนนักเรียนที่มา</td>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <td key={d} className="border border-black p-0.5">{reportData.summaryDailyPresent[d]}</td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-left pl-2 font-semibold">จำนวนนักเรียนที่ขาด</td>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <td key={d} className="border border-black p-0.5 text-red-600">{reportData.summaryDailyAbsent[d]}</td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-left pl-2 font-semibold">จำนวนนักเรียนที่ลาเต็มวัน</td>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <td key={d} className="border border-black p-0.5 text-red-600">{reportData.summaryDailyLeave[d]}</td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-left pl-2 font-semibold">จำนวนนักเรียนที่ลาครึ่งวัน</td>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <td key={d} className="border border-black p-0.5 text-orange-600">{reportData.summaryDailyHalfLeave[d]}</td>
                                ))}
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-left pl-2 font-semibold">จำนวนนักเรียนที่สาย</td>
                                {Array.from({ length: reportData.daysCount }, (_, i) => i + 1).map(d => (
                                    <td key={d} className="border border-black p-0.5 text-amber-600">{reportData.summaryDailyLate[d]}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex justify-center mt-12 px-4 text-center text-xs">
                        <div className="w-64">
                            <p>ลงชื่อ......................................................</p>
                            <p className="mt-1">({reportData.advisor})</p>
                            <p className="font-semibold">ครูที่ปรึกษา</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}