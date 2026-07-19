'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, where, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function ActivitiesPage() {
    const router = useRouter();
    const [activities, setActivities] = useState([]);
    const [years, setYears] = useState([]);
    const [semesters, setSemesters] = useState([]);
    
    // Form States
    const [name, setName] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [semester, setSemester] = useState('');
    const [minPercent, setMinPercent] = useState(80);
    const [lateAsAbsent, setLateAsAbsent] = useState(true);

    useEffect(() => {
        fetchSettingsAndActivities();
    }, [academicYear, semester]);

    const fetchSettingsAndActivities = async () => {
        // 1. ดึงปีและเทอมจาก main_config
        const configSnap = await getDoc(doc(db, "system_settings", "main_config"));
        if (configSnap.exists()) {
            const data = configSnap.data();
            setYears(data.academicYears || []);
            setSemesters(data.semesters || []);
            // ตั้งค่าเริ่มต้นถ้ายังไม่ได้เลือก
            if (!academicYear && data.academicYears?.length > 0) setAcademicYear(data.academicYears[0]);
        }

        // 2. ดึงกิจกรรมตามปี/เทอมที่เลือก
        if (academicYear && semester) {
            const q = query(
                collection(db, "activities"), 
                where("academicYear", "==", academicYear), 
                where("semester", "==", semester)
            );
            const snap = await getDocs(q);
            setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
            setActivities([]);
        }
    };

    const handleAdd = async () => {
        if (!name.trim() || !academicYear || !semester) return toast.error("กรุณากรอกข้อมูลให้ครบ");
        
        try {
            const activityRef = await addDoc(collection(db, "activities"), { 
                activityName: name.trim(), 
                academicYear, 
                semester 
            });
            
            await setDoc(doc(db, "evaluation_rules", activityRef.id), {
                minPercent: Number(minPercent),
                lateAsAbsent,
                leaveRatio: 0.5
            });

            setName('');
            fetchSettingsAndActivities();
            toast.success("บันทึกกิจกรรมเรียบร้อย");
        } catch (error) {
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("คุณต้องการลบกิจกรรมนี้ถาวรใช่หรือไม่?")) return;
        try {
            await deleteDoc(doc(db, "activities", id));
            await deleteDoc(doc(db, "evaluation_rules", id));
            fetchSettingsAndActivities();
            toast.success("ลบข้อมูลเรียบร้อย");
        } catch (error) {
            toast.error("ไม่สามารถลบได้");
        }
    };

    return (
        <div className="p-8 bg-gray-950 min-h-screen text-white">
            <Toaster position="top-center" />
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">รายการกิจกรรมและเงื่อนไข</h1>
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
                        ← ย้อนกลับ
                    </button>
                </header>
                
                {/* Form Section */}
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 space-y-4 mb-8">
                    <input 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="ระบุชื่อกิจกรรม" 
                        className="w-full p-4 bg-gray-800 rounded-xl border border-gray-700 outline-none focus:border-indigo-500" 
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="p-4 bg-gray-800 rounded-xl border border-gray-700">
                            {years.map(y => <option key={y} value={y}>ปีการศึกษา {y}</option>)}
                        </select>
                        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="p-4 bg-gray-800 rounded-xl border border-gray-700">
                            <option value="">-- เลือกภาคเรียน --</option>
                            {semesters.filter(s => s.year === academicYear).map(s => (
                                <option key={s.semester} value={s.semester}>ภาคเรียนที่ {s.semester}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
                        <label>เกณฑ์ขั้นต่ำ (%): 
                            <input type="number" value={minPercent} onChange={e => setMinPercent(e.target.value)} className="bg-gray-700 p-2 ml-2 rounded w-20 text-center"/>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={lateAsAbsent} onChange={e => setLateAsAbsent(e.target.checked)} className="w-5 h-5"/> สาย = ขาด
                        </label>
                    </div>
                    
                    <button onClick={handleAdd} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition">
                        บันทึกกิจกรรมและเงื่อนไข
                    </button>
                </div>

                {/* List Section */}
                <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
                    {activities.length > 0 ? activities.map(a => (
                        <div key={a.id} className="p-4 border-b border-gray-700 flex justify-between items-center hover:bg-gray-800 transition">
                            <div>
                                <span className="font-bold block">{a.activityName}</span>
                                <span className="text-xs text-gray-400">ปี {a.academicYear} | ภาค {a.semester}</span>
                            </div>
                            <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-300 font-bold px-4 py-2 border border-red-900 rounded-lg">ลบ</button>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-gray-500">ยังไม่มีกิจกรรมในรายการ</div>
                    )}
                </div>
            </div>
        </div>
    );
}