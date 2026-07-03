'use client';
import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const STATUS_LABEL: Record<string, string> = {
    PENDING_SURAT_JALAN: 'Pending Surat Jalan',
    REJECTED_SURAT_JALAN: 'Ditolak (Surat Jalan)',
    SURAT_JALAN_TERBIT: 'Surat Jalan Terbit',
    PENDING_KELUAR_GUDANG: 'Pending Keluar Gudang',
    REJECTED_KELUAR_GUDANG: 'Ditolak (Keluar Gudang)',
    BARANG_KELUAR: 'Barang Keluar',
};
const STATUS_COLOR: Record<string, string> = {
    PENDING_SURAT_JALAN: 'text-orange-500 bg-orange-50',
    REJECTED_SURAT_JALAN: 'text-red-500 bg-red-50',
    SURAT_JALAN_TERBIT: 'text-blue-600 bg-blue-50',
    PENDING_KELUAR_GUDANG: 'text-amber-600 bg-amber-50',
    REJECTED_KELUAR_GUDANG: 'text-red-500 bg-red-50',
    BARANG_KELUAR: 'text-emerald-600 bg-emerald-50',
};

// ── Signature pad (canvas free-draw) ──
function SigCanvas({ canvasRef, onDraw }: { canvasRef: React.RefObject<HTMLCanvasElement | null>, onDraw: () => void }) {
    const drawingRef = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    const getPos = (e: any) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };
    const start = (e: any) => { e.preventDefault(); drawingRef.current = true; lastPos.current = getPos(e); };
    const move = (e: any) => {
        if (!drawingRef.current) return;
        e.preventDefault();
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e);
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lastPos.current!.x, lastPos.current!.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        lastPos.current = pos;
        onDraw();
    };
    const end = () => { drawingRef.current = false; };

    return (
        <canvas ref={canvasRef} width={300} height={120}
            className="w-full bg-slate-50 rounded-xl border-2 border-slate-200 touch-none"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
    );
}

function DeliveryOrderContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [tab, setTab] = useState<'baru' | 'list'>('baru');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [doDate, setDoDate] = useState('');
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
    const [scanLoading, setScanLoading] = useState(false);
    const [cameras, setCameras] = useState<{ id: string, label: string }[]>([]);
    const [cameraIndex, setCameraIndex] = useState(0);
    const [switchingCamera, setSwitchingCamera] = useState(false);
    const html5QrRef = useRef<any>(null);
    const scanModeRef = useRef<'cart' | 'verify'>('cart');

    const [listStatus, setListStatus] = useState<string>('PENDING_SURAT_JALAN');
    const [dos, setDos] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [detailDO, setDetailDO] = useState<any>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectingStage, setRejectingStage] = useState<1 | 2 | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const [showVerify, setShowVerify] = useState(false);
    const [verifyItems, setVerifyItems] = useState<any[]>([]);
    const [verifiedBy, setVerifiedBy] = useState('');
    const [driverName, setDriverName] = useState('');
    const [warehouseStaffName, setWarehouseStaffName] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [hasDriverSig, setHasDriverSig] = useState(false);
    const [hasStaffSig, setHasStaffSig] = useState(false);
    const [hasRecvSig, setHasRecvSig] = useState(false);
    const driverCanvasRef = useRef<HTMLCanvasElement>(null);
    const staffCanvasRef = useRef<HTMLCanvasElement>(null);
    const recvCanvasRef = useRef<HTMLCanvasElement>(null);
    const [verifySubmitting, setVerifySubmitting] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setUser(JSON.parse(u));
        setDoDate(new Date().toISOString().slice(0, 10));
    }, []);

    useEffect(() => { if (tab === 'list') fetchDOs(listStatus); }, [tab, listStatus]);

    const fetchDOs = async (status: string) => {
        setLoadingList(true);
        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            const res = await fetch(`${BASE_URL}/get_do_list.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setDos(r.data);
        } catch { }
        setLoadingList(false);
    };

    const openDetail = async (item: any) => {
        setDetailDO(item); setDetailItems([]); setLoadingDetail(true);
        try {
            const res = await fetch(`${BASE_URL}/get_do_detail.php?id=${item.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') { setDetailDO(r.header); setDetailItems(r.items); }
        } catch { }
        setLoadingDetail(false);
    };

    const handleApproveSJ = async (action: 'approve' | 'reject', reason?: string) => {
        if (!detailDO) return;
        setProcessingId(detailDO.id);
        try {
            const res = await fetch(`${BASE_URL}/approve_surat_jalan.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ id: detailDO.id, action, approved_by: user?.name || 'unknown', reason })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(r.message); setDetailDO(null); setRejectingStage(null); setRejectReason(''); fetchDOs(listStatus); }
            else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setProcessingId(null);
    };

    const handleApproveKeluar = async (action: 'approve' | 'reject', reason?: string) => {
        if (!detailDO) return;
        setProcessingId(detailDO.id);
        try {
            const res = await fetch(`${BASE_URL}/approve_keluar_gudang.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ id: detailDO.id, action, approved_by: user?.name || 'unknown', reason })
            });
            const r = await res.json();
            if (r.status === 'success') { alert(r.message); setDetailDO(null); setRejectingStage(null); setRejectReason(''); fetchDOs(listStatus); }
            else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setProcessingId(null);
    };

    const startEdit = () => {
        if (!detailDO) return;
        setEditingId(detailDO.id);
        setCart(detailItems.map((it: any) => ({
            qr_id: it.qr_id, name: it.item_name, unit: it.unit, qty: it.qty,
            available_qty: it.qty,
            location_id: it.location_id, location_name: it.location_name,
        })));
        setDoDate(detailDO.do_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
        setCustomerName(detailDO.customer_name || '');
        setInvoiceNo(detailDO.jurnal_invoice_no || '');
        setInvoiceMode('manual');
        setNote(detailDO.note || '');
        setDetailDO(null);
        setTab('baru');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setCart([]); setCustomerName(''); setInvoiceNo(''); setNote('');
        setInvoiceMode('picker');
        setDoDate(new Date().toISOString().slice(0, 10));
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

    const handleSelectSearch = (item: any) => { setSearchQuery(''); setSearchResults([]); setPendingItem(item); };

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
                action: 'list_sales_orders', page: '1', per_page: '20',
                from_date: from.toISOString().split('T')[0],
                to_date: new Date().toISOString().split('T')[0],
            });
            if (q) params.set('search', q);
            const res = await fetch(`${BASE_URL}/jurnal_proxy.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            setInvoiceResults(r.sales_orders || []);
        } catch { setInvoiceError('Gagal ambil data Sales Order dari Jurnal.'); setInvoiceResults([]); }
        setInvoiceLoading(false);
    };
    const openInvoicePicker = () => { setShowInvoicePicker(true); setInvoiceSearchQuery(''); fetchJurnalInvoices(''); };
    const handleInvoiceSearchInput = (val: string) => {
        setInvoiceSearchQuery(val);
        if (invoiceSearchTimeout.current) clearTimeout(invoiceSearchTimeout.current);
        invoiceSearchTimeout.current = setTimeout(() => fetchJurnalInvoices(val), 400);
    };
    const selectInvoice = (inv: any) => { setInvoiceNo(inv.transaction_no); setCustomerName(inv.person?.display_name || ''); setShowInvoicePicker(false); };
    const fmtInvoiceRp = (v: string | number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(parseFloat(String(v)) || 0);

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
        if (scanner) { scanner.stop().then(() => scanner.clear()).catch(() => { }); html5QrRef.current = null; }
        setShowScanner(false);
    };

    const handleScannedForCart = async (decodedText: string) => {
        closeScanner();
        setScanLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_item_by_qr.php?qr=${encodeURIComponent(decodedText)}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            const item = r?.data;
            if (r.status !== 'success' || !item) alert(`QR "${decodedText}" tidak ditemukan di inventory.`);
            else if (item.category !== 'Produk') alert(`"${item.item_name}" bukan kategori Produk.`);
            else setPendingItem(item);
        } catch { alert('Gagal ambil data produk. Cek koneksi.'); }
        setScanLoading(false);
    };

    const handleScannedForVerify = (decodedText: string) => {
        setVerifyItems(prev => {
            const idx = prev.findIndex(it => it.qr_id === decodedText && !it.scanned);
            if (idx < 0) {
                const alreadyDone = prev.some(it => it.qr_id === decodedText && it.scanned);
                alert(alreadyDone ? `Item ini udah discan sebelumnya.` : `Barang "${decodedText}" tidak ada di DO ini.`);
                return prev;
            }
            const next = [...prev];
            next[idx] = { ...next[idx], scanned: true };
            return next;
        });
        closeScanner();
    };

    const startScannerWithCamera = async (camId: string) => {
        const Html5Qrcode = (window as any).Html5Qrcode;
        const Formats = (window as any).Html5QrcodeSupportedFormats;
        const scanner = new Html5Qrcode('do-qr-reader', {
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
            (decodedText: string) => {
                if (scanModeRef.current === 'verify') handleScannedForVerify(decodedText);
                else handleScannedForCart(decodedText);
            },
            () => { }
        );
    };

    const openScanner = async (mode: 'cart' | 'verify' = 'cart') => {
        scanModeRef.current = mode;
        setScannerError(''); setShowScanner(true);
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
                    setScannerError('Tidak bisa akses kamera. Pastikan izin kamera diizinkan.');
                }
            }, 150);
        } catch {
            setScannerError('Gagal load scanner. Cek koneksi internet.');
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
        } catch { setScannerError('Gagal ganti kamera.'); }
        setSwitchingCamera(false);
    };

    const handleSubmitDO = async () => {
        if (!doDate || cart.length === 0) { alert("Tanggal dan minimal 1 produk wajib diisi!"); return; }
        for (const item of cart) {
            if (Number(item.qty) > Number(item.available_qty)) {
                alert(`❌ Qty ${item.name} melebihi stok tersedia (${item.available_qty})`); return;
            }
        }
        setSubmitting(true);
        try {
            const payload = {
                jurnal_invoice_no: invoiceNo, customer_name: customerName, do_date: doDate, note,
                items: cart.map(i => ({ qr_id: i.qr_id, qty: i.qty, location_id: i.location_id }))
            };
            const url = editingId ? `${BASE_URL}/edit_do.php` : `${BASE_URL}/add_do.php`;
            const body = editingId ? { ...payload, id: editingId } : { ...payload, staff_name: user?.name || 'unknown' };
            const res = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify(body)
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(`✅ ${r.do_code || 'DO'} ${editingId ? 'berhasil direvisi' : 'berhasil disubmit'}! Menunggu approval Manager.`);
                cancelEdit();
                setTab('list'); setListStatus('PENDING_SURAT_JALAN');
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setSubmitting(false);
    };

    const openVerify = () => {
        if (!detailDO) return;
        setVerifyItems(detailItems.map((it: any) => ({ ...it, scanned: false })));
        setVerifiedBy(user?.name || '');
        setDriverName(''); setWarehouseStaffName(''); setRecipientName('');
        setHasDriverSig(false); setHasStaffSig(false); setHasRecvSig(false);
        setShowVerify(true);
    };

    const clearCanvas = (ref: React.RefObject<HTMLCanvasElement | null>, setHas: (v: boolean) => void) => {
        const ctx = ref.current?.getContext('2d');
        if (ctx && ref.current) ctx.clearRect(0, 0, ref.current.width, ref.current.height);
        setHas(false);
    };

    const submitVerify = async () => {
        const unscanned = verifyItems.filter(it => !it.scanned);
        if (unscanned.length > 0) { alert(`Masih ada ${unscanned.length} item belum discan!`); return; }
        if (!verifiedBy || !driverName || !warehouseStaffName || !recipientName) { alert('Nama verifikator, Sopir, Staff Gudang, dan Penerima wajib diisi!'); return; }
        if (!hasDriverSig || !hasStaffSig || !hasRecvSig) { alert('Semua TTD (Sopir, Staff Gudang, Penerima) wajib diisi!'); return; }
        setVerifySubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/verify_do.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    id: detailDO.id, verified_by: verifiedBy,
                    scanned_qr_ids: verifyItems.map(it => it.qr_id),
                    driver_name: driverName, driver_sig: driverCanvasRef.current?.toDataURL('image/png'),
                    warehouse_staff_name: warehouseStaffName, warehouse_staff_sig: staffCanvasRef.current?.toDataURL('image/png'),
                    recipient_name: recipientName, recipient_sig: recvCanvasRef.current?.toDataURL('image/png'),
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(r.message);
                setShowVerify(false); setDetailDO(null);
                fetchDOs(listStatus);
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setVerifySubmitting(false);
    };

    const printDO = (id: number) => {
        window.open(`https://sedayu.com/api/warehouse/print_do.html?id=${id}`, '_blank');
    };

    if (!user) return null;
    const isManager = user.role === 'MANAGER' || user.role === 'ADMIN';

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900">
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setTab('baru')}
                        className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${tab === 'baru' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>
                        📄 {editingId ? 'Revisi DO' : 'DO Baru'}
                    </button>
                    <button onClick={() => { setTab('list'); if (editingId) cancelEdit(); }}
                        className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${tab === 'list' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>
                        📋 Riwayat
                    </button>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">
                {tab === 'baru' && (
                    <>
                        {editingId && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex justify-between items-center">
                                <p className="text-xs text-red-600 font-bold">✏️ Mode revisi DO yang ditolak</p>
                                <button onClick={cancelEdit} className="text-[10px] font-black text-red-500 uppercase">Batal</button>
                            </div>
                        )}
                        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cari Produk</p>
                            <div className="flex gap-2">
                                <input type="text" value={searchQuery} onChange={e => handleSearchInput(e.target.value)}
                                    placeholder="Ketik nama produk / QR code..."
                                    className="flex-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <button type="button" onClick={() => openScanner('cart')} disabled={scanLoading}
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
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Barang Keluar ({cart.length})</p>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanggal DO *</label>
                                    <input type="date" value={doDate} onChange={e => setDoDate(e.target.value)}
                                        className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nama Customer (opsional)</label>
                                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                                        placeholder="PT Mulya Adhi Paramita..."
                                        className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-violet-500 uppercase ml-1">No. Sales Order (SO) Jurnal (opsional)</label>
                                    {invoiceMode === 'picker' ? (
                                        <>
                                            <button type="button" onClick={openInvoicePicker}
                                                className="w-full mt-1 p-3.5 bg-violet-50 border border-violet-200 rounded-xl text-left font-mono font-bold text-slate-700 flex justify-between items-center">
                                                <span className={invoiceNo ? 'text-slate-700' : 'text-slate-400 font-sans font-medium'}>
                                                    {invoiceNo || 'Pilih Sales Order dari Jurnal...'}
                                                </span>
                                                <span className="text-violet-500 text-xs">🔍 Cari</span>
                                            </button>
                                            <p className="text-[9px] text-slate-400 mt-1 ml-1">
                                                Nama customer otomatis terisi kalau pilih SO.{' '}
                                                <button type="button" onClick={() => setInvoiceMode('manual')} className="underline text-violet-500">Ketik manual</button>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                                                placeholder="No. Sales Order dari Jurnal"
                                                className="w-full mt-1 p-3.5 bg-violet-50 border border-violet-200 rounded-xl outline-none font-mono font-bold text-slate-700" />
                                            <p className="text-[9px] text-slate-400 mt-1 ml-1">
                                                Copy dari "Transaction no." di Sales Order Jurnal.{' '}
                                                <button type="button" onClick={() => setInvoiceMode('picker')} className="underline text-violet-500">Pilih dari Jurnal</button>
                                            </p>
                                        </>
                                    )}
                                </div>
                                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                                    placeholder="Catatan (opsional)..."
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <button onClick={handleSubmitDO} disabled={submitting}
                                    className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                    {submitting ? 'Menyimpan...' : editingId ? '✓ Kirim Revisi ke Manager' : '✓ Submit ke Manager'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {tab === 'list' && (
                    <>
                        <div className="grid grid-cols-3 gap-1.5">
                            {Object.keys(STATUS_LABEL).map(s => (
                                <button key={s} onClick={() => setListStatus(s)}
                                    className={`py-2 rounded-xl font-black text-[8px] uppercase tracking-wide transition-all ${listStatus === s ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>
                                    {STATUS_LABEL[s]}
                                </button>
                            ))}
                        </div>
                        {loadingList ? (
                            <p className="text-center py-16 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Memuat...</p>
                        ) : dos.length === 0 ? (
                            <p className="text-center py-16 text-slate-300 italic text-sm">Belum ada DO di status ini.</p>
                        ) : dos.map((d: any) => (
                            <button key={d.id} onClick={() => openDetail(d)}
                                className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all active:scale-[0.99]">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${STATUS_COLOR[d.do_status]}`}>{STATUS_LABEL[d.do_status]}</span>
                                            <span className="text-[10px] font-mono text-slate-400">{d.do_code}</span>
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 mt-1">{d.customer_name || '(Tanpa nama customer)'}</p>
                                        <p className="text-[10px] text-slate-400">{d.total_items} item · {d.do_date} · by {d.staff_name}</p>
                                        {d.jurnal_invoice_no && <p className="text-[10px] text-violet-500 font-mono mt-0.5">📄 {d.jurnal_invoice_no}</p>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>

            {showInvoicePicker && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col" onClick={() => setShowInvoicePicker(false)}>
                    <div className="mt-16 flex-1 bg-white rounded-t-3xl p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-sm text-slate-800">📄 Pilih Sales Order Jurnal</h3>
                            <button onClick={() => setShowInvoicePicker(false)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        <input type="text" value={invoiceSearchQuery} onChange={e => handleInvoiceSearchInput(e.target.value)}
                            placeholder="Cari no. SO / nama customer..."
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 mb-3" />
                        <p className="text-[9px] text-slate-400 mb-3">Menampilkan Sales Order 3 bulan terakhir. Ketik buat cari lebih spesifik.</p>
                        {invoiceLoading && <p className="text-center text-xs text-slate-400 animate-pulse py-6">Memuat dari Jurnal...</p>}
                        {invoiceError && <p className="text-center text-xs text-red-500 py-6">{invoiceError}</p>}
                        {!invoiceLoading && !invoiceError && invoiceResults.length === 0 && (
                            <p className="text-center text-xs text-slate-300 italic py-6">Tidak ada Sales Order ditemukan.</p>
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

            {showScanner && (
                <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center p-5">
                    <div className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-sm text-slate-800">📷 Scan QR / Barcode</h3>
                            <button onClick={closeScanner} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        {scannerError ? (
                            <p className="text-xs text-red-500 font-medium py-6 text-center">{scannerError}</p>
                        ) : (
                            <div id="do-qr-reader" className="w-full rounded-2xl overflow-hidden bg-slate-900" />
                        )}
                        {cameras.length > 1 && !scannerError && (
                            <button onClick={switchCamera} disabled={switchingCamera}
                                className="w-full bg-slate-100 text-slate-600 font-black text-xs py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50">
                                {switchingCamera ? 'Mengganti...' : `🔄 Ganti Kamera (${cameraIndex + 1}/${cameras.length})`}
                            </button>
                        )}
                        <p className="text-[10px] text-slate-400 text-center">
                            {scanModeRef.current === 'verify' ? 'Scan tiap barang buat verifikasi sesuai DO.' : 'Arahkan kamera ke QR code atau barcode produk.'}
                        </p>
                    </div>
                </div>
            )}

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

            {showVerify && detailDO && (
                <div className="fixed inset-0 z-[65] bg-black/60 flex flex-col" onClick={() => setShowVerify(false)}>
                    <div className="mt-10 flex-1 bg-white rounded-t-3xl p-5 pb-10 overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-sm text-slate-800">✅ Verifikasi & TTD — {detailDO.do_code}</h3>
                            <button onClick={() => setShowVerify(false)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>

                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Scan Barang ({verifyItems.filter(i => i.scanned).length}/{verifyItems.length})</p>
                            <div className="space-y-1.5">
                                {verifyItems.map((it: any) => (
                                    <div key={it.id} className={`flex items-center justify-between p-3 rounded-xl ${it.scanned ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">{it.item_name}</p>
                                            <p className="text-[9px] text-slate-400 font-mono">{it.qr_id} · Qty: {it.qty} {it.unit}</p>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0 ${it.scanned ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            {it.scanned ? '✓ Discan' : 'Belum'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => openScanner('verify')}
                                className="w-full mt-2 bg-violet-600 text-white font-black text-xs py-3 rounded-xl active:scale-95">
                                📷 Scan Barang
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nama Verifikator (Staff Gudang) *</label>
                            <input type="text" value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)}
                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">TTD Sopir *</label>
                            <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Nama Sopir"
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            <SigCanvas canvasRef={driverCanvasRef} onDraw={() => setHasDriverSig(true)} />
                            <button onClick={() => clearCanvas(driverCanvasRef, setHasDriverSig)} className="text-[10px] text-red-400 underline">Hapus TTD</button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">TTD Staff Gudang *</label>
                            <input type="text" value={warehouseStaffName} onChange={e => setWarehouseStaffName(e.target.value)} placeholder="Nama Staff Gudang"
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            <SigCanvas canvasRef={staffCanvasRef} onDraw={() => setHasStaffSig(true)} />
                            <button onClick={() => clearCanvas(staffCanvasRef, setHasStaffSig)} className="text-[10px] text-red-400 underline">Hapus TTD</button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">TTD Penerima *</label>
                            <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nama Penerima"
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            <SigCanvas canvasRef={recvCanvasRef} onDraw={() => setHasRecvSig(true)} />
                            <button onClick={() => clearCanvas(recvCanvasRef, setHasRecvSig)} className="text-[10px] text-red-400 underline">Hapus TTD</button>
                        </div>

                        <button onClick={submitVerify} disabled={verifySubmitting}
                            className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                            {verifySubmitting ? 'Menyimpan...' : '✓ Submit ke Manager (Barang Keluar)'}
                        </button>
                    </div>
                </div>
            )}

            {rejectingStage && (
                <div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-4" onClick={() => setRejectingStage(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-sm text-slate-800">Alasan Penolakan</h3>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Kenapa DO ini ditolak?" rows={3}
                            className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                        <div className="flex gap-2">
                            <button onClick={() => setRejectingStage(null)} className="flex-1 bg-slate-100 text-slate-500 font-black py-3 rounded-xl text-xs uppercase">Batal</button>
                            <button
                                onClick={() => rejectingStage === 1 ? handleApproveSJ('reject', rejectReason) : handleApproveKeluar('reject', rejectReason)}
                                disabled={processingId === detailDO?.id}
                                className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl text-xs uppercase disabled:opacity-50">
                                {processingId === detailDO?.id ? '...' : 'Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detailDO && !showVerify && !rejectingStage && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => setDetailDO(null)}>
                    <div className="flex-1 overflow-y-auto mt-16" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-28 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${STATUS_COLOR[detailDO.do_status]}`}>{STATUS_LABEL[detailDO.do_status]}</span>
                                    <h2 className="font-black text-lg text-slate-900 mt-1">{detailDO.do_code}</h2>
                                    <p className="text-xs text-slate-500">{detailDO.customer_name || '(Tanpa nama customer)'} · {detailDO.do_date}</p>
                                    {detailDO.jurnal_invoice_no && <p className="text-[10px] text-violet-500 font-mono mt-1">📄 {detailDO.jurnal_invoice_no}</p>}
                                    <p className="text-[10px] text-slate-400 mt-0.5">Sales: {detailDO.staff_name}</p>
                                    {detailDO.sj_approved_by && <p className="text-[10px] text-slate-400">Surat Jalan disetujui: {detailDO.sj_approved_by}</p>}
                                    {detailDO.verified_by && <p className="text-[10px] text-slate-400">Diverifikasi: {detailDO.verified_by} (Sopir: {detailDO.driver_name}, Penerima: {detailDO.recipient_name})</p>}
                                    {detailDO.final_approved_by && <p className="text-[10px] text-slate-400">Barang keluar disetujui: {detailDO.final_approved_by}</p>}
                                    {detailDO.rejected_reason_1 && <p className="text-[10px] text-red-400 italic mt-0.5">Alasan tolak (Surat Jalan): "{detailDO.rejected_reason_1}"</p>}
                                    {detailDO.rejected_reason_2 && <p className="text-[10px] text-red-400 italic mt-0.5">Alasan tolak (Keluar Gudang): "{detailDO.rejected_reason_2}"</p>}
                                </div>
                                <button onClick={() => setDetailDO(null)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
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
                                            <p className="text-[10px] text-slate-500 mt-1">📍 {it.location_name} · Qty: <span className="font-bold">{it.qty} {it.unit}</span> {it.scanned == 1 && <span className="text-emerald-600 font-bold">✓ discan</span>}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {['SURAT_JALAN_TERBIT', 'PENDING_KELUAR_GUDANG', 'REJECTED_KELUAR_GUDANG', 'BARANG_KELUAR'].includes(detailDO.do_status) && (
                                <button onClick={() => printDO(detailDO.id)}
                                    className="w-full bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest">
                                    🖨️ Print Surat Jalan
                                </button>
                            )}

                            {isManager && detailDO.do_status === 'PENDING_SURAT_JALAN' && (
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setRejectingStage(1)} className="flex-1 bg-red-50 text-red-500 font-black py-4 rounded-2xl text-xs uppercase">✕ Tolak</button>
                                    <button onClick={() => handleApproveSJ('approve')} disabled={processingId === detailDO.id}
                                        className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {processingId === detailDO.id ? '...' : '✓ Terbitkan Surat Jalan'}
                                    </button>
                                </div>
                            )}

                            {detailDO.do_status === 'REJECTED_SURAT_JALAN' && (
                                <button onClick={startEdit} className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-lg">
                                    ✏️ Revisi & Submit Ulang
                                </button>
                            )}

                            {['SURAT_JALAN_TERBIT', 'REJECTED_KELUAR_GUDANG'].includes(detailDO.do_status) && (
                                <button onClick={openVerify} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-lg">
                                    ✅ Verifikasi & TTD
                                </button>
                            )}

                            {isManager && detailDO.do_status === 'PENDING_KELUAR_GUDANG' && (
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setRejectingStage(2)} className="flex-1 bg-red-50 text-red-500 font-black py-4 rounded-2xl text-xs uppercase">✕ Tolak</button>
                                    <button onClick={() => handleApproveKeluar('approve')} disabled={processingId === detailDO.id}
                                        className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {processingId === detailDO.id ? '...' : '✓ Barang Berhasil Keluar'}
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

export default function DeliveryOrderPage() {
    return <DeliveryOrderContent />;
}
