'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, tabColor: string }> = {
    PENDING: { label: 'Menunggu', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', tabColor: 'bg-orange-500 text-white' },
    PROCUREMENT_REVIEW: { label: 'Procurement', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', tabColor: 'bg-violet-600 text-white' },
    APPROVED: { label: 'Disetujui', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', tabColor: 'bg-emerald-500 text-white' },
    PENDING_REVISION: { label: 'Perlu Revisi', color: 'text-red-600', bg: 'bg-red-50 border-red-200', tabColor: 'bg-red-500 text-white' },
    REJECTED: { label: 'Ditolak', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', tabColor: 'bg-slate-500 text-white' }
};

const TAB_ICON: Record<string, string> = {
    PENDING: '⏳', PROCUREMENT_REVIEW: '📋', APPROVED: '✅', PENDING_REVISION: '❌', REJECTED: '🗑️'
};

const formatRp = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

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

function GRListContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [selected, setSelected] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [approving, setApproving] = useState(false);
    const [rejectNote, setRejectNote] = useState('');
    const [showReject, setShowReject] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // Procurement state
    const [procPrices, setProcPrices] = useState<Record<number, string>>({});
    const [procNote, setProcNote] = useState('');
    const [procDoc, setProcDoc] = useState('');
    const [procDocPreview, setProcDocPreview] = useState('');
    const [submittingProc, setSubmittingProc] = useState(false);
    const procDocRef = useRef<HTMLInputElement>(null);

    // AI review PO state
    const [reviewingPo, setReviewingPo] = useState(false);
    const [poReviewResult, setPoReviewResult] = useState<any>(null);
    const [poReviewError, setPoReviewError] = useState('');

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        const defaultTab = parsed.role === 'PROCUREMENT' ? 'PENDING'
            : parsed.role === 'MANAGER' ? 'PROCUREMENT_REVIEW' : 'PENDING';
        setFilterStatus(defaultTab);
        fetchList(defaultTab);
    }, []);

    const fetchList = async (status: string) => {
        setLoading(true);
        setSelected(null); setDetail(null); setPoReviewResult(null); setPoReviewError('');
        try {
            const res = await fetch(`${BASE_URL}/get_purchase_list.php?status=${status}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setList(r.data);
        } catch { }
        setLoading(false);
    };

    const openDetail = async (item: any) => {
        setSelected(item); setDetail(null); setLoadingDetail(true);
        setShowReject(false); setRejectNote('');
        setProcPrices({}); setProcNote(''); setProcDoc(''); setProcDocPreview('');

        try {
            const res = await fetch(`${BASE_URL}/get_purchase_list.php?id=${item.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setDetail(r);
                const prices: Record<number, string> = {};
                r.items?.forEach((i: any) => { prices[i.id] = i.unit_price > 0 ? String(i.unit_price) : ''; });
                setProcPrices(prices);
            }
        } catch { }
        setLoadingDetail(false);
    };

    const handleReviewPo = async () => {
        if (!selected?.sj_photo_path) { alert("Foto SJ dari staff tidak ada!"); return; }
        if (!procDoc) { alert("Upload dokumen PO Sedayu dulu!"); return; }
        setReviewingPo(true); setPoReviewResult(null); setPoReviewError('');
        try {
            const res = await fetch(`${BASE_URL}/openai_proxy.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    mode: 'review_po',
                    sj_image_url: `${BASE_URL}/${selected.sj_photo_path}`,
                    po_image: procDoc,
                })
            });
            const r = await res.json();
            if (r.status === 'success' && r.result?.items) {
                setPoReviewResult(r.result);
                if (detail?.items) {
                    const newPrices = { ...procPrices };
                    const findMatch = (aiItem: any) => {
                        const poName = (aiItem.po_item_name || '').toLowerCase().trim();
                        const sjName = (aiItem.sj_item_name || '').toLowerCase().trim();

                        let match = detail.items.find((di: any) => {
                            const diName = di.item_name.toLowerCase().trim();
                            return diName === poName || diName === sjName;
                        });
                        if (match) return match;

                        match = detail.items.find((di: any) => {
                            const diName = di.item_name.toLowerCase().trim();
                            return diName.includes(poName) || poName.includes(diName) ||
                                diName.includes(sjName) || sjName.includes(diName);
                        });
                        if (match) return match;

                        const poTokens = poName.split(/\s+/).filter((t: string) => t.length > 2);
                        const sjTokens = sjName.split(/\s+/).filter((t: string) => t.length > 2);
                        let bestScore = 0;
                        let bestMatch: any = null;
                        detail.items.forEach((di: any) => {
                            const diTokens = di.item_name.toLowerCase().split(/\s+/);
                            const score = [...poTokens, ...sjTokens].filter((t: string) =>
                                diTokens.some((dt: string) => dt.includes(t) || t.includes(dt))
                            ).length;
                            if (score > bestScore) { bestScore = score; bestMatch = di; }
                        });
                        return bestScore >= 2 ? bestMatch : null;
                    };

                    r.result.items.forEach((aiItem: any) => {
                        if (!aiItem.hpp_final) return;
                        const matched = findMatch(aiItem);
                        if (matched) {
                            newPrices[matched.id] = String(Math.round(aiItem.hpp_final));
                        }
                    });
                    setProcPrices(newPrices);
                }
            } else {
                setPoReviewError('AI gagal membaca dokumen. Pastikan foto jelas dan tidak blur.');
            }
        } catch { setPoReviewError('Koneksi gagal.'); }
        setReviewingPo(false);
    };

    const findMatchedItem = (aiItem: any, items: any[]) => {
        const poName = (aiItem.po_item_name || '').toLowerCase().trim();
        const sjName = (aiItem.sj_item_name || '').toLowerCase().trim();
        let m = items.find((di: any) => {
            const n = di.item_name.toLowerCase().trim();
            return n === poName || n === sjName;
        });
        if (m) return m;
        m = items.find((di: any) => {
            const n = di.item_name.toLowerCase().trim();
            return n.includes(poName) || poName.includes(n) || n.includes(sjName) || sjName.includes(n);
        });
        if (m) return m;
        const tokens = [...poName.split(/\s+/), ...sjName.split(/\s+/)].filter((t: string) => t.length > 2);
        let best = 0, bestM: any = null;
        items.forEach((di: any) => {
            const dn = di.item_name.toLowerCase().split(/\s+/);
            const score = tokens.filter((t: string) => dn.some((dt: string) => dt.includes(t) || t.includes(dt))).length;
            if (score > best) { best = score; bestM = di; }
        });
        return best >= 2 ? bestM : null;
    };

    const applyAllHppFromReview = () => {
        if (!poReviewResult?.items || !detail?.items) return;
        const newPrices = { ...procPrices };
        poReviewResult.items.forEach((aiItem: any) => {
            if (!aiItem.hpp_final) return;
            const matched = findMatchedItem(aiItem, detail.items);
            if (matched) newPrices[matched.id] = String(Math.round(aiItem.hpp_final));
        });
        setProcPrices(newPrices);
    };

    const handleApprove = async () => {
        if (!selected) return;
        setApproving(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_purchase.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ po_id: selected.id, action: 'approve', approved_by: user?.name })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(r.message); setSelected(null); setDetail(null); fetchList(filterStatus); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setApproving(true);
    };

    const handleReject = async () => {
        if (!rejectNote.trim()) { alert("Catatan penolakan wajib."); return; }
        setApproving(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_purchase.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ po_id: selected.id, action: 'reject', approved_by: user?.name, rejection_note: rejectNote })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(r.message); setSelected(null); setDetail(null); setShowReject(false); fetchList(filterStatus); }
            else alert("Gagal koneksi.");
        } catch { alert("Gagal koneksi."); }
        setApproving(false);
    };

    const handleSubmitProcurement = async () => {
        if (!selected || !detail) return;
        const missingPrice = detail.items?.filter((i: any) => !procPrices[i.id] || Number(procPrices[i.id]) <= 0);
        if (missingPrice?.length > 0) {
            alert(`HPP wajib diisi untuk semua item:\n${missingPrice.map((i: any) => `• ${i.item_name}`).join('\n')}`);
            return;
        }
        if (!procDoc) { alert("Upload dokumen PO dari Sedayu wajib!"); return; }
        if (!confirm("Submit ke Manager untuk approval?")) return;
        setSubmittingProc(true);
        try {
            const items = detail.items?.map((i: any) => ({ id: i.id, unit_price: Number(procPrices[i.id]) || 0 }));
            const res = await fetch(`${BASE_URL}/submit_procurement_review.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ po_id: selected.id, procurement_by: user?.name, procurement_note: procNote, procurement_doc_base64: procDoc, items })
            });
            const r = await res.json();
            if (r.status === 'success') { alert("✅ " + r.message); setSelected(null); setDetail(null); fetchList(filterStatus); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSubmittingProc(false);
    };

    if (!user) return null;

    const visibleTabs = user.role === 'PROCUREMENT'
        ? ['PENDING', 'APPROVED', 'PENDING_REVISION']
        : user.role === 'MANAGER' || user.role === 'ADMIN'
            ? ['PENDING', 'PROCUREMENT_REVIEW', 'APPROVED', 'PENDING_REVISION']
            : ['PENDING', 'APPROVED', 'PENDING_REVISION'];

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">
            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-5 right-5 text-white bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-black text-lg">✕</button>
                    <img src={lightboxUrl} alt="doc" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* DETAIL DRAWER */}
            {selected && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => { setSelected(null); setDetail(null); }}>
                    <div className="flex-1 overflow-y-auto mt-12" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-32 space-y-5">
                            {/* Header PO */}
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${STATUS_CONFIG[selected.approval_status]?.bg} ${STATUS_CONFIG[selected.approval_status]?.color}`}>
                                        {TAB_ICON[selected.approval_status]} {STATUS_CONFIG[selected.approval_status]?.label}
                                    </div>
                                    <h2 className="font-black text-lg text-slate-900 mt-2">{selected.po_code}</h2>
                                    {selected.po_number && <p className="text-[10px] font-mono text-slate-400">No. PO: {selected.po_number}</p>}
                                    <div className="flex gap-4 mt-2">
                                        {selected.supplier && <div>
                                            <p className="text-[9px] text-slate-400 uppercase">Supplier</p>
                                            <p className="text-xs font-bold text-slate-600">{selected.supplier}</p>
                                        </div>}
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase">Tanggal</p>
                                            <p className="text-xs font-bold text-slate-600">{selected.po_date}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase">Disubmit</p>
                                            <p className="text-xs font-bold text-slate-600">{selected.created_by}</p>
                                        </div>
                                    </div>
                                    {selected.rejection_note && (
                                        <div className="mt-2 bg-red-50 rounded-xl p-2.5">
                                            <p className="text-[10px] text-red-600 font-bold">Alasan ditolak: {selected.rejection_note}</p>
                                        </div>
                                    )}
                                    {selected.approved_by && selected.approval_status === 'APPROVED' && (
                                        <p className="text-[10px] text-emerald-600 font-bold mt-1">✅ Disetujui oleh: {selected.approved_by}</p>
                                    )}
                                    {selected.procurement_by && (
                                        <p className="text-[10px] text-violet-600 font-bold mt-1">📋 Procurement: {selected.procurement_by}</p>
                                    )}
                                </div>
                                <button onClick={() => { setSelected(null); setDetail(null); }} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {/* Foto SJ */}
                            {selected.sj_photo_path && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">📄 Surat Jalan (dari Staff)</p>
                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${selected.sj_photo_path}`)} className="w-full">
                                        <img src={`${BASE_URL}/${selected.sj_photo_path}`} className="w-full max-h-48 object-cover rounded-2xl border border-slate-100" alt="SJ" />
                                        <p className="text-[9px] text-slate-400 text-center mt-1">👆 Tap untuk perbesar</p>
                                    </button>
                                </div>
                            )}

                            {/* Dok PO Procurement */}
                            {selected.procurement_doc_path && (
                                <div>
                                    <p className="text-[10px] font-black text-violet-500 uppercase mb-2">📋 Dokumen PO Sedayu</p>
                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${selected.procurement_doc_path}`)} className="w-full">
                                        <img src={`${BASE_URL}/${selected.procurement_doc_path}`} className="w-full max-h-48 object-cover rounded-2xl border border-violet-100" alt="PO Doc" />
                                    </button>
                                    {selected.procurement_note && <p className="text-[10px] text-slate-500 italic mt-1">"{selected.procurement_note}"</p>}
                                </div>
                            )}

                            {loadingDetail ? (
                                <p className="text-center animate-pulse text-slate-400 py-8">Memuat detail...</p>
                            ) : detail && (
                                <>
                                    {/* ══ PROCUREMENT: Input HPP + AI Assist ══ */}
                                    {(selected.approval_status === 'PENDING' || selected.approval_status === 'PENDING_REVISION') && user.role === 'PROCUREMENT' && (
                                        <div className="bg-violet-50 border-2 border-violet-200 rounded-3xl overflow-hidden">
                                            <div className="bg-violet-600 px-5 py-3 text-center">
                                                <p className="font-black text-white text-sm">📋 Review GR {selected.approval_status === 'PENDING_REVISION' && '(Revisi)'}</p>
                                                <p className="text-violet-200 text-[10px] mt-0.5">Isi HPP + lampirkan dokumen PO Sedayu</p>
                                            </div>

                                            <div className="p-4 space-y-4">
                                                <p className="text-[10px] font-black text-violet-700 uppercase">Harga Satuan (HPP) per Item *</p>

                                                {detail.items?.map((item: any) => {
                                                    const hasPrice = procPrices[item.id] && Number(procPrices[item.id]) > 0;
                                                    return (
                                                        <div key={item.id} className="bg-white rounded-2xl p-3.5 border border-violet-100 space-y-2">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                                    <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                                    <p className="text-[10px] text-slate-500">Qty: <span className="font-black">{item.qty} {item.unit}</span></p>
                                                                </div>
                                                                <div className="flex-shrink-0 w-32">
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                                        <input type="number" min="0"
                                                                            value={procPrices[item.id] || ''}
                                                                            onChange={e => setProcPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                            placeholder="0"
                                                                            className={`w-full p-2 pl-7 rounded-xl outline-none text-sm font-bold text-right ${!hasPrice ? 'bg-red-50 border border-red-200 text-red-500' : 'bg-violet-50 border border-violet-200 text-violet-700'}`} />
                                                                    </div>
                                                                    {hasPrice && (
                                                                        <p className="text-[9px] text-violet-500 text-right mt-0.5 font-bold">
                                                                            = {formatRp(item.qty * Number(procPrices[item.id]))}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {detail.items?.every((i: any) => Number(procPrices[i.id]) > 0) && (
                                                    <div className="bg-violet-700 text-white rounded-2xl p-3.5 flex justify-between items-center">
                                                        <p className="text-[10px] font-black uppercase tracking-widest">Total Nilai GR</p>
                                                        <p className="font-black text-lg">
                                                            {formatRp(detail.items.reduce((s: number, i: any) => s + i.qty * Number(procPrices[i.id] || 0), 0))}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Upload dokumen PO */}
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-violet-700 uppercase">Dokumen PO Sedayu *</p>
                                                    {procDocPreview ? (
                                                        <div className="space-y-2">
                                                            <div className="relative">
                                                                <img src={procDocPreview} className="w-full max-h-48 object-cover rounded-2xl border border-violet-200" alt="dok" />
                                                                <button onClick={() => { setProcDoc(''); setProcDocPreview(''); setPoReviewResult(null); setPoReviewError(''); }} className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg font-black">✕ Hapus</button>
                                                                <p className="text-[10px] text-emerald-600 font-bold text-center mt-1">✅ Dokumen tersimpan</p>
                                                            </div>
                                                            <button onClick={handleReviewPo} disabled={reviewingPo} className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black py-3.5 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                                                                {reviewingPo ? (
                                                                    <><span className="animate-spin">⏳</span><span>AI membaca & mencocokkan...</span></>
                                                                ) : (
                                                                    <><span className="text-base">🤖</span><span>Review & Cocokkan dengan AI</span></>
                                                                )}
                                                            </button>
                                                            {poReviewError && (
                                                                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                                                    <p className="text-[10px] font-black text-red-600">⚠️ {poReviewError}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => procDocRef.current?.click()} className="w-full border-2 border-dashed border-violet-300 rounded-2xl py-8 text-center active:bg-violet-50">
                                                            <p className="text-2xl mb-1">📄</p>
                                                            <p className="font-black text-violet-400 text-sm">Foto / Upload Dokumen PO Sedayu</p>
                                                            <p className="text-[10px] text-violet-300 mt-0.5">AI akan cocokkan & extract HPP otomatis</p>
                                                        </button>
                                                    )}
                                                    <input ref={procDocRef} type="file" accept="image/*" capture="environment" className="hidden"
                                                        onChange={async e => {
                                                            const file = e.target.files?.[0]; if (!file) return;
                                                            const b64 = await compressImage(file);
                                                            setProcDoc(b64); setProcDocPreview(b64);
                                                            setPoReviewResult(null); setPoReviewError('');
                                                        }} />
                                                </div>

                                                {/* ══ AI REVIEW RESULT ══ */}
                                                {poReviewResult && (
                                                    <div className="bg-white border-2 border-blue-200 rounded-2xl overflow-hidden">
                                                        <div className={`px-4 py-3 text-white ${poReviewResult.summary?.match_status === 'SESUAI' ? 'bg-emerald-600' : poReviewResult.summary?.match_status === 'TIDAK SESUAI' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex-1">
                                                                    <p className="font-black text-sm">
                                                                        {poReviewResult.summary?.match_status === 'SESUAI' ? '✅' : poReviewResult.summary?.match_status === 'TIDAK SESUAI' ? '❌' : '⚠️'} {poReviewResult.summary?.match_status}
                                                                    </p>
                                                                    <p className="text-[10px] opacity-80 mt-0.5">{poReviewResult.summary?.notes}</p>
                                                                </div>
                                                                <button onClick={applyAllHppFromReview} className="flex-shrink-0 bg-white/20 text-white font-black text-[9px] px-3 py-2 rounded-xl active:scale-95">
                                                                    Pakai Semua HPP
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="divide-y divide-slate-50">
                                                            {poReviewResult.items?.map((aiItem: any, idx: number) => (
                                                                <div key={idx} className={`p-3.5 ${aiItem.status !== 'OK' ? 'bg-amber-50/50' : ''}`}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${aiItem.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : aiItem.status === 'QTY_BEDA' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                                                            {aiItem.status === 'OK' ? '✅ Sesuai' : aiItem.status === 'QTY_BEDA' ? `⚠️ Qty Beda (SJ:${aiItem.qty_sj} vs PO:${aiItem.qty_po})` : aiItem.status === 'TIDAK_ADA_DI_PO' ? '❓ Tidak ada di PO' : '📋 Tidak ada di SJ'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                                                        <div className="bg-slate-50 rounded-xl p-2">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">SJ Vendor</p>
                                                                            <input type="text" value={aiItem.sj_item_name || ''} onChange={e => setPoReviewResult((prev: any) => ({ ...prev, items: prev.items.map((it: any, i2: number) => i2 === idx ? { ...it, sj_item_name: e.target.value } : it) }))} className="w-full text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none mt-0.5" />
                                                                        </div>
                                                                        <div className="bg-violet-50 rounded-xl p-2">
                                                                            <p className="text-[8px] font-black text-violet-400 uppercase mb-0.5">PO Sedayu</p>
                                                                            <input type="text" value={aiItem.po_item_name || ''} onChange={e => setPoReviewResult((prev: any) => ({ ...prev, items: prev.items.map((it: any, i2: number) => i2 === idx ? { ...it, po_item_name: e.target.value } : it) }))} className="w-full text-[10px] font-bold text-violet-700 bg-white border border-violet-200 rounded-lg px-2 py-1 outline-none mt-0.5" />
                                                                        </div>
                                                                    </div>
                                                                    {aiItem.hpp_final && (
                                                                        <div className="bg-blue-50 rounded-xl p-2.5 space-y-1">
                                                                            <div className="flex justify-between">
                                                                                <p className="text-[9px] text-slate-500">Harga satuan PO</p>
                                                                                <p className="text-[10px] font-bold text-slate-700">{formatRp(aiItem.unit_price_po)}</p>
                                                                            </div>
                                                                            <div className="pt-1 border-t border-blue-100 space-y-1.5">
                                                                                <p className="text-[9px] font-black text-blue-700 uppercase">HPP Final / {aiItem.unit}</p>
                                                                                {(() => {
                                                                                    const matched = detail?.items ? findMatchedItem(aiItem, detail.items) : null;
                                                                                    const currentVal = matched ? (procPrices[matched.id] || '') : '';
                                                                                    const aiVal = String(Math.round(aiItem.hpp_final));
                                                                                    const isEdited = currentVal && currentVal !== aiVal;
                                                                                    return matched ? (
                                                                                        <div className="space-y-1">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="relative flex-1">
                                                                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-bold">Rp</span>
                                                                                                    <input type="number" min="0" value={procPrices[matched.id] || aiVal} onChange={e => setProcPrices(prev => ({ ...prev, [matched.id]: e.target.value }))} className="w-full p-2 pl-8 bg-white border-2 border-blue-300 rounded-xl outline-none text-sm font-black text-blue-700 text-right" />
                                                                                                </div>
                                                                                                {isEdited && (
                                                                                                    <button onClick={() => setProcPrices(prev => ({ ...prev, [matched.id]: aiVal }))} className="text-[9px] font-black text-slate-400 bg-white border border-slate-200 px-2 py-1.5 rounded-lg flex-shrink-0">↩ AI</button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="text-sm font-black text-blue-700">{formatRp(aiItem.hpp_final)}</p>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <input type="text" placeholder="Catatan procurement (opsional)..." value={procNote} onChange={e => setProcNote(e.target.value)} className="w-full p-3 bg-white border border-violet-100 rounded-xl outline-none text-sm font-medium text-slate-700" />
                                                <button onClick={handleSubmitProcurement} disabled={submittingProc} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50">
                                                    {submittingProc ? '⏳ Menyimpan...' : '📋 Submit ke Manager'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Item list — non-procurement */}
                                    {((user.role !== 'PROCUREMENT' || (selected.approval_status !== 'PENDING' && selected.approval_status !== 'PENDING_REVISION'))) && (
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Item ({detail.items?.length})</p>
                                            <div className="space-y-2">
                                                {detail.items?.map((item: any) => (
                                                    <div key={item.id} className={`rounded-2xl p-3.5 border-l-4 bg-slate-50 ${item.category === 'Tools' ? 'border-l-amber-400' : 'border-l-emerald-400'}`}>
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    {item.is_new_item === 1 && <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">BARU</span>}
                                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.category}</span>
                                                                </div>
                                                                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                                <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                                <p className="text-[10px] text-slate-500">📍 {item.location_name}</p>
                                                                <p className="text-[10px] text-violet-500 font-bold">
                                                                    {Number(item.unit_price) > 0 ? `HPP: ${formatRp(Number(item.unit_price))} / ${item.unit}` : <span className="text-slate-300 italic">HPP belum diisi</span>}
                                                                </p>
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <p className="font-black text-lg text-blue-600">{item.qty}</p>
                                                                <p className="text-[10px] text-slate-400">{item.unit}</p>
                                                                <p className="text-[10px] font-bold text-slate-500">
                                                                    {Number(item.unit_price) > 0 ? `= ${formatRp(Number(item.qty) * Number(item.unit_price))}` : '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-3 bg-slate-900 text-white rounded-2xl p-3.5 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Total Nilai GR</p>
                                                    {detail.items?.some((i: any) => Number(i.unit_price) === 0) && <p className="text-[9px] text-slate-400">* Ada item tanpa HPP</p>}
                                                </div>
                                                <p className="font-black text-lg">
                                                    {detail.items?.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0) > 0
                                                        ? formatRp(detail.items.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0))
                                                        : <span className="text-slate-400 text-sm italic">HPP belum diisi</span>}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* APPROVAL MANAGER */}
                                    {selected.approval_status === 'PROCUREMENT_REVIEW' && (user.role === 'MANAGER' || user.role === 'ADMIN') && (
                                        <div className="space-y-3 pt-2">
                                            {showReject ? (
                                                <div className="space-y-3">
                                                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Alasan penolakan *" rows={3} className="w-full p-3.5 bg-red-50 rounded-xl outline-none font-medium text-slate-700 resize-none border border-red-200" />
                                                    <div className="flex gap-3">
                                                        <button onClick={() => setShowReject(false)} className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                                        <button onClick={handleReject} disabled={approving} className="flex-1 bg-red-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                                            {approving ? 'Menolak...' : '❌ Minta Revisi'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3">
                                                    <button onClick={() => setShowReject(true)} className="flex-1 bg-red-50 text-red-600 font-black py-3.5 rounded-2xl text-xs uppercase border border-red-200">❌ Tolak</button>
                                                    <button onClick={handleApprove} disabled={approving} className="flex-1 bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                                        {approving ? 'Menyetujui...' : '✅ Approve & Masukkan Stok'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selected.approval_status === 'PENDING' && user.role !== 'PROCUREMENT' && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-center">
                                            <p className="text-[10px] font-black text-amber-600">⏳ Menunggu review dari Tim Procurement</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB FILTER */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-3 py-2">
                <div className="max-w-2xl mx-auto flex gap-1.5 overflow-x-auto">
                    {visibleTabs.map(s => (
                        <button key={s} onClick={() => { setFilterStatus(s); fetchList(s); }} className={`flex-shrink-0 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${filterStatus === s ? STATUS_CONFIG[s].tabColor : 'bg-slate-100 text-slate-400'}`}>
                            {TAB_ICON[s]} {STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* LIST */}
            <div className="p-4 max-w-2xl mx-auto space-y-3">
                {loading ? (
                    <div className="text-center py-20 animate-pulse text-slate-400 font-bold">Memuat...</div>
                ) : list.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">
                        {filterStatus === 'PENDING' ? 'Tidak ada GR yang menunggu.' : filterStatus === 'PROCUREMENT_REVIEW' ? 'Tidak ada GR menunggu approval manager.' : 'Tidak ada data.'}
                    </div>
                ) : list.map((item: any) => (
                    <button key={item.id} onClick={() => openDetail(item)} className={`w-full bg-white rounded-2xl shadow-sm border p-4 text-left hover:shadow-md transition-all active:scale-[0.99] ${item.approval_status === 'PENDING' ? 'border-orange-200' : item.approval_status === 'PROCUREMENT_REVIEW' ? 'border-violet-200' : item.approval_status === 'APPROVED' ? 'border-emerald-200' : 'border-red-200'}`}>
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${STATUS_CONFIG[item.approval_status]?.bg} ${STATUS_CONFIG[item.approval_status]?.color}`}>
                                        {TAB_ICON[item.approval_status]} {STATUS_CONFIG[item.approval_status]?.label}
                                    </span>
                                </div>
                                <p className="font-bold text-sm text-slate-800">{item.po_code}</p>
                                {item.po_number && <p className="text-[10px] font-mono text-slate-400">No. PO: {item.po_number}</p>}
                                {item.supplier && <p className="text-[10px] text-slate-500 font-bold">🏪 {item.supplier}</p>}
                                <p className="text-[10px] text-slate-400">{item.po_date} · {item.created_by}</p>
                                <p className="text-[10px] text-slate-400">{item.total_items} item · {item.total_qty} pcs</p>
                                {item.procurement_by && <p className="text-[10px] text-violet-500 font-bold">📋 {item.procurement_by}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-slate-400">
                                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                </p>
                                {item.approval_status === 'PENDING' && user.role === 'PROCUREMENT' && (
                                    <p className="text-[9px] font-black text-violet-500 mt-1">→ Review</p>
                                )}
                                {item.approval_status === 'PENDING_REVISION' && user.role === 'PROCUREMENT' && (
                                    <p className="text-[9px] font-black text-red-500 mt-1">→ Revisi</p>
                                )}
                                {item.approval_status === 'PROCUREMENT_REVIEW' && (user.role === 'MANAGER' || user.role === 'ADMIN') && (
                                    <p className="text-[9px] font-black text-emerald-500 mt-1">→ Approve</p>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            <Navbar />
        </main>
    );
}

export default function GRListPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <GRListContent />
        </Suspense>
    );
}