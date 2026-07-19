'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AdvisorPage() {
    const router = useRouter();
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "activities"));
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setActivities(data);
            } catch (error) {
                console.error("Error fetching activities: ", error);
            }
        };
        fetchActivities();
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 p-6 flex flex-col items-center text-white">
            <div className="max-w-5xl w-full">
                
                {/* ปุ่มย้อนกลับ */}
                <div className="w-full flex justify-end mb-6">
                    <button 
                        onClick={() => router.push('/dashboard')} 
                        className="bg-gray-800 px-4 py-2 rounded-xl text-white hover:bg-gray-700 transition"
                    >
                        ← ย้อนกลับ
                    </button>
                </div>

                {/* ส่วนหัวที่เพิ่มสัญลักษณ์ */}
                <div className="text-center mb-10">
                    <div className="text-4xl mb-3">📝</div>
                    <h1 className="text-2xl font-bold mb-2">เลือกกิจกรรมที่ต้องการเช็คชื่อ</h1>
                    <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full"></div>
                </div>
                
                {/* รายการกิจกรรม (โครงสร้างเดิม) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {activities.map((act) => (
                        <div key={act.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 hover:border-indigo-500 transition-all flex flex-col justify-between mx-auto w-full max-w-[240px]">
                            <div>
                                <h2 className="text-sm font-bold mb-1 line-clamp-2">{act.activityName}</h2>
                                <p className="text-gray-500 text-[10px] mb-3">ปีการศึกษา {act.academicYear} | ภาคเรียนที่ {act.semester}</p>
                            </div>
                            <button 
                                onClick={() => router.push(`/dashboard/advisor/check/${act.id}`)}
                                className="w-full bg-indigo-600 py-2 rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all shadow-lg"
                            >
                                เริ่มเช็คชื่อ
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}