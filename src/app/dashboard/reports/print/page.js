// src/app/dashboard/reports/print/page.js (เวอร์ชันแก้ไขแบ่งหน้าละ 20 คน)
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

  // ฟังก์ชันตัดแบ่งรายชื่อนักเรียนออกเป็นกลุ่ม หน้าละ 20 คน
  const chunkStudents = (students, size = 20) => {
    const chunks = [];
    for (let i = 0; i < students.length; i += size) {
      chunks.push(students.slice(i, i + size));
    }
    return chunks;
  };

  const studentPages = chunkStudents(reportData, 20);

  return (
    <div className="bg-white text-black p-8 font-['TH_Sarabun_New']">
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .print-page { page-break-after: always; break-after: page; min-height: 277mm; display: flex; flex-direction: column; justify-content: space-between; }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
          @page { size: A4 portrait; margin: 1cm; }
        }
      `}</style>

      {studentPages.map((pageStudents, pageIndex) => {
        const isLastPage = pageIndex === studentPages.length - 1;
        const startIndex = pageIndex * 20;

        return (
          <div key={pageIndex} className="print-page w-[190mm] min-h-[277mm] mx-auto mb-10 pb-6">
            <div>
              <header className="flex items-center justify-between border-b-2 border-black pb-4">
                <img src="/schoollogo.png" alt="School Logo" className="h-28 w-auto" />
                <div className="text-center">
                  <h1 className="text-3xl font-bold">รายงานสรุปผลการเข้าร่วมกิจกรรม</h1>
                  <h2 className="text-2xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                  <p className="text-lg">({pageIndex + 1}/{studentPages.length})</p>
                </div>
                <div className="w-28"></div>
              </header>
              
              <section className="my-6 text-2xl">
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
                    {pageStudents.map((student, idx) => {
                      const actualNumber = startIndex + idx + 1;
                      return (
                        <tr key={student.id || idx}>
                          <td className="border border-slate-400 p-2 text-center">{actualNumber}</td>
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
                      );
                    })}
                  </tbody>
              </table>
            </div>

            {isLastPage && (
              <footer className="mt-10">
                <div className="grid grid-cols-2 gap-10 text-center text-2xl pt-10">
                    <div>
                        <p className="mb-5">ลงชื่อ....................................................</p>
                        <p>(....................................................)</p>
                        <p>ครูที่ปรึกษา</p>
                    </div>
                    <div>
                        <p className="mb-5">ลงชื่อ....................................................</p>
                        <p>(....................................................)</p>
                        <p>ฝ่ายกิจการนักเรียน นักศึกษา</p>
                    </div>
                </div>
              </footer>
            )}
          </div>
        );
      })}
    </div>
  );
}