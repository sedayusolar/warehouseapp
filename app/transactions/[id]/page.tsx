'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function DetailTransaction() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        setFetchLoading(true);
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${id}`);
            const result = await res.json();
            if (result.status === 'success') {
                setData(result);
                setComment(result.header.manager_comment || '');
            }
        } catch (e) {
            console.error("Gagal ambil detail", e);
        }
        setFetchLoading(false);
    };

    const handleApproval = async (status: 'APPROVED' | 'REJECTED') => {
        setLoading(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/update_approval.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: params.id, // ID transaksi dari URL
                    status: status,
                    comment: managerComment // Inputan komentar lo
                })
            });

            const result = await res.json();
            if (result.status === 'success') {
                alert("Status Berhasil Diperbarui!");
                window.location.reload(); // Refresh biar keliatan perubahannya
            } else {
                alert("Gagal: " + result.message);
            }
        } catch (error) {
            // ALERT INI YANG MUNCUL DI FOTO LO
            alert("Terjadi kesalahan koneksi. Pastikan file update_approval.php sudah di-upload.");
        }
        setLoading(false);
    };

    if (fetchLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Menarik Data...</p>
            </div>
        </div>
    );

    if (!data) return <div className="p-10 text-center">Data tidak ditemukan.</div>;

    const { header, items } = data;

    return (
        <main className="min-h-screen bg-slate-50 pb-12 font-sans">
            {/* Header Area */}
            <div className="bg-slate-900 p-6 text-white shadow-xl">
                <button
                    onClick={() => router.push('/transactions')}
                    className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                    <span>←</span> KEMBALI KE LIST
                </button>
                <div className="flex justify-between items-end">
                    <div>
                        <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded font-mono font-bold mb-2 inline-block">
                            {header.transaction_code}
                        </span>
                        <h1 className="text-2xl font-bold leading-tight">{header.project_name}</h1>
                        <p className="text-slate-400 text-xs mt-1 uppercase tracking-tighter">
                            Checkout: {new Date(header.checkout_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${header.transaction_status === 'DRAFT' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                        }`}>
                        {header.transaction_status}
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-6 -mt-4">
                {/* Info PIC & TTD Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Informasi Penerima</h3>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Nama PIC / Teknisi</p>
                        <p className="text-lg font-bold text-slate-800">{header.pic_name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase mb-2">Tanda Tangan</p>
                        {header.signature_pic_path ? (
                            <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 inline-block">
                                <img
                                    src={`https://sedayu.com/api/warehouse/${header.signature_pic_path}`}
                                    className="h-40 w-auto mix-blend-multiply"
                                    alt="Signature"
                                />
                            </div>
                        ) : (
                            <div className="h-32 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200">
                                Tanda tangan belum tersedia (Status Draft)
                            </div>
                        )}
                    </div>
                </div>

                {/* List Barang Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Daftar Material / Tools</h3>
                    <div className="divide-y divide-slate-50">
                        {items.map((item: any, idx: number) => (
                            <div key={idx} className="py-4 flex justify-between items-center group">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{item.item_name}</p>
                                    <div className="flex gap-2">
                                        <span className="text-[9px] font-mono text-slate-400">{item.qr_id}</span>
                                        <span className={`text-[9px] font-bold px-1.5 rounded ${item.item_type === 'TOOLS' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {item.item_type}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-blue-50 px-3 py-2 rounded-xl">
                                    <p className="text-sm font-black text-blue-700">{item.qty} <span className="text-[10px]">PCS</span></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Manager Review Section (Hanya untuk SUBMITTED) */}
                {header.transaction_status === 'SUBMITTED' && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-blue-50 space-y-5">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Manager Review</h3>
                            {header.manager_approval_date && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                    Log: {new Date(header.manager_approval_date).toLocaleString('id-ID', {
                                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            )}
                        </div>

                        {header.manager_approval_status === 'PENDING' ? (
                            <>
                                <textarea
                                    placeholder="Berikan catatan atau instruksi di sini..."
                                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm outline-none focus:border-blue-500 transition-all shadow-inner h-24"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleApproval('REJECTED')}
                                        disabled={loading}
                                        className="py-4 bg-red-50 text-red-500 font-black rounded-2xl active:scale-95 transition-all text-[10px] tracking-widest hover:bg-red-100"
                                    >
                                        REJECT
                                    </button>
                                    <button
                                        onClick={() => handleApproval('APPROVED')}
                                        disabled={loading}
                                        className="py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 active:scale-95 transition-all text-[10px] tracking-widest hover:bg-emerald-700"
                                    >
                                        {loading ? 'PROSES...' : 'APPROVE'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className={`p-5 rounded-2xl border-l-4 shadow-sm ${header.manager_approval_status === 'APPROVED' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-red-50 border-red-500 text-red-800'
                                }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${header.manager_approval_status === 'APPROVED' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Status Keputusan</p>
                                </div>
                                <p className="text-xl font-black">{header.manager_approval_status}</p>
                                {header.manager_comment && (
                                    <div className="mt-3 pt-3 border-t border-black/5">
                                        <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Catatan Manager:</p>
                                        <p className="text-sm italic font-medium">"{header.manager_comment}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}