'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const TYPE_CONFIG = {
    OPNAME: { label: 'Koreksi Stok', icon: '📋', color: 'amber', desc: 'Sesuaikan stok berdasarkan hasil hitung fisik' },
    DAMAGE: { label: 'Rusak / Hilang', icon: '⚠️', color: 'red', desc: 'Catat barang rusak atau hilang' },
};

function StockAdjustmentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initType = searchParams.get('type') || '';

    const [user, setUser] = useState<any>(null);
    const [adjType, setAdjType] = useState<string>(initType);
    const [items, setItems] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ ok: boolean, msg: string } | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Search item state
    const [itemSearch, setItemSearch] = useState('');
    const [itemResults, setItemResults] = useState<any[]>([]);
    const [searchingItem, setSearchingItem] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const searchTimeout = useRef<any>(null);
    const [showScanner, setShowScanner] = useState(false);

    // Shared fields
    const [locationId, setLocationId] = useState('');
    const [qty, setQty] = useState('');
    const [actualQty, setActualQty] = useState('');
    const [note, setNote] = useState('');
    const [photoB64, setPhotoB64] = useState('');
    const [photoPreview, setPhotoPreview] = useState('');

    const photoRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role === 'MANAGER') { router.push('/'); return; }
        setUser(parsed);
        fetchLocations();
        fetchItems(parsed.id);
    }, []);

    const fetchLocations = async () => {
        const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setLocations(r.data);
    };

    const fetchItems = async (uid?: number) => {
        const res = await fetch(`${BASE_URL}/get_items.php?user_id=${uid ?? user?.id}`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setItems(r.data);
    };

    // Scanner logic
    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("adj-reader", { fps: 10, qrbox: 250 }, false);
            scanner.render(async (qrId: string) => {
                setShowScanner(false);
                await fetchItemByQr(qrId);
            }, () => { });
        }
        return () => { if (scanner) scanner.clear().catch(() => { }); };
    }, [showScanner]);

    const fetchItemByQr = async (qrId: string) => {
        try {
            const res = await fetch(`${BASE_URL}/get_item_by_qr.php?qr=${encodeURIComponent(qrId)}&user_id=${user?.id}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const r = await res.json();
            if (r.status === 'success') {
                const item = r.data;
                const mapped = {
                    qr_id: item.qr_id,
                    item_name: item.item_name,
                    category: item.category,
                    unit: item.unit,
                    stock_qty: item.stock_qty,
                    reserved_qty: item.reserved_qty,
                    available_qty: item.available_qty,
                    locations: item.locations,
                };
                setSelectedItem(mapped);
                setItemSearch(item.item_name);
                setItemResults([]);
                setLocationId('');
                setActualQty('');
            } else {
                alert("Barang tidak ditemukan: " + qrId);
            }
        } catch { alert("Gagal koneksi server."); }
    };

    const handleItemSearch = (val: string) => {
        setItemSearch(val);
        setSelectedItem(null);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.length < 2) { setItemResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearchingItem(true);
            try {
                const res = await fetch(`${BASE_URL}/search_inventory.php?q=${encodeURIComponent(val)}&user_id=${user?.id}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                setItemResults(r.status === 'success' ? r.data : []);
            } catch { setItemResults([]); }
            setSearchingItem(false);
        }, 350);
    };

    const handleSelectItem = (item: any) => {
        setSelectedItem(item);
        setItemSearch(item.item_name);
        setItemResults([]);
        setLocationId('');
        setActualQty('');
    };

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

    const handlePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const b64 = await compressImage(file);
        setPhotoB64(b64);
        setPhotoPreview(b64);
    };

    const resetForm = () => {
        setSelectedItem(null); setItemSearch(''); setItemResults([]);
        setLocationId('');
        setQty(''); setActualQty(''); setNote('');
        setPhotoB64(''); setPhotoPreview('');
        setShowScanner(false);
    };

    const handleSubmit = async () => {
        if (!adjType) { alert("Pilih tipe adjustment dulu."); return; }
        setSubmitting(true);
        setResult(null);

        try {
            let payload: any = {
                type: adjType, adjusted_by: user?.name || 'unknown',
                note, photo: photoB64
            };

            if (adjType === 'OPNAME') {
                if (!selectedItem) throw new Error("Pilih item.");
                if (!locationId) throw new Error("Pilih lokasi.");
                if (actualQty === '') throw new Error("Isi stok aktual hasil hitung.");
                payload.qr_id = selectedItem.qr_id;
                payload.location_id = locationId;
                payload.actual_qty = Number(actualQty);
            }
            else if (adjType === 'DAMAGE') {
                if (!selectedItem) throw new Error("Pilih item.");
                if (!locationId) throw new Error("Pilih lokasi.");
                if (!qty || Number(qty) <= 0) throw new Error("Qty harus lebih dari 0.");
                payload.qr_id = selectedItem.qr_id;
                payload.location_id = locationId;
                payload.qty = Number(qty);
            }

            const res = await fetch(`${BASE_URL}/stock_adjustment.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify(payload)
            });
            const r = await res.json();
            if (r.status === 'success') {
                setResult({ ok: true, msg: r.message });
                resetForm();
                fetchItems();
            } else {
                setResult({ ok: false, msg: r.message });
            }
        } catch (e: any) {
            setResult({ ok: false, msg: e.message });
        }
        setSubmitting(false);
    };

    const fetchLogs = async () => {
        setShowLogs(v => !v);
        if (showLogs) return;
        setLoadingLogs(true);
        try {
            const res = await fetch(`${BASE_URL}/get_adjustment_logs.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setLogs(r.data);
        } catch { }
        setLoadingLogs(false);
    };

    const stockAtLoc = selectedItem?.locations?.find((l: any) => String(l.location_id) === String(locationId));

    const typeColors: Record<string, string> = {
        OPNAME: 'bg-amber-100 text-amber-700 border-amber-300',
        DAMAGE: 'bg-red-100 text-red-700 border-red-300',
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">
            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* INFO BANNER */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">💡</span>
                    <div>
                        <p className="text-[10px] font-black text-blue-700 uppercase">Catatan Penting</p>
                        <p className="text-[10px] text-blue-600 mt-0.5">
                            Penambahan stok (pembelian) → gunakan <strong>Input GR</strong>.
                            Perpindahan antar gudang → gunakan <strong>Transfer Gudang</strong>.
                        </p>
                    </div>
                </div>

                {/* RESULT BANNER */}
                {result && (
                    <div className={`p-4 rounded-2xl font-bold text-sm ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {result.ok ? '✅ ' : '❌ '}{result.msg}
                    </div>
                )}

                {/* TYPE SELECTOR — hanya 2 */}
                <div className="grid grid-cols-2 gap-3">
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                        <button
                            key={key}
                            onClick={() => { setAdjType(key); setResult(null); resetForm(); }}
                            className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-95
                                ${adjType === key
                                    ? `${typeColors[key]} border-2 shadow-md scale-[1.02]`
                                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}
                        >
                            <p className="text-2xl mb-2">{cfg.icon}</p>
                            <p className="font-black text-xs uppercase tracking-widest">{cfg.label}</p>
                            <p className="text-[10px] mt-0.5 opacity-70 leading-tight">{cfg.desc}</p>
                        </button>
                    ))}
                </div>

                {/* FORM */}
                {adjType && (
                    <div className="bg-white rounded-3xl shadow-lg p-5 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {TYPE_CONFIG[adjType as keyof typeof TYPE_CONFIG]?.icon}{' '}
                            {TYPE_CONFIG[adjType as keyof typeof TYPE_CONFIG]?.label}
                        </p>

                        {/* ===== OPNAME ===== */}
                        {adjType === 'OPNAME' && (
                            <>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-black text-amber-700">📋 Koreksi stok berdasarkan hasil hitung fisik. Selisih akan dicatat di log.</p>
                                </div>
                                <ItemSearchBox
                                    value={itemSearch} onChange={handleItemSearch}
                                    results={itemResults} searching={searchingItem}
                                    onSelect={handleSelectItem} selected={selectedItem}
                                    showScanner={showScanner} onToggleScanner={() => setShowScanner(v => !v)}
                                />
                                {selectedItem && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lokasi *</label>
                                            <select value={locationId}
                                                onChange={e => { setLocationId(e.target.value); setActualQty(''); }}
                                                className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                                <option value="">-- Pilih --</option>
                                                {selectedItem.locations?.map((l: any) => (
                                                    <option key={l.location_id} value={l.location_id}>
                                                        {l.location_name} (sistem: {l.stock_qty})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Stok Aktual *</label>
                                            <input type="number" min="0" placeholder="hasil hitung" value={actualQty}
                                                onChange={e => setActualQty(e.target.value)}
                                                className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-bold text-slate-700 text-center" />
                                        </div>
                                    </div>
                                )}
                                {stockAtLoc && actualQty !== '' && (
                                    <div className={`px-4 py-3 rounded-xl text-sm font-bold ${Number(actualQty) >= stockAtLoc.stock_qty ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                        Sistem: <strong>{stockAtLoc.stock_qty}</strong> → Aktual: <strong>{actualQty}</strong> → Selisih: <strong>{Number(actualQty) >= stockAtLoc.stock_qty ? '+' : ''}{Number(actualQty) - stockAtLoc.stock_qty}</strong>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ===== DAMAGE ===== */}
                        {adjType === 'DAMAGE' && (
                            <>
                                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-black text-red-700">⚠️ Catat barang rusak atau hilang. Stok akan dikurangi sejumlah yang diinput.</p>
                                </div>
                                <ItemSearchBox
                                    value={itemSearch} onChange={handleItemSearch}
                                    results={itemResults} searching={searchingItem}
                                    onSelect={handleSelectItem} selected={selectedItem}
                                    showScanner={showScanner} onToggleScanner={() => setShowScanner(v => !v)}
                                />
                                {selectedItem && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lokasi *</label>
                                            <select value={locationId} onChange={e => setLocationId(e.target.value)}
                                                className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                                <option value="">-- Pilih --</option>
                                                {selectedItem.locations?.filter((l: any) => l.stock_qty > 0).map((l: any) => (
                                                    <option key={l.location_id} value={l.location_id}>
                                                        {l.location_name} (stok: {l.stock_qty})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Jumlah *</label>
                                            <input type="number" min="1" placeholder="0" value={qty}
                                                onChange={e => setQty(e.target.value)}
                                                className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-bold text-slate-700 text-center" />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* SHARED: Catatan + Foto */}
                        <input type="text" placeholder="Catatan (opsional)" value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Foto Bukti (opsional)</label>
                            <div className="mt-1.5 flex gap-3 items-center">
                                <button onClick={() => photoRef.current?.click()}
                                    className="px-4 py-2.5 bg-slate-100 text-slate-600 font-black text-xs rounded-xl active:scale-95">
                                    📷 Upload Foto
                                </button>
                                {photoPreview && (
                                    <div className="relative">
                                        <img src={photoPreview} alt="preview" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                                        <button onClick={() => { setPhotoB64(''); setPhotoPreview(''); }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-black">✕</button>
                                    </div>
                                )}
                            </div>
                            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={handlePhotoInput} />
                        </div>

                        <button onClick={handleSubmit} disabled={submitting}
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                            {submitting ? 'Menyimpan...' : `✓ Simpan ${TYPE_CONFIG[adjType as keyof typeof TYPE_CONFIG]?.label}`}
                        </button>
                    </div>
                )}

                {/* LOG PANEL */}
                <button onClick={fetchLogs}
                    className="w-full bg-white border border-slate-200 text-slate-600 font-black py-3 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all">
                    {showLogs ? '▲ Sembunyikan Log' : '📋 Lihat Riwayat Adjustment'}
                </button>

                {showLogs && (
                    <div className="bg-white rounded-3xl shadow-lg p-5 space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riwayat Adjustment</p>
                        {loadingLogs ? (
                            <p className="text-center text-slate-400 animate-pulse py-4 text-sm">Memuat...</p>
                        ) : logs.length === 0 ? (
                            <p className="text-center text-slate-300 italic text-sm py-4">Belum ada log.</p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {logs
                                    .filter((log: any) => ['OPNAME', 'DAMAGE'].includes(log.adjustment_type))
                                    .map((log: any) => (
                                        <div key={log.id} className="border border-slate-100 rounded-2xl p-3.5">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${typeColors[log.adjustment_type] || 'bg-slate-100 text-slate-500'}`}>
                                                            {log.adjustment_type}
                                                        </span>
                                                        <span className={`text-xs font-black ${log.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {log.diff > 0 ? `+${log.diff}` : log.diff}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-sm text-slate-800">{log.item_name}</p>
                                                    <p className="text-[10px] text-slate-400">{log.location_name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {log.stock_before} → {log.stock_after} · {log.adjusted_by}
                                                    </p>
                                                    {log.note && <p className="text-[10px] text-slate-500 italic">"{log.note}"</p>}
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-[9px] text-slate-300">
                                                        {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                    </p>
                                                    <p className="text-[9px] text-slate-300">
                                                        {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    {log.photo_path && (
                                                        <a href={`${BASE_URL}/${log.photo_path}`} target="_blank" rel="noreferrer"
                                                            className="text-[9px] text-blue-500 font-bold">📷 Foto</a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <Navbar />
        </main>
    );
}

function ItemSearchBox({ value, onChange, results, searching, onSelect, selected, showScanner, onToggleScanner }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cari Barang *</label>
            {selected ? (
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5">
                    <div>
                        <p className="font-bold text-sm text-slate-800">{selected.item_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{selected.qr_id} · Stok total: {selected.stock_qty}</p>
                    </div>
                    <button onClick={() => onSelect(null)} className="text-slate-400 text-xs font-black px-2 py-1 bg-slate-200 rounded-lg">Ganti</button>
                </div>
            ) : (
                <>
                    <div className="flex gap-2">
                        <button onClick={onToggleScanner}
                            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95
                                ${showScanner ? 'bg-red-500 text-white' : 'bg-blue-600 text-white shadow-md shadow-blue-200'}`}>
                            {showScanner ? '✕ Batal Scan' : '📷 Scan QR'}
                        </button>
                        <div className="flex-1 relative">
                            <input type="text" value={value} onChange={e => onChange(e.target.value)}
                                placeholder="Atau ketik nama / QR ID..."
                                className="w-full p-2.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm focus:bg-white focus:ring-2 ring-blue-200 transition-all" />
                        </div>
                    </div>
                    {showScanner && (
                        <div id="adj-reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
                    )}
                    {searching && <p className="text-[10px] text-slate-400 animate-pulse text-center">Mencari...</p>}
                    {!showScanner && results.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-50 max-h-48 overflow-y-auto shadow-lg">
                            {results.map((item: any) => (
                                <button key={item.qr_id} onClick={() => onSelect(item)}
                                    className="w-full text-left p-3.5 hover:bg-blue-50 transition-colors flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500">Stok: {item.stock_qty}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function StockAdjustmentPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <StockAdjustmentContent />
        </Suspense>
    );
}
