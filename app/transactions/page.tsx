'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function TransactionListContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const API_KEY = "SedayuSolar_TopSecret_2026";

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) {
            router.push('/login');
            return;
        }
        const parsed = JSON.parse(loggedInUser);
        setUser(parsed);
        if (parsed.role === 'MANAGER') setFilter('SUBMITTED');
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/get_transactions.php', {
                headers: {
                    'X-API-KEY': API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            const result = await res.json();
            if (result.status === 'success') {
                const sorted = result.data.sort((a: any, b: any) => b.id - a.id);
                setTransactions(sorted);
            }
        } catch (error) {
            console.error("Gagal ambil data:", error);
        }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus transaksi ini secara permanen?")) return;
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/delete_transaction.php?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert("Terhapus!");
                fetchTransactions();
            } else {
                alert("Gagal: " + result.message);
            }
        } catch (e) {
            alert("Terjadi kesalahan sistem saat menghapus.");
        }
    };

    const filteredData = transactions.filter(item => {
        // Manager tidak pernah lihat DRAFT
        if (user?.role === 'MANAGER' && item.transaction_status === 'DRAFT') return false;

        if (filter === 'ALL') return true;
        if (filter === 'DRAFT') return item.transaction_status === 'DRAFT';
        if (filter === 'SUBMITTED') {
            return (item.transaction_status === 'SUBMITTED' && item.manager_approval_status === 'PENDING') || item.transaction_status === 'CHECKIN_PENDING';
        }
        return true;
    });

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans text-slate-900 relative">
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-20">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-xl font-bold">Warehouse Transactions</h1>
                        <p className="text-slate-400 text-[10px] tracking-widest uppercase font-black">Logged as: {user.name} ({user.role})</p>
                    </div>
                </div>

                <div className="flex gap-2 mt-6 max-w-4xl mx-auto">
                    {(user?.role === 'MANAGER'
                        ? ['ALL', 'SUBMITTED']
                        : ['ALL', 'DRAFT', 'SUBMITTED']
                    ).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`flex-1 py-2.5 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all ${filter === tab ? 'bg-white text-slate-900 shadow-md scale-105' : 'bg-slate-800 text-slate-500'}`}
                        >
                            {tab === 'SUBMITTED' ? 'MENUNGGU APPROVAL' : tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-4xl mx-auto space-y-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Sinkronisasi Data...</div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">Tidak ada transaksi ditemukan.</div>
                ) : (
                    filteredData.map((trx) => {
                        // LOGIC PINTAR BUAT MUNCULIN TOMBOL CHECK-IN
                        const isReadyForCheckin = trx.transaction_status === 'SUBMITTED' && trx.manager_approval_status === 'APPROVED';
                        const isCheckinPending = trx.transaction_status === 'CHECKIN_PENDING';
                        const isCheckinApproved = trx.transaction_status === 'CHECKIN_APPROVED';

                        return (
                            <div key={trx.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border">{trx.transaction_code}</span>
                                        <h3 className="font-bold text-slate-800 text-lg mt-1">{trx.project_name}</h3>
                                    </div>
                                    {user.role === 'ADMIN' && (
                                        <button onClick={() => handleDelete(trx.id)} className="text-red-400 p-2">🗑️</button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs mb-5 pt-4 border-t">
                                    <div className="flex flex-col"><span className="text-slate-400 font-black uppercase text-[9px] mb-1">PIC</span><span className="text-slate-700 font-bold">{trx.pic_name || '—'}</span></div>
                                    <div className="flex flex-col"><span className="text-slate-400 font-black uppercase text-[9px] mb-1">Tanggal</span><span className="text-slate-700 font-bold">{trx.checkout_date}</span></div>
                                </div>

                                <div className="flex gap-2">
                                    {trx.transaction_status === 'DRAFT' && user.role !== 'MANAGER' ? (
                                        <button onClick={() => router.push(`/checkout?edit=${trx.id}`)} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-100">🚀 Lanjutkan Draft</button>
                                    ) : isReadyForCheckin && user.role !== 'MANAGER' ? (
                                        <>
                                            <button onClick={() => router.push(`/transactions/${trx.id}`)} className="flex-1 bg-slate-100 text-slate-600 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest">👁️ Detail</button>
                                            <button onClick={() => router.push(`/checkin?checkout_id=${trx.id}`)} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-md">📦 Check In</button>
                                        </>
                                    ) : (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)} className={`flex-1 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest ${trx.transaction_status === 'CHECKIN_PENDING' || trx.manager_approval_status === 'PENDING' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                                            {trx.transaction_status === 'CHECKIN_PENDING' ? '⏳ Cek Approval Check-In' : trx.manager_approval_status === 'PENDING' && user.role === 'MANAGER' ? '👁️ Cek Detail & Approve' : '👁️ Lihat Detail'}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${trx.transaction_status === 'CHECKIN_APPROVED' ? 'bg-blue-500' : trx.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' : trx.manager_approval_status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-500 animate-pulse'}`}></div>
                                        <span>Status: {isCheckinApproved ? '✅ SELESAI' : isCheckinPending ? '⏳ CHECKIN MENUNGGU' : trx.transaction_status === 'SUBMITTED' ? trx.manager_approval_status : trx.transaction_status}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- BOTTOM MENU BAR --- */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-50 p-4 pb-6">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')} className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">🏠 Menu Utama</button>
                    {user.role !== 'MANAGER' && (
                        <button onClick={() => router.push('/checkout')} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all">+ Baru</button>
                    )}
                </div>
            </div>
        </main>
    );
}

export default function TransactionListPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <TransactionListContent />
        </Suspense>
    );
}