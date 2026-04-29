'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionList() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // Filter: ALL, DRAFT, SUBMITTED

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
            console.error("Gagal mengambil data transaksi", error);
        }
        setLoading(false);
    };

    // Logic untuk memfilter data berdasarkan tab yang dipilih
    const filteredData = transactions.filter(item => {
        if (filter === 'ALL') return true;
        return item.transaction_status === filter;
    });

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">
            {/* Header Sticky */}
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-10">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-xl font-bold">Riwayat Transaksi</h1>
                        <p className="text-slate-400 text-xs tracking-widest uppercase">Warehouse System</p>
                    </div>
                    <button
                        onClick={() => router.push('/checkout')}
                        className="bg-blue-600 p-3 rounded-2xl shadow-md active:scale-90 transition-all text-sm font-bold"
                    >
                        + Baru
                    </button>
                </div>

                {/* Tab Filter Sederhana */}
                <div className="flex gap-2 mt-6 max-w-4xl mx-auto">
                    {['ALL', 'DRAFT', 'SUBMITTED'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-tighter ${filter === tab
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {tab === 'SUBMITTED' ? 'DIREVIEW' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Kartu Transaksi */}
            <div className="p-4 max-w-4xl mx-auto space-y-4 mt-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium">Sinkronisasi Data...</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                        <p className="text-sm">Tidak ada transaksi dalam kategori ini.</p>
                    </div>
                ) : (
                    filteredData.map((trx) => (
                        <div
                            key={trx.id}
                            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-blue-200 active:scale-[0.98] transition-all cursor-pointer group"
                            onClick={() => router.push(`/transactions/${trx.id}`)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-lg inline-block">
                                        {trx.transaction_code}
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                                        {trx.project_name}
                                    </h3>
                                </div>

                                {/* Badge Status Utama */}
                                <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${trx.transaction_status === 'DRAFT'
                                        ? 'bg-amber-100 text-amber-600'
                                        : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                    {trx.transaction_status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">PIC Penerima</span>
                                    <span className="text-slate-700 font-semibold">{trx.pic_name || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">Tanggal Keluar</span>
                                    <span className="text-slate-700 font-semibold">
                                        {new Date(trx.checkout_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            {/* Status Approval Section */}
                            {trx.transaction_status === 'SUBMITTED' && (
                                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${trx.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' :
                                                trx.manager_approval_status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-500 animate-pulse'
                                            }`}></div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                            Approval: {trx.manager_approval_status}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-blue-500 font-black flex items-center gap-1">
                                        DETAIL <span>→</span>
                                    </div>
                                </div>
                            )}

                            {/* Review Comment Preview */}
                            {trx.manager_comment && (
                                <div className="mt-3 bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-500 italic flex gap-2">
                                    <span>💬</span> "{trx.manager_comment}"
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 flex justify-around items-center shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 group">
                    <span className="text-slate-400 group-hover:text-slate-600 transition-colors">🏠</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Home</span>
                </button>
                <button onClick={() => router.push('/transactions')} className="flex flex-col items-center gap-1 group">
                    <span className="text-blue-600">📋</span>
                    <span className="text-[9px] font-bold text-blue-600 uppercase">Transaksi</span>
                </button>
                <button onClick={() => router.push('/inventory')} className="flex flex-col items-center gap-1 group">
                    <span className="text-slate-400 group-hover:text-slate-600 transition-colors">📦</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Stok</span>
                </button>
            </nav>
        </main>
    );
}