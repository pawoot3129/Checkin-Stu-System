'use client';

import { useRouter } from 'next/navigation';

const reportOptions = [
    {
        title: "รายงานสรุปสถิติประจำวัน",
        description: "ดูภาพรวมแยกตามระดับชั้น/ห้องเรียนในวันที่เลือก",
        path: "/dashboard/reports/daily-summary",
        status: "พร้อมใช้งาน",
        gradient: "from-blue-500 to-indigo-600"
    },
    {
        title: "รายงานรายกิจกรรม",
        description: "ติดตามผลการเข้าร่วมและประเมินผลของแต่ละกิจกรรมที่จัดขึ้น",
        path: "/dashboard/reports/activity-summary",
        status: "พร้อมใช้งาน",
        gradient: "from-emerald-500 to-teal-600"
    },
    {
        title: "รายงานสรุปประจำเดือน",
        description: "สรุปผลสถิติการเข้าร่วมกิจกรรมและการมาเรียนรายเดือนของนักศึกษา",
        path: "/dashboard/reports/monthly-summary",
        status: "พร้อมใช้งาน",
        gradient: "from-blue-600 to-purple-600"
    },
    {
        title: "รายงานสรุปปลายเทอม",
        description: "สรุปผลการการเข้าร่วมกิจกรรมทั้งหมดของนักเรียนแต่ละคนตลอดทั้งปีการศึกษา",
        path: "/dashboard/reports/semester-summary",
        status: "พร้อมใช้งาน",
        gradient: "from-amber-500 to-orange-600"
    }
];

export default function ReportsHubPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-950 p-6 md:p-10">
            {/* ครอบเนื้อหาด้วย max-w-5xl เพื่อให้แคบและอยู่กึ่งกลาง */}
            <div className="max-w-5xl mx-auto">
                
                {/* Header */}
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <span className="text-indigo-500">📊</span>
                            ศูนย์กลางรายงาน
                        </h1>
                        <p className="text-gray-400 mt-2">เลือกประเภทรายงานที่คุณต้องการตรวจสอบข้อมูล</p>
                    </div>
                    <button 
                        onClick={() => router.back()} 
                        className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition font-semibold"
                    >
                        ← กลับ
                    </button>
                </header>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reportOptions.map((report) => (
                        <div 
                            key={report.path}
                            className="group bg-gray-900 border border-gray-800 p-8 rounded-3xl hover:border-gray-600 transition-all duration-300 hover:shadow-2xl flex flex-col justify-between"
                        >
                            <div>
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${report.gradient} mb-6 shadow-lg shadow-black/20`} />
                                <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 rounded-full mb-4">
                                    {report.status}
                                </span>
                                <h2 className="text-xl font-bold text-white mb-3">{report.title}</h2>
                                <p className="text-gray-400 text-sm leading-relaxed mb-8">{report.description}</p>
                            </div>
                            
                            <button
                                onClick={() => router.push(report.path)}
                                className="w-full py-3 bg-gray-800 group-hover:bg-white group-hover:text-gray-950 text-white rounded-xl font-bold transition-all duration-300"
                            >
                                เลือกรายงาน
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}