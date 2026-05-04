'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');

    const [user, setUser] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);

    // --- PROJECT STATE ---
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [projectName, setProjectName] = useState('');
    const [showAddProject, setShowAddProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [savingProject, setSavingProject] = useState(false);

    const [picName, setPicName] = useState('');
    const [checkoutDate, setCheckoutDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingDraft, setFetchingDraft] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    // --- SEARCH INVENTORY STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const searchTimeout = useRef<any>(null);

    // --- KONFIGURASI API KEY ---
    const API_KEY = "SedayuSolar_TopSecret_2026";

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // --- ROLE CHECK ---
    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) { router.push('/login'); return; }
        const parsedUser = JSON.parse(loggedInUser);
        if (parsedUser.role === 'MANAGER') {
            alert("Manager tidak memiliki akses untuk membuat Checkout.");
            router.push('/transactions');
        }
        setUser(parsedUser);
    }, []);

    // --- FETCH PROJECT LIST ---
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('https://sedayu.com/api/warehouse/get_projects.php', {
                    headers: { 'X-API-KEY': API_KEY }
                });
                const result = await res.json();
                if (result.status === 'success') {
                    setProjects(result.data);
                }
            } catch (err) { console.error("Gagal fetch projects:", err); }
        };
        fetchProjects();
    }, []);

    // LOAD DATA DRAFT
    useEffect(() => {
        if (editId) {
            const loadData = async () => {
                setFetchingDraft(true);
                try {
                    const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${editId}`, {
                        headers: { 'X-API-KEY': API_KEY }
                    });
                    const result = await res.json();
                    if (result.status === 'success') {
                        // Set project dari draft — cocokkan dengan ID jika ada
                        setProjectName(result.header.project_name);
                        if (result.header.project_id) {
                            setSelectedProjectId(String(result.header.project_id));
                        }
                        setPicName(result.header.pic_name || '');
                        setCheckoutDate(result.header.checkout_date);
                        setCart(result.items.map((item: any) => ({
                            qr_id: item.qr_id,
                            name: item.item_name,
                            type: item.item_type,
                            qty: item.qty,
                            stock: item.stock_qty,
                            photo_base64: ''
                        })));
                    }
                } catch (err: any) { console.error("Gagal sinkron draft:", err); }
                setFetchingDraft(false);
            };
            loadData();
        }
    }, [editId]);

    // SCANNER LOGIC
    useEffect(() => {
        let scanner: any = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render(onScanSuccess, (err: any) => { });
        }
        return () => { if (scanner) scanner.clear().catch((e: any) => console.error(e)); };
    }, [showScanner]);

    async function onScanSuccess(decodedText: string) {
        setShowScanner(false);
        playBeep('success');
        addItemByQr(decodedText);
    }

    // --- AUDIO EFFECTS ---
    function playBeep(type: 'success' | 'error' | 'warning') {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return; // browser tidak support, skip
            const ctx = new AudioCtx();
            const configs: Record<string, { freq: number[], duration: number, gain: number }> = {
                success: { freq: [880, 1320], duration: 0.12, gain: 0.3 },
                error: { freq: [300, 200], duration: 0.25, gain: 0.4 },
                warning: { freq: [600, 600], duration: 0.18, gain: 0.3 },
            };
            const { freq, duration, gain } = configs[type];
            freq.forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);
                osc.frequency.value = f;
                osc.type = 'sine';
                gainNode.gain.setValueAtTime(gain, ctx.currentTime + i * duration);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * duration + duration);
                osc.start(ctx.currentTime + i * duration);
                osc.stop(ctx.currentTime + i * duration + duration);
            });
        } catch (e) {
            // Audio tidak support atau diblok browser — skip tanpa crash
        }
    }

    // --- SHARED: ADD ITEM TO CART ---
    async function addItemByQr(qrId: string) {
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_item_by_qr.php?qr=${qrId}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') {
                const item = result.data;
                if (Number(item.stock_qty) <= 0) alert(`⚠️ STOK HABIS: ${item.item_name}`);
                if (cart.find((i: any) => i.qr_id === item.qr_id)) {
                    playBeep('warning');
                    alert("Barang sudah ada di list!");
                } else {
                    setCart(prev => [...prev, {
                        qr_id: item.qr_id,
                        name: item.item_name,
                        type: (item.category || '').toUpperCase(), // pakai kolom category dari DB
                        qty: 1,
                        stock: item.stock_qty,
                        photo_base64: ''
                    }]);
                }
            } else {
                playBeep('error');
                alert(result.message);
            }
        } catch (err: any) { playBeep('error'); alert("Gagal koneksi server."); }
    }

    // --- SEARCH INVENTORY ---
    const handleSearchInput = (val: string) => {
        setSearchQuery(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.trim().length < 2) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`https://sedayu.com/api/warehouse/search_inventory.php?q=${encodeURIComponent(val)}`, {
                    headers: { 'X-API-KEY': API_KEY }
                });
                const result = await res.json();
                if (result.status === 'success') {
                    setSearchResults(result.data);
                } else {
                    setSearchResults([]);
                }
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 400);
    };

    const handleSelectSearchResult = (item: any) => {
        if (cart.find((i: any) => i.qr_id === item.qr_id)) {
            alert("Barang sudah ada di list!");
        } else {
            if (Number(item.stock_qty) <= 0) alert(`⚠️ STOK HABIS: ${item.item_name}`);
            setCart(prev => [...prev, {
                qr_id: item.qr_id,
                name: item.item_name,
                type: (item.category || '').toUpperCase(), // pakai kolom category dari DB
                qty: 1,
                stock: item.stock_qty,
                photo_base64: ''
            }]);
        }
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
    };

    // --- TAMBAH PROJECT BARU ---
    const handleAddNewProject = async () => {
        if (!newProjectName.trim()) { alert("Nama project tidak boleh kosong!"); return; }
        setSavingProject(true);
        try {
            const res = await fetch('https://sedayu.com/api/warehouse/add_project.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ project_name: newProjectName.trim() })
            });
            const result = await res.json();
            if (result.status === 'success') {
                const newProject = { id: result.id, project_name: newProjectName.trim() };
                setProjects(prev => [...prev, newProject]);
                setSelectedProjectId(String(result.id));
                setProjectName(newProjectName.trim());
                setNewProjectName('');
                setShowAddProject(false);
            } else {
                alert("Gagal tambah project: " + result.message);
            }
        } catch { alert("Gagal koneksi server."); }
        setSavingProject(false);
    };

    // --- HANDLE PROJECT DROPDOWN CHANGE ---
    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__add_new__') {
            setShowAddProject(true);
            setSelectedProjectId('');
            setProjectName('');
        } else {
            setShowAddProject(false);
            setSelectedProjectId(val);
            const found = projects.find(p => String(p.id) === val);
            setProjectName(found ? found.project_name : '');
        }
    };

    // SIGNATURE LOGIC
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || (e.touches && e.touches[0].clientX)) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || (e.touches && e.touches[0].clientY)) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || (e.touches && e.touches[0].clientX)) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || (e.touches && e.touches[0].clientY)) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke(); if (e.touches) e.preventDefault();
    };

    const handleSubmit = async (isDraft: boolean = false) => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (!projectName || !selectedProjectId || !checkoutDate || cart.length === 0) {
            alert("Data belum lengkap! Pastikan Project sudah dipilih.");
            return;
        }

        if (!isDraft) {
            for (const item of cart) {
                if (Number(item.qty) > Number(item.stock)) {
                    alert(`❌ STOK TIDAK CUKUP: ${item.name}`);
                    return;
                }
            }
            if (!picName || !signatureBase64 || signatureBase64.length < 2000) {
                alert("PIC & Tanda Tangan wajib!");
                return;
            }
        }

        setLoading(true);
        try {
            const response = await fetch('https://sedayu.com/api/warehouse/checkout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    id: editId,
                    project_id: selectedProjectId,       // ← kirim ID untuk konsistensi
                    project_name: projectName,
                    pic_name: picName,
                    checkout_date: checkoutDate,
                    signature_base64: isDraft ? '' : signatureBase64,
                    transaction_status: isDraft ? 'DRAFT' : 'SUBMITTED',
                    items: cart
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(isDraft ? "Draft tersimpan!" : "Submit Berhasil! Menunggu Approval.");
                router.push('/transactions');
            } else {
                alert("Gagal: " + result.message);
            }
        } catch (err: any) { alert("Gagal koneksi ke server."); }
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

            <div className="p-4 space-y-6">
                {fetchingDraft ? (
                    <div className="text-center py-20 font-bold animate-pulse text-slate-400">LOADING...</div>
                ) : (
                    <>
                        {/* ===== SECTION: TAMBAH BARANG ===== */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tambah Barang</p>

                            {/* SCAN QR */}
                            {!showScanner ? (
                                <button
                                    onClick={() => { setShowScanner(true); setShowSearch(false); }}
                                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm"
                                >
                                    📷 SCAN QR CODE
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
                                    <button onClick={() => setShowScanner(false)} className="w-full text-red-500 font-bold text-xs uppercase">Batal Scan</button>
                                </div>
                            )}

                            {/* SEARCH MANUAL — tampil jika scanner tidak aktif */}
                            {!showScanner && (
                                <div>
                                    <button
                                        onClick={() => setShowSearch(v => !v)}
                                        className="w-full bg-slate-200 text-slate-700 font-black py-3 rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"
                                    >
                                        🔍 {showSearch ? 'TUTUP PENCARIAN' : 'CARI BARANG MANUAL'}
                                    </button>

                                    {showSearch && (
                                        <div className="mt-3 space-y-2">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={e => handleSearchInput(e.target.value)}
                                                placeholder="Ketik nama barang / kode..."
                                                className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:border-blue-400 transition-colors"
                                                autoFocus
                                            />
                                            {searching && (
                                                <p className="text-center text-xs text-slate-400 animate-pulse py-2">Mencari...</p>
                                            )}
                                            {!searching && searchResults.length > 0 && (
                                                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                                    {searchResults.map((item: any) => (
                                                        <button
                                                            key={item.qr_id}
                                                            onClick={() => handleSelectSearchResult(item)}
                                                            className="w-full text-left p-3.5 hover:bg-blue-50 active:bg-blue-100 transition-colors flex justify-between items-center gap-2"
                                                        >
                                                            <div>
                                                                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                                <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0 ${Number(item.stock_qty) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                                                                Stok: {item.stock_qty}
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

                        {/* ===== CART LIST ===== */}
                        <div className="space-y-8">
                            {/* MATERIAL */}
                            {cart.filter(i => i.type === 'MATERIAL').length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">📦 Material</h3>
                                    {cart.filter(i => i.type === 'MATERIAL').map((item, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-emerald-500 flex justify-between items-center">
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400">Stok Gudang: {item.stock}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input type="number" value={item.qty}
                                                    onChange={(e: any) => {
                                                        const nc = [...cart];
                                                        const i = nc.findIndex(it => it.qr_id === item.qr_id);
                                                        nc[i].qty = e.target.value;
                                                        setCart(nc);
                                                    }}
                                                    className="w-12 text-center border-2 rounded-lg font-black text-blue-600"
                                                />
                                                <button onClick={() => setCart(cart.filter(i => i.qr_id !== item.qr_id))} className="text-red-300 font-black p-1">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* TOOLS */}
                            {cart.filter(i => i.type === 'TOOLS').length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">🛠️ Tools</h3>
                                    {cart.filter(i => i.type === 'TOOLS').map((item, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-amber-500 flex justify-between items-center">
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400">Stok Gudang: {item.stock}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input type="number" value={item.qty}
                                                    onChange={(e: any) => {
                                                        const nc = [...cart];
                                                        const i = nc.findIndex(it => it.qr_id === item.qr_id);
                                                        nc[i].qty = e.target.value;
                                                        setCart(nc);
                                                    }}
                                                    className="w-12 text-center border-2 rounded-lg font-black text-blue-600"
                                                />
                                                <button onClick={() => setCart(cart.filter(i => i.qr_id !== item.qr_id))} className="text-red-300 font-black p-1">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ===== FORM DETAIL ===== */}
                        {cart.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4">
                                <input
                                    type="date"
                                    value={checkoutDate}
                                    onChange={(e: any) => setCheckoutDate(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700"
                                />

                                {/* ===== PROJECT DROPDOWN ===== */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Proyek</label>
                                    <select
                                        value={selectedProjectId}
                                        onChange={handleProjectChange}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 border-0 appearance-none cursor-pointer"
                                    >
                                        <option value="">-- Pilih Project --</option>
                                        {projects.map((p: any) => (
                                            <option key={p.id} value={String(p.id)}>{p.project_name}</option>
                                        ))}
                                        <option value="__add_new__">➕ Tambah Project Baru...</option>
                                    </select>

                                    {/* FORM TAMBAH PROJECT BARU */}
                                    {showAddProject && (
                                        <div className="bg-blue-50 p-4 rounded-2xl space-y-3 border border-blue-100">
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Project Baru</p>
                                            <input
                                                type="text"
                                                value={newProjectName}
                                                onChange={e => setNewProjectName(e.target.value)}
                                                placeholder="Nama project baru..."
                                                className="w-full p-3 bg-white rounded-xl outline-none font-medium text-slate-700 border border-blue-200 focus:border-blue-400 transition-colors"
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setShowAddProject(false); setNewProjectName(''); setSelectedProjectId(''); }}
                                                    className="flex-1 bg-slate-100 text-slate-500 font-black py-2.5 rounded-xl text-xs"
                                                >
                                                    Batal
                                                </button>
                                                <button
                                                    onClick={handleAddNewProject}
                                                    disabled={savingProject}
                                                    className="flex-1 bg-blue-600 text-white font-black py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50"
                                                >
                                                    {savingProject ? 'Menyimpan...' : '✓ Simpan Project'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    placeholder="Nama PIC Penerima"
                                    value={picName}
                                    onChange={(e: any) => setPicName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700"
                                />

                                {/* SIGNATURE */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase">TTD PIC</label>
                                        <button
                                            onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)}
                                            className="text-[10px] text-blue-500 font-bold"
                                        >
                                            RESET
                                        </button>
                                    </div>
                                    <canvas
                                        ref={canvasRef}
                                        width={500} height={300}
                                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                        className="w-full h-64 bg-slate-50 rounded-2xl border-2 border-slate-100 touch-none shadow-inner"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4">
                                    <button
                                        onClick={() => handleSubmit(true)}
                                        disabled={loading}
                                        className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl text-[10px] tracking-widest active:scale-95 transition-all"
                                    >
                                        SIMPAN DRAFT
                                    </button>
                                    <button
                                        onClick={() => handleSubmit(false)}
                                        disabled={loading}
                                        className="bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                    >
                                        SUBMIT RESMI
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* BOTTOM MENU BAR */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-50 p-4 pb-6">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button
                        onClick={() => router.push('/')}
                        className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                        🏠 Menu Utama
                    </button>
                    <button
                        onClick={() => router.push('/transactions')}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all"
                    >
                        📋 Riwayat Transaksi
                    </button>
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
