'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionList() {
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
                setTransactions(result.data);
            }
        } catch (error) {
            console.error("Gagal ambil data", error);
        }
        setLoading(false);
    };

    const filteredData = transactions.filter(item => {
        if (filter === 'ALL') return true;
        return item.transaction_status === filter;
    });

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-20">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-xl font-bold">Riwayat Transaksi</h1>
                        <p className="text-slate-400 text-[10px] tracking-widest uppercase">Warehouse Dashboard</p>
                    </div>
                    <button onClick={() => router.push('/checkout')} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold">+ Baru</button>
                </div>

                <div className="flex gap-2 mt-6 max-w-4xl mx-auto">
                    {['ALL', 'DRAFT', 'SUBMITTED'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`flex-1 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest ${filter === tab ? 'bg-white text-slate-900 shadow-md' : 'bg-slate-800 text-slate-500'
                                }`}
                        >
                            {tab === 'SUBMITTED' ? 'MENUNGGU APPROVAL' : tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-4xl mx-auto space-y-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-bold text-xs uppercase tracking-widest">Sinkronisasi Data...</div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">Belum ada data transaksi.</div>
                ) : (
                    filteredData.map((trx) => (
                        <div key={trx.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-lg">{trx.transaction_code}</span>
                                    <h3 className="font-bold text-slate-800 text-lg mt-1">{trx.project_name}</h3>
                                </div>
                                <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${trx.transaction_status === 'DRAFT' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {trx.transaction_status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs mb-5">
                                <div className="flex flex-col">
                                    <span className="text-slate-400 font-bold uppercase text-[9px] mb-1">PIC</span>
                                    <span className="text-slate-700 font-semibold">{trx.pic_name || '—'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-slate-400 font-bold uppercase text-[9px] mb-1">Tgl Keluar</span>
                                    <span className="text-slate-700 font-semibold">
                                        {new Date(trx.checkout_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-50">
                                {trx.transaction_status === 'DRAFT' ? (
                                    <button onClick={() => router.push(`/checkout?edit=${trx.id}`)} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-3 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-100">🚀 Lanjutkan Draft</button>
                                ) : (
                                    <button onClick={() => router.push(`/transactions/${trx.id}`)} className="flex-1 bg-slate-900 text-white text-[10px] font-black py-3 rounded-2xl uppercase tracking-widest">👁️ Cek Detail & Approve</button>
                                )}
                            </div>

                            {/* Status Approval Mini */}
                            <div className="mt-3 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${trx.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' :
                                        trx.manager_approval_status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-500 animate-pulse'
                                    }`}></div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    Status: {trx.manager_approval_status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 flex justify-around items-center z-30">
                <button onClick={() => router.push('/')} className="text-slate-400 text-[10px] font-black uppercase">Home</button>
                <button className="text-blue-600 text-[10px] font-black uppercase border-b-2 border-blue-600 pb-1">Transaksi</button>
                <button onClick={() => router.push('/inventory')} className="text-slate-400 text-[10px] font-black uppercase">Stok</button>
            </nav>
        </main>
    );
}