'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function HomeroomManagementPage() {
    const router = useRouter();
    const [userProfile, setUserProfile] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [savedRecords, setSavedRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        academicYear: '2569',
        semester: '1',
        month: 'มิถุนายน',
        date: new Date().toISOString().split('T')[0],
        classId: '',
        activityTopic: '',
        description: '',
        imageUrl: ''
    });

    const [printData, setPrintData] = useState(null);
    const [allPrintData, setAllPrintData] = useState(null);
    const [printCoverData, setPrintCoverData] = useState(null);

    const monthsList = [
        'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม',
        'พฤศจิกายน', 'ธันวาคม', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน'
    ];

    useEffect(() => {
        const init = async () => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) return router.push('/');
                
                const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
                if (!snap.empty) {
                    const prof = snap.docs[0].data();
                    setUserProfile(prof);

                    let availableClasses = [];
                    if (prof.role === 'admin') {
                        const classSnap = await getDocs(collection(db, "classrooms"));
                        const classes = classSnap.docs.map(d => {
                            const data = d.data();
                            return data.department ? `${data.className} ${data.department}` : data.className;
                        });
                        availableClasses = [...new Set(classes)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    } else {
                        availableClasses = prof.assignedClasses || [];
                    }

                    setClassrooms(availableClasses);
                    if (availableClasses.length > 0) {
                        setFormData(prev => ({ ...prev, classId: availableClasses[0] }));
                    }
                }
                fetchHomeroomRecords();
            });
        };
        init();
    }, [router]);

    const fetchHomeroomRecords = async () => {
        try {
            const snap = await getDocs(query(collection(db, "homeroom_records"), orderBy("date", "asc")));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSavedRecords(list);
        } catch (err) {
            console.error(err);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, imageUrl: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.classId) {
            toast.error("กรุณาเลือกห้องเรียน");
            return;
        }

        setIsLoading(true);
        try {
            await addDoc(collection(db, "homeroom_records"), {
                ...formData,
                teacherName: userProfile?.name || 'คุณครูที่ปรึกษา',
                createdAt: serverTimestamp()
            });
            toast.success("บันทึกข้อมูล Homeroom สำเร็จ");
            fetchHomeroomRecords();
            setFormData(prev => ({ ...prev, activityTopic: '', description: '', imageUrl: '' }));
        } catch (err) {
            console.error(err);
            toast.error("บันทึกไม่สำเร็จ: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("ยืนยันการลบบันทึกนี้?")) return;
        try {
            await deleteDoc(doc(db, "homeroom_records", id));
            toast.success("ลบสำเร็จ");
            fetchHomeroomRecords();
        } catch (err) {
            toast.error("ลบไม่สำเร็จ");
        }
    };

    const handlePrintRecord = (record) => {
        setAllPrintData(null);
        setPrintCoverData(null);
        setPrintData(record);
        setTimeout(() => { window.print(); }, 300);
    };

    const handlePrintCover = (classId) => {
        setPrintData(null);
        setAllPrintData(null);
        setPrintCoverData({
            classId: classId || classrooms[0],
            academicYear: formData.academicYear,
            semester: formData.semester,
            teacherName: userProfile?.name || 'คุณครูที่ปรึกษา'
        });
        setTimeout(() => { window.print(); }, 300);
    };

    const handlePrintAll = (classId) => {
        setPrintData(null);
        setPrintCoverData(null);
        const filtered = savedRecords.filter(r => r.classId === classId);
        if (filtered.length === 0) {
            toast.error("ไม่พบข้อมูลบันทึกโฮมรูมของห้องนี้");
            return;
        }
        setAllPrintData({
            classId: classId,
            records: filtered,
            academicYear: formData.academicYear,
            semester: formData.semester,
            teacherName: userProfile?.name || 'คุณครูที่ปรึกษา'
        });
        setTimeout(() => { window.print(); }, 300);
    };

    const formatDateThai = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gray-950 p-6 text-white">
            <Toaster position="top-center" />
            <style jsx global>{`
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background: transparent !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    #non-printable { display: none !important; }
                    #printable-area, #printable-cover, #printable-all {
                        display: block !important;
                        background: #ffffff !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0.5cm !important;
                    }
                    .cover-page {
                        height: 23cm !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        text-align: center !important;
                        page-break-after: always;
                    }
                    .page-break { page-break-after: always; }
                    @page { size: A4 portrait; margin: 1cm; }
                }
                #printable-area, #printable-cover, #printable-all { display: none; }
            `}</style>

            <div id="non-printable" className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">บันทึกกิจกรรมโฮมรูม (Homeroom)</h1>
                        <p className="text-gray-400 mt-1">บันทึกผลการปฏิบัติงานครูที่ปรึกษาและกิจกรรมโฮมรูมนักศึกษา</p>
                    </div>
                    <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-xl">← กลับ</button>
                </header>

                <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-lg text-emerald-400">🖨️ จัดการพิมพ์เอกสารรวมห้อง</h3>
                        <p className="text-xs text-gray-400 mt-1">เลือกห้องเพื่อพิมพ์หน้าปกหรือพิมพ์รายงานรวมทุกเดือนในภาคเรียนนี้</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={() => handlePrintCover(formData.classId)}
                            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2"
                        >
                            📖 พิมพ์หน้าปกรายงาน
                        </button>
                        <button 
                            onClick={() => handlePrintAll(formData.classId)}
                            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2"
                        >
                            📚 สั่งพิมพ์รายงานทั้งหมด (ทุกเดือน)
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl mb-10">
                    <h2 className="text-xl font-bold mb-6 text-indigo-400">📝 ฟอร์มบันทึกกิจกรรมประจำเดือน</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ห้องเรียนที่รับผิดชอบ</label>
                            <select 
                                value={formData.classId} 
                                onChange={e => setFormData({...formData, classId: e.target.value})} 
                                className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white"
                                required
                            >
                                {classrooms.length > 0 ? (
                                    classrooms.map(c => <option key={c} value={c}>ห้อง {c}</option>)
                                ) : (
                                    <option value="">ไม่พบห้องที่รับผิดชอบ</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">ประจำเดือน</label>
                            <select 
                                value={formData.month} 
                                onChange={e => setFormData({...formData, month: e.target.value})} 
                                className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white"
                            >
                                {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">วันที่จัดกิจกรรม</label>
                            <input 
                                type="date" 
                                value={formData.date} 
                                onChange={e => setFormData({...formData, date: e.target.value})} 
                                className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">หัวข้อ / เรื่องที่ทำกิจกรรมโฮมรูม</label>
                        <input 
                            type="text" 
                            value={formData.activityTopic} 
                            onChange={e => setFormData({...formData, activityTopic: e.target.value})} 
                            placeholder="เช่น อบรมคุณธรรม จริยธรรม และเตรียมความพร้อมก่อนเข้าเรียน"
                            className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white placeholder-gray-600"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">รายละเอียดผลการปฏิบัติงาน / กิจกรรมที่ทำร่วมกับนักศึกษา</label>
                        <textarea 
                            rows="4"
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                            placeholder="เช่น ครูที่ปรึกษาได้พบปะพูดคุยกับนักเรียน ตรวจสอบการแต่งกาย ความสะอาดเรียบร้อย และแจ้งกำหนดการกิจกรรมต่างๆ ภายในวิทยาลัย"
                            className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white placeholder-gray-600"
                            required
                        />
                    </div>

                    <div className="mb-8">
                        <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase">แนบรูปถ่ายกิจกรรมโฮมรูม</label>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="w-full p-3 bg-gray-950 rounded-xl border border-gray-800 text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                        />
                        {formData.imageUrl && (
                            <div className="mt-4">
                                <p className="text-xs text-green-400 mb-2">✅ แนบรูปภาพเรียบร้อยแล้ว:</p>
                                <img src={formData.imageUrl} alt="Preview" className="w-48 h-32 object-cover rounded-xl border border-gray-700" />
                            </div>
                        )}
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition-all shadow-lg"
                    >
                        {isLoading ? 'กำลังบันทึกข้อมูล...' : '💾 บันทึกข้อมูล Homeroom ประจำเดือน'}
                    </button>
                </form>

                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">
                    <h2 className="text-xl font-bold mb-4 text-gray-200">📂 ประวัติบันทึกกิจกรรมโฮมรูมทั้งหมด</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-800">
                                    <th className="p-3">ประจำเดือน</th>
                                    <th className="p-3">วันที่</th>
                                    <th className="p-3">ห้อง</th>
                                    <th className="p-3">หัวข้อกิจกรรม</th>
                                    <th className="p-3 text-center">จัดการ / พิมพ์</th>
                                </tr>
                            </thead>
                            <tbody>
                                {savedRecords.length > 0 ? (
                                    savedRecords.map(rec => (
                                        <tr key={rec.id} className="border-b border-gray-800 hover:bg-gray-950">
                                            <td className="p-3 font-semibold text-indigo-400">{rec.month}</td>
                                            <td className="p-3">{formatDateThai(rec.date)}</td>
                                            <td className="p-3 font-semibold">{rec.classId}</td>
                                            <td className="p-3">{rec.activityTopic}</td>
                                            <td className="p-3 flex justify-center gap-2">
                                                <button 
                                                    onClick={() => handlePrintRecord(rec)}
                                                    className="bg-white text-black hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                                                >
                                                    🖨️ พิมพ์หน้านี้
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(rec.id)}
                                                    className="bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                                                >
                                                    ลบ
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-6 text-center text-gray-500">ยังไม่มีประวัติการบันทึกข้อมูลโฮมรูม</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 1. ส่วนสำหรับพิมพ์หน้าปก (Cover Page) - เพิ่มขนาดโลโก้และจัดขนาดให้อยู่ใน 1 หน้าเป๊ะ */}
            {printCoverData && (
                <div id="printable-cover">
                    <div className="cover-page pt-2">
                        <div className="flex flex-col items-center">
                            <img src="/logo.png" className="w-28 mb-4" alt="Logo" />
                            <h2 className="text-2xl font-extrabold mb-2 leading-snug">รายงานกิจกรรมโฮมรูม<br/>(Homeroom Report)</h2>
                            <p className="text-base font-semibold text-gray-800 mt-2">ประจำห้องเรียน: {printCoverData.classId}</p>
                            <p className="text-sm text-gray-600 mt-1">ภาคเรียนที่ {printCoverData.semester} ปีการศึกษา {printCoverData.academicYear}</p>
                            
                            <div className="mt-12">
                                <p className="mb-1 text-xs">จัดทำโดย</p>
                                <p className="font-bold text-sm">({printCoverData.teacherName})</p>
                                <p className="text-xs text-gray-700">ครูที่ปรึกษาประจำห้องเรียน</p>
                            </div>
                        </div>

                        {/* ชื่อวิทยาลัยด้านล่างสุด */}
                        <div className="border-t border-gray-400 pt-2 w-full pb-1">
                            <h1 className="text-sm font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h1>
                            <p className="text-xs text-gray-600">Sichon Commercial Technological College</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. ส่วนสำหรับพิมพ์ทีละรายการ (Single Record) */}
            {printData && (
                <div id="printable-area">
                    <div className="flex items-center justify-center gap-6 mb-6 border-b pb-4">
                        <img src="/logo.png" className="w-16" alt="Logo" />
                        <div className="text-center">
                            <h2 className="text-xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                            <p className="text-sm font-semibold">บันทึกผลการปฏิบัติงานกิจกรรมโฮมรูม (Homeroom)</p>
                            <p className="text-xs text-gray-600 mt-1">ประจำเดือน {printData.month} ภาคเรียนที่ {printData.semester} ปีการศึกษา {printData.academicYear}</p>
                        </div>
                    </div>

                    <div className="mb-6 text-sm space-y-2">
                        <p><strong>ห้องเรียน:</strong> {printData.classId}</p>
                        <p><strong>วันที่จัดกิจกรรม:</strong> {formatDateThai(printData.date)}</p>
                        <p><strong>หัวข้อกิจกรรม:</strong> {printData.activityTopic}</p>
                    </div>

                    <div className="mb-8 border p-4 rounded-xl text-sm leading-relaxed min-h-[120px]">
                        <p className="font-semibold mb-2">รายละเอียดกิจกรรม / ผลการปฏิบัติงาน:</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{printData.description}</p>
                    </div>

                    {printData.imageUrl && (
                        <div className="mb-8 text-center">
                            <p className="font-semibold text-sm mb-3">ภาพถ่ายกิจกรรมโฮมรูมประจำเดือน {printData.month}</p>
                            <img src={printData.imageUrl} alt="Homeroom Activity" className="max-w-md mx-auto max-h-72 object-contain rounded-xl border border-gray-400 p-1 shadow" />
                        </div>
                    )}

                    <div className="flex justify-between mt-16 text-center text-xs">
                        <div className="w-56">
                            <p>ลงชื่อ......................................................</p>
                            <p className="mt-1 font-semibold">({printData.teacherName})</p>
                            <p className="mt-1">ครูที่ปรึกษา</p>
                        </div>
                        <div className="w-56">
                            <p>ลงชื่อ......................................................</p>
                            <p className="mt-1 font-semibold">(นายภวุฒิ มันเหมาะ)</p>
                            <p className="mt-1">รองผู้อำนวยการฝ่ายกิจการนักเรียน นักศึกษา</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. ส่วนสำหรับพิมพ์รายงานทั้งหมดในเทอม (All Records Combined) */}
            {allPrintData && (
                <div id="printable-all">
                    {/* หน้าปกเล่มรวม */}
                    <div className="cover-page pt-2">
                        <div className="flex flex-col items-center">
                            <img src="/logo.png" className="w-28 mb-4" alt="Logo" />
                            <h2 className="text-2xl font-extrabold mb-2 leading-snug">รายงานกิจกรรมโฮมรูม<br/>(Homeroom Report)</h2>
                            <p className="text-base font-semibold text-gray-800 mt-2">ประจำห้องเรียน: {allPrintData.classId}</p>
                            <p className="text-sm text-gray-600 mt-1">ภาคเรียนที่ {allPrintData.semester} ปีการศึกษา {allPrintData.academicYear}</p>
                            
                            <div className="mt-12">
                                <p className="mb-1 text-xs">จัดทำโดย</p>
                                <p className="font-bold text-sm">({allPrintData.teacherName})</p>
                                <p className="text-xs text-gray-700">ครูที่ปรึกษาประจำห้องเรียน</p>
                            </div>
                        </div>
                        <div className="border-t border-gray-400 pt-2 w-full pb-1">
                            <h1 className="text-sm font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h1>
                            <p className="text-xs text-gray-600">Sichon Commercial Technological College</p>
                        </div>
                    </div>

                    {/* รายละเอียดแต่ละเดือน */}
                    {allPrintData.records.map((rec, index) => (
                        <div key={rec.id} className={index < allPrintData.records.length - 1 ? "page-break mb-12" : ""}>
                            <div className="flex items-center justify-center gap-6 mb-6 border-b pb-4">
                                <img src="/logo.png" className="w-16" alt="Logo" />
                                <div className="text-center">
                                    <h2 className="text-xl font-bold">วิทยาลัยเทคโนโลยีพณิชยการสิชล</h2>
                                    <p className="text-sm font-semibold">บันทึกผลการปฏิบัติงานกิจกรรมโฮมรูม (Homeroom)</p>
                                    <p className="text-xs text-gray-600 mt-1">ประจำเดือน {rec.month} ภาคเรียนที่ {allPrintData.semester} ปีการศึกษา {allPrintData.academicYear}</p>
                                </div>
                            </div>

                            <div className="mb-6 text-sm space-y-2">
                                <p><strong>ห้องเรียน:</strong> {rec.classId}</p>
                                <p><strong>วันที่จัดกิจกรรม:</strong> {formatDateThai(rec.date)}</p>
                                <p><strong>หัวข้อกิจกรรม:</strong> {rec.activityTopic}</p>
                            </div>

                            <div className="mb-8 border p-4 rounded-xl text-sm leading-relaxed min-h-[120px]">
                                <p className="font-semibold mb-2">รายละเอียดกิจกรรม / ผลการปฏิบัติงาน:</p>
                                <p className="text-gray-800 whitespace-pre-wrap">{rec.description}</p>
                            </div>

                            {rec.imageUrl && (
                                <div className="mb-8 text-center">
                                    <p className="font-semibold text-sm mb-3">ภาพถ่ายกิจกรรมโฮมรูมประจำเดือน {rec.month}</p>
                                    <img src={rec.imageUrl} alt="Homeroom Activity" className="max-w-md mx-auto max-h-72 object-contain rounded-xl border border-gray-400 p-1 shadow" />
                                </div>
                            )}

                            <div className="flex justify-between mt-16 text-center text-xs">
                                <div className="w-56">
                                    <p>ลงชื่อ......................................................</p>
                                    <p className="mt-1 font-semibold">({allPrintData.teacherName})</p>
                                    <p className="mt-1">ครูที่ปรึกษา</p>
                                </div>
                                <div className="w-56">
                                    <p>ลงชื่อ......................................................</p>
                                    <p className="mt-1 font-semibold">(นายภวุฒิ มันเหมาะ)</p>
                                    <p className="mt-1">รองผู้อำนวยการฝ่ายกิจการนักเรียน นักศึกษา</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}