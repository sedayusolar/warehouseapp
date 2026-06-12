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

const readAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

// ── Type untuk manual item ──
interface ManualItem {
    id: string;
    item_name: string;
    qty: string;
    unit: string;
    unit_price: string;
}

const UNIT_OPTIONS = ['pcs', 'set', 'unit', 'kg', 'meter', 'm', 'roll', 'botol', 'pack', 'box', 'lembar', 'buah'];

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
    const [isPdf, setIsPdf] = useState(false);
    const [submittingProc, setSubmittingProc] = useState(false);
    const procDocRef = useRef<HTMLInputElement>(null);

    // Manual item state — Bug #3
    const [manualItems, setManualItems] = useState<ManualItem[]>([]);

    // Edit/Delete item state (untuk PENDING_REVISION)
    const [editedItems, setEditedItems] = useState<Record<number, { item_name: string; qty: string; unit: string }>>({});
    const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(new Set());
    const [expandedEditId, setExpandedEditId] = useState<number | null>(null);

    const toggleDeleteItem = (id: number, itemName: string) => {
        if (!deletedItemIds.has(id)) {
            if (!confirm(`Hapus item "${itemName}"?`)) return;
        }
        setDeletedItemIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const getEditedItem = (item: any) => ({
        item_name: editedItems[item.id]?.item_name ?? item.item_name,
        qty: editedItems[item.id]?.qty ?? String(item.qty),
        unit: editedItems[item.id]?.unit ?? item.unit,
    });

    const updateEditedItem = (id: number, field: string, value: string) => {
        setEditedItems(prev => ({ ...prev, [id]: { ...getEditedItem({ id, ...prev[id] }), [field]: value } }));
    };

    const addManualItem = () => {
        setManualItems(prev => [...prev, {
            id: `manual_${Date.now()}`,
            item_name: '',
            qty: '',
            unit: 'pcs',
            unit_price: ''
        }]);
    };

    const updateManualItem = (id: string, field: string, value: string) => {
        setManualItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const removeManualItem = (id: string) => {
        setManualItems(prev => prev.filter(i => i.id !== id));
    };

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
        setProcPrices({}); setProcNote(''); setProcDoc(''); setProcDocPreview(''); setIsPdf(false);
        setManualItems([]);
        setEditedItems({}); setDeletedItemIds(new Set()); setExpandedEditId(null);
        setPoReviewResult(null); setPoReviewError('');

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
                    file_type: isPdf ? 'pdf' : 'image'
                })
            });
            const r = await res.json();
            if (r.status === 'success' && r.result?.items) {
                setPoReviewResult(r.result);
                if (detail?.items) {
                    const newPrices = { ...procPrices };
                    r.result.items.forEach((aiItem: any) => {
                        if (!aiItem.hpp_final) return;
                        const matched = findMatchedItem(aiItem, detail.items);
                        if (matched) {
                            newPrices[matched.id] = String(Math.round(aiItem.hpp_final));
                        }
                    });
                    setProcPrices(newPrices);
                }
            } else {
                setPoReviewError(r.message || 'AI gagal membaca dokumen. Pastikan file jelas dan tidak blur.');
            }
        } catch { setPoReviewError('Koneksi gagal.'); }
        setReviewingPo(false);
    };

    const findMatchedItem = (aiItem: any, items: any[]) => {
        const poName = (aiItem.po_item_name || '').toLowerCase().trim();
        const sjName = (aiItem.sj_item_name || '').toLowerCase().trim();

        // exact match
        let m = items.find((di: any) => {
            const n = di.item_name.toLowerCase().trim();
            return n === poName || n === sjName;
        });
        if (m) return m;

        // contains match
        m = items.find((di: any) => {
            const n = di.item_name.toLowerCase().trim();
            return n.includes(poName) || poName.includes(n) || n.includes(sjName) || sjName.includes(n);
        });
        if (m) return m;

        // token match
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
        setApproving(false);
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

        // Item aktif = yang tidak dihapus
        const activeItems = detail.items?.filter((i: any) => !deletedItemIds.has(i.id)) ?? [];

        // Validasi HPP hanya untuk item aktif
        const missingPrice = activeItems.filter((i: any) => !procPrices[i.id] || Number(procPrices[i.id]) <= 0);
        if (missingPrice.length > 0) {
            alert(`HPP wajib diisi untuk semua item:\n${missingPrice.map((i: any) => `• ${i.item_name}`).join('\n')}`);
            return;
        }

        // Validasi manual items
        const incompleteManual = manualItems.filter(
            i => !i.item_name.trim() || !i.qty || Number(i.qty) <= 0 || !i.unit_price || Number(i.unit_price) <= 0
        );
        if (incompleteManual.length > 0) {
            alert(`Item manual belum lengkap. Isi nama, qty, dan HPP — atau hapus item yang kosong.`);
            return;
        }

        // Dokumen PO wajib hanya saat PENDING pertama, revisi boleh skip (pakai dok lama)
        const isRevision = selected.approval_status === 'PENDING_REVISION';
        if (!procDoc && !isRevision) { alert("Upload dokumen PO dari Sedayu wajib!"); return; }
        if (!confirm("Submit ke Manager untuk approval?")) return;

        setSubmittingProc(true);
        try {
            // Item DB aktif: kirim id + unit_price + perubahan nama/qty/unit
            const items = activeItems.map((i: any) => ({
                id: i.id,
                unit_price: Number(procPrices[i.id]) || 0,
                item_name: editedItems[i.id]?.item_name ?? i.item_name,
                qty: Number(editedItems[i.id]?.qty ?? i.qty),
                unit: editedItems[i.id]?.unit ?? i.unit,
            }));

            const manualItemsPayload = manualItems.map(i => ({
                item_name: i.item_name.trim(),
                qty: Number(i.qty),
                unit: i.unit,
                unit_price: Number(i.unit_price)
            }));

            const res = await fetch(`${BASE_URL}/submit_procurement_review.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    po_id: selected.id,
                    procurement_by: user?.name,
                    procurement_note: procNote,
                    procurement_doc_base64: procDoc,
                    items,
                    manual_items: manualItemsPayload,
                    deleted_item_ids: Array.from(deletedItemIds),
                    file_ext: isPdf ? 'pdf' : 'jpg'
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert("✅ " + r.message);
                setSelected(null); setDetail(null); fetchList(filterStatus);
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSubmittingProc(false);
    };

    if (!user) return null;

    const visibleTabs = user.role === 'PROCUREMENT'
        ? ['PENDING', 'APPROVED', 'PENDING_REVISION']
        : user.role === 'MANAGER' || user.role === 'ADMIN'
            ? ['PENDING', 'PROCUREMENT_REVIEW', 'APPROVED', 'PENDING_REVISION']
            : ['PENDING', 'PROCUREMENT_REVIEW', 'APPROVED', 'PENDING_REVISION'];

    // Hitung total GR: exclude deleted, pakai edited qty jika ada
    const totalGRWithManual = () => {
        const fromDB = detail?.items
            ?.filter((i: any) => !deletedItemIds.has(i.id))
            ?.reduce((s: number, i: any) => {
                const qty = Number(editedItems[i.id]?.qty ?? i.qty);
                return s + qty * Number(procPrices[i.id] || 0);
            }, 0) || 0;
        const fromManual = manualItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
        return fromDB + fromManual;
    };

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">
            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-5 right-5 text-white bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-black text-lg">✕</button>
                    {lightboxUrl.toLowerCase().endsWith('.pdf') ? (
                        <iframe src={lightboxUrl} className="w-full h-full max-w-4xl max-h-[85vh] rounded-xl bg-white" title="PDF Viewer" />
                    ) : (
                        <img src={lightboxUrl} alt="doc" className="max-w-full max-h-full object-contain rounded-xl" />
                    )}
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
                                    {selected.procurement_doc_path.toLowerCase().endsWith('.pdf') ? (
                                        <button onClick={() => setLightboxUrl(`${BASE_URL}/${selected.procurement_doc_path}`)} className="w-full p-6 border rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-2 text-violet-600 font-black text-xs">
                                            <span className="text-3xl">📕</span>
                                            <span>Lihat Dokumen PO (PDF)</span>
                                        </button>
                                    ) : (
                                        <button onClick={() => setLightboxUrl(`${BASE_URL}/${selected.procurement_doc_path}`)} className="w-full">
                                            <img src={`${BASE_URL}/${selected.procurement_doc_path}`} className="w-full max-h-48 object-cover rounded-2xl border border-violet-100" alt="PO Doc" />
                                        </button>
                                    )}
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
                                                {/* ── HPP per item dari DB ── */}
                                                <p className="text-[10px] font-black text-violet-700 uppercase">Harga Satuan (HPP) per Item *</p>

                                                {detail.items?.map((item: any) => {
                                                    const isDeleted = deletedItemIds.has(item.id);
                                                    const isExpanded = expandedEditId === item.id;
                                                    const edited = getEditedItem(item);
                                                    const hasPrice = procPrices[item.id] && Number(procPrices[item.id]) > 0;
                                                    const isRevision = selected.approval_status === 'PENDING_REVISION';

                                                    if (isDeleted) return (
                                                        <div key={item.id} className="bg-red-50 border border-red-200 rounded-2xl p-3 flex justify-between items-center opacity-60">
                                                            <div>
                                                                <p className="text-xs font-bold text-red-400 line-through">{item.item_name}</p>
                                                                <p className="text-[9px] text-red-300">Akan dihapus saat submit</p>
                                                            </div>
                                                            <button onClick={() => toggleDeleteItem(item.id, item.item_name)} className="text-[9px] font-black text-red-500 bg-white border border-red-200 px-2.5 py-1.5 rounded-xl">
                                                                ↩ Batal
                                                            </button>
                                                        </div>
                                                    );

                                                    return (
                                                        <div key={item.id} className={`bg-white rounded-2xl border space-y-2 overflow-hidden ${isExpanded ? 'border-blue-300' : 'border-violet-100'}`}>
                                                            {/* Baris utama */}
                                                            <div className="flex justify-between items-start gap-2 p-3.5">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-sm text-slate-800">{edited.item_name}</p>
                                                                    <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                                    <p className="text-[10px] text-slate-500">Qty: <span className="font-black">{edited.qty} {edited.unit}</span></p>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                    {/* Tombol edit & delete hanya saat PENDING_REVISION */}
                                                                    {isRevision && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => setExpandedEditId(isExpanded ? null : item.id)}
                                                                                className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}
                                                                            >✏️</button>
                                                                            <button
                                                                                onClick={() => toggleDeleteItem(item.id, item.item_name)}
                                                                                className="w-8 h-8 bg-red-50 text-red-400 rounded-xl font-black text-sm flex items-center justify-center"
                                                                            >🗑️</button>
                                                                        </>
                                                                    )}
                                                                    {/* Input HPP */}
                                                                    <div className="w-32">
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
                                                                                = {formatRp(Number(edited.qty) * Number(procPrices[item.id]))}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Panel edit (expand) */}
                                                            {isExpanded && (
                                                                <div className="bg-blue-50 border-t border-blue-100 px-3.5 pb-3.5 pt-3 space-y-2.5">
                                                                    <p className="text-[9px] font-black text-blue-600 uppercase">Edit Item</p>
                                                                    <input
                                                                        type="text"
                                                                        value={edited.item_name}
                                                                        onChange={e => updateEditedItem(item.id, 'item_name', e.target.value)}
                                                                        placeholder="Nama item"
                                                                        className="w-full p-2.5 bg-white rounded-xl outline-none text-sm font-bold text-slate-700 border border-blue-200"
                                                                    />
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Qty</p>
                                                                            <input
                                                                                type="number" min="0"
                                                                                value={edited.qty}
                                                                                onChange={e => updateEditedItem(item.id, 'qty', e.target.value)}
                                                                                className="w-full p-2 bg-white rounded-xl outline-none text-sm font-bold text-center text-slate-700 border border-blue-200"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Unit</p>
                                                                            <select
                                                                                value={edited.unit}
                                                                                onChange={e => updateEditedItem(item.id, 'unit', e.target.value)}
                                                                                className="w-full p-2 bg-white rounded-xl outline-none text-sm font-bold text-slate-700 border border-blue-200"
                                                                            >
                                                                                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={() => setExpandedEditId(null)} className="w-full py-2 bg-blue-600 text-white font-black text-[10px] rounded-xl">
                                                                        ✓ Selesai Edit
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Total sementara dari item DB saja */}
                                                {detail.items?.filter((i: any) => !deletedItemIds.has(i.id)).every((i: any) => Number(procPrices[i.id]) > 0) && manualItems.length === 0 && (
                                                    <div className="bg-violet-700 text-white rounded-2xl p-3.5 flex justify-between items-center">
                                                        <p className="text-[10px] font-black uppercase tracking-widest">Total Nilai GR</p>
                                                        <p className="font-black text-lg">
                                                            {formatRp(detail.items.filter((i: any) => !deletedItemIds.has(i.id)).reduce((s: number, i: any) => {
                                                                const qty = Number(editedItems[i.id]?.qty ?? i.qty);
                                                                return s + qty * Number(procPrices[i.id] || 0);
                                                            }, 0))}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* ── Upload Dokumen PO ── */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-black text-violet-700 uppercase">
                                                            Dokumen PO Sedayu (Gambar / PDF)
                                                            {selected.approval_status === 'PENDING' ? ' *' : ' (Opsional)'}
                                                        </p>
                                                        {selected.approval_status === 'PENDING_REVISION' && !procDoc && selected.procurement_doc_path && (
                                                            <span className="text-[9px] text-violet-500 font-bold">📎 Pakai dok lama</span>
                                                        )}
                                                    </div>
                                                    {procDocPreview ? (
                                                        <div className="space-y-2">
                                                            <div className="relative">
                                                                {isPdf ? (
                                                                    <div className="w-full py-12 border-2 border-violet-200 bg-white rounded-2xl flex flex-col items-center justify-center gap-1">
                                                                        <span className="text-4xl">📕</span>
                                                                        <span className="text-xs font-black text-slate-700">Dokumen Berkas PDF Terlampir</span>
                                                                    </div>
                                                                ) : (
                                                                    <img src={procDocPreview} className="w-full max-h-48 object-cover rounded-2xl border border-violet-200" alt="dok" />
                                                                )}
                                                                <button onClick={() => { setProcDoc(''); setProcDocPreview(''); setPoReviewResult(null); setPoReviewError(''); setIsPdf(false); }} className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg font-black">✕ Hapus</button>
                                                                <p className="text-[10px] text-emerald-600 font-bold text-center mt-1">✅ Dokumen berhasil dimuat</p>
                                                            </div>
                                                            <button onClick={handleReviewPo} disabled={reviewingPo} className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black py-3.5 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                                                                {reviewingPo ? (
                                                                    <><span className="animate-spin">⏳</span><span>AI membaca & mengekstrak berkas...</span></>
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
                                                            <p className="font-black text-violet-400 text-sm">Upload Gambar atau Berkas PDF PO Sedayu</p>
                                                            <p className="text-[10px] text-violet-300 mt-0.5">Sistem otomatis mendeteksi format gambar & PDF</p>
                                                        </button>
                                                    )}
                                                    <input ref={procDocRef} type="file" accept="image/*,application/pdf" className="hidden"
                                                        onChange={async e => {
                                                            const file = e.target.files?.[0]; if (!file) return;
                                                            setPoReviewResult(null); setPoReviewError('');
                                                            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                                                                setIsPdf(true);
                                                                const b64 = await readAsBase64(file);
                                                                setProcDoc(b64); setProcDocPreview(b64);
                                                            } else {
                                                                setIsPdf(false);
                                                                const b64 = await compressImage(file);
                                                                setProcDoc(b64); setProcDocPreview(b64);
                                                            }
                                                        }} />
                                                </div>

                                                {/* ── AI Review Result ── */}
                                                {poReviewResult && (
                                                    <div className="bg-white border-2 border-blue-200 rounded-2xl overflow-hidden">
                                                        <div className={`px-4 py-3 text-white ${poReviewResult.summary?.match_status === 'SESUAI' ? 'bg-emerald-600' : poReviewResult.summary?.match_status === 'TIDAK SESUAI' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex-1">
                                                                    <p className="font-black text-sm">
                                                                        {poReviewResult.summary?.match_status === 'SESUAI' ? '✅' : poReviewResult.summary?.match_status === 'TIDAK SESUAI' ? '❌' : '⚠️'} {poReviewResult.summary?.match_status}
                                                                    </p>
                                                                    <p className="text-[10px] opacity-80 mt-0.5">{poReviewResult.summary?.notes}</p>
                                                                    {poReviewResult.summary?.ppn_detected && (
                                                                        <p className="text-[9px] opacity-70 mt-0.5">PPN {(poReviewResult.summary.ppn_rate * 100).toFixed(0)}% terdeteksi</p>
                                                                    )}
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
                                                                            {aiItem.hpp_breakdown && (
                                                                                <p className="text-[8px] text-slate-400 italic">{aiItem.hpp_breakdown}</p>
                                                                            )}
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

                                                {/* ══ MANUAL ITEM ENTRY — Bug #3 ══ */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-black text-violet-700 uppercase">Item Tambahan Manual</p>
                                                            <p className="text-[9px] text-slate-400 mt-0.5">Item yang tidak ada di sistem / tidak ter-scan</p>
                                                        </div>
                                                        <button
                                                            onClick={addManualItem}
                                                            className="flex items-center gap-1 bg-violet-600 text-white font-black text-[10px] px-3 py-2 rounded-xl active:scale-95 shadow-sm"
                                                        >
                                                            ＋ Tambah
                                                        </button>
                                                    </div>

                                                    {manualItems.length === 0 ? (
                                                        <button
                                                            onClick={addManualItem}
                                                            className="w-full border-2 border-dashed border-violet-200 rounded-2xl py-5 text-center active:bg-violet-50"
                                                        >
                                                            <p className="text-lg mb-1">➕</p>
                                                            <p className="text-[10px] text-violet-400 font-bold">Tap untuk tambah item manual</p>
                                                            <p className="text-[9px] text-violet-300 mt-0.5">Item baru, item tidak ter-scan QR, dll.</p>
                                                        </button>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {manualItems.map((mItem) => {
                                                                const subtotal = Number(mItem.qty) * Number(mItem.unit_price);
                                                                const isComplete = mItem.item_name.trim() && Number(mItem.qty) > 0 && Number(mItem.unit_price) > 0;
                                                                return (
                                                                    <div key={mItem.id} className={`bg-white rounded-2xl p-3.5 border-2 space-y-2.5 ${isComplete ? 'border-blue-200' : 'border-red-200'}`}>
                                                                        {/* Nama Item */}
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Nama item *"
                                                                                value={mItem.item_name}
                                                                                onChange={e => updateManualItem(mItem.id, 'item_name', e.target.value)}
                                                                                className="flex-1 p-2.5 bg-slate-50 rounded-xl outline-none text-sm font-bold text-slate-700 border border-slate-200 placeholder:font-normal placeholder:text-slate-300"
                                                                            />
                                                                            <button
                                                                                onClick={() => removeManualItem(mItem.id)}
                                                                                className="flex-shrink-0 w-8 h-8 bg-red-50 text-red-400 rounded-xl font-black text-sm flex items-center justify-center active:scale-90"
                                                                            >✕</button>
                                                                        </div>

                                                                        {/* Qty + Unit + HPP */}
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Qty *</p>
                                                                                <input
                                                                                    type="number" min="0"
                                                                                    placeholder="0"
                                                                                    value={mItem.qty}
                                                                                    onChange={e => updateManualItem(mItem.id, 'qty', e.target.value)}
                                                                                    className="w-full p-2 bg-slate-50 rounded-xl outline-none text-sm font-bold text-slate-700 border border-slate-200 text-center"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Unit</p>
                                                                                <select
                                                                                    value={mItem.unit}
                                                                                    onChange={e => updateManualItem(mItem.id, 'unit', e.target.value)}
                                                                                    className="w-full p-2 bg-slate-50 rounded-xl outline-none text-sm font-bold text-slate-700 border border-slate-200"
                                                                                >
                                                                                    {UNIT_OPTIONS.map(u => (
                                                                                        <option key={u} value={u}>{u}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">HPP/unit *</p>
                                                                                <div className="relative">
                                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">Rp</span>
                                                                                    <input
                                                                                        type="number" min="0"
                                                                                        placeholder="0"
                                                                                        value={mItem.unit_price}
                                                                                        onChange={e => updateManualItem(mItem.id, 'unit_price', e.target.value)}
                                                                                        className="w-full p-2 pl-6 bg-slate-50 rounded-xl outline-none text-sm font-bold text-right text-violet-700 border border-slate-200"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Preview subtotal */}
                                                                        {isComplete && (
                                                                            <div className="bg-blue-50 rounded-xl px-3 py-2 flex justify-between items-center">
                                                                                <p className="text-[9px] text-blue-500 font-bold">
                                                                                    {mItem.qty} {mItem.unit} × {formatRp(Number(mItem.unit_price))}
                                                                                </p>
                                                                                <p className="text-[11px] font-black text-blue-700">
                                                                                    = {formatRp(subtotal)}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Total manual items */}
                                                            {manualItems.some(i => Number(i.qty) > 0 && Number(i.unit_price) > 0) && (
                                                                <div className="bg-blue-600 text-white rounded-2xl px-4 py-2.5 flex justify-between items-center">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest">Total Item Manual</p>
                                                                    <p className="font-black text-sm">
                                                                        {formatRp(manualItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0))}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Total GR keseluruhan (DB + manual) */}
                                                {detail.items?.every((i: any) => Number(procPrices[i.id]) > 0) && manualItems.length > 0 && (
                                                    <div className="bg-violet-700 text-white rounded-2xl p-3.5 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest">Total Nilai GR</p>
                                                            <p className="text-[9px] text-violet-300 mt-0.5">Termasuk {manualItems.filter(i => Number(i.qty) > 0 && Number(i.unit_price) > 0).length} item manual</p>
                                                        </div>
                                                        <p className="font-black text-lg">{formatRp(totalGRWithManual())}</p>
                                                    </div>
                                                )}

                                                {/* Catatan & Submit */}
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
                                                                {user.role !== 'STAFF' && (
                                                                    <p className="text-[10px] text-violet-500 font-bold">
                                                                        {Number(item.unit_price) > 0 ? `HPP: ${formatRp(Number(item.unit_price))} / ${item.unit}` : <span className="text-slate-300 italic">HPP belum diisi</span>}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <p className="font-black text-lg text-blue-600">{item.qty}</p>
                                                                <p className="text-[10px] text-slate-400">{item.unit}</p>
                                                                {user.role !== 'STAFF' && (
                                                                    <p className="text-[10px] font-bold text-slate-500">
                                                                        {Number(item.unit_price) > 0 ? `= ${formatRp(Number(item.qty) * Number(item.unit_price))}` : '—'}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {user.role !== 'STAFF' && (
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
                                            )}
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
