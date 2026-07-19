'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

export default function ConfigPage() {
    const router = useRouter();
    const [weights, setWeights] = useState({
        'มา': 0,
        'สาย': 1,
        'ลาครึ่งวัน': 0.5,
        'ลาทั้งวัน': 0.5,
        'ขาด': 1
    });

    const saveConfig = async () => {
        try {
            await setDoc(doc(db, "system_settings", "evaluation_weights"), weights);
            toast.success("บันทึกเกณฑ์สำเร็จ");
        } catch (error) {
            toast.error("บันทึกไม่สำเร็จ");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900">
            <Toaster />
            
            <div className="max-w-2xl mx-auto">
                {/* ปุ่มย้อนกลับแบบ Minimal */}
                <button 
                    onClick={() => router.back()} 
                    className="mb-8 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                    Back to Dashboard
                </button>

                {/* Card Container */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <header className="mb-8">
                        <h1 className="text-2xl font-bold tracking-tight">เกณฑ์การประเมิน</h1>
                        <p className="text-slate-500 mt-1">ตั้งค่าคะแนนถ่วงน้ำหนักสำหรับกิจกรรมและพฤติกรรม</p>
                    </header>
                    
                    <div className="space-y-4">
                        {Object.keys(weights).map(key => (
                            <div key={key} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all">
                                <span className="font-semibold text-slate-700">{key}</span>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={weights[key]} 
                                    onChange={e => setWeights({...weights, [key]: parseFloat(e.target.value) || 0})}
                                    className="w-20 bg-slate-50 border-0 rounded-xl py-2 px-3 text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={saveConfig} 
                        className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200"
                    >
                        บันทึกการตั้งค่า
                    </button>
                </div>
            </div>
        </div>
    );
}