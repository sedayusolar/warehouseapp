'use client';
import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

function PenjualanContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [tab, setTab] = useState<'baru' | 'list'>('baru');

    // ── Form baru ──
    const [cart, setCart] = useState<any[]>([]);
    const [saleDate, setSaleDate] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [invoiceMode, setInvoiceMode] = useState<'picker' | 'manual'>('picker');
    const [showInvoicePicker, setShowInvoicePicker] = useState(false);
    const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
    const [invoiceResults, setInvoiceResults] = useState<any[]>([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceError, setInvoiceError] = useState('');
    const invoiceSearchTimeout = useRef<any>(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<any>(null);
    const [pendingItem, setPendingItem] = useState<any>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const [cameras, setCameras] = useState<{ id: string, label: string }[]>([]);
    const [cameraIndex, setCameraIndex] = useState(0);
    const [switchingCamera, setSwitchingCamera] = useState(false);
    const [scanLoading, setScanLoading] = useState(false);
    const html5QrRef = useRef<any>(null);

    // ── List ──
    const [listStatus, setListStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
    const [sales, setSales] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [detailSale, setDetailSale] = useState<any>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        setSaleDate(new Date().toISOString().slice(0, 10));
    }, []);

    useEffect(() => { if (tab === 'list') fetchSales(listStatus); }, [tab, listStatus]);

    const fetchSales = async (status: string) => {
        setLoadingList(true);
        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            const res = await fetch(`${BASE_URL}/get_sales_list.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setSales(r.data);
        } catch { }
        setLoadingList(false);
    };

    const openDetail = async (sale: any) => {
        setDetailSale(sale); setDetailItems([]); setLoadingDetail(true);
        try {
            const res = await fetch(`${BASE_URL}/get_sales_detail.php?id=${sale.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDetailItems(r.items);
        } catch { }
        setLoadingDetail(false);
    };

    const handleProcess = async (action: 'approve' | 'reject') => {
        if (!detailSale) return;
        if (action === 'reject' && !confirm(`Tolak penjualan ${detailSale.sale_code}?`)) return;
        setProcessingId(detailSale.id);
        try {
            const res = await fetch(`${BASE_URL}/approve_sales.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ id: detailSale.id, action, approved_by: user?.name || 'unknown' })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(r.message);
                setDetailSale(null);
                fetchSales(listStatus);
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setProcessingId(null);
    };

    const handleSearchInput = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.trim().length < 2) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${BASE_URL}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                const onlyProduk = (r.status === 'success' ? r.data : []).filter((it: any) => it.category === 'Produk');
                setSearchResults(onlyProduk);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 400);
    };

    const handleSelectSearch = (item: any) => {
        setSearchQuery(''); setSearchResults([]);
        setPendingItem(item);
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

    const closeScanner = () => {
        const scanner = html5QrRef.current;
        if (scanner) {
            scanner.stop().then(() => scanner.clear()).catch(() => { });
            html5QrRef.current = null;
        }
        setShowScanner(false);
    };

    const handleScanned = async (decodedText: string) => {
        closeScanner();
        setScanLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_item_by_qr.php?qr=${encodeURIComponent(decodedText)}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            const item = r?.data || r?.item;
            if (r.status !== 'success' || !item) {
                alert(`QR "${decodedText}" tidak ditemukan di inventory.`);
            } else if (item.category !== 'Produk') {
                alert(`"${item.item_name}" bukan kategori Produk (kategori: ${item.category}). Penjualan hanya untuk item Produk.`);
            } else {
                setPendingItem(item);
            }
        } catch {
            alert('Gagal ambil data produk. Cek koneksi.');
        }
        setScanLoading(false);
    };

    const startScannerWithCamera = async (camId: string) => {
        const Html5Qrcode = (window as any).Html5Qrcode;
        const Formats = (window as any).Html5QrcodeSupportedFormats;
        const scanner = new Html5Qrcode('penjualan-qr-reader', {
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
            camId,
            { fps: 10, qrbox: { width: 260, height: 160 } },
            (decodedText: string) => { handleScanned(decodedText); },
            () => { /* ignore per-frame no-match */ }
        );
    };

    const openScanner = async () => {
        setScannerError('');
        setShowScanner(true);
        try {
            await loadHtml5QrcodeScript();
            setTimeout(async () => {
                try {
                    const Html5Qrcode = (window as any).Html5Qrcode;
                    const devices = await Html5Qrcode.getCameras();
                    setCameras(devices || []);
                    let idx = (devices || []).findIndex((d: any) => /back|rear|belakang/i.test(d.label) && !/ultra|wide angle|tele/i.test(d.label));
                    if (idx < 0) idx = (devices || []).findIndex((d: any) => /back|rear|belakang/i.test(d.label));
                    if (idx < 0) idx = 0;
                    setCameraIndex(idx);
                    const camId = devices?.[idx]?.id;
                    await startScannerWithCamera(camId || { facingMode: 'environment' } as any);
                } catch {
                    setScannerError('Tidak bisa akses kamera. Pastikan izin kamera diizinkan, atau cari manual.');
                }
            }, 150);
        } catch {
            setScannerError('Gagal load scanner. Cek koneksi internet, atau cari manual.');
        }
    };

    const switchCamera = async () => {
        if (cameras.length < 2 || switchingCamera) return;
        setSwitchingCamera(true);
        try {
            const scanner = html5QrRef.current;
            if (scanner) { try { await scanner.stop(); await scanner.clear(); } catch { } }
            html5QrRef.current = null;
            const nextIdx = (cameraIndex + 1) % cameras.length;
            setCameraIndex(nextIdx);
            await startScannerWithCamera(cameras[nextIdx].id);
        } catch {
            setScannerError('Gagal ganti kamera.');
        }
        setSwitchingCamera(false);
    };

    const confirmLocation = (loc: any) => {
        if (!pendingItem) return;
        if (cart.find(i => i.qr_id === pendingItem.qr_id && String(i.location_id) === String(loc.location_id))) {
            alert(`${pendingItem.item_name} dari ${loc.location_name} sudah ada di list!`); return;
        }
        setCart(prev => [...prev, {
            qr_id: pendingItem.qr_id, name: pendingItem.item_name, unit: pendingItem.unit,
            qty: 1, available_qty: loc.available_qty ?? loc.stock_qty,
            location_id: loc.location_id, location_name: loc.location_name,
        }]);
        setPendingItem(null);
    };

    const fetchJurnalInvoices = async (q: string = '') => {
        setInvoiceLoading(true); setInvoiceError('');
        try {
            const from = new Date(); from.setMonth(from.getMonth() - 3);
            const params = new URLSearchParams({
                action: 'list_invoices', page: '1', per_page: '20',
                from_date: from.toISOString().split('T')[0],
                to_date: new Date().toISOString().split('T')[0],
            });
            if (q) params.set('search', q);
            const res = await fetch(`${BASE_URL}/jurnal_proxy.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            setInvoiceResults(r.sales_invoices || []);
        } catch {
            setInvoiceError('Gagal ambil data invoice dari Jurnal.');
            setInvoiceResults([]);
        }
        setInvoiceLoading(false);
    };

    const openInvoicePicker = () => {
        setShowInvoicePicker(true);
        setInvoiceSearchQuery('');
        fetchJurnalInvoices('');
    };

    const handleInvoiceSearchInput = (val: string) => {
        setInvoiceSearchQuery(val);
        if (invoiceSearchTimeout.current) clearTimeout(invoiceSearchTimeout.current);
        invoiceSearchTimeout.current = setTimeout(() => fetchJurnalInvoices(val), 400);
    };

    const selectInvoice = (inv: any) => {
        setInvoiceNo(inv.transaction_no);
        setCustomerName(inv.person?.display_name || '');
        setShowInvoicePicker(false);
    };

    const fmtInvoiceRp = (v: string | number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(parseFloat(String(v)) || 0);

    const handleSubmitSale = async () => {
        if (!saleDate || cart.length === 0) { alert("Tanggal dan minimal 1 produk wajib diisi!"); return; }
        for (const item of cart) {
            if (Number(item.qty) > Number(item.available_qty)) {
                alert(`❌ Qty ${item.name} melebihi stok tersedia (${item.available_qty})`); return;
            }
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/add_sales.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    jurnal_invoice_no: invoiceNo, customer_name: customerName, sale_date: saleDate,
                    staff_name: user?.name || 'unknown', note,
                    items: cart.map(i => ({ qr_id: i.qr_id, qty: i.qty, location_id: i.location_id }))
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(`✅ ${r.sale_code} berhasil disubmit! Menunggu approval Manager.`);
                setCart([]); setCustomerName(''); setInvoiceNo(''); setNote('');
                setSaleDate(new Date().toISOString().slice(0, 10));
                setTab('list'); setListStatus('PENDING');
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setSubmitting(false);
    };

    const statusColor = (s: string) => {
        switch (s) {
            case 'APPROVED': return 'text-emerald-600 bg-emerald-50';
            case 'PENDING': return 'text-orange-500 bg-orange-50';
            case 'REJECTED': return 'text-red-500 bg-red-50';
            default: return 'text-slate-500 bg-slate-50';
        }
    };

    if (!user) return null;
    const canApprove = user.role === 'ADMIN' || user.role === 'MANAGER';

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900">
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setTab('baru')}
                        className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${tab === 'baru' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>
                        🛒 Penjualan Baru
                    </button>
                    <button onClick={() => setTab('list')}
                        className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${tab === 'list' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>
                        📋 Riwayat
                    </button>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">
                {tab === 'baru' && (
                    <>
                        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cari Produk</p>
                            <div className="flex gap-2">
                                <input type="text" value={searchQuery} onChange={e => handleSearchInput(e.target.value)}
                                    placeholder="Ketik nama produk / QR code..."
                                    className="flex-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <button type="button" onClick={openScanner} disabled={scanLoading}
                                    className="px-4 bg-violet-600 text-white font-black text-xs rounded-xl active:scale-95 transition-all flex-shrink-0 disabled:opacity-50">
                                    {scanLoading ? '...' : '📷 Scan'}
                                </button>
                            </div>
                            {searching && <p className="text-center text-xs text-slate-400 animate-pulse py-2">Mencari...</p>}
                            {!searching && searchResults.length > 0 && (
                                <div className="bg-slate-50 rounded-2xl overflow-hidden divide-y divide-white max-h-64 overflow-y-auto">
                                    {searchResults.map((item: any) => (
                                        <button key={item.qr_id} onClick={() => handleSelectSearch(item)} className="w-full text-left p-3.5 hover:bg-blue-50">
                                            <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                                <p className="text-center text-xs text-slate-300 italic py-2">Produk tidak ditemukan.</p>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produk Dijual ({cart.length})</p>
                                {cart.map((item, idx) => {
                                    const over = Number(item.qty) > Number(item.available_qty);
                                    return (
                                        <div key={idx} className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 ${over ? 'border-l-red-400' : 'border-l-violet-500'}`}>
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                    <p className="text-[10px] text-slate-400">📍 {item.location_name} · Tersedia: {item.available_qty} {item.unit}</p>
                                                    {over && <p className="text-[10px] font-black text-red-500 mt-1">⚠️ Melebihi stok tersedia</p>}
                                                </div>
                                                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                                    <input type="number" min="1" value={item.qty}
                                                        onChange={e => { const nc = [...cart]; nc[idx].qty = Number(e.target.value); setCart(nc); }}
                                                        className={`w-14 text-center border-2 rounded-lg font-black py-1 ${over ? 'border-red-400 text-red-500' : 'border-slate-200 text-blue-600'}`} />
                                                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-300 font-black text-xs">✕ Hapus</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {cart.length > 0 && (
                            <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanggal Penjualan *</label>
                                    <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                                        className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nama Customer (opsional)</label>
                                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                                        placeholder="PT Mulya Adhi Paramita..."
                                        className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-violet-500 uppercase ml-1">No. Invoice Jurnal (opsional)</label>
                                    {invoiceMode === 'picker' ? (
                                        <>
                                            <button type="button" onClick={openInvoicePicker}
                                                className="w-full mt-1 p-3.5 bg-violet-50 border border-violet-200 rounded-xl text-left font-mono font-bold text-slate-700 flex justify-between items-center">
                                                <span className={invoiceNo ? 'text-slate-700' : 'text-slate-400 font-sans font-medium'}>
                                                    {invoiceNo || 'Pilih invoice dari Jurnal...'}
                                                </span>
                                                <span className="text-violet-500 text-xs">🔍 Cari</span>
                                            </button>
                                            <p className="text-[9px] text-slate-400 mt-1 ml-1">
                                                Nama customer otomatis terisi kalau pilih invoice.{' '}
                                                <button type="button" onClick={() => setInvoiceMode('manual')} className="underline text-violet-500">Ketik manual</button>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                                                placeholder="SDUH/INV/2026/1085"
                                                className="w-full mt-1 p-3.5 bg-violet-50 border border-violet-200 rounded-xl outline-none font-mono font-bold text-slate-700" />
                                            <p className="text-[9px] text-slate-400 mt-1 ml-1">
                                                Copy dari "Transaction no." di Jurnal.{' '}
                                                <button type="button" onClick={() => setInvoiceMode('picker')} className="underline text-violet-500">Pilih dari Jurnal</button>
                                            </p>
                                        </>
                                    )}
                                </div>
                                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                                    placeholder="Catatan (opsional)..."
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <button onClick={handleSubmitSale} disabled={submitting}
                                    className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                    {submitting ? 'Menyimpan...' : '✓ Submit ke Manager'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {tab === 'list' && (
                    <>
                        <div className="flex gap-2">
                            {(['PENDING', 'APPROVED', 'REJECTED', ''] as const).map(s => (
                                <button key={s} onClick={() => setListStatus(s)}
                                    className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${listStatus === s ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>
                                    {s || 'Semua'}
                                </button>
                            ))}
                        </div>
                        {loadingList ? (
                            <p className="text-center py-16 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Memuat...</p>
                        ) : sales.length === 0 ? (
                            <p className="text-center py-16 text-slate-300 italic text-sm">Belum ada penjualan.</p>
                        ) : sales.map((s: any) => (
                            <button key={s.id} onClick={() => openDetail(s)}
                                className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all active:scale-[0.99]">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusColor(s.manager_approval_status)}`}>{s.manager_approval_status}</span>
                                            <span className="text-[10px] font-mono text-slate-400">{s.sale_code}</span>
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 mt-1">{s.customer_name || '(Tanpa nama customer)'}</p>
                                        <p className="text-[10px] text-slate-400">{s.total_items} item · {s.sale_date} · by {s.staff_name}</p>
                                        {s.jurnal_invoice_no && <p className="text-[10px] text-violet-500 font-mono mt-0.5">📄 {s.jurnal_invoice_no}</p>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>

            {/* JURNAL INVOICE PICKER MODAL */}
            {showInvoicePicker && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col" onClick={() => setShowInvoicePicker(false)}>
                    <div className="mt-16 flex-1 bg-white rounded-t-3xl p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-sm text-slate-800">📄 Pilih Invoice Jurnal</h3>
                            <button onClick={() => setShowInvoicePicker(false)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        <input type="text" value={invoiceSearchQuery} onChange={e => handleInvoiceSearchInput(e.target.value)}
                            placeholder="Cari no. invoice / nama customer..."
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 mb-3" />
                        <p className="text-[9px] text-slate-400 mb-3">Menampilkan invoice 3 bulan terakhir. Ketik buat cari lebih spesifik.</p>

                        {invoiceLoading && <p className="text-center text-xs text-slate-400 animate-pulse py-6">Memuat dari Jurnal...</p>}
                        {invoiceError && <p className="text-center text-xs text-red-500 py-6">{invoiceError}</p>}
                        {!invoiceLoading && !invoiceError && invoiceResults.length === 0 && (
                            <p className="text-center text-xs text-slate-300 italic py-6">Tidak ada invoice ditemukan.</p>
                        )}
                        <div className="space-y-2">
                            {invoiceResults.map((inv: any) => (
                                <button key={inv.id} onClick={() => selectInvoice(inv)}
                                    className="w-full text-left bg-slate-50 hover:bg-violet-50 rounded-2xl p-3.5 transition-all active:scale-[0.99]">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-mono font-black text-xs text-violet-600">{inv.transaction_no}</p>
                                            <p className="font-bold text-sm text-slate-800 truncate mt-0.5">{inv.person?.display_name || '—'}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{inv.transaction_date} · {inv.transaction_status?.name}</p>
                                        </div>
                                        <p className="font-black text-sm text-slate-900 flex-shrink-0">{fmtInvoiceRp(inv.original_amount)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button type="button" onClick={() => { setInvoiceMode('manual'); setShowInvoicePicker(false); }}
                            className="w-full mt-4 text-center text-xs text-slate-400 underline py-2">
                            Gak ketemu? Ketik manual aja
                        </button>
                    </div>
                </div>
            )}

            {/* SCANNER MODAL */}
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
                            <div id="penjualan-qr-reader" className="w-full rounded-2xl overflow-hidden bg-slate-900" />
                        )}
                        {cameras.length > 1 && !scannerError && (
                            <button onClick={switchCamera} disabled={switchingCamera}
                                className="w-full bg-slate-100 text-slate-600 font-black text-xs py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50">
                                {switchingCamera ? 'Mengganti...' : `🔄 Ganti Kamera (${cameraIndex + 1}/${cameras.length})`}
                            </button>
                        )}
                        {cameras[cameraIndex]?.label && !scannerError && (
                            <p className="text-[9px] text-slate-300 text-center truncate">{cameras[cameraIndex].label}</p>
                        )}
                        <p className="text-[10px] text-slate-400 text-center">Arahkan kamera ke QR code atau barcode produk.</p>
                    </div>
                </div>
            )}

            {/* LOCATION PICKER MODAL */}
            {pendingItem && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4" onClick={() => setPendingItem(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Lokasi</p>
                            <p className="font-bold text-slate-800 mt-1">{pendingItem.item_name}</p>
                        </div>
                        <div className="space-y-2">
                            {pendingItem.locations?.map((loc: any) => (
                                <button key={loc.location_id} onClick={() => confirmLocation(loc)}
                                    disabled={(loc.available_qty ?? loc.stock_qty) <= 0}
                                    className={`w-full flex justify-between items-center p-4 rounded-2xl border-2 transition-all active:scale-95
                                        ${(loc.available_qty ?? loc.stock_qty) > 0 ? 'border-slate-200 hover:border-violet-400 hover:bg-violet-50' : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'}`}>
                                    <p className="font-bold text-sm text-slate-800">📍 {loc.location_name}</p>
                                    <p className={`font-black text-lg ${(loc.available_qty ?? loc.stock_qty) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{loc.available_qty ?? loc.stock_qty}</p>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setPendingItem(null)} className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">Batal</button>
                    </div>
                </div>
            )}

            {/* DETAIL / APPROVAL MODAL */}
            {detailSale && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => setDetailSale(null)}>
                    <div className="flex-1 overflow-y-auto mt-16" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-28 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusColor(detailSale.manager_approval_status)}`}>{detailSale.manager_approval_status}</span>
                                    <h2 className="font-black text-lg text-slate-900 mt-1">{detailSale.sale_code}</h2>
                                    <p className="text-xs text-slate-500">{detailSale.customer_name || '(Tanpa nama customer)'} · {detailSale.sale_date}</p>
                                    {detailSale.jurnal_invoice_no && <p className="text-[10px] text-violet-500 font-mono mt-1">📄 {detailSale.jurnal_invoice_no}</p>}
                                    <p className="text-[10px] text-slate-400 mt-0.5">Staff: {detailSale.staff_name}</p>
                                    {detailSale.approved_by && <p className="text-[10px] text-slate-400">{detailSale.manager_approval_status === 'REJECTED' ? 'Ditolak' : 'Disetujui'} oleh: {detailSale.approved_by}</p>}
                                    {detailSale.rejected_reason && <p className="text-[10px] text-red-400 italic mt-0.5">"{detailSale.rejected_reason}"</p>}
                                </div>
                                <button onClick={() => setDetailSale(null)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {loadingDetail ? (
                                <p className="text-center text-slate-400 animate-pulse py-10">Memuat...</p>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Item ({detailItems.length})</p>
                                    {detailItems.map((it: any) => (
                                        <div key={it.id} className="bg-slate-50 rounded-xl p-3.5">
                                            <p className="font-bold text-sm text-slate-800">{it.item_name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{it.qr_id}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <p className="text-[10px] text-slate-500">📍 {it.location_name} · Qty: <span className="font-bold">{it.qty} {it.unit}</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {canApprove && detailSale.manager_approval_status === 'PENDING' && (
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => handleProcess('reject')} disabled={processingId === detailSale.id}
                                        className="flex-1 bg-red-50 text-red-500 font-black py-4 rounded-2xl text-xs uppercase disabled:opacity-50">
                                        ✕ Tolak
                                    </button>
                                    <button onClick={() => handleProcess('approve')} disabled={processingId === detailSale.id}
                                        className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {processingId === detailSale.id ? '...' : '✓ Approve & Potong Stok'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Navbar />
        </main>
    );
}

export default function PenjualanPage() {
    return <PenjualanContent />;
}
