'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

// --- UPDATE 1: Tambah kondisi "USED" (Terpasang) ---
const CONDITION_CONFIG = {
    USED: { label: 'Terpasang', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '⚡' },
    GOOD: { label: 'Sisa Baik', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '✅' },
    DAMAGED: { label: 'Rusak', color: 'bg-orange-100 text-orange-600 border-orange-300', icon: '⚠️' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600 border-red-300', icon: '❌' },
};

function CheckInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const checkoutId = searchParams.get('id') || searchParams.get('checkout_id');

    const [user, setUser] = useState<any>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [checkoutInfo, setCheckoutInfo] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [picName, setPicName] = useState('');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) {
            router.push('/login');
            return;
        }
        setUser(JSON.parse(loggedInUser));

        if (checkoutId && checkoutId !== 'null' && checkoutId !== 'undefined') {
            fetchCheckoutData(checkoutId);
        } else {
            setLoading(false);
        }
        fetchLocations();
    }, [checkoutId]);

    const fetchLocations = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
            const result = await res.json();
            if (result.status === 'success') setLocations(result.data);
        } catch (error) { console.error("Gagal load lokasi:", error); }
    };

    const fetchCheckoutData = async (id: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${id}`, { headers: { 'X-API-KEY': API_KEY } });
            const result = await res.json();
            if (result.status === 'success') {
                setCheckoutInfo(result.header);

                // --- UPDATE 2: Smart Default berdasarkan item_type ---
                const mappedItems = result.items.map((item: any) => {
                    const isMaterial = item.item_type === 'MATERIAL';
                    return {
                        qr_id: item.qr_id,
                        item_name: item.item_name,
                        item_type: item.item_type,
                        checkout_qty: Number(item.qty),
                        qty: Number(item.qty),
                        location_id: '',
                        conditions: {
                            USED: isMaterial ? Number(item.qty) : 0,  // Material otomatis Terpasang
                            GOOD: isMaterial ? 0 : Number(item.qty),  // Tools otomatis Baik
                            DAMAGED: 0,
                            LOST: 0
                        }
                    };
                });
                setCart(mappedItems);
            } else {
                alert(result.message);
            }
        } catch (error) { alert("Gagal ambil data transaksi awal."); }
        setLoading(false);
    };

    const handleConditionChange = (idx: number, type: 'USED' | 'GOOD' | 'DAMAGED' | 'LOST', val: number) => {
        const newCart = [...cart];
        newCart[idx].conditions[type] = Number(val);

        const total = Number(newCart[idx].conditions.USED) +
            Number(newCart[idx].conditions.GOOD) +
            Number(newCart[idx].conditions.DAMAGED) +
            Number(newCart[idx].conditions.LOST);

        newCart[idx].qty = total;
        setCart(newCart);
    };

    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSubmit = async () => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (!picName || !signatureBase64 || signatureBase64.length < 2000) {
            alert("Nama PIC dan Tanda Tangan wajib diisi!"); return;
        }

        // --- UPDATE 3: Validasi Ketat (Total dilaporkan harus SAMA PERSIS dengan yg dibawa) ---
        for (const item of cart) {
            const total = item.conditions.USED + item.conditions.GOOD + item.conditions.DAMAGED + item.conditions.LOST;
            if (total !== item.checkout_qty) {
                alert(`❌ PERHITUNGAN TIDAK PAS!\n\nBarang: ${item.item_name}\nDibawa: ${item.checkout_qty}\nDilaporkan: ${total}\n\nPastikan total Terpasang + Baik + Rusak + Hilang sama dengan jumlah barang yang dibawa.`);
                return;
            }
        }

        setSubmitting(true);

        const formattedItems: any[] = [];
        cart.forEach(item => {
            if (item.conditions.USED > 0) formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.USED, condition: 'USED' });
            if (item.conditions.GOOD > 0) formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.GOOD, condition: 'GOOD' });
            if (item.conditions.DAMAGED > 0) formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.DAMAGED, condition: 'DAMAGED' });
            if (item.conditions.LOST > 0) formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.LOST, condition: 'LOST' });
        });

        const payload = {
            checkout_header_id: checkoutId,
            pic_name: picName,
            signature_base64: signatureBase64,
            checkin_date: new Date().toISOString().split('T')[0],
            items: formattedItems
        };

        try {
            const res = await fetch(`${BASE_URL}/checkin.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.status === 'success') {
                setSuccess('Check In berhasil disubmit! Menunggu Approval Manager untuk update stok gudang.');
                setTimeout(() => router.push('/transactions'), 2500);
            } else {
                alert("Gagal: " + result.message); setSubmitting(false);
            }
        } catch (error) { alert("Kesalahan koneksi ke server."); setSubmitting(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading Data...</div>;
    if (!checkoutId || checkoutId === 'null' || checkoutId === 'undefined' || !checkoutInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="text-4xl">⚠️</div><p className="font-bold text-red-500 text-sm uppercase">ID Transaksi Tidak Valid</p>
                <button onClick={() => router.push('/transactions')} className="bg-slate-900 text-white font-black text-[10px] uppercase px-6 py-3 rounded-xl shadow-md">Kembali</button>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans">
            <div className="bg-slate-900 p-6 text-white shadow-lg sticky top-0 z-20 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">Check In Barang</h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{checkoutInfo.project_name}</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 p-2 rounded-full text-xs font-black">✕</button>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-6">
                {success ? (
                    <div className="bg-emerald-50 border-2 border-emerald-500 p-8 rounded-3xl text-center space-y-4">
                        <div className="text-5xl">✅</div><p className="font-black text-emerald-700 uppercase tracking-widest leading-relaxed">{success}</p>
                    </div>
                ) : (
                    <>
                        {/* LIST BARANG */}
                        <div className="space-y-6">
                            {cart.map((item, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4 relative overflow-hidden">
                                    {/* Indikator Warna Type Barang */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-2 ${item.item_type === 'MATERIAL' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>

                                    <div className="border-b pb-3 pl-3 flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{item.item_name}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.item_type}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Dibawa</p>
                                            <p className="font-black text-slate-800 text-xl">{item.checkout_qty}</p>
                                        </div>
                                    </div>

                                    {/* --- UPDATE 4: Grid diubah jadi 4 kolom buat nampung Terpasang --- */}
                                    <div className="grid grid-cols-4 gap-2 pl-3">
                                        {(['USED', 'GOOD', 'DAMAGED', 'LOST'] as const).map((cond) => (
                                            <div key={cond} className={`p-2 rounded-xl border flex flex-col items-center gap-2 ${CONDITION_CONFIG[cond].color}`}>
                                                <p className="text-[9px] font-black uppercase text-center flex items-center justify-center gap-1 w-full truncate">
                                                    <span>{CONDITION_CONFIG[cond].icon}</span>
                                                </p>
                                                <p className="text-[8px] font-black uppercase tracking-tighter opacity-80">{CONDITION_CONFIG[cond].label}</p>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.conditions[cond]}
                                                    onChange={(e: any) => handleConditionChange(idx, cond, e.target.value)}
                                                    onFocus={(e) => e.target.select()} // Biar gampang hapus angka 0
                                                    className="w-full text-center bg-white border border-black/10 rounded-lg p-1 font-bold text-sm text-black outline-none focus:ring-2"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-2 pl-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Simpan Sisa Barang Di:</p>
                                        <select
                                            value={item.location_id}
                                            onChange={(e) => {
                                                const newCart = [...cart];
                                                newCart[idx].location_id = e.target.value;
                                                setCart(newCart);
                                            }}
                                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">-- Abaikan jika tidak ada sisa --</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* FORM PIC & TTD */}
                        <div className="bg-white p-6 rounded-3xl shadow-xl space-y-5 border-2 border-blue-50">
                            <input type="text" placeholder="Nama PIC Pengembali" value={picName} onChange={(e: any) => setPicName(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 text-sm" />
                            <div className="space-y-2">
                                <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanda Tangan Teknisi</label><button onClick={clearCanvas} className="text-[10px] text-blue-500 font-bold">RESET</button></div>
                                <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 touch-none shadow-inner" />
                            </div>
                            <button onClick={handleSubmit} disabled={submitting} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                {submitting ? 'Menyimpan...' : '✅ SUBMIT CHECK IN'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* BOTTOM NAV */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 z-50 p-4 pb-6">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')} className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">🏠 Menu Utama</button>
                    <button onClick={() => router.push('/transactions')} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95">📋 Transaksi</button>
                </div>
            </div>
        </main>
    );
}

export default function CheckInPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <CheckInContent />
        </Suspense>
    );
}