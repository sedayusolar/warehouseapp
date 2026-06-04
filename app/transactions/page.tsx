'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

// ── Signature helpers ──
const clearCanvas = (ref: React.RefObject<HTMLCanvasElement | null>) =>
    ref.current?.getContext('2d')?.clearRect(0, 0, 500, 200);
const isCanvasSigned = (ref: React.RefObject<HTMLCanvasElement | null>): boolean => {
    const canvas = ref.current; if (!canvas) return false;
    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return false;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 10) return true;
    return false;
};
const getSig = (ref: React.RefObject<HTMLCanvasElement | null>) =>
    ref.current?.toDataURL('image/png') || '';

const UNIT_OPTIONS_DELIVERY = ['pcs', 'set', 'unit', 'kg', 'meter', 'm', 'roll', 'botol', 'pack', 'box', 'lembar', 'buah'];

function TransactionListContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const [showScanner, setShowScanner] = useState(false);
    const [scanError, setScanError] = useState('');

    // ── Delivery Modal state (TTD Supir & Security) ──
    const [showDelivery, setShowDelivery] = useState(false);
    const [deliveryTrx, setDeliveryTrx] = useState<any>(null);
    const [deliveryItems, setDeliveryItems] = useState<any[]>([]);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [driverName, setDriverName] = useState('');
    const [securityName, setSecurityName] = useState('');
    const [submittingDelivery, setSubmittingDelivery] = useState(false);
    const [existingDriverSig, setExistingDriverSig] = useState('');
    const [existingSecuritySig, setExistingSecuritySig] = useState('');
    const canvasDriver = useRef<HTMLCanvasElement>(null);
    const canvasSecurity = useRef<HTMLCanvasElement>(null);
    const [drawingDelivery, setDrawingDelivery] = useState<string | null>(null);

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) { router.push('/login'); return; }
        const parsed = JSON.parse(loggedInUser);
        setUser(parsed);
        if (parsed.role === 'MANAGER') setFilter('SUBMITTED');
        fetchTransactions();
    }, []);

    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            setScanError('');
            scanner = new Html5QrcodeScanner("trx-qr-reader", { fps: 10, qrbox: 220 }, false);
            scanner.render(
                (text: string) => {
                    const match = text.match(/\/transactions\/(\d+)/);
                    if (match) { setShowScanner(false); router.push(`/transactions/${match[1]}`); }
                    else {
                        const numMatch = text.match(/^(\d+)$/);
                        if (numMatch) { setShowScanner(false); router.push(`/transactions/${numMatch[1]}`); }
                        else setScanError(`QR tidak dikenali: ${text}`);
                    }
                },
                () => { }
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
            if (result.status === 'success')
                setTransactions(result.data.sort((a: any, b: any) => b.id - a.id));
        } catch (error) { console.error("Gagal ambil data:", error); }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus transaksi ini secara permanen?")) return;
        try {
            const res = await fetch(`${BASE_URL}/delete_transaction.php?id=${id}`, {
                method: 'DELETE', headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') { alert("Terhapus!"); fetchTransactions(); }
            else alert("Gagal: " + result.message);
        } catch { alert("Terjadi kesalahan sistem saat menghapus."); }
    };

    // ── Signature draw helpers ──
    const startDraw = (e: any, ref: React.RefObject<HTMLCanvasElement | null>, id: string, setter: (v: string | null) => void) => {
        const canvas = ref.current; if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y);
        setter(id);
    };
    const drawSig = (e: any, ref: React.RefObject<HTMLCanvasElement | null>, id: string, currentDrawing: string | null) => {
        if (currentDrawing !== id) return;
        const canvas = ref.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    // ── Buka modal TTD pengiriman (pre-fill data tersimpan) ──
    const openDeliveryModal = async (trx: any) => {
        setDeliveryTrx(trx);
        clearCanvas(canvasDriver);
        clearCanvas(canvasSecurity);
        setCheckedItems(new Set());
        setExistingDriverSig('');
        setExistingSecuritySig('');
        setShowDelivery(true);
        try {
            const res = await fetch(`${BASE_URL}/get_transaction_detail.php?id=${trx.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setDeliveryItems(r.items || []);
                setDriverName(r.header?.driver_name || '');
                setSecurityName(r.header?.security_name || '');
                setExistingDriverSig(r.header?.driver_signature || '');
                setExistingSecuritySig(r.header?.security_signature || '');
            }
        } catch { }
    };

    const toggleCheckItem = (qr_id: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            next.has(qr_id) ? next.delete(qr_id) : next.add(qr_id);
            return next;
        });
    };

    const handleDeliverySubmit = async () => {
        if (checkedItems.size < deliveryItems.length) {
            alert(`Centang semua item (${deliveryItems.length} item) untuk konfirmasi.`); return;
        }
        if (!driverName.trim() && !securityName.trim()) {
            alert('Isi minimal nama Supir atau nama Security.'); return;
        }
        setSubmittingDelivery(true);
        try {
            const res = await fetch(`${BASE_URL}/update_checkout_delivery.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    transaction_id: deliveryTrx.id,
                    driver_name: driverName,
                    security_name: securityName,
                    driver_signature_base64: isCanvasSigned(canvasDriver) ? getSig(canvasDriver) : '',
                    security_signature_base64: isCanvasSigned(canvasSecurity) ? getSig(canvasSecurity) : '',
                }),
            });
            const r = await res.json();
            if (r.status === 'success') {
                setShowDelivery(false);
                alert('✅ Data pengiriman tersimpan! SJ siap dicetak.');
                fetchTransactions();
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi server.'); }
        setSubmittingDelivery(false);
    };

    // ── Print SJ — include driver & security ──
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
                code: header.transaction_code,
                trx_id: String(header.id),
                project: header.project_name || '—',
                pic: header.pic_name || '—',
                date: header.checkout_date,
                pengirim: header.staff_name || user?.name || '—',
                staff_sig: header.staff_signature_path || '',
                pic_sig: header.signature_pic_path || '',
                driver_name: header.driver_name || '',
                driver_sig: header.driver_signature || '',
                security_name: header.security_name || '',
                security_sig: header.security_signature || '',
                base_url: BASE_URL,
                items: JSON.stringify(itemsData),
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
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900 relative">

            {/* QR SCANNER MODAL */}
            {showScanner && (
                <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6"
                    onClick={() => setShowScanner(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan QR Surat Jalan</p>
                            <p className="font-black text-slate-900 text-base mt-0.5">Arahkan ke QR Code</p>
                            <p className="text-[10px] text-slate-400 mt-1">QR di pojok kanan atas surat jalan</p>
                        </div>
                        <div id="trx-qr-reader" className="overflow-hidden rounded-2xl border-2 border-blue-500 bg-black min-h-[220px]"></div>
                        {scanError && (
                            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                                <p className="text-[10px] font-bold text-red-600 text-center">{scanError}</p>
                                <button onClick={() => setScanError('')} className="w-full mt-2 text-[10px] font-black text-red-500 uppercase">Coba Lagi</button>
                            </div>
                        )}
                        <button onClick={() => setShowScanner(false)} className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">Batal</button>
                    </div>
                </div>
            )}

            {/* ══ DELIVERY MODAL (TTD Supir & Security) ══ */}
            {showDelivery && deliveryTrx && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowDelivery(false)}>
                    <div className="bg-white w-full max-w-2xl mx-auto rounded-t-3xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                            <div>
                                <p className="font-black text-slate-800 text-base">✍️ Data Pengiriman</p>
                                <p className="text-[10px] font-mono text-violet-600">{deliveryTrx.transaction_code}</p>
                            </div>
                            <button onClick={() => setShowDelivery(false)} className="text-slate-400 font-black text-lg w-8 h-8 flex items-center justify-center">✕</button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Checklist item */}
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                    Checklist Item ({checkedItems.size}/{deliveryItems.length} dicentang)
                                </p>
                                <div className="space-y-2">
                                    {deliveryItems.map((item: any, i: number) => {
                                        const checked = checkedItems.has(item.qr_id);
                                        return (
                                            <button key={i} onClick={() => toggleCheckItem(item.qr_id)}
                                                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-95
                                                    ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                                                    ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                    {checked && <span className="text-white text-xs font-black">✓</span>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-bold truncate ${checked ? 'text-emerald-700' : 'text-slate-800'}`}>{item.item_name}</p>
                                                    <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                                </div>
                                                <p className="text-sm font-black text-slate-600 flex-shrink-0">{item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span></p>
                                            </button>
                                        );
                                    })}
                                </div>
                                {checkedItems.size < deliveryItems.length && (
                                    <p className="text-[10px] text-amber-600 font-bold mt-2 text-center">Centang semua item untuk konfirmasi pengiriman</p>
                                )}
                            </div>

                            {/* TTD Supir */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-sm">🚚</div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supir (opsional)</p>
                                </div>
                                <input type="text" placeholder="Nama Supir" value={driverName} onChange={e => setDriverName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                                {existingDriverSig && !isCanvasSigned(canvasDriver) && (
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-emerald-600 font-bold">✅ TTD tersimpan — gambar ulang di bawah untuk mengganti</p>
                                        <img src={`${BASE_URL}/${existingDriverSig}`} alt="TTD Supir" className="h-16 object-contain border border-slate-100 rounded-xl bg-slate-50 p-1" />
                                    </div>
                                )}
                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase">
                                            {existingDriverSig ? 'Gambar Ulang TTD (opsional)' : 'Tanda Tangan Supir'}
                                        </label>
                                        <button onClick={() => clearCanvas(canvasDriver)} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                    </div>
                                    <canvas ref={canvasDriver} width={500} height={160}
                                        onMouseDown={e => startDraw(e, canvasDriver, 'driver', setDrawingDelivery)}
                                        onMouseMove={e => drawSig(e, canvasDriver, 'driver', drawingDelivery)}
                                        onMouseUp={() => setDrawingDelivery(null)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(e, canvasDriver, 'driver', setDrawingDelivery); }}
                                        onTouchMove={e => { e.preventDefault(); drawSig(e, canvasDriver, 'driver', drawingDelivery); }}
                                        onTouchEnd={() => setDrawingDelivery(null)}
                                        className="w-full h-28 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 touch-none cursor-crosshair" />
                                </div>
                            </div>

                            {/* TTD Security */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-sm">🛡️</div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Kantor (opsional)</p>
                                </div>
                                <input type="text" placeholder="Nama Security" value={securityName} onChange={e => setSecurityName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                                {existingSecuritySig && !isCanvasSigned(canvasSecurity) && (
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-emerald-600 font-bold">✅ TTD tersimpan — gambar ulang di bawah untuk mengganti</p>
                                        <img src={`${BASE_URL}/${existingSecuritySig}`} alt="TTD Security" className="h-16 object-contain border border-slate-100 rounded-xl bg-slate-50 p-1" />
                                    </div>
                                )}
                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase">
                                            {existingSecuritySig ? 'Gambar Ulang TTD (opsional)' : 'Tanda Tangan Security'}
                                        </label>
                                        <button onClick={() => clearCanvas(canvasSecurity)} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                    </div>
                                    <canvas ref={canvasSecurity} width={500} height={160}
                                        onMouseDown={e => startDraw(e, canvasSecurity, 'security', setDrawingDelivery)}
                                        onMouseMove={e => drawSig(e, canvasSecurity, 'security', drawingDelivery)}
                                        onMouseUp={() => setDrawingDelivery(null)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(e, canvasSecurity, 'security', setDrawingDelivery); }}
                                        onTouchMove={e => { e.preventDefault(); drawSig(e, canvasSecurity, 'security', drawingDelivery); }}
                                        onTouchEnd={() => setDrawingDelivery(null)}
                                        className="w-full h-28 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 touch-none cursor-crosshair" />
                                </div>
                            </div>

                            <button onClick={handleDeliverySubmit}
                                disabled={submittingDelivery || checkedItems.size < deliveryItems.length}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg disabled:opacity-40 active:scale-95 transition-all">
                                {submittingDelivery ? '⏳ Menyimpan...'
                                    : checkedItems.size < deliveryItems.length
                                        ? `Centang ${deliveryItems.length - checkedItems.size} item lagi`
                                        : '✅ SIMPAN DATA PENGIRIMAN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB FILTER */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-4xl mx-auto flex gap-2 items-center">
                    {(user?.role === 'MANAGER' ? ['ALL', 'SUBMITTED'] : ['ALL', 'DRAFT', 'SUBMITTED']).map((tab) => (
                        <button key={tab} onClick={() => setFilter(tab)}
                            className={`flex-1 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all
                                ${filter === tab ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                            {tab === 'SUBMITTED' ? 'APPROVAL' : tab}
                        </button>
                    ))}
                    <button onClick={() => setShowScanner(true)}
                        className="bg-slate-800 text-white font-black px-3 py-2 rounded-xl text-xs uppercase flex items-center gap-1 flex-shrink-0 active:scale-95">
                        <span>📷</span>
                    </button>
                    {user?.role !== 'MANAGER' && (
                        <button onClick={() => router.push('/checkin-project')}
                            className="bg-emerald-600 text-white font-black px-3 py-2 rounded-xl text-[10px] uppercase flex items-center gap-1 flex-shrink-0 active:scale-95 whitespace-nowrap">
                            <span>📦</span> CI
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 max-w-4xl mx-auto space-y-4">

                {user?.role !== 'MANAGER' && transactions.some(t => t.transaction_status === 'DELIVERED') && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-black text-emerald-700">Ada barang yang belum di-Check In</p>
                            <p className="text-[10px] text-emerald-600 mt-0.5">Gunakan Check In per Project untuk mengembalikan semua barang sekaligus</p>
                        </div>
                        <button onClick={() => router.push('/checkin-project')}
                            className="bg-emerald-600 text-white font-black px-4 py-2.5 rounded-xl text-[10px] uppercase flex-shrink-0 active:scale-95">
                            📦 Check In
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-20 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Sinkronisasi Data...</div>
                ) : filteredData.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">Tidak ada transaksi ditemukan.</div>
                ) : (
                    filteredData.map((trx) => {
                        const isApproved = trx.manager_approval_status === 'APPROVED';
                        const isDelivered = trx.transaction_status === 'DELIVERED';
                        const isCheckinPending = trx.transaction_status === 'CHECKIN_PENDING';
                        const isCheckinApproved = trx.transaction_status === 'CHECKIN_APPROVED';
                        const canPrintSJ = isApproved;
                        // Tombol TTD Kirim: approved tapi belum delivered (barang sedang dalam perjalanan)
                        const canTTDKirim = isApproved && !isDelivered && !isCheckinPending && !isCheckinApproved && user?.role !== 'MANAGER';

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
                                                className="bg-emerald-50 text-emerald-700 font-black text-[9px] px-2 py-1.5 rounded-lg border border-emerald-200 active:scale-95">
                                                🖨️ SJ
                                            </button>
                                        )}
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => handleDelete(trx.id)} className="text-red-400 p-2">🗑️</button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs mb-4 pt-4 border-t">
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 font-black uppercase text-[9px] mb-1">PIC</span>
                                        <span className="text-slate-700 font-bold">{trx.pic_name || '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 font-black uppercase text-[9px] mb-1">Tanggal</span>
                                        <span className="text-slate-700 font-bold">{trx.checkout_date}</span>
                                    </div>
                                </div>

                                {/* Badge supir/security jika sudah ada */}
                                {isApproved && (trx.driver_name || trx.security_name) && (
                                    <div className="flex gap-2 mb-3 flex-wrap">
                                        {trx.driver_name && <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">🚚 {trx.driver_name}</span>}
                                        {trx.security_name && <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">🛡️ {trx.security_name}</span>}
                                    </div>
                                )}

                                <div className="flex gap-2 flex-wrap">
                                    {trx.transaction_status === 'DRAFT' && user.role !== 'MANAGER' ? (
                                        <button onClick={() => router.push(`/checkout?edit=${trx.id}`)}
                                            className="flex-1 bg-blue-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg">
                                            🚀 Lanjutkan Draft
                                        </button>

                                    ) : isCheckinApproved ? (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className="flex-1 bg-slate-100 text-slate-500 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest">
                                            ✅ Selesai — Lihat Detail
                                        </button>

                                    ) : isCheckinPending ? (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className={`flex-1 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-lg
                                                ${user.role === 'MANAGER' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                                            {user.role === 'MANAGER' ? '✅ Review Check In' : '⏳ Menunggu Approval Check In'}
                                        </button>

                                    ) : isDelivered && user.role !== 'MANAGER' ? (
                                        <>
                                            <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                                className="flex-1 bg-slate-100 text-slate-600 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest">
                                                👁️ Detail
                                            </button>
                                            <button onClick={() => router.push(`/checkin-project`)}
                                                className="flex-1 bg-emerald-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-md">
                                                📦 Check In
                                            </button>
                                        </>

                                    ) : canTTDKirim ? (
                                        // ── APPROVED, belum delivered: tombol TTD Kirim + Detail ──
                                        <>
                                            <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                                className="bg-slate-100 text-slate-600 text-[10px] font-black px-4 py-4 rounded-2xl uppercase tracking-widest">
                                                👁️
                                            </button>
                                            <button onClick={() => openDeliveryModal(trx)}
                                                className="flex-1 bg-emerald-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-md active:scale-95">
                                                ✍️ TTD Kirim
                                            </button>
                                            <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                                className="flex-1 bg-violet-600 text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest shadow-md">
                                                ✍️ Konfirmasi Terima
                                            </button>
                                        </>

                                    ) : (
                                        <button onClick={() => router.push(`/transactions/${trx.id}`)}
                                            className={`flex-1 text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest
                                                ${trx.manager_approval_status === 'PENDING' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                                            {trx.manager_approval_status === 'PENDING' && user.role === 'MANAGER'
                                                ? '👁️ Cek Detail & Approve'
                                                : '👁️ Lihat Detail'}
                                        </button>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCheckinApproved ? 'bg-blue-500' :
                                            isCheckinPending ? 'bg-amber-500 animate-pulse' :
                                                isDelivered ? 'bg-violet-500' :
                                                    isApproved ? 'bg-emerald-500' :
                                                        trx.manager_approval_status === 'REJECTED' ? 'bg-red-500' :
                                                            'bg-orange-500 animate-pulse'}`} />
                                    <span>Status: {
                                        isCheckinApproved ? '✅ SELESAI' :
                                            isCheckinPending ? '⏳ CHECKIN MENUNGGU APPROVAL' :
                                                isDelivered ? '📦 DELIVERED — Siap Check In' :
                                                    trx.transaction_status === 'SUBMITTED'
                                                        ? trx.manager_approval_status
                                                        : trx.transaction_status
                                    }</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {!user?.role?.includes('MANAGER') && transactions.length > 0 && (
                <button onClick={() => router.push('/transfer')}
                    className="fixed bottom-24 right-4 bg-violet-600 text-white font-black w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center active:scale-90 transition-all z-40">
                    ＋
                </button>
            )}

            <Navbar />
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
