'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

type CartItem = {
    key: string;
    qr_id: string;
    item_name: string;
    category: string;
    unit: string;
    location_id: string;
    qty: number;
    item_photo: string;
    isNew: boolean;
    aiMatched?: boolean; // hasil match dari AI
};

type AiItem = {
    item_name: string;
    qty: number;
    unit: string;
    category: string;
    supplier?: string;
    po_number?: string;
    // hasil match inventory
    matched?: any;
    matchLoading?: boolean;
    confirmed?: boolean;
    confidence?: 'high' | 'medium' | 'low' | 'none' | null;
    matchReason?: string;
};

const compressImage = (file: File, maxWidth = 1600, quality = 0.85): Promise<string> =>
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

function GRContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);

    const [poNumber, setPoNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');

    const [sjPhoto, setSjPhoto] = useState('');
    const [sjPhotoPreview, setSjPhotoPreview] = useState('');
    const sjPhotoRef = useRef<HTMLInputElement>(null);

    // AI state
    const [scanning, setScanning] = useState(false);
    const [aiItems, setAiItems] = useState<AiItem[]>([]);
    const [showAiReview, setShowAiReview] = useState(false);
    const [aiError, setAiError] = useState('');
    const [defaultLocationId, setDefaultLocationId] = useState('');

    // Koreksi per item — search existing inventory
    const [correcting, setCorrecting] = useState<number | null>(null); // index item yang sedang dikoreksi
    const [correctQuery, setCorrectQuery] = useState('');
    const [correctResults, setCorrectResults] = useState<any[]>([]);
    const [correctSearching, setCorrectSearching] = useState(false);
    const correctTimeout = useRef<any>(null);

    // Manual modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [addMode, setAddMode] = useState<'search' | 'new'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const searchTimeout = useRef<any>(null);

    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('Material');
    const [newUnit, setNewUnit] = useState('');
    const [newItemPhoto, setNewItemPhoto] = useState('');
    const [newItemPhotoPreview, setNewItemPhotoPreview] = useState('');
    const newItemPhotoRef = useRef<HTMLInputElement>(null);

    const [modalLocationId, setModalLocationId] = useState('');
    const [modalQty, setModalQty] = useState('1');

    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<any>(null);
    const [useAI, setUseAI] = useState(true);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role === 'MANAGER' || parsed.role === 'PROCUREMENT') { router.push('/purchase-list'); return; }
        setUser(parsed);
        fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } })
            .then(r => r.json()).then(r => { if (r.status === 'success') setLocations(r.data); });
    }, []);

    // ── AI SCAN SJ — 2 step: scan foto → AI match inventory ──
    const handleAiScan = async () => {
        if (!sjPhoto) { alert("Upload foto surat jalan dulu!"); return; }
        setScanning(true); setAiError(''); setAiItems([]);

        try {
            // STEP 1: Scan foto SJ → extract items
            const res = await fetch(`${BASE_URL}/openai_proxy.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ mode: 'scan_sj', image_base64: sjPhoto })
            });
            const r = await res.json();

            if (r.status !== 'success' || !Array.isArray(r.result)) {
                setAiError('AI gagal membaca dokumen. Coba foto ulang dengan pencahayaan lebih baik.');
                setScanning(false); return;
            }

            // Auto-fill supplier & po_number
            if (r.result[0]?.supplier && !supplier) setSupplier(r.result[0].supplier);
            if (r.result[0]?.po_number && !poNumber) setPoNumber(r.result[0].po_number);

            const sjItems = r.result;

            // Init items dengan loading state
            const initItems: AiItem[] = sjItems.map((item: any) => ({
                ...item,
                matched: null,
                matchLoading: true,
                confidence: null,
                matchReason: '',
            }));
            setAiItems(initItems);
            setShowAiReview(true);

            // STEP 2: Ambil semua inventory untuk AI matching
            const invRes = await fetch(`${BASE_URL}/get_items.php`, { headers: { 'X-API-KEY': API_KEY } });
            const invData = await invRes.json();
            const inventoryList = invData.status === 'success' ? invData.data : [];

            // STEP 3: AI match — kirim semua item SJ + inventory ke AI sekaligus
            const matchRes = await fetch(`${BASE_URL}/openai_proxy.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    mode: 'match_inventory',
                    sj_items: sjItems,
                    inventory: inventoryList.slice(0, 200), // limit 200 item
                })
            });
            const matchData = await matchRes.json();
            const matches: any[] = Array.isArray(matchData.result) ? matchData.result : [];

            // STEP 4: Merge hasil match ke items
            setAiItems(sjItems.map((item: any, i: number) => {
                const match = matches.find((m: any) =>
                    m.sj_item_name?.toLowerCase() === item.item_name?.toLowerCase()
                    || matches[i]
                );
                const matchResult = match || matches[i];

                // Cari inventory item berdasarkan qr_id dari AI
                const inventoryItem = matchResult?.matched_qr_id
                    ? inventoryList.find((inv: any) => inv.qr_id === matchResult.matched_qr_id)
                    : null;

                return {
                    ...item,
                    matched: inventoryItem || null,
                    matchLoading: false,
                    confidence: matchResult?.confidence || 'none',
                    matchReason: matchResult?.reason || '',
                };
            }));

        } catch (e) {
            setAiError('Koneksi gagal. Pastikan internet stabil.');
        }
        setScanning(false);
    };

    // ── Search koreksi per item ──
    const handleCorrectSearch = (val: string) => {
        setCorrectQuery(val);
        if (correctTimeout.current) clearTimeout(correctTimeout.current);
        if (val.length < 2) { setCorrectResults([]); return; }
        correctTimeout.current = setTimeout(async () => {
            setCorrectSearching(true);
            try {
                const res = await fetch(`${BASE_URL}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                setCorrectResults(r.status === 'success' ? r.data : []);
            } catch { setCorrectResults([]); }
            setCorrectSearching(false);
        }, 350);
    };

    const applyCorrection = (itemIdx: number, inventoryItem: any) => {
        setAiItems(prev => prev.map((p, idx) =>
            idx === itemIdx ? { ...p, matched: inventoryItem, confidence: 'high', matchReason: 'Dipilih manual oleh staff' } : p
        ));
        setCorrecting(null);
        setCorrectQuery('');
        setCorrectResults([]);
    };

    // Konfirmasi semua AI items ke cart
    const handleConfirmAiItems = () => {
        if (!defaultLocationId) { alert("Pilih lokasi penyimpanan dulu!"); return; }

        const newItems: CartItem[] = aiItems.map(item => ({
            key: `ai_${Date.now()}_${Math.random()}`,
            qr_id: item.matched?.qr_id || '',
            item_name: item.item_name,
            category: item.category || 'Material',
            unit: item.unit,
            location_id: defaultLocationId,
            qty: item.qty,
            item_photo: '',
            isNew: !item.matched,
            aiMatched: !!item.matched,
        }));

        setCart(prev => [...prev, ...newItems]);
        setShowAiReview(false);
        setAiItems([]);
    };

    // Manual search
    const handleSearch = (val: string) => {
        setSearchQuery(val); setSelectedItem(null);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (val.length < 2) { setSearchResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`${BASE_URL}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                setSearchResults(r.status === 'success' ? r.data : []);
            } catch { setSearchResults([]); }
            setSearching(false);
        }, 350);
    };

    const handleSelectItem = (item: any) => {
        setSelectedItem(item); setSearchQuery(item.item_name); setSearchResults([]);
    };

    const addExistingToCart = () => {
        if (!selectedItem) { alert("Pilih item terlebih dahulu."); return; }
        if (!modalLocationId || Number(modalQty) <= 0) { alert("Pilih lokasi dan isi qty."); return; }
        setCart(prev => [...prev, {
            key: `${selectedItem.qr_id}_${Date.now()}`,
            qr_id: selectedItem.qr_id, item_name: selectedItem.item_name,
            category: selectedItem.category, unit: selectedItem.unit,
            location_id: modalLocationId, qty: Number(modalQty),
            item_photo: '', isNew: false,
        }]);
        resetModal();
    };

    const addNewToCart = () => {
        if (!newName || !newCategory || !newUnit) { alert("Nama, kategori, satuan wajib."); return; }
        if (!modalLocationId || Number(modalQty) <= 0) { alert("Pilih lokasi dan isi qty."); return; }
        setCart(prev => [...prev, {
            key: `new_${Date.now()}`,
            qr_id: '', item_name: newName,
            category: newCategory, unit: newUnit,
            location_id: modalLocationId, qty: Number(modalQty),
            item_photo: newItemPhoto, isNew: true,
        }]);
        resetModal();
    };

    const resetModal = () => {
        setShowAddModal(false); setAddMode('search');
        setSearchQuery(''); setSearchResults([]); setSelectedItem(null);
        setNewName(''); setNewCategory('Material'); setNewUnit('');
        setNewItemPhoto(''); setNewItemPhotoPreview('');
        setModalLocationId(''); setModalQty('1');
    };

    const updateCartItem = (key: string, field: string, value: any) =>
        setCart(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

    const handleSubmit = async () => {
        if (cart.length === 0) { alert("Tambahkan minimal 1 item."); return; }
        if (!sjPhoto) { alert("Upload foto surat jalan terlebih dahulu."); return; }
        for (const item of cart) {
            if (!item.location_id || item.qty <= 0) {
                alert(`Lengkapi lokasi dan qty untuk: ${item.item_name}`); return;
            }
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/purchase_order.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    po_number: poNumber, supplier, po_date: poDate,
                    note, adjusted_by: user?.name || 'unknown',
                    sj_photo: sjPhoto,
                    items: cart.map(i => ({
                        qr_id: i.qr_id, item_name: i.item_name,
                        category: i.category, unit: i.unit,
                        location_id: i.location_id, qty: i.qty,
                        unit_price: 0, item_photo: i.item_photo,
                    }))
                })
            });
            const r = await res.json();
            if (r.status === 'success') { setSuccess(r); setCart([]); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSubmitting(false);
    };

    const locName = (id: string) => locations.find(l => String(l.id) === id)?.location_name || id;
    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* ══ AI REVIEW PANEL ══ */}
            {showAiReview && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => setShowAiReview(false)}>
                    <div className="flex-1 overflow-y-auto mt-12" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-32 space-y-4">

                            {/* Header */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">🤖 Hasil Scan AI</p>
                                    <p className="font-black text-slate-800">{aiItems.length} item terdeteksi</p>
                                </div>
                                <button onClick={() => setShowAiReview(false)}
                                    className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {/* Info */}
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                                <p className="text-[10px] font-black text-blue-600">✅ = Item sudah ada di inventory · 🆕 = Item baru</p>
                                <p className="text-[10px] text-blue-500 mt-0.5">Review hasil AI sebelum konfirmasi. Bisa edit nama, qty, dan satuan.</p>
                            </div>

                            {/* Lokasi default untuk semua item */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase">📍 Lokasi Penyimpanan (semua item)</p>
                                <select value={defaultLocationId} onChange={e => setDefaultLocationId(e.target.value)}
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                    <option value="">-- Pilih Lokasi *</option>
                                    {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                                </select>
                            </div>

                            {/* List item hasil AI */}
                            <div className="space-y-3">
                                {aiItems.map((item, i) => (
                                    <div key={i} className={`rounded-2xl p-4 border-2 ${item.matched ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
                                        {/* Status badge */}
                                        <div className="flex items-center gap-2 mb-2">
                                            {item.matchLoading ? (
                                                <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full animate-pulse">🤖 AI mencocokkan...</span>
                                            ) : item.matched && item.confidence === 'high' ? (
                                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✅ Match yakin · {item.matched.qr_id}</span>
                                            ) : item.matched && item.confidence === 'medium' ? (
                                                <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠️ Match ragu · {item.matched.qr_id}</span>
                                            ) : item.matched && item.confidence === 'low' ? (
                                                <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">❓ Match lemah · {item.matched.qr_id}</span>
                                            ) : (
                                                <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🆕 Item Baru</span>
                                            )}
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {item.category}
                                            </span>
                                        </div>

                                        {/* Nama item — editable */}
                                        <input type="text" value={item.item_name}
                                            onChange={e => setAiItems(prev => prev.map((p, idx) => idx === i ? { ...p, item_name: e.target.value } : p))}
                                            className="w-full font-bold text-sm text-slate-800 bg-transparent border-b border-slate-200 pb-1 outline-none mb-2" />

                                        {/* Qty + Unit */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase flex-shrink-0">Qty:</label>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setAiItems(prev => prev.map((p, idx) => idx === i ? { ...p, qty: Math.max(1, p.qty - 1) } : p))}
                                                    className="w-7 h-7 bg-white rounded-lg font-black text-slate-500 flex items-center justify-center border active:scale-95">−</button>
                                                <input type="number" min="1" value={item.qty}
                                                    onChange={e => setAiItems(prev => prev.map((p, idx) => idx === i ? { ...p, qty: Number(e.target.value) } : p))}
                                                    className="w-14 text-center font-black text-blue-600 text-sm border border-slate-200 rounded-lg py-1 outline-none bg-white" />
                                                <button onClick={() => setAiItems(prev => prev.map((p, idx) => idx === i ? { ...p, qty: p.qty + 1 } : p))}
                                                    className="w-7 h-7 bg-white rounded-lg font-black text-slate-500 flex items-center justify-center border active:scale-95">＋</button>
                                            </div>
                                            <input type="text" value={item.unit}
                                                onChange={e => setAiItems(prev => prev.map((p, idx) => idx === i ? { ...p, unit: e.target.value } : p))}
                                                className="w-16 text-center font-medium text-slate-600 text-sm border border-slate-200 rounded-lg py-1 outline-none bg-white" />
                                            <button onClick={() => setAiItems(prev => prev.filter((_, idx) => idx !== i))}
                                                className="ml-auto text-red-300 font-black text-lg leading-none">✕</button>
                                        </div>

                                        {/* Match info + reason */}
                                        {item.matched && (
                                            <div className="mt-2 space-y-1">
                                                <p className="text-[9px] text-slate-600">
                                                    📦 <span className="font-black">{item.matched.item_name}</span>
                                                </p>
                                                <p className="text-[9px] text-slate-500">
                                                    Stok: <span className="font-black">{item.matched.stock_qty} {item.matched.unit}</span>
                                                </p>
                                                {item.matchReason && (
                                                    <p className="text-[9px] text-slate-400 italic">💬 {item.matchReason}</p>
                                                )}
                                                {/* Tombol batalkan match — jadikan item baru */}
                                                {(item.confidence === 'medium' || item.confidence === 'low') && (
                                                    <button
                                                        onClick={() => setAiItems(prev => prev.map((p, idx2) =>
                                                            idx2 === i ? { ...p, matched: null, confidence: 'none' } : p
                                                        ))}
                                                        className="text-[9px] font-black text-red-400 underline">
                                                        ✕ Bukan item ini — jadikan item baru
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {!item.matched && !item.matchLoading && (
                                            <p className="text-[9px] text-blue-400 mt-1 italic">Item baru akan dibuat di inventory</p>
                                        )}

                                        {/* Tombol koreksi */}
                                        {!item.matchLoading && (
                                            <button
                                                onClick={() => { setCorrecting(correcting === i ? null : i); setCorrectQuery(''); setCorrectResults([]); }}
                                                className={`mt-2 text-[9px] font-black px-2.5 py-1.5 rounded-lg transition-all
                                                    ${correcting === i ? 'bg-slate-200 text-slate-600' : 'bg-white border border-slate-200 text-blue-500'}`}>
                                                {correcting === i ? '✕ Tutup' : '🔍 Koreksi — pilih dari inventory'}
                                            </button>
                                        )}

                                        {/* Panel search koreksi */}
                                        {correcting === i && (
                                            <div className="mt-2 space-y-2">
                                                <input type="text" value={correctQuery}
                                                    onChange={e => handleCorrectSearch(e.target.value)}
                                                    placeholder="Cari nama item di inventory..."
                                                    autoFocus
                                                    className="w-full p-2.5 bg-white border border-blue-200 rounded-xl outline-none text-xs font-medium text-slate-700" />
                                                {correctSearching && <p className="text-[9px] text-slate-400 animate-pulse text-center">Mencari...</p>}
                                                {correctResults.length > 0 && (
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-40 overflow-y-auto shadow-sm">
                                                        {correctResults.map((inv: any) => (
                                                            <button key={inv.qr_id} onClick={() => applyCorrection(i, inv)}
                                                                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex justify-between items-center gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-xs text-slate-800 truncate">{inv.item_name}</p>
                                                                    <p className="text-[9px] font-mono text-slate-400">{inv.qr_id} · Stok: {inv.stock_qty} {inv.unit}</p>
                                                                </div>
                                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg flex-shrink-0">Pilih</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {correctQuery.length >= 2 && !correctSearching && correctResults.length === 0 && (
                                                    <p className="text-[9px] text-slate-400 italic text-center py-2">Tidak ditemukan — biarkan sebagai item baru</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Tombol tambah item manual */}
                            <button onClick={() => setAiItems(prev => [...prev, { item_name: '', qty: 1, unit: 'pcs', category: 'Material', matched: null, matchLoading: false }])}
                                className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3 text-[10px] font-black text-slate-400 uppercase active:bg-slate-50">
                                ＋ Tambah Item Manual
                            </button>

                            {/* Konfirmasi */}
                            <button onClick={handleConfirmAiItems}
                                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95">
                                ✅ Konfirmasi {aiItems.length} Item ke GR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD ITEM MODAL — manual */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={resetModal}>
                    <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tambah Item Manual</p>
                            <button onClick={resetModal} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 text-sm">✕</button>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => { setAddMode('search'); setSelectedItem(null); }}
                                className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase ${addMode === 'search' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                🔍 Cari Existing
                            </button>
                            <button onClick={() => setAddMode('new')}
                                className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase ${addMode === 'new' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                ＋ Item Baru
                            </button>
                        </div>

                        {addMode === 'search' && (
                            <div className="space-y-3">
                                <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                                    placeholder="Ketik nama / QR ID..." autoFocus
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                {searching && <p className="text-center text-xs text-slate-400 animate-pulse">Mencari...</p>}
                                {searchResults.length > 0 && !selectedItem && (
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-50 max-h-48 overflow-y-auto shadow-md">
                                        {searchResults.map((item: any) => (
                                            <button key={item.qr_id} onClick={() => handleSelectItem(item)}
                                                className="w-full text-left p-3.5 hover:bg-blue-50 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{item.qr_id} · Stok: {item.stock_qty} {item.unit}</p>
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Pilih</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {selectedItem && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-sm text-blue-800">{selectedItem.item_name}</p>
                                            <p className="text-[10px] font-mono text-blue-400">{selectedItem.qr_id} · {selectedItem.unit}</p>
                                            <p className="text-[10px] text-blue-500 font-bold">Stok: {selectedItem.stock_qty} {selectedItem.unit}</p>
                                        </div>
                                        <button onClick={() => { setSelectedItem(null); setSearchQuery(''); }}
                                            className="text-blue-400 font-black text-sm bg-white rounded-lg px-2 py-1">✕</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {addMode === 'new' && (
                            <div className="space-y-3">
                                <input type="text" placeholder="Nama Item *" value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <div className="grid grid-cols-2 gap-3">
                                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                                        className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                        <option value="Material">Material</option>
                                        <option value="Tools">Tools</option>
                                    </select>
                                    <input type="text" placeholder="Satuan (pcs, m...)" value={newUnit}
                                        onChange={e => setNewUnit(e.target.value)}
                                        className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                </div>
                                <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-black text-violet-500">💡 HPP akan diisi oleh Tim Procurement</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Foto Item (opsional)</label>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <button onClick={() => newItemPhotoRef.current?.click()}
                                            className="px-3 py-2 bg-slate-100 text-slate-500 font-black text-xs rounded-xl active:scale-95">📷 Upload</button>
                                        {newItemPhotoPreview && <img src={newItemPhotoPreview} className="w-12 h-12 object-cover rounded-lg border" alt="" />}
                                    </div>
                                    <input ref={newItemPhotoRef} type="file" accept="image/*" className="hidden"
                                        onChange={async e => {
                                            const file = e.target.files?.[0]; if (!file) return;
                                            const b64 = await compressImage(file);
                                            setNewItemPhoto(b64); setNewItemPhotoPreview(b64);
                                        }} />
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Lokasi & Jumlah</p>
                            <select value={modalLocationId} onChange={e => setModalLocationId(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                <option value="">-- Pilih Lokasi *</option>
                                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                            </select>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Jumlah *</label>
                                <input type="number" min="1" value={modalQty} onChange={e => setModalQty(e.target.value)}
                                    className="w-full mt-1 p-3.5 bg-slate-50 rounded-xl outline-none font-bold text-slate-700 text-center" />
                            </div>
                        </div>

                        {addMode === 'search' && (
                            <button onClick={addExistingToCart} disabled={!selectedItem}
                                className={`w-full font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95
                                    ${selectedItem ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                {selectedItem ? `＋ Tambahkan "${selectedItem.item_name}"` : 'Pilih item dulu'}
                            </button>
                        )}
                        {addMode === 'new' && (
                            <button onClick={addNewToCart}
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95">
                                ＋ Tambahkan ke GR
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* SUCCESS */}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
                        <p className="text-4xl">✅</p>
                        <p className="font-black text-emerald-700 text-lg">GR Berhasil Diinput!</p>
                        <p className="text-sm text-emerald-600">{success.message}</p>
                        <div className="bg-white rounded-2xl p-4 space-y-2 text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alur Selanjutnya</p>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-black text-xs flex-shrink-0">1</div>
                                <p className="text-xs text-slate-600">📋 Tim Procurement kroscek item & input HPP</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-xs flex-shrink-0">2</div>
                                <p className="text-xs text-slate-600">✅ Manager review & approve</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs flex-shrink-0">3</div>
                                <p className="text-xs text-slate-600">📦 Stok masuk ke inventory otomatis</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            {success.items?.map((item: any) => (
                                <div key={item.qr_id} className="flex justify-between items-center bg-white rounded-xl px-3 py-2">
                                    <p className="text-sm font-bold text-slate-700">{item.item_name}</p>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${item.status === 'NEW' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {item.status === 'NEW' ? `✨ ${item.qr_id}` : item.qr_id}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { setSuccess(null); setPoNumber(''); setSupplier(''); setNote(''); setSjPhoto(''); setSjPhotoPreview(''); }}
                                className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-2xl text-xs uppercase">
                                ＋ Input GR Baru
                            </button>
                            <button onClick={() => router.push('/purchase-list')}
                                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-md">
                                📋 Lihat Status GR
                            </button>
                        </div>
                    </div>
                )}

                {!success && (
                    <>
                        {/* Info flow */}
                        <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">💡</span>
                            <div>
                                <p className="text-[10px] font-black text-violet-700 uppercase">Info Alur GR</p>
                                <p className="text-[10px] text-violet-600 mt-0.5">Staff input item → Procurement input HPP → Manager approve → Stok masuk</p>
                            </div>
                        </div>

                        {/* FOTO SURAT JALAN + AI SCAN */}
                        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📄 Surat Jalan / Packing List</p>
                                {/* Toggle AI */}
                                <button onClick={() => setUseAI(v => !v)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all
                                        ${useAI ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                    <div className={`w-3 h-3 rounded-full transition-all ${useAI ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    🤖 AI {useAI ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            {sjPhotoPreview ? (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <img src={sjPhotoPreview} alt="SJ" className="w-full max-h-64 object-cover rounded-2xl border border-slate-100" />
                                        <button onClick={() => { setSjPhoto(''); setSjPhotoPreview(''); setAiItems([]); setShowAiReview(false); }}
                                            className="absolute top-2 right-2 bg-red-500 text-white font-black text-xs px-2 py-1 rounded-lg">✕ Hapus</button>
                                        <p className="text-[10px] text-emerald-600 font-bold text-center mt-1">✅ Foto tersimpan</p>
                                    </div>

                                    {/* TOMBOL AI SCAN — hanya tampil kalau useAI ON */}
                                    {useAI && <button onClick={handleAiScan} disabled={scanning}
                                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-3.5 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                                        {scanning ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                <span>AI sedang membaca SJ...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>🤖</span>
                                                <span>Scan Item dengan AI</span>
                                            </>
                                        )}
                                    </button>

                                    }

                                    {aiError && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                            <p className="text-[10px] font-black text-red-600">⚠️ {aiError}</p>
                                        </div>
                                    )}

                                    <p className="text-[9px] text-slate-400 text-center">
                                        {useAI ? 'atau tambah item manual di bawah' : 'Tambah item manual di bawah'}
                                    </p>
                                </div>
                            ) : (
                                <button onClick={() => sjPhotoRef.current?.click()}
                                    className="w-full border-2 border-dashed border-slate-300 rounded-2xl py-10 text-center active:bg-slate-50">
                                    <p className="text-3xl mb-2">📷</p>
                                    <p className="font-black text-slate-400 text-sm">Foto Surat Jalan</p>
                                    <p className="text-[10px] text-slate-300 mt-1">Wajib diisi · AI akan scan otomatis</p>
                                </button>
                            )}
                            <input ref={sjPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={async e => {
                                    const file = e.target.files?.[0]; if (!file) return;
                                    const b64 = await compressImage(file);
                                    setSjPhoto(b64); setSjPhotoPreview(b64);
                                }} />
                        </div>

                        {/* INFO PO */}
                        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📋 Info PO</p>
                            <input type="text" placeholder="No. Surat Jalan / Referensi (opsional)" value={poNumber}
                                onChange={e => setPoNumber(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            <input type="text" placeholder="Supplier / Vendor" value={supplier}
                                onChange={e => setSupplier(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                            <input type="text" placeholder="Catatan (opsional)" value={note}
                                onChange={e => setNote(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                        </div>

                        {/* DAFTAR ITEM */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Item ({cart.length})
                                </p>
                                <button onClick={() => setShowAddModal(true)}
                                    className="bg-blue-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase shadow-md active:scale-95">
                                    ＋ Manual
                                </button>
                            </div>

                            {cart.length === 0 ? (
                                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-2">
                                    <p className="text-2xl">☝️</p>
                                    <p className="text-slate-400 text-sm font-bold">Foto SJ lalu tap "Scan dengan AI"</p>
                                    <p className="text-slate-300 text-xs">atau tambah manual</p>
                                </div>
                            ) : cart.map(item => (
                                <div key={item.key} className={`bg-white rounded-2xl shadow-sm border-l-4 p-4
                                    ${item.category === 'Tools' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                {item.isNew && <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">🆕 BARU</span>}
                                                {item.aiMatched && <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">🤖 AI</span>}
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.category}</span>
                                            </div>
                                            <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                            <p className="text-[10px] text-slate-400">📍 {locName(item.location_id)}</p>
                                            <p className="text-[9px] text-violet-400 font-bold mt-0.5">HPP diisi Procurement</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="text-right">
                                                <p className="font-black text-lg text-blue-600">{item.qty}</p>
                                                <p className="text-[10px] text-slate-400">{item.unit}</p>
                                            </div>
                                            <button onClick={() => setCart(prev => prev.filter(i => i.key !== item.key))}
                                                className="text-red-300 font-black p-1">✕</button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <select value={item.location_id} onChange={e => updateCartItem(item.key, 'location_id', e.target.value)}
                                            className="flex-1 p-2 bg-slate-50 rounded-lg outline-none text-xs font-medium text-slate-600 appearance-none">
                                            {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                                        </select>
                                        <input type="number" min="1" value={item.qty}
                                            onChange={e => updateCartItem(item.key, 'qty', Number(e.target.value))}
                                            className="w-16 p-2 bg-slate-50 rounded-lg outline-none font-bold text-slate-700 text-center text-sm" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {cart.length > 0 && (
                            <button onClick={handleSubmit} disabled={submitting}
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50">
                                {submitting ? 'Menyimpan...' : `✓ Submit ${cart.length} Item ke GR`}
                            </button>
                        )}
                    </>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function GRPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <GRContent />
        </Suspense>
    );
}
