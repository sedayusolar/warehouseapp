'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string }> = {
    PENDING: { label: 'Menunggu', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    APPROVED: { label: 'Disetujui', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    REJECTED: { label: 'Ditolak', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const formatRp = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

function PurchaseListContent() {
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

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        fetchList('PENDING');
    }, []);

    const fetchList = async (status: string) => {
        setLoading(true);
        setSelected(null); setDetail(null);
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
        try {
            const res = await fetch(`${BASE_URL}/get_purchase_list.php?id=${item.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDetail(r);
        } catch { }
        setLoadingDetail(false);
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
            if (r.status === 'success') {
                alert(r.message);
                setSelected(null); setDetail(null);
                fetchList(filterStatus);
            } else alert("Gagal: " + r.message);
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
            if (r.status === 'success') {
                alert(r.message);
                setSelected(null); setDetail(null); setShowReject(false);
                fetchList(filterStatus);
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setApproving(false);
    };

    if (!user) return null;

    const pendingCount = list.filter(i => i.approval_status === 'PENDING').length;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-5 right-5 text-white bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-black text-lg">✕</button>
                    <img src={lightboxUrl} alt="SJ" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* DETAIL DRAWER */}
            {selected && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => { setSelected(null); setDetail(null); }}>
                    <div className="flex-1 overflow-y-auto mt-12" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-32 space-y-5">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${STATUS_CONFIG[selected.approval_status]?.bg} ${STATUS_CONFIG[selected.approval_status]?.color}`}>
                                        {selected.approval_status === 'PENDING' ? '⏳' : selected.approval_status === 'APPROVED' ? '✅' : '❌'}
                                        {' '}{STATUS_CONFIG[selected.approval_status]?.label}
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
                                </div>
                                <button onClick={() => { setSelected(null); setDetail(null); }}
                                    className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {/* Foto SJ */}
                            {selected.sj_photo_path && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">📄 Surat Jalan / PO</p>
                                    <button onClick={() => setLightboxUrl(`${BASE_URL}/${selected.sj_photo_path}`)} className="w-full">
                                        <img src={`${BASE_URL}/${selected.sj_photo_path}`}
                                            className="w-full max-h-48 object-cover rounded-2xl border border-slate-100" alt="SJ" />
                                        <p className="text-[9px] text-slate-400 text-center mt-1">👆 Tap untuk perbesar</p>
                                    </button>
                                </div>
                            )}

                            {loadingDetail ? (
                                <p className="text-center animate-pulse text-slate-400 py-8">Memuat detail...</p>
                            ) : detail && (
                                <>
                                    {/* Item list */}
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Item ({detail.items?.length})</p>
                                        <div className="space-y-2">
                                            {detail.items?.map((item: any) => (
                                                <div key={item.id} className={`rounded-2xl p-3.5 border-l-4 bg-slate-50 ${item.category === 'Tools' ? 'border-l-amber-400' : 'border-l-emerald-400'}`}>
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {item.is_new_item === 1 && (
                                                                    <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">BARU</span>
                                                                )}
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                    {item.category}
                                                                </span>
                                                            </div>
                                                            <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                            <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                            <p className="text-[10px] text-slate-500">📍 {item.location_name}</p>
                                                            <p className="text-[10px] text-violet-500 font-bold">
                                                                {Number(item.unit_price) > 0
                                                                    ? `HPP: ${formatRp(Number(item.unit_price))} / ${item.unit}`
                                                                    : <span className="text-slate-300 italic">HPP belum diisi</span>}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="font-black text-lg text-blue-600">{item.qty}</p>
                                                            <p className="text-[10px] text-slate-400">{item.unit}</p>
                                                            <p className="text-[10px] font-bold text-slate-500">
                                                                {Number(item.unit_price) > 0
                                                                    ? `= ${formatRp(Number(item.qty) * Number(item.unit_price))}`
                                                                    : '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total value */}
                                        <div className="mt-3 bg-slate-900 text-white rounded-2xl p-3.5 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest">Total Nilai PO</p>
                                                {detail.items?.some((i: any) => Number(i.unit_price) === 0) && (
                                                    <p className="text-[9px] text-slate-400">* Ada item tanpa HPP</p>
                                                )}
                                            </div>
                                            <p className="font-black text-lg">
                                                {detail.items?.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0) > 0
                                                    ? formatRp(detail.items.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0))
                                                    : <span className="text-slate-400 text-sm italic">Harga belum diisi</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* APPROVAL ACTIONS — Manager/Admin, PO masih PENDING */}
                                    {selected.approval_status === 'PENDING' && (user.role === 'MANAGER' || user.role === 'ADMIN') && (
                                        <div className="space-y-3 pt-2">
                                            {showReject ? (
                                                <div className="space-y-3">
                                                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                                                        placeholder="Alasan penolakan *" rows={3}
                                                        className="w-full p-3.5 bg-red-50 rounded-xl outline-none font-medium text-slate-700 resize-none border border-red-200" />
                                                    <div className="flex gap-3">
                                                        <button onClick={() => setShowReject(false)}
                                                            className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                                        <button onClick={handleReject} disabled={approving}
                                                            className="flex-1 bg-red-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                                            {approving ? 'Menolak...' : '❌ Tolak PO'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3">
                                                    <button onClick={() => setShowReject(true)}
                                                        className="flex-1 bg-red-50 text-red-600 font-black py-3.5 rounded-2xl text-xs uppercase border border-red-200">
                                                        ❌ Tolak
                                                    </button>
                                                    <button onClick={handleApprove} disabled={approving}
                                                        className="flex-1 bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                                        {approving ? 'Menyetujui...' : '✅ Approve & Masukkan Stok'}
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-[9px] text-slate-400 text-center">
                                                Setelah Approve, stok semua item akan masuk ke inventory sesuai lokasi.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}


            <div className="p-4 max-w-2xl mx-auto space-y-3">
                {loading ? (
                    <div className="text-center py-20 animate-pulse text-slate-400 font-bold">Memuat...</div>
                ) : list.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">
                        {filterStatus === 'PENDING' ? 'Tidak ada PO yang menunggu approval.' : 'Tidak ada data.'}
                    </div>
                ) : list.map((item: any) => (
                    <button key={item.id} onClick={() => openDetail(item)}
                        className={`w-full bg-white rounded-2xl shadow-sm border p-4 text-left hover:shadow-md transition-all active:scale-[0.99]
                            ${item.approval_status === 'PENDING' ? 'border-orange-200' : item.approval_status === 'APPROVED' ? 'border-emerald-200' : 'border-red-200'}`}>
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${STATUS_CONFIG[item.approval_status]?.bg} ${STATUS_CONFIG[item.approval_status]?.color}`}>
                                        {item.approval_status === 'PENDING' ? '⏳' : item.approval_status === 'APPROVED' ? '✅' : '❌'}
                                        {' '}{STATUS_CONFIG[item.approval_status]?.label}
                                    </span>
                                </div>
                                <p className="font-bold text-sm text-slate-800">{item.po_code}</p>
                                {item.po_number && <p className="text-[10px] font-mono text-slate-400">No. PO: {item.po_number}</p>}
                                {item.supplier && <p className="text-[10px] text-slate-400">🏪 {item.supplier}</p>}
                                <p className="text-[10px] text-slate-400">{item.po_date} · {item.created_by}</p>
                                <p className="text-[10px] text-slate-400">{item.total_items} item · {item.total_qty} pcs</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-slate-400">
                                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                </p>
                                {item.approval_status === 'PENDING' && (
                                    <p className="text-[9px] font-black text-orange-500 mt-1">→ Review</p>
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

export default function PurchaseListPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <PurchaseListContent />
        </Suspense>
    );
}
