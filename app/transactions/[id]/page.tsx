'use client';
import { useState, useEffect, useRef, use } from 'react';
import FloatingMenu from '../../components/FloatingMenu';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const COND_CONFIG: Record<string, { label: string, color: string }> = {
    GOOD: { label: 'Baik', color: 'bg-emerald-100 text-emerald-700' },
    DAMAGED: { label: 'Rusak', color: 'bg-orange-100 text-orange-600' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600' },
};
const getCondLabel = (condition: string, category: string) => {
    if (category === 'Material') {
        if (condition === 'GOOD') return { label: 'Ada Sisa', color: 'bg-emerald-100 text-emerald-700' };
        if (condition === 'DAMAGED') return { label: 'Terpakai', color: 'bg-blue-100 text-blue-700' };
        return { label: 'Hilang', color: 'bg-red-100 text-red-600' };
    }
    return COND_CONFIG[condition] || { label: condition, color: 'bg-slate-100 text-slate-500' };
};

export default function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [user, setUser] = useState<any>(null);
    const [transaction, setTransaction] = useState<any>(null);
    const [checkinData, setCheckinData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [managerComment, setManagerComment] = useState('');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const r = await res.json();
            if (r.status === 'success') {
                setTransaction(r);
                // Cek apakah ada check in linked ke transaksi ini
                fetchCheckin(r.header.id);
            }
        } catch { }
        setLoading(false);
    };

    const fetchCheckin = async (checkoutId: number) => {
        try {
            const res = await fetch(`${BASE_URL}/get_checkin_list.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                // Cari checkin yang linked ke checkout ini
                const linked = r.data.find((ci: any) => String(ci.checkout_header_id) === String(checkoutId));
                if (linked) {
                    // Fetch detail
                    const det = await fetch(`${BASE_URL}/get_checkin_detail.php?id=${linked.id}`, { headers: { 'X-API-KEY': API_KEY } });
                    const dr = await det.json();
                    if (dr.status === 'success') setCheckinData(dr);
                }
            }
        } catch { }
    };

    // Signature
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };
    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };
    const clearCanvas = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300);

    // Approve/Reject CHECKOUT
    const handleCheckoutApproval = async (status: 'APPROVED' | 'REJECTED') => {
        const sig = canvasRef.current?.toDataURL('image/png');
        if (status === 'APPROVED') {
            if (!sig || sig.length < 2000) { alert("Tanda tangan Manager wajib!"); return; }
            for (const item of transaction.items) {
                if (Number(item.qty) > Number(item.stock_qty)) {
                    alert(`❌ STOK TIDAK CUKUP!\n${item.item_name}\nGudang: ${item.stock_qty} · Diminta: ${item.qty}`);
                    return;
                }
            }
        }
        if (!confirm(`Yakin ${status} transaksi ini?`)) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/update_approval.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    id, status, comment: managerComment,
                    manager_signature_base64: status === 'APPROVED' ? sig : ''
                })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(`Berhasil di-${status}!`); router.push('/transactions'); }
            else alert("Gagal: " + r.message);
        } catch { alert("Koneksi gagal."); }
        setSubmitting(false);
    };

    // Approve/Reject CHECK IN — via approve_checkin.php
    const handleCheckinApproval = async (action: 'approve' | 'reject') => {
        if (!checkinData) return;
        if (action === 'reject' && !managerComment.trim()) {
            alert("Catatan penolakan wajib diisi."); return;
        }
        if (!confirm(`Yakin ${action} check in ini?`)) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_checkin.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    checkin_id: checkinData.header.id,
                    action,
                    approved_by: user?.name,
                    rejection_note: managerComment,
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(r.message);
                router.push('/transactions');
            } else alert("Gagal: " + r.message);
        } catch { alert("Koneksi gagal."); }
        setSubmitting(false);
    };

    if (loading) return <div className="p-20 text-center font-bold animate-pulse text-slate-400">MEMUAT DETAIL...</div>;
    if (!transaction) return <div className="p-20 text-center text-red-500 font-bold">DATA TIDAK DITEMUKAN</div>;

    const { header, items } = transaction;
    const isReadyCheckin = header.transaction_status === 'SUBMITTED' && header.manager_approval_status === 'APPROVED';
    const isCheckinPending = header.transaction_status === 'CHECKIN_PENDING';
    const isCheckinApproved = header.transaction_status === 'CHECKIN_APPROVED';

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans text-slate-900">

            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-5 right-5 text-white bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-black text-lg">✕</button>
                    <img src={lightboxUrl} alt="fullscreen" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* HEADER */}
            <div className="bg-slate-900 p-5 text-white shadow-lg sticky top-0 z-10 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">{header.project_name}</h1>
                    <p className="text-[10px] text-slate-400 font-mono tracking-widest">{header.transaction_code}</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase">Tutup</button>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* SUMMARY */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">PIC / Teknisi</p>
                            <p className="font-bold text-slate-700">{header.pic_name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">Tanggal Keluar</p>
                            <p className="font-bold text-slate-700">{header.checkout_date}</p>
                        </div>
                    </div>
                    {/* Status badge */}
                    <div className={`rounded-2xl p-3 text-center text-sm font-black uppercase tracking-widest
                        ${isCheckinApproved ? 'bg-emerald-100 text-emerald-700' :
                            isCheckinPending ? 'bg-amber-100 text-amber-700' :
                                header.manager_approval_status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                                    header.manager_approval_status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                        'bg-orange-100 text-orange-600'}`}>
                        {isCheckinApproved ? '✅ SELESAI — STOK KEMBALI' :
                            isCheckinPending ? '⏳ MENUNGGU APPROVE CHECK IN' :
                                header.manager_approval_status === 'APPROVED' ? '✅ CHECKOUT APPROVED' :
                                    header.manager_approval_status === 'REJECTED' ? '❌ DITOLAK' :
                                        '⏳ MENUNGGU APPROVAL'}
                    </div>
                    {/* TTD PIC */}
                    {header.signature_pic_path && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Tanda Tangan PIC</p>
                            <button onClick={() => setLightboxUrl(`${BASE_URL}/${header.signature_pic_path}`)}>
                                <img src={`${BASE_URL}/${header.signature_pic_path}`} className="h-20 bg-slate-50 rounded-xl border p-2" alt="TTD PIC" />
                            </button>
                        </div>
                    )}
                </div>

                {/* TOMBOL CHECK IN — Teknisi jika sudah APPROVED */}
                {isReadyCheckin && user?.role !== 'MANAGER' && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-5 rounded-3xl text-center space-y-3">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Checkout Disetujui</p>
                        <p className="text-xs text-blue-600">Instalasi selesai? Lakukan Check In untuk melaporkan kondisi dan mengembalikan sisa barang.</p>
                        <button onClick={() => router.push(`/checkin?checkout_id=${header.id}`)}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                            📦 Lakukan Check In
                        </button>
                    </div>
                )}

                {/* LIST BARANG CHECKOUT */}
                <div className="space-y-4">
                    {['MATERIAL', 'TOOLS'].map(type => {
                        const group = items.filter((i: any) => i.item_type === type);
                        if (!group.length) return null;
                        return (
                            <div key={type} className="space-y-2">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    {type === 'MATERIAL' ? '📦' : '🛠️'} {type}
                                </h2>
                                {group.map((item: any, idx: number) => (
                                    <div key={idx} className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 ${type === 'MATERIAL' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                {item.location_name && <p className="text-[10px] text-slate-400">📍 {item.location_name}</p>}
                                                {header.manager_approval_status === 'PENDING' && (
                                                    <p className={`text-[9px] font-black uppercase mt-0.5 ${Number(item.qty) > Number(item.stock_qty) ? 'text-red-500' : 'text-slate-400'}`}>
                                                        Stok Gudang: {item.stock_qty}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <p className="text-xl font-black text-blue-600">{item.qty}</p>
                                                {/* Foto checkout */}
                                                {item.photo_path && (
                                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${item.photo_path}`)}>
                                                        <img src={`${BASE_URL}/${item.photo_path}`} className="w-10 h-10 object-cover rounded-lg border border-slate-100" alt="foto" />
                                                        <p className="text-[8px] text-slate-400 text-center">Checkout</p>
                                                    </button>
                                                )}
                                                {item.photo_path_checkin && (
                                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${item.photo_path_checkin}`)}>
                                                        <img src={`${BASE_URL}/${item.photo_path_checkin}`} className="w-10 h-10 object-cover rounded-lg border border-emerald-100" alt="checkin" />
                                                        <p className="text-[8px] text-emerald-500 text-center">Check In</p>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* ===== SECTION CHECK IN ===== */}
                {(isCheckinPending || isCheckinApproved) && checkinData && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-slate-200" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Laporan Check In</p>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* Info checkin header */}
                        <div className={`rounded-2xl p-4 border ${isCheckinApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isCheckinApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {isCheckinApproved ? '✅ Check In Disetujui' : '⏳ Menunggu Approval'}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        {checkinData.header.checkin_code} · {checkinData.header.checkin_date}
                                    </p>
                                    <p className="text-xs text-slate-500">PIC: {checkinData.header.pic_name}</p>
                                    {isCheckinApproved && checkinData.header.approved_by && (
                                        <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                            Disetujui oleh: {checkinData.header.approved_by}
                                        </p>
                                    )}
                                    {checkinData.header.rejection_note && (
                                        <p className="text-[10px] text-red-600 font-bold mt-1">
                                            Ditolak: {checkinData.header.rejection_note}
                                        </p>
                                    )}
                                </div>
                                {/* TTD PIC checkin */}
                                {checkinData.header.signature_pic_path && (
                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${checkinData.header.signature_pic_path}`)}>
                                        <img src={`${BASE_URL}/${checkinData.header.signature_pic_path}`}
                                            className="h-14 object-contain rounded-lg border border-slate-200 bg-white p-1" alt="ttd" />
                                        <p className="text-[8px] text-slate-400 text-center mt-0.5">TTD PIC</p>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Item-item check in */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase ml-1">Kondisi Barang Dikembalikan</p>
                            {checkinData.items?.map((item: any) => (
                                <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getCondLabel(item.condition, item.category || '').color || 'bg-slate-100 text-slate-500'}`}>
                                                    {getCondLabel(item.condition, item.category || '').label || item.condition}
                                                    {item.condition === 'LOST' && ' — Stok tidak kembali'}
                                                </span>
                                            </div>
                                            <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                            <p className="text-[10px] text-slate-500">📍 {item.location_name || '—'} · Qty: {item.qty} {item.unit}</p>
                                            {item.note && <p className="text-[10px] italic text-slate-400">"{item.note}"</p>}
                                        </div>
                                        {item.photo_path && (
                                            <button onClick={() => setLightboxUrl(`${BASE_URL}/${item.photo_path}`)}>
                                                <img src={`${BASE_URL}/${item.photo_path}`}
                                                    className="w-14 h-14 object-cover rounded-xl border border-slate-200 flex-shrink-0" alt="foto" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* APPROVAL CHECK IN — Manager */}
                        {isCheckinPending && (user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                            <div className="bg-white p-5 rounded-3xl border-2 border-emerald-400 shadow-xl space-y-4">
                                <h2 className="font-black text-center text-emerald-700 text-[10px] uppercase tracking-widest">Persetujuan Check In</h2>
                                <textarea placeholder="Catatan (wajib jika Tolak)..."
                                    value={managerComment} onChange={e => setManagerComment(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl text-sm outline-none resize-none" rows={2} />
                                <div className="flex gap-3">
                                    <button onClick={() => handleCheckinApproval('reject')} disabled={submitting}
                                        className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-2xl text-[10px] uppercase border border-red-200 active:scale-95 disabled:opacity-50">
                                        ❌ Tolak
                                    </button>
                                    <button onClick={() => handleCheckinApproval('approve')} disabled={submitting}
                                        className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg active:scale-95 disabled:opacity-50">
                                        {submitting ? 'Memproses...' : '✅ Approve & Kembalikan Stok'}
                                    </button>
                                </div>
                                <p className="text-[9px] text-slate-400 text-center">
                                    Setelah Approve, stok GOOD & DAMAGED dikembalikan ke gudang.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* APPROVAL CHECKOUT — Manager */}
                {header.manager_approval_status === 'PENDING' && (user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                    <div className="bg-white p-5 rounded-3xl border-2 border-slate-900 shadow-xl space-y-4">
                        <h2 className="font-black text-center text-slate-900 text-[10px] uppercase tracking-widest">Persetujuan Keluar Barang</h2>
                        <textarea placeholder="Catatan atau instruksi khusus..."
                            value={managerComment} onChange={e => setManagerComment(e.target.value)}
                            className="w-full p-3.5 bg-slate-50 rounded-2xl text-sm outline-none resize-none" rows={2} />
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan Manager</label>
                                <button onClick={clearCanvas} className="text-[10px] text-blue-500 font-bold">RESET</button>
                            </div>
                            <canvas ref={canvasRef} width={500} height={250}
                                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                className="w-full h-44 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 touch-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleCheckoutApproval('REJECTED')} disabled={submitting}
                                className="bg-slate-100 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase active:scale-95 disabled:opacity-50">
                                Reject
                            </button>
                            <button onClick={() => handleCheckoutApproval('APPROVED')} disabled={submitting}
                                className="bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-lg active:scale-95 disabled:opacity-50">
                                {submitting ? 'Memproses...' : 'Approve Keluar'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STATUS FINAL CHECKOUT */}
                {header.manager_approval_status !== 'PENDING' && !isCheckinPending && !isCheckinApproved && (
                    <div className={`p-6 rounded-3xl border-2 text-center space-y-3
                        ${header.manager_approval_status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-[9px] font-black uppercase text-slate-400">Status Checkout</p>
                        <p className={`text-2xl font-black ${header.manager_approval_status === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {header.manager_approval_status}
                        </p>
                        {header.manager_comment && <p className="text-xs text-slate-600 italic">"{header.manager_comment}"</p>}
                        {header.manager_signature_path && (
                            <button onClick={() => setLightboxUrl(`${BASE_URL}/${header.manager_signature_path}`)}>
                                <img src={`${BASE_URL}/${header.manager_signature_path}`} className="h-16 mx-auto grayscale opacity-60 mt-2" alt="TTD Manager" />
                                <p className="text-[8px] text-slate-400">TTD Manager</p>
                            </button>
                        )}
                    </div>
                )}
            </div>
            <FloatingMenu />
        </main>
    );
}
