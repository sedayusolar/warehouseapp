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

    // Signatories
    const [picName, setPicName] = useState('');
    const [note, setNote] = useState('');

    const [loadingStock, setLoadingStock] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // Signature
    const canvasPic = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState<string | null>(null);
    const [picSigData, setPicSigData] = useState<string>(''); // FIX: Simpan data TTD di state

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

    // ── Signature Helpers ──
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

    const clearCanvas = (ref: any) => ref.current?.getContext('2d')?.clearRect(0, 0, 500, 200);
    const getSig = (ref: any) => ref.current?.toDataURL('image/png') || '';

    // ── Navigation ──
    const handleSetupNext = () => {
        if (!fromLocId) { alert('Pilih gudang asal.'); return; }
        if (!toLocId) { alert('Pilih gudang tujuan.'); return; }
        if (fromLocId === toLocId) { alert('Gudang asal dan tujuan tidak boleh sama.'); return; }
        fetchStock(fromLocId);
        setStep('items');
    };

    const handleProceedToConfirm = () => {
        const sig = getSig(canvasPic);
        if (sig.length < 1000) { alert('Tanda tangan pembuat/PIC wajib diisi dengan jelas.'); return; }
        setPicSigData(sig); // FIX: Simpan gambar ke state sebelum pindah step
        setStep('confirm');
    };

    // ── Cart & Submit ──
    const addToCart = (item: any) => {
        if (cart.find(c => c.qr_id === item.qr_id)) return;
        setCart(prev => [...prev, { qr_id: item.qr_id, item_name: item.item_name, unit: item.unit || 'pcs', stock_qty: item.stock_qty, qty: 1 }]);
    };
    const removeFromCart = (qr_id: string) => setCart(prev => prev.filter(i => i.qr_id !== qr_id));
    const updateQty = (qr_id: string, qty: number) => {
        const item = stockItems.find(i => i.qr_id === qr_id);
        const max = item?.stock_qty || 999;
        setCart(prev => prev.map(i => i.qr_id === qr_id ? { ...i, qty: Math.min(max, Math.max(1, qty)) } : i));
    };

    const handleSubmit = async (submitStatus: 'DRAFT' | 'SUBMITTED') => {
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
                    created_by: user?.name,
                    pic_signature_base64: picSigData, // FIX: Pakai state yang udah kesimpen
                    driver_name: '', security_name: '',
                    driver_signature_base64: '', security_signature_base64: '',
                    items: cart.map(i => ({ qr_id: i.qr_id, item_name: i.item_name, qty: i.qty, unit: i.unit })),
                }),
            });
            const r = await res.json();
            if (r.status === 'success') setSuccess(`${r.sj_code}|${submitStatus}`);
            else setError(r.message || 'Terjadi kesalahan.');
        } catch { setError('Gagal koneksi ke server.'); }
        setSubmitting(false);
    };

    const fromLoc = locations.find(l => String(l.id) === fromLocId);
    const toLoc = locations.find(l => String(l.id) === toLocId);

    if (!user) return null;

    if (success) {
        const [sjCode, finalStatus] = success.split('|');
        return (
            <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center space-y-4 max-w-sm w-full">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto text-3xl">
                        {finalStatus === 'DRAFT' ? '💾' : '🚚'}
                    </div>
                    <p className="font-black text-slate-800 text-xl">{finalStatus === 'DRAFT' ? 'Draft Disimpan!' : 'Transfer Diajukan!'}</p>
                    <p className="font-mono text-violet-600 font-bold text-sm bg-violet-50 px-3 py-1.5 rounded-xl">{sjCode}</p>
                    <div className="space-y-2 pt-2">
                        <button onClick={() => router.push('/transactions')} className="w-full bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-md">📋 Lihat Transaksi</button>
                        <button onClick={() => { setSuccess(''); setStep('setup'); setCart([]); }} className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">＋ Transfer Baru</button>
                    </div>
                </div>
                <Navbar />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-3">
                <div className="max-w-2xl mx-auto flex items-center gap-1">
                    {(['setup', 'items', 'sign', 'confirm'] as const).map((s, i) => {
                        const labels = ['Setup', 'Pilih Item', 'Tanda Tangan', 'Konfirmasi'];
                        const active = step === s;
                        const done = ['setup', 'items', 'sign', 'confirm'].indexOf(step) > i;
                        return (
                            <div key={s} className="flex items-center gap-1 flex-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${done ? 'bg-emerald-500 text-white' : active ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    {done ? '✓' : i + 1}
                                </div>
                                <span className={`text-[9px] font-black uppercase ${active ? 'text-violet-600' : done ? 'text-emerald-500' : 'text-slate-300'}`}>{labels[i]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">
                {step === 'setup' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Dari Gudang</label>
                            <select value={fromLocId} onChange={e => { setFromLocId(e.target.value); setCart([]); }} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-sm">
                                <option value="">-- Pilih --</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                            </select>
                            <label className="text-[9px] font-black text-slate-400 uppercase">Ke Gudang</label>
                            <select value={toLocId} onChange={e => setToLocId(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-sm">
                                <option value="">-- Pilih --</option>
                                {locations.filter(l => String(l.id) !== fromLocId).map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                            </select>
                        </div>
                        <button onClick={handleSetupNext} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase">Pilih Item →</button>
                    </div>
                )}

                {/* ... (Step Items, Sign sama, tapi di bagian button Sign/Confirm panggil handleProceedToConfirm) */}
                {step === 'sign' && (
                    <button onClick={handleProceedToConfirm} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl text-sm">Review & Konfirmasi →</button>
                )}

                {step === 'confirm' && (
                    <div className="bg-white rounded-2xl border p-5">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan PIC</p>
                        <div className="h-24 border rounded-xl overflow-hidden bg-slate-50">
                            {picSigData.length > 500
                                ? <img src={picSigData} className="w-full h-full object-contain" alt="PIC" />
                                : <span className="text-xs text-slate-300">—</span>}
                        </div>
                        <button onClick={() => handleSubmit('SUBMITTED')} className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl mt-4">SUBMIT</button>
                    </div>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function TransferPage() {
    return <Suspense fallback={<div>Loading...</div>}><TransferContent /></Suspense>;
}