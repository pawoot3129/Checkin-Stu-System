'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

const semesters = ['1/2569', '2/2569', '1/2568', '2/2568'];

export default function DesirableCharacteristicsPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('1/2569');
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [activeTab, setActiveTab] = useState('evaluation'); // 'evaluation' หรือ 'summary'
    const [isLoading, setIsLoading] = useState(false);

    const [scores, setScores] = useState({
        q1_1: 3, q1_2: 3,
        q2_1: 3, q2_2: 3,
        q3_1: 3, q3_2: 3,
        q4_1: 3, q4_2: 3,
        q5_1: 3, q5_2: 3
    });

    const [evaluationsData, setEvaluationsData] = useState({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
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
                    setClassrooms([...new Set(classes)]);
                    if (classes.length > 0) setSelectedClass(classes[0]);
                }
            } else { router.push('/'); }
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

            const evalSnap = await getDocs(query(collection(db, "desirable_evaluations"), where("classId", "==", selectedClass), where("semester", "==", selectedSemester)));
            const evalMap = {};
            evalSnap.forEach(d => {
                const data = d.data();
                evalMap[data.studentId] = data.scores;
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
    }, [selectedStudentId]);

    const handleScoreChange = (key, val) => {
        setScores(prev => ({ ...prev, [key]: Number(val) }));
    };

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const getQualityLevel = (score) => {
        if (score >= 23) return 'ดีเยี่ยม';
        if (score >= 15) return 'ดี';
        return 'พอใช้';
    };
    const qualityLevel = getQualityLevel(totalScore);

    const handleSave = async () => {
        if (!selectedStudentId) return;
        setIsLoading(true);
        try {
            const docId = `${selectedClass}_${selectedSemester}_${selectedStudentId}`;
            await setDoc(doc(db, "desirable_evaluations", docId), {
                classId: selectedClass,
                semester: selectedSemester,
                studentId: selectedStudentId,
                scores,
                totalScore,
                qualityLevel,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setEvaluationsData(prev => ({ ...prev, [selectedStudentId]: scores }));
            toast.success("บันทึกผลการประเมินสำเร็จ");
        } catch (e) {
            console.error(e);
            toast.error("บันทึกไม่สำเร็จ");
        } finally {
            setIsLoading(false);
        }
    };

    const totalStudentsCount = students.length;
    const evaluatedStudentsCount = Object.keys(evaluationsData).length;
    const goodOrHigherCount = Object.values(evaluationsData).filter(s => {
        const sum = Object.values(s).reduce((a, b) => a + b, 0);
        return sum >= 15;
    }).length;
    const percentageGood = totalStudentsCount > 0 ? ((goodOrHigherCount / totalStudentsCount) * 100).toFixed(2) : '0.00';

    const currentStudent = students.find(s => s.id === selectedStudentId);

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <style jsx global>{`
                @media print {
                    body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
                    #non-printable { display: none !important; }
                    .printable-individual, .printable-summary { display: none !important; }
                    
                    /* ควบคุมการแสดงผลตามหน้าต่างที่เลือกพิมพ์ */
                    body.print-mode-individual .printable-individual { display: block !important; }
                    body.print-mode-summary .printable-summary { display: block !important; }

                    .print-page { page-break-after: always; break-after: page; box-sizing: border-box; padding: 1.5cm; background: white; color: black; width: 100%; }
                    @page { size: A4 portrait; margin: 1cm; }
                }
            `}</style>

            <div id="non-printable" className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold">ประเมินคุณลักษณะอันพึงประสงค์</h1>
                        <p className="text-gray-400 text-sm mt-1">เครื่องมือสำหรับครูที่ปรึกษา บันทึกและพิมพ์แบบประเมินรายบุคคลและสรุปผล</p>
                    </div>
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl">← กลับ</button>
                </header>

                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ห้องเรียนที่รับผิดชอบ</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white">
                            {classrooms.map(c => <option key={c} value={c}>ห้อง {c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ภาคเรียน / ปีการศึกษา</label>
                        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white">
                            {semesters.map(sem => <option key={sem} value={sem}>ภาคเรียนที่ {sem}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-4 mb-6">
                    <button onClick={() => setActiveTab('evaluation')} className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'evaluation' ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                        📝 บันทึกคะแนนรายบุคคล
                    </button>
                    <button onClick={() => setActiveTab('summary')} className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'summary' ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                        📊 สรุปผลการประเมินประจำห้อง
                    </button>
                </div>

                {activeTab === 'evaluation' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="bg-gray-900 p-4 rounded-3xl border border-gray-800 h-[650px] overflow-y-auto">
                            <h3 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">รายชื่อนักเรียน ({students.length} คน)</h3>
                            <div className="space-y-2">
                                {students.map((s, idx) => {
                                    const isEval = !!evaluationsData[s.id];
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedStudentId(s.id)}
                                            className={`w-full text-left p-3 rounded-xl transition-all flex justify-between items-center ${selectedStudentId === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-950 hover:bg-gray-800 text-gray-300'}`}
                                        >
                                            <span className="text-sm truncate">{idx + 1}. {s.name}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isEval ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                                                {isEval ? 'ประเมินแล้ว' : 'ยังไม่ประเมิน'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lg:col-span-3 bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                            {currentStudent ? (
                                <div>
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
                                        <div>
                                            <h2 className="text-xl font-bold">{currentStudent.name}</h2>
                                            <p className="text-xs text-gray-400 mt-1">ห้อง: {selectedClass} | ภาคเรียน: {selectedSemester}</p>
                                        </div>
                                        <button onClick={() => {
                                            document.body.className = 'print-mode-individual';
                                            window.print();
                                            document.body.className = '';
                                        }} className="bg-white text-black hover:bg-gray-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2">
                                            🖨️ พิมพ์แบบประเมินนี้
                                        </button>
                                    </div>

                                    <div className="space-y-6 text-sm">
                                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                                            <p className="font-bold text-indigo-400 mb-2">1. มีวินัย</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">1.1 แต่งกายสุภาพเรียบร้อยถูกต้องตามกฎระเบียบของโรงเรียน</span>
                                                    <select value={scores.q1_1} onChange={e => handleScoreChange('q1_1', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">1.2 เข้าร่วมกิจกรรมหน้าเสาธงตรงเวลา</span>
                                                    <select value={scores.q1_2} onChange={e => handleScoreChange('q1_2', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                                            <p className="font-bold text-indigo-400 mb-2">2. ความรับผิดชอบ</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">2.1 ปฏิบัติงานร่วมกับผู้อื่นได้ ให้ความร่วมมือในการทำงานตามหน้าที่ที่ได้รับมอบหมาย</span>
                                                    <select value={scores.q2_1} onChange={e => handleScoreChange('q2_1', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">2.2 ปฏิบัติหน้าที่ที่ได้รับมอบหมายจนเสร็จเรียบร้อย</span>
                                                    <select value={scores.q2_2} onChange={e => handleScoreChange('q2_2', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                                            <p className="font-bold text-indigo-400 mb-2">3. ความซื่อสัตย์</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">3.1 ไม่ถือเอาสิ่งของของผู้อื่นมาเป็นของตนเอง ไม่ลักขโมย</span>
                                                    <select value={scores.q3_1} onChange={e => handleScoreChange('q3_1', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">3.2 ปฏิบัติตน โดยคำนึงถึงความถูกต้อง ยุติธรรม ไม่เอาเปรียบหรือคดโกง</span>
                                                    <select value={scores.q3_2} onChange={e => handleScoreChange('q3_2', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                                            <p className="font-bold text-indigo-400 mb-2">4. ความสนใจใฝ่เรียนรู้</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">4.1 ตั้งใจ เพียรพยายามในการเรียน สนใจเข้าร่วมกิจกรรมการเรียนรู้ต่าง ๆ</span>
                                                    <select value={scores.q4_1} onChange={e => handleScoreChange('q4_1', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">4.2 แสวงหา ศึกษา ค้นคว้าความรู้จากแหล่งเรียนรู้ต่าง ๆ</span>
                                                    <select value={scores.q4_2} onChange={e => handleScoreChange('q4_2', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                                            <p className="font-bold text-indigo-400 mb-2">5. มีจิตสาธารณะ</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">5.1 มีน้ำใจเสียสละช่วยเหลือผู้อื่น เห็นแก่ประโยชน์ส่วนรวมมากกว่าส่วนตน</span>
                                                    <select value={scores.q5_1} onChange={e => handleScoreChange('q5_1', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300">5.2 เข้าร่วมกิจกรรมที่เป็นประโยชน์ต่อโรงเรียน ชุมชนและสังคม</span>
                                                    <select value={scores.q5_2} onChange={e => handleScoreChange('q5_2', e.target.value)} className="bg-gray-900 border border-gray-700 p-2 rounded-xl font-bold w-20 text-center">
                                                        <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 p-6 bg-indigo-950/40 border border-indigo-900/50 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-6">
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase">รวมคะแนนที่ได้ (เต็ม 30)</p>
                                                <p className="text-2xl font-bold text-white">{totalScore} คะแนน</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase">ระดับคุณภาพ</p>
                                                <p className={`text-xl font-bold px-3 py-0.5 rounded-lg ${qualityLevel === 'ดีเยี่ยม' ? 'bg-green-500/20 text-green-400' : qualityLevel === 'ดี' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                    {qualityLevel}
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={handleSave} disabled={isLoading} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02]">
                                            {isLoading ? 'กำลังบันทึก...' : '💾 บันทึกผลการประเมิน'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-20">กรุณาเลือกรายชื่อนักเรียนด้านซ้าย</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
                            <div>
                                <h2 className="text-xl font-bold">สรุปผลการประเมินคุณลักษณะอันพึงประสงค์</h2>
                                <p className="text-xs text-gray-400 mt-1">ห้อง: {selectedClass} | ภาคเรียน: {selectedSemester}</p>
                            </div>
                            <button onClick={() => {
                                document.body.className = 'print-mode-summary';
                                window.print();
                                document.body.className = '';
                            }} className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                                🖨️ พิมพ์ใบสรุปผลประจำห้อง
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-700 text-center text-sm">
                                <thead>
                                    <tr className="bg-gray-800">
                                        <th className="border border-gray-700 p-3">จำนวนนักเรียนทั้งหมด (คน)</th>
                                        <th className="border border-gray-700 p-3">จำนวนนักเรียนที่เข้ารับการประเมิน (คน)</th>
                                        <th className="border border-gray-700 p-3">จำนวนนักเรียนที่มีผลการประเมินระดับ "ดี" ขึ้นไป (คน)</th>
                                        <th className="border border-gray-700 p-3">ร้อยละ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-gray-700 p-4 font-bold text-lg">{totalStudentsCount}</td>
                                        <td className="border border-gray-700 p-4 font-bold text-lg text-indigo-400">{evaluatedStudentsCount}</td>
                                        <td className="border border-gray-700 p-4 font-bold text-lg text-green-400">{goodOrHigherCount}</td>
                                        <td className="border border-gray-700 p-4 font-bold text-lg text-amber-400">{percentageGood}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ส่วนที่ 1: พิมพ์แบบประเมินรายบุคคล */}
            {currentStudent && (
                <div className="printable-individual hidden">
                    <div className="print-page">
                        <h2 className="text-center font-bold text-lg mb-1">แบบประเมินด้านคุณลักษณะอันพึงประสงค์ของผู้เรียน</h2>
                        <p className="text-center text-sm mb-4">ประจำภาคเรียนที่ {selectedSemester}</p>
                        <div className="flex justify-between text-sm mb-2 font-semibold">
                            <p>ชื่อ - สกุล: {currentStudent.name}</p>
                            <p>ระดับชั้น: ปวช. / ปวส. | ห้อง: {selectedClass}</p>
                        </div>
                        <table className="w-full border-collapse border border-black text-xs mb-4">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-2 text-left">คุณลักษณะอันพึงประสงค์และตัวชี้วัด</th>
                                    <th className="border border-black p-2 w-20">ระดับคุณภาพ</th>
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
                        <div className="flex justify-between font-bold text-sm mb-10 border p-2 border-black">
                            <p>รวมคะแนนที่ได้: {totalScore} คะแนน</p>
                            <p>ระดับคุณภาพ: {qualityLevel}</p>
                        </div>
                        <div className="flex justify-end text-center text-sm mt-12">
                            <div className="w-64">
                                <p>ลงชื่อ......................................................</p>
                                <p className="mt-1">({userProfile?.name || '......................................................'})</p>
                                <p className="font-semibold mt-1">ผู้ประเมิน / ครูที่ปรึกษา</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ส่วนที่ 2: พิมพ์ใบสรุปผลประจำห้อง (ตามฟอร์มในรูป Excel ที่ 2 เป๊ะๆ) */}
            <div className="printable-summary hidden">
                <div className="print-page">
                    <h2 className="text-center font-bold text-lg mb-1">สรุปผลการประเมินคุณลักษณะที่พึงประสงค์ของผู้เรียน</h2>
                    <p className="text-center text-sm mb-6">ภาคเรียนที่ {selectedSemester}</p>
                    
                    <div className="flex justify-between text-sm mb-4 font-semibold">
                        <p>ห้อง: {selectedClass}</p>
                        <p>วิทยาลัยเทคโนโลยีพณิชยการสิชล</p>
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
                                <td className="border border-black p-4 font-bold text-base">{evaluatedStudentsCount}</td>
                                <td className="border border-black p-4 font-bold text-base">{goodOrHigherCount}</td>
                                <td className="border border-black p-4 font-bold text-base">{percentageGood}%</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex justify-end text-center text-sm mt-20">
                        <div className="w-64">
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