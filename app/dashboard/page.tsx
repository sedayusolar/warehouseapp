'use client';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_dashboard.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') { setData(r); setLastRefresh(new Date()); }
        } catch { }
        setLoading(false);
    };

    if (!user) return null;

    const s = data?.stok_summary || {};
    const pendingCheckin = data?.pending_checkin_count || 0;
    const toolsBorrowed = data?.tools_borrowed || [];
    const stokHabis = data?.stok_habis || [];
    const pendingApproval = data?.pending_approval || [];
    const recentTrx = data?.recent_trx || [];
    const stokPerLokasi = data?.stok_per_lokasi || [];
    const trend = data?.trend || {};

    const approvalStatusColor = (status: string) => {
        if (status === 'APPROVED') return 'text-emerald-600 bg-emerald-50';
        if (status === 'REJECTED') return 'text-red-500 bg-red-50';
        return 'text-orange-500 bg-orange-50';
    };

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-24 pt-16">

            {/* HERO HEADER */}
            <div className="bg-white px-5 pt-5 pb-6 border-b border-slate-100">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Selamat datang,</p>
                        <h1 className="text-2xl font-black text-slate-800 mt-0.5">{user?.name}</h1>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {user?.role} · {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <button onClick={fetchDashboard} disabled={loading}
                        className={`w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition-all ${loading ? 'animate-spin' : ''}`}>
                        🔄
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                {loading && !data ? (
                    <div className="text-center py-20 text-slate-400 font-bold animate-pulse text-sm">Memuat dashboard...</div>
                ) : (
                    <>
                        {/* ── SUMMARY CARDS ── */}
                        <div className="grid grid-cols-2 gap-3">

                            {/* Total Item */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl mb-3">🗃️</div>
                                <p className="text-3xl font-black text-slate-800">{s.total_item || 0}</p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide mt-0.5">Total Item</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">{s.total_material || 0} material · {s.total_tools || 0} tools</p>
                            </div>

                            {/* Total Stok */}
                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl mb-3">📦</div>
                                <p className="text-3xl font-black text-slate-800">{s.total_stok || 0}</p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide mt-0.5">Total Stok</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">unit di semua lokasi</p>
                            </div>

                            {/* Stok Habis */}
                            <div className={`rounded-2xl p-4 border shadow-sm ${s.stok_habis > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${s.stok_habis > 0 ? 'bg-red-100' : 'bg-slate-50'}`}>⚠️</div>
                                <p className={`text-3xl font-black ${s.stok_habis > 0 ? 'text-red-600' : 'text-slate-800'}`}>{s.stok_habis || 0}</p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide mt-0.5">Stok Habis</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">item perlu restock</p>
                            </div>

                            {/* Pending Approve */}
                            <div className={`rounded-2xl p-4 border shadow-sm ${pendingApproval.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${pendingApproval.length > 0 ? 'bg-amber-100' : 'bg-slate-50'}`}>⏳</div>
                                <p className={`text-3xl font-black ${pendingApproval.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{pendingApproval.length}</p>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide mt-0.5">Pending Approve</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">menunggu manager</p>
                            </div>
                        </div>

                        {/* ── TREND ── */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checkout Bulan Ini</p>
                                <p className="text-3xl font-black text-slate-800 mt-1">{trend.bulan_ini || 0}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">vs bulan lalu: {trend.bulan_lalu || 0} transaksi</p>
                            </div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl
                                ${(trend.bulan_ini || 0) >= (trend.bulan_lalu || 0) ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                {(trend.bulan_ini || 0) >= (trend.bulan_lalu || 0) ? '📈' : '📉'}
                            </div>
                        </div>

                        {/* ── PENDING APPROVAL ── */}
                        {pendingApproval.length > 0 && (
                            <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b border-amber-100 flex justify-between items-center bg-amber-50">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">⏳ Menunggu Approval ({pendingApproval.length})</p>
                                    <button onClick={() => router.push('/transactions')}
                                        className="text-[10px] font-black text-amber-600">Lihat Semua</button>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {pendingApproval.map((trx: any) => (
                                        <button key={trx.id} onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 truncate">{trx.project_name}</p>
                                                    <p className="text-[10px] text-slate-400">{trx.transaction_code} · {trx.pic_name}</p>
                                                    <p className="text-[10px] text-slate-400">{trx.checkout_date}</p>
                                                </div>
                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    <span className="text-[9px] font-black bg-blue-600 text-white px-2.5 py-1 rounded-lg">Approve</span>
                                                    <span className="text-[9px] font-black bg-red-50 text-red-500 border border-red-200 px-2.5 py-1 rounded-lg text-center">Reject</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── TOOLS DIPINJAM ── */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🛠️ Tools Sedang Dipinjam ({toolsBorrowed.length})</p>
                                <button onClick={() => router.push('/transactions')}
                                    className="text-[10px] font-black text-blue-500">Lihat Semua</button>
                            </div>
                            {toolsBorrowed.length === 0 ? (
                                <p className="text-center text-slate-300 italic text-sm py-6">Semua tools ada di gudang ✓</p>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {toolsBorrowed.map((t: any, idx: number) => {
                                        const days = Math.floor((Date.now() - new Date(t.checkout_date).getTime()) / 86400000);
                                        return (
                                            <button key={idx} onClick={() => router.push(`/transactions/${t.header_id}`)}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-800">{t.item_name}</p>
                                                        <p className="text-[10px] text-slate-400">{t.project_name} · {t.pic_name}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="font-black text-slate-700 text-sm">{t.qty_borrowed} {t.unit}</p>
                                                        <p className={`text-[9px] font-bold ${days > 7 ? 'text-red-500' : days > 3 ? 'text-orange-500' : 'text-slate-400'}`}>
                                                            {days === 0 ? 'Hari ini' : `${days} hari`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── STOK PER LOKASI ── */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">📍 Stok per Lokasi</p>
                            </div>
                            <div className="p-4 space-y-3">
                                {stokPerLokasi.map((loc: any) => {
                                    const maxStok = Math.max(...stokPerLokasi.map((l: any) => Number(l.total_stok)));
                                    const pct = maxStok > 0 ? (Number(loc.total_stok) / maxStok) * 100 : 0;
                                    return (
                                        <div key={loc.location_name}>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <p className="text-sm font-bold text-slate-700">📍 {loc.location_name}</p>
                                                <div className="text-right">
                                                    <span className="font-black text-slate-800 text-sm">{loc.total_stok}</span>
                                                    <span className="text-[10px] text-slate-400 ml-1">unit</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── STOK HABIS ── */}
                        {stokHabis.length > 0 && (
                            <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">❌ Stok Habis ({stokHabis.length} item)</p>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {stokHabis.map((item: any) => (
                                        <button key={item.qr_id} onClick={() => router.push('/inventory')}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                            </div>
                                            <span className={`text-[9px] font-black px-2 py-1 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {item.category}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── TRANSAKSI TERBARU ── */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🕐 Transaksi Terbaru</p>
                                <button onClick={() => router.push('/transactions')}
                                    className="text-[10px] font-black text-blue-500">Lihat Semua</button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {recentTrx.map((trx: any) => (
                                    <button key={trx.id} onClick={() => router.push(`/transactions/${trx.id}`)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 truncate">{trx.project_name}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{trx.transaction_code}</p>
                                                <p className="text-[10px] text-slate-400">{trx.checkout_date}</p>
                                            </div>
                                            <span className={`text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0 ${approvalStatusColor(trx.manager_approval_status)}`}>
                                                {trx.manager_approval_status}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <Navbar />
        </main>
    );
}
