'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const CONDITION_CONFIG = {
    GOOD: { label: 'Baik', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '✅' },
    DAMAGED: { label: 'Rusak', color: 'bg-orange-100 text-orange-600 border-orange-300', icon: '⚠️' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600 border-red-300', icon: '❌' },
};

function CheckInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // --- REVISI UTAMA: Bisa baca ?id= ATAU ?checkout_id= biar gak salah kirim ---
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

        // --- REVISI: Proteksi ketat agar tidak menembak API jika id berisi string "null" atau "undefined" ---
        if (checkoutId && checkoutId !== 'null' && checkoutId !== 'undefined') {
            fetchCheckoutData(checkoutId);
        } else {
            setLoading(false);
        }
        fetchLocations();
    }, [checkoutId]);

    const fetchLocations = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_locations.php`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') setLocations(result.data);
        } catch (error) {
            console.error("Gagal load lokasi:", error);
        }
    };

    const fetchCheckoutData = async (id: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') {
                setCheckoutInfo(result.header);

                const mappedItems = result.items.map((item: any) => ({
                    qr_id: item.qr_id,
                    item_name: item.item_name,
                    item_type: item.item_type,
                    checkout_qty: Number(item.qty),
                    qty: Number(item.qty),
                    location_id: '',
                    conditions: { GOOD: Number(item.qty), DAMAGED: 0, LOST: 0 }
                }));
                setCart(mappedItems);
            } else {
                alert(result.message);
            }
        } catch (error) {
            alert("Gagal ambil data transaksi awal.");
        }
        setLoading(false);
    };

    const handleConditionChange = (idx: number, type: 'GOOD' | 'DAMAGED' | 'LOST', val: number) => {
        const newCart = [...cart];
        newCart[idx].conditions[type] = val;

        const total = Number(newCart[idx].conditions.GOOD) +
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
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSubmit = async () => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (!picName || !signatureBase64 || signatureBase64.length < 2000) {
            alert("Nama PIC dan Tanda Tangan wajib diisi!");
            return;
        }

        for (const item of cart) {
            if (item.qty > item.checkout_qty) {
                alert(`Total barang kembali (${item.item_name}) tidak boleh lebih dari yang dibawa (${item.checkout_qty})!`);
                return;
            }
        }

        setSubmitting(true);

        const formattedItems: any[] = [];
        cart.forEach(item => {
            if (item.conditions.GOOD > 0) {
                formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.GOOD, condition: 'GOOD' });
            }
            if (item.conditions.DAMAGED > 0) {
                formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.DAMAGED, condition: 'DAMAGED' });
            }
            if (item.conditions.LOST > 0) {
                formattedItems.push({ qr_id: item.qr_id, location_id: item.location_id, qty: item.conditions.LOST, condition: 'LOST' });
            }
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
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': API_KEY
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.status === 'success') {
                setSuccess('Check In berhasil disubmit! Menunggu Approval Manager untuk update stok gudang.');
                setTimeout(() => router.push('/transactions'), 2500);
            } else {
                alert("Gagal: " + result.message);
                setSubmitting(false);
            }
        } catch (error) {
            alert("Kesalahan koneksi ke server.");
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading Data...</div>;

    // --- REVISI: Tampilan jika ID beneran kosong atau tidak valid ---
    if (!checkoutId || checkoutId === 'null' || checkoutId === 'undefined' || !checkoutInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="text-4xl">⚠️</div>
                <p className="font-bold text-red-500 text-sm uppercase tracking-wider">ID Transaksi Tidak Valid atau Kosong</p>
                <p className="text-xs text-slate-400 max-w-xs">Pastikan Anda membuka halaman ini melalui tombol Check In resmi di Riwayat Transaksi.</p>
                <button onClick={() => router.push('/transactions')} className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl shadow-md">Kembali ke Transaksi</button>
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
                        <div className="text-5xl">✅</div>
                        <p className="font-black text-emerald-700 uppercase tracking-widest leading-relaxed">{success}</p>
                    </div>
                ) : (
                    <>
                        {/* LIST BARANG */}
                        <div className="space-y-6">
                            {cart.map((item, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                                    <div className="border-b pb-3 flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{item.item_name}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Dibawa</p>
                                            <p className="font-black text-blue-600 text-xl">{item.checkout_qty}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {(['GOOD', 'DAMAGED', 'LOST'] as const).map((cond) => (
                                            <div key={cond} className={`p-2 rounded-xl border flex flex-col items-center gap-2 ${CONDITION_CONFIG[cond].color}`}>
                                                <p className="text-[9px] font-black uppercase text-center flex items-center gap-1">
                                                    <span>{CONDITION_CONFIG[cond].icon}</span> {CONDITION_CONFIG[cond].label}
                                                </p>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.conditions[cond]}
                                                    onChange={(e: any) => handleConditionChange(idx, cond, e.target.value)}
                                                    className="w-full text-center bg-white border border-black/10 rounded-lg p-1 font-bold text-sm text-black"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Simpan di Lokasi:</p>
                                        <select
                                            value={item.location_id}
                                            onChange={(e) => {
                                                const newCart = [...cart];
                                                newCart[idx].location_id = e.target.value;
                                                setCart(newCart);
                                            }}
                                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="">-- Pilih Rak / Lokasi --</option>
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
                            <input
                                type="text"
                                placeholder="Nama PIC Pengembali"
                                value={picName}
                                onChange={(e: any) => setPicName(e.target.value)}
                                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 text-sm"
                            />

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanda Tangan Teknisi</label>
                                    <button onClick={clearCanvas} className="text-[10px] text-blue-500 font-bold">RESET</button>
                                </div>
                                <canvas
                                    ref={canvasRef}
                                    width={500} height={300}
                                    onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                    onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                    className="w-full h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 touch-none shadow-inner"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                {submitting ? 'Menyimpan...' : '✅ SUBMIT CHECK IN'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* BOTTOM NAV */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 z-50 p-4 pb-6">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')}
                        className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">
                        🏠 Menu Utama
                    </button>
                    <button onClick={() => router.push('/transactions')}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95">
                        📋 Transaksi
                    </button>
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