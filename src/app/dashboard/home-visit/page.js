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
                studentPhone: student.phone || student.studentPhone || ''
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

    const filteredStudents = students.filter(s => s.classId === selectedClass && s.status !== "จำหน่าย");

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6 print:bg-white print:text-black print:p-0">
            <Toaster />
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; background: white !important; color: black !important; font-size: 10pt !important; }
                    .no-print { display: none !important; }
                    .print-container { background-color: white !important; color: black !important; box-shadow: none !important; border: none !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
                    input, select { border: none !important; border-bottom: 1px dotted #000 !important; border-radius: 0 !important; background: transparent !important; padding: 0px 2px !important; height: auto !important; font-size: 10pt !important; }
                    .page-break { page-break-before: always; }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl print-container">
                
                <div className="no-print flex justify-between items-center mb-4">
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

                <div className="no-print mb-6 bg-gray-950 p-4 rounded-2xl border border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">เลือกห้องเรียน</label>
                        <select className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm outline-none" onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}>
                            <option value="">-- เลือกห้อง --</option>
                            {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">เลือกนักศึกษา</label>
                        <select className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm outline-none" value={selectedStudent ? selectedStudent.id : ''} onChange={(e) => handleStudentSelect(e.target.value)}>
                            <option value="">-- เลือกนักเรียน --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.studentNumber}. {s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* หน้าที่ 1: ข้อมูลส่วนตัวและครอบครัว */}
                <div className="space-y-4 text-xs">
                    <div className="text-center mb-4">
                        <h1 className="font-bold text-sm tracking-wide">แบบบันทึกการเยี่ยมบ้านนักเรียนรายบุคคล</h1>
                        <div className="mt-1 flex justify-center gap-4 text-xs">
                            <span>ภาคเรียนที่: <input name="semester" onChange={handleHeaderChange} value={headerInfo.semester} className="w-8 text-center" /></span>
                            <span>ปีการศึกษา: <input name="year" onChange={handleHeaderChange} value={headerInfo.year} className="w-12 text-center" /></span>
                            <span>วันที่: <input type="date" name="visitDate" onChange={handleHeaderChange} value={headerInfo.visitDate} /></span>
                        </div>
                    </div>

                    <div className="font-bold border-b border-gray-700 pb-1 text-indigo-400 print:text-black">ตอนที่ 1 ข้อมูลส่วนตัวและครอบครัว</div>
                    
                    <div>
                        <p className="font-semibold mb-1">นักเรียน: {selectedStudent ? selectedStudent.name : '......................................................'} (ห้อง: {selectedClass || '......................'})</p>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-2">1. ที่อยู่ปัจจุบัน บ้านเลขที่ <input name="houseNumber" value={formData.houseNumber} onChange={handleInputChange} className="w-16" /> หมู่ที่ <input name="moo" value={formData.moo} onChange={handleInputChange} className="w-10" /> ซอย <input name="soi" value={formData.soi} onChange={handleInputChange} className="w-24" /></div>
                            <div className="col-span-2">ถนน <input name="road" value={formData.road} onChange={handleInputChange} className="w-full" /></div>
                            <div className="col-span-2">แขวง/ตำบล <input name="tumbon" value={formData.tumbon} onChange={handleInputChange} className="w-32" /> เขต/อำเภอ <input name="amphur" value={formData.amphur} onChange={handleInputChange} className="w-32" /></div>
                            <div className="col-span-2">จังหวัด <input name="province" value={formData.province} onChange={handleInputChange} className="w-32" /> รหัสไปรษณีย์ <input name="zipcode" value={formData.zipcode} onChange={handleInputChange} className="w-16" /></div>
                            <div className="col-span-2">เบอร์โทรศัพท์นักเรียน <input name="studentPhone" value={formData.studentPhone} onChange={handleInputChange} className="w-32" /></div>
                            <div className="col-span-2">อีเมลนักเรียน <input name="studentEmail" value={formData.studentEmail} onChange={handleInputChange} className="w-40" /></div>
                        </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                        <div>2. บิดาชื่อ <input name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-48" /> อายุ <input name="fatherAge" value={formData.fatherAge} onChange={handleInputChange} className="w-10" /> ปี</div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>อาชีพ <input name="fatherJob" value={formData.fatherJob} onChange={handleInputChange} className="w-24" /></div>
                            <div>รายได้ต่อเดือน <input name="fatherIncome" value={formData.fatherIncome} onChange={handleIncomeChange} className="w-16" /> บาท</div>
                            <div>เบอร์โทร <input name="fatherPhone" value={formData.fatherPhone} onChange={handleInputChange} className="w-24" /></div>
                        </div>
                        <div>สถานที่ประกอบอาชีพ <input name="fatherWorkplace" value={formData.fatherWorkplace} onChange={handleInputChange} className="w-full" /></div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                        <div>3. มารดาชื่อ <input name="motherName" value={formData.motherName} onChange={handleInputChange} className="w-48" /> อายุ <input name="motherAge" value={formData.motherAge} onChange={handleInputChange} className="w-10" /> ปี</div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>อาชีพ <input name="motherJob" value={formData.motherJob} onChange={handleInputChange} className="w-24" /></div>
                            <div>รายได้ต่อเดือน <input name="motherIncome" value={formData.motherIncome} onChange={handleIncomeChange} className="w-16" /> บาท</div>
                            <div>เบอร์โทร <input name="motherPhone" value={formData.motherPhone} onChange={handleInputChange} className="w-24" /></div>
                        </div>
                        <div>สถานที่ประกอบอาชีพ <input name="motherWorkplace" value={formData.motherWorkplace} onChange={handleInputChange} className="w-full" /></div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                        <div>4. กรณีบิดา/มารดาไม่ใช่ผู้ปกครอง ชื่อ <input name="parentName" value={formData.parentName} onChange={handleInputChange} className="w-40" /> อายุ <input name="parentAge" value={formData.parentAge} onChange={handleInputChange} className="w-10" /> ปี เกี่ยวข้องเป็น <input name="parentRelation" value={formData.parentRelation} onChange={handleInputChange} className="w-24" /></div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>อาชีพ <input name="parentJob" value={formData.parentJob} onChange={handleInputChange} className="w-24" /></div>
                            <div>รายได้ต่อเดือน <input name="parentIncome" value={formData.parentIncome} onChange={handleIncomeChange} className="w-16" /> บาท</div>
                            <div>เบอร์โทร <input name="parentPhone" value={formData.parentPhone} onChange={handleInputChange} className="w-24" /></div>
                        </div>
                        <div>สถานที่ประกอบอาชีพ <input name="parentWorkplace" value={formData.parentWorkplace} onChange={handleInputChange} className="w-full" /></div>
                    </div>

                    <div>
                        <p>5. จำนวนพี่น้องร่วมบิดามารดาเดียวกัน (รวมนักเรียน) กำลังศึกษาอยู่ <input name="siblingsStudying" value={formData.siblingsStudying} onChange={handleInputChange} className="w-8" /> คน ประกอบอาชีพ <input name="siblingsWorking" value={formData.siblingsWorking} onChange={handleInputChange} className="w-8" /> คน</p>
                        <p>พี่น้องต่างบิดามารดา กำลังศึกษาอยู่ <input name="otherSiblingsStudying" value={formData.otherSiblingsStudying} onChange={handleInputChange} className="w-8" /> คน ประกอบอาชีพ <input name="otherSiblingsWorking" value={formData.otherSiblingsWorking} onChange={handleInputChange} className="w-8" /> คน</p>
                    </div>

                    <div>
                        <p className="mb-1">6. นักเรียนอาศัยอยู่กับ (เลือก/ระบุ):</p>
                        <div className="flex gap-4 flex-wrap">
                            {["บิดามารดา", "บิดา", "มารดา", "พี่/น้อง", "ปู่/ย่า", "ตา/ยาย", "อื่นๆ"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="livingWith" checked={formData.livingWith === item} onChange={() => setFormData(prev => ({ ...prev, livingWith: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-1">7. สถานะของครอบครัวนักเรียน:</p>
                        <div className="flex gap-4 flex-wrap">
                            {["อยู่ด้วยกัน", "หย่าร้าง", "แยกกันอยู่", "บิดาเสียชีวิต", "มารดาเสียชีวิต"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="familyStatus" checked={formData.familyStatus === item} onChange={() => setFormData(prev => ({ ...prev, familyStatus: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* หน้าที่ 2: สภาพแวดล้อม บ้าน และความคิดเห็น */}
                <div className="page-break pt-6 mt-6 border-t border-dashed border-gray-700 print:border-none space-y-4 text-xs">
                    <div className="font-bold border-b border-gray-700 pb-1 text-indigo-400 print:text-black">ตอนที่ 2 สภาพแวดล้อมและความคิดเห็น</div>

                    <div>
                        <p className="mb-1">8. บ้านที่อยู่อาศัย:</p>
                        <div className="flex gap-4 flex-wrap">
                            {["บ้านของตนเอง", "บ้านเช่า", "อาศัยอยู่กับผู้อื่น", "หอพัก/แฟลต", "อื่นๆ"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="houseType" checked={formData.houseType === item} onChange={() => setFormData(prev => ({ ...prev, houseType: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-1">9. ระยะทางระหว่างบ้านกับโรงเรียน:</p>
                        <div className="flex gap-4 flex-wrap">
                            {["1 - 5 กิโลเมตร", "6 - 10 กิโลเมตร", "11 - 15 กิโลเมตร", "16 - 20 กิโลเมตร", "20 กิโลเมตรขึ้นไป"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="distance" checked={formData.distance === item} onChange={() => setFormData(prev => ({ ...prev, distance: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-1">10. โดยปกติการเดินทางมาโรงเรียน:</p>
                        <div className="flex gap-4 flex-wrap">
                            {["เดิน", "รถจักรยาน", "รถจักรยานยนต์", "รถยนต์ส่วนตัว", "รถรับส่งโดยสาร", "รถตู้โรงเรียน", "อื่นๆ"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="transportation" checked={formData.transportation === item} onChange={() => setFormData(prev => ({ ...prev, transportation: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-1">
                        <div>
                            <p className="font-semibold">11. สภาพแวดล้อม:</p>
                            {["ดี", "พอใช้", "ควรปรับปรุง"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="environment" checked={formData.environment === item} onChange={() => setFormData(prev => ({ ...prev, environment: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                        <div>
                            <p className="font-semibold">12. ความสัมพันธ์ในครอบครัว:</p>
                            {["อบอุ่น", "เฉยๆ", "ห่างเหิน"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="relationship" checked={formData.relationship === item} onChange={() => setFormData(prev => ({ ...prev, relationship: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                        <div>
                            <p className="font-semibold">13. ฐานะทางเศรษฐกิจ:</p>
                            {["ฐานะดี", "ฐานะปานกลาง", "มีความขัดสน"].map(item => (
                                <label key={item} className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="economy" checked={formData.economy === item} onChange={() => setFormData(prev => ({ ...prev, economy: item }))} /> {item}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <p className="font-bold mb-1">14. สิ่งที่ผู้ปกครอง/นักเรียนอยากให้โรงเรียนช่วยเหลือ:</p>
                        <input name="helpNeeded" value={formData.helpNeeded} onChange={handleInputChange} className="w-full p-1" placeholder="ระบุความต้องการช่วยเหลือ..." />
                    </div>

                    <div className="pt-2">
                        <p className="font-bold mb-1">15. ความคิดเห็นเพิ่มเติมเมื่อครูที่ปรึกษาเยี่ยมบ้านนักเรียน:</p>
                        <textarea name="teacherComment" value={formData.teacherComment} onChange={handleInputChange} className="w-full p-2 bg-gray-800 print:bg-transparent border border-gray-700 print:border-black rounded-lg text-xs" rows="3" placeholder="บันทึกความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม..."></textarea>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <div className="text-center w-56 text-xs">
                            <p className="mb-6">ลงชื่อ...................................................... ครูผู้เยี่ยมบ้าน</p>
                            <p>({userProfile.name || '......................................................'})</p>
                        </div>
                    </div>
                </div>

                {/* ส่วนจัดการรูปถ่าย */}
                {selectedStudent && (
                    <div className="page-break pt-6 mt-6 border-t border-dashed border-gray-700 print:border-none">
                        <h2 className="font-bold text-sm text-center mb-4 text-white print:text-black">รูปภาพเยี่ยมบ้านนักศึกษา: {selectedStudent.name}</h2>
                        
                        <div className="no-print mb-4">
                            <label className="block bg-gray-800 p-4 rounded-xl border-2 border-dashed border-gray-600 text-center cursor-pointer hover:border-indigo-500 transition">
                                <span className="text-indigo-400 font-bold block mb-1 text-xs">📸 คลิกเพื่อเลือกรูปภาพประกอบการเยี่ยมบ้าน</span>
                                <span className="text-[10px] text-gray-400">เลือกได้หลายรูปพร้อมกัน</span>
                                <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                            </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {imagePreviews.map((src, index) => (
                                <div key={index} className="border border-gray-700 print:border-gray-400 p-1.5 bg-gray-800 print:bg-white rounded-lg overflow-hidden shadow-sm">
                                    <img src={src} className="w-full h-44 object-cover rounded-md" alt={`visit-${index}`} />
                                    <p className="text-center text-[10px] mt-1 text-gray-300 print:text-black font-medium">รูปที่ {index + 1}: สภาพบ้านและการเยี่ยมบ้าน</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedStudent && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-6 no-print pt-3 border-t border-gray-800">
                        <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2.5 px-4 rounded-xl font-bold text-white text-xs transition shadow-lg cursor-pointer">
                            💾 บันทึกข้อมูล
                        </button>
                        <button onClick={handleClear} className="bg-gray-800 hover:bg-gray-700 text-red-400 border border-red-900/40 py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer">
                            🗑️ ล้างฟอร์ม
                        </button>
                        <button onClick={() => window.print()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 px-4 rounded-xl font-bold text-white text-xs transition shadow-lg cursor-pointer">
                            🖨️ พิมพ์เอกสารทั้งหมด
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}