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
    const [imagePreviews, setImagePreviews] = useState([]); 
    
    const [headerInfo, setHeaderInfo] = useState({ 
        semester: '1', 
        year: '2569', 
        visitDate: new Date().toISOString().split('T')[0] 
    });

    const [formData, setFormData] = useState({ 
        houseNumber: '', moo: '', soi: '', road: '', tumbon: '', amphur: '', province: '', zipcode: '',
        studentPhone: '', studentEmail: '',
        fatherName: '', fatherAge: '', fatherJob: '', fatherIncome: '', fatherWorkplace: '', fatherPhone: '',
        motherName: '', motherAge: '', motherJob: '', motherIncome: '', motherWorkplace: '', motherPhone: '',
        parentName: '', parentAge: '', parentJob: '', parentIncome: '', parentWorkplace: '', parentPhone: '', parentRelation: '',
        siblingsStudying: '', siblingsWorking: '', otherSiblingsStudying: '', otherSiblingsWorking: '',
        livingWith: 'บิดามารดา', livingWithOther: '',
        familyStatus: 'อยู่ด้วยกัน',
        houseType: 'บ้านของตนเอง', houseTypeOther: '',
        distance: '1 - 5 กิโลเมตร',
        transportation: 'รถจักรยานยนต์', transportationOther: '',
        environment: 'ดี',
        relationship: 'อบอุ่น',
        parentingStyle: 'ใช้เหตุผล', parentingStyleOther: '',
        closeWith: 'บิดา', closeWithOther: '',
        economy: 'ฐานะปานกลาง',
        helpNeeded: '',
        teacherComment: ''
    });

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const previews = files.map(file => URL.createObjectURL(file));
        setImagePreviews(previews);
    };

    useEffect(() => {
        const fetchClassesAndStudents = async () => {
            try {
                const allClassroomsSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
                const existingClassesMap = new Set(
                    allClassroomsSnap.docs.map(d => `${d.data().className} ${d.data().department || ''}`.trim())
                );
                let classes = userProfile.role === 'admin' ? Array.from(existingClassesMap) : (userProfile.assignedClasses || []).filter(c => existingClassesMap.has(c));
                classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setClassrooms(classes);
                if (classes.length > 0) setSelectedClass(classes[0]);

                const studentSnap = await getDocs(collection(db, 'students'));
                setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0)));
            } catch (error) { console.error("Error fetching data:", error); }
        };
        fetchClassesAndStudents();
    }, [userProfile]);

    const handleStudentSelect = (studentId) => {
        const student = students.find(s => s.id === studentId);
        setSelectedStudent(student || null);
        if (student) {
            setFormData(prev => ({
                ...prev,
                address: student.address || '',
                houseNumber: student.houseNumber || student.address || '',
                studentPhone: student.phone || student.studentPhone || student.tel || ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                address: '',
                houseNumber: '',
                studentPhone: ''
            }));
        }
    };

    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleIncomeChange = (e) => {
        const { name, value } = e.target;
        const numericValue = value.replace(/[^0-9]/g, '');
        const formattedValue = numericValue ? Number(numericValue).toLocaleString('en-US') : '';
        setFormData(prev => ({ ...prev, [name]: formattedValue }));
    };

    const handleHeaderChange = (e) => setHeaderInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    const handleClear = () => {
        setFormData({ 
            houseNumber: selectedStudent?.address || '', moo: '', soi: '', road: '', tumbon: '', amphur: '', province: '', zipcode: '',
            studentPhone: selectedStudent?.phone || '', studentEmail: '',
            fatherName: '', fatherAge: '', fatherJob: '', fatherIncome: '', fatherWorkplace: '', fatherPhone: '',
            motherName: '', motherAge: '', motherJob: '', motherIncome: '', motherWorkplace: '', motherPhone: '',
            parentName: '', parentAge: '', parentJob: '', parentIncome: '', parentWorkplace: '', parentPhone: '', parentRelation: '',
            siblingsStudying: '', siblingsWorking: '', otherSiblingsStudying: '', otherSiblingsWorking: '',
            livingWith: 'บิดามารดา', livingWithOther: '',
            familyStatus: 'อยู่ด้วยกัน',
            houseType: 'บ้านของตนเอง', houseTypeOther: '',
            distance: '1 - 5 กิโลเมตร',
            transportation: 'รถจักรยานยนต์', transportationOther: '',
            environment: 'ดี',
            relationship: 'อบอุ่น',
            parentingStyle: 'ใช้เหตุผล', parentingStyleOther: '',
            closeWith: 'บิดา', closeWithOther: '',
            economy: 'ฐานะปานกลาง',
            helpNeeded: '',
            teacherComment: ''
        });
        setImagePreviews([]);
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

    const jobOptions = [
        "ค้าขาย",
        "รับจ้าง",
        "ประมง",
        "ทำสวน/ทำไร่",
        "ข้าราชการ (ครู, ตำรวจ, พยาบาล, แพทย์, ทหาร ฯลฯ)",
        "พนักงานทั่วไป",
        "เอกชน"
    ];

    const filteredStudents = students.filter(s => s.classId === selectedClass && s.status !== "จำหน่าย");

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6 print:bg-white print:text-black print:p-0">
            <Toaster />
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 6mm 10mm; }
                    body { -webkit-print-color-adjust: exact; background: white !important; color: black !important; font-size: 8pt !important; line-height: 1.15 !important; }
                    .no-print { display: none !important; }
                    .print-container { background-color: white !important; color: black !important; box-shadow: none !important; border: none !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
                    input, select, textarea { border: none !important; border-bottom: 1px dotted #000 !important; border-radius: 0 !important; background: transparent !important; padding: 0px 2px !important; height: auto !important; font-size: 8pt !important; color: black !important; }
                    .card-box { background: white !important; border: 1px solid #ddd !important; padding: 6px !important; margin-bottom: 6px !important; border-radius: 6px !important; box-shadow: none !important; }
                    .page-break { page-break-before: always; break-before: page; }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl print-container">
                
                <div className="no-print flex justify-between items-center mb-6">
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-2.5 rounded-2xl transition border border-gray-700/60 shadow-lg text-sm font-bold flex items-center gap-2 cursor-pointer">
                        ← ย้อนกลับ
                    </button>
                    {selectedStudent && (
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer">
                                🖨️ พิมพ์เอกสาร (คนนี้)
                            </button>
                            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer">
                                📚 พิมพ์ทั้งหมดในห้อง ({filteredStudents.length} คน)
                            </button>
                        </div>
                    )}
                </div>

                <div className="no-print mb-8 bg-gray-950 p-6 rounded-2xl border border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4 shadow-xl">
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">เลือกห้องเรียน</label>
                        <select className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm outline-none font-medium" onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}>
                            <option value="">-- เลือกห้อง --</option>
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">เลือกนักศึกษา</label>
                        <select className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm outline-none font-medium" value={selectedStudent ? selectedStudent.id : ''} onChange={(e) => handleStudentSelect(e.target.value)}>
                            <option value="">-- เลือกนักเรียน --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.studentNumber}. {s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* หน้าที่ 1: ข้อมูลส่วนตัวและครอบครัว */}
                <div className="space-y-4 text-sm">
                    <div className="text-center mb-4">
                        <img src="/logo.png" style={{ height: '38px', width: 'auto' }} className="mx-auto mb-1 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                        <h1 className="font-bold text-sm tracking-wide text-white print:text-black">แบบบันทึกการเยี่ยมบ้านนักเรียนรายบุคคล วิทยาลัยเทคโนโลยีพณิชยการสิชล</h1>
                        <div className="mt-1 flex justify-center gap-6 text-xs text-gray-300 print:text-black">
                            <span>ภาคเรียนที่: <input name="semester" onChange={handleHeaderChange} value={headerInfo.semester} className="w-8 text-center bg-gray-800 print:bg-transparent" /></span>
                            <span>ปีการศึกษา: <input name="year" onChange={handleHeaderChange} value={headerInfo.year} className="w-12 text-center bg-gray-800 print:bg-transparent" /></span>
                            <span>วันที่: <input type="date" name="visitDate" onChange={handleHeaderChange} value={headerInfo.visitDate} className="bg-gray-800 print:bg-transparent" /></span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="font-bold text-xs border-b border-gray-700 pb-1 text-indigo-400 print:text-black">ตอนที่ 1 ข้อมูลส่วนตัวและครอบครัว</div>
                        
                        <div className="card-box p-3 bg-gray-950 rounded-2xl border border-gray-800 shadow-sm">
                            <p className="font-bold text-indigo-300 print:text-black mb-1">นักเรียน: {selectedStudent ? selectedStudent.name : '......................................................'} <span className="text-xs font-normal text-gray-400">(ห้อง: {selectedClass || '......................'})</span></p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                <div className="md:col-span-2">
                                    <span className="text-gray-400 print:text-black">1. ที่อยู่ปัจจุบัน:</span> 
                                    <input name="houseNumber" value={formData.houseNumber} onChange={handleInputChange} className="w-full p-1.5 mt-0.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" placeholder="บ้านเลขที่ / ที่อยู่" />
                                </div>
                                <div>เบอร์โทรศัพท์: <input name="studentPhone" value={formData.studentPhone} onChange={handleInputChange} className="w-full p-1.5 mt-0.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                                <div>อีเมล: <input name="studentEmail" value={formData.studentEmail} onChange={handleInputChange} className="w-full p-1.5 mt-0.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                            </div>
                        </div>

                        {/* ข้อมูลบิดา */}
                        <div className="card-box p-3 bg-gray-950 rounded-2xl border border-gray-800 shadow-sm space-y-1.5 text-xs">
                            <div className="flex gap-2 items-center font-semibold">
                                <span>2. บิดา:</span> <input name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="flex-1 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" placeholder="ชื่อ-นามสกุล" />
                                <span>อายุ:</span> <input name="fatherAge" value={formData.fatherAge} onChange={handleInputChange} className="w-12 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-center text-xs" /> ปี
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="flex items-center gap-1">
                                    <span className="whitespace-nowrap">อาชีพ:</span> 
                                    <select onChange={(e) => setFormData(prev => ({ ...prev, fatherJob: e.target.value }))} className="w-full p-1.5 bg-gray-900 print:bg-white border border-gray-700 rounded-lg text-xs">
                                        <option value="">-- เลือกอาชีพ --</option>
                                        {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="whitespace-nowrap">รายได้:</span> 
                                    <input name="fatherIncome" value={formData.fatherIncome} onChange={handleIncomeChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-right text-xs" placeholder="0" /> 
                                    <span className="whitespace-nowrap">บาท</span>
                                </div>
                                <div>เบอร์โทร: <input name="fatherPhone" value={formData.fatherPhone} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                            </div>
                            <div>ระบุเพิ่มเติม / ที่ทำงาน: <input name="fatherWorkplace" value={formData.fatherWorkplace} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                        </div>

                        {/* ข้อมูลมารดา */}
                        <div className="card-box p-3 bg-gray-950 rounded-2xl border border-gray-800 shadow-sm space-y-1.5 text-xs">
                            <div className="flex gap-2 items-center font-semibold">
                                <span>3. มารดา:</span> <input name="motherName" value={formData.motherName} onChange={handleInputChange} className="flex-1 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" placeholder="ชื่อ-นามสกุล" />
                                <span>อายุ:</span> <input name="motherAge" value={formData.motherAge} onChange={handleInputChange} className="w-12 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-center text-xs" /> ปี
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="flex items-center gap-1">
                                    <span className="whitespace-nowrap">อาชีพ:</span> 
                                    <select onChange={(e) => setFormData(prev => ({ ...prev, motherJob: e.target.value }))} className="w-full p-1.5 bg-gray-900 print:bg-white border border-gray-700 rounded-lg text-xs">
                                        <option value="">-- เลือกอาชีพ --</option>
                                        {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="whitespace-nowrap">รายได้:</span> 
                                    <input name="motherIncome" value={formData.motherIncome} onChange={handleIncomeChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-right text-xs" placeholder="0" /> 
                                    <span className="whitespace-nowrap">บาท</span>
                                </div>
                                <div>เบอร์โทร: <input name="motherPhone" value={formData.motherPhone} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                            </div>
                            <div>ระบุเพิ่มเติม / ที่ทำงาน: <input name="motherWorkplace" value={formData.motherWorkplace} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                        </div>

                        {/* ข้อมูลผู้ปกครอง */}
                        <div className="card-box p-3 bg-gray-950 rounded-2xl border border-gray-800 shadow-sm space-y-1.5 text-xs">
                            <div className="flex gap-2 items-center font-semibold flex-wrap">
                                <span>4. ผู้ปกครอง:</span> <input name="parentName" value={formData.parentName} onChange={handleInputChange} className="flex-1 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" placeholder="ชื่อ-นามสกุล" />
                                <span>อายุ:</span> <input name="parentAge" value={formData.parentAge} onChange={handleInputChange} className="w-12 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-center text-xs" /> ปี
                                <span>เกี่ยวข้อง:</span> <input name="parentRelation" value={formData.parentRelation} onChange={handleInputChange} className="w-20 p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="flex items-center gap-1">
                                    <span className="whitespace-nowrap">อาชีพ:</span> 
                                    <select onChange={(e) => setFormData(prev => ({ ...prev, parentJob: e.target.value }))} className="w-full p-1.5 bg-gray-900 print:bg-white border border-gray-700 rounded-lg text-xs">
                                        <option value="">-- เลือกอาชีพ --</option>
                                        {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="whitespace-nowrap">รายได้:</span> 
                                    <input name="parentIncome" value={formData.parentIncome} onChange={handleIncomeChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-right text-xs" placeholder="0" /> 
                                    <span className="whitespace-nowrap">บาท</span>
                                </div>
                                <div>เบอร์โทร: <input name="parentPhone" value={formData.parentPhone} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                            </div>
                            <div>ระบุเพิ่มเติม / ที่ทำงาน: <input name="parentWorkplace" value={formData.parentWorkplace} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-lg text-xs" /></div>
                        </div>

                        <div className="card-box grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-gray-950 rounded-2xl border border-gray-800 text-xs">
                            <div>
                                <p className="mb-1 font-semibold">5. นักเรียนอาศัยอยู่กับ:</p>
                                <div className="flex gap-3 flex-wrap text-[11px]">
                                    {["บิดามารดา", "บิดา", "มารดา", "ญาติ", "อื่นๆ"].map(item => (
                                        <label key={item} className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name="livingWith" checked={formData.livingWith === item} onChange={() => setFormData(prev => ({ ...prev, livingWith: item }))} /> {item}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="mb-1 font-semibold">6. สถานะครอบครัว:</p>
                                <div className="flex gap-3 flex-wrap text-[11px]">
                                    {["อยู่ด้วยกัน", "หย่าร้าง", "แยกกันอยู่", "เสียชีวิต"].map(item => (
                                        <label key={item} className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name="familyStatus" checked={formData.familyStatus === item} onChange={() => setFormData(prev => ({ ...prev, familyStatus: item }))} /> {item}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* หน้าที่ 2: สภาพแวดล้อม บ้าน และความคิดเห็น */}
                <div className="page-break pt-6 mt-6 border-t border-dashed border-gray-700 print:border-none space-y-4 text-xs">
                    <div className="font-bold text-xs border-b border-gray-700 pb-1 text-indigo-400 print:text-black">ตอนที่ 2 สภาพแวดล้อมและความคิดเห็น</div>

                    <div className="card-box p-3 bg-gray-950 rounded-2xl border border-gray-800 space-y-3">
                        <div>
                            <p className="mb-1 font-semibold">7. บ้านที่อยู่อาศัย:</p>
                            <div className="flex gap-3 flex-wrap text-[11px]">
                                {["บ้านของตนเอง", "บ้านเช่า", "อาศัยอยู่กับผู้อื่น", "หอพัก/แฟลต", "อื่นๆ"].map(item => (
                                    <label key={item} className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name="houseType" checked={formData.houseType === item} onChange={() => setFormData(prev => ({ ...prev, houseType: item }))} /> {item}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold">8. ระยะทางระหว่างบ้านกับโรงเรียน:</p>
                            <div className="flex gap-3 flex-wrap text-[11px]">
                                {["1 - 5 กม.", "6 - 10 กม.", "11 - 15 กม.", "16 - 20 กม.", "20 กม.ขึ้นไป"].map(item => (
                                    <label key={item} className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name="distance" checked={formData.distance === item} onChange={() => setFormData(prev => ({ ...prev, distance: item }))} /> {item}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold">9. การเดินทางมาโรงเรียน:</p>
                            <div className="flex gap-3 flex-wrap text-[11px]">
                                {["เดิน", "รถจักรยาน", "รถจักรยานยนต์", "รถยนต์ส่วนตัว", "รถรับส่ง", "อื่นๆ"].map(item => (
                                    <label key={item} className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name="transportation" checked={formData.transportation === item} onChange={() => setFormData(prev => ({ ...prev, transportation: item }))} /> {item}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                            <div className="p-2 bg-gray-900 print:bg-gray-50 rounded-xl border border-gray-800">
                                <p className="font-semibold mb-1">10. สภาพแวดล้อม:</p>
                                {["ดี", "พอใช้", "ควรปรับปรุง"].map(item => (
                                    <label key={item} className="flex items-center gap-1 cursor-pointer text-[11px]">
                                        <input type="radio" name="environment" checked={formData.environment === item} onChange={() => setFormData(prev => ({ ...prev, environment: item }))} /> {item}
                                    </label>
                                ))}
                            </div>
                            <div className="p-2 bg-gray-900 print:bg-gray-50 rounded-xl border border-gray-800">
                                <p className="font-semibold mb-1">11. ความสัมพันธ์:</p>
                                {["อบอุ่น", "เฉยๆ", "ห่างเหิน"].map(item => (
                                    <label key={item} className="flex items-center gap-1 cursor-pointer text-[11px]">
                                        <input type="radio" name="relationship" checked={formData.relationship === item} onChange={() => setFormData(prev => ({ ...prev, relationship: item }))} /> {item}
                                    </label>
                                ))}
                            </div>
                            <div className="p-2 bg-gray-900 print:bg-gray-50 rounded-xl border border-gray-800">
                                <p className="font-semibold mb-1">12. ฐานะเศรษฐกิจ:</p>
                                {["ฐานะดี", "ฐานะปานกลาง", "มีความขัดสน"].map(item => (
                                    <label key={item} className="flex items-center gap-1 cursor-pointer text-[11px]">
                                        <input type="radio" name="economy" checked={formData.economy === item} onChange={() => setFormData(prev => ({ ...prev, economy: item }))} /> {item}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="pt-1">
                            <p className="font-bold mb-0.5">13. สิ่งที่ต้องการให้โรงเรียนช่วยเหลือ:</p>
                            <input name="helpNeeded" value={formData.helpNeeded} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-xl text-xs" placeholder="ระบุ..." />
                        </div>

                        <div className="pt-1">
                            <p className="font-bold mb-0.5">14. ความคิดเห็นเพิ่มเติมของครูที่ปรึกษา:</p>
                            <textarea name="teacherComment" value={formData.teacherComment} onChange={handleInputChange} className="w-full p-1.5 bg-gray-900 print:bg-transparent border border-gray-700 rounded-xl text-xs" rows="2" placeholder="บันทึกความคิดเห็น..."></textarea>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <div className="text-center w-52 text-xs">
                            <p className="mb-6">ลงชื่อ...................................................... ครูผู้เยี่ยมบ้าน</p>
                            <p className="font-semibold">({userProfile.name || '......................................................'})</p>
                        </div>
                    </div>
                </div>

                {/* ส่วนจัดการรูปถ่าย */}
                {selectedStudent && (
                    <div className="page-break pt-6 mt-6 border-t border-dashed border-gray-700 print:border-none">
                        <h2 className="font-bold text-sm text-center mb-4 text-white print:text-black">รูปภาพเยี่ยมบ้านนักศึกษา: {selectedStudent.name}</h2>
                        
                        <div className="no-print mb-4">
                            <label className="block bg-gray-800 p-6 rounded-2xl border-2 border-dashed border-gray-600 text-center cursor-pointer hover:border-indigo-500 transition">
                                <span className="text-indigo-400 font-bold block mb-1 text-xs">📸 คลิกเพื่อเลือกรูปภาพประกอบการเยี่ยมบ้าน</span>
                                <span className="text-[10px] text-gray-400">เลือกได้หลายรูปพร้อมกัน</span>
                                <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                            </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {imagePreviews.map((src, index) => (
                                <div key={index} className="border border-gray-700 print:border-gray-400 p-2 bg-gray-800 print:bg-white rounded-xl overflow-hidden shadow-sm">
                                    <img src={src} className="w-full h-48 object-cover rounded-lg" alt={`visit-${index}`} />
                                    <p className="text-center text-xs mt-2 text-gray-300 print:text-black font-medium">รูปที่ {index + 1}: สภาพบ้านและการเยี่ยมบ้าน</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedStudent && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-8 no-print pt-4 border-t border-gray-800">
                        <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 px-6 rounded-xl font-bold text-white text-xs transition shadow-lg cursor-pointer">
                            💾 บันทึกข้อมูล
                        </button>
                        <button onClick={handleClear} className="bg-gray-800 hover:bg-gray-700 text-red-400 border border-red-900/40 py-3 px-6 rounded-xl font-bold text-xs transition cursor-pointer">
                            🗑️ ล้างฟอร์ม
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}