'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function HomeVisitForm() {
    const router = useRouter();
    const [classrooms, setClassrooms] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [headerInfo, setHeaderInfo] = useState({ semester: '1', year: '2569', visitDate: new Date().toISOString().split('T')[0] });
    const [formData, setFormData] = useState({ fatherName: '', motherName: '', parentName: '', parentRelation: '', address: '', fatherJob: '', fatherIncome: '', motherJob: '', motherIncome: '', parentJob: '', parentIncome: '', houseType: '', familyInfo: '', dailyTasks: '', studyProblems: '' });

    const fieldStyle = "flex items-end gap-2 mb-4"; 
    const labelStyle = "font-bold text-slate-800 whitespace-nowrap min-w-[110px] text-sm";
    const dotInput = "flex-1 border-b border-dotted border-slate-500 outline-none bg-transparent px-1 text-sm pb-1";
    const headerInput = "border-b border-dotted border-black text-center outline-none bg-transparent mx-1";

    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleHeaderChange = (e) => setHeaderInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleClear = () => {
        setFormData({ fatherName: '', motherName: '', parentName: '', parentRelation: '', address: '', fatherJob: '', fatherIncome: '', motherJob: '', motherIncome: '', parentJob: '', parentIncome: '', houseType: '', familyInfo: '', dailyTasks: '', studyProblems: '' });
        toast.success("ล้างข้อมูลเรียบร้อย");
    };

    useEffect(() => {
        const fetchData = async () => {
            const classSnap = await getDocs(collection(db, 'classrooms'));
            setClassrooms(classSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.className.localeCompare(b.className)));
            const studentSnap = await getDocs(collection(db, 'students'));
            setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0)));
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        if (!selectedStudent) return toast.error("กรุณาเลือกนักศึกษา");
        try {
            await addDoc(collection(db, 'home_visits'), { studentId: selectedStudent.id, studentName: selectedStudent.name, className: selectedClass, headerInfo, ...formData });
            toast.success("บันทึกเรียบร้อย!");
        } catch (e) { toast.error("บันทึกไม่สำเร็จ"); }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <Toaster />
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    .no-print { display: none !important; }
                    .print-container { box-shadow: none !important; border: none !important; width: 100% !important; padding: 0 !important; }
                    .print-header-text { display: inline-block; min-width: 60px; border-bottom: 1px dotted #000; text-align: center; }
                    .no-print-input { display: none; }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto bg-white p-10 shadow-lg border border-slate-200 print-container">
                <button onClick={() => router.back()} className="mb-6 text-slate-500 text-sm no-print">← ย้อนกลับ</button>
                
                <div className="text-center mb-8">
                    <img src="/logo.png" style={{ height: '50px', width: 'auto' }} className="mx-auto mb-3" />
                    <h1 className="font-bold text-base">แบบบันทึกการเยี่ยมบ้านนักเรียน</h1>
                    <div className="mt-4 flex justify-center gap-6 text-sm">
                        <span>ภาคเรียนที่: 
                            <span className="no-print-input"><input name="semester" onChange={handleHeaderChange} value={headerInfo.semester} className={`w-8 ${headerInput}`} /></span>
                            <span className="print-header-text hidden print:inline-block">{headerInfo.semester}</span>
                        </span>
                        <span>ปีการศึกษา: 
                            <span className="no-print-input"><input name="year" onChange={handleHeaderChange} value={headerInfo.year} className={`w-12 ${headerInput}`} /></span>
                            <span className="print-header-text hidden print:inline-block">{headerInfo.year}</span>
                        </span>
                        <span>วันที่: 
                            <span className="no-print-input"><input type="date" name="visitDate" onChange={handleHeaderChange} value={headerInfo.visitDate} className={headerInput} /></span>
                            <span className="print-header-text hidden print:inline-block">{headerInfo.visitDate}</span>
                        </span>
                    </div>
                </div>

                <div className="flex gap-4 mb-8 no-print">
                    <select className="flex-1 p-2 border rounded text-sm" onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}>
                        <option value="">-- เลือกห้อง --</option>
                        {classrooms.map(c => <option key={c.id} value={c.className}>{c.className}</option>)}
                    </select>
                    <select className="flex-1 p-2 border rounded text-sm" onChange={(e) => setSelectedStudent(students.find(s => s.id === e.target.value))}>
                        <option value="">-- เลือกนักเรียน --</option>
                        {students.filter(s => s.classId === selectedClass).map(s => <option key={s.id} value={s.id}>{s.studentNumber}. {s.name}</option>)}
                    </select>
                </div>

                {selectedStudent && (
                    <div className="border-t pt-6 space-y-2">
                        <p className="font-bold text-sm mb-6">
                            1. ชื่อนักศึกษา: {selectedStudent.name} &nbsp; 
                            <span className="font-normal text-slate-600">(ห้อง: {selectedClass})</span>
                        </p>
                        
                        <div className={fieldStyle}><span className={labelStyle}>2. ชื่อบิดา:</span><input name="fatherName" value={formData.fatherName} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>3. ชื่อมารดา:</span><input name="motherName" value={formData.motherName} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>4. ชื่อผู้ปกครอง:</span><input name="parentName" value={formData.parentName} onChange={handleInputChange} className={dotInput} /><span className="font-bold ml-4 text-sm">เกี่ยวเป็น:</span><input name="parentRelation" value={formData.parentRelation} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>5. ที่อยู่:</span><input name="address" value={formData.address} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>6. อาชีพบิดา:</span><input name="fatherJob" value={formData.fatherJob} onChange={handleInputChange} className={dotInput} /><span className="font-bold ml-4 text-sm">รายได้:</span><input name="fatherIncome" value={formData.fatherIncome} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>7. อาชีพมารดา:</span><input name="motherJob" value={formData.motherJob} onChange={handleInputChange} className={dotInput} /><span className="font-bold ml-4 text-sm">รายได้:</span><input name="motherIncome" value={formData.motherIncome} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>8. อาชีพผู้ปกครอง:</span><input name="parentJob" value={formData.parentJob} onChange={handleInputChange} className={dotInput} /><span className="font-bold ml-4 text-sm">รายได้:</span><input name="parentIncome" value={formData.parentIncome} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>9. สภาพบ้าน:</span><input name="houseType" value={formData.houseType} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>10. ลักษณะที่อยู่อาศัย:</span><input name="familyInfo" value={formData.familyInfo} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>11. ภาระงานในบ้านที่นักศึกษาช่วย:</span><input name="dailyTasks" value={formData.dailyTasks} onChange={handleInputChange} className={dotInput} /></div>
                        <div className={fieldStyle}><span className={labelStyle}>12. ปัญหาที่พบ:</span><input name="studyProblems" value={formData.studyProblems} onChange={handleInputChange} className={dotInput} /></div>
                        
                        <div className="mt-16 flex justify-end">
                            <div className="text-center w-64">
                                <p>ลงชื่อ............................................. ครูที่ปรึกษา</p>
                                <p className="mt-1">(...................................................)</p>
                                <p className="text-xs mt-1">วันที่........../........../..........</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10 no-print">
                            <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">บันทึกข้อมูล</button>
                            <button onClick={handleClear} className="bg-red-500 text-white py-3 px-8 rounded-lg font-bold hover:bg-red-600">ล้างฟอร์ม</button>
                            <button onClick={() => window.print()} className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700">พิมพ์เอกสาร</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}