// src/app/dashboard/daily-summary/page.js (เวอร์ชันสมบูรณ์)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function DailySummaryPage() {
  const router = useRouter();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // State ใหม่สำหรับภาคเรียนและปีการศึกษา
  const currentYear = new Date().getFullYear() + 543;
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [flagpoleActivityId, setFlagpoleActivityId] = useState('');

  // ดึงข้อมูลกิจกรรมหน้าเสาธง
  useEffect(() => {
    const fetchFlagpoleActivity = async () => {
      setIsLoading(true);
      const activityQuery = query(collection(db, "activities"), where("activityName", "==", "กิจกรรมเข้าแถวหน้าเสาธง"));
      const snapshot = await getDocs(activityQuery);
      if (!snapshot.empty) {
        setFlagpoleActivityId(snapshot.docs[0].id);
      } else {
        toast.error("ไม่พบ 'กิจกรรมเข้าแถวหน้าเสาธง' ในระบบ!");
      }
      setIsLoading(false);
    };
    fetchFlagpoleActivity();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedDate || !flagpoleActivityId) {
        toast.error("กรุณาเลือกวันที่ หรือไม่พบกิจกรรมหน้าเสาธง");
        return;
    }
    setIsGenerating(true);
    const loadingToast = toast.loading('กำลังสร้างรายงาน...');
    setReportData(null);

    try {
      const classroomsQuery = query(collection(db, "classrooms"), orderBy("className"), orderBy("department"));
      const classroomsSnapshot = await getDocs(classroomsQuery);
      const allClassrooms = classroomsSnapshot.docs.map(doc => `${doc.data().className} ${doc.data().department}`);

      const studentsSnapshot = await getDocs(collection(db, "students"));
      const allStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const attendanceQuery = query(
        collection(db, "attendance"), 
        where("date", "==", selectedDate),
        where("activityId", "==", flagpoleActivityId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceData = attendanceSnapshot.docs.map(doc => doc.data());
      
      const summaryByClass = {};
      allClassrooms.forEach(className => {
          summaryByClass[className] = {
            total: 0, present: 0, late: 0, leave: 0, absent: 0, notChecked: 0
          };
      });

      allStudents.forEach(student => {
        if (summaryByClass[student.classId]) {
          summaryByClass[student.classId].total++;
        }
      });
      
      attendanceData.forEach(att => {
        const student = allStudents.find(s => s.id === att.studentId);
        if (student && summaryByClass[student.classId]) {
          const classSummary = summaryByClass[student.classId];
          if (att.status === 'มา') classSummary.present++;
          else if (att.status === 'สาย') classSummary.late++;
          else if (att.status === 'ลา') classSummary.leave++;
          else if (att.status === 'ขาด') classSummary.absent++;
        }
      });

      Object.values(summaryByClass).forEach(summary => {
        summary.notChecked = summary.total - (summary.present + summary.late + summary.leave + summary.absent);
      });

      const povochor = Object.entries(summaryByClass).filter(([className]) => className.startsWith('ปวช'));
      const povosor = Object.entries(summaryByClass).filter(([className]) => className.startsWith('ปวส'));

      const calculateTotal = (dataEntries) => {
        return dataEntries.reduce((acc, [, summary]) => {
          acc.total += summary.total || 0;
          acc.present += summary.present || 0;
          acc.late += summary.late || 0;
          acc.leave += summary.leave || 0;
          acc.absent += summary.absent || 0;
          acc.notChecked += summary.notChecked || 0;
          return acc;
        }, { total: 0, present: 0, late: 0, leave: 0, absent: 0, notChecked: 0 });
      };
      
      const povochorTotal = calculateTotal(povochor);
      const povosorTotal = calculateTotal(povosor);
      const grandTotal = {
          total: povochorTotal.total + povosorTotal.total,
          present: povochorTotal.present + povosorTotal.present,
          late: povochorTotal.late + povosorTotal.late,
          leave: povochorTotal.leave + povosorTotal.leave,
          absent: povochorTotal.absent + povosorTotal.absent,
          notChecked: povochorTotal.notChecked + povosorTotal.notChecked,
      };

      setReportData({ povochor, povosor, povochorTotal, povosorTotal, grandTotal });
      toast.success("สร้างรายงานสำเร็จ!", { id: loadingToast });
    } catch (error) {
      console.error("Error generating daily summary:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้างรายงาน", { id: loadingToast });
    }
    setIsGenerating(false);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  
  return (
    <div className="bg-white text-black p-8 font-['TH_Sarabun_New']">
      <Toaster position="top-right" />
      <div className="w-[210mm] min-h-[297mm] mx-auto">
        <header className="flex items-center justify-between text-center border-b-2 border-black pb-4 mb-4">
            <img src="/schoollogo.png" alt="School Logo" className="h-28 w-auto" />
            <div>
                <h1 className="text-3xl font-bold">สรุปการเข้าร่วมกิจกรรมหน้าเสาธง</h1>
                <h2 className="text-2xl">วันที่ {formatDate(selectedDate)}</h2>
            </div>
            <div className="w-28"></div>
        </header>

        <div className="print:hidden flex items-end gap-4 mb-4">
            <div>
              <label htmlFor="date-select" className="block text-lg font-bold text-black mb-1">เลือกวันที่:</label>
              <input type="date" id="date-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 bg-gray-200 border border-gray-400 rounded-md text-black"/>
            </div>
            <button onClick={handleGenerateReport} disabled={isGenerating || isLoading} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-white font-bold disabled:bg-gray-400">
                {isGenerating ? 'กำลังโหลด...' : 'สร้างรายงาน'}
            </button>
             <button onClick={() => window.print()} className="px-6 py-2 bg-sky-600 hover:bg-sky-700 rounded-md text-white font-bold">พิมพ์</button>
             <button onClick={() => router.push('/dashboard')} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white font-bold">กลับหน้าหลัก</button>
        </div>

        {isGenerating && <p className="text-center py-10">กำลังสร้างรายงาน...</p>}
        
        {reportData && (
          <div className="space-y-8 text-xl">
            {reportData.povochor.length > 0 && (
            <section>
              <h3 className="text-2xl font-bold bg-gray-200 p-2 rounded-t-lg">ระดับประกาศนียบัตรวิชาชีพ (ปวช.)</h3>
              <table className="w-full border-collapse border border-slate-500">
                <thead className="bg-slate-200"><tr className="text-lg">
                  <th className="border border-slate-400 p-2 text-left">ห้องเรียน (จำนวนนักเรียน)</th>
                  <th className="border border-slate-400 p-2 w-[10%]">มา</th><th className="border border-slate-400 p-2 w-[10%]">สาย</th>
                  <th className="border border-slate-400 p-2 w-[10%]">ลา</th><th className="border border-slate-400 p-2 w-[10%]">ขาด</th>
                  <th className="border border-slate-400 p-2 w-[12%]">ยังไม่เช็ค</th><th className="border border-slate-400 p-2 w-[10%]">รวม</th>
                </tr></thead>
                <tbody>
                  {reportData.povochor.map(([className, summary]) => (
                    <tr key={className}><td className="border border-slate-400 p-2 text-left font-semibold">{`${className} (${summary.total} คน)`}</td>
                    <td className="border border-slate-400 p-2 text-center">{summary.present}</td><td className="border border-slate-400 p-2 text-center">{summary.late}</td>
                    <td className="border border-slate-400 p-2 text-center">{summary.leave}</td><td className="border border-slate-400 p-2 text-center">{summary.absent}</td>
                    <td className="border border-slate-400 p-2 text-center">{summary.notChecked}</td><td className="border border-slate-400 p-2 text-center">{summary.total}</td></tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-300 font-bold">
   <tr><td className="border border-slate-400 p-2 text-right">รวม ปวช. (จำนวน {reportData.povochorTotal.total} คน)</td>
   <td className="border border-slate-400 p-2 text-center">{reportData.povochorTotal.present}</td><td className="border border-slate-400 p-2 text-center">{reportData.povochorTotal.late}</td>
   <td className="border border-slate-400 p-2 text-center">{reportData.povochorTotal.leave}</td><td className="border border-slate-400 p-2 text-center">{reportData.povochorTotal.absent}</td>
   <td className="border border-slate-400 p-2 text-center">{reportData.povochorTotal.notChecked}</td><td className="border border-slate-400 p-2 text-center">{reportData.povochorTotal.total}</td></tr>
</tfoot>
              </table>
            </section>
            )}
            
            {reportData.povosor.length > 0 && (
            <section>
              <h3 className="text-2xl font-bold bg-gray-200 p-2 rounded-t-lg">ระดับประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)</h3>
              <table className="w-full border-collapse border border-slate-500">
                <thead className="bg-slate-200"><tr className="text-lg">
                  <th className="border border-slate-400 p-2 text-left">ห้องเรียน (จำนวนนักเรียน)</th>
                  <th className="border border-slate-400 p-2 w-[10%]">มา</th><th className="border border-slate-400 p-2 w-[10%]">สาย</th>
                  <th className="border border-slate-400 p-2 w-[10%]">ลา</th><th className="border border-slate-400 p-2 w-[10%]">ขาด</th>
                  <th className="border border-slate-400 p-2 w-[12%]">ยังไม่เช็ค</th><th className="border border-slate-400 p-2 w-[10%]">รวม</th>
                </tr></thead>
                <tbody>
                   {reportData.povosor.map(([className, summary]) => (
                    <tr key={className}><td className="border border-slate-400 p-2 text-left font-semibold">{`${className} (${summary.total} คน)`}</td>
                    <td className="border border-slate-400 p-2 text-center">{summary.present}</td><td className="border border-slate-400 p-2 text-center">{summary.late}</td>
                    <td className="border border-slate-400 p-2 text-center">{summary.leave}</td><td className="border border-slate-400 p-2 text-center">{summary.absent}</td>
                    <td className="border border-slate-400 p-2 text-center">{summary.notChecked}</td><td className="border border-slate-400 p-2 text-center">{summary.total}</td></tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-300 font-bold">
   <tr><td className="border border-slate-400 p-2 text-right">รวม ปวส. (จำนวน {reportData.povosorTotal.total} คน)</td>
   <td className="border border-slate-400 p-2 text-center">{reportData.povosorTotal.present}</td><td className="border border-slate-400 p-2 text-center">{reportData.povosorTotal.late}</td>
   <td className="border border-slate-400 p-2 text-center">{reportData.povosorTotal.leave}</td><td className="border border-slate-400 p-2 text-center">{reportData.povosorTotal.absent}</td>
   <td className="border border-slate-400 p-2 text-center">{reportData.povosorTotal.notChecked}</td><td className="border border-slate-400 p-2 text-center">{reportData.povosorTotal.total}</td></tr>
</tfoot>
              </table>
            </section>
            )}

                         <footer className="mt-5 text-xl">
                <div className="grid grid-cols-2 gap-10 pt-10">
                    <div className="mt-5 text-center">
                        <p className="mb-5">ลงชื่อ....................................................</p>
                        <p>(นายภวุฒิ มันเหมาะ)</p>
                        <p>รองผู้อำนวยการฝ่ายกิจการนักเรียน นักศึกษา</p>
                    </div>
                    <div className="mt-5 text-center">
                        <p className="mb-5">ลงชื่อ....................................................</p>
                        <p>(นางสาวสุพรรัตน์ ดำเพ็ง)</p>
                        <p>รองผู้อำนวยการฝ่ายบริหารงานทั่วไป</p>
                    </div>
                </div>
                <div className="mt-5 text-center">
                    <p className="mb-5">ลงชื่อ....................................................</p>
                    <p>(ดร.ประชากร บริบูรณ์)</p>
                    <p>ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}