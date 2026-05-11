'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE = "https://sedayu.com/api/warehouse";

// Cart item: qr_id, name, type, qty, location_id, location_name, available_qty, locations[]
function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');

    const [user, setUser] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
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
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<any>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Location picker state — item yang sedang menunggu pilih lokasi
    const [pendingItem, setPendingItem] = useState<any>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role === 'MANAGER') { alert("Manager tidak bisa checkout."); router.push('/transactions'); }
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
                        qty: item.qty, location_id: item.location_id, location_name: item.location_name,
                        available_qty: item.stock_qty, locations: [], photo_base64: ''
                    })));
                }
            }).finally(() => setFetchingDraft(false));
    }, [editId]);

    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render((text: string) => { setShowScanner(false); fetchAndPendItem(text); }, () => { });
        }
        return () => { if (scanner) scanner.clear().catch(() => { }); };
    }, [showScanner]);

    // Fetch item data lalu tampilkan location picker
    const fetchAndPendItem = async (qrId: string) => {
        if (cart.find(i => i.qr_id === qrId)) { alert("Barang sudah ada di list!"); return; }
        try {
            const res = await fetch(`${BASE}/get_item_by_qr.php?qr=${qrId}`, { headers: { 'X-API-KEY': API_KEY } });
            const result = await res.json();
            if (result.status === 'success') {
                if (result.data.available_qty <= 0) {
                    alert(`⚠️ STOK HABIS: ${result.data.item_name}`);
                }
                setPendingItem(result.data); // tampilkan location picker
            } else { alert(result.message); }
        } catch { alert("Gagal koneksi server."); }
    };

    // Setelah user pilih lokasi dari pendingItem
    const handleConfirmLocation = (loc: any) => {
        if (!pendingItem) return;
        setCart(prev => [...prev, {
            qr_id: pendingItem.qr_id,
            name: pendingItem.item_name,
            type: (pendingItem.category || '').toUpperCase(),
            qty: 1,
            location_id: loc.location_id,
            location_name: loc.location_name,
            available_qty: loc.available_qty,
            locations: pendingItem.locations,
            photo_base64: ''
        }]);
        setPendingItem(null);
    };

    // Search
    const handleSearchInput = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.trim().length < 2) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${BASE}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const result = await res.json();
                setSearchResults(result.status === 'success' ? result.data : []);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 400);
    };

    const handleSelectSearchResult = (item: any) => {
        if (cart.find(i => i.qr_id === item.qr_id)) { alert("Barang sudah ada di list!"); return; }
        setSearchQuery(''); setSearchResults([]); setShowSearch(false);
        setPendingItem(item); // tampilkan location picker
    };

    // Project
    const handleAddNewProject = async () => {
        if (!newProjectName.trim()) { alert("Nama project kosong!"); return; }
        setSavingProject(true);
        try {
            const res = await fetch(`${BASE}/add_project.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ project_name: newProjectName.trim() })
            });
            const result = await res.json();
            if (result.status === 'success') {
                setProjects(prev => [...prev, { id: result.id, project_name: newProjectName.trim() }]);
                setSelectedProjectId(String(result.id));
                setProjectName(newProjectName.trim());
                setNewProjectName(''); setShowAddProject(false);
            } else alert("Gagal: " + result.message);
        } catch { alert("Gagal koneksi."); }
        setSavingProject(false);
    };

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__add_new__') { setShowAddProject(true); setSelectedProjectId(''); setProjectName(''); }
        else { setShowAddProject(false); setSelectedProjectId(val); const f = projects.find(p => String(p.id) === val); setProjectName(f ? f.project_name : ''); }
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
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke(); if (e.touches) e.preventDefault();
    };

    const handleSubmit = async (isDraft = false) => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (!projectName || !selectedProjectId || !checkoutDate || cart.length === 0) {
            alert("Data belum lengkap!"); return;
        }
        if (!isDraft) {
            for (const item of cart) {
                if (!item.location_id) { alert(`Pilih lokasi untuk: ${item.name}`); return; }
                if (Number(item.qty) > Number(item.available_qty)) { alert(`❌ Stok tidak cukup: ${item.name} di ${item.location_name}`); return; }
            }
            if (!picName || !signatureBase64 || signatureBase64.length < 2000) { alert("PIC & TTD wajib!"); return; }
        }
        setLoading(true);
        try {
            const res = await fetch(`${BASE}/checkout.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    id: editId, project_id: selectedProjectId, project_name: projectName,
                    pic_name: picName, checkout_date: checkoutDate,
                    signature_base64: isDraft ? '' : signatureBase64,
                    transaction_status: isDraft ? 'DRAFT' : 'SUBMITTED',
                    items: cart.map(i => ({ qr_id: i.qr_id, qty: i.qty, location_id: i.location_id, location_name: i.location_name, photo_base64: i.photo_base64 }))
                })
            });
            const result = await res.json();
            if (result.status === 'success') { alert(isDraft ? "Draft tersimpan!" : "Submit Berhasil!"); router.push('/transactions'); }
            else alert("Gagal: " + result.message);
        } catch { alert("Gagal koneksi."); }
        setLoading(false);
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans relative">
            {/* HEADER */}
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-lg sticky top-0 z-20">
                <div>
                    <h1 className="text-xl font-bold">{editId ? 'Lanjutkan Draft' : 'Checkout'}</h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">User: {user.name} ({user.role})</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 p-2 rounded-full text-xs font-black">✕</button>
            </div>

            {/* LOCATION PICKER MODAL */}
            {pendingItem && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4" onClick={() => setPendingItem(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Lokasi Pengambilan</p>
                            <p className="font-bold text-slate-800 mt-1">{pendingItem.item_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{pendingItem.qr_id}</p>
                        </div>
                        <div className="space-y-2">
                            {pendingItem.locations?.filter((l: any) => l.stock_qty > 0).length === 0 ? (
                                <p className="text-center text-sm text-red-500 font-bold py-4">Tidak ada stok tersedia di lokasi manapun.</p>
                            ) : (
                                pendingItem.locations?.map((loc: any) => (
                                    <button
                                        key={loc.location_id}
                                        onClick={() => handleConfirmLocation(loc)}
                                        disabled={loc.available_qty <= 0}
                                        className={`w-full flex justify-between items-center p-4 rounded-2xl border-2 transition-all active:scale-95
                                            ${loc.available_qty > 0
                                                ? 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                                                : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'}`}
                                    >
                                        <div className="text-left">
                                            <p className="font-bold text-sm text-slate-800">📍 {loc.location_name}</p>
                                            {loc.reserved_qty > 0 && <p className="text-[10px] text-orange-500 font-bold">⏳ {loc.reserved_qty} pending</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-black text-lg ${loc.available_qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{loc.available_qty}</p>
                                            <p className="text-[9px] text-slate-400">tersedia</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <button onClick={() => setPendingItem(null)} className="w-full bg-slate-100 text-slate-500 font-black py-3 rounded-2xl text-xs uppercase">Batal</button>
                    </div>
                </div>
            )}

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
                                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                                    📷 SCAN QR CODE
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
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
                                        <div className="mt-3 space-y-2">
                                            <input type="text" value={searchQuery} onChange={e => handleSearchInput(e.target.value)}
                                                placeholder="Ketik nama barang / kode..."
                                                className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:border-blue-400 transition-colors"
                                                autoFocus />
                                            {searching && <p className="text-center text-xs text-slate-400 animate-pulse py-2">Mencari...</p>}
                                            {!searching && searchResults.length > 0 && (
                                                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                                    {searchResults.map((item: any) => (
                                                        <button key={item.qr_id} onClick={() => handleSelectSearchResult(item)}
                                                            className="w-full text-left p-3.5 hover:bg-blue-50 transition-colors flex justify-between items-center gap-2">
                                                            <div>
                                                                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                                <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                                                {item.locations?.length > 0 && (
                                                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                                                        {item.locations.map((l: any) => `${l.location_name}: ${l.available_qty}`).join(' · ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0 ${item.available_qty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                                                                Total: {item.available_qty}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                                                <p className="text-center text-xs text-slate-400 py-3">Tidak ada barang ditemukan.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CART */}
                        <div className="space-y-8">
                            {['MATERIAL', 'TOOLS'].map(cat => {
                                const group = cart.filter(i => i.type === cat);
                                if (!group.length) return null;
                                return (
                                    <div key={cat} className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                                            {cat === 'MATERIAL' ? '📦' : '🛠️'} {cat}
                                        </h3>
                                        {group.map((item: any) => {
                                            const reserved = item.locations?.find((l: any) => String(l.location_id) === String(item.location_id))?.reserved_qty ?? 0;
                                            const stockAtLoc = item.locations?.find((l: any) => String(l.location_id) === String(item.location_id))?.stock_qty ?? 0;
                                            const isUnavailable = item.location_id && item.available_qty <= 0;
                                            const isInsufficient = item.location_id && Number(item.qty) > item.available_qty;
                                            return (
                                                <div key={item.qr_id} className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 transition-all
                                                ${isUnavailable || isInsufficient ? 'border-l-red-400 bg-red-50/30' : cat === 'MATERIAL' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1">
                                                            <p className="font-bold text-sm text-slate-800">{item.name}</p>

                                                            {/* Stok info — tampil sebelum pilih lokasi */}
                                                            {!item.location_id && item.locations?.length > 0 && (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {item.locations.map((l: any) => (
                                                                        <span key={l.location_id} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${l.available_qty > 0 ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-400'}`}>
                                                                            📍 {l.location_name}: {l.available_qty} tersedia
                                                                            {l.reserved_qty > 0 && ` (${l.reserved_qty} pending)`}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Lokasi selector */}
                                                            <select
                                                                value={item.location_id || ''}
                                                                onChange={e => {
                                                                    const loc = item.locations?.find((l: any) => String(l.location_id) === e.target.value);
                                                                    setCart(prev => prev.map(c => c.qr_id === item.qr_id
                                                                        ? { ...c, location_id: e.target.value, location_name: loc?.location_name || '', available_qty: loc?.available_qty ?? 0 }
                                                                        : c));
                                                                }}
                                                                className="mt-1.5 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-slate-600 appearance-none w-full max-w-[220px]"
                                                            >
                                                                <option value="">-- Pilih Lokasi --</option>
                                                                {item.locations?.filter((l: any) => l.stock_qty > 0).map((l: any) => (
                                                                    <option key={l.location_id} value={l.location_id} disabled={l.available_qty <= 0}>
                                                                        {l.location_name} ({l.available_qty} tersedia)
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            {/* Info stok setelah lokasi dipilih */}
                                                            {item.location_id && (
                                                                <div className="mt-1.5 space-y-0.5">
                                                                    <p className="text-[10px] text-slate-500">
                                                                        Stok di {item.location_name}: <span className="font-bold">{stockAtLoc}</span>
                                                                    </p>
                                                                    {reserved > 0 && (
                                                                        <p className="text-[10px] text-orange-500 font-bold">
                                                                            ⏳ {reserved} sedang pending approval
                                                                        </p>
                                                                    )}
                                                                    {isUnavailable ? (
                                                                        <p className="text-[10px] text-red-500 font-black">❌ Stok tidak tersedia di lokasi ini</p>
                                                                    ) : isInsufficient ? (
                                                                        <p className="text-[10px] text-red-500 font-black">❌ Qty melebihi stok tersedia ({item.available_qty})</p>
                                                                    ) : (
                                                                        <p className="text-[10px] text-emerald-600 font-bold">✓ Tersedia: {item.available_qty}</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <input type="number" value={item.qty} min="1"
                                                                onChange={e => setCart(prev => prev.map(c => c.qr_id === item.qr_id ? { ...c, qty: e.target.value } : c))}
                                                                className={`w-14 text-center border-2 rounded-lg font-black py-1 ${isInsufficient ? 'border-red-400 text-red-500' : 'text-blue-600'}`} />
                                                            <button onClick={() => setCart(cart.filter(i => i.qr_id !== item.qr_id))} className="text-red-300 font-black p-1">✕</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        {/* FORM DETAIL */}
                        {cart.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4">
                                <input type="date" value={checkoutDate} onChange={e => setCheckoutDate(e.target.value)}
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
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Project Baru</p>
                                            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                                                placeholder="Nama project baru..." autoFocus
                                                className="w-full p-3 bg-white rounded-xl outline-none font-medium text-slate-700 border border-blue-200" />
                                            <div className="flex gap-2">
                                                <button onClick={() => { setShowAddProject(false); setNewProjectName(''); setSelectedProjectId(''); }}
                                                    className="flex-1 bg-slate-100 text-slate-500 font-black py-2.5 rounded-xl text-xs">Batal</button>
                                                <button onClick={handleAddNewProject} disabled={savingProject}
                                                    className="flex-1 bg-blue-600 text-white font-black py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50">
                                                    {savingProject ? 'Menyimpan...' : '✓ Simpan'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <input type="text" placeholder="Nama PIC Penerima" value={picName} onChange={e => setPicName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />

                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase">TTD PIC</label>
                                        <button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)} className="text-[10px] text-blue-500 font-bold">RESET</button>
                                    </div>
                                    <canvas ref={canvasRef} width={500} height={300}
                                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                        className="w-full h-64 bg-slate-50 rounded-2xl border-2 border-slate-100 touch-none shadow-inner" />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4">
                                    <button onClick={() => handleSubmit(true)} disabled={loading}
                                        className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl text-[10px] tracking-widest active:scale-95 transition-all">
                                        SIMPAN DRAFT
                                    </button>
                                    <button onClick={() => handleSubmit(false)} disabled={loading}
                                        className="bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                        SUBMIT RESMI
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-50 p-4 pb-6">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')} className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">🏠 Menu Utama</button>
                    <button onClick={() => router.push('/transactions')} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all">📋 Transaksi</button>
                </div>
            </div>
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
