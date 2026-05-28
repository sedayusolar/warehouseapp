'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import FloatingMenu from '../components/FloatingMenu';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE = "https://sedayu.com/api/warehouse";

function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');

    const [user, setUser] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const cartRef = useRef<any[]>([]);
    const setCartAndRef = (updater: any) => {
        setCart(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            cartRef.current = next;
            return next;
        });
    };
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [projectName, setProjectName] = useState('');
    const [showAddProject, setShowAddProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [savingProject, setSavingProject] = useState(false);
    const [picName, setPicName] = useState('');
    const [checkoutDate, setCheckoutDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingDraft, setFetchingDraft] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const searchTimeout = useRef<any>(null);

    // TTD Staff
    const staffCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isStaffDrawing, setIsStaffDrawing] = useState(false);

    // Location picker
    const [pendingItem, setPendingItem] = useState<any>(null);

    // Import dari PO
    const [showPoModal, setShowPoModal] = useState(false);
    const [poList, setPoList] = useState<any[]>([]);
    const [loadingPo, setLoadingPo] = useState(false);
    const [selectedPo, setSelectedPo] = useState<any>(null);
    const [poDetail, setPoDetail] = useState<any>(null);
    const [loadingPoDetail, setLoadingPoDetail] = useState(false);
    const [poSelection, setPoSelection] = useState<Record<number, { checked: boolean, qty: number }>>({});
    const [importing, setImporting] = useState(false);

    useEffect(() => { cartRef.current = cart; }, [cart]);

    const fetchApprovedPO = async () => {
        setLoadingPo(true);
        try {
            const res = await fetch(`${BASE}/get_purchase_list.php?status=APPROVED`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setPoList(r.data);
        } catch { }
        setLoadingPo(false);
    };

    const fetchPoDetail = async (po: any) => {
        setSelectedPo(po); setPoDetail(null); setLoadingPoDetail(true); setPoSelection({});
        try {
            const res = await fetch(`${BASE}/get_purchase_list.php?id=${po.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setPoDetail(r);
                const sel: Record<number, { checked: boolean, qty: number }> = {};
                r.items?.forEach((item: any) => { sel[item.id] = { checked: true, qty: item.qty }; });
                setPoSelection(sel);
            }
        } catch { }
        setLoadingPoDetail(false);
    };

    const importFromPO = async () => {
        if (!poDetail) return;
        setImporting(true);
        let skipped = 0;
        const newItems: any[] = [];
        const selectedItems = poDetail.items.filter((item: any) => poSelection[item.id]?.checked);
        for (const item of selectedItems) {
            const qty = poSelection[item.id]?.qty || item.qty;
            if (qty <= 0) continue;
            try {
                const res = await fetch(`${BASE}/search_inventory.php?q=${encodeURIComponent(item.qr_id)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                if (r.status !== 'success' || !r.data?.length) { skipped++; continue; }
                const inv = r.data.find((d: any) => d.qr_id === item.qr_id) || r.data[0];
                const loc = inv.locations?.find((l: any) => String(l.location_id) === String(item.location_id) && l.available_qty > 0)
                    || inv.locations?.find((l: any) => l.available_qty > 0);
                if (!loc) { skipped++; continue; }
                const alreadyInCart = cartRef.current.find((c: any) => c.qr_id === inv.qr_id && String(c.location_id) === String(loc.location_id));
                const alreadyInNew = newItems.find(c => c.qr_id === inv.qr_id && String(c.location_id) === String(loc.location_id));
                if (alreadyInCart || alreadyInNew) { skipped++; continue; }
                newItems.push({
                    qr_id: inv.qr_id, name: inv.item_name, type: (inv.category || '').toUpperCase(),
                    stock_qty: inv.stock_qty, available_qty: loc.available_qty, reserved_qty: loc.reserved_qty || 0,
                    location_id: String(loc.location_id), location_name: loc.location_name,
                    locations: inv.locations, qty: qty, photo_base64: '',
                });
            } catch { skipped++; }
        }
        if (newItems.length > 0) setCartAndRef((prev: any[]) => [...prev, ...newItems]);
        setImporting(false);
        setShowPoModal(false); setSelectedPo(null); setPoDetail(null); setPoSelection({});
        if (newItems.length > 0) alert(`✅ ${newItems.length} item berhasil diimport!${skipped > 0 ? `\n⚠️ ${skipped} item dilewati.` : ''}`);
        else alert("Tidak ada item yang bisa diimport.");
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

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role === 'MANAGER' || parsed.role === 'ENGINEER') {
            alert(`${parsed.role} tidak bisa checkout.`);
            router.push('/transactions'); return;
        }
        setUser(parsed);
    }, []);

    useEffect(() => {
        fetch(`${BASE}/get_projects.php`, { headers: { 'X-API-KEY': API_KEY } })
            .then(r => r.json()).then(r => { if (r.status === 'success') setProjects(r.data); });
    }, []);

    useEffect(() => {
        if (!editId) return;
        setFetchingDraft(true);
        fetch(`${BASE}/get_transaction_detail.php?id=${editId}`, { headers: { 'X-API-KEY': API_KEY } })
            .then(r => r.json()).then(r => {
                if (r.status === 'success') {
                    setProjectName(r.header.project_name);
                    if (r.header.project_id) setSelectedProjectId(String(r.header.project_id));
                    setPicName(r.header.pic_name || '');
                    setCheckoutDate(r.header.checkout_date);
                    setCart(r.items.map((item: any) => ({
                        qr_id: item.qr_id, name: item.item_name, type: item.item_type,
                        qty: item.qty, stock_qty: item.stock_qty, reserved_qty: 0,
                        available_qty: item.stock_qty, location_id: item.location_id || '',
                        location_name: item.location_name || '', locations: [], photo_base64: ''
                    })));
                }
            }).finally(() => setFetchingDraft(false));
    }, [editId]);

    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render((text: string) => {
                setShowScanner(false); playBeep('success'); fetchAndPend(text);
            }, () => { });
        }
        return () => { if (scanner) scanner.clear().catch(() => { }); };
    }, [showScanner]);

    function playBeep(type: 'success' | 'error' | 'warning') {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const configs: any = {
                success: { freq: [880, 1320], duration: 0.12, gain: 0.3 },
                error: { freq: [300, 200], duration: 0.25, gain: 0.4 },
                warning: { freq: [600, 600], duration: 0.18, gain: 0.3 },
            };
            const { freq, duration, gain } = configs[type];
            freq.forEach((f: number, i: number) => {
                const osc = ctx.createOscillator(); const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = f; osc.type = 'sine';
                g.gain.setValueAtTime(gain, ctx.currentTime + i * duration);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * duration + duration);
                osc.start(ctx.currentTime + i * duration); osc.stop(ctx.currentTime + i * duration + duration);
            });
        } catch { }
    }

    const fetchAndPend = async (qrId: string) => {
        try {
            const res = await fetch(`${BASE}/get_item_by_qr.php?qr=${encodeURIComponent(qrId)}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                if ((r.data.available_qty ?? r.data.stock_qty) <= 0) alert(`⚠️ STOK HABIS: ${r.data.item_name}`);
                setPendingItem(r.data);
            } else { playBeep('error'); alert(r.message); }
        } catch { playBeep('error'); alert("Gagal koneksi server."); }
    };

    const confirmLocation = (loc: any) => {
        if (!pendingItem) return;
        if (cart.find(i => i.qr_id === pendingItem.qr_id && String(i.location_id) === String(loc.location_id))) {
            alert(`${pendingItem.item_name} dari ${loc.location_name} sudah ada di list!`); return;
        }
        setCart(prev => [...prev, {
            qr_id: pendingItem.qr_id, name: pendingItem.item_name, type: (pendingItem.category || '').toUpperCase(),
            qty: 1, stock_qty: pendingItem.stock_qty, reserved_qty: pendingItem.reserved_qty ?? 0,
            available_qty: loc.available_qty ?? loc.stock_qty, location_id: loc.location_id,
            location_name: loc.location_name, locations: pendingItem.locations ?? [], photo_base64: ''
        }]);
        setPendingItem(null);
    };

    const handleSearchInput = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.trim().length < 2) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${BASE}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                setSearchResults(r.status === 'success' ? r.data : []);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 400);
    };

    const handleSelectSearch = (item: any) => {
        setSearchQuery(''); setSearchResults([]); setShowSearch(false);
        if (item.locations?.length > 0) { setPendingItem(item); }
        else {
            setCart(prev => [...prev, {
                qr_id: item.qr_id, name: item.item_name, type: (item.category || '').toUpperCase(),
                qty: 1, stock_qty: item.stock_qty, reserved_qty: item.reserved_qty ?? 0,
                available_qty: item.available_qty ?? item.stock_qty, location_id: '', location_name: '',
                locations: [], photo_base64: ''
            }]);
        }
    };

    const handleAddNewProject = async () => {
        if (!newProjectName.trim()) { alert("Nama project kosong!"); return; }
        setSavingProject(true);
        try {
            const res = await fetch(`${BASE}/add_project.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ project_name: newProjectName.trim() })
            });
            const r = await res.json();
            if (r.status === 'success') {
                setProjects(prev => [...prev, { id: r.id, project_name: newProjectName.trim() }]);
                setSelectedProjectId(String(r.id)); setProjectName(newProjectName.trim());
                setNewProjectName(''); setShowAddProject(false);
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSavingProject(false);
    };

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__add_new__') { setShowAddProject(true); setSelectedProjectId(''); setProjectName(''); }
        else { setShowAddProject(false); setSelectedProjectId(val); const f = projects.find(p => String(p.id) === val); setProjectName(f ? f.project_name : ''); }
    };

    // ─── TTD Staff drawing ───
    const startStaffDrawing = (e: any) => {
        const canvas = staffCanvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(x, y); setIsStaffDrawing(true);
    };
    const drawStaff = (e: any) => {
        if (!isStaffDrawing) return;
        const canvas = staffCanvasRef.current; const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke();
        if (e.touches) e.preventDefault();
    };

    const handleSubmit = async (isDraft = false) => {
        if (!projectName || !selectedProjectId || !checkoutDate || cart.length === 0) {
            alert("Data belum lengkap! Pastikan project, tanggal, dan barang sudah diisi."); return;
        }
        if (!isDraft) {
            for (const item of cart) {
                if (!item.location_id) { alert(`Pilih lokasi untuk: ${item.name}`); return; }
                if (Number(item.qty) > Number(item.available_qty)) {
                    alert(`❌ STOK TIDAK CUKUP: ${item.name}\nTersedia: ${item.available_qty}`); return;
                }
            }
            if (!picName) { alert("Nama PIC Penerima wajib diisi!"); return; }

            // Validasi TTD Staff
            const staffSig = staffCanvasRef.current?.toDataURL('image/png');
            if (!staffSig || staffSig.length < 2000) {
                alert("TTD Staff/Pengirim wajib diisi!"); return;
            }
        }

        const staffSig = staffCanvasRef.current?.toDataURL('image/png');

        setLoading(true);
        try {
            const res = await fetch(`${BASE}/checkout.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    id: editId,
                    project_id: selectedProjectId,
                    project_name: projectName,
                    pic_name: picName,
                    staff_name: user?.name || '',
                    checkout_date: checkoutDate,
                    signature_base64: '',            // TTD PIC — diisi Engineer nanti
                    staff_signature_base64: isDraft ? '' : (staffSig || ''),
                    transaction_status: isDraft ? 'DRAFT' : 'SUBMITTED',
                    items: cart.map(i => ({
                        qr_id: i.qr_id, qty: i.qty,
                        location_id: i.location_id, location_name: i.location_name,
                        photo_base64: i.photo_base64
                    }))
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(isDraft ? "Draft tersimpan!" : "✅ Submit Berhasil!\nPIC akan menandatangani setelah barang diterima di site.");
                router.push('/transactions');
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setLoading(false);
    };

    const cartItemKey = (item: any) => `${item.qr_id}__${item.location_id || 'noloc'}`;

    const renderCartItem = (item: any) => {
        const reserved = Number(item.reserved_qty ?? 0);
        const available = Number(item.available_qty ?? item.stock_qty);
        const stockFisik = Number(item.stock_qty ?? 0);
        const isUnavailable = available <= 0;
        const isInsufficient = Number(item.qty) > available && available > 0;
        const isOk = !isUnavailable && !isInsufficient;

        return (
            <div key={cartItemKey(item)} className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 transition-all
                ${isUnavailable || isInsufficient ? 'border-l-red-400' : item.type === 'MATERIAL' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-x-3 mt-1">
                            <span className="text-[10px] text-slate-400 font-bold">Stok Gudang: <span className="text-slate-600">{stockFisik}</span></span>
                            {reserved > 0 && <span className="text-[10px] font-black text-orange-500">⏳ {reserved} pending</span>}
                        </div>
                        {isUnavailable && <div className="mt-1.5 bg-red-50 px-2.5 py-1.5 rounded-lg"><span className="text-[10px] font-black text-red-600">❌ Stok tidak tersedia</span></div>}
                        {isInsufficient && <div className="mt-1.5 bg-orange-50 px-2.5 py-1.5 rounded-lg"><span className="text-[10px] font-black text-orange-600">⚠️ Melebihi stok tersedia ({available})</span></div>}
                        {isOk && reserved > 0 && <div className="mt-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-lg"><span className="text-[10px] font-bold text-emerald-600">✓ Tersedia: {available}</span></div>}
                        {isOk && reserved === 0 && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Tersedia: {available}</p>}

                        <div className="mt-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Lokasi Pengambilan</label>
                            <select value={item.location_id || ''}
                                onChange={e => {
                                    const loc = item.locations?.find((l: any) => String(l.location_id) === e.target.value);
                                    setCart(prev => prev.map(c => c.qr_id === item.qr_id
                                        ? { ...c, location_id: e.target.value, location_name: loc?.location_name || '', available_qty: loc?.available_qty ?? 0 }
                                        : c));
                                }}
                                className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-600 appearance-none">
                                <option value="">-- Pilih Lokasi --</option>
                                {item.locations?.filter((l: any) => l.stock_qty > 0).map((l: any) => (
                                    <option key={l.location_id} value={l.location_id} disabled={l.available_qty <= 0}>
                                        {l.location_name} ({l.available_qty} tersedia{l.reserved_qty > 0 ? `, ${l.reserved_qty} pending` : ''})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {item.locations?.length > 1 && (
                            <button onClick={() => setPendingItem({
                                qr_id: item.qr_id, item_name: item.name, category: item.type,
                                stock_qty: item.stock_qty, reserved_qty: item.reserved_qty,
                                available_qty: item.available_qty, locations: item.locations
                            })} className="mt-1.5 text-[10px] font-black text-blue-500 uppercase tracking-widest active:opacity-70">
                                ＋ Tambah dari Lokasi Lain
                            </button>
                        )}

                        <div className="mt-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase">Foto Kondisi Barang</label>
                            <div className="flex items-center gap-2 mt-1">
                                <label className="px-2.5 py-1.5 bg-slate-100 text-slate-500 font-black text-[10px] rounded-lg cursor-pointer active:scale-95">
                                    📷 Upload
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                        onChange={async e => {
                                            const file = e.target.files?.[0]; if (!file) return;
                                            const b64 = await compressImage(file);
                                            setCart(prev => prev.map(c => cartItemKey(c) === cartItemKey(item) ? { ...c, photo_base64: b64 } : c));
                                        }} />
                                </label>
                                {item.photo_base64 && (
                                    <div className="relative">
                                        <img src={item.photo_base64} alt="preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                                        <button onClick={() => setCart(prev => prev.map(c => cartItemKey(c) === cartItemKey(item) ? { ...c, photo_base64: '' } : c))}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">✕</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <input type="number" min="1" value={item.qty}
                            onChange={(e: any) => { const nc = [...cart]; const idx = nc.findIndex(it => cartItemKey(it) === cartItemKey(item)); if (idx >= 0) { nc[idx].qty = e.target.value; setCart(nc); } }}
                            className={`w-12 text-center border-2 rounded-lg font-black py-1 ${isInsufficient ? 'border-red-400 text-red-500' : 'text-blue-600'}`} />
                        <button onClick={() => setCart(cart.filter(i => cartItemKey(i) !== cartItemKey(item)))} className="text-red-300 font-black p-1">✕</button>
                    </div>
                </div>
            </div>
        );
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans relative">

            {/* PO IMPORT MODAL */}
            {showPoModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => { setShowPoModal(false); setSelectedPo(null); setPoDetail(null); }}>
                    <div className="flex-1 overflow-y-auto mt-12" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-32 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Import Item</p>
                                    <h2 className="font-black text-lg text-slate-900">Pilih Purchase Order</h2>
                                </div>
                                <button onClick={() => { setShowPoModal(false); setSelectedPo(null); setPoDetail(null); }} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>
                            {!selectedPo ? (
                                loadingPo ? <p className="text-center animate-pulse text-slate-400 py-8">Memuat PO...</p>
                                    : poList.length === 0 ? <p className="text-center text-slate-400 italic py-8">Tidak ada PO yang sudah diapprove.</p>
                                        : (
                                            <div className="space-y-2">
                                                {poList.map((po: any) => (
                                                    <button key={po.id} onClick={() => fetchPoDetail(po)}
                                                        className="w-full bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left hover:bg-teal-50 hover:border-teal-300 transition-all">
                                                        <p className="font-bold text-sm text-slate-800">{po.po_code}</p>
                                                        {po.supplier && <p className="text-[10px] text-slate-500">🏪 {po.supplier}</p>}
                                                        <p className="text-[10px] text-slate-400">{po.po_date} · {po.total_items} item</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )
                            ) : (
                                <div className="space-y-4">
                                    <button onClick={() => { setSelectedPo(null); setPoDetail(null); }} className="text-[10px] font-black text-blue-500 uppercase">← Kembali</button>
                                    {loadingPoDetail ? <p className="text-center animate-pulse text-slate-400 py-4">Memuat detail...</p>
                                        : poDetail && (
                                            <>
                                                <div className="flex justify-between items-center">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">{Object.values(poSelection).filter((s: any) => s.checked).length} dipilih</p>
                                                    <button onClick={() => {
                                                        const allChecked = poDetail.items.every((i: any) => poSelection[i.id]?.checked);
                                                        const sel: Record<number, { checked: boolean, qty: number }> = {};
                                                        poDetail.items.forEach((i: any) => { sel[i.id] = { checked: !allChecked, qty: poSelection[i.id]?.qty || i.qty }; });
                                                        setPoSelection(sel);
                                                    }} className="text-[10px] font-black text-blue-500 uppercase">
                                                        {poDetail.items.every((i: any) => poSelection[i.id]?.checked) ? 'Batal Semua' : 'Pilih Semua'}
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {poDetail.items?.map((item: any) => {
                                                        const sel = poSelection[item.id] || { checked: true, qty: item.qty };
                                                        return (
                                                            <div key={item.id} className={`rounded-2xl p-3.5 border-2 transition-all ${sel.checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                                                                <div className="flex items-start gap-3">
                                                                    <button onClick={() => setPoSelection(prev => ({ ...prev, [item.id]: { ...sel, checked: !sel.checked } }))}
                                                                        className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-sm mt-0.5 ${sel.checked ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                                                        {sel.checked ? '✓' : ''}
                                                                    </button>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                                        <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                                    </div>
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <button onClick={() => setPoSelection(prev => ({ ...prev, [item.id]: { checked: sel.checked, qty: Math.max(1, sel.qty + 1) } }))} className="w-7 h-7 bg-slate-200 rounded-lg font-black text-sm">＋</button>
                                                                        <input type="number" min="1" value={sel.qty}
                                                                            onChange={e => setPoSelection(prev => ({ ...prev, [item.id]: { checked: sel.checked, qty: Math.max(1, Number(e.target.value)) } }))}
                                                                            className="w-12 text-center font-black text-blue-600 text-sm border border-slate-200 rounded-lg py-0.5 outline-none" />
                                                                        <button onClick={() => setPoSelection(prev => ({ ...prev, [item.id]: { checked: sel.checked, qty: Math.max(1, sel.qty - 1) } }))} className="w-7 h-7 bg-slate-200 rounded-lg font-black text-sm">－</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button onClick={importFromPO} disabled={importing}
                                                    className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest disabled:opacity-50">
                                                    {importing ? '⏳ Mengimport...' : `✓ Import ${Object.values(poSelection).filter((s: any) => s.checked).length} Item`}
                                                </button>
                                            </>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* LOCATION PICKER MODAL */}
            {pendingItem && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4" onClick={() => setPendingItem(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Lokasi Pengambilan</p>
                            <p className="font-bold text-slate-800 mt-1">{pendingItem.item_name}</p>
                        </div>
                        <div className="space-y-2">
                            {pendingItem.locations?.map((loc: any) => (
                                <button key={loc.location_id} onClick={() => confirmLocation(loc)}
                                    disabled={loc.available_qty <= 0}
                                    className={`w-full flex justify-between items-center p-4 rounded-2xl border-2 transition-all active:scale-95
                                        ${loc.available_qty > 0 ? 'border-slate-200 hover:border-blue-400 hover:bg-blue-50' : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'}`}>
                                    <p className="font-bold text-sm text-slate-800">📍 {loc.location_name}</p>
                                    <p className={`font-black text-lg ${loc.available_qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{loc.available_qty}</p>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setPendingItem(null)} className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">Batal</button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div>
                    <h1 className="text-xl font-bold">{editId ? 'Lanjutkan Draft' : 'Checkout'}</h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">User: {user.name} ({user.role})</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 p-2 rounded-full text-xs font-black">✕</button>
            </div>

            <div className="p-4 space-y-6">
                {fetchingDraft ? (
                    <div className="text-center py-20 font-bold animate-pulse text-slate-400">LOADING...</div>
                ) : (
                    <>
                        {/* TAMBAH BARANG */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Barang</p>
                            {!showScanner ? (
                                <button onClick={() => { setShowScanner(true); setShowSearch(false); }}
                                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 uppercase tracking-widest text-sm">
                                    📷 SCAN QR CODE
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
                                    <button onClick={() => setShowScanner(false)} className="w-full text-red-500 font-bold text-xs uppercase">Batal Scan</button>
                                </div>
                            )}
                            {!showScanner && (
                                <div className="space-y-2">
                                    <button onClick={() => { setShowPoModal(true); fetchApprovedPO(); setShowSearch(false); }}
                                        className="w-full bg-teal-600 text-white font-black py-3 rounded-2xl active:scale-95 uppercase tracking-widest text-xs shadow-md">
                                        📋 IMPORT DARI PO
                                    </button>
                                    <button onClick={() => setShowSearch(v => !v)}
                                        className="w-full bg-slate-200 text-slate-700 font-black py-3 rounded-2xl active:scale-95 uppercase tracking-widest text-xs">
                                        🔍 {showSearch ? 'TUTUP PENCARIAN' : 'CARI BARANG MANUAL'}
                                    </button>
                                    {showSearch && (
                                        <div className="mt-3 space-y-2">
                                            <input type="text" value={searchQuery} onChange={e => handleSearchInput(e.target.value)}
                                                placeholder="Ketik nama barang / kode..."
                                                className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:border-blue-400"
                                                autoFocus />
                                            {searching && <p className="text-center text-xs text-slate-400 animate-pulse py-2">Mencari...</p>}
                                            {!searching && searchResults.length > 0 && (
                                                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                                    {searchResults.map((item: any) => (
                                                        <button key={item.qr_id} onClick={() => handleSelectSearch(item)} className="w-full text-left p-3.5 hover:bg-blue-50">
                                                            <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CART */}
                        <div className="space-y-8">
                            {cart.filter(i => i.type === 'MATERIAL').length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">📦 Material</h3>
                                    {cart.filter(i => i.type === 'MATERIAL').map(item => renderCartItem(item))}
                                </div>
                            )}
                            {cart.filter(i => i.type === 'TOOLS').length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">🛠️ Tools</h3>
                                    {cart.filter(i => i.type === 'TOOLS').map(item => renderCartItem(item))}
                                </div>
                            )}
                        </div>

                        {/* FORM DETAIL */}
                        {cart.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4">
                                <input type="date" value={checkoutDate} onChange={(e: any) => setCheckoutDate(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Proyek</label>
                                    <select value={selectedProjectId} onChange={handleProjectChange}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 border-0 appearance-none cursor-pointer">
                                        <option value="">-- Pilih Project --</option>
                                        {projects.map((p: any) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
                                        <option value="__add_new__">➕ Tambah Project Baru...</option>
                                    </select>
                                    {showAddProject && (
                                        <div className="bg-blue-50 p-4 rounded-2xl space-y-3 border border-blue-100">
                                            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                                                placeholder="Nama project baru..." autoFocus
                                                className="w-full p-3 bg-white rounded-xl outline-none font-medium text-slate-700 border border-blue-200" />
                                            <div className="flex gap-2">
                                                <button onClick={() => { setShowAddProject(false); setNewProjectName(''); setSelectedProjectId(''); }}
                                                    className="flex-1 bg-slate-100 text-slate-500 font-black py-2.5 rounded-xl text-xs">Batal</button>
                                                <button onClick={handleAddNewProject} disabled={savingProject}
                                                    className="flex-1 bg-blue-600 text-white font-black py-2.5 rounded-xl text-xs disabled:opacity-50">
                                                    {savingProject ? 'Menyimpan...' : '✓ Simpan'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* PIC Penerima */}
                                <div className="space-y-1">
                                    <input type="text" placeholder="Nama PIC Penerima" value={picName}
                                        onChange={(e: any) => setPicName(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                    <p className="text-[10px] text-slate-400 ml-1">
                                        ✍️ TTD PIC akan dilakukan oleh Engineer setelah barang diterima di site
                                    </p>
                                </div>

                                {/* TTD STAFF/PENGIRIM */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-700 uppercase">TTD Pengirim (Staff)</label>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Nama: <span className="font-bold text-slate-600">{user?.name}</span></p>
                                        </div>
                                        <button onClick={() => staffCanvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)}
                                            className="text-[10px] text-blue-500 font-bold">RESET</button>
                                    </div>
                                    <canvas
                                        ref={staffCanvasRef}
                                        width={500} height={250}
                                        onMouseDown={startStaffDrawing} onMouseMove={drawStaff} onMouseUp={() => setIsStaffDrawing(false)}
                                        onTouchStart={startStaffDrawing} onTouchMove={drawStaff} onTouchEnd={() => setIsStaffDrawing(false)}
                                        className="w-full h-44 bg-slate-50 rounded-2xl border-2 border-slate-200 touch-none shadow-inner" />
                                    <p className="text-[9px] text-slate-400 text-center">Tanda tangani sebagai pengirim barang</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button onClick={() => handleSubmit(true)} disabled={loading}
                                        className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl text-[10px] tracking-widest active:scale-95 transition-all">
                                        SIMPAN DRAFT
                                    </button>
                                    <button onClick={() => handleSubmit(false)} disabled={loading}
                                        className="bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                        {loading ? 'MEMPROSES...' : 'SUBMIT RESMI'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-50 p-4 pb-6">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')} className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95">🏠 Menu Utama</button>
                    <button onClick={() => router.push('/transactions')} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95">📋 Riwayat Transaksi</button>
                </div>
            </div>
            <FloatingMenu />
        </main>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CheckoutContent />
        </Suspense>
    );
}
