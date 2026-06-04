'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Menunggu Approval', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    APPROVED: { label: 'Disetujui', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    REJECTED: { label: 'Ditolak', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

function TransferListContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [selected, setSelected] = useState<any>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Approve modal
    const [showApprove, setShowApprove] = useState(false);
    const [action, setAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const canvasMgr = useRef<HTMLCanvasElement>(null);
    const [isDrawingMgr, setIsDrawingMgr] = useState(false);

    // TTD Supir & Security modal (setelah approved)
    const [showDelivery, setShowDelivery] = useState(false);
    const [deliveryTrx, setDeliveryTrx] = useState<any>(null);
    const [deliveryItems, setDeliveryItems] = useState<any[]>([]);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [driverName, setDriverName] = useState('');
    const [securityName, setSecurityName] = useState('');
    const [submittingDelivery, setSubmittingDelivery] = useState(false);
    const canvasDriver = useRef<HTMLCanvasElement>(null);
    const canvasSecurity = useRef<HTMLCanvasElement>(null);
    const [drawingDelivery, setDrawingDelivery] = useState<string | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchTransfers('ALL');
    }, []);

    const isManager = (u: any) => ['MANAGER', 'ADMIN'].includes(u?.role);

    const fetchTransfers = async (status: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transfer_list.php?status=${status}&limit=50`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setTransfers(r.data);
        } catch { }
        setLoading(false);
    };

    const fetchDetail = async (id: number) => {
        setLoadingDetail(true); setDetailItems([]);
        try {
            const res = await fetch(`${BASE_URL}/get_transfer_detail.php?id=${id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDetailItems(r.items || []);
        } catch { }
        setLoadingDetail(false);
    };

    const handleToggleDetail = (trx: any) => {
        if (selected?.id === trx.id) { setSelected(null); setDetailItems([]); }
        else { setSelected(trx); fetchDetail(trx.id); }
    };

    // Signature helpers
    const startDraw = (e: any, ref: React.RefObject<HTMLCanvasElement>, id: string, setter: (v: string | null) => void) => {
        const canvas = ref.current; if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y);
        setter(id);
    };
    const draw = (e: any, ref: React.RefObject<HTMLCanvasElement>, id: string, currentDrawing: string | null) => {
        if (currentDrawing !== id) return;
        const canvas = ref.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };
    const clearCanvas = (ref: React.RefObject<HTMLCanvasElement>) =>
        ref.current?.getContext('2d')?.clearRect(0, 0, 500, 200);
    const isCanvasSigned = (ref: React.RefObject<HTMLCanvasElement>): boolean => {
        const canvas = ref.current; if (!canvas) return false;
        const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!data) return false;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 10) return true;
        return false;
    };
    const getSig = (ref: React.RefObject<HTMLCanvasElement>) => ref.current?.toDataURL('image/png') || '';

    // Approve
    const handleApproveSubmit = async () => {
        if (!selected) return;
        if (action === 'APPROVED' && !isCanvasSigned(canvasMgr)) { alert('Tanda tangan Manager wajib diisi.'); return; }
        if (action === 'REJECTED' && !comment.trim()) { alert('Alasan penolakan wajib diisi.'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_transfer.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    transfer_id: selected.id,
                    action,
                    approved_by: user?.name || 'Manager',
                    comment,
                    manager_signature_base64: action === 'APPROVED' ? getSig(canvasMgr) : '',
                }),
            });
            const r = await res.json();
            if (r.status === 'success') {
                setShowApprove(false); setSelected(null); setComment(''); clearCanvas(canvasMgr);
                fetchTransfers(filter);
                alert(action === 'APPROVED' ? '✅ Disetujui! Stok sudah dipindahkan.' : '❌ Transfer ditolak.');
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi server.'); }
        setSubmitting(false);
    };

    // Buka modal TTD Supir & Security
    const openDeliveryModal = async (trx: any) => {
        setDeliveryTrx(trx);
        setDriverName(''); setSecurityName('');
        setCheckedItems(new Set());
        clearCanvas(canvasDriver); clearCanvas(canvasSecurity);
        setShowDelivery(true);
        // Fetch items
        try {
            const res = await fetch(`${BASE_URL}/get_transfer_detail.php?id=${trx.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDeliveryItems(r.items || []);
        } catch { }
    };

    const toggleCheckItem = (qr_id: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(qr_id)) next.delete(qr_id); else next.add(qr_id);
            return next;
        });
    };

    // Submit TTD Supir & Security ke approve_transfer.php dengan action UPDATE_DELIVERY
    const handleDeliverySubmit = async () => {
        if (checkedItems.size < deliveryItems.length) {
            alert(`Centang semua item (${deliveryItems.length} item) untuk konfirmasi.`); return;
        }
        if (!driverName.trim() && !securityName.trim()) {
            alert('Isi minimal nama Supir atau nama Security.'); return;
        }
        setSubmittingDelivery(true);
        try {
            const res = await fetch(`${BASE_URL}/update_transfer_delivery.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    transfer_id: deliveryTrx.id,
                    driver_name: driverName,
                    security_name: securityName,
                    driver_signature_base64: isCanvasSigned(canvasDriver) ? getSig(canvasDriver) : '',
                    security_signature_base64: isCanvasSigned(canvasSecurity) ? getSig(canvasSecurity) : '',
                }),
            });
            const r = await res.json();
            if (r.status === 'success') {
                setShowDelivery(false);
                alert('✅ Data pengiriman tersimpan! SJ siap dicetak.');
                fetchTransfers(filter);
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi server.'); }
        setSubmittingDelivery(false);
    };

    const handlePrintSJ = async (trx: any) => {
        try {
            const res = await fetch(`${BASE_URL}/get_transfer_detail.php?id=${trx.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status !== 'success') { alert('Gagal ambil detail.'); return; }
            const { header, items } = r;
            const itemsData = items.map((i: any) => ({ name: i.item_name, qr_id: i.qr_id, qty: i.qty, unit: i.unit || 'pcs', location_name: i.from_location_name || '—' }));
            const params = new URLSearchParams({
                code: header.sj_code || '—',
                trx_id: String(header.id),
                project: header.project_name || '—',
                pic: header.pic_name || '—',
                date: (header.created_at || '').split(' ')[0],
                pengirim: header.submitted_by || '—',
                staff_sig: header.pic_signature || '',
                pic_sig: header.pic_signature || '',
                base_url: BASE_URL,
                items: JSON.stringify(itemsData),
            });
            window.open(`/print_surat_jalan.html?${params.toString()}`, '_blank');
        } catch { alert('Gagal koneksi.'); }
    };

    if (!user) return null;
    const canApprove = isManager(user);
    const pendingCount = transfers.filter(t => t.approval_status === 'PENDING').length;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* HEADER TABS */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm">
                <div className="px-4 pt-3 pb-1 max-w-2xl mx-auto flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {canApprove ? '👔 Manager — Approval Transfer' : '📦 Staff — Riwayat Transfer'}
                    </p>
                    {canApprove && pendingCount > 0 && (
                        <span className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full">{pendingCount} perlu review</span>
                    )}
                </div>
                <div className="px-4 pb-2 max-w-2xl mx-auto flex gap-2">
                    {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                        <button key={f} onClick={() => { setFilter(f); fetchTransfers(f); }}
                            className={`flex-1 py-2 text-[9px] font-black rounded-xl uppercase tracking-widest transition-all
                                ${filter === f
                                    ? f === 'PENDING' ? 'bg-amber-500 text-white' : f === 'APPROVED' ? 'bg-emerald-600 text-white' : f === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-400'}`}>
                            {f === 'ALL' ? 'Semua' : f === 'PENDING' ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` : f === 'APPROVED' ? 'Approved' : 'Ditolak'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-3">
                {!canApprove && pendingCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-black text-amber-700">{pendingCount} transfer menunggu approval Manager</p>
                            <p className="text-[10px] text-amber-600 mt-0.5">Stok sudah dipindahkan setelah disetujui</p>
                        </div>
                        <span className="text-2xl">⏳</span>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-bold text-sm">Memuat data...</div>
                ) : transfers.length === 0 ? (
                    <div className="text-center py-20 space-y-3">
                        <p className="text-4xl">🚚</p>
                        <p className="text-slate-300 italic text-sm">Belum ada transfer.</p>
                        {!canApprove && (
                            <button onClick={() => router.push('/transfer')} className="bg-violet-600 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase shadow-md">
                                ＋ Buat Transfer Baru
                            </button>
                        )}
                    </div>
                ) : (
                    transfers.map(trx => {
                        const st = STATUS_CONFIG[trx.approval_status] || STATUS_CONFIG.PENDING;
                        const isOpen = selected?.id === trx.id;
                        const isPending = trx.approval_status === 'PENDING';
                        const isApproved = trx.approval_status === 'APPROVED';

                        return (
                            <div key={trx.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all ${isPending && canApprove ? 'border-amber-200' : 'border-slate-100'}`}>
                                {isPending && canApprove && <div className="h-1 bg-amber-400 w-full" />}

                                <div className="p-5">
                                    {/* Top */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-mono text-violet-600 font-bold bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100">{trx.sj_code}</span>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="font-black text-slate-800 text-sm">{trx.from_location_name}</span>
                                                <span className="text-violet-400 font-bold">→</span>
                                                <span className="font-black text-violet-700 text-sm">{trx.to_location_name}</span>
                                            </div>
                                            {trx.project_name && trx.project_name !== '—' && <p className="text-[10px] text-slate-400 mt-0.5">📋 {trx.project_name}</p>}
                                        </div>
                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border flex-shrink-0 ml-2 ${st.bg} ${st.color}`}>{st.label}</span>
                                    </div>

                                    {/* Meta */}
                                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-50 text-center">
                                        <div><p className="text-[9px] text-slate-400 uppercase font-black">PIC</p><p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{trx.pic_name || '—'}</p></div>
                                        <div><p className="text-[9px] text-slate-400 uppercase font-black">Item</p><p className="text-xs font-bold text-slate-700 mt-0.5">{trx.total_items} jenis</p></div>
                                        <div><p className="text-[9px] text-slate-400 uppercase font-black">Tanggal</p><p className="text-xs font-bold text-slate-700 mt-0.5">{trx.created_at?.split(' ')[0] || '—'}</p></div>
                                    </div>

                                    {isApproved && trx.approved_by && <p className="text-[10px] text-emerald-600 font-bold mb-2">✅ Disetujui oleh {trx.approved_by}</p>}
                                    {trx.approval_status === 'REJECTED' && trx.approved_by && <p className="text-[10px] text-red-500 font-bold mb-2">❌ Ditolak oleh {trx.approved_by}</p>}

                                    {/* Actions */}
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => handleToggleDetail(trx)}
                                            className="flex-1 bg-slate-100 text-slate-600 font-black text-[10px] py-3 rounded-2xl uppercase active:scale-95 min-w-0">
                                            {isOpen ? '▲ Tutup' : '👁 Detail'}
                                        </button>

                                        {isApproved && (
                                            <>
                                                <button onClick={() => openDeliveryModal(trx)}
                                                    className="flex-1 bg-emerald-600 text-white font-black text-[10px] py-3 rounded-2xl uppercase shadow-md active:scale-95 min-w-0">
                                                    ✍️ TTD Kirim
                                                </button>
                                                <button onClick={() => handlePrintSJ(trx)}
                                                    className="bg-slate-100 text-slate-600 font-black text-[10px] px-4 py-3 rounded-2xl border border-slate-200 uppercase active:scale-95">
                                                    🖨️ SJ
                                                </button>
                                            </>
                                        )}

                                        {canApprove && isPending && (
                                            <>
                                                <button onClick={() => { setSelected(trx); setAction('APPROVED'); setComment(''); clearCanvas(canvasMgr); setShowApprove(true); }}
                                                    className="flex-1 bg-emerald-600 text-white font-black text-[10px] py-3 rounded-2xl uppercase shadow-md active:scale-95 min-w-0">
                                                    ✅ Approve
                                                </button>
                                                <button onClick={() => { setSelected(trx); setAction('REJECTED'); setComment(''); setShowApprove(true); }}
                                                    className="flex-1 bg-red-500 text-white font-black text-[10px] py-3 rounded-2xl uppercase shadow-md active:scale-95 min-w-0">
                                                    ❌ Tolak
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Detail expand */}
                                {isOpen && (
                                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Item Transfer ({trx.total_items} jenis)</p>
                                        {loadingDetail ? (
                                            <div className="text-center py-4 text-slate-400 animate-pulse text-sm">Memuat...</div>
                                        ) : (
                                            <div className="space-y-2 mb-3">
                                                {detailItems.map((item: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center bg-white rounded-xl px-4 py-3 border border-slate-100">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{item.item_name}</p>
                                                            <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                                        </div>
                                                        <p className="text-sm font-black text-slate-800 ml-3">{item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span></p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {trx.note && <div className="bg-white rounded-xl px-4 py-3 border border-slate-100 mb-2"><p className="text-[9px] text-slate-400 uppercase font-black mb-1">Catatan</p><p className="text-xs text-slate-600">{trx.note}</p></div>}
                                        {trx.approval_status === 'REJECTED' && trx.manager_comment && (
                                            <div className="bg-red-50 rounded-xl px-4 py-3 border border-red-100"><p className="text-[9px] text-red-400 uppercase font-black mb-1">Alasan Ditolak</p><p className="text-xs text-red-600">{trx.manager_comment}</p></div>
                                        )}
                                        <p className="text-[9px] text-slate-400 mt-3">Disubmit oleh: <strong>{trx.submitted_by || '—'}</strong></p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {/* FAB staff */}
                {!canApprove && transfers.length > 0 && (
                    <button onClick={() => router.push('/transfer')}
                        className="fixed bottom-24 right-4 bg-violet-600 text-white font-black w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-90 transition-all z-40">
                        ＋
                    </button>
                )}
            </div>

            {/* ══ APPROVE MODAL (Manager) ══ */}
            {showApprove && selected && canApprove && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowApprove(false)}>
                    <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <p className="font-black text-slate-800 text-base">{action === 'APPROVED' ? '✅ Approve Transfer' : '❌ Tolak Transfer'}</p>
                            <button onClick={() => setShowApprove(false)} className="text-slate-400 font-black text-lg w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        <div className={`rounded-2xl p-4 border ${action === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <p className="font-mono text-sm font-bold text-slate-700">{selected.sj_code}</p>
                            <p className="text-xs text-slate-500 mt-1">{selected.from_location_name} → {selected.to_location_name}</p>
                            <p className="text-xs text-slate-500">{selected.total_items} jenis · {selected.total_qty} unit</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setAction('APPROVED')} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase active:scale-95 ${action === 'APPROVED' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>✅ Setujui</button>
                            <button onClick={() => setAction('REJECTED')} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase active:scale-95 ${action === 'REJECTED' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>❌ Tolak</button>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase">{action === 'REJECTED' ? 'Alasan Penolakan *' : 'Catatan (opsional)'}</label>
                            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder={action === 'REJECTED' ? 'Jelaskan alasan...' : 'Catatan untuk staff...'}
                                className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm resize-none" />
                        </div>
                        {action === 'APPROVED' && (
                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan Manager *</label>
                                    <button onClick={() => clearCanvas(canvasMgr)} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                </div>
                                <canvas ref={canvasMgr} width={500} height={160}
                                    onMouseDown={e => startDraw(e, canvasMgr, 'mgr', setIsDrawingMgr as any)}
                                    onMouseMove={e => draw(e, canvasMgr, 'mgr', isDrawingMgr ? 'mgr' : null)}
                                    onMouseUp={() => setIsDrawingMgr(false)}
                                    onTouchStart={e => { e.preventDefault(); startDraw(e, canvasMgr, 'mgr', setIsDrawingMgr as any); }}
                                    onTouchMove={e => { e.preventDefault(); draw(e, canvasMgr, 'mgr', isDrawingMgr ? 'mgr' : null); }}
                                    onTouchEnd={() => setIsDrawingMgr(false)}
                                    className="w-full h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 touch-none cursor-crosshair" />
                            </div>
                        )}
                        <button onClick={handleApproveSubmit} disabled={submitting}
                            className={`w-full font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg disabled:opacity-50 active:scale-95 ${action === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}>
                            {submitting ? '⏳ Menyimpan...' : action === 'APPROVED' ? '✅ KONFIRMASI SETUJUI' : '❌ KONFIRMASI TOLAK'}
                        </button>
                    </div>
                </div>
            )}

            {/* ══ DELIVERY MODAL (TTD Supir & Security) ══ */}
            {showDelivery && deliveryTrx && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowDelivery(false)}>
                    <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                            <div>
                                <p className="font-black text-slate-800 text-base">✍️ Data Pengiriman</p>
                                <p className="text-[10px] font-mono text-violet-600">{deliveryTrx.sj_code}</p>
                            </div>
                            <button onClick={() => setShowDelivery(false)} className="text-slate-400 font-black text-lg w-8 h-8 flex items-center justify-center">✕</button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Checklist item */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                    Checklist Item ({checkedItems.size}/{deliveryItems.length} dicentang)
                                </p>
                                <div className="space-y-2">
                                    {deliveryItems.map((item: any, i: number) => {
                                        const checked = checkedItems.has(item.qr_id);
                                        return (
                                            <button key={i} onClick={() => toggleCheckItem(item.qr_id)}
                                                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-95
                                                    ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                                                    ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                    {checked && <span className="text-white text-xs font-black">✓</span>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-bold truncate ${checked ? 'text-emerald-700' : 'text-slate-800'}`}>{item.item_name}</p>
                                                    <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                                </div>
                                                <p className="text-sm font-black text-slate-600 flex-shrink-0">{item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span></p>
                                            </button>
                                        );
                                    })}
                                </div>
                                {checkedItems.size < deliveryItems.length && (
                                    <p className="text-[10px] text-amber-600 font-bold mt-2 text-center">Centang semua item untuk konfirmasi pengiriman</p>
                                )}
                            </div>

                            {/* TTD Supir */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-sm">🚚</div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supir (opsional)</p>
                                </div>
                                <input type="text" placeholder="Nama Supir" value={driverName} onChange={e => setDriverName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan Supir</label>
                                        <button onClick={() => clearCanvas(canvasDriver)} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                    </div>
                                    <canvas ref={canvasDriver} width={500} height={160}
                                        onMouseDown={e => startDraw(e, canvasDriver, 'driver', setDrawingDelivery)}
                                        onMouseMove={e => draw(e, canvasDriver, 'driver', drawingDelivery)}
                                        onMouseUp={() => setDrawingDelivery(null)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(e, canvasDriver, 'driver', setDrawingDelivery); }}
                                        onTouchMove={e => { e.preventDefault(); draw(e, canvasDriver, 'driver', drawingDelivery); }}
                                        onTouchEnd={() => setDrawingDelivery(null)}
                                        className="w-full h-28 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 touch-none cursor-crosshair" />
                                </div>
                            </div>

                            {/* TTD Security */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-sm">🛡️</div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Kantor (opsional)</p>
                                </div>
                                <input type="text" placeholder="Nama Security" value={securityName} onChange={e => setSecurityName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan Security</label>
                                        <button onClick={() => clearCanvas(canvasSecurity)} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                    </div>
                                    <canvas ref={canvasSecurity} width={500} height={160}
                                        onMouseDown={e => startDraw(e, canvasSecurity, 'security', setDrawingDelivery)}
                                        onMouseMove={e => draw(e, canvasSecurity, 'security', drawingDelivery)}
                                        onMouseUp={() => setDrawingDelivery(null)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(e, canvasSecurity, 'security', setDrawingDelivery); }}
                                        onTouchMove={e => { e.preventDefault(); draw(e, canvasSecurity, 'security', drawingDelivery); }}
                                        onTouchEnd={() => setDrawingDelivery(null)}
                                        className="w-full h-28 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 touch-none cursor-crosshair" />
                                </div>
                            </div>

                            <button onClick={handleDeliverySubmit} disabled={submittingDelivery || checkedItems.size < deliveryItems.length}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg disabled:opacity-40 active:scale-95 transition-all">
                                {submittingDelivery ? '⏳ Menyimpan...' : checkedItems.size < deliveryItems.length ? `Centang ${deliveryItems.length - checkedItems.size} item lagi` : '✅ SIMPAN DATA PENGIRIMAN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Navbar />
        </main>
    );
}

export default function TransferListPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <TransferListContent />
        </Suspense>
    );
}
