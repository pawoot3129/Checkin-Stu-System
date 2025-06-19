// src/app/dashboard/reports/page.js
'use client';

import { useRouter } from 'next/navigation';

const reportOptions = [
    {
        title: "รายงานสรุปประจำวัน",
        description: "ดูภาพรวมการเช็คชื่อ ขาด ลา มา สาย ของทั้งวิทยาลัย แยกตามระดับชั้นและห้องเรียนในวันที่เลือก",
        path: "/dashboard/reports/daily-summary",
        status: "พร้อมใช้งาน"
    },
    {
        title: "รายงานรายกิจกรรม",
        description: "ติดตามผลการเข้าร่วมและประเมินผลของแต่ละกิจกรรมที่จัดขึ้น",
        path: "/dashboard/reports/activity-summary",
        status: "พร้อมใช้งาน"
    },
    {
        title: "รายงานสรุปปลายเทอม",
        description: "สรุปผลการมาเรียนและการเข้าร่วมกิจกรรมทั้งหมดของนักเรียนแต่ละคนตลอดทั้งภาคการศึกษา",
        path: "/dashboard/reports/semester-summary", // แก้ไข path ที่นี่
        status: "พร้อมใช้งาน" // แก้ไข status ที่นี่
    }
];

export default function ReportsHubPage() {
    const router = useRouter();

    const handleNavigate = (path) => {
        if (path !== "#") {
            router.push(path);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">ศูนย์กลางรายงาน</h1>
                <button onClick={() => router.back()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md">
                    &larr; กลับ
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportOptions.map((report, index) => (
                    <div 
                        key={index}
                        className={`bg-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-lg transition-all duration-300 ${report.status !== 'พร้อมใช้งาน' ? 'opacity-50' : 'hover:ring-2 hover:ring-indigo-500 cursor-pointer'}`}
                        onClick={() => handleNavigate(report.path)}
                    >
                        <div>
                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-3 ${report.status === 'พร้อมใช้งาน' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-gray-900'}`}>
                                {report.status}
                            </span>
                            <h2 className="text-2xl font-bold mb-2">{report.title}</h2>
                            <p className="text-gray-400 text-sm">{report.description}</p>
                        </div>
                        <button
                            disabled={report.status !== 'พร้อมใช้งาน'}
                            className="w-full mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            เลือก
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
