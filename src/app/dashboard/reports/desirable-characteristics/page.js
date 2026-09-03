'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function DesirableCharacteristicsPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [semesters, setSemesters] = useState(['1/2569']);
    const [selectedSemester, setSelectedSemester] = useState('1/2569');
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [activeTab, setActiveTab] = useState('evaluation');
    const [isLoading, setIsLoading] = useState(false);

    const [scores, setScores] = useState({
        q1_1: 3, q1_2: 3,
        q2_1: 3, q2_2: 3,
        q3_1: 3, q3_2: 3,
        q4_1: 3, q4_2: 3,
        q5_1: 3, q5_2: 3
    });

    const [evaluationsData, setEvaluationsData] = useState({});

    const printDateStr = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                    if (!snap.empty) {
                        const prof = snap.docs[0].data();
                        setUserProfile(prof);

                        const classSnap = await getDocs(query(collection(db, "classrooms"), orderBy("className")));
                        const existingClassesMap = new Set(
                            classSnap.docs.map(d => {
                                const data = d.data();
                                return data.department ? `${data.className} ${data.department}` : data.className;
                            })
                        );

                        let classes = [];
                        if (prof.role === 'admin') {
                            classes = Array.from(existingClassesMap);
                        } else {
                            const assigned = prof.assignedClasses || [];
                            classes = assigned.filter(c => existingClassesMap.has(c));
                        }

                        classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                        setClassrooms(classes);
                        if (classes.length > 0) setSelectedClass(classes[0]);
                    }

                    const settingsSnap = await getDoc(doc(db, "system_settings", "main_config"));
                    if (settingsSnap.exists()) {
                        const data = settingsSnap.data();
                        let semList = [];
                        
                        if (data && Array.isArray(data.semesters) && data.semesters.length > 0) {
                            semList = data.semesters.map(s => {
                                if (typeof s === 'object' && s !== null) {
                                    return String(s.name || s.semester || s.id || JSON.stringify(s));
                                }
                                return String(s);
                            });
                        } else if (data && Array.isArray(data.academicYears) && data.academicYears.length > 0) {
                            data.academicYears.forEach(y => {
                                const yrStr = typeof y === 'object' && y !== null ? String(y.year || y.name || JSON.stringify(y)) : String(y);
                                semList.push(`1/${yrStr}`);
                                semList.push(`2/${yrStr}`);
                            });
                        }

                        if (semList.length > 0) {
                            setSemesters(semList);
                            setSelectedSemester(String(semList[0]));
                        }
                    }
                } catch (err) {
                    console.error("Initialization error:", err);
                }
            } else { 
                router.push('/'); 
            }
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!selectedClass) return;
        fetchStudentsAndData();
    }, [selectedClass, selectedSemester]);

    const fetchStudentsAndData = async () => {
        setIsLoading(true);
        try {
            const studsSnap = await getDocs(query(collection(db, "students"), where("classId", "==", selectedClass)));
            const studentList = studsSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => s.status !== "จำหน่าย")
                .sort((a, b) => {
                    const numA = Number(a.studentNumber || a.number || a.no || a.code || 0);
                    const numB = Number(b.studentNumber || b.number || b.no || b.code || 0);
                    if (numA !== numB) return numA - numB;
                    return (a.name || '').localeCompare(b.name || '', 'th');
                });

            setStudents(studentList);
            if (studentList.length > 0) {
                setSelectedStudentId(studentList[0].id);
            }

            const cleanSemester = String(selectedSemester).trim();
            const evalSnap = await getDocs(query(
                collection(db, "desirable_evaluations"), 
                where("classId", "==", selectedClass), 
                where("semester", "==", cleanSemester)
            ));
            
            const evalMap = {};
            evalSnap.forEach(d => {
                const data = d.data();
                if (data && data.studentId && data.scores) {
                    evalMap[data.studentId] = data.scores;
                }
            });
            setEvaluationsData(evalMap);

        } catch (e) {
            console.error(e);
            toast.error("โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedStudentId && evaluationsData[selectedStudentId]) {
            setScores(evaluationsData[selectedStudentId]);
        } else {
            setScores({
                q1_1: 3, q1_2: 3,
                q2_1: 3, q2_2: 3,
                q3_1: 3, q3_2: 3,
                q4_1: 3, q4_2: 3,
                q5_1: 3, q5_2: 3
            });
        }
    }, [selectedStudentId, evaluationsData]);

    const handleScoreChange = (key, val) => {
        setScores(prev => ({ ...prev, [key]: Number(val) }));
    };

    const calculateStudentScore = (sScores) => {
        if (!sScores) return { total: 30, level: 'ดีเยี่ยม' };
        const total = Object.values(sScores).reduce((a, b) => a + b, 0);
        let level = 'พอใช้';
        if (total >= 23) level = 'ดีเยี่ยม';
        else if (total >= 15) level = 'ดี';
        return { total, level };
    };

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const qualityLevel = calculateStudentScore(scores).level;

    // แก้ไขจุดสร้าง docId โดยการแทนที่เครื่องหมาย / หรือช่องว่างด้วยขีดล่าง _ เพื่อป้องกันพาร์ท Firestore พัง
    const handleSave = async () => {
        if (!selectedStudentId || !selectedClass) return;
        setIsLoading(true);
        try {
            const cleanClass = String(selectedClass).trim();
            const cleanSemester = String(selectedSemester).trim().replace(/\//g, '-');
            const cleanStudentId = String(selectedStudentId).trim();

            const docId = `${cleanClass}_${cleanSemester}_${cleanStudentId}`;
            
            await setDoc(doc(db, "desirable_evaluations", docId), {
                classId: cleanClass,
                semester: String(selectedSemester),
                studentId: cleanStudentId,
                scores,
                totalScore,
                qualityLevel,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setEvaluationsData(prev => ({ ...prev, [selectedStudentId]: scores }));
            toast.success("บันทึกผลการประเมินสำเร็จ");
        } catch (e) {
            console.error("Save error:", e);
            toast.error("บันทึกไม่สำเร็จ");
        } finally {
            setIsLoading(false);
        }
    };

    const totalStudentsCount = Array.isArray(students) ? students.length : 0;
    const evaluatedStudentsCount = Object.keys(evaluationsData).length;
    const goodOrHigherCount = Object.values(evaluationsData).filter(s => {
        if (!s) return false;
        const sum = Object.values(s).reduce((a, b) => a + b, 0);
        return sum >= 15;
    }).length;
    const percentageGood = totalStudentsCount > 0 ? ((goodOrHigherCount / totalStudentsCount) * 100).toFixed(2) : '0.00';

    const currentStudent = Array.isArray(students) ? students.find(s => s.id === selectedStudentId) : null;

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <style jsx global>{`
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
                    
                    #non-printable, header, nav, .printable-individual, .printable-individual-all, .printable-summary { display: none !important; }
                    
                    body.print-mode-individual .printable-individual { display: block !important; }
                    body.print-mode-individual-all .printable-individual-all { display: block !important; }
                    body.print-mode-summary .printable-summary { display: block !important; }

                    .print-page { page-break-after: always; break-after: page; box-sizing: border-box; padding: 1cm; background: white; color: black; width: 100%; }
                    .print-page:last-child { page-break-after: auto; break-after: auto; }
                    @page { size: A4 portrait; margin: 1cm; }
                }
            `}</style>

            <div id="non-printable" className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white">ประเมินคุณลักษณะอันพึงประสงค์</h1>
                        <p className="text-gray-400 text-sm mt-1">เครื่องมือสำหรับครูที่ปรึกษา บันทึกและพิมพ์แบบประเมินรายบุคคลและสรุปผล</p>
                    </div>
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-semibold transition">← กลับ</button>
                </header>

                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ห้องเรียนที่รับผิดชอบ</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white font-medium">
                            {Array.isArray(classrooms) && classrooms.map(c => <option key={c} value={c}>ห้อง {c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ภาคเรียน / ปีการศึกษา</label>
                        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white font-medium">
                            {Array.isArray(semesters) && semesters.map(sem => <option key={sem} value={sem}>ภาคเรียนที่ {sem}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <div className="flex gap-4">
                        <button onClick={() => setActiveTab('evaluation')} className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'evaluation' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                            📝 บันทึกคะแนนรายบุคคล
                        </button>
                        <button onClick={() => setActiveTab('summary')} className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                            📊 สรุปผลการประเมินประจำห้อง
                        </button>
                    </div>

                    {activeTab === 'evaluation' && Array.isArray(students) && students.length > 0 && (
                        <button onClick={() => {
                            document.body.className = 'print-mode-individual-all';
                            window.print();
                            document.body.className = '';
                        }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition">
                            🖨️ พิมพ์แบบประเมินทั้งหมดในห้อง ({students.length} คน)
                        </button>
                    )}
                </div>

                {activeTab === 'evaluation' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm h-[650px] overflow-y-auto text-slate-900">
                            <h3 className="font-bold mb-4 text-sm text-slate-500 uppercase tracking-wider">รายชื่อนักเรียน ({Array.isArray(students) ? students.length : 0} คน)</h3>
                            <div className="space-y-2">
                                {Array.isArray(students) && students.map((s, idx) => {
                                    const isEval = !!evaluationsData[s.id];
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedStudentId(s.id)}
                                            className={`w-full text-left p-3 rounded-xl transition-all flex justify-between items-center ${selectedStudentId === s.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'}`}
                                        >
                                            <span className="text-sm truncate font-medium">{idx + 1}. {s.name}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isEval ? 'bg-green-100 text-green-700 font-semibold' : 'bg-slate-200 text-slate-600'}`}>
                                                {isEval ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-slate-900">
                            {currentStudent ? (
                                <div>
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">{currentStudent.name}</h2>
                                            <p className="text-xs text-slate-500 mt-1">ห้อง: {selectedClass} | ภาคเรียน: {selectedSemester}</p>
                                        </div>
                                        <button onClick={() => {
                                            document.body.className = 'print-mode-individual';
                                            window.print();
                                            document.body.className = '';
                                        }} className="bg-slate-900 text-white hover:bg-slate-800 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow transition">
                                            🖨️ พิมพ์แบบประเมินนี้
                                        </button>
                                    </div>

                                    <div className="space-y-6 text-sm">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <p className="font-bold text-indigo-600 mb-2">1. มีวินัย</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">1.1 แต่งกายสุภาพเรียบร้อยถูกต้องตามกฎระเบียบของโรงเรียน</span>
                                                    <select value={scores.q1_1} onChange={e => handleScoreChange('q1_1', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">1.2 เข้าร่วมกิจกรรมหน้าเสาธงตรงเวลา</span>
                                                    <select value={scores.q1_2} onChange={e => handleScoreChange('q1_2', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <p className="font-bold text-indigo-600 mb-2">2. ความรับผิดชอบ</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">2.1 ปฏิบัติงานร่วมกับผู้อื่นได้ ให้ความร่วมมือในการทำงานตามหน้าที่ที่ได้รับมอบหมาย</span>
                                                    <select value={scores.q2_1} onChange={e => handleScoreChange('q2_1', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">2.2 ปฏิบัติหน้าที่ที่ได้รับมอบหมายจนเสร็จเรียบร้อย</span>
                                                    <select value={scores.q2_2} onChange={e => handleScoreChange('q2_2', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <p className="font-bold text-indigo-600 mb-2">3. ความซื่อสัตย์</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">3.1 ไม่ถือเอาสิ่งของของผู้อื่นมาเป็นของตนเอง ไม่ลักขโมย</span>
                                                    <select value={scores.q3_1} onChange={e => handleScoreChange('q3_1', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">3.2 ปฏิบัติตน โดยคำนึงถึงความถูกต้อง ยุติธรรม ไม่เอาเปรียบหรือคดโกง</span>
                                                    <select value={scores.q3_2} onChange={e => handleScoreChange('q3_2', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <p className="font-bold text-indigo-600 mb-2">4. ความสนใจใฝ่เรียนรู้</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">4.1 ตั้งใจ เพียรพยายามในการเรียน สนใจเข้าร่วมกิจกรรมการเรียนรู้ต่าง ๆ</span>
                                                    <select value={scores.q4_1} onChange={e => handleScoreChange('q4_1', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">4.2 แสวงหา ศึกษา ค้นคว้าความรู้จากแหล่งเรียนรู้ต่าง ๆ</span>
                                                    <select value={scores.q4_2} onChange={e => handleScoreChange('q4_2', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <p className="font-bold text-indigo-600 mb-2">5. มีจิตสาธารณะ</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">5.1 มีน้ำใจเสียสละช่วยเหลือผู้อื่น เห็นแก่ประโยชน์ส่วนรวมมากกว่าส่วนตน</span>
                                                    <select value={scores.q5_1} onChange={e => handleScoreChange('q5_1', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-700 font-medium">5.2 เข้าร่วมกิจกรรมที่เป็นประโยชน์ต่อโรงเรียน ชุมชนและสังคม</span>
                                                    <select value={scores.q5_2} onChange={e => handleScoreChange('q5_2', e.target.value)} className="bg-white border border-slate-300 p-2 rounded-xl font-bold w-20 text-center text-slate-900">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-6">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">รวมคะแนนที่ได้ (เต็ม 30)</p>
                                                <p className="text-2xl font-bold text-slate-900">{totalScore} คะแนน</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">ระดับคุณภาพ</p>
                                                <p className={`text-xl font-bold px-3 py-0.5 rounded-lg ${qualityLevel === 'ดีเยี่ยม' ? 'bg-green-100 text-green-700' : qualityLevel === 'ดี' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {qualityLevel}
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={handleSave} disabled={isLoading} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02]">
                                            {isLoading ? 'กำลังบันทึก...' : '💾 บันทึกผลการประเมิน'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-20">กรุณาเลือกรายชื่อนักเรียนด้านซ้าย</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-slate-900">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">สรุปผลการประเมินคุณลักษณะอันพึงประสงค์</h2>
                                <p className="text-xs text-slate-500 mt-1">ห้อง: {selectedClass} | ภาคเรียน: {selectedSemester}</p>
                            </div>
                            <button onClick={() => {
                                document.body.className = 'print-mode-summary';
                                window.print();
                                document.body.className = '';
                            }} className="bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow transition">
                                🖨️ พิมพ์ใบสรุปผลประจำห้อง
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-200 text-center text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700">
                                        <th className="border border-slate-200 p-3">จำนวนนักเรียนทั้งหมด (คน)</th>
                                        <th className="border border-slate-200 p-3">จำนวนนักเรียนที่เข้ารับการประเมิน (คน)</th>
                                        <th className="border border-slate-200 p-3">จำนวนนักเรียนที่มีผลการประเมินระดับ "ดี" ขึ้นไป (คน)</th>
                                        <th className="border border-slate-200 p-3">ร้อยละ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="text-slate-900 font-medium">
                                        <td className="border border-slate-200 p-4 text-lg">{totalStudentsCount}</td>
                                        <td className="border border-slate-200 p-4 text-lg text-indigo-600 font-bold">{evaluatedStudentsCount}</td>
                                        <td className="border border-slate-200 p-4 text-lg text-green-600 font-bold">{goodOrHigherCount}</td>
                                        <td className="border border-slate-200 p-4 text-lg text-amber-600 font-bold">{percentageGood}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* พิมพ์รายบุคคล (คนปัจจุบัน) พร้อมโลโก้และวันที่พิมพ์ */}
            {currentStudent && (
                <div className="printable-individual hidden">
                    <div className="print-page">
                        <div className="flex items-center justify-between border-b pb-2 mb-3">
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" className="w-10" alt="Logo" />
                                <div>
                                    <h2 className="font-bold text-sm">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                                    <p className="text-[10px]">แบบประเมินด้านคุณลักษณะอันพึงประสงค์ของผู้เรียน ภาคเรียนที่ {selectedSemester}</p>
                                </div>
                            </div>
                            <div className="text-right text-[10px] font-semibold">
                                <p>วันที่พิมพ์: {printDateStr}</p>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs mb-2 font-semibold">
                            <p>ชื่อ - สกุล: {currentStudent.name}</p>
                            <p>ระดับชั้น: ปวช. / ปวส. | ห้อง: {selectedClass}</p>
                        </div>
                        <table className="w-full border-collapse border border-black text-xs mb-3">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-1.5 text-left">คุณลักษณะอันพึงประสงค์และตัวชี้วัด</th>
                                    <th className="border border-black p-1.5 w-16 text-center">คะแนน</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">1. มีวินัย</td></tr>
                                <tr><td className="border border-black p-1 pl-4">1.1 แต่งกายสุภาพเรียบร้อยถูกต้องตามกฎระเบียบของโรงเรียน</td><td className="border border-black p-1 text-center font-bold">{scores.q1_1}</td></tr>
                                <tr><td className="border border-black p-1 pl-4">1.2 เข้าร่วมกิจกรรมหน้าเสาธงตรงเวลา</td><td className="border border-black p-1 text-center font-bold">{scores.q1_2}</td></tr>
                                <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">2. ความรับผิดชอบ</td></tr>
                                <tr><td className="border border-black p-1 pl-4">2.1 ปฏิบัติงานร่วมกับผู้อื่นได้ ให้ความร่วมมือในการทำงานตามหน้าที่</td><td className="border border-black p-1 text-center font-bold">{scores.q2_1}</td></tr>
                                <tr><td className="border border-black p-1 pl-4">2.2 ปฏิบัติหน้าที่ที่ได้รับมอบหมายจนเสร็จเรียบร้อย</td><td className="border border-black p-1 text-center font-bold">{scores.q2_2}</td></tr>
                                <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">3. ความซื่อสัตย์</td></tr>
                                <tr><td className="border border-black p-1 pl-4">3.1 ไม่ถือเอาสิ่งของของผู้อื่นมาเป็นของตนเอง ไม่ลักขโมย</td><td className="border border-black p-1 text-center font-bold">{scores.q3_1}</td></tr>
                                <tr><td className="border border-black p-1 pl-4">3.2 ปฏิบัติตน โดยคำนึงถึงความถูกต้อง ไม่เอาเปรียบ</td><td className="border border-black p-1 text-center font-bold">{scores.q3_2}</td></tr>
                                <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">4. ความสนใจใฝ่เรียนรู้</td></tr>
                                <tr><td className="border border-black p-1 pl-4">4.1 ตั้งใจ เพียรพยายามในการเรียน สนใจเข้าร่วมกิจกรรม</td><td className="border border-black p-1 text-center font-bold">{scores.q4_1}</td></tr>
                                <tr><td className="border border-black p-1 pl-4">4.2 แสวงหา ศึกษา ค้นคว้าความรู้จากแหล่งเรียนรู้ต่าง ๆ</td><td className="border border-black p-1 text-center font-bold">{scores.q4_2}</td></tr>
                                <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">5. มีจิตสาธารณะ</td></tr>
                                <tr><td className="border border-black p-1 pl-4">5.1 มีน้ำใจช่วยเหลือผู้อื่น เห็นแก่ประโยชน์ส่วนรวมมากกว่าส่วนตน</td><td className="border border-black p-1 text-center font-bold">{scores.q5_1}</td></tr>
                                <tr><td className="border border-black p-1 pl-4">5.2 เข้าร่วมกิจกรรมที่เป็นประโยชน์ต่อโรงเรียน ชุมชนและสังคม</td><td className="border border-black p-1 text-center font-bold">{scores.q5_2}</td></tr>
                            </tbody>
                        </table>
                        <div className="flex justify-between font-bold text-xs mb-6 border p-2 border-black">
                            <p>รวมคะแนนที่ได้: {totalScore} คะแนน (เต็ม 30)</p>
                            <p>ระดับคุณภาพ: {qualityLevel}</p>
                        </div>
                        <div className="flex justify-end text-center text-xs mt-8">
                            <div className="w-56">
                                <p>ลงชื่อ......................................................</p>
                                <p className="mt-1">({userProfile?.name || '......................................................'})</p>
                                <p className="font-semibold mt-1">ผู้ประเมิน / ครูที่ปรึกษา</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* พิมพ์รายบุคคลทั้งหมดในห้อง พร้อมโลโก้และวันที่พิมพ์ */}
            <div className="printable-individual-all hidden">
                {Array.isArray(students) && students.map((stu) => {
                    const stuScores = evaluationsData[stu.id] || {
                        q1_1: 3, q1_2: 3, q2_1: 3, q2_2: 3, q3_1: 3, q3_2: 3, q4_1: 3, q4_2: 3, q5_1: 3, q5_2: 3
                    };
                    const res = calculateStudentScore(stuScores);
                    return (
                        <div key={stu.id} className="print-page">
                            <div className="flex items-center justify-between border-b pb-2 mb-3">
                                <div className="flex items-center gap-3">
                                    <img src="/logo.png" className="w-10" alt="Logo" />
                                    <div>
                                        <h2 className="font-bold text-sm">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                                        <p className="text-[10px]">แบบประเมินด้านคุณลักษณะอันพึงประสงค์ของผู้เรียน ภาคเรียนที่ {selectedSemester}</p>
                                    </div>
                                </div>
                                <div className="text-right text-[10px] font-semibold">
                                    <p>วันที่พิมพ์: {printDateStr}</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs mb-3 font-semibold">
                                <p>ชื่อ - สกุล: {stu.name}</p>
                                <p>ระดับชั้น: ปวช. / ปวส. | ห้อง: {selectedClass}</p>
                            </div>
                            <table className="w-full border-collapse border border-black text-xs mb-3">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1.5 text-left">คุณลักษณะอันพึงประสงค์และตัวชี้วัด</th>
                                        <th className="border border-black p-1.5 w-16 text-center">คะแนน</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">1. มีวินัย</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">1.1 แต่งกายสุภาพเรียบร้อยถูกต้องตามกฎระเบียบของโรงเรียน</td><td className="border border-black p-1 text-center font-bold">{stuScores.q1_1}</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">1.2 เข้าร่วมกิจกรรมหน้าเสาธงตรงเวลา</td><td className="border border-black p-1 text-center font-bold">{stuScores.q1_2}</td></tr>
                                    <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">2. ความรับผิดชอบ</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">2.1 ปฏิบัติงานร่วมกับผู้อื่นได้ ให้ความร่วมมือในการทำงานตามหน้าที่</td><td className="border border-black p-1 text-center font-bold">{stuScores.q2_1}</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">2.2 ปฏิบัติหน้าที่ที่ได้รับมอบหมายจนเสร็จเรียบร้อย</td><td className="border border-black p-1 text-center font-bold">{stuScores.q2_2}</td></tr>
                                    <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">3. ความซื่อสัตย์</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">3.1 ไม่ถือเอาสิ่งของของผู้อื่นมาเป็นของตนเอง ไม่ลักขโมย</td><td className="border border-black p-1 text-center font-bold">{stuScores.q3_1}</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">3.2 ปฏิบัติตน โดยคำนึงถึงความถูกต้อง ไม่เอาเปรียบ</td><td className="border border-black p-1 text-center font-bold">{stuScores.q3_2}</td></tr>
                                    <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">4. ความสนใจใฝ่เรียนรู้</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">4.1 ตั้งใจ เพียรพยายามในการเรียน สนใจเข้าร่วมกิจกรรม</td><td className="border border-black p-1 text-center font-bold">{stuScores.q4_1}</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">4.2 แสวงหา ศึกษา ค้นคว้าความรู้จากแหล่งเรียนรู้ต่าง ๆ</td><td className="border border-black p-1 text-center font-bold">{stuScores.q4_2}</td></tr>
                                    <tr><td className="border border-black p-1 font-bold bg-gray-50" colSpan="2">5. มีจิตสาธารณะ</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">5.1 มีน้ำใจช่วยเหลือผู้อื่น เห็นแก่ประโยชน์ส่วนรวมมากกว่าส่วนตน</td><td className="border border-black p-1 text-center font-bold">{stuScores.q5_1}</td></tr>
                                    <tr><td className="border border-black p-1 pl-4">5.2 เข้าร่วมกิจกรรมที่เป็นประโยชน์ต่อโรงเรียน ชุมชนและสังคม</td><td className="border border-black p-1 text-center font-bold">{stuScores.q5_2}</td></tr>
                                </tbody>
                            </table>
                            <div className="flex justify-between font-bold text-xs mb-6 border p-2 border-black">
                                <p>รวมคะแนนที่ได้: {res.total} คะแนน (เต็ม 30)</p>
                                <p>ระดับคุณภาพ: {res.level}</p>
                            </div>
                            <div className="flex justify-end text-center text-xs mt-8">
                                <div className="w-56">
                                    <p>ลงชื่อ......................................................</p>
                                    <p className="mt-1">({userProfile?.name || '......................................................'})</p>
                                    <p className="font-semibold mt-1">ผู้ประเมิน / ครูที่ปรึกษา</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* พิมพ์สรุปผลประจำห้อง พร้อมโลโก้และวันที่พิมพ์ */}
            <div className="printable-summary hidden">
                <div className="print-page">
                    <div className="flex items-center justify-between border-b pb-2 mb-4">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" className="w-12" alt="Logo" />
                            <div>
                                <h2 className="font-bold text-sm">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                                <h3 className="font-bold text-xs">สรุปผลการประเมินคุณลักษณะที่พึงประสงค์ของผู้เรียน</h3>
                            </div>
                        </div>
                        <div className="text-right text-xs font-semibold">
                            <p>วันที่พิมพ์: {printDateStr}</p>
                        </div>
                    </div>
                    
                    <div className="flex justify-between text-xs mb-4 font-semibold">
                        <p>ห้อง: {selectedClass}</p>
                        <p>ประจำภาคเรียนที่ {selectedSemester}</p>
                    </div>

                    <table className="w-full border-collapse border border-black text-xs text-center mb-16">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-3">จำนวนผู้เรียนที่เข้ารับการประเมินคุณลักษณะที่พึงประสงค์</th>
                                <th className="border border-black p-3">จำนวนผู้เรียนที่มีผลการประเมินคุณลักษณะที่พึงประสงค์ ระดับ ดี ขึ้นไป</th>
                                <th className="border border-black p-3 w-24">ร้อยละ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-4 font-bold text-sm">{evaluatedStudentsCount}</td>
                                <td className="border border-black p-4 font-bold text-sm">{goodOrHigherCount}</td>
                                <td className="border border-black p-4 font-bold text-sm">{percentageGood}%</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex justify-end text-center text-xs mt-20">
                        <div className="w-56">
                            <p>ลงชื่อ......................................................</p>
                            <p className="mt-1">({userProfile?.name || '......................................................'})</p>
                            <p className="font-semibold mt-1">ผู้ประเมิน / ครูที่ปรึกษา</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}