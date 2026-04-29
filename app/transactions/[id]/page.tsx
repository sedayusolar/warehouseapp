'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params); // Unwrapping params sesuai standar Next.js terbaru

    const [transaction, setTransaction] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [managerComment, setManagerComment] = useState('');

    // Ref untuk Canvas Tanda Tangan Manager
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${id}`);
            const result = await res.json();
            if (result.status === 'success') {
                setTransaction(result);
            }
        } catch (error) {
            console.error("Gagal ambil detail:", error);
        }
        setLoading(false);
    };

    // --- LOGIC TANDA TANGAN MANAGER ---
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e293b'; // Warna Slate-800
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.lineTo(x, y);
        ctx.stroke();
        if (e.touches) e.preventDefault(); // Mencegah scroll saat tanda tangan di HP
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // --- LOGIC APPROVAL ---
    const handleStatusUpdate = async (status: 'APPROVED' | 'REJECTED') => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');

        if (status === 'APPROVED' && (!signatureBase64 || signatureBase64.length < 2000)) {
            alert("Tanda tangan Manager wajib diisi untuk Approval!");
            return;
        }

        if (!confirm(`Yakin ingin ${status} transaksi ini?`)) return;

        setSubmitting(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/update_approval.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    status: status,
                    comment: managerComment,
                    manager_signature_base64: status === 'APPROVED' ? signatureBase64 : ''
                })
            });

            const result = await res.json();
            if (result.status === 'success') {
                alert(`Transaksi Berhasil di-${status}!`);
                router.push('/transactions');
            } else {
                alert("Gagal: " + result.message);
            }
        } catch (error) {
            alert("Terjadi kesalahan koneksi ke server.");
        }
        setSubmitting(false);
    };

    if (loading) return <div className="p-20 text-center font-bold animate-pulse text-slate-400 uppercase tracking-widest">Memuat Detail...</div>;
    if (!transaction) return <div className="p-20 text-center text-red-500">Data tidak ditemukan!</div>;

    const { header, items } = transaction;

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">
            {/* Header Info */}
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-10 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">{header.project_name}</h1>
                    <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest">{header.transaction_code}</p>
                </div>
                <button onClick={() => router.back()} className="text-xs bg-slate-800 px-3 py-1.5 rounded-full">KEMBALI</button>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-6">

                {/* Detail Ringkas */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Teknisi / PIC</p>
                        <p className="font-bold text-slate-800">{header.pic_name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Tanggal Keluar</p>
                        <p className="font-bold text-slate-800">{header.checkout_date}</p>
                    </div>
                    <div className="col-span-2 pt-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Tanda Tangan Penerima</p>
                        {header.signature_pic_path ? (
                            <img src={`https://sedayu.com/api/warehouse/${header.signature_pic_path}`} className="h-24 bg-slate-50 rounded-xl border p-2" alt="TTD PIC" />
                        ) : <p className="text-xs italic text-slate-400">Tidak ada tanda tangan</p>}
                    </div>
                </div>

                {/* List Barang */}
                <div className="space-y-3">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Daftar Barang ({items.length})</h2>
                    {items.map((item: any, idx: number) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{item.qr_id} | {item.item_type}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-blue-600">{item.qty}</p>
                                <p className="text-[8px] font-bold text-slate-300 uppercase">Quantity</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Approval Section (Hanya muncul jika status masih PENDING/SUBMITTED) */}
                {header.manager_approval_status === 'PENDING' && (
                    <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="font-black text-slate-800 text-xs uppercase tracking-widest text-center text-blue-600">Konfirmasi Manager</h2>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Komentar / Catatan</label>
                            <textarea
                                placeholder="Tambahkan catatan jika perlu..."
                                value={managerComment}
                                onChange={(e) => setManagerComment(e.target.value)}
                                className="w-full p-4 bg-slate-50 rounded-2xl text-sm outline-none border-none focus:ring-2 ring-blue-500 transition-all"
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tanda Tangan Manager</label>
                                <button onClick={clearCanvas} className="text-[10px] text-blue-500 font-black">RESET</button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width={500} height={300}
                                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                className="w-full h-56 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 touch-none shadow-inner"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={() => handleStatusUpdate('REJECTED')}
                                disabled={submitting}
                                className="bg-slate-100 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => handleStatusUpdate('APPROVED')}
                                disabled={submitting}
                                className="bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-100 text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                            >
                                {submitting ? 'MEMPROSES...' : 'APPROVE & POTONG STOK'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Jika Sudah Diproses */}
                {header.manager_approval_status !== 'PENDING' && (
                    <div className={`p-6 rounded-3xl border-2 text-center space-y-2 ${header.manager_approval_status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                        }`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Transaksi</p>
                        <p className={`text-2xl font-black ${header.manager_approval_status === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                            {header.manager_approval_status}
                        </p>
                        {header.manager_comment && (
                            <p className="text-xs text-slate-500 italic mt-2 italic">"{header.manager_comment}"</p>
                        )}
                        {header.manager_signature_path && (
                            <div className="pt-4 flex flex-col items-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Tanda Tangan Manager</p>
                                <img src={`https://sedayu.com/api/warehouse/${header.manager_signature_path}`} className="h-20 grayscale opacity-70" alt="TTD Manager" />
                            </div>
                        )}
                    </div>
                )}

            </div>
        </main>
    );
}