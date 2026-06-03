'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const CONDITION_TOOLS: Record<string, { label: string; color: string; icon: string }> = {
    GOOD: { label: 'Baik', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '✅' },
    DAMAGED: { label: 'Rusak', color: 'bg-orange-100 text-orange-600 border-orange-300', icon: '⚠️' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600 border-red-300', icon: '❌' },
};

const CONDITION_MATERIAL: Record<string, { label: string; color: string; icon: string }> = {
    GOOD: { label: 'Ada Sisa', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '📦' },
    DAMAGED: { label: 'Sisa Rusak', color: 'bg-orange-100 text-orange-600 border-orange-300', icon: '⚠️' },
    USED: { label: 'Terpakai', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '✅' },
    LOST: { label: 'Hilang', color: 'bg-red-100 text-red-600 border-red-300', icon: '❌' },
};

const getConditionConfig = (type: string) =>
    type === 'MATERIAL' ? CONDITION_MATERIAL : CONDITION_TOOLS;

// Apakah kondisi ini perlu dikembalikan ke stok?
const isReturnToStock = (itemType: string, condition: string) => {
    if (condition === 'LOST') return false;
    if (itemType === 'MATERIAL' && condition === 'USED') return false;
    return true;
};

function CheckInProjectContent() {
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [projectItems, setProjectItems] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);

    const [step, setStep] = useState<'select' | 'items' | 'confirm'>('select');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [picName, setPicName] = useState('');
    const [checkinDate, setCheckinDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // ── Compress image ──
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

    // ── Init ──
    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        setUser(parsed);
        setPicName(parsed.name || '');
        fetchProjects();
        fetchLocations();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_projects.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setProjects(r.data);
        } catch { }
    };

    const fetchLocations = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setLocations(r.data);
        } catch { }
    };

    // ── Load items per project ──
    const loadProjectItems = async (project: any) => {
        setLoading(true);
        setError('');
        setSelectedProject(project);
        try {
            const res = await fetch(
                `${BASE_URL}/get_project_checkout_items.php?project_id=${project.id}`,
                { headers: { 'X-API-KEY': API_KEY } }
            );
            const r = await res.json();
            if (r.status === 'success') {
                if (r.items.length === 0) {
                    setError('Tidak ada item yang masih berada di site untuk project ini.');
                    setLoading(false);
                    return;
                }
                setProjectItems(r.items);
                // Init cart — default qty = qty_at_site
                setCart(r.items.map((item: any) => ({
                    qr_id: item.qr_id,
                    name: item.item_name,
                    unit: item.unit || 'pcs',
                    item_type: item.item_type,
                    location_id: item.location_id || '',
                    location_name: item.location_name || '',
                    qty_at_site: item.qty_at_site,
                    qty: item.qty_at_site,   // default semua dikembalikan
                    condition: item.item_type === 'MATERIAL' ? 'USED' : 'GOOD',
                    photo_base64: '',
                    note: '',
                    enabled: true,               // toggle item ikut checkin atau tidak
                })));
                setStep('items');
            } else {
                setError(r.message || 'Gagal memuat data item.');
            }
        } catch {
            setError('Gagal koneksi ke server.');
        }
        setLoading(false);
    };

    // ── Cart update helpers ──
    const updateCart = (qr_id: string, field: string, value: any) =>
        setCart(prev => prev.map(i => i.qr_id === qr_id ? { ...i, [field]: value } : i));

    const toggleItem = (qr_id: string) =>
        setCart(prev => prev.map(i => i.qr_id === qr_id ? { ...i, enabled: !i.enabled } : i));

    // ── Signature ──
    const startDraw = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };
    const clearSig = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300);

    // ── Submit ──
    const handleSubmit = async () => {
        const activeItems = cart.filter(i => i.enabled);
        if (activeItems.length === 0) { alert('Pilih minimal 1 item untuk di-checkin.'); return; }
        if (!picName.trim()) { alert('Nama PIC wajib diisi.'); return; }
        const sig = canvasRef.current?.toDataURL('image/png');
        if (!sig || sig.length < 2000) { alert('Tanda tangan wajib diisi.'); return; }

        // Validasi lokasi untuk item yang kembali ke stok
        for (const item of activeItems) {
            if (isReturnToStock(item.item_type, item.condition) && !item.location_id) {
                alert(`Pilih lokasi pengembalian untuk: ${item.name}`);
                return;
            }
        }

        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${BASE_URL}/checkin_project.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    project_id: selectedProject.id,
                    project_name: selectedProject.project_name,
                    pic_name: picName,
                    checkin_date: checkinDate,
                    note,
                    created_by: user?.name || 'unknown',
                    signature_base64: sig,
                    items: activeItems.map(i => ({
                        qr_id: i.qr_id,
                        qty: Number(i.qty),
                        condition: i.condition,
                        location_id: i.location_id || null,
                        photo_base64: i.photo_base64,
                        note: i.note,
                    })),
                }),
            });
            const r = await res.json();
            if (r.status === 'success') setSuccess(r.checkin_code);
            else setError(r.message || 'Terjadi kesalahan.');
        } catch {
            setError('Gagal koneksi ke server.');
        }
        setSubmitting(false);
    };

    if (!user) return null;

    // ── SUCCESS STATE ──
    if (success) return (
        <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center space-y-4 max-w-sm w-full shadow-sm">
                <p className="text-6xl">✅</p>
                <p className="font-black text-emerald-700 text-xl">Check In Berhasil!</p>
                <p className="font-mono text-emerald-600 font-bold text-sm bg-emerald-100 px-3 py-1.5 rounded-xl">{success}</p>
                <p className="text-xs text-slate-500">Menunggu approval Manager. Stok akan kembali ke gudang setelah disetujui.</p>
                <div className="space-y-2 pt-2">
                    <button onClick={() => router.push('/transactions')}
                        className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-md">
                        📋 Lihat Riwayat Transaksi
                    </button>
                    <button onClick={() => { setSuccess(''); setStep('select'); setCart([]); setSelectedProject(null); }}
                        className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">
                        ＋ Check In Project Lain
                    </button>
                </div>
            </div>
            <Navbar />
        </main>
    );

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* ── STEP INDICATOR ── */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-3">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-2">
                        {(['select', 'items', 'confirm'] as const).map((s, i) => {
                            const labels = ['Pilih Project', 'Input Item', 'Konfirmasi'];
                            const active = step === s;
                            const done = (['select', 'items', 'confirm'] as const).indexOf(step) > i;
                            return (
                                <div key={s} className="flex items-center gap-2 flex-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0
                                        ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-wider flex-1
                                        ${active ? 'text-blue-600' : done ? 'text-emerald-500' : 'text-slate-300'}`}>
                                        {labels[i]}
                                    </span>
                                    {i < 2 && <div className={`w-4 h-0.5 flex-shrink-0 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">

                {/* ── STEP 1: PILIH PROJECT ── */}
                {step === 'select' && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                                Check In per Project
                            </p>
                            <p className="text-xs text-slate-500 ml-1 mb-4">
                                Pilih project yang barangnya ingin dikembalikan ke gudang. Sistem akan otomatis menampilkan semua item yang masih ada di site.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                                <p className="text-sm font-bold text-red-500">{error}</p>
                                <button onClick={() => setError('')} className="text-[10px] text-red-400 mt-2 font-black uppercase">Tutup</button>
                            </div>
                        )}

                        {loading ? (
                            <div className="text-center py-16 text-slate-400 animate-pulse font-bold text-sm">Memuat project...</div>
                        ) : projects.length === 0 ? (
                            <div className="text-center py-16 text-slate-300 text-sm italic">Belum ada project tersedia.</div>
                        ) : (
                            <div className="space-y-3">
                                {projects.map((proj: any) => (
                                    <button key={proj.id} onClick={() => loadProjectItems(proj)}
                                        className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left active:scale-[0.98] transition-all hover:border-blue-200 hover:shadow-md">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">{proj.project_name}</p>
                                                {proj.location && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5">📍 {proj.location}</p>
                                                )}
                                                {proj.client && (
                                                    <p className="text-[10px] text-slate-400">🏢 {proj.client}</p>
                                                )}
                                            </div>
                                            <span className="text-blue-500 font-black text-sm">→</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP 2: INPUT ITEM ── */}
                {step === 'items' && (
                    <div className="space-y-4">
                        {/* Project info */}
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Project</p>
                            <p className="font-black text-slate-800 text-base mt-0.5">{selectedProject?.project_name}</p>
                            <div className="flex gap-4 mt-2">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">Total Item di Site</p>
                                    <p className="text-xs font-black text-slate-700">{cart.length} jenis</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase">Dipilih</p>
                                    <p className="text-xs font-black text-blue-600">{cart.filter(i => i.enabled).length} item</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between ml-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Item yang Dikembalikan
                            </p>
                            <button
                                onClick={() => setCart(prev => {
                                    const allEnabled = prev.every(i => i.enabled);
                                    return prev.map(i => ({ ...i, enabled: !allEnabled }));
                                })}
                                className="text-[10px] font-black text-blue-500 uppercase">
                                {cart.every(i => i.enabled) ? 'Uncheck Semua' : 'Check Semua'}
                            </button>
                        </div>

                        {/* TOOLS items */}
                        {cart.filter(i => i.item_type === 'TOOLS').length > 0 && (
                            <div>
                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2">🔧 Alat / Tools</p>
                                <div className="space-y-3">
                                    {cart.filter(i => i.item_type === 'TOOLS').map(item => (
                                        <ItemCard
                                            key={item.qr_id}
                                            item={item}
                                            locations={locations}
                                            onUpdate={updateCart}
                                            onToggle={toggleItem}
                                            onCompress={compressImage}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MATERIAL items */}
                        {cart.filter(i => i.item_type === 'MATERIAL').length > 0 && (
                            <div>
                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 mt-2">📦 Material</p>
                                <div className="space-y-3">
                                    {cart.filter(i => i.item_type === 'MATERIAL').map(item => (
                                        <ItemCard
                                            key={item.qr_id}
                                            item={item}
                                            locations={locations}
                                            onUpdate={updateCart}
                                            onToggle={toggleItem}
                                            onCompress={compressImage}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                const activeItems = cart.filter(i => i.enabled);
                                if (activeItems.length === 0) { alert('Pilih minimal 1 item.'); return; }
                                setStep('confirm');
                            }}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                            Lanjut Konfirmasi →
                        </button>

                        <button onClick={() => { setStep('select'); setError(''); }}
                            className="w-full bg-slate-100 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase">
                            ← Ganti Project
                        </button>
                    </div>
                )}

                {/* ── STEP 3: KONFIRMASI & SUBMIT ── */}
                {step === 'confirm' && (
                    <div className="space-y-4">
                        {/* Ringkasan */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ringkasan Check In</p>
                                <p className="font-black text-slate-800 text-sm mt-0.5">{selectedProject?.project_name}</p>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {cart.filter(i => i.enabled).map(item => {
                                    const condCfg = getConditionConfig(item.item_type)[item.condition];
                                    const returnStock = isReturnToStock(item.item_type, item.condition);
                                    return (
                                        <div key={item.qr_id} className="px-4 py-3 flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                                                <p className="text-[9px] font-mono text-slate-400">{item.qr_id}</p>
                                            </div>
                                            <div className="text-right ml-3 flex-shrink-0">
                                                <p className="text-xs font-black text-slate-800">{item.qty} {item.unit}</p>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${condCfg?.color}`}>
                                                    {condCfg?.icon} {condCfg?.label}
                                                </span>
                                                <p className="text-[9px] text-slate-400 mt-0.5">
                                                    {returnStock ? `→ ${item.location_name || 'Gudang'}` : '→ Tidak kembali'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Total Item</span>
                                <span className="text-[10px] font-black text-slate-700">{cart.filter(i => i.enabled).length} jenis</span>
                            </div>
                        </div>

                        {/* Form detail */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Check In</p>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Tanggal Check In</label>
                                <input type="date" value={checkinDate} onChange={e => setCheckinDate(e.target.value)}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Nama PIC yang Mengembalikan *</label>
                                <input type="text" placeholder="Nama PIC..." value={picName}
                                    onChange={e => setPicName(e.target.value)}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Catatan (opsional)</label>
                                <input type="text" placeholder="Catatan tambahan..." value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm" />
                            </div>

                            {/* Signature */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tanda Tangan PIC *</label>
                                    <button onClick={clearSig} className="text-[10px] text-blue-500 font-black uppercase">Reset</button>
                                </div>
                                <canvas ref={canvasRef} width={500} height={200}
                                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                    className="w-full h-36 bg-slate-50 rounded-2xl border-2 border-slate-200 touch-none cursor-crosshair" />
                                <p className="text-[9px] text-slate-400 text-center mt-1">Tanda tangan di kotak di atas</p>
                            </div>

                            {error && (
                                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                                    <p className="text-xs font-bold text-red-500 text-center">{error}</p>
                                </div>
                            )}

                            <button onClick={handleSubmit} disabled={submitting}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                {submitting ? '⏳ Menyimpan...' : '✅ SUBMIT CHECK IN PER PROJECT'}
                            </button>
                        </div>

                        <button onClick={() => setStep('items')}
                            className="w-full bg-slate-100 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase">
                            ← Kembali Edit Item
                        </button>
                    </div>
                )}
            </div>
            <Navbar />
        </main>
    );
}

// ── Item Card Component ──
function ItemCard({ item, locations, onUpdate, onToggle, onCompress }: {
    item: any;
    locations: any[];
    onUpdate: (qr_id: string, field: string, value: any) => void;
    onToggle: (qr_id: string) => void;
    onCompress: (file: File) => Promise<string>;
}) {
    const condConfig = getConditionConfig(item.item_type);
    const returnStock = isReturnToStock(item.item_type, item.condition);

    return (
        <div className={`bg-white rounded-2xl shadow-sm border transition-all ${item.enabled ? 'border-slate-100' : 'border-slate-100 opacity-50'}`}>
            {/* Header item */}
            <div className="p-4 flex items-start gap-3">
                <button onClick={() => onToggle(item.qr_id)}
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all
                        ${item.enabled ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                    {item.enabled && <span className="text-white text-[10px] font-black">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 leading-tight">{item.name}</p>
                    <p className="text-[9px] font-mono text-slate-400 mt-0.5">{item.qr_id}</p>
                    <div className="flex gap-3 mt-1">
                        <span className="text-[9px] text-slate-400">📦 Di site: <strong className="text-slate-600">{item.qty_at_site} {item.unit}</strong></span>
                        {item.location_name && (
                            <span className="text-[9px] text-slate-400">📍 {item.location_name}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail (collapsed jika tidak enabled) */}
            {item.enabled && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-50 pt-3">

                    {/* Qty */}
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Qty Dikembalikan *</label>
                        <div className="flex items-center gap-2 mt-1.5">
                            <button onClick={() => onUpdate(item.qr_id, 'qty', Math.max(0, item.qty - 1))}
                                className="w-9 h-9 bg-slate-100 rounded-xl font-black text-slate-600 text-lg flex items-center justify-center active:scale-90">−</button>
                            <input type="number" value={item.qty}
                                onChange={e => {
                                    const v = Math.min(item.qty_at_site, Math.max(0, parseInt(e.target.value) || 0));
                                    onUpdate(item.qr_id, 'qty', v);
                                }}
                                className="flex-1 text-center p-2 bg-slate-50 rounded-xl outline-none font-black text-slate-800 text-base" />
                            <button onClick={() => onUpdate(item.qr_id, 'qty', Math.min(item.qty_at_site, item.qty + 1))}
                                className="w-9 h-9 bg-slate-100 rounded-xl font-black text-slate-600 text-lg flex items-center justify-center active:scale-90">＋</button>
                            <span className="text-[10px] text-slate-400 font-bold">/ {item.qty_at_site} {item.unit}</span>
                        </div>
                    </div>

                    {/* Kondisi */}
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Kondisi *</label>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {Object.entries(condConfig).map(([key, cfg]) => (
                                <button key={key} onClick={() => onUpdate(item.qr_id, 'condition', key)}
                                    className={`flex-1 min-w-[60px] py-2.5 rounded-xl font-black text-[9px] border-2 transition-all active:scale-95
                                        ${item.condition === key ? cfg.color : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                    {cfg.icon}<br />{cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lokasi pengembalian */}
                    {returnStock ? (
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase">Kembalikan ke Lokasi *</label>
                            <select value={item.location_id}
                                onChange={e => {
                                    const loc = locations.find((l: any) => l.id === parseInt(e.target.value));
                                    onUpdate(item.qr_id, 'location_id', e.target.value);
                                    onUpdate(item.qr_id, 'location_name', loc?.location_name || '');
                                }}
                                className="w-full mt-1.5 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none">
                                <option value="">-- Pilih Lokasi --</option>
                                {locations.map((l: any) => (
                                    <option key={l.id} value={l.id}>{l.location_name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                            <p className="text-[9px] text-slate-400 font-bold">
                                {item.condition === 'LOST' ? '❌ Hilang — tidak kembali ke stok'
                                    : item.condition === 'USED' ? '✅ Terpakai — tidak kembali ke stok'
                                        : '⚠️ Rusak — tidak kembali ke stok'}
                            </p>
                        </div>
                    )}

                    {/* Foto */}
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase">Foto Kondisi (opsional)</label>
                        <div className="flex items-center gap-3 mt-1.5">
                            <label className="px-3 py-2 bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl cursor-pointer active:scale-95">
                                📷 Upload
                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                    onChange={async e => {
                                        const file = e.target.files?.[0]; if (!file) return;
                                        const b64 = await onCompress(file);
                                        onUpdate(item.qr_id, 'photo_base64', b64);
                                    }} />
                            </label>
                            {item.photo_base64 && (
                                <div className="relative">
                                    <img src={item.photo_base64} className="w-14 h-14 object-cover rounded-xl border border-slate-200" alt="preview" />
                                    <button onClick={() => onUpdate(item.qr_id, 'photo_base64', '')}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-black">✕</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Note */}
                    <input type="text" placeholder="Catatan kondisi (opsional)..."
                        value={item.note} onChange={e => onUpdate(item.qr_id, 'note', e.target.value)}
                        className="w-full p-2.5 bg-slate-50 rounded-xl outline-none text-sm font-medium text-slate-700" />
                </div>
            )}
        </div>
    );
}

export default function CheckInProjectPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <CheckInProjectContent />
        </Suspense>
    );
}
