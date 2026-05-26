'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string }> = {
    PENDING: { label: 'Menunggu', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    APPROVED: { label: 'Disetujui', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    REJECTED: { label: 'Ditolak', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const COND_ICON: Record<string, string> = { GOOD: '✅', DAMAGED: '⚠️', LOST: '❌' };

function CheckInListContent() {
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

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role === 'STAFF') { router.push('/dashboard'); return; }
        setUser(parsed);
        fetchList('PENDING');
    }, []);

    const fetchList = async (status: string) => {
        setLoading(true);
        setSelected(null); setDetail(null);
        try {
            const res = await fetch(`${BASE_URL}/get_checkin_list.php?status=${status}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setList(r.data);
        } catch { }
        setLoading(false);
    };

    const openDetail = async (item: any) => {
        setSelected(item); setDetail(null); setLoadingDetail(true);
        setShowReject(false); setRejectNote('');
        try {
            const res = await fetch(`${BASE_URL}/get_checkin_detail.php?id=${item.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDetail(r);
        } catch { }
        setLoadingDetail(false);
    };

    const handleApprove = async () => {
        if (!selected) return;
        setApproving(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_checkin.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ checkin_id: selected.id, action: 'approve', approved_by: user?.name })
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
        if (!rejectNote.trim()) { alert("Catatan penolakan wajib diisi."); return; }
        setApproving(true);
        try {
            const res = await fetch(`${BASE_URL}/approve_checkin.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ checkin_id: selected.id, action: 'reject', approved_by: user?.name, rejection_note: rejectNote })
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
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">

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
                                        {STATUS_CONFIG[selected.approval_status]?.label}
                                    </div>
                                    <h2 className="font-black text-lg text-slate-900 mt-2">{selected.project_name || 'No Project'}</h2>
                                    <p className="text-[10px] font-mono text-slate-400">{selected.checkin_code}</p>
                                    <div className="flex gap-4 mt-2">
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase">PIC</p>
                                            <p className="text-xs font-bold text-slate-600">{selected.pic_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase">Tanggal</p>
                                            <p className="text-xs font-bold text-slate-600">{selected.checkin_date}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase">Disubmit oleh</p>
                                            <p className="text-xs font-bold text-slate-600">{selected.created_by}</p>
                                        </div>
                                    </div>
                                    {selected.rejection_note && (
                                        <div className="mt-2 bg-red-50 rounded-xl p-2.5">
                                            <p className="text-[10px] text-red-600 font-bold">Alasan ditolak: {selected.rejection_note}</p>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { setSelected(null); setDetail(null); }}
                                    className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {loadingDetail ? (
                                <p className="text-center animate-pulse text-slate-400 py-8">Memuat detail...</p>
                            ) : detail && (
                                <>
                                    {/* Item list */}
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Item ({detail.items?.length})</p>
                                        <div className="space-y-2">
                                            {detail.items?.map((item: any) => (
                                                <div key={item.id} className="bg-slate-50 rounded-2xl p-3.5">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm">{COND_ICON[item.condition] || '❓'}</span>
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                    {item.category}
                                                                </span>
                                                            </div>
                                                            <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                            <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                                📍 {item.location_name || '-'} · Qty: {item.qty} {item.unit}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500">
                                                                Kondisi: <span className="font-bold">{item.condition}</span>
                                                                {item.condition === 'LOST' && <span className="text-red-500 font-black ml-1">— Stok tidak kembali</span>}
                                                            </p>
                                                            {item.note && <p className="text-[10px] italic text-slate-400 mt-0.5">"{item.note}"</p>}
                                                        </div>
                                                        {item.photo_path && (
                                                            <img src={`https://sedayu.com/api/warehouse/${item.photo_path}`}
                                                                className="w-14 h-14 object-cover rounded-xl border border-slate-200 flex-shrink-0" alt="foto" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Signature */}
                                    {detail.header?.signature_pic_path && (
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">TTD PIC</p>
                                            <img src={`https://sedayu.com/api/warehouse/${detail.header.signature_pic_path}`}
                                                className="h-20 object-contain rounded-xl border border-slate-100 bg-white p-2" alt="ttd" />
                                        </div>
                                    )}

                                    {/* Approval actions — hanya PENDING & Manager/Admin */}
                                    {selected.approval_status === 'PENDING' && (user.role === 'MANAGER' || user.role === 'ADMIN') && (
                                        <div className="space-y-3 pt-2">
                                            {showReject ? (
                                                <div className="space-y-3">
                                                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                                                        placeholder="Alasan penolakan *"
                                                        rows={3}
                                                        className="w-full p-3.5 bg-red-50 rounded-xl outline-none font-medium text-slate-700 resize-none border border-red-200" />
                                                    <div className="flex gap-3">
                                                        <button onClick={() => setShowReject(false)}
                                                            className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                                        <button onClick={handleReject} disabled={approving}
                                                            className="flex-1 bg-red-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                                            {approving ? 'Menolak...' : '❌ Tolak'}
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
                                                        {approving ? 'Menyetujui...' : '✅ Approve'}
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-[9px] text-slate-400 text-center">
                                                Setelah Approve, stok barang yang kondisi GOOD & DAMAGED akan dikembalikan ke gudang.
                                            </p>
                                        </div>
                                    )}

                                    {selected.approval_status === 'APPROVED' && (
                                        <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                                            <p className="text-emerald-600 font-black text-sm">✅ Disetujui oleh {selected.approved_by}</p>
                                            <p className="text-[10px] text-emerald-500">{selected.approval_date}</p>
                                            <p className="text-[10px] text-emerald-500 mt-1">Stok sudah dikembalikan ke gudang.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-slate-900 text-white sticky top-0 z-20 shadow-lg">
                <div className="p-5 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Approval</p>
                        <h1 className="text-xl font-black">Check In Barang</h1>
                        <p className="text-[10px] text-slate-400">{user.name} · {user.role}</p>
                    </div>
                    {pendingCount > 0 && filterStatus === 'PENDING' && (
                        <div className="bg-orange-500 text-white font-black text-sm w-8 h-8 rounded-full flex items-center justify-center">
                            {pendingCount}
                        </div>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="px-4 pb-4 flex gap-2">
                    {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
                        <button key={s} onClick={() => { setFilterStatus(s); fetchList(s); }}
                            className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all
                                ${filterStatus === s ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400'}`}>
                            {s === 'PENDING' ? '⏳' : s === 'APPROVED' ? '✅' : '❌'} {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-3">
                {loading ? (
                    <div className="text-center py-20 animate-pulse text-slate-400 font-bold">Memuat...</div>
                ) : list.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">
                        {filterStatus === 'PENDING' ? 'Tidak ada check in yang menunggu approval.' : 'Tidak ada data.'}
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
                                <p className="font-bold text-sm text-slate-800 truncate">{item.project_name || 'No Project'}</p>
                                <p className="text-[10px] font-mono text-slate-400">{item.checkin_code}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    PIC: {item.pic_name} · {item.checkin_date}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {item.total_items} item · {item.total_qty} pcs
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-[10px] text-slate-400">
                                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                </p>
                                {item.approval_status === 'PENDING' && (
                                    <p className="text-[9px] font-black text-orange-500 mt-1">→ Tap untuk review</p>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* BOTTOM NAV */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 z-50 p-4 pb-6">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/dashboard')}
                        className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">
                        🏠 Dashboard
                    </button>
                    <button onClick={() => router.push('/transactions')}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95">
                        📋 Transaksi
                    </button>
                </div>
            </div>
        </main>
    );
}

export default function CheckInListPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <CheckInListContent />
        </Suspense>
    );
}
