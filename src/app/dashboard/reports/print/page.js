// src/app/dashboard/reports/print/page.js (เวอร์ชันแก้ไข เรียกรูปจาก /public)
'use client';

import { useState, useEffect } from 'react';

export default function PrintReportPage() {
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    const savedData = localStorage.getItem('printData');
    if (savedData) {
      setPrintData(JSON.parse(savedData));
      const printTimeout = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(printTimeout);
    }
  }, []);

  if (!printData) {
    return <div className="p-8 text-center">กำลังโหลดข้อมูลสำหรับพิมพ์...</div>;
  }

  const { reportData, className, activityName, startDate, endDate } = printData;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white text-black p-8 font-['TH_Sarabun_New']">
      <div className="w-[190mm] min-h-[277mm] mx-auto">
        <header className="flex items-center justify-between border-b-2 border-black pb-4">
          {/* เรียกรูปภาพจากโฟลเดอร์ public โดยตรง */}
          <img src="/schoollogo.png" alt="School Logo" className="h-28 w-auto" />
          <div className="text-center">
            <h1 className="text-3xl font-bold">รายงานสรุปผลการเข้าร่วมกิจกรรม</h1>
            <h2 className="text-2xl font-bold">วิทยาลัยเทคโนโลยีเทคโนโลยีพณิชยการสิชล</h2>
          </div>
          <div className="w-28"></div>
        </header>
        
        <section className="my-8 text-2xl">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <p><span className="font-bold">กิจกรรม:</span> {activityName}</p>
            <p><span className="font-bold">ห้องเรียน:</span> {className}</p>
            <p><span className="font-bold">ตั้งแต่วันที่:</span> {formatDate(startDate)}</p>
            <p><span className="font-bold">ถึงวันที่:</span> {formatDate(endDate)}</p>
          </div>
        </section>
        
        <table className="w-full text-2xl border-collapse border border-slate-500">
           <thead className="bg-slate-200 font-bold">
                <tr>
                  <th className="border border-slate-400 p-2">ลำดับที่</th>
                  <th className="border border-slate-400 p-2 text-left">ชื่อ-นามสกุล</th>
                  <th className="border border-slate-400 p-2">มา</th>
                  <th className="border border-slate-400 p-2">สาย</th>
                  <th className="border border-slate-400 p-2">ลา</th>
                  <th className="border border-slate-400 p-2">ขาด</th>
                  <th className="border border-slate-400 p-2">ขาดรวม</th>
                  <th className="border border-slate-400 p-2">รวมจำนวนวันทั้งหมด</th>
                  <th className="border border-slate-400 p-2">% เข้าร่วม</th>
                  <th className="border border-slate-400 p-2">ผลการประเมิน</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((student) => (
                  <tr key={student.id}>
                    <td className="border border-slate-400 p-2 text-center">{student.studentNumber}</td>
                    <td className="border border-slate-400 p-2 text-left">{student.name}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.present}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.late}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.leave}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.absentCount_actual}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.absent}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.total}</td>
                    <td className="border border-slate-400 p-2 text-center">{student.percentage.toFixed(2)}%</td>
                    <td className={`border border-slate-400 p-2 text-center font-bold ${student.passed ? 'text-green-800' : 'text-red-700'}`}>
                      {student.passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                    </td>
                  </tr>
                ))}
              </tbody>
        </table>

    <footer className="mt-10">
    <div className="grid grid-cols-2 gap-10 text-center text-2xl pt-10">
        <div>
            {/* แก้ไขจาก mb-16 เป็น mb-8 */}
            <p className="mb-5">ลงชื่อ....................................................</p>
            <p>(....................................................)</p>
            <p>ครูที่ปรึกษา</p>
        </div>
        <div>
            {/* แก้ไขจาก mb-16 เป็น mb-8 */}
            <p className="mb-5">ลงชื่อ....................................................</p>
            <p>(....................................................)</p>
            <p>ฝ่ายกิจการนักเรียน นักศึกษา</p>
        </div>
    </div>
</footer>
      </div>
    </div>
  );
}