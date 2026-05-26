'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import FloatingMenu from '../components/FloatingMenu';
import { useRouter, useSearchParams } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

// Tools: kondisi fisik alat
const CONDITION_TOOLS: Record<string, { label: string, color: string, icon: string }> = {
    GOOD: { label: 'Baik', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '✅' },
    DAMAGED: { label: 'Rusak', color: 'bg-orange-100 text-orange-600 border-orange-300', icon: '⚠️' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600 border-red-300', icon: '❌' },
};

// Material: status pemakaian
const CONDITION_MATERIAL: Record<string, { label: string, color: string, icon: string }> = {
    GOOD: { label: 'Ada Sisa', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '📦' },
    DAMAGED: { label: 'Terpakai', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '✅' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600 border-red-300', icon: '❌' },
};

const getConditionConfig = (type: string) =>
    type === 'MATERIAL' ? CONDITION_MATERIAL : CONDITION_TOOLS;

function CheckInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const checkoutId = searchParams.get('checkout_id') || searchParams.get('id');

    const [user, setUser] = useState<any>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [checkoutInfo, setCheckoutInfo] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [picName, setPicName] = useState('');
    const [note, setNote] = useState('');
    const [checkinDate, setCheckinDate] = useState(new Date().toISOString().split('T')[0]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const compressImage = (file: File, maxWidth = 1200, quality = 0.75): Promise<string> =>
        new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchLocations();
        if (checkoutId) loadFromCheckout(Number(checkoutId));
        else setLoading(false);
    }, []);

    const fetchLocations = async () => {
        const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setLocations(r.data);
    };

    const loadFromCheckout = async (id: number) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setCheckoutInfo(r.header);
                setPicName(r.header.pic_name || '');
                setCart(r.items.map((item: any) => ({
                    qr_id: item.qr_id,
                    name: item.item_name,
                    type: item.item_type,
                    unit: item.unit || '',
                    qty: item.qty,
                    location_id: item.location_id || '',
                    location_name: item.location_name || '',
                    condition: item.item_type === 'MATERIAL' ? 'DAMAGED' : 'GOOD',
                    photo_base64: '',
                    note: '',
                })));
            }
        } catch { }
        setLoading(false);
    };

    const updateCart = (qr_id: string, field: string, value: any) => {
        setCart(prev => prev.map(i => i.qr_id === qr_id ? { ...i, [field]: value } : i));
    };

    // Signature
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };
    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke(); if (e.touches) e.preventDefault();
    };
    const clearSignature = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300);

    const handleSubmit = async () => {
        if (!checkoutId) { alert("Tidak ada transaksi yang dipilih."); return; }
        for (const item of cart) {
            if (!item.location_id) { alert(`Pilih lokasi pengembalian untuk: ${item.name}`); return; }
        }
        if (!picName) { alert("Nama PIC wajib diisi."); return; }
        const sig = canvasRef.current?.toDataURL('image/png');
        if (!sig || sig.length < 2000) { alert("Tanda tangan wajib diisi."); return; }

        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/checkin.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    checkout_header_id: Number(checkoutId),
                    checkin_type: 'TOOLS_RETURN',
                    project_name: checkoutInfo?.project_name || '',
                    pic_name: picName,
                    checkin_date: checkinDate,
                    note,
                    created_by: user?.name || 'unknown',
                    signature_base64: sig,
                    items: cart.map(i => ({
                        qr_id: i.qr_id,
                        location_id: i.location_id,
                        qty: Number(i.qty),
                        condition: i.condition,
                        photo_base64: i.photo_base64,
                        note: i.note,
                    }))
                })
            });
            const r = await res.json();
            if (r.status === 'success') setSuccess(r.checkin_code);
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi server."); }
        setSubmitting(false);
    };

    if (!user) return null;

    // No checkout_id — redirect user to transactions
    if (!checkoutId && !loading) {
        return (
            <main className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center p-8 gap-6">
                <div className="text-center space-y-3">
                    <p className="text-5xl">📋</p>
                    <h1 className="font-black text-xl text-slate-800">Check In via Transaksi</h1>
                    <p className="text-sm text-slate-500">Pilih transaksi yang sudah APPROVED dari halaman Riwayat Transaksi, lalu klik tombol ✅ Check In.</p>
                </div>
                <button onClick={() => router.push('/transactions')}
                    className="w-full max-w-xs bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                    📋 Ke Riwayat Transaksi
                </button>
                <button onClick={() => router.push('/dashboard')}
                    className="text-slate-400 text-sm font-bold">← Dashboard</button>
                <FloatingMenu />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans">
            {/* HEADER */}
            <div className="bg-slate-900 text-white sticky top-0 z-20 shadow-lg p-5 flex justify-between items-center">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Check In Barang</p>
                    <h1 className="text-xl font-black">{checkoutInfo?.project_name || 'Loading...'}</h1>
                    <p className="text-[10px] text-slate-400">{checkoutInfo?.transaction_code} · {checkoutInfo?.checkout_date}</p>
                </div>
                <button onClick={() => router.back()} className="bg-slate-800 px-3 py-2 rounded-xl text-xs font-black">← Kembali</button>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* SUCCESS */}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
                        <p className="text-5xl">✅</p>
                        <p className="font-black text-emerald-700 text-xl">Check In Berhasil!</p>
                        <p className="font-mono text-emerald-600 font-bold text-sm">{success}</p>
                        <p className="text-xs text-emerald-600">Menunggu approval Manager. Stok akan kembali setelah disetujui.</p>
                        <button onClick={() => router.push('/transactions')}
                            className="w-full bg-emerald-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-md mt-2">
                            📋 Lihat Riwayat Transaksi
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-bold">Memuat data transaksi...</div>
                )}

                {!loading && !success && checkoutInfo && (
                    <>
                        {/* Info transaksi */}
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-1">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Info Checkout</p>
                            <p className="font-bold text-slate-800">{checkoutInfo.project_name}</p>
                            <div className="flex gap-4 mt-1">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">PIC</p>
                                    <p className="text-xs font-bold text-slate-600">{checkoutInfo.pic_name}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">Tanggal</p>
                                    <p className="text-xs font-bold text-slate-600">{checkoutInfo.checkout_date}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">Item</p>
                                    <p className="text-xs font-bold text-slate-600">{cart.length} barang</p>
                                </div>
                            </div>
                        </div>

                        {/* ITEM LIST */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kondisi Barang Dikembalikan</p>
                            {cart.map(item => (
                                <div key={item.qr_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
                                    {/* Item header */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                            {item.location_name && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">📍 Diambil dari: {item.location_name}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-800">{item.qty} <span className="text-[10px] text-slate-400">{item.unit}</span></p>
                                        </div>
                                    </div>

                                    {/* Kondisi */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Kondisi Saat Kembali *</label>
                                        <div className="flex gap-2 mt-1.5">
                                            {Object.entries(getConditionConfig(item.type)).map(([key, cfg]) => (
                                                <button key={key} onClick={() => updateCart(item.qr_id, 'condition', key)}
                                                    className={`flex-1 py-2.5 rounded-xl font-black text-[10px] border-2 transition-all active:scale-95
                                                        ${item.condition === key ? cfg.color : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                    {cfg.icon}<br />{cfg.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Lokasi kembalikan */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Kembalikan ke Lokasi *</label>
                                        <select value={item.location_id} onChange={e => updateCart(item.qr_id, 'location_id', e.target.value)}
                                            className="w-full mt-1.5 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none">
                                            <option value="">-- Pilih Lokasi --</option>
                                            {locations.map((l: any) => (
                                                <option key={l.id} value={l.id}>{l.location_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Foto kondisi */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Foto Kondisi (opsional)</label>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <label className="px-3 py-2 bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl cursor-pointer active:scale-95">
                                                📷 Upload
                                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                                    onChange={async e => {
                                                        const file = e.target.files?.[0]; if (!file) return;
                                                        const b64 = await compressImage(file);
                                                        updateCart(item.qr_id, 'photo_base64', b64);
                                                    }} />
                                            </label>
                                            {item.photo_base64 && (
                                                <div className="relative">
                                                    <img src={item.photo_base64} className="w-14 h-14 object-cover rounded-xl border border-slate-200" alt="preview" />
                                                    <button onClick={() => updateCart(item.qr_id, 'photo_base64', '')}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-black">✕</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Catatan per item */}
                                    <input type="text" placeholder="Catatan kondisi (opsional)..."
                                        value={item.note} onChange={e => updateCart(item.qr_id, 'note', e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 rounded-xl outline-none text-sm font-medium text-slate-700" />
                                </div>
                            ))}
                        </div>

                        {/* FORM SUBMIT */}
                        <div className="bg-white rounded-3xl shadow-xl p-5 space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Check In</p>
                            <input type="date" value={checkinDate} onChange={e => setCheckinDate(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            <input type="text" placeholder="Nama PIC yang mengembalikan *" value={picName}
                                onChange={e => setPicName(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            <input type="text" placeholder="Catatan tambahan (opsional)" value={note}
                                onChange={e => setNote(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />

                            {/* Signature */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Tanda Tangan PIC *</label>
                                    <button onClick={clearSignature} className="text-[10px] text-blue-500 font-bold uppercase">Reset</button>
                                </div>
                                <canvas ref={canvasRef} width={500} height={200}
                                    onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                    onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                    className="w-full h-40 bg-slate-50 rounded-2xl border-2 border-slate-200 touch-none" />
                                <p className="text-[9px] text-slate-400 text-center mt-1">Tanda tangan di kotak di atas</p>
                            </div>

                            <button onClick={handleSubmit} disabled={submitting}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                {submitting ? 'Menyimpan...' : '✅ SUBMIT CHECK IN'}
                            </button>
                        </div>
                    </>
                )}
            </div>
            <FloatingMenu />
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
