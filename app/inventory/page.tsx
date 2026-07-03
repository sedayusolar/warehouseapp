'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

function InventoryContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [filterLocation, setFilterLocation] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [form, setForm] = useState({ item_name: '', category: '', unit: '' });
    const [formLocations, setFormLocations] = useState<{ location_id: string, qty: number }[]>([{ location_id: '', qty: 0 }]);
    const [newItemQr, setNewItemQr] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [qrMode, setQrMode] = useState<'auto' | 'existing'>('auto');
    const [manualQr, setManualQr] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const html5QrRef = useRef<any>(null);
    const [itemPhotoB64, setItemPhotoB64] = useState('');
    const [itemPhotoPreview, setItemPhotoPreview] = useState('');
    const itemPhotoRef = useRef<HTMLInputElement>(null);

    const [editingQr, setEditingQr] = useState<string | null>(null);
    const [editItem, setEditItem] = useState<any>(null);
    const [editForm, setEditForm] = useState<any>({});
    const [savingEdit, setSavingEdit] = useState(false);
    const [editPhotoB64, setEditPhotoB64] = useState('');
    const [editPhotoPreview, setEditPhotoPreview] = useState('');
    const editPhotoRef = useRef<HTMLInputElement>(null);

    const [logQr, setLogQr] = useState<string | null>(null);
    const [deletingQr, setDeletingQr] = useState<string | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLog, setLoadingLog] = useState(false);

    const [detailItem, setDetailItem] = useState<any>(null);
    const [detailData, setDetailData] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
        fetchItems();
    }, []);

    const fetchLocations = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setLocations(r.data);
        } catch { }
    };

    const fetchItems = async (locId = '', cat = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (locId) params.append('location_id', locId);
            if (cat) params.append('category', cat);
            const res = await fetch(`${BASE_URL}/get_items.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setItems(r.data);
        } catch { }
        setLoading(false);
    };

    const handleFilterChange = (locId: string, cat: string) => {
        setFilterLocation(locId); setFilterCategory(cat);
        fetchItems(locId, cat);
    };

    const openDetail = async (item: any) => {
        setDetailItem(item); setDetailData(null); setLoadingDetail(true);
        try {
            const res = await fetch(`${BASE_URL}/get_item_detail.php?qr_id=${item.qr_id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDetailData(r);
        } catch { }
        setLoadingDetail(false);
    };

    const closeDetail = () => { setDetailItem(null); setDetailData(null); };

    const handleSubmitItem = async () => {
        if (!form.item_name || !form.category || !form.unit) { alert("Nama, kategori, dan satuan wajib!"); return; }
        if (qrMode === 'existing' && !manualQr.trim()) { alert("Isi/scan dulu QR code yang mau dipakai!"); return; }
        const validLocs = formLocations.filter(l => l.location_id && l.qty > 0);
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/add_item.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    ...form, locations: validLocs, item_photo: itemPhotoB64 || null,
                    qr_id: qrMode === 'existing' ? manualQr.trim().toUpperCase() : ''
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                setNewItemQr(r.qr_id); setNewItemName(form.item_name);
                setForm({ item_name: '', category: '', unit: '' });
                setFormLocations([{ location_id: '', qty: 0 }]);
                setItemPhotoB64(''); setItemPhotoPreview('');
                setQrMode('auto'); setManualQr('');
                fetchItems(filterLocation, filterCategory);
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSubmitting(false);
    };

    const loadHtml5QrcodeScript = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if ((window as any).Html5Qrcode) { resolve(); return; }
            const existing = document.getElementById('html5-qrcode-script');
            if (existing) { existing.addEventListener('load', () => resolve()); return; }
            const script = document.createElement('script');
            script.id = 'html5-qrcode-script';
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Gagal load library scanner'));
            document.body.appendChild(script);
        });
    };

    const openScanner = async () => {
        setScannerError('');
        setShowScanner(true);
        try {
            await loadHtml5QrcodeScript();
            // Tunggu satu tick biar div#qr-reader sudah ke-render
            setTimeout(async () => {
                try {
                    const Html5Qrcode = (window as any).Html5Qrcode;
                    const Formats = (window as any).Html5QrcodeSupportedFormats;
                    const scanner = new Html5Qrcode('qr-reader', {
                        // Dukung QR code 2D sekaligus barcode 1D (produk pabrikan biasanya Code128/EAN/UPC)
                        formatsToSupport: [
                            Formats.QR_CODE, Formats.CODE_128, Formats.CODE_39, Formats.CODE_93,
                            Formats.EAN_13, Formats.EAN_8, Formats.UPC_A, Formats.UPC_E,
                            Formats.CODABAR, Formats.ITF, Formats.DATA_MATRIX,
                        ],
                        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                        verbose: false,
                    });
                    html5QrRef.current = scanner;
                    await scanner.start(
                        { facingMode: 'environment' },
                        { fps: 10, qrbox: { width: 260, height: 160 } },
                        (decodedText: string) => {
                            setManualQr(decodedText);
                            closeScanner();
                        },
                        () => { /* ignore per-frame no-match */ }
                    );
                } catch (e: any) {
                    setScannerError('Tidak bisa akses kamera. Pastikan izin kamera diizinkan, atau ketik manual.');
                }
            }, 150);
        } catch {
            setScannerError('Gagal load scanner. Cek koneksi internet, atau ketik manual.');
        }
    };

    const closeScanner = () => {
        const scanner = html5QrRef.current;
        if (scanner) {
            scanner.stop().then(() => scanner.clear()).catch(() => { });
            html5QrRef.current = null;
        }
        setShowScanner(false);
    };

    const handlePrintQr = (qrId: string, itemName: string) => {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><title>QR - ${qrId}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8f9fa}.label{background:white;border:2px solid #000;border-radius:8px;padding:16px;width:200px;text-align:center}.company{font-size:9px;font-weight:bold;letter-spacing:2px;color:#666;margin-bottom:8px}.qr-box{display:flex;justify-content:center;margin:8px 0}.qr-id{font-size:12px;font-weight:900;letter-spacing:1px;margin:6px 0 4px}.item-name{font-size:10px;color:#333;line-height:1.3;word-break:break-word}@media print{body{background:white}}</style>
</head><body><div class="label"><div class="company">⚡ SEDAYU SOLAR</div><div class="qr-box" id="qrcode"></div><div class="qr-id">${qrId}</div><div class="item-name">${itemName}</div></div>
<script>new QRCode(document.getElementById('qrcode'),{text:'${qrId}',width:130,height:130,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});setTimeout(()=>window.print(),800);<\/script>
</body></html>`);
        win.document.close();
    };

    const handleStartEdit = (item: any) => {
        setEditItem(item);
        setEditingQr(item.qr_id); setLogQr(null);
        setEditPhotoB64(''); setEditPhotoPreview('');
        setEditForm({
            item_name: item.item_name, category: item.category, unit: item.unit,
            unit_price: item.unit_price || 0,
            locations: item.locations?.length
                ? item.locations.map((l: any) => ({ location_id: String(l.location_id), qty: l.stock_qty }))
                : [{ location_id: '', qty: 0 }],
            note: ''
        });
    };

    const handleSaveEdit = async () => {
        if (!editForm.item_name || !editForm.category || !editForm.unit) { alert("Nama, kategori, satuan wajib."); return; }
        setSavingEdit(true);
        try {
            const res = await fetch(`${BASE_URL}/update_item.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    qr_id: editingQr, item_name: editForm.item_name,
                    category: editForm.category, unit: editForm.unit,
                    locations: editForm.locations.filter((l: any) => l.location_id),
                    unit_price: Number(editForm.unit_price) || 0,
                    adjusted_by: user?.name || 'unknown', note: editForm.note,
                    item_photo: editPhotoB64 || null,
                })
            });
            const r = await res.json();
            if (r.status === 'success') { setEditingQr(null); setEditItem(null); fetchItems(filterLocation, filterCategory); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSavingEdit(false);
    };

    const handleDelete = async (item: any) => {
        if (!confirm(`Hapus "${item.item_name}" (${item.qr_id})? \nStok: ${item.stock_qty} ${item.unit}\n\nAksi ini tidak bisa dibatalkan.`)) return;
        setDeletingQr(item.qr_id);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/delete_inventory.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'SedayuSolar_TopSecret_2026' },
                body: JSON.stringify({ qr_id: item.qr_id })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(r.message);
                fetchItems(filterLocation, filterCategory);
            } else {
                alert('Gagal: ' + r.message);
            }
        } catch { alert('Gagal koneksi.'); }
        setDeletingQr(null);
    };

    const fetchLog = async (qrId: string) => {
        if (logQr === qrId) { setLogQr(null); return; }
        setLogQr(qrId); setLoadingLog(true);
        try {
            const res = await fetch(`${BASE_URL}/get_stock_logs.php?qr_id=${qrId}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setLogs(r.data); else setLogs([]);
        } catch { setLogs([]); }
        setLoadingLog(false);
    };

    const filtered = items.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.qr_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const statusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'text-emerald-600 bg-emerald-50';
            case 'PENDING': return 'text-orange-500 bg-orange-50';
            case 'REJECTED': return 'text-red-500 bg-red-50';
            case 'DRAFT': return 'text-slate-400 bg-slate-50';
            default: return 'text-slate-500 bg-slate-50';
        }
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900">

            {/* SEARCH + FILTER BAR */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm">
                <div className="p-3 space-y-2 max-w-4xl mx-auto">
                    <div className="flex gap-2 items-center">
                        <input type="text" placeholder="🔍 Cari nama / QR ID..." value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 p-2.5 bg-slate-100 text-slate-700 placeholder-slate-400 rounded-xl outline-none text-sm font-medium" />
                        {user.role !== 'MANAGER' && (
                            <button onClick={() => { setShowForm(v => !v); setNewItemQr(''); if (showScanner) closeScanner(); }}
                                className={`px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex-shrink-0 ${showForm ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white shadow-sm'}`}>
                                {showForm ? '✕' : '＋'}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <select value={filterLocation} onChange={e => handleFilterChange(e.target.value, filterCategory)}
                            className="flex-1 p-2 bg-slate-100 text-slate-600 rounded-xl outline-none text-xs font-bold appearance-none">
                            <option value="">Semua Lokasi</option>
                            {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                        </select>
                        <select value={filterCategory} onChange={e => handleFilterChange(filterLocation, e.target.value)}
                            className="flex-1 p-2 bg-slate-100 text-slate-600 rounded-xl outline-none text-xs font-bold appearance-none">
                            <option value="">Semua Kategori</option>
                            <option value="Material">Material</option>
                            <option value="Tools">Tools</option>
                            <option value="Produk">Produk</option>
                        </select>
                    </div>
                </div>
            </div>


            {/* QR SCANNER MODAL */}
            {showScanner && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-5">
                    <div className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-sm text-slate-800">📷 Scan QR / Barcode</h3>
                            <button onClick={closeScanner} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        {scannerError ? (
                            <p className="text-xs text-red-500 font-medium py-6 text-center">{scannerError}</p>
                        ) : (
                            <div id="qr-reader" className="w-full rounded-2xl overflow-hidden bg-slate-900" />
                        )}
                        <p className="text-[10px] text-slate-400 text-center">Arahkan kamera ke QR code atau barcode di kemasan produk.</p>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {detailItem && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={closeDetail}>
                    <div className="flex-1 overflow-y-auto mt-16" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-28 space-y-5">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{detailItem.category}</p>
                                    <h2 className="font-black text-xl text-slate-900 mt-0.5">{detailItem.item_name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-mono text-slate-400">{detailItem.qr_id}</span>
                                        <button onClick={() => handlePrintQr(detailItem.qr_id, detailItem.item_name)}
                                            className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">🖨️ Print</button>
                                    </div>
                                </div>
                                <button onClick={closeDetail} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {loadingDetail ? (
                                <p className="text-center text-slate-400 animate-pulse py-10">Memuat detail...</p>
                            ) : detailData && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Stok Fisik', val: detailData.total_stock, color: 'text-slate-800' },
                                            { label: 'Pending', val: detailData.total_reserved, color: 'text-orange-500' },
                                            { label: 'Tersedia', val: detailData.total_available, color: detailData.total_available > 0 ? 'text-emerald-600' : 'text-red-500' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-slate-50 rounded-2xl p-3 text-center">
                                                <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                                                <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">{s.label}</p>
                                                <p className="text-[9px] text-slate-400">{detailData.item?.unit}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {(user.role === 'ADMIN' || user.role === 'MANAGER') && Number(detailData.item?.unit_price) > 0 && (
                                        <div className="bg-violet-50 rounded-2xl p-3">
                                            <p className="text-[10px] font-black text-violet-400 uppercase">💰 Harga Beli / HPP</p>
                                            <p className="font-black text-violet-800 text-lg mt-0.5">
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(detailData.item.unit_price)}
                                                <span className="text-[10px] text-violet-400 font-bold ml-1">/ {detailData.item.unit}</span>
                                            </p>
                                        </div>
                                    )}

                                    {detailData.item?.photo_path && (
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Foto Barang</p>
                                            <button onClick={() => setLightboxUrl(`https://sedayu.com/api/warehouse/${detailData.item.photo_path}`)} className="w-full">
                                                <img src={`https://sedayu.com/api/warehouse/${detailData.item.photo_path}`}
                                                    alt={detailItem.item_name}
                                                    className="w-full max-h-48 object-cover rounded-2xl border border-slate-100 active:opacity-80 transition-opacity" />
                                                <p className="text-[9px] text-slate-400 text-center mt-1">👆 Tap untuk perbesar</p>
                                            </button>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Stok per Lokasi</p>
                                        <div className="space-y-2">
                                            {detailData.locations?.length === 0 ? (
                                                <p className="text-sm text-slate-300 italic">Belum ada data lokasi.</p>
                                            ) : detailData.locations?.map((loc: any) => (
                                                <div key={loc.location_id} className="flex justify-between items-center bg-slate-50 rounded-xl p-3">
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-700">📍 {loc.location_name}</p>
                                                        {loc.reserved_qty > 0 && <p className="text-[10px] text-orange-500 font-bold">⏳ {loc.reserved_qty} pending</p>}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`font-black text-lg ${loc.available_qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{loc.available_qty}</p>
                                                        <p className="text-[9px] text-slate-400">/ {loc.stock_qty} tersedia</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Riwayat Checkout</p>
                                        {detailData.transactions?.length === 0 ? (
                                            <p className="text-sm text-slate-300 italic">Belum ada transaksi.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {detailData.transactions?.map((trx: any) => (
                                                    <div key={trx.header_id} className="bg-white border border-slate-100 rounded-2xl p-3.5">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusColor(trx.manager_approval_status)}`}>{trx.manager_approval_status}</span>
                                                                    <span className="text-[9px] text-slate-400 font-mono">{trx.transaction_code}</span>
                                                                </div>
                                                                <p className="font-bold text-sm text-slate-800 truncate">{trx.project_name}</p>
                                                                <p className="text-[10px] text-slate-400">PIC: {trx.pic_name} · {trx.checkout_date}</p>
                                                                {trx.location_name && <p className="text-[10px] text-slate-400">📍 {trx.location_name}</p>}
                                                                <p className="text-[10px] font-bold text-slate-600 mt-0.5">Qty: {trx.qty} {detailData.item?.unit}</p>
                                                            </div>
                                                            <div className="flex flex-col gap-1 flex-shrink-0">
                                                                {trx.photo_path && (
                                                                    <button onClick={() => setLightboxUrl(`https://sedayu.com/api/warehouse/${trx.photo_path}`)}>
                                                                        <img src={`https://sedayu.com/api/warehouse/${trx.photo_path}`} className="w-12 h-12 object-cover rounded-lg border border-slate-100" alt="checkout" />
                                                                        <p className="text-[8px] text-slate-400 text-center mt-0.5">Checkout</p>
                                                                    </button>
                                                                )}
                                                                {trx.photo_path_checkin && (
                                                                    <button onClick={() => setLightboxUrl(`https://sedayu.com/api/warehouse/${trx.photo_path_checkin}`)}>
                                                                        <img src={`https://sedayu.com/api/warehouse/${trx.photo_path_checkin}`} className="w-12 h-12 object-cover rounded-lg border border-emerald-100" alt="checkin" />
                                                                        <p className="text-[8px] text-emerald-500 text-center mt-0.5">Check In</p>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {detailData.adjustments?.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Riwayat Adjustment</p>
                                            <div className="space-y-2">
                                                {detailData.adjustments?.map((adj: any) => (
                                                    <div key={adj.id} className="bg-slate-50 rounded-xl p-3 flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase">{adj.adjustment_type}</span>
                                                                <span className={`text-xs font-black ${adj.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{adj.diff > 0 ? `+${adj.diff}` : adj.diff}</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">{adj.location_name}{adj.to_location_name ? ` → ${adj.to_location_name}` : ''}</p>
                                                            <p className="text-[10px] text-slate-400">{adj.adjusted_by} · {new Date(adj.created_at).toLocaleDateString('id-ID')}</p>
                                                            {adj.note && <p className="text-[10px] italic text-slate-400">"{adj.note}"</p>}
                                                        </div>
                                                        {adj.photo_path && (
                                                            <button onClick={() => setLightboxUrl(`https://sedayu.com/api/warehouse/${adj.photo_path}`)}>
                                                                <img src={`https://sedayu.com/api/warehouse/${adj.photo_path}`} className="w-10 h-10 object-cover rounded-lg border border-slate-200" alt="adj" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {user.role !== 'MANAGER' && (
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={() => { closeDetail(); handleStartEdit(detailItem); }}
                                                className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-2xl text-xs uppercase">✏️ Edit</button>
                                            <button onClick={() => router.push('/stock-adjustment')}
                                                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-md">🔄 Adjustment</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX */}
            {lightboxUrl && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
                    <button className="absolute top-5 right-5 text-white bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-black text-lg">✕</button>
                    <img src={lightboxUrl} alt="fullscreen" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}

            {/* EDIT MODAL */}
            {editingQr && editItem && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => { setEditingQr(null); setEditItem(null); }}>
                    <div className="flex-1 overflow-y-auto mt-16" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-16 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Edit Item</p>
                                    <p className="font-bold text-slate-800 mt-0.5">{editItem.item_name}</p>
                                    <p className="text-[10px] font-mono text-slate-400">{editItem.qr_id}</p>
                                </div>
                                <button onClick={() => { setEditingQr(null); setEditItem(null); }} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            <input type="text" value={editForm.item_name} onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                                placeholder="Nama Barang *"
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            <div className="grid grid-cols-2 gap-3">
                                <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                    className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                    <option value="Material">Material</option>
                                    <option value="Tools">Tools</option>
                                    <option value="Produk">Produk</option>
                                </select>
                                <input type="text" value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                                    placeholder="Satuan *"
                                    className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            </div>

                            {/* UNIT PRICE — hanya Admin/Manager */}
                            {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
                                <div>
                                    <label className="text-[10px] font-black text-violet-500 uppercase ml-1">💰 Harga Beli / HPP (per satuan)</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                                        <input type="number" min="0" value={editForm.unit_price || 0}
                                            onChange={e => setEditForm({ ...editForm, unit_price: e.target.value })}
                                            placeholder="0"
                                            className="w-full p-3.5 pl-10 bg-violet-50 rounded-xl outline-none font-bold text-slate-700 focus:ring-2 ring-violet-200 transition-all" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Stok per Lokasi</label>
                                <div className="space-y-2 mt-1.5">
                                    {(editForm.locations || []).map((fl: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <select value={fl.location_id} onChange={e => { const u = [...editForm.locations]; u[idx].location_id = e.target.value; setEditForm({ ...editForm, locations: u }); }}
                                                className="flex-1 p-3 bg-slate-50 rounded-xl outline-none text-sm font-medium text-slate-700 appearance-none">
                                                <option value="">-- Lokasi --</option>
                                                {locations.map((l: any) => <option key={l.id} value={String(l.id)}>{l.location_name}</option>)}
                                            </select>
                                            <input type="number" min="0" value={fl.qty}
                                                onChange={e => { const u = [...editForm.locations]; u[idx].qty = Number(e.target.value); setEditForm({ ...editForm, locations: u }); }}
                                                className="w-16 p-3 bg-slate-50 rounded-xl outline-none font-bold text-slate-700 text-center" />
                                            {editForm.locations.length > 1 && (
                                                <button onClick={() => setEditForm({ ...editForm, locations: editForm.locations.filter((_: any, i: number) => i !== idx) })}
                                                    className="text-red-400 font-black text-sm px-1">✕</button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={() => setEditForm({ ...editForm, locations: [...(editForm.locations || []), { location_id: '', qty: 0 }] })}
                                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest">＋ Tambah Lokasi</button>
                                </div>
                            </div>

                            <input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                placeholder="Catatan perubahan stok (opsional)..."
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Foto Barang (opsional)</label>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <button onClick={() => editPhotoRef.current?.click()}
                                        className="px-4 py-2.5 bg-slate-100 text-slate-600 font-black text-xs rounded-xl active:scale-95">
                                        📷 Upload Foto
                                    </button>
                                    {editPhotoPreview ? (
                                        <div className="relative">
                                            <img src={editPhotoPreview} alt="preview" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                                            <button onClick={() => { setEditPhotoB64(''); setEditPhotoPreview(''); }}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-black">✕</button>
                                        </div>
                                    ) : editItem.photo_path ? (
                                        <div className="relative">
                                            <img src={`https://sedayu.com/api/warehouse/${editItem.photo_path}`}
                                                alt="current" className="w-16 h-16 object-cover rounded-xl border border-slate-200 opacity-60" />
                                            <p className="text-[8px] text-slate-400 text-center mt-0.5">Foto saat ini</p>
                                        </div>
                                    ) : null}
                                </div>
                                <input ref={editPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                                    onChange={async e => {
                                        const file = e.target.files?.[0]; if (!file) return;
                                        const b64 = await compressImage(file);
                                        setEditPhotoB64(b64); setEditPhotoPreview(b64);
                                    }} />
                            </div>

                            <div className="flex gap-3 pt-2 pb-4">
                                <button onClick={() => { setEditingQr(null); setEditItem(null); }}
                                    className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl text-xs uppercase">Batal</button>
                                <button onClick={handleSaveEdit} disabled={savingEdit}
                                    className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                    {savingEdit ? 'Menyimpan...' : '✓ Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            <div className="p-4 space-y-4 max-w-4xl mx-auto">
                {showForm && (
                    <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4 border border-blue-100">
                        <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Daftarkan Inventory Baru</h2>
                        {newItemQr && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3">
                                <p className="text-[10px] font-black text-emerald-600 uppercase">✅ Berhasil Didaftarkan!</p>
                                <p className="font-black text-2xl text-emerald-700 font-mono">{newItemQr}</p>
                                <p className="text-xs text-slate-500">{newItemName}</p>
                                <button onClick={() => handlePrintQr(newItemQr, newItemName)}
                                    className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md">
                                    🖨️ Print Label QR
                                </button>
                            </div>
                        )}
                        <input type="text" placeholder="Nama Barang *" value={form.item_name}
                            onChange={e => setForm({ ...form, item_name: e.target.value })}
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                        <div className="grid grid-cols-2 gap-3">
                            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                                className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                <option value="">Kategori *</option>
                                <option value="Material">Material</option>
                                <option value="Tools">Tools</option>
                                <option value="Produk">Produk</option>
                            </select>
                            <input type="text" placeholder="Satuan * (pcs, m, kg...)" value={form.unit}
                                onChange={e => setForm({ ...form, unit: e.target.value })}
                                className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">QR Code</label>
                            <div className="flex gap-2 mt-1.5">
                                <button type="button" onClick={() => { setQrMode('auto'); setManualQr(''); }}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${qrMode === 'auto' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                    🆕 Generate Baru
                                </button>
                                <button type="button" onClick={() => setQrMode('existing')}
                                    className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${qrMode === 'existing' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                    🏷️ Pakai QR Existing
                                </button>
                            </div>
                            {qrMode === 'existing' && (
                                <div className="mt-2 space-y-1.5">
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Ketik / scan QR code yang sudah ditempel..." value={manualQr}
                                            onChange={e => setManualQr(e.target.value)}
                                            className="flex-1 p-3.5 bg-amber-50 border border-amber-200 rounded-xl outline-none font-mono font-bold text-slate-700 text-sm uppercase" />
                                        <button type="button" onClick={openScanner}
                                            className="px-4 bg-amber-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all flex-shrink-0">
                                            📷 Scan
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-amber-600 font-medium ml-1">⚠️ Buat barang yang QR-nya udah tercetak/tertempel fisik tapi belum kedaftar di sistem.</p>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Stok per Lokasi</label>
                            <div className="space-y-2 mt-1">
                                {formLocations.map((fl, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <select value={fl.location_id} onChange={e => { const u = [...formLocations]; u[idx].location_id = e.target.value; setFormLocations(u); }}
                                            className="flex-1 p-2.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none">
                                            <option value="">-- Lokasi --</option>
                                            {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                                        </select>
                                        <input type="number" min="0" value={fl.qty}
                                            onChange={e => { const u = [...formLocations]; u[idx].qty = Number(e.target.value); setFormLocations(u); }}
                                            placeholder="Qty" className="w-16 p-2.5 bg-slate-50 rounded-xl outline-none font-bold text-slate-700 text-sm text-center" />
                                        {formLocations.length > 1 && <button onClick={() => setFormLocations(formLocations.filter((_, i) => i !== idx))} className="text-red-400 font-black text-sm px-1">✕</button>}
                                    </div>
                                ))}
                                <button onClick={() => setFormLocations([...formLocations, { location_id: '', qty: 0 }])}
                                    className="text-[10px] font-black text-blue-500 uppercase tracking-widest">＋ Tambah Lokasi</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Foto Barang (opsional)</label>
                            <div className="flex items-center gap-3 mt-1.5">
                                <button onClick={() => itemPhotoRef.current?.click()}
                                    className="px-4 py-2.5 bg-slate-100 text-slate-600 font-black text-xs rounded-xl active:scale-95 transition-all">
                                    📷 Upload Foto
                                </button>
                                {itemPhotoPreview && (
                                    <div className="relative">
                                        <img src={itemPhotoPreview} alt="preview" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                                        <button onClick={() => { setItemPhotoB64(''); setItemPhotoPreview(''); }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-black">✕</button>
                                    </div>
                                )}
                            </div>
                            <input ref={itemPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={async e => {
                                    const file = e.target.files?.[0]; if (!file) return;
                                    const b64 = await compressImage(file);
                                    setItemPhotoB64(b64); setItemPhotoPreview(b64);
                                }} />
                        </div>
                        <button onClick={handleSubmitItem} disabled={submitting}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                            {submitting ? 'Menyimpan...' : (qrMode === 'existing' ? '✓ Daftarkan dengan QR Ini' : '✓ Daftarkan & Generate QR ID')}
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-20 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Memuat Data...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">Tidak ada item ditemukan.</div>
                ) : (
                    <>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{filtered.length} item ditemukan</p>
                        {['Material', 'Tools', 'Produk'].map(cat => {
                            const group = filtered.filter(i => i.category === cat);
                            if (!group.length) return null;
                            const catIcon = cat === 'Material' ? '📦' : cat === 'Tools' ? '🛠️' : '🛒';
                            const catBorder = cat === 'Material' ? 'border-l-emerald-500' : cat === 'Tools' ? 'border-l-amber-500' : 'border-l-violet-500';
                            return (
                                <div key={cat} className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{catIcon} {cat} ({group.length})</h3>
                                    {group.map((item: any) => (
                                        <div key={item.qr_id} className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden ${catBorder}`}>
                                            <div className="p-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <button onClick={() => openDetail(item)} className="flex-1 min-w-0 text-left">
                                                        <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                            <button onClick={e => { e.stopPropagation(); handlePrintQr(item.qr_id, item.item_name); }}
                                                                className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md active:scale-95">🖨️ Print</button>
                                                        </div>
                                                        {item.locations?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {item.locations.map((loc: any) => (
                                                                    <span key={loc.location_id} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${(loc.available_qty ?? loc.stock_qty) > 0 ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-400'}`}>
                                                                        📍 {loc.location_name}: {loc.available_qty ?? loc.stock_qty}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </button>
                                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                        <div className="text-right">
                                                            <p className={`text-lg font-black ${Number(item.available_qty) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {item.available_qty}<span className="text-[10px] font-bold text-slate-400 ml-1">{item.unit}</span>
                                                            </p>
                                                            <p className="text-[9px] text-slate-400 font-bold">tersedia</p>
                                                            {Number(item.reserved_qty) > 0 && <p className="text-[9px] text-orange-500 font-black">⏳ {item.reserved_qty} pending</p>}
                                                        </div>
                                                        {user.role !== 'MANAGER' && (
                                                            <button onClick={e => { e.stopPropagation(); handleStartEdit(item); }}
                                                                className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg active:scale-95">✏️ Edit</button>
                                                        )}
                                                        <button onClick={e => { e.stopPropagation(); fetchLog(item.qr_id); }}
                                                            className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg active:scale-95">📋 Log</button>
                                                        <button onClick={e => { e.stopPropagation(); router.push(`/inventory/${item.qr_id}/price-history`); }}
                                                            className="text-[9px] font-black text-violet-500 bg-violet-50 px-2 py-1 rounded-lg active:scale-95">💰 Harga</button>
                                                        {user.role === 'ADMIN' && (
                                                            <button onClick={e => { e.stopPropagation(); handleDelete(item); }}
                                                                disabled={deletingQr === item.qr_id}
                                                                className="text-[9px] font-black text-red-400 bg-red-50 px-2 py-1 rounded-lg active:scale-95 disabled:opacity-50">
                                                                {deletingQr === item.qr_id ? '...' : '🗑️'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${Number(item.available_qty) > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                                                            style={{ width: `${Math.min(100, (Number(item.available_qty) / Math.max(Number(item.stock_qty), 1)) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 mt-1 block">Stok fisik: {item.stock_qty} {item.unit}</span>
                                                </div>
                                                {logQr === item.qr_id && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">📋 Riwayat Adjustment Stok</p>
                                                        {loadingLog ? <p className="text-[10px] text-slate-400 animate-pulse py-2">Memuat...</p>
                                                            : logs.length === 0 ? <p className="text-[10px] text-slate-300 italic py-2">Belum ada perubahan stok.</p>
                                                                : (
                                                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                                                        {logs.map((log: any) => (
                                                                            <div key={log.id} className="flex justify-between items-start gap-2 bg-slate-50 rounded-xl p-2.5">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className={`text-[10px] font-black ${log.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{log.diff > 0 ? `+${log.diff}` : log.diff}</span>
                                                                                        <span className="text-[10px] text-slate-500">({log.stock_before} → {log.stock_after})</span>
                                                                                        {log.adjustment_type && (
                                                                                            <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full uppercase">{log.adjustment_type}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    {/* Input oleh siapa */}
                                                                                    {log.submitted_by && (
                                                                                        <p className="text-[9px] text-slate-500 mt-0.5">
                                                                                            ✏️ Diinput: <span className="font-bold">{log.submitted_by}</span>
                                                                                        </p>
                                                                                    )}
                                                                                    {/* Approve oleh siapa */}
                                                                                    <p className="text-[9px] text-slate-400">
                                                                                        {log.submitted_by ? '✅ Diapprove' : '👤'}: <span className="font-bold">{log.adjusted_by}</span>
                                                                                    </p>
                                                                                    {log.supplier && <p className="text-[9px] text-blue-500 font-bold">🏪 {log.supplier}</p>}
                                                                                    {log.note && <p className="text-[9px] text-slate-500 italic">"{log.note}"</p>}
                                                                                </div>
                                                                                <p className="text-[9px] text-slate-300 flex-shrink-0">{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <InventoryContent />
        </Suspense>
    );
}
