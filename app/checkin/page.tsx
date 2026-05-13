'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const CONDITION_CONFIG = {
    GOOD: { label: 'Baik', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
    DAMAGED: { label: 'Rusak', color: 'bg-orange-100 text-orange-600', icon: '⚠️' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600', icon: '❌' },
};

function CheckInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const checkoutId = searchParams.get('checkout_id'); // optional: linked ke checkout

    const [user, setUser] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [showScanner, setShowScanner] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<any>(null);

    // Form
    const [checkinDate, setCheckinDate] = useState(new Date().toISOString().split('T')[0]);
    const [picName, setPicName] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    // Signature
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Linked checkout info
    const [checkoutInfo, setCheckoutInfo] = useState<any>(null);

    const compressImage = (file: File, maxWidth = 1200, quality = 0.75): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
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
    };

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        fetchLocations();

        // Jika ada checkout_id, load item dari transaksi checkout
        if (checkoutId) loadFromCheckout(Number(checkoutId));
    }, []);

    const fetchLocations = async () => {
        const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setLocations(r.data);
    };

    const loadFromCheckout = async (id: number) => {
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setCheckoutInfo(r.header);
                setPicName(r.header.pic_name || '');
                // Pre-fill cart dari item checkout
                setCart(r.items.map((item: any) => ({
                    qr_id: item.qr_id,
                    name: item.item_name,
                    type: item.item_type,
                    qty: item.qty,
                    location_id: '',
                    condition: 'GOOD',
                    photo_base64: '',
                    note: '',
                })));
            }
        } catch { }
    };

    // Scanner
    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("ci-reader", { fps: 10, qrbox: 250 }, false);
            scanner.render(async (qrId: string) => {
                setShowScanner(false);
                await addItemByQr(qrId);
            }, () => { });
        }
        return () => { if (scanner) scanner.clear().catch(() => { }); };
    }, [showScanner]);

    const addItemByQr = async (qrId: string) => {
        if (cart.find(i => i.qr_id === qrId)) { alert("Barang sudah ada di list!"); return; }
        try {
            const res = await fetch(`${BASE_URL}/get_item_by_qr.php?qr=${qrId}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setCart(prev => [...prev, {
                    qr_id: r.data.qr_id,
                    name: r.data.item_name,
                    type: (r.data.category || '').toUpperCase(),
                    qty: 1,
                    location_id: '',
                    condition: 'GOOD',
                    photo_base64: '',
                    note: '',
                }]);
            } else alert(r.message);
        } catch { alert("Gagal koneksi server."); }
    };

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.length < 2) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${BASE_URL}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                setSearchResults(r.status === 'success' ? r.data : []);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 350);
    };

    const updateCartItem = (qr_id: string, field: string, value: any) => {
        setCart(prev => prev.map(i => i.qr_id === qr_id ? { ...i, [field]: value } : i));
    };

    // Signature
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
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

    const handleSubmit = async () => {
        if (cart.length === 0) { alert("Tambahkan minimal 1 barang."); return; }
        for (const item of cart) {
            if (!item.location_id) { alert(`Pilih lokasi pengembalian untuk: ${item.name}`); return; }
        }
        if (!picName) { alert("Nama PIC wajib diisi."); return; }
        const sig = canvasRef.current?.toDataURL('image/png');
        if (!sig || sig.length < 2000) { alert("Tanda tangan wajib diisi."); return; }

        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/checkin.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    checkout_header_id: checkoutId ? Number(checkoutId) : null,
                    checkin_type: checkoutId ? 'TOOLS_RETURN' : 'DIRECT',
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
            if (r.status === 'success') {
                setSuccess(r.checkin_code);
                setCart([]);
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi server."); }
        setLoading(false);
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans">
            {/* HEADER */}
            <div className="bg-slate-900 text-white sticky top-0 z-20 shadow-lg p-5 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">Check In</h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{user.name} · {user.role}</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 px-3 py-2 rounded-xl text-xs font-black">← Transaksi</button>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* SUCCESS */}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
                        <p className="text-4xl">✅</p>
                        <p className="font-black text-emerald-700 text-lg">Check In Berhasil!</p>
                        <p className="font-mono text-emerald-600 font-bold">{success}</p>
                        <p className="text-sm text-emerald-600">Stok sudah dikembalikan ke gudang.</p>
                        <div className="flex gap-3 mt-2">
                            <button onClick={() => router.push('/transactions')}
                                className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-2xl text-xs uppercase">📋 Transaksi</button>
                            <button onClick={() => { setSuccess(''); }}
                                className="flex-1 bg-emerald-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-md">+ Check In Lagi</button>
                        </div>
                    </div>
                )}

                {!success && (
                    <>
                        {/* Linked checkout info */}
                        {checkoutInfo && (
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Linked ke Checkout</p>
                                <p className="font-bold text-slate-800">{checkoutInfo.project_name}</p>
                                <p className="text-[10px] text-slate-400">{checkoutInfo.transaction_code} · {checkoutInfo.checkout_date}</p>
                            </div>
                        )}

                        {/* TAMBAH BARANG */}
                        {!checkoutId && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Barang</p>
                                {!showScanner ? (
                                    <button onClick={() => { setShowScanner(true); setShowSearch(false); }}
                                        className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                                        📷 SCAN QR CODE
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <div id="ci-reader" className="overflow-hidden rounded-2xl border-2 border-emerald-600 bg-black"></div>
                                        <button onClick={() => setShowScanner(false)} className="w-full text-red-500 font-bold text-xs uppercase">Batal Scan</button>
                                    </div>
                                )}
                                {!showScanner && (
                                    <div>
                                        <button onClick={() => setShowSearch(v => !v)}
                                            className="w-full bg-slate-200 text-slate-700 font-black py-3 rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">
                                            🔍 {showSearch ? 'TUTUP PENCARIAN' : 'CARI BARANG MANUAL'}
                                        </button>
                                        {showSearch && (
                                            <div className="mt-2 space-y-2">
                                                <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                                                    placeholder="Ketik nama / QR ID..."
                                                    className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:border-emerald-400 transition-colors" autoFocus />
                                                {searching && <p className="text-center text-xs text-slate-400 animate-pulse">Mencari...</p>}
                                                {!searching && searchResults.length > 0 && (
                                                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden divide-y divide-slate-50 max-h-56 overflow-y-auto">
                                                        {searchResults.map((item: any) => (
                                                            <button key={item.qr_id}
                                                                onClick={() => {
                                                                    if (cart.find(i => i.qr_id === item.qr_id)) { alert("Sudah ada di list!"); return; }
                                                                    setCart(prev => [...prev, { qr_id: item.qr_id, name: item.item_name, type: (item.category || '').toUpperCase(), qty: 1, location_id: '', condition: 'GOOD', photo_base64: '', note: '' }]);
                                                                    setSearchQuery(''); setSearchResults([]); setShowSearch(false);
                                                                }}
                                                                className="w-full text-left p-3.5 hover:bg-emerald-50 transition-colors flex justify-between items-center">
                                                                <div>
                                                                    <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                                    <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-400">Stok: {item.stock_qty}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CART */}
                        {cart.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{cart.length} Barang</p>
                                {cart.map(item => (
                                    <div key={item.qr_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                            </div>
                                            {!checkoutId && (
                                                <button onClick={() => setCart(cart.filter(i => i.qr_id !== item.qr_id))}
                                                    className="text-red-300 font-black p-1 text-sm">✕</button>
                                            )}
                                        </div>

                                        {/* Qty */}
                                        <div className="flex items-center gap-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase w-16">Qty</label>
                                            <input type="number" min="1" value={item.qty}
                                                onChange={e => updateCartItem(item.qr_id, 'qty', e.target.value)}
                                                className="w-16 text-center border-2 rounded-lg font-black text-emerald-600 py-1" />
                                        </div>

                                        {/* Lokasi pengembalian */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Kembalikan ke Lokasi *</label>
                                            <select value={item.location_id} onChange={e => updateCartItem(item.qr_id, 'location_id', e.target.value)}
                                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                                <option value="">-- Pilih Lokasi --</option>
                                                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                                            </select>
                                        </div>

                                        {/* Kondisi */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Kondisi Barang *</label>
                                            <div className="flex gap-2 mt-1">
                                                {Object.entries(CONDITION_CONFIG).map(([key, cfg]) => (
                                                    <button key={key}
                                                        onClick={() => updateCartItem(item.qr_id, 'condition', key)}
                                                        className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${item.condition === key ? cfg.color + ' border-2 border-current' : 'bg-slate-100 text-slate-400'}`}>
                                                        {cfg.icon} {cfg.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Foto kondisi saat kembali */}
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Foto Kondisi Kembali</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <label className="px-3 py-2 bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl cursor-pointer active:scale-95">
                                                    📷 Upload
                                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                                        onChange={async e => {
                                                            const file = e.target.files?.[0]; if (!file) return;
                                                            const b64 = await compressImage(file);
                                                            updateCartItem(item.qr_id, 'photo_base64', b64);
                                                        }} />
                                                </label>
                                                {item.photo_base64 && (
                                                    <div className="relative">
                                                        <img src={item.photo_base64} alt="preview"
                                                            className="w-12 h-12 object-cover rounded-xl border border-slate-200" />
                                                        <button onClick={() => updateCartItem(item.qr_id, 'photo_base64', '')}
                                                            className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-black">✕</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Catatan per item */}
                                        <input type="text" placeholder="Catatan kondisi (opsional)..."
                                            value={item.note} onChange={e => updateCartItem(item.qr_id, 'note', e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 rounded-xl outline-none text-sm font-medium text-slate-700" />
                                    </div>
                                ))}

                                {/* Form detail */}
                                <div className="bg-white rounded-3xl shadow-xl p-5 space-y-4">
                                    <input type="date" value={checkinDate} onChange={e => setCheckinDate(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                    <input type="text" placeholder="Nama PIC yang mengembalikan *" value={picName}
                                        onChange={e => setPicName(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                    <input type="text" placeholder="Catatan (opsional)" value={note}
                                        onChange={e => setNote(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />

                                    {/* Signature */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-[10px] font-black text-slate-400 uppercase">TTD PIC</label>
                                            <button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)}
                                                className="text-[10px] text-blue-500 font-bold">RESET</button>
                                        </div>
                                        <canvas ref={canvasRef} width={500} height={300}
                                            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                            onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                            className="w-full h-48 bg-slate-50 rounded-2xl border-2 border-slate-100 touch-none" />
                                    </div>

                                    <button onClick={handleSubmit} disabled={loading}
                                        className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                        {loading ? 'Menyimpan...' : '✅ SUBMIT CHECK IN'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* BOTTOM NAV */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 z-50 p-4 pb-6">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')} className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">🏠 Menu</button>
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
