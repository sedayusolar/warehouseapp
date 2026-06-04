'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

function TransferContent() {
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);

    const [step, setStep] = useState<'setup' | 'items' | 'sign' | 'confirm'>('setup');

    // Setup form
    const [fromLocId, setFromLocId] = useState('');
    const [toLocId, setToLocId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [projectName, setProjectName] = useState('');
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

    // Signatories (Hanya PIC/Pembuat di tahap ini)
    const [picName, setPicName] = useState('');
    const [note, setNote] = useState('');

    const [loadingStock, setLoadingStock] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // Signature canvas (Hanya PIC)
    const canvasPic = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState<string | null>(null);

    // ── Init ──
    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        setPicName(parsed.name || '');
        fetchLocations();
        fetchProjects();
    }, []);

    const fetchLocations = async () => {
        const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setLocations(r.data);
    };

    const fetchProjects = async () => {
        const res = await fetch(`${BASE_URL}/get_projects.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setProjects(r.data);
    };

    const fetchStock = async (locId: string) => {
        if (!locId) return;
        setLoadingStock(true);
        try {
            const res = await fetch(`${BASE_URL}/get_items.php?location_id=${locId}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setStockItems(r.data.filter((i: any) => i.stock_qty > 0));
        } catch { }
        setLoadingStock(false);
    };

    // ── Cart helpers ──
    const addToCart = (item: any) => {
        if (cart.find(c => c.qr_id === item.qr_id)) return;
        setCart(prev => [...prev, {
            qr_id: item.qr_id,
            item_name: item.item_name,
            unit: item.unit || 'pcs',
            stock_qty: item.stock_qty,
            qty: 1,
        }]);
    };

    const removeFromCart = (qr_id: string) =>
        setCart(prev => prev.filter(i => i.qr_id !== qr_id));

    const updateQty = (qr_id: string, qty: number) => {
        const item = stockItems.find(i => i.qr_id === qr_id);
        const max = item?.stock_qty || 999;
        setCart(prev => prev.map(i => i.qr_id === qr_id
            ? { ...i, qty: Math.min(max, Math.max(1, qty)) }
            : i
        ));
    };

    // ── Signature Helpers (Vercel Safe) ──
    const startDraw = (e: any, ref: any, id: string) => {
        const canvas = ref.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y);
        setDrawing(id);
    };

    const draw = (e: any, ref: any, id: string) => {
        if (drawing !== id) return;
        const canvas = ref.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    const clearCanvas = (ref: any) =>
        ref.current?.getContext('2d')?.clearRect(0, 0, 500, 200);

    const getSig = (ref: any) =>
        ref.current?.toDataURL('image/png') || '';

    // ── Validate setup ──
    const handleSetupNext = () => {
        if (!fromLocId) { alert('Pilih gudang asal.'); return; }
        if (!toLocId) { alert('Pilih gudang tujuan.'); return; }
        if (fromLocId === toLocId) { alert('Gudang asal dan tujuan tidak boleh sama.'); return; }
        fetchStock(fromLocId);
        setStep('items');
    };

    // ── Submit (Bisa Draft atau Submit Approval) ──
    const handleSubmit = async (submitStatus: 'DRAFT' | 'SUBMITTED') => {
        if (cart.length === 0) { alert('Pilih minimal 1 item.'); return; }
        if (!picName.trim()) { alert('Nama PIC wajib diisi.'); return; }

        const picSig = getSig(canvasPic);

        // LIMIT DITURUNIN JADI 1400 biar coretan simpel tetap lolos
        if (!picSig || picSig.length < 1000) {
            alert('Tanda tangan pembuat/PIC wajib diisi dengan jelas.');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${BASE_URL}/transfer_stock.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    status: submitStatus,
                    project_id: projectId ? parseInt(projectId) : null,
                    project_name: projectName,
                    from_location_id: parseInt(fromLocId),
                    to_location_id: parseInt(toLocId),
                    transfer_date: transferDate,
                    pic_name: picName,
                    note,
                    created_by: user?.name || 'unknown',
                    pic_signature_base64: picSig,
                    driver_name: '',
                    security_name: '',
                    driver_signature_base64: '',
                    security_signature_base64: '',
                    items: cart.map(i => ({
                        qr_id: i.qr_id,
                        item_name: i.item_name,
                        qty: i.qty,
                        unit: i.unit,
                    })),
                }),
            });
            const r = await res.json();
            if (r.status === 'success') {
                setSuccess(`${r.sj_code}|${submitStatus}`);
            } else {
                setError(r.message || 'Terjadi kesalahan.');
            }
        } catch { setError('Gagal koneksi ke server.'); }
        setSubmitting(false);
    };

    const fromLoc = locations.find(l => String(l.id) === fromLocId);
    const toLoc = locations.find(l => String(l.id) === toLocId);

    if (!user) return null;

    // ── SUCCESS ──
    if (success) {
        const [sjCode, finalStatus] = success.split('|');
        return (
            <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center space-y-4 max-w-sm w-full">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto text-3xl">
                        {finalStatus === 'DRAFT' ? '💾' : '🚚'}
                    </div>
                    <p className="font-black text-slate-800 text-xl">
                        {finalStatus === 'DRAFT' ? 'Draft Disimpan!' : 'Transfer Diajukan!'}
                    </p>
                    <p className="font-mono text-violet-600 font-bold text-sm bg-violet-50 px-3 py-1.5 rounded-xl">{sjCode}</p>
                    <p className="text-xs text-slate-500">
                        {finalStatus === 'DRAFT'
                            ? 'Dokumen transfer berhasil disimpan sebagai draft dan belum masuk antrean approval.'
                            : 'Menunggu approval Manager. TTD Supir & Security akan dilakukan saat eksekusi.'}
                    </p>
                    <div className="space-y-2 pt-2">
                        <button onClick={() => router.push('/transactions')}
                            className="w-full bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-md">
                            📋 Lihat Transaksi
                        </button>
                        <button onClick={() => { setSuccess(''); setStep('setup'); setCart([]); setFromLocId(''); setToLocId(''); setProjectId(''); setProjectName(''); }}
                            className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">
                            ＋ Transfer Baru
                        </button>
                    </div>
                </div>
                <Navbar />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* ── STEP INDICATOR ── */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-3">
                <div className="max-w-2xl mx-auto flex items-center gap-1">
                    {(['setup', 'items', 'sign', 'confirm'] as const).map((s, i) => {
                        const labels = ['Setup', 'Pilih Item', 'Tanda Tangan', 'Konfirmasi'];
                        const idx = ['setup', 'items', 'sign', 'confirm'].indexOf(step);
                        const done = idx > i;
                        const active = step === s;
                        return (
                            <div key={s} className="flex items-center gap-1 flex-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0
                                    ${done ? 'bg-emerald-500 text-white' : active ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    {done ? '✓' : i + 1}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wide flex-1 hidden sm:block
                                    ${active ? 'text-violet-600' : done ? 'text-emerald-500' : 'text-slate-300'}`}>
                                    {labels[i]}
                                </span>
                                {i < 3 && <div className={`w-3 h-0.5 flex-shrink-0 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">

                {/* ══════ STEP 1: SETUP ══════ */}
                {step === 'setup' && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Transfer Antar Gudang</p>
                            <p className="text-xs text-slate-500 ml-1 mb-4">Pindahkan stok dari satu gudang ke gudang lain. Membutuhkan approval Manager.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi</p>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Dari Gudang *</label>
                                <select value={fromLocId}
                                    onChange={e => { setFromLocId(e.target.value); setCart([]); setStockItems([]); }}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none">
                                    <option value="">-- Pilih Gudang Asal --</option>
                                    {locations.map((l: any) => (
                                        <option key={l.id} value={l.id}>{l.location_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-slate-300 text-lg">↓</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Ke Gudang *</label>
                                <select value={toLocId} onChange={e => setToLocId(e.target.value)}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none">
                                    <option value="">-- Pilih Gudang Tujuan --</option>
                                    {locations.filter(l => String(l.id) !== fromLocId).map((l: any) => (
                                        <option key={l.id} value={l.id}>{l.location_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Info Transfer</p>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Project (opsional)</label>
                                <select value={projectId}
                                    onChange={e => {
                                        setProjectId(e.target.value);
                                        const p = projects.find((p: any) => String(p.id) === e.target.value);
                                        setProjectName(p?.project_name || '');
                                    }}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none">
                                    <option value="">-- Tidak ada project --</option>
                                    {projects.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.project_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Tanggal Transfer</label>
                                <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Catatan (opsional)</label>
                                <input type="text" placeholder="Catatan transfer..." value={note} onChange={e => setNote(e.target.value)}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            </div>
                        </div>

                        <button onClick={handleSetupNext}
                            className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                            Pilih Item →
                        </button>
                    </div>
                )}

                {/* ══════ STEP 2: PILIH ITEM ══════ */}
                {step === 'items' && (
                    <div className="space-y-4">
                        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                            <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Rute Transfer</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="font-black text-slate-800 text-sm">{fromLoc?.location_name}</span>
                                <span className="text-violet-400">→</span>
                                <span className="font-black text-violet-700 text-sm">{toLoc?.location_name}</span>
                            </div>
                            {projectName && <p className="text-[10px] text-slate-400 mt-1">📋 {projectName}</p>}
                        </div>

                        {cart.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Dipilih ({cart.length})</p>
                                    <button onClick={() => setStep('sign')}
                                        className="bg-violet-600 text-white font-black text-[10px] px-4 py-1.5 rounded-lg">
                                        Lanjut →
                                    </button>
                                </div>
                                {cart.map(item => (
                                    <div key={item.qr_id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">{item.item_name}</p>
                                            <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => updateQty(item.qr_id, item.qty - 1)}
                                                className="w-7 h-7 bg-slate-100 rounded-lg font-black text-slate-600 flex items-center justify-center text-sm active:scale-90">−</button>
                                            <input type="number" value={item.qty}
                                                onChange={e => updateQty(item.qr_id, parseInt(e.target.value) || 1)}
                                                className="w-12 text-center bg-slate-50 rounded-lg outline-none font-black text-slate-800 text-sm py-1" />
                                            <button onClick={() => updateQty(item.qr_id, item.qty + 1)}
                                                className="w-7 h-7 bg-slate-100 rounded-lg font-black text-slate-600 flex items-center justify-center text-sm active:scale-90">＋</button>
                                            <span className="text-[9px] text-slate-400 w-8">{item.unit}</span>
                                            <button onClick={() => removeFromCart(item.qr_id)}
                                                className="text-red-400 text-xs font-black ml-1">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                                Stok di {fromLoc?.location_name}
                            </p>
                            {loadingStock ? (
                                <div className="text-center py-12 text-slate-400 animate-pulse font-bold text-sm">Memuat stok...</div>
                            ) : stockItems.length === 0 ? (
                                <div className="text-center py-12 text-slate-300 text-sm italic">Tidak ada stok tersedia.</div>
                            ) : (
                                <div className="space-y-2">
                                    {stockItems.map((item: any) => {
                                        const inCart = cart.find(c => c.qr_id === item.qr_id);
                                        return (
                                            <div key={item.qr_id}
                                                className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-3 transition-all
                                                    ${inCart ? 'border-violet-200 bg-violet-50' : 'border-slate-100'}`}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 truncate">{item.item_name}</p>
                                                    <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                                        Stok: <strong>{item.stock_qty} {item.unit}</strong>
                                                    </p>
                                                </div>
                                                <button onClick={() => inCart ? removeFromCart(item.qr_id) : addToCart(item)}
                                                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all active:scale-95 flex-shrink-0
                                                        ${inCart
                                                            ? 'bg-violet-600 text-white'
                                                            : 'bg-slate-100 text-slate-600'}`}>
                                                    {inCart ? '✓ Dipilih' : '＋ Pilih'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <button onClick={() => setStep('sign')}
                                className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                                Lanjut Tanda Tangan ({cart.length} item) →
                            </button>
                        )}

                        <button onClick={() => setStep('setup')}
                            className="w-full bg-slate-100 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase">
                            ← Kembali Setup
                        </button>
                    </div>
                )}

                {/* ══════ STEP 3: TANDA TANGAN (HANYA PIC) ══════ */}
                {step === 'sign' && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Tanda Tangan Pembuat</p>
                            <p className="text-xs text-slate-500 ml-1">Tanda tangan Supir dan Security akan dilakukan pada saat eksekusi barang (setelah di-Approve).</p>
                        </div>

                        {/* PIC */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-sm">👤</div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pembuat / PIC *</p>
                            </div>
                            <input type="text" placeholder="Nama PIC *" value={picName} onChange={e => setPicName(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan PIC *</label>
                                    <button onClick={() => clearCanvas(canvasPic)} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                </div>
                                <canvas ref={canvasPic} width={500} height={200}
                                    onMouseDown={e => startDraw(e, canvasPic, 'pic')}
                                    onMouseMove={e => draw(e, canvasPic, 'pic')}
                                    onMouseUp={() => setDrawing(null)}
                                    onTouchStart={e => startDraw(e, canvasPic, 'pic')}
                                    onTouchMove={e => draw(e, canvasPic, 'pic')}
                                    onTouchEnd={() => setDrawing(null)}
                                    className="w-full h-40 bg-slate-50 rounded-xl border-2 border-slate-200 touch-none cursor-crosshair" />
                            </div>
                        </div>

                        <button onClick={() => setStep('confirm')}
                            className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                            Review & Konfirmasi →
                        </button>
                        <button onClick={() => setStep('items')}
                            className="w-full bg-slate-100 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase">
                            ← Kembali Pilih Item
                        </button>
                    </div>
                )}

                {/* ══════ STEP 4: KONFIRMASI ══════ */}
                {step === 'confirm' && (
                    <div className="space-y-4">

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-violet-600 px-5 py-4">
                                <p className="text-[9px] font-black text-violet-200 uppercase tracking-widest">Transfer Antar Gudang</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="font-black text-white text-sm">{fromLoc?.location_name}</span>
                                    <span className="text-violet-300 text-lg">→</span>
                                    <span className="font-black text-white text-sm">{toLoc?.location_name}</span>
                                </div>
                                {projectName && <p className="text-[10px] text-violet-300 mt-1">📋 {projectName}</p>}
                                <p className="text-[10px] text-violet-300 mt-0.5">📅 {transferDate}</p>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {cart.map(item => (
                                    <div key={item.qr_id} className="px-5 py-3 flex justify-between items-center">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{item.item_name}</p>
                                            <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                        </div>
                                        <p className="text-sm font-black text-slate-800">{item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span></p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-50 px-5 py-2 border-t border-slate-100 flex justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Total Item</span>
                                <span className="text-[10px] font-black text-slate-700">{cart.length} jenis · {cart.reduce((a, i) => a + i.qty, 0)} unit</span>
                            </div>
                        </div>

                        {/* Signatories summary (Hanya PIC) */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Pembuat Transaksi!</p>
                            <div className="flex justify-center">
                                <div className="text-center w-2/3">
                                    <div className="h-24 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                                        {canvasPic.current && getSig(canvasPic).length > 2000
                                            ? <img src={getSig(canvasPic)} className="w-full h-full object-contain" alt="PIC" />
                                            : <span className="text-[9px] text-slate-300">—</span>
                                        }
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 mt-2 truncate">👤 {picName}</p>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                <p className="text-xs font-bold text-red-500 text-center">{error}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => handleSubmit('DRAFT')} disabled={submitting}
                                className="flex-1 bg-amber-100 text-amber-700 font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-sm active:scale-95 transition-all disabled:opacity-50 border border-amber-200">
                                {submitting ? '⏳ ...' : '💾 Simpan Draft'}
                            </button>
                            <button onClick={() => handleSubmit('SUBMITTED')} disabled={submitting}
                                className="flex-1 bg-violet-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                {submitting ? '⏳ Menyimpan...' : '🚀 Ajukan Approval'}
                            </button>
                        </div>

                        <button onClick={() => setStep('sign')}
                            className="w-full bg-slate-100 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase">
                            ← Kembali Edit TTD
                        </button>
                    </div>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function TransferPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <TransferContent />
        </Suspense>
    );
}