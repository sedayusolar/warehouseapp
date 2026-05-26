'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [user, setUser] = useState<any>(null);
    const [transaction, setTransaction] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [managerComment, setManagerComment] = useState('');

    const API_KEY = "SedayuSolar_TopSecret_2026";
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) {
            router.push('/login');
            return;
        }
        setUser(JSON.parse(loggedInUser));
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${id}`, {
                headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (result.status === 'success') {
                setTransaction(result);
            }
        } catch (error) {
            console.error("Gagal ambil detail:", error);
        }
        setLoading(false);
    };

    // --- LOGIC TANDA TANGAN ---
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = (clientX - rect.left) * scaleX; const y = (clientY - rect.top) * scaleY;
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = (clientX - rect.left) * scaleX; const y = (clientY - rect.top) * scaleY;
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // --- SUBMIT WORKFLOW APPROVAL CHECK-IN ---
    const handleCheckInApproval = async (status: 'APPROVED' | 'REJECTED') => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (status === 'APPROVED' && (!signatureBase64 || signatureBase64.length < 2000)) {
            alert("Tanda tangan Manager wajib diisi untuk Approve!"); return;
        }
        if (!confirm(`Yakin ingin memproses ${status} Pengembalian barang ini?`)) return;

        setSubmitting(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/update_checkin_approval.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    checkin_id: transaction.checkin.header.id,
                    status: status,
                    comment: managerComment,
                    manager_signature_base64: status === 'APPROVED' ? signatureBase64 : ''
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert("Sukses memproses approval pengembalian!");
                router.push('/transactions');
            } else { alert(result.message); }
        } catch (e) { alert("Server error"); }
        setSubmitting(false);
    };

    // --- SUBMIT WORKFLOW APPROVAL CHECKOUT ---
    const handleStatusUpdate = async (status: 'APPROVED' | 'REJECTED') => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (status === 'APPROVED') {
            if (!signatureBase64 || signatureBase64.length < 2000) {
                alert("Tanda tangan Manager wajib diisi untuk Approval!");
                return;
            }
            for (const item of transaction.items) {
                if (Number(item.qty) > Number(item.stock_qty)) {
                    alert(`❌ STOK TIDAK CUKUP!\nBarang: ${item.item_name}\nSisa Gudang: ${item.stock_qty}\nDiminta: ${item.qty}`);
                    return;
                }
            }
        }
        if (!confirm(`Yakin ingin ${status} transaksi ini?`)) return;
        setSubmitting(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/update_approval.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    id: id,
                    status: status,
                    comment: managerComment,
                    manager_signature_base64: status === 'APPROVED' ? signatureBase64 : ''
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert(`Berhasil di-${status}!`);
                router.push('/transactions');
            } else { alert("Gagal: " + result.message); }
        } catch (error) { alert("Kesalahan koneksi ke server."); }
        setSubmitting(false);
    };

    if (loading) return <div className="p-20 text-center font-bold animate-pulse text-slate-400">MEMUAT DETAIL...</div>;
    if (!transaction) return <div className="p-20 text-center text-red-500 font-bold">DATA TIDAK DITEMUKAN</div>;

    const { header, items, checkin } = transaction;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans text-slate-900 relative">
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-10 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">{header.project_name}</h1>
                    <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest">{header.transaction_code}</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="text-xs bg-slate-800 px-4 py-2 rounded-full font-black uppercase">Tutup</button>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-8">

                {/* SUMMARY CARD */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 grid grid-cols-2 gap-y-6 gap-x-4">
                    <div className="col-span-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Nama Project</p>
                        <p className="font-bold text-slate-800 text-lg leading-tight">{header.project_name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">PIC / Teknisi</p>
                        <p className="font-bold text-slate-700">{header.pic_name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Tanggal Keluar</p>
                        <p className="font-bold text-slate-700">{header.checkout_date}</p>
                    </div>
                    <div className="col-span-2 pt-4 border-t border-slate-50">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Tanda Tangan Penerima</p>
                        {header.signature_pic_path ? (
                            <img src={`https://sedayu.com/api/warehouse/${header.signature_pic_path}`} className="h-24 bg-slate-50 rounded-xl border p-2" alt="TTD PIC" />
                        ) : <p className="text-xs italic text-slate-400">Tidak ada tanda tangan</p>}
                    </div>
                </div>

                {/* --- TOMBOL CHECK IN KHUSUS TEKNISI JIKA SUDAH APPROVED --- */}
                {header.transaction_status === 'SUBMITTED' && header.manager_approval_status === 'APPROVED' && user?.role !== 'MANAGER' && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-3xl text-center space-y-3 shadow-sm">
                        <h3 className="font-black text-blue-800 text-xs uppercase tracking-widest">Barang di Lapangan</h3>
                        <p className="text-xs text-blue-600">Proses instalasi selesai? Lakukan Check In untuk melaporkan pemakaian dan mengembalikan sisa barang.</p>
                        <button onClick={() => router.push(`/checkin?id=${header.id}`)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg mt-2 text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                            📦 Lakukan Check In
                        </button>
                    </div>
                )}

                {/* --- LIST BARANG KELUAR (CHECKOUT) --- */}
                <div className="space-y-8">
                    {items.filter((i: any) => i.item_type === 'MATERIAL').length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><span>📦</span> Material / Consumables</h2>
                            {items.filter((i: any) => i.item_type === 'MATERIAL').map((item: any, idx: number) => (
                                <div key={idx} className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-emerald-500 flex justify-between items-center ${header.manager_approval_status === 'PENDING' && item.qty > item.stock_qty ? 'bg-red-50' : ''}`}>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-blue-600 leading-tight">{item.qty}</p>
                                        {header.manager_approval_status === 'PENDING' && (
                                            <p className={`text-[9px] font-black uppercase ${item.qty > item.stock_qty ? 'text-red-500' : 'text-slate-400'}`}>Stok Gudang: {item.stock_qty}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {items.filter((i: any) => i.item_type === 'TOOLS').length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><span>🛠️</span> Tools / Peralatan</h2>
                            {items.filter((i: any) => i.item_type === 'TOOLS').map((item: any, idx: number) => (
                                <div key={idx} className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-amber-500 flex justify-between items-center ${header.manager_approval_status === 'PENDING' && item.qty > item.stock_qty ? 'bg-red-50' : ''}`}>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-blue-600 leading-tight">{item.qty}</p>
                                        {header.manager_approval_status === 'PENDING' && (
                                            <p className={`text-[9px] font-black uppercase ${item.qty > item.stock_qty ? 'text-red-500' : 'text-slate-400'}`}>Stok Gudang: {item.stock_qty}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- VIEW LAPORAN PENGEMBALIAN & APPROVAL CHECK-IN --- */}
                {header.transaction_status === 'CHECKIN_PENDING' && checkin && (
                    <div className="space-y-4 pt-4 border-t-2 border-dashed border-slate-200">
                        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl">
                            <h3 className="font-black text-xs text-amber-800 uppercase tracking-widest">📦 LAPORAN PENGEMBALIAN BARANG</h3>
                            <p className="text-slate-500 text-xs mt-1">Oleh PIC: <b>{checkin.header.pic_name}</b> pada {checkin.header.return_date}</p>
                        </div>

                        <div className="space-y-2">
                            {checkin.items.map((item: any, idx: number) => (
                                <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm">{item.item_name || 'Item'}</p>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${item.condition === 'GOOD' ? 'bg-emerald-100 text-emerald-700' : item.condition === 'USED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.condition === 'GOOD' ? 'Sisa Baik (Masuk Stok)' : item.condition === 'USED' ? 'Terpasang' : item.condition}
                                        </span>
                                    </div>
                                    <p className="text-xl font-black text-slate-800">{item.qty} Pcs</p>
                                </div>
                            ))}
                        </div>

                        {/* FORM APPROVAL CHECK-IN UNTUK MANAGER */}
                        {user?.role === 'MANAGER' && checkin.header.manager_approval_status === 'PENDING' && (
                            <div className="bg-white p-6 rounded-3xl border-2 border-blue-500 shadow-xl space-y-4">
                                <h2 className="font-black text-center text-blue-600 text-xs uppercase tracking-widest">Persetujuan Check-In Manager</h2>
                                <textarea placeholder="Catatan inspeksi fisik barang..." value={managerComment} onChange={e => setManagerComment(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl text-xs" rows={2} />
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase"><span>Tanda Tangan</span><button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)} className="text-blue-500">RESET</button></div>
                                    <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-44 bg-slate-50 rounded-xl border border-dashed" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleCheckInApproval('REJECTED')} disabled={submitting} className="bg-slate-100 py-4 rounded-xl font-black text-[10px] uppercase text-red-500">Tolak (Ulangi)</button>
                                    <button onClick={() => handleCheckInApproval('APPROVED')} disabled={submitting} className="bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-md">Setujui & Tambah Stok</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* --- APPROVAL CHECKOUT SECTION --- */}
                {header.manager_approval_status === 'PENDING' && user?.role === 'MANAGER' ? (
                    <div className="bg-white p-6 rounded-3xl border-2 border-slate-900 shadow-xl space-y-5">
                        <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em] text-center">Persetujuan Keluar Barang</h2>
                        <textarea placeholder="Berikan catatan atau instruksi khusus..." value={managerComment} onChange={(e) => setManagerComment(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-sm outline-none border-none focus:ring-2 ring-blue-500 transition-all text-slate-700" rows={2} />
                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tanda Tangan Manager</label><button onClick={clearCanvas} className="text-[10px] text-blue-500 font-black">RESET</button></div>
                            <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-56 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 touch-none shadow-inner" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button onClick={() => handleStatusUpdate('REJECTED')} disabled={submitting} className="bg-slate-100 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">Reject</button>
                            <button onClick={() => handleStatusUpdate('APPROVED')} disabled={submitting} className="bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-300 text-[10px] uppercase tracking-widest active:scale-95 transition-all">{submitting ? 'MEMPROSES...' : 'APPROVE KELUAR'}</button>
                        </div>
                    </div>
                ) : header.manager_approval_status !== 'PENDING' && header.transaction_status !== 'CHECKIN_PENDING' ? (
                    <div className={`p-8 rounded-3xl border-2 text-center space-y-4 ${header.manager_approval_status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Status Checkout</p><p className={`text-2xl font-black ${header.manager_approval_status === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>{header.manager_approval_status}</p></div>
                        {header.manager_comment && <p className="text-xs text-slate-600 italic">"{header.manager_comment}"</p>}
                        {header.manager_signature_path && (
                            <div className="flex flex-col items-center pt-4 border-t border-white/50">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Digital Signature</p>
                                <img src={`https://sedayu.com/api/warehouse/${header.manager_signature_path}`} className="h-20 grayscale opacity-60" alt="TTD Manager" />
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* --- BOTTOM MENU BAR --- */}
            {user && (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-50 p-4 pb-6">
                    <div className="max-w-4xl mx-auto flex gap-3">
                        <button
                            onClick={() => router.push('/transactions')}
                            className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                        >
                            📋 Riwayat Transaksi
                        </button>
                        {user.role !== 'MANAGER' && (
                            <button
                                onClick={() => router.push('/checkout')}
                                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all"
                            >
                                + Checkout Baru
                            </button>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}