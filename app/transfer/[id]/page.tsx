'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../../../components/Navbar';
import { useRouter, useParams } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

function TransferDetailContent() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id;

    const [user, setUser] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    // Signatures for Execution Phase
    const [driverName, setDriverName] = useState('');
    const [securityName, setSecurityName] = useState('');
    const canvasDriver = useRef<HTMLCanvasElement>(null);
    const canvasSecurity = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState<string | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        if (id) fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transfer_detail.php?id=${id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const r = await res.json();
            if (r.status === 'success') {
                setData(r.data);
            } else {
                setError(r.message || 'Data tidak ditemukan.');
            }
        } catch {
            setError('Gagal mengambil data dari server.');
        }
        setLoading(false);
    };

    // ── Signature Helpers (Vercel Safe) ──
    const startDraw = (e: any, ref: any, id: string) => {
        const canvas = ref.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y);
        setDrawing(id);
    };

    const draw = (e: any, ref: any, id: string) => {
        if (drawing !== id) return;
        const canvas = ref.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    const clearCanvas = (ref: any) => ref.current?.getContext('2d')?.clearRect(0, 0, 500, 200);
    const getSig = (ref: any) => ref.current?.toDataURL('image/png') || '';

    // ── Action Handlers ──
    const handleUpdateStatus = async (newStatus: string) => {
        if (!confirm(`Yakin ingin mengubah status menjadi ${newStatus}?`)) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/update_transfer_status.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    transfer_id: id,
                    status: newStatus,
                    processed_by: user?.name,
                    email_notif: true // Trigger notif ke manager kalau DRAFT -> PENDING
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(r.message);
                fetchDetail();
            } else {
                alert(r.message || 'Gagal mengubah status.');
            }
        } catch { alert('Koneksi error.'); }
        setActionLoading(false);
    };

    const handleExecuteTransfer = async () => {
        const sigDrv = getSig(canvasDriver);
        const sigSec = getSig(canvasSecurity);

        if (!driverName.trim() && !securityName.trim()) {
            alert('Minimal isi satu nama (Supir atau Security) untuk eksekusi.'); return;
        }

        if ((driverName && sigDrv.length < 2000) || (securityName && sigSec.length < 2000)) {
            alert('Harap lengkapi tanda tangan yang bersangkutan.'); return;
        }

        setActionLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/execute_transfer.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    transfer_id: id,
                    executed_by: user?.name,
                    driver_name: driverName,
                    driver_signature_base64: sigDrv,
                    security_name: securityName,
                    security_signature_base64: sigSec
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert('Transfer berhasil dieksekusi dan stok telah dipindahkan!');
                fetchDetail();
            } else {
                alert(r.message || 'Gagal eksekusi transfer.');
            }
        } catch { alert('Koneksi error.'); }
        setActionLoading(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Memuat Data...</div>;
    if (error || !data) return <div className="min-h-screen flex items-center justify-center font-black text-red-500">{error || 'Data tidak ditemukan'}</div>;

    const statusMap: any = {
        'DRAFT': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
        'PENDING': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Menunggu Approval' },
        'APPROVED': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Siap Dieksekusi' },
        'REJECTED': { bg: 'bg-red-100', text: 'text-red-700', label: 'Ditolak' },
        'COMPLETED': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Selesai (Terkirim)' }
    };
    const st = statusMap[data.approval_status] || statusMap['DRAFT'];

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-3 flex justify-between items-center">
                <button onClick={() => router.push('/transactions')} className="text-slate-400 font-black text-sm active:scale-90">← Kembali</button>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${st.bg} ${st.text}`}>
                    {st.label}
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">
                {/* ── HEADER DATA ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-violet-600 px-5 py-4">
                        <p className="text-[9px] font-black text-violet-200 uppercase tracking-widest">Detail Transfer Antar Gudang</p>
                        <h1 className="text-lg font-black text-white">{data.sj_code}</h1>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="font-black text-white text-sm">{data.from_location_name}</span>
                            <span className="text-violet-300 text-lg">→</span>
                            <span className="font-black text-white text-sm">{data.to_location_name}</span>
                        </div>
                        {data.project_name && <p className="text-[10px] text-violet-300 mt-1">📋 Project: {data.project_name}</p>}
                        <p className="text-[10px] text-violet-300 mt-0.5">📅 {data.created_at}</p>
                    </div>
                </div>

                {/* ── ITEMS ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Item Ditransfer ({data.items?.length || 0})</p>
                    <div className="divide-y divide-slate-50">
                        {data.items?.map((item: any) => (
                            <div key={item.id} className="py-2.5 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-slate-800">{item.item_name}</p>
                                    <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                </div>
                                <p className="text-sm font-black text-slate-800">{item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span></p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── PIC SIGNATURE (Selalu Tampil) ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pembuat Transaksi</p>
                    <div className="flex flex-col items-center">
                        <div className="w-1/2 h-20 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                            {data.pic_signature ? <img src={`${BASE_URL}/${data.pic_signature}`} className="h-full object-contain" alt="PIC" /> : <span className="text-xs text-slate-300">No Sig</span>}
                        </div>
                        <p className="text-xs font-bold text-slate-700 mt-2">👤 {data.pic_name}</p>
                    </div>
                </div>

                {/* ── DRIVER & SECURITY (Tampil jika sudah COMPLETED) ── */}
                {data.approval_status === 'COMPLETED' && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">🚚 Supir</p>
                            <div className="h-20 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                                {data.driver_signature ? <img src={`${BASE_URL}/${data.driver_signature}`} className="h-full object-contain" alt="Driver" /> : <span className="text-xs text-slate-300">—</span>}
                            </div>
                            <p className="text-xs font-bold text-slate-700 mt-2">{data.driver_name || '—'}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">🛡️ Security</p>
                            <div className="h-20 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                                {data.security_signature ? <img src={`${BASE_URL}/${data.security_signature}`} className="h-full object-contain" alt="Security" /> : <span className="text-xs text-slate-300">—</span>}
                            </div>
                            <p className="text-xs font-bold text-slate-700 mt-2">{data.security_name || '—'}</p>
                        </div>
                    </div>
                )}

                {/* ══════ ACTION AREAS ══════ */}

                {/* 1. JIKA DRAFT -> BISA SUBMIT */}
                {data.approval_status === 'DRAFT' && (
                    <button onClick={() => handleUpdateStatus('PENDING')} disabled={actionLoading}
                        className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                        {actionLoading ? 'Memproses...' : '🚀 Ajukan Approval'}
                    </button>
                )}

                {/* 2. JIKA PENDING & ROLE MANAGER/ADMIN -> BISA APPROVE/REJECT */}
                {data.approval_status === 'PENDING' && ['MANAGER', 'ADMIN'].includes(user.role) && (
                    <div className="flex gap-3">
                        <button onClick={() => handleUpdateStatus('REJECTED')} disabled={actionLoading}
                            className="flex-1 bg-red-100 text-red-600 font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all">
                            ❌ Tolak
                        </button>
                        <button onClick={() => handleUpdateStatus('APPROVED')} disabled={actionLoading}
                            className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                            ✅ Approve
                        </button>
                    </div>
                )}

                {/* 3. JIKA APPROVED -> FORM TANDA TANGAN SUPIR & SECURITY (EKSEKUSI) */}
                {data.approval_status === 'APPROVED' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6">
                            <p className="font-black text-amber-700 text-sm mb-1">⚠️ Eksekusi Transfer</p>
                            <p className="text-xs text-amber-600 leading-relaxed">Transfer telah di-Approve. Harap isi tanda tangan Supir & Security yang bertugas sebelum stok benar-benar dipindahkan.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🚚 Tanda Tangan Supir (Opsional)</p>
                            <input type="text" placeholder="Nama Supir" value={driverName} onChange={e => setDriverName(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            <div className="relative">
                                <button onClick={() => clearCanvas(canvasDriver)} className="absolute right-0 top-[-20px] text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                <canvas ref={canvasDriver} width={500} height={160}
                                    onMouseDown={e => startDraw(e, canvasDriver, 'driver')} onMouseMove={e => draw(e, canvasDriver, 'driver')} onMouseUp={() => setDrawing(null)}
                                    onTouchStart={e => startDraw(e, canvasDriver, 'driver')} onTouchMove={e => draw(e, canvasDriver, 'driver')} onTouchEnd={() => setDrawing(null)}
                                    className="w-full h-32 bg-slate-50 rounded-xl border-2 border-slate-200 touch-none cursor-crosshair" />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🛡️ Tanda Tangan Security (Opsional)</p>
                            <input type="text" placeholder="Nama Security" value={securityName} onChange={e => setSecurityName(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            <div className="relative">
                                <button onClick={() => clearCanvas(canvasSecurity)} className="absolute right-0 top-[-20px] text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                <canvas ref={canvasSecurity} width={500} height={160}
                                    onMouseDown={e => startDraw(e, canvasSecurity, 'security')} onMouseMove={e => draw(e, canvasSecurity, 'security')} onMouseUp={() => setDrawing(null)}
                                    onTouchStart={e => startDraw(e, canvasSecurity, 'security')} onTouchMove={e => draw(e, canvasSecurity, 'security')} onTouchEnd={() => setDrawing(null)}
                                    className="w-full h-32 bg-slate-50 rounded-xl border-2 border-slate-200 touch-none cursor-crosshair" />
                            </div>
                        </div>

                        <button onClick={handleExecuteTransfer} disabled={actionLoading}
                            className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                            {actionLoading ? 'Mengeksekusi...' : '📦 Selesaikan Eksekusi Transfer'}
                        </button>
                    </div>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function TransferDetailPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <TransferDetailContent />
        </Suspense>
    );
}