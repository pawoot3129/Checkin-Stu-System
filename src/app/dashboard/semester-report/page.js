// src/app/dashboard/semester-report/page.js (เวอร์ชันแก้ไข เรียกรูปจาก /public)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function SemesterReportPage() {
  const router = useRouter();
  const user = auth.currentUser;

  const [userProfile, setUserProfile] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  
  const [semesterInfo, setSemesterInfo] = useState({ name: "ภาคเรียนที่ 1 ปีการศึกษา 2568", startDate: '2025-05-16', endDate: '2025-09-30' });

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  // ดึงข้อมูลเริ่มต้นสำหรับใส่ใน Filter
  useEffect(() => {
    if (user) {
      const fetchInitialData = async () => {
        setIsLoading(true);
        const userQ = query(collection(db, 'users'), where('email', '==', user.email));
        const userSnapshot = await getDocs(userQ);
        if (!userSnapshot.empty) {
          const profile = userSnapshot.docs[0].data();
          setUserProfile(profile);

          let classList = [];
          if (profile.role === 'teacher') {
            classList = profile.assignedClasses.map(name => ({ id: name, fullName: name }));
          } else { 
            const classroomsQ = query(collection(db, "classrooms"), orderBy("className"), orderBy("department"));
            const classroomsSnapshot = await getDocs(classroomsQ);
            classList = classroomsSnapshot.docs.map(doc => ({ id: `${doc.data().className} ${doc.data().department}`, fullName: `${doc.data().className} ${doc.data().department}` }));
          }
          setClassrooms(classList);
          if (classList.length > 0) setSelectedClass(classList[0].id);
        } else { router.push('/'); }
        
        setIsLoading(false);
      };
      fetchInitialData();
    }
  }, [user, router]);

  // ฟังก์ชันหลักสำหรับสร้างรายงาน
  const handleGenerateReport = async () => {
    if (!selectedClass) {
      toast.error("กรุณาเลือกห้องเรียน");
      return;
    }
    setIsGenerating(true);
    const loadingToast = toast.loading('กำลังสร้างรายงานสรุปผล...');
    setReportData(null);

    try {
      const studentsQuery = query(collection(db, "students"), where("classId", "==", selectedClass), orderBy("studentNumber"));
      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const attendanceQuery = query(collection(db, "attendance"),
        where("classId", "==", selectedClass),
        where("date", ">=", semesterInfo.startDate),
        where("date", "<=", semesterInfo.endDate)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceData = attendanceSnapshot.docs.map(doc => doc.data());
      
      const activitiesQuery = query(collection(db, "activities"), orderBy("activityName"));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const allActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const results = students.map(student => {
        let passedActivitiesCount = 0;
        const activityResults = {};
        allActivities.forEach(activity => {
          const studentAttendanceForActivity = attendanceData.filter(
            att => att.studentId === student.id && att.activityId === activity.id
          );
          const allDatesForActivity = attendanceData.filter(att => att.activityId === activity.id);
          const totalSessions = [...new Set(allDatesForActivity.map(a => a.date))].length;
          if (totalSessions === 0) {
              activityResults[activity.id] = 'N/A';
              passedActivitiesCount++;
              return;
          }
          const presentCount = studentAttendanceForActivity.filter(att => att.status === 'มา').length;
          const lateCount = studentAttendanceForActivity.filter(att => att.status === 'สาย').length;
          const leaveCount = studentAttendanceForActivity.filter(att => att.status === 'ลา').length;
          const absentCount_actual = studentAttendanceForActivity.filter(att => att.status === 'ขาด').length;
          const absentFromLeave = Math.floor(leaveCount / 2);
          const totalAbsent = absentCount_actual + absentFromLeave + lateCount;
          const absentPercentage = totalSessions > 0 ? (totalAbsent / totalSessions) * 100 : 0;
          const passThreshold = activity.evaluationCriteria.passThreshold;
          const passed = (100 - absentPercentage) >= passThreshold;
          if (passed) { passedActivitiesCount++; }
          activityResults[activity.id] = passed;
        });
        const finalResult = passedActivitiesCount === allActivities.length;
        return { ...student, activityResults, finalResult };
      });
      setReportData({ results, activities: allActivities });
      toast.success('สร้างรายงานสำเร็จ!', { id: loadingToast });
    } catch(error) {
        console.error("Error generating report:", error);
        toast.error("เกิดข้อผิดพลาด: " + error.message, { id: loadingToast });
    }
    setIsGenerating(false);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      <header className="bg-gray-800 shadow print:hidden">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold">รายงานสรุปผลปลายภาคเรียน</h1>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm">กลับหน้าหลัก</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-gray-800 rounded-lg p-6 print:hidden">
          <h2 className="text-xl font-bold mb-4">ตัวกรองข้อมูล</h2>
          {isLoading ? <p>Loading...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label htmlFor="class-select" className="block text-sm font-medium mb-1 text-gray-300">เลือกห้องเรียน</label>
                <select id="class-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md">
                   <option value="">-- เลือกห้องเรียน --</option>
                  {classrooms.map((c) => (<option key={c.id} value={c.id}>{c.fullName}</option>))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleGenerateReport} disabled={isGenerating} className="w-full px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-md font-medium disabled:bg-gray-500">
                    {isGenerating ? 'กำลังสร้าง...' : 'สร้างรายงาน'}
                </button>
                <button onClick={() => window.print()} disabled={!reportData} className="w-full px-6 py-2 bg-sky-600 hover:bg-sky-700 rounded-md font-medium disabled:bg-gray-500">
                    พิมพ์
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white text-black rounded-lg p-8" id="print-area">
          <div className="hidden print:block mb-8">
            <header className="flex items-center justify-between border-b-2 border-black pb-4">
              <img src="/schoollogo.png" alt="School Logo" className="h-28 w-auto" />
              <div className="text-center">
                <h1 className="text-3xl font-bold">รายงานสรุปผลการเข้าร่วมกิจกรรม</h1>
                <h2 className="text-2xl">{semesterInfo.name}</h2>
              </div>
              <div className="w-28"></div>
            </header>
            <section className="my-8 text-xl"><p><span className="font-bold">ห้องเรียน:</span> {selectedClass}</p></section>
          </div>
            
          <h2 className="text-xl font-bold mb-4 text-gray-800 print:text-black">ผลการประเมิน</h2>
          {isGenerating ? <p className="text-center py-10 text-gray-500">Generating report...</p> : !reportData ? (
              <p className="text-gray-500 text-center py-10">กรุณาเลือกห้องเรียน แล้วกด "สร้างรายงาน"</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-base text-center border-collapse border border-slate-500">
                <thead className="bg-gray-200 text-black font-bold">
                  <tr className="h-48">
                    <th className="px-2 py-2 border border-gray-400 align-bottom">ลำดับที่</th>
                    <th className="px-4 py-2 border border-gray-400 text-left align-bottom">ชื่อ-นามสกุล</th>
                    {reportData.activities.map(act => (<th key={act.id} className="p-1 border border-gray-400" title={act.activityName}><div className="[writing-mode:vertical-rl] transform rotate-180 text-center mx-auto whitespace-nowrap">{act.activityName}</div></th>))}
                    <th className="px-4 py-2 border border-gray-400 align-bottom"><div className="[writing-mode:vertical-rl] transform rotate-180 text-center mx-auto whitespace-nowrap">สรุปผล</div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {reportData.results.map((student, index) => (
                    <tr key={student.id}>
                      <td className="border border-gray-400 p-2">{student.studentNumber || index + 1}</td>
                      <td className="px-4 py-2 border border-gray-400 text-left">{student.name}</td>
                      {reportData.activities.map(act => (<td key={act.id} className={`border border-gray-400 font-bold ${student.activityResults[act.id] === 'N/A' ? 'text-gray-400' : student.activityResults[act.id] ? 'text-green-600' : 'text-red-600'}`}>{student.activityResults[act.id] === 'N/A' ? '-' : student.activityResults[act.id] ? 'ผ่าน' : 'ไม่ผ่าน'}</td>))}
                      <td className={`border border-gray-400 font-bold ${student.finalResult ? 'text-green-600' : 'text-red-600'}`}>{student.finalResult ? 'ผ่าน' : 'ไม่ผ่าน'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
           <div className="hidden print:block">
              <footer className="mt-5 text-xl">
                 <div className="grid grid-cols-2 gap-10 pt-10">
                    <div className="mt-5 text-center">
                        <p className="mb-5">ลงชื่อ....................................................</p>
                        <p>(....................................................)</p>
                        <p>รองผู้อำนวยการฝ่ายกิจการนักเรียน นักศึกษา</p>
                    </div>
                    <div className="mt-5 text-center">
                        <p className="mb-5">ลงชื่อ....................................................</p>
                        <p>(....................................................)</p>
                        <p>รองผู้อำนวยการฝ่ายบริหารงานทั่วไป</p>
                    </div>
                </div>
                <div className="mt-5 text-center">
                    <p className="mb-5">ลงชื่อ....................................................</p>
                    <p>(....................................................)</p>
                    <p>ผู้อำนวยการวิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
                </div>
              </footer>
           </div>
        </div>
      </main>
    </div>
  );
}