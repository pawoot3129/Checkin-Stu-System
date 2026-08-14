'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, addDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function HomeVisitWrapper() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const q = query(collection(db, 'users'), where('email', '==', user.email));
                const snap = await getDocs(q);
                if (!snap.empty) setUserProfile(snap.docs[0].data());
                else router.push('/dashboard');
            } else router.push('/');
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    if (isLoading || !userProfile) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">กำลังโหลด...</div>;
    return <HomeVisitForm userProfile={userProfile} />;
}

function HomeVisitForm({ userProfile }) {
    const router = useRouter();
    const [classrooms, setClassrooms] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [headerInfo, setHeaderInfo] = useState({ 
        semester: '1', 
        year: '2569', 
        visitDate: new Date().toISOString().split('T')[0] 
    });

    const [formData, setFormData] = useState({ 
        fatherName: '', motherName: '', parentName: '', parentRelation: '', 
        address: '', fatherJob: '', fatherIncome: '', motherJob: '', 
        motherIncome: '', parentJob: '', parentIncome: '', houseType: '', 
        familyInfo: '', dailyTasks: '', studyProblems: '' 
    });

    useEffect(() => {
        const fetchClassesAndStudents = async () => {
            try {
                const allClassroomsSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
                const existingClassesMap = new Set(
                    allClassroomsSnap.docs.map(d => `${d.data().className} ${d.data().department || ''}`.trim())
                );

                let classes = [];
                if (userProfile.role === 'admin') {
                    classes = Array.from(existingClassesMap);
                } else {
                    const assigned = userProfile.assignedClasses || [];
                    classes = assigned.filter(c => existingClassesMap.has(c));
                }
                
                classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setClassrooms(classes);
                if (classes.length > 0) setSelectedClass(classes[0]);

                const studentSnap = await getDocs(collection(db, 'students'));
                setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0)));
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchClassesAndStudents();
    }, [userProfile]);

    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleHeaderChange = (e) => setHeaderInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleClear = () => {
        setFormData({ fatherName: '', motherName: '', parentName: '', parentRelation: '', address: '', fatherJob: '', fatherIncome: '', motherJob: '', motherIncome: '', parentJob: '', parentIncome: '', houseType: '', familyInfo: '', dailyTasks: '', studyProblems: '' });
        toast.success("ล้างข้อมูลเรียบร้อย");
    };

    const handleSave = async () => {
        if (!selectedStudent) return toast.error("กรุณาเลือกนักศึกษา");
        try {
            await addDoc(collection(db, 'home_visits'), { 
                studentId: selectedStudent.id, 
                studentName: selectedStudent.name, 
                className: selectedClass, 
                headerInfo, 
                ...formData 
            });
            toast.success("บันทึกข้อมูลเยี่ยมบ้านเรียบร้อย!");
        } catch (e) { 
            toast.error("บันทึกไม่สำเร็จ"); 
        }
    };

    const jobOptions = ["รับจ้าง", "ทำสวน", "ประมง", "เกษตรกรรม", "รับราชการ", "ลูกจ้างเอกชน", "ครู"];
    const relationOptions = ["บิดา", "มารดา", "ปู่", "ย่า", "ตา", "ยาย", "ลุง", "ป้า", "น้า", "อา", "ญาติ"];
    const houseTypeOptions = ["บ้านไม้ชั้นเดียว", "บ้านไม้สองชั้น", "บ้านปูนชั้นเดียว", "บ้านปูนสองชั้น", "บ้านกึ่งปึ่งกึ่งไม้"];
    const houseConditionOptions = ["บ้านมั่นคงแข็งแรงและสะอาด", "บ้านมั่นคงแข็งแรงแต่ไม่เป็นระเบียบ", "บ้านทรุดโทรมควรได้รับการซ่อมแซม", "บ้านอยู่ในพื้นที่เสี่ยง/ไม่ปลอดภัย"];

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6 print:bg-white print:text-black">
            <Toaster />
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    .no-print { display: none !important; }
                    .print-container { background-color: white !important; color: black !important; box-shadow: none !important; border: none !important; width: 100% !important; padding: 0 !important; }
                    .print-header-text { display: inline-block; min-width: 60px; border-bottom: 1px dotted #000; text-align: center; }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto bg-gray-900 border border-gray-800 p-10 rounded-3xl shadow-2xl print-container">
                <button onClick={() => router.back()} className="mb-6 text-gray-400 hover:text-white text-sm no-print transition">← ย้อนกลับ</button>
                
                <div className="text-center mb-8">
                    <img src="/logo.png" style={{ height: '50px', width: 'auto' }} className="mx-auto mb-3 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                    <h1 className="font-bold text-xl text-white print:text-black">แบบบันทึกการเยี่ยมบ้านนักเรียน</h1>
                    <div className="mt-4 flex justify-center gap-6 text-sm text-gray-300 print:text-black">
                        <span>ภาคเรียนที่: <input name="semester" onChange={handleHeaderChange} value={headerInfo.semester} className="w-12 text-center bg-gray-800 border-b border-dotted border-gray-600 print:bg-transparent print:border-black mx-1 rounded px-1" /></span>
                        <span>ปีการศึกษา: <input name="year" onChange={handleHeaderChange} value={headerInfo.year} className="w-16 text-center bg-gray-800 border-b border-dotted border-gray-600 print:bg-transparent print:border-black mx-1 rounded px-1" /></span>
                        <span>วันที่: <input type="date" name="visitDate" onChange={handleHeaderChange} value={headerInfo.visitDate} className="bg-gray-800 border-b border-dotted border-gray-600 print:bg-transparent print:border-black mx-1 rounded px-1" /></span>
                    </div>
                </div>

                {/* ส่วนเลือกห้องและนักเรียน */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 no-print bg-gray-950 p-4 rounded-2xl border border-gray-800">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">เลือกห้องเรียนในความดูแล</label>
                        <select className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm outline-none cursor-pointer" onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}>
                            <option value="">-- เลือกห้อง --</option>
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">เลือกนักศึกษา</label>
                        <select className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm outline-none cursor-pointer" value={selectedStudent ? selectedStudent.id : ''} onChange={(e) => setSelectedStudent(students.find(s => s.id === e.target.value))}>
                            <option value="">-- เลือกนักเรียน --</option>
                            {students.filter(s => s.classId === selectedClass && s.status !== "จำหน่าย").map(s => <option key={s.id} value={s.id}>{s.studentNumber}. {s.name}</option>)}
                        </select>
                    </div>
                </div>

                {selectedStudent ? (
                    <div className="border-t border-gray-800 print:border-slate-300 pt-6 space-y-4 text-sm">
                        <div className="p-4 bg-gray-950 print:bg-gray-100 rounded-2xl border border-gray-800 print:border-gray-300 font-bold text-indigo-400 print:text-black">
                            1. ชื่อนักศึกษา: {selectedStudent.name} &nbsp; 
                            <span className="font-normal text-gray-400 print:text-gray-600">(ห้อง: {selectedClass})</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">2. ชื่อบิดา:</span>
                            <input name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="md:col-span-2 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">3. ชื่อมารดา:</span>
                            <input name="motherName" value={formData.motherName} onChange={handleInputChange} className="md:col-span-2 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">4. ชื่อผู้ปกครอง:</span>
                            <input name="parentName" value={formData.parentName} onChange={handleInputChange} className="md:col-span-2 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black pl-4">เกี่ยวเป็น:</span>
                            <div className="md:col-span-2 flex gap-2">
                                <select onChange={(e) => setFormData(prev => ({ ...prev, parentRelation: e.target.value }))} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs outline-none no-print">
                                    <option value="">-- เลือก --</option>
                                    {relationOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <input name="parentRelation" value={formData.parentRelation} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">5. ที่อยู่บ้านนักศึกษา:</span>
                            <input name="address" value={formData.address} onChange={handleInputChange} className="md:col-span-2 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                        </div>

                        {/* อาชีพ... */}
                        {['father', 'mother', 'parent'].map((type, idx) => (
                            <div key={type} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                                <span className="font-bold text-gray-300 print:text-black">{6+idx}. อาชีพ{type === 'father' ? 'บิดา' : type === 'mother' ? 'มารดา' : 'ผู้ปกครอง'}:</span>
                                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="flex gap-2">
                                        <select onChange={(e) => setFormData(prev => ({ ...prev, [`${type}Job`]: e.target.value }))} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs outline-none no-print">
                                            <option value="">-- เลือกอาชีพ --</option>
                                            {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
                                        </select>
                                        <input name={`${type}Job`} value={formData[`${type}Job`]} onChange={handleInputChange} placeholder="ระบุอาชีพ" className="flex-1 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                                    </div>
                                    <input name={`${type}Income`} value={formData[`${type}Income`]} onChange={handleInputChange} placeholder="รายได้ (บาท/ปี)" className="p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">9. สภาพบ้าน:</span>
                            <div className="md:col-span-2 flex gap-2">
                                <select onChange={(e) => setFormData(prev => ({ ...prev, houseType: e.target.value }))} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs outline-none no-print">
                                    <option value="">-- เลือกสภาพบ้าน --</option>
                                    {houseConditionOptions.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <input name="houseType" value={formData.houseType} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">10. ลักษณะที่อยู่อาศัย:</span>
                            <div className="md:col-span-2 flex gap-2">
                                <select onChange={(e) => setFormData(prev => ({ ...prev, familyInfo: e.target.value }))} className="p-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs outline-none no-print">
                                    <option value="">-- เลือกประเภท --</option>
                                    {houseTypeOptions.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <input name="familyInfo" value={formData.familyInfo} onChange={handleInputChange} className="flex-1 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">11. ภาระงานในบ้านที่ช่วย:</span>
                            <input name="dailyTasks" value={formData.dailyTasks} onChange={handleInputChange} className="md:col-span-2 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <span className="font-bold text-gray-300 print:text-black">12. ปัญหาที่พบ:</span>
                            <input name="studyProblems" value={formData.studyProblems} onChange={handleInputChange} className="md:col-span-2 p-2.5 bg-gray-800 print:bg-transparent border border-gray-700 print:border-b print:border-t-0 print:border-x-0 rounded-xl outline-none text-sm" />
                        </div>
                        
                        <div className="mt-16 flex justify-end">
                            <div className="text-center w-64 text-sm">
                                <p className="mb-6">ลงชื่อ............................................. ครูที่ปรึกษา</p>
                                <p className="mb-1">(...................................................)</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10 no-print pt-4 border-t border-gray-800">
                            <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500 transition">บันทึกข้อมูล</button>
                            <button onClick={handleClear} className="bg-red-600/20 text-red-400 border border-red-900/50 py-3 px-6 rounded-xl font-bold hover:bg-red-600/30 transition">ล้าง</button>
                            <button onClick={() => window.print()} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-500 transition">พิมพ์</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-500 border border-dashed border-gray-800 rounded-2xl no-print">
                        💡 กรุณาเลือกห้องเรียนและนักศึกษาก่อนเริ่มกรอก
                    </div>
                )}
            </div>
        </div>
    );
}