'use client';
import { useState, useEffect, useRef, use } from 'react';
import Navbar from '../../components/Navbar';
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
        if (condition === 'DAMAGED') return { label: 'Sisa Rusak', color: 'bg-orange-100 text-orange-600' };
        if (condition === 'USED') return { label: 'Terpakai', color: 'bg-blue-100 text-blue-700' };
        return { label: 'Hilang', color: 'bg-red-100 text-red-600' };
    }
    return COND_CONFIG[condition] || { label: condition, color: 'bg-slate-100 text-slate-500' };
};

// State per item untuk checklist penerimaan
type ItemReceiveState = {
    checked: boolean;
    qty_received: number;
    note: string;
    photo_base64: string;
};

const compressImage = (file: File, maxWidth = 1200, quality = 0.75): Promise<string> =>
    new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });

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

    // TTD Manager
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // TTD PIC/Engineer
    const picCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isPicDrawing, setIsPicDrawing] = useState(false);
    const [submittingPicSig, setSubmittingPicSig] = useState(false);

    // Checklist per item — state
    const [itemReceive, setItemReceive] = useState<Record<string, ItemReceiveState>>({});
    const photoRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchDetail();
    }, [id]);

    // Init checklist saat items sudah ada
    useEffect(() => {
        if (!transaction?.items) return;
        const init: Record<string, ItemReceiveState> = {};
        transaction.items.forEach((item: any) => {
            init[item.qr_id] = {
                checked: true,
                qty_received: item.qty,
                note: '',
                photo_base64: '',
            };
        });
        setItemReceive(init);
    }, [transaction?.items]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const r = await res.json();
            if (r.status === 'success') {
                setTransaction(r);
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
                const linked = r.data.find((ci: any) => String(ci.checkout_header_id) === String(checkoutId));
                if (linked) {
                    const det = await fetch(`${BASE_URL}/get_checkin_detail.php?id=${linked.id}`, { headers: { 'X-API-KEY': API_KEY } });
                    const dr = await det.json();
                    if (dr.status === 'success') setCheckinData(dr);
                }
            }
        } catch { }
    };

    // ─────────────────────────────────────────────────────────────
    // PATCH untuk transactions/[id]/page.tsx
    // Cari fungsi handlePrintSJ dan replace seluruhnya dengan ini:
    // ─────────────────────────────────────────────────────────────

    const handlePrintSJ = () => {
        if (!transaction) return;
        const { header, items } = transaction;
        const itemsData = items.map((item: any) => ({
            name: item.item_name,
            qr_id: item.qr_id,
            qty: item.qty,
            unit: item.unit || 'pcs',
            location_name: item.location_name || '—',
        }));
        const params = new URLSearchParams({
            code: header.transaction_code,
            trx_id: String(header.id),
            project: header.project_name || '—',
            pic: header.pic_name || '—',
            date: header.checkout_date,
            pengirim: header.staff_name || user?.name || '—',
            staff_sig: header.staff_signature_path || '',
            pic_sig: header.signature_pic_path || '',
            // ── FIX: tambah data supir & security ──
            driver_name: header.driver_name || '',
            driver_sig: header.driver_signature || '',
            security_name: header.security_name || '',
            security_sig: header.security_signature || '',
            base_url: BASE_URL,
            items: JSON.stringify(itemsData),
        });
        window.open(`/print_surat_jalan.html?${params.toString()}`, '_blank');
    };


    // TTD Manager drawing
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

    // TTD PIC drawing
    const startPicDrawing = (e: any) => {
        const canvas = picCanvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a5f';
        ctx.beginPath(); ctx.moveTo(x, y); setIsPicDrawing(true);
    };
    const drawPic = (e: any) => {
        if (!isPicDrawing) return;
        const canvas = picCanvasRef.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    const updateItemReceive = (qr_id: string, field: keyof ItemReceiveState, value: any) => {
        setItemReceive(prev => ({ ...prev, [qr_id]: { ...prev[qr_id], [field]: value } }));
    };

    // Submit TTD PIC + checklist per item
    const handleSubmitPicSignature = async () => {
        const sig = picCanvasRef.current?.toDataURL('image/png');
        if (!sig || sig.length < 2000) {
            alert("Tanda tangan PIC wajib diisi!"); return;
        }

        // Validasi: minimal 1 item dichecklist
        const checkedItems = Object.entries(itemReceive).filter(([, v]) => v.checked);
        if (checkedItems.length === 0) {
            alert("Centang minimal 1 item yang diterima!"); return;
        }

        // Cek qty received
        for (const [qr_id, state] of checkedItems) {
            if (state.qty_received <= 0) {
                const item = transaction.items.find((i: any) => i.qr_id === qr_id);
                alert(`Qty diterima tidak valid untuk: ${item?.item_name}`); return;
            }
        }

        if (!confirm("Konfirmasi: barang sudah diterima di site dan Anda akan menandatangani?")) return;

        setSubmittingPicSig(true);
        try {
            // Build receive details
            const receiveDetails = transaction.items.map((item: any) => {
                const state = itemReceive[item.qr_id];
                return {
                    qr_id: item.qr_id,
                    item_name: item.item_name,
                    qty_ordered: item.qty,
                    qty_received: state?.checked ? (state.qty_received || item.qty) : 0,
                    received: state?.checked ?? true,
                    note: state?.note || '',
                    photo_base64: state?.photo_base64 || '',
                };
            });

            const res = await fetch(`${BASE_URL}/submit_pic_signature.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    transaction_id: id,
                    pic_name: user?.name || transaction?.header?.pic_name,
                    signature_base64: sig,
                    receive_details: receiveDetails,
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert("✅ Konfirmasi berhasil! Status → DELIVERED.");
                fetchDetail();
            } else alert("Gagal: " + r.message);
        } catch { alert("Koneksi gagal."); }
        setSubmittingPicSig(false);
    };

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
                body: JSON.stringify({ id, status, comment: managerComment, manager_signature_base64: status === 'APPROVED' ? sig : '' })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(`Berhasil di-${status}!`); router.push('/transactions'); }
            else alert("Gagal: " + r.message);
        } catch { alert("Koneksi gagal."); }
        setSubmitting(false);
    };

    // Approve/Reject CHECK IN
    const handleCheckinApproval = async (action: 'approve' | 'reject') => {
        if (!checkinData) return;
        if (action === 'reject' && !managerComment.trim()) { alert("Catatan penolakan wajib."); return; }
        if (!confirm(`Yakin ${action} check in ini?`)) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_checkin.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ checkin_id: checkinData.header.id, action, approved_by: user?.name, rejection_note: managerComment })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(r.message); router.push('/transactions'); }
            else alert("Gagal: " + r.message);
        } catch { alert("Koneksi gagal."); }
        setSubmitting(false);
    };

    if (loading) return <div className="p-20 text-center font-bold animate-pulse text-slate-400">MEMUAT DETAIL...</div>;
    if (!transaction) return <div className="p-20 text-center text-red-500 font-bold">DATA TIDAK DITEMUKAN</div>;

    const { header, items } = transaction;

    const isSubmitted = header.transaction_status === 'SUBMITTED';
    const isDelivered = header.transaction_status === 'DELIVERED';
    const isReadyCheckin = header.transaction_status === 'SUBMITTED' && header.manager_approval_status === 'APPROVED';
    const isCheckinPending = header.transaction_status === 'CHECKIN_PENDING';
    const isCheckinApproved = header.transaction_status === 'CHECKIN_APPROVED';
    const hasPicSignature = !!header.signature_pic_path;

    const canEngineerSign = user?.role === 'ENGINEER'
        && header.manager_approval_status === 'APPROVED'
        && !hasPicSignature
        && (isSubmitted || isDelivered);

    const checkedCount = Object.values(itemReceive).filter(v => v.checked).length;
    const totalItems = items?.length || 0;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900">

            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-5 right-5 text-white bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-black text-lg">✕</button>
                    <img src={lightboxUrl} alt="fullscreen" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* ACTION BAR */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{header.project_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{header.transaction_code}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        {header.manager_approval_status === 'APPROVED' && (
                            <button onClick={handlePrintSJ}
                                className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-black uppercase active:scale-95">
                                🖨️ SJ
                            </button>
                        )}
                        <button onClick={() => router.push('/transactions')}
                            className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-black uppercase active:scale-95">
                            ← Kembali
                        </button>
                    </div>
                </div>
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


                    {/* ── PROGRESS TRACKER ── */}
                    {(() => {
                        const steps = [
                            {
                                key: 'submit',
                                label: 'Submit',
                                sublabel: 'Staff',
                                icon: '📋',
                                done: true,
                            },
                            {
                                key: 'approved',
                                label: 'Approve',
                                sublabel: 'Manager',
                                icon: '👔',
                                done: header.manager_approval_status === 'APPROVED',
                                rejected: header.manager_approval_status === 'REJECTED',
                                active: header.manager_approval_status === 'PENDING',
                            },
                            {
                                key: 'delivered',
                                label: 'Delivered',
                                sublabel: 'Engineer',
                                icon: '✍️',
                                done: isDelivered || isCheckinPending || isCheckinApproved,
                                active: header.manager_approval_status === 'APPROVED' && !isDelivered && !isCheckinPending && !isCheckinApproved,
                            },
                            {
                                key: 'checkin',
                                label: 'Check In',
                                sublabel: 'Staff',
                                icon: '📦',
                                done: isCheckinApproved,
                                active: isCheckinPending || (isDelivered && hasPicSignature),
                            },
                            {
                                key: 'selesai',
                                label: 'Selesai',
                                sublabel: 'Manager',
                                icon: '✅',
                                done: isCheckinApproved,
                                active: isCheckinPending,
                            },
                        ];

                        // Kalau rejected, potong steps
                        const visibleSteps = header.manager_approval_status === 'REJECTED'
                            ? steps.slice(0, 2)
                            : steps;

                        return (
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Progress Transaksi</p>
                                <div className="flex items-start">
                                    {visibleSteps.map((step, i) => (
                                        <div key={step.key} className="flex-1 flex flex-col items-center relative">
                                            {/* Connector line kiri */}
                                            {i > 0 && (
                                                <div className={`absolute top-3.5 right-1/2 left-0 h-0.5 -translate-y-1/2
                                                    ${visibleSteps[i - 1].done ? 'bg-blue-400' : 'bg-slate-200'}`} />
                                            )}
                                            {/* Circle */}
                                            <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 transition-all
                                                ${step.rejected
                                                    ? 'bg-red-100 border-red-400 text-red-600'
                                                    : step.done
                                                        ? 'bg-blue-500 border-blue-500 text-white'
                                                        : step.active
                                                            ? 'bg-white border-blue-400 shadow-md shadow-blue-100 animate-pulse'
                                                            : 'bg-white border-slate-200 text-slate-300'}`}>
                                                {step.rejected ? '✕' : step.done ? '✓' : <span className="text-[10px]">{step.icon}</span>}
                                            </div>
                                            {/* Label */}
                                            <p className={`text-[8px] font-black mt-1.5 text-center leading-tight
                                                ${step.rejected ? 'text-red-500' : step.done ? 'text-blue-600' : step.active ? 'text-slate-700' : 'text-slate-300'}`}>
                                                {step.label}
                                            </p>
                                            <p className={`text-[7px] text-center leading-tight
                                                ${step.done || step.active ? 'text-slate-400' : 'text-slate-200'}`}>
                                                {step.sublabel}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                {/* Current step info */}
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-[9px] text-slate-500 text-center">
                                        {header.manager_approval_status === 'REJECTED' ? '❌ Transaksi ditolak Manager' :
                                            isCheckinApproved ? '✅ Transaksi selesai — stok sudah kembali ke gudang' :
                                                isCheckinPending ? '⏳ Menunggu Manager approve Check In' :
                                                    isDelivered && hasPicSignature ? '📦 Barang diterima — siap Check In' :
                                                        isDelivered && !hasPicSignature ? '✍️ Menunggu TTD Engineer/PIC' :
                                                            header.manager_approval_status === 'APPROVED' ? '✍️ Menunggu konfirmasi penerimaan di site' :
                                                                '⏳ Menunggu approval Manager'}
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                    <div className={`rounded-2xl p-3 text-center text-sm font-black uppercase tracking-widest
                        ${isCheckinApproved ? 'bg-emerald-100 text-emerald-700' :
                            isCheckinPending ? 'bg-amber-100 text-amber-700' :
                                isDelivered ? 'bg-blue-100 text-blue-800' :
                                    header.manager_approval_status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                                        header.manager_approval_status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                            'bg-orange-100 text-orange-600'}`}>
                        {isCheckinApproved ? '✅ SELESAI — STOK KEMBALI' :
                            isCheckinPending ? '⏳ MENUNGGU APPROVE CHECK IN' :
                                isDelivered ? '📦 DELIVERED — Menunggu Check In' :
                                    header.manager_approval_status === 'APPROVED' ? '✅ CHECKOUT APPROVED' :
                                        header.manager_approval_status === 'REJECTED' ? '❌ DITOLAK' :
                                            '⏳ MENUNGGU APPROVAL'}
                    </div>

                    {hasPicSignature && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Tanda Tangan PIC (Penerima)</p>
                            <button onClick={() => setLightboxUrl(`${BASE_URL}/${header.signature_pic_path}`)}>
                                <img src={`${BASE_URL}/${header.signature_pic_path}`} className="h-20 bg-slate-50 rounded-xl border p-2" alt="TTD PIC" />
                            </button>
                        </div>
                    )}

                    {!hasPicSignature && header.manager_approval_status === 'APPROVED' && (
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                            <p className="text-[10px] font-black text-amber-600">⏳ Menunggu TTD PIC setelah barang diterima di site</p>
                        </div>
                    )}
                </div>

                {/* ══ ENGINEER: CHECKLIST + TTD PIC ══ */}
                {canEngineerSign && (
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-3xl shadow-lg overflow-hidden">

                        {/* Header */}
                        <div className="bg-blue-600 px-5 py-4 text-center">
                            <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest">Konfirmasi Penerimaan Barang</p>
                            <p className="font-black text-white text-base mt-0.5">Validasi & Tanda Tangan PIC</p>
                            <p className="text-xs text-blue-200 mt-1">Centang item yang diterima, lalu TTD untuk konfirmasi</p>
                        </div>

                        <div className="p-5 space-y-4">

                            {/* Progress checklist */}
                            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-2.5">
                                <p className="text-xs font-black text-slate-600">Item Diverifikasi</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full transition-all"
                                            style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }} />
                                    </div>
                                    <p className="text-xs font-black text-blue-600">{checkedCount}/{totalItems}</p>
                                </div>
                            </div>

                            {/* Checklist per item */}
                            <div className="space-y-3">
                                {items.map((item: any) => {
                                    const state = itemReceive[item.qr_id] || { checked: true, qty_received: item.qty, note: '', photo_base64: '' };
                                    const isShort = state.checked && state.qty_received < item.qty;
                                    return (
                                        <div key={item.qr_id}
                                            className={`bg-white rounded-2xl p-4 border-2 transition-all ${state.checked ? 'border-blue-200' : 'border-slate-100 opacity-60'}`}>

                                            {/* Row 1: Checkbox + nama */}
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => updateItemReceive(item.qr_id, 'checked', !state.checked)}
                                                    className={`w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-sm transition-all mt-0.5
                                                        ${state.checked ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                                    {state.checked ? '✓' : ''}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                    <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${item.item_type === 'TOOLS' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {item.item_type}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">Dipesan: <span className="font-black text-slate-700">{item.qty} {item.unit}</span></span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 2: Qty received + foto — hanya jika checked */}
                                            {state.checked && (
                                                <div className="mt-3 space-y-2 pl-10">
                                                    {/* Qty diterima */}
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase flex-shrink-0">Qty Diterima:</label>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => updateItemReceive(item.qr_id, 'qty_received', Math.max(0, state.qty_received - 1))}
                                                                className="w-7 h-7 bg-slate-100 rounded-lg font-black text-slate-500 flex items-center justify-center active:scale-95">−</button>
                                                            <input type="number" min="0" max={item.qty}
                                                                value={state.qty_received}
                                                                onChange={e => updateItemReceive(item.qr_id, 'qty_received', Number(e.target.value))}
                                                                className="w-14 text-center font-black text-blue-600 text-sm border border-slate-200 rounded-lg py-1 outline-none" />
                                                            <button onClick={() => updateItemReceive(item.qr_id, 'qty_received', Math.min(item.qty, state.qty_received + 1))}
                                                                className="w-7 h-7 bg-slate-100 rounded-lg font-black text-slate-500 flex items-center justify-center active:scale-95">＋</button>
                                                            <span className="text-[10px] text-slate-400 ml-1">/ {item.qty} {item.unit}</span>
                                                        </div>
                                                    </div>

                                                    {/* Warning qty kurang */}
                                                    {isShort && (
                                                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                                                            <p className="text-[10px] font-black text-orange-600">
                                                                ⚠️ Kurang {item.qty - state.qty_received} {item.unit} — wajib isi catatan
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Catatan */}
                                                    <input type="text"
                                                        placeholder={isShort ? "Catatan kekurangan (wajib)..." : "Catatan opsional..."}
                                                        value={state.note}
                                                        onChange={e => updateItemReceive(item.qr_id, 'note', e.target.value)}
                                                        className={`w-full p-2.5 rounded-xl outline-none text-xs font-medium text-slate-700
                                                            ${isShort ? 'bg-orange-50 border border-orange-200' : 'bg-slate-50 border border-slate-100'}`} />

                                                    {/* Foto opsional */}
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => photoRefs.current[item.qr_id]?.click()}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl active:scale-95">
                                                            📷 <span>{state.photo_base64 ? 'Ganti Foto' : 'Foto (opsional)'}</span>
                                                        </button>
                                                        {state.photo_base64 && (
                                                            <div className="relative">
                                                                <img src={state.photo_base64} className="w-10 h-10 object-cover rounded-lg border" alt="" />
                                                                <button onClick={() => updateItemReceive(item.qr_id, 'photo_base64', '')}
                                                                    className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">✕</button>
                                                            </div>
                                                        )}
                                                        <input type="file" accept="image/*" capture="environment" className="hidden"
                                                            ref={el => { photoRefs.current[item.qr_id] = el; }}
                                                            onChange={async e => {
                                                                const file = e.target.files?.[0]; if (!file) return;
                                                                const b64 = await compressImage(file);
                                                                updateItemReceive(item.qr_id, 'photo_base64', b64);
                                                            }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tidak diterima */}
                                            {!state.checked && (
                                                <div className="mt-2 pl-10">
                                                    <input type="text" placeholder="Alasan tidak diterima..."
                                                        value={state.note}
                                                        onChange={e => updateItemReceive(item.qr_id, 'note', e.target.value)}
                                                        className="w-full p-2.5 bg-red-50 border border-red-100 rounded-xl outline-none text-xs font-medium text-slate-700" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Validasi warning sebelum TTD */}
                            {(() => {
                                const shortItems = items.filter((item: any) => {
                                    const s = itemReceive[item.qr_id];
                                    return s?.checked && s.qty_received < item.qty && !s.note.trim();
                                });
                                return shortItems.length > 0 ? (
                                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
                                        <p className="text-[10px] font-black text-orange-700">⚠️ Lengkapi catatan untuk item yang kurang:</p>
                                        {shortItems.map((i: any) => <p key={i.qr_id} className="text-[10px] text-orange-600 ml-2">• {i.item_name}</p>)}
                                    </div>
                                ) : null;
                            })()}

                            {/* TTD PIC */}
                            <div className="space-y-2 pt-2 border-t border-blue-200">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-700 uppercase">Tanda Tangan PIC</label>
                                        <p className="text-[9px] text-slate-400 mt-0.5">Nama: <span className="font-bold text-slate-600">{user?.name}</span></p>
                                    </div>
                                    <button onClick={() => picCanvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)}
                                        className="text-[10px] text-blue-500 font-bold">RESET</button>
                                </div>
                                <canvas
                                    ref={picCanvasRef}
                                    width={500} height={250}
                                    onMouseDown={startPicDrawing} onMouseMove={drawPic} onMouseUp={() => setIsPicDrawing(false)}
                                    onTouchStart={startPicDrawing} onTouchMove={drawPic} onTouchEnd={() => setIsPicDrawing(false)}
                                    className="w-full h-44 bg-white rounded-2xl border-2 border-blue-200 touch-none shadow-inner" />
                                <p className="text-[9px] text-slate-400 text-center">Tanda tangani sebagai konfirmasi penerimaan</p>
                            </div>

                            <button onClick={handleSubmitPicSignature} disabled={submittingPicSig}
                                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg text-sm uppercase tracking-widest active:scale-95 disabled:opacity-50">
                                {submittingPicSig ? '⏳ Menyimpan...' : `✅ Konfirmasi Terima ${checkedCount}/${totalItems} Item`}
                            </button>
                        </div>
                    </div>
                )}

                {/* TOMBOL CHECK IN */}
                {isDelivered && hasPicSignature && user?.role !== 'MANAGER' && user?.role !== 'ENGINEER' && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-5 rounded-3xl text-center space-y-3">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Barang Sudah Diterima PIC</p>
                        <p className="text-xs text-blue-600">Instalasi selesai? Lakukan Check In untuk melaporkan kondisi.</p>
                        <button onClick={() => router.push(`/checkin?checkout_id=${header.id}`)}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg text-[10px] uppercase tracking-widest active:scale-95">
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

                {/* SECTION CHECK IN */}
                {(isCheckinPending || isCheckinApproved) && checkinData && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-slate-200" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Laporan Check In</p>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        <div className={`rounded-2xl p-4 border ${isCheckinApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isCheckinApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {isCheckinApproved ? '✅ Check In Disetujui' : '⏳ Menunggu Approval'}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1">{checkinData.header.checkin_code} · {checkinData.header.checkin_date}</p>
                                    <p className="text-xs text-slate-500">PIC: {checkinData.header.pic_name}</p>
                                    {isCheckinApproved && checkinData.header.approved_by && (
                                        <p className="text-[10px] text-emerald-600 font-bold mt-1">Disetujui oleh: {checkinData.header.approved_by}</p>
                                    )}
                                    {checkinData.header.rejection_note && (
                                        <p className="text-[10px] text-red-600 font-bold mt-1">Ditolak: {checkinData.header.rejection_note}</p>
                                    )}
                                </div>
                                {checkinData.header.signature_pic_path && (
                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${checkinData.header.signature_pic_path}`)}>
                                        <img src={`${BASE_URL}/${checkinData.header.signature_pic_path}`}
                                            className="h-14 object-contain rounded-lg border border-slate-200 bg-white p-1" alt="ttd" />
                                        <p className="text-[8px] text-slate-400 text-center mt-0.5">TTD PIC</p>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase ml-1">Kondisi Barang Dikembalikan</p>
                            {checkinData.items?.map((item: any) => (
                                <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getCondLabel(item.condition, item.category || '').color}`}>
                                                    {getCondLabel(item.condition, item.category || '').label}
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

                        {/* APPROVAL CHECK IN */}
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
                                <p className="text-[9px] text-slate-400 text-center">Setelah Approve, stok GOOD & DAMAGED dikembalikan ke gudang.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* APPROVAL CHECKOUT */}
                {header.manager_approval_status === 'PENDING' && (user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                    <div className="bg-white p-5 rounded-3xl border-2 border-slate-900 shadow-xl space-y-4">
                        <h2 className="font-black text-center text-slate-900 text-[10px] uppercase tracking-widest">Persetujuan Keluar Barang</h2>
                        <textarea placeholder="Catatan atau instruksi khusus..."
                            value={managerComment} onChange={e => setManagerComment(e.target.value)}
                            className="w-full p-3.5 bg-slate-50 rounded-2xl text-sm outline-none resize-none" rows={2} />
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan Manager</label>
                                <button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)}
                                    className="text-[10px] text-blue-500 font-bold">RESET</button>
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

                {/* STATUS FINAL */}
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
            <Navbar />
        </main>
    );
}
