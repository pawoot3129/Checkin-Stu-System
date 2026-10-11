'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export default function AdvisorPage() {
    const router = useRouter();
    const [activities, setActivities] = useState([]);
    const [years, setYears] = useState([]);
    const [semestersByYear, setSemestersByYear] = useState({});
    
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const init = async () => {
            try {
                const configSnap = await getDoc(doc(db, "system_settings", "main_config"));
                if (configSnap.exists()) {
                    const data = configSnap.data();
                    const yList = data.academicYears || [];
                    setYears(yList);
                    setSemestersByYear(data.semestersByYear || {});
                    if (yList.length > 0) {
                        const defaultY = yList[0];
                        setSelectedYear(defaultY);
                        const sList = data.semestersByYear?.[defaultY] || [];
                        if (sList.length > 0) setSelectedSemester(sList[0]);
                    }
                }

                const querySnapshot = await getDocs(collection(db, "activities"));
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setActivities(data);
            } catch (error) {
                console.error("Error fetching data: ", error);
            }
        };
        init();
    }, []);

    const handleYearChange = (year) => {
        setSelectedYear(year);
        const sList = semestersByYear[year] || [];
        setSelectedSemester(sList.length > 0 ? sList[0] : '');
    };

    const handleStartCheck = (act) => {
        if (act.activityType === 'sub') {
            // แก้เส้นทางให้วิ่งไปที่ sub-check/[id] ให้ตรงกับโครงสร้างโฟลเดอร์
            router.push(`/dashboard/advisor/sub-check/${act.id}`);
        } else {
            router.push(`/dashboard/advisor/check/${act.id}`);
        }
    };

    const filteredActivities = activities.filter(act => {
        const matchYear = selectedYear ? String(act.academicYear) === String(selectedYear) : true;
        const matchSem = selectedSemester ? String(act.semester) === String(selectedSemester) : true;
        const matchTab = activeTab === 'all' ? true : (activeTab === 'sub' ? act.activityType === 'sub' : act.activityType !== 'sub');
        return matchYear && matchSem && matchTab;
    });

    const currentSemesters = semestersByYear[selectedYear] || [];

    return (
        <div className="min-h-screen bg-gray-950 p-6 flex flex-col items-center text-white">
            <div className="max-w-5xl w-full">
                <div className="w-full flex justify-end mb-6">
                    <button 
                        onClick={() => router.push('/dashboard')} 
                        className="bg-gray-800 px-4 py-2 rounded-xl text-white hover:bg-gray-700 transition"
                    >
                        ← ย้อนกลับ
                    </button>
                </div>

                <div className="text-center mb-8">
                    <div className="text-4xl mb-3">📝</div>
                    <h1 className="text-2xl font-bold mb-2">เลือกกิจกรรมที่ต้องการเช็คชื่อ</h1>
                    <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full"></div>
                </div>

                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 mb-8 space-y-4 shadow-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ปีการศึกษา</label>
                            <select 
                                value={selectedYear} 
                                onChange={(e) => handleYearChange(e.target.value)}
                                className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white"
                            >
                                {years.map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ภาคเรียน</label>
                            <select 
                                value={selectedSemester} 
                                onChange={(e) => setSelectedSemester(e.target.value)}
                                className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white"
                            >
                                <option value="">-- ทุกภาคเรียน --</option>
                                {currentSemesters.map(s => <option key={s} value={s}>ภาคเรียนที่ {s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-800">
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            ทั้งหมด
                        </button>
                        <button 
                            onClick={() => setActiveTab('main')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeTab === 'main' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            📌 กิจกรรมหลัก
                        </button>
                        <button 
                            onClick={() => setActiveTab('sub')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeTab === 'sub' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            ⚡ กิจกรรมย่อย
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredActivities.length > 0 ? (
                        filteredActivities.map((act) => (
                            <div key={act.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 hover:border-indigo-500 transition-all flex flex-col justify-between mx-auto w-full max-w-[240px]">
                                <div>
                                    <div className="mb-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${act.activityType === 'sub' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                                            {act.activityType === 'sub' ? '⚡ กิจกรรมย่อย' : '📌 กิจกรรมหลัก'}
                                        </span>
                                    </div>
                                    <h2 className="text-sm font-bold mb-1 line-clamp-2">{act.activityName}</h2>
                                    <p className="text-gray-500 text-[10px] mb-3">ปี {act.academicYear} | ภาค {act.semester}</p>
                                </div>
                                <button 
                                    onClick={() => handleStartCheck(act)}
                                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${act.activityType === 'sub' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                >
                                    เริ่มเช็คชื่อ
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-900/50 rounded-2xl border border-gray-800">
                            ไม่พบกิจกรรมในภาคเรียนหรือหมวดหมู่ที่เลือก
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}