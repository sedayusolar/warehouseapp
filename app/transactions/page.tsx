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
        if (!loggedInUser) { router.push('/login'); return; }
        setUser(JSON.parse(loggedInUser));
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/get_transactions.php', {
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') {
                setTransactions(result.data.sort((a: any, b: any) => b.id - a.id));
            }
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus & kembalikan stok?")) return;
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/delete_transaction.php?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') { alert("Berhasil!"); fetchTransactions(); }
        } catch (e) { alert("Gagal."); }
    };

    const filteredData = transactions.filter(item => {
        if (filter === 'ALL') return true;
        if (filter === 'DRAFT') return item.transaction_status === 'DRAFT';
        if (filter === 'SUBMITTED') return item.transaction_status === 'SUBMITTED' && item.manager_approval_status === 'PENDING';
        return true;
    });

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
            <div className="bg-slate-900 p-6 text-white sticky top-0 z-20 shadow-lg">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div><h1 className="text-xl font-bold">Riwayat</h1><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.name} ({user.role})</p></div>
                    <button onClick={() => router.push('/')} className="bg-slate-800 p-2 rounded-full">✕</button>
                </div>
                <div className="flex gap-2 mt-6 max-w-4xl mx-auto">
                    {['ALL', 'DRAFT', 'SUBMITTED'].map((tab) => (
                        <button key={tab} onClick={() => setFilter(tab)} className={`flex-1 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest ${filter === tab ? 'bg-white text-slate-900 shadow-md' : 'bg-slate-800 text-slate-500'}`}>
                            {tab === 'SUBMITTED' ? 'WAITING' : tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 max-w-4xl mx-auto space-y-4">
                {loading ? <div className="text-center py-20 animate-pulse font-black text-slate-400">SYNCING...</div> : filteredData.map((trx) => (
                    <div key={trx.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div><span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border">{trx.transaction_code}</span><h3 className="font-bold text-slate-800 text-lg mt-1">{trx.project_name}</h3></div>
                            {user.role === 'ADMIN' && <button onClick={() => handleDelete(trx.id)} className="text-red-400 p-2">🗑️</button>}
                        </div>
                        <div className="flex gap-2">
                            {trx.transaction_status === 'DRAFT' && user.role !== 'MANAGER' ? (
                                <button onClick={() => router.push(`/checkout?edit=${trx.id}`)} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase">Lanjutkan Draft</button>
                            ) : (
                                <button onClick={() => router.push(`/transactions/${trx.id}`)} className={`flex-1 text-[10px] font-black py-4 rounded-2xl uppercase ${trx.manager_approval_status === 'PENDING' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>Detail</button>
                            )}
                        </div>
                        <div className="mt-4 flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${trx.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Approval: {trx.manager_approval_status}</span></div>
                    </div>
                ))}
            </div>
        </main>
    );
}

export default function TransactionListPage() { return (<Suspense fallback={<div>Loading...</div>}><TransactionListContent /></Suspense>); }