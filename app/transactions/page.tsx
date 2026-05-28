'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import FloatingMenu from '../components/FloatingMenu';
import { useRouter } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

function TransactionListContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    // QR Scanner
    const [showScanner, setShowScanner] = useState(false);
    const [scanError, setScanError] = useState('');

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) { router.push('/login'); return; }
        const parsed = JSON.parse(loggedInUser);
        setUser(parsed);
        if (parsed.role === 'MANAGER') setFilter('SUBMITTED');
        fetchTransactions();
    }, []);

    // QR Scanner lifecycle
    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            setScanError('');
            scanner = new Html5QrcodeScanner("trx-qr-reader", { fps: 10, qrbox: 220 }, false);
            scanner.render(
                (text: string) => {
                    // QR isinya: https://warehouse.sedayu.com/transactions/123
                    // Ekstrak ID dari URL
                    const match = text.match(/\/transactions\/(\d+)/);
                    if (match) {
                        setShowScanner(false);
                        router.push(`/transactions/${match[1]}`);
                    } else {
                        // Coba langsung pakai sebagai ID kalau isinya angka
                        const numMatch = text.match(/^(\d+)$/);
                        if (numMatch) {
                            setShowScanner(false);
                            router.push(`/transactions/${numMatch[1]}`);
                        } else {
                            setScanError(`QR tidak dikenali: ${text}`);
                        }
                    }
                },
                () => { /* error diabaikan */ }
            );
        }
        return () => { if (scanner) scanner.clear().catch(() => { }); };
    }, [showScanner]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transactions.php`, {
                headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (result.status === 'success') {
                setTransactions(result.data.sort((a: any, b: any) => b.id - a.id));
            }
        } catch (error) { console.error("Gagal ambil data:", error); }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus transaksi ini secara permanen?")) return;
        try {
            const res = await fetch(`${BASE_URL}/delete_transaction.php?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (result.status === 'success') { alert("Terhapus!"); fetchTransactions(); }
            else alert("Gagal: " + result.message);
        } catch { alert("Terjadi kesalahan sistem saat menghapus."); }
    };

    const handlePrintSJ = async (trx: any) => {
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${trx.id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const r = await res.json();
            if (r.status !== 'success') { alert("Gagal ambil detail transaksi."); return; }
            const { header, items } = r;
            const itemsData = items.map((item: any) => ({
                name: item.item_name, qr_id: item.qr_id,
                qty: item.qty, unit: item.unit || 'pcs',
                location_name: item.location_name || '—',
            }));
            const params = new URLSearchParams({
                code: header.transaction_code, trx_id: String(header.id),
                project: header.project_name || '—', pic: header.pic_name || '—',
                date: header.checkout_date,
                pengirim: header.staff_name || user?.name || '—',
                staff_sig: header.staff_signature_path || '',
                pic_sig: header.signature_pic_path || '',
                base_url: BASE_URL, items: JSON.stringify(itemsData),
            });
            window.open(`/print_surat_jalan.html?${params.toString()}`, '_blank');
        } catch { alert("Gagal koneksi."); }
    };

    const filteredData = transactions.filter(item => {
        if (user?.role === 'MANAGER' && item.transaction_status === 'DRAFT') return false;
        if (filter === 'ALL') return true;
        if (filter === 'DRAFT') return item.transaction_status === 'DRAFT';
        if (filter === 'SUBMITTED') {
            return (item.transaction_status === 'SUBMITTED' && item.manager_approval_status === 'PENDING')
                || item.transaction_status === 'CHECKIN_PENDING';
        }
        return true;
    });

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans text-slate-900 relative">

            {/* QR SCANNER MODAL */}
            {showScanner && (
                <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6"
                    onClick={() => setShowScanner(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan QR Surat Jalan</p>
                            <p className="font-black text-slate-900 text-base mt-0.5">Arahkan ke QR Code</p>
                            <p className="text-[10px] text-slate-400 mt-1">QR yang ada di pojok kanan atas surat jalan</p>
                        </div>

                        <div id="trx-qr-reader" className="overflow-hidden rounded-2xl border-2 border-blue-500 bg-black min-h-[220px]"></div>

                        {scanError && (
                            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                                <p className="text-[10px] font-bold text-red-600 text-center">{scanError}</p>
                                <button onClick={() => setScanError('')}
                                    className="w-full mt-2 text-[10px] font-black text-red-500 uppercase">
                                    Coba Lagi
                                </button>
                            </div>
                        )}

                        <button onClick={() => setShowScanner(false)}
                            className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">
                            Batal
                        </button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-20">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div>
                        <h1 className="text-xl font-bold">Warehouse Transactions</h1>
                        <p className="text-slate-400 text-[10px] tracking-widest uppercase font-black">
                            Logged as: {user.name} ({user.role})
                        </p>
                    </div>
                    {/* Tombol Scan QR */}
                    <button
                        onClick={() => setShowScanner(true)}
                        className="bg-blue-600 text-white font-black px-3 py-2.5 rounded-xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-1.5">
                        <span>📷</span>
                        <span>Scan QR</span>
                    </button>
                </div>

                <div className="flex gap-2 mt-4 max-w-4xl mx-auto">
                    {(user?.role === 'MANAGER'
                        ? ['ALL', 'SUBMITTED']
                        : ['ALL', 'DRAFT', 'SUBMITTED']
                    ).map((tab) => (
                        <button key={tab} onClick={() => setFilter(tab)}
                            className={`flex-1 py-2.5 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all
                                ${filter === tab ? 'bg-white text-slate-900 shadow-md scale-105' : 'bg-slate-800 text-slate-500'}`}>
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
                        const isReadyForCheckin = trx.transaction_status === 'SUBMITTED' && trx.manager_approval_status === 'APPROVED';
                        const isCheckinPending = trx.transaction_status === 'CHECKIN_PENDING';
                        const isCheckinApproved = trx.transaction_status === 'CHECKIN_APPROVED';
                        const isDelivered = trx.transaction_status === 'DELIVERED';
                        const canPrintSJ = trx.manager_approval_status === 'APPROVED';

                        return (
                            <div key={trx.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border">
                                            {trx.transaction_code}
                                        </span>
                                        <h3 className="font-bold text-slate-800 text-lg mt-1">{trx.project_name}</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canPrintSJ && (
                                            <button onClick={() => handlePrintSJ(trx)}
                                                className="bg-emerald-50 text-emerald-700 font-black text-[9px] px-2 py-1.5 rounded-lg border border-emerald-200 active:scale-95 transition-all"
                                                title="Print Surat Jalan">
                                                🖨️ SJ
                                            </button>
                                        )}
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => handleDelete(trx.id)} className="text-red-400 p-2">🗑️</button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs mb-5 pt-4 border-t">
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 font-black uppercase text-[9px] mb-1">PIC</span>
                                        <span className="text-slate-700 font-bold">{trx.pic_name || '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 font-black uppercase text-[9px] mb-1">Tanggal</span>
                                        <span className="text-slate-700 font-bold">{trx.checkout_date}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {trx.transaction_status === 'DRAFT' && user.role !== 'MANAGER' ? (
                                        <button onClick={() => router.push(`/checkout?edit=${trx.id}`)}
                                            className="flex-1 bg-blue-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg shadow-blue-100">
                                            🚀 Lanjutkan Draft
                                        </button>
                                    ) : isCheckinPending ? (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className="flex-1 bg-amber-500 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg">
                                            {user.role === 'MANAGER' ? '✅ Review Check In' : '⏳ Menunggu Approval Check In'}
                                        </button>
                                    ) : isReadyForCheckin && user.role !== 'MANAGER' ? (
                                        <>
                                            <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                                className="flex-1 bg-slate-100 text-slate-600 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest">
                                                👁️ Detail
                                            </button>
                                            <button onClick={() => router.push(`/checkin?checkout_id=${trx.id}`)}
                                                className="flex-1 bg-emerald-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-md">
                                                📦 Check In
                                            </button>
                                        </>
                                    ) : isCheckinApproved ? (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className="flex-1 bg-slate-100 text-slate-500 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest">
                                            ✅ Selesai — Lihat Detail
                                        </button>
                                    ) : (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className={`flex-1 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest
                                                ${trx.manager_approval_status === 'PENDING'
                                                    ? 'bg-slate-900 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-500'}`}>
                                            {trx.manager_approval_status === 'PENDING' && user.role === 'MANAGER'
                                                ? '👁️ Cek Detail & Approve'
                                                : '👁️ Lihat Detail'}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCheckinApproved ? 'bg-blue-500' :
                                            isDelivered ? 'bg-blue-400' :
                                                trx.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' :
                                                    trx.manager_approval_status === 'REJECTED' ? 'bg-red-500' :
                                                        'bg-orange-500 animate-pulse'}`} />
                                    <span>Status: {
                                        isCheckinApproved ? '✅ SELESAI' :
                                            isCheckinPending ? '⏳ CHECKIN MENUNGGU' :
                                                isDelivered ? '📦 DELIVERED' :
                                                    trx.transaction_status === 'SUBMITTED' ? trx.manager_approval_status :
                                                        trx.transaction_status
                                    }</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            <FloatingMenu />
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
