'use client';
import { useState, useEffect } from 'react';
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
        <main className="min-h-screen bg-slate-900 font-sans pb-24">
            {/* HEADER */}
            <div className="bg-slate-900 p-5 pt-8">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">SEDAYU SOLAR</p>
                        <h1 className="text-2xl font-black text-white mt-0.5">Dashboard</h1>
                        <p className="text-[10px] text-slate-500 mt-1">
                            {user?.name} · {lastRefresh.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <button onClick={fetchDashboard} disabled={loading}
                        className={`bg-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-black active:scale-95 transition-all ${loading ? 'animate-pulse' : ''}`}>
                        {loading ? '...' : '🔄'}
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4 max-w-2xl mx-auto">

                {loading && !data ? (
                    <div className="text-center py-20 text-slate-500 font-bold animate-pulse text-sm">Memuat dashboard...</div>
                ) : (
                    <>
                        {/* ===== SUMMARY CARDS ===== */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Total Item', val: s.total_item || 0, icon: '🗃️', sub: `${s.total_material || 0} material · ${s.total_tools || 0} tools`, color: 'from-blue-600 to-blue-700' },
                                { label: 'Total Stok', val: s.total_stok || 0, icon: '📦', sub: 'unit di semua lokasi', color: 'from-emerald-600 to-emerald-700' },
                                { label: 'Stok Habis', val: s.stok_habis || 0, icon: '⚠️', sub: 'item perlu restock', color: (s.stok_habis > 0) ? 'from-red-600 to-red-700' : 'from-slate-600 to-slate-700' },
                                { label: 'Pending Approve', val: pendingApproval.length, icon: '⏳', sub: 'menunggu manager', color: pendingApproval.length > 0 ? 'from-amber-500 to-amber-600' : 'from-slate-600 to-slate-700' },
                            ].map(card => (
                                <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-4 text-white`}>
                                    <p className="text-2xl">{card.icon}</p>
                                    <p className="text-3xl font-black mt-2">{card.val}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-0.5">{card.label}</p>
                                    <p className="text-[9px] opacity-60 mt-0.5">{card.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Trend bulan ini */}
                        <div className="bg-slate-800 rounded-2xl p-4 flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checkout Bulan Ini</p>
                                <p className="text-3xl font-black text-white mt-1">{trend.bulan_ini || 0}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">vs bulan lalu: {trend.bulan_lalu || 0} transaksi</p>
                            </div>
                            <div className="text-right">
                                {(trend.bulan_ini || 0) >= (trend.bulan_lalu || 0) ? (
                                    <p className="text-emerald-400 font-black text-lg">▲</p>
                                ) : (
                                    <p className="text-red-400 font-black text-lg">▼</p>
                                )}
                                <p className="text-[10px] text-slate-400">
                                    {trend.bulan_lalu > 0
                                        ? `${Math.round(((trend.bulan_ini - trend.bulan_lalu) / trend.bulan_lalu) * 100)}%`
                                        : '—'}
                                </p>
                            </div>
                        </div>

                        {/* ===== PENDING APPROVAL ===== */}
                        {pendingApproval.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-amber-200 flex justify-between items-center">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">⏳ Menunggu Approval ({pendingApproval.length})</p>
                                    {user.role === 'MANAGER' && (
                                        <button onClick={() => router.push('/transactions')}
                                            className="text-[10px] font-black text-amber-700 underline">Lihat Semua</button>
                                    )}
                                </div>
                                <div className="divide-y divide-amber-100">
                                    {pendingApproval.map((trx: any) => (
                                        <button key={trx.id} onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className="w-full text-left px-4 py-3 hover:bg-amber-100 transition-colors active:bg-amber-200">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{trx.project_name}</p>
                                                    <p className="text-[10px] text-slate-500">{trx.transaction_code} · {trx.pic_name}</p>
                                                    <p className="text-[10px] text-slate-400">{trx.checkout_date}</p>
                                                </div>
                                                <p className="text-[10px] font-black text-amber-600">→ Approve</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ===== TOOLS DIPINJAM ===== */}
                        <div className="bg-white rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🛠️ Tools Sedang Dipinjam ({toolsBorrowed.length})</p>
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
                                                        <p className="text-[10px] text-slate-400">{t.checkout_date}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <span className="font-black text-slate-700">{t.qty_borrowed} {t.unit}</span>
                                                        <p className={`text-[9px] font-bold mt-0.5 ${days > 7 ? 'text-red-500' : days > 3 ? 'text-orange-500' : 'text-slate-400'}`}>
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

                        {/* ===== STOK PER LOKASI ===== */}
                        <div className="bg-white rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📍 Stok per Lokasi</p>
                            </div>
                            {stokPerLokasi.length === 0 ? (
                                <p className="text-center text-slate-300 italic text-sm py-6">Belum ada data lokasi.</p>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {stokPerLokasi.map((loc: any) => {
                                        const maxStok = Math.max(...stokPerLokasi.map((l: any) => Number(l.total_stok)));
                                        const pct = maxStok > 0 ? (Number(loc.total_stok) / maxStok) * 100 : 0;
                                        return (
                                            <div key={loc.location_name}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-sm font-bold text-slate-700">📍 {loc.location_name}</p>
                                                    <div className="text-right">
                                                        <span className="font-black text-slate-800">{loc.total_stok}</span>
                                                        <span className="text-[10px] text-slate-400 ml-1">unit</span>
                                                        <span className="text-[9px] text-slate-400 ml-2">({loc.total_item} item)</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ===== STOK HABIS ===== */}
                        {stokHabis.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-red-200">
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">❌ Stok Habis ({stokHabis.length} item)</p>
                                </div>
                                <div className="divide-y divide-red-100">
                                    {stokHabis.map((item: any) => (
                                        <button key={item.qr_id} onClick={() => router.push('/inventory')}
                                            className="w-full text-left px-4 py-3 hover:bg-red-100 transition-colors flex justify-between items-center">
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

                        {/* ===== TRANSAKSI TERBARU ===== */}
                        <div className="bg-white rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🕐 Transaksi Terbaru</p>
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

                        {/* ===== QUICK ACTIONS ===== */}
                        {user.role !== 'MANAGER' && (
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Checkout', icon: '📦', path: '/checkout', color: 'bg-blue-600' },
                                    { label: 'Check In', icon: '✅', path: '/checkin', color: 'bg-emerald-600' },
                                    { label: 'Inventory', icon: '🗃️', path: '/inventory', color: 'bg-slate-700' },
                                    { label: 'Adjustment', icon: '🔄', path: '/stock-adjustment', color: 'bg-slate-600' },
                                    { label: 'Cost Report', icon: '💰', path: '/cost-report', color: 'bg-violet-600' },
                                ].map(action => (
                                    <button key={action.path} onClick={() => router.push(action.path)}
                                        className={`${action.color} text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg`}>
                                        <p className="text-xl mb-1">{action.icon}</p>
                                        <p className="text-[10px]">{action.label}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                        {user.role === 'MANAGER' && (
                            <button onClick={() => router.push('/transactions')}
                                className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg">
                                ⏳ Lihat Transaksi Pending Approval
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* BOTTOM NAV */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 z-50 p-4 pb-6">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button onClick={fetchDashboard}
                        className="flex-1 bg-slate-800 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">
                        🔄 Refresh
                    </button>
                    <button onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
                        className="bg-slate-800 text-red-400 font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">
                        Logout
                    </button>
                </div>
            </div>
        </main>
    );
}
