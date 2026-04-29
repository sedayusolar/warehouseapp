'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const [transaction, setTransaction] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [managerComment, setManagerComment] = useState('');

    const API_KEY = "SedayuSolar_TopSecret_2026";
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => { fetchDetail(); }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') setTransaction(result);
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    const handleStatusUpdate = async (status: 'APPROVED' | 'REJECTED') => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (status === 'APPROVED' && (!signatureBase64 || signatureBase64.length < 2000)) { alert("Signature required!"); return; }

        setSubmitting(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/update_approval.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ id, status, comment: managerComment, manager_signature_base64: status === 'APPROVED' ? signatureBase64 : '' })
            });
            const result = await res.json();
            if (result.status === 'success') { alert(`Done!`); router.push('/transactions'); }
        } catch (e) { alert("Error"); }
        setSubmitting(false);
    };

    // TTD Logic omitted for brevity but remains the same...
    const startDrawing = (e: any) => { /* same as before */ };
    const draw = (e: any) => { /* same as before */ };

    if (loading) return <div className="p-20 text-center font-black animate-pulse text-slate-400">LOADING...</div>;
    if (!transaction) return <div className="p-20 text-center">Not Found</div>;

    const { header, items } = transaction;

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
            <div className="bg-slate-900 p-6 text-white flex justify-between shadow-lg sticky top-0 z-10">
                <div><h1 className="text-xl font-bold">{header.project_name}</h1><p className="text-[10px] text-slate-400">{header.transaction_code}</p></div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 px-4 rounded-full text-xs">Tutup</button>
            </div>
            <div className="p-4 max-w-2xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Project</p>
                    <p className="font-bold text-lg">{header.project_name}</p>
                    <div className="grid grid-cols-2 pt-2">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">PIC</p><p className="font-bold text-sm">{header.pic_name}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase">Date</p><p className="font-bold text-sm">{header.checkout_date}</p></div>
                    </div>
                </div>
                {/* Item List & Approval Form (Same UI as before, just ensure handleSubmit is updated) */}
                {header.manager_approval_status === 'PENDING' && (
                    <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 space-y-4">
                        <h2 className="text-center font-black text-[10px] text-blue-600 uppercase tracking-widest">Manager Confirmation</h2>
                        <textarea value={managerComment} onChange={e => setManagerComment(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-sm" placeholder="Catatan..." />
                        <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-48 bg-slate-50 border rounded-2xl touch-none" />
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleStatusUpdate('REJECTED')} className="bg-slate-100 py-4 rounded-2xl font-black text-[10px]">REJECT</button>
                            <button onClick={() => handleStatusUpdate('APPROVED')} className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px]">APPROVE</button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}