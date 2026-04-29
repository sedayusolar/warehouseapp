'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function TransactionListContent() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/get_transactions.php');
            const result = await res.json();
            if (result.status === 'success') {
                // Sort terbaru di atas
                const sorted = result.data.sort((a: any, b: any) => b.id - a.id);
                setTransactions(sorted);
            }
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    // --- LOGIC FILTER (POIN 2) ---
    const filteredData = transactions.filter(item => {
        if (filter === 'ALL') return true;
        if (filter === 'DRAFT') return item.transaction_status === 'DRAFT';
        if (filter === 'SUBMITTED') {
            // Hanya tampilkan yang sudah di-submit tapi belum diapa-apain manager
            return item.transaction_status === 'SUBMITTED' && item.manager_approval_status === 'PENDING';
        }
        return true;
    });

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-20">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-xl font-bold">Riwayat Transaksi</h1>
                        <p className="text-slate-400 text-[10px] tracking-widest uppercase font-black">Sedayu Solar</p>
                    </div>
                    <button onClick={() => router.push('/checkout')} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter shadow-lg shadow-blue-900">+ Baru</button>
                </div>

                <div className="flex gap-2 mt-6 max-w-4xl mx-auto">
                    {['ALL', 'DRAFT', 'SUBMITTED'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`flex-1 py-2.5 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all ${filter === tab ? 'bg-white text-slate-900 shadow-md scale-105' : 'bg-slate-800 text-slate-500'
                                }`}
                        >
                            {tab === 'SUBMITTED' ? 'MENUNGGU APPROVAL' : tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-4xl mx-auto space-y-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-bold text-[10px] uppercase">Sinkronisasi...</div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">Tidak ada transaksi ditemukan.</div>
                ) : (
                    filteredData.map((trx) => (
                        <div key={trx.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{trx.transaction_code}</span>
                                    <h3 className="font-bold text-slate-800 text-lg mt-1 leading-tight">{trx.project_name}</h3>
                                </div>
                                <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${trx.transaction_status === 'DRAFT' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {trx.transaction_status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs mb-5 border-t border-slate-50 pt-4">
                                <div className="flex flex-col">
                                    <span className="text-slate-400 font-black uppercase text-[9px] mb-1">PIC / Teknisi</span>
                                    <span className="text-slate-700 font-bold">{trx.pic_name || '—'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-slate-400 font-black uppercase text-[9px] mb-1">Tgl Keluar</span>
                                    <span className="text-slate-700 font-bold">{trx.checkout_date}</span>
                                </div>
                            </div>

                            {/* --- TOMBOL DINAMIS (POIN 1) --- */}
                            <div className="flex gap-2">
                                {trx.transaction_status === 'DRAFT' ? (
                                    <button onClick={() => router.push(`/checkout?edit=${trx.id}`)} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-50">🚀 Lanjutkan Draft</button>
                                ) : (
                                    <button
                                        onClick={() => router.push(`/transactions/${trx.id}`)}
                                        className={`flex-1 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest transition-all ${trx.manager_approval_status === 'PENDING'
                                                ? 'bg-slate-900 text-white shadow-lg'
                                                : 'bg-slate-100 text-slate-500'
                                            }`}
                                    >
                                        {trx.manager_approval_status === 'PENDING' ? '👁️ Cek Detail & Approve' : '👁️ Lihat Detail'}
                                    </button>
                                )}
                            </div>

                            <div className="mt-4 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${trx.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' :
                                        trx.manager_approval_status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-500 animate-pulse'
                                    }`}></div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Approval: {trx.manager_approval_status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </main>
    );
}

export default function TransactionListPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TransactionListContent />
        </Suspense>
    );
}