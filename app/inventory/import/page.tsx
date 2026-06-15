'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const UNIT_OPTIONS = ['pcs', 'set', 'unit', 'kg', 'meter', 'm', 'roll', 'botol', 'pack', 'box', 'lembar', 'buah', 'batang', 'rim', 'lusin'];

type ParsedItem = {
    key: string;
    item_name: string;
    qty: number;
    unit: string;
    category: string;
    // AI suggestion
    suggestion: any | null;
    suggestionConfidence: 'high' | 'medium' | 'low' | null;
    suggestionReason: string;
    // Staff decision — WAJIB sebelum submit
    decision: 'existing' | 'new' | null;
    decidedItem: any | null;
    // Search UI
    searchOpen: boolean;
    searchQuery: string;
    searchResults: any[];
    searching: boolean;
};

function InventoryImportContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [chatText, setChatText] = useState('');
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState('');
    const [items, setItems] = useState<ParsedItem[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [locationId, setLocationId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<any>(null);
    const [step, setStep] = useState<'input' | 'review'>('input');
    const searchTimeouts = { current: {} as Record<string, any> };

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role === 'MANAGER' || parsed.role === 'PROCUREMENT') { router.push('/'); return; }
        setUser(parsed);
        fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } })
            .then(r => r.json()).then(r => { if (r.status === 'success') setLocations(r.data); });
    }, []);

    // ── Step 1: parse chat → Step 2: AI suggest match ──
    // Normalize fraction unicode agar AI cocok dengan inventory
    const normalizeFractions = (text: string): string => text
        .replace(/¼/g, '1/4').replace(/½/g, '1/2').replace(/¾/g, '3/4')
        .replace(/⅓/g, '1/3').replace(/⅔/g, '2/3')
        .replace(/⅛/g, '1/8').replace(/⅜/g, '3/8')
        .replace(/⅝/g, '5/8').replace(/⅞/g, '7/8');

    const handleParse = async () => {
        if (!chatText.trim()) { alert("Paste teks chat dulu!"); return; }
        setParsing(true); setParseError(''); setItems([]);

        // Normalize fraction sebelum kirim ke AI
        const normalizedText = normalizeFractions(chatText);

        try {
            // Step 1: parse teks → extract items
            const res = await fetch(`${BASE_URL}/openai_proxy.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ mode: 'parse_chat', chat_text: normalizedText })
            });
            const r = await res.json();
            if (r.status !== 'success' || !Array.isArray(r.result) || r.result.length === 0) {
                setParseError(r.message || 'AI tidak menemukan item. Coba format teks yang lebih jelas.');
                setParsing(false); return;
            }
            // Normalize juga nama hasil parse
            const parsedItems = r.result.map((item: any) => ({
                ...item,
                item_name: normalizeFractions(item.item_name || ''),
            }));

            // Step 2: ambil inventory untuk AI suggest
            const invRes = await fetch(`${BASE_URL}/get_items.php`, { headers: { 'X-API-KEY': API_KEY } });
            const invData = await invRes.json();
            const inventoryList = invData.status === 'success' ? invData.data : [];

            // Step 3: AI match suggest
            const matchRes = await fetch(`${BASE_URL}/openai_proxy.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    mode: 'match_inventory',
                    sj_items: parsedItems,
                    inventory: inventoryList.slice(0, 200),
                })
            });
            const matchData = await matchRes.json();
            const matches: any[] = Array.isArray(matchData.result) ? matchData.result : [];

            // Build items dengan suggestion (decision = null, staff yang decide)
            const built: ParsedItem[] = parsedItems.map((item: any, i: number) => {
                const matchResult = matches.find((m: any) =>
                    m.sj_item_name?.toLowerCase() === item.item_name?.toLowerCase()
                ) || matches[i];

                const suggestedInv = matchResult?.matched_qr_id
                    ? inventoryList.find((inv: any) => inv.qr_id === matchResult.matched_qr_id)
                    : null;

                return {
                    key: `item_${i}_${Date.now()}`,
                    item_name: item.item_name || '',
                    qty: item.qty || 1,
                    unit: item.unit || 'pcs',
                    category: item.category || 'Material',
                    suggestion: suggestedInv || null,
                    suggestionConfidence: matchResult?.confidence || null,
                    suggestionReason: matchResult?.reason || '',
                    decision: null,
                    decidedItem: null,
                    searchOpen: false,
                    searchQuery: '',
                    searchResults: [],
                    searching: false,
                };
            });

            setItems(built);
            setStep('review');
        } catch { setParseError('Koneksi gagal. Coba lagi.'); }
        setParsing(false);
    };

    const updateItem = (key: string, patch: Partial<ParsedItem>) => {
        setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
    };

    const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

    const decideExisting = (key: string, inventoryItem: any) => {
        updateItem(key, {
            decision: 'existing',
            decidedItem: inventoryItem,
            searchOpen: false,
            searchQuery: '',
            searchResults: [],
        });
    };

    const decideNew = (key: string) => {
        updateItem(key, { decision: 'new', decidedItem: null, searchOpen: false });
    };

    const handleItemSearch = (key: string, val: string) => {
        updateItem(key, { searchQuery: val, searching: val.length >= 2 });
        if (searchTimeouts.current[key]) clearTimeout(searchTimeouts.current[key]);
        if (val.length < 2) { updateItem(key, { searchResults: [], searching: false }); return; }
        searchTimeouts.current[key] = setTimeout(async () => {
            try {
                const res = await fetch(`${BASE_URL}/search_inventory.php?q=${encodeURIComponent(val)}`, { headers: { 'X-API-KEY': API_KEY } });
                const r = await res.json();
                updateItem(key, { searchResults: r.status === 'success' ? r.data : [], searching: false });
            } catch { updateItem(key, { searchResults: [], searching: false }); }
        }, 350);
    };

    const addManualItem = () => {
        setItems(prev => [...prev, {
            key: `manual_${Date.now()}`,
            item_name: '', qty: 1, unit: 'pcs', category: 'Material',
            suggestion: null, suggestionConfidence: null, suggestionReason: '',
            decision: null, decidedItem: null,
            searchOpen: false, searchQuery: '', searchResults: [], searching: false,
        }]);
    };

    const allDecided = items.length > 0 && items.every(i => i.decision !== null);
    const decidedCount = items.filter(i => i.decision !== null).length;

    const handleSubmit = async () => {
        if (!allDecided) { alert(`Konfirmasi semua item dulu (${decidedCount}/${items.length} selesai).`); return; }
        if (!locationId) { alert("Pilih lokasi penyimpanan dulu!"); return; }
        const invalid = items.filter(i => i.decision === 'new' && !i.item_name.trim());
        if (invalid.length > 0) { alert("Ada item baru tanpa nama. Isi nama item dulu."); return; }
        if (!confirm(`Import ${items.length} item ke inventory?`)) return;

        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/purchase_order.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    po_number: `IMPORT-${Date.now()}`,
                    supplier: 'Import Manual',
                    po_date: new Date().toISOString().split('T')[0],
                    note: 'Import dari chat/pesan WA',
                    adjusted_by: user?.name || 'unknown',
                    sj_photo: '',
                    is_direct_import: true,
                    items: items.map(i => ({
                        qr_id: i.decision === 'existing' ? (i.decidedItem?.qr_id || '') : '',
                        item_name: i.decision === 'existing' ? i.decidedItem.item_name : i.item_name.trim(),
                        category: i.category,
                        unit: i.unit,
                        location_id: locationId,
                        qty: i.qty,
                        unit_price: 0,
                        item_photo: '',
                    }))
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                setSuccess(r); setItems([]); setChatText(''); setStep('input');
            } else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSubmitting(false);
    };

    if (!user) return null;

    const confidenceBadge = (c: string | null) => {
        if (c === 'high') return 'bg-emerald-100 text-emerald-700';
        if (c === 'medium') return 'bg-amber-100 text-amber-700';
        return 'bg-orange-100 text-orange-700';
    };
    const confidenceLabel = (c: string | null) => {
        if (c === 'high') return '✅ Sangat mirip';
        if (c === 'medium') return '⚠️ Kemungkinan sama';
        return '❓ Mungkin sama';
    };

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">
            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/inventory')}
                        className="bg-white border border-slate-200 text-slate-500 font-black text-xs px-3 py-2 rounded-xl active:scale-95">
                        ← Kembali
                    </button>
                    <div>
                        <h1 className="font-black text-slate-800 text-lg">Import dari Chat</h1>
                        <p className="text-[10px] text-slate-400">Paste teks WA → AI parse & suggest → review → import</p>
                    </div>
                </div>

                {/* SUCCESS */}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
                        <p className="text-4xl">✅</p>
                        <p className="font-black text-emerald-700 text-lg">Import Berhasil!</p>
                        <p className="text-sm text-emerald-600">{success.message}</p>
                        <div className="space-y-1 text-left">
                            {success.items?.map((item: any) => (
                                <div key={item.qr_id} className="flex justify-between items-center bg-white rounded-xl px-3 py-2">
                                    <p className="text-sm font-bold text-slate-700">{item.item_name}</p>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${item.status === 'NEW' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {item.status === 'NEW' ? `✨ ${item.qr_id}` : `+stok ${item.qr_id}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <p className="text-[10px] font-black text-amber-700">⚠️ HPP belum diisi</p>
                            <p className="text-[10px] text-amber-600 mt-0.5">Update harga beli di halaman inventory untuk item baru</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setSuccess(null)}
                                className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-2xl text-xs uppercase">
                                ＋ Import Lagi
                            </button>
                            <button onClick={() => router.push('/inventory')}
                                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-md">
                                📦 Lihat Inventory
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 1: INPUT */}
                {!success && step === 'input' && (
                    <>
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">💡</span>
                            <div>
                                <p className="text-[10px] font-black text-blue-700 uppercase">Cara Pakai</p>
                                <p className="text-[10px] text-blue-600 mt-0.5">
                                    Copy teks dari chat WA → paste di sini → AI extract item + cari yang mirip di inventory → staff konfirmasi tiap item
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📋 Paste Teks Chat / Pesan WA</p>
                            <textarea value={chatText} onChange={e => setChatText(e.target.value)}
                                placeholder={"Contoh:\nBarang masuk hari ini:\n*1. Kabel NYY 4x10mm = 500 meter\n*2. MCB 16A = 20 pcs\n3. Pipa conduit 20mm = 100 batang\n\nAtau format apapun dari WA..."}
                                rows={12}
                                className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-medium text-slate-700 text-sm resize-none focus:bg-white focus:ring-2 ring-blue-200 transition-all" />
                            {chatText && (
                                <button onClick={() => setChatText('')} className="text-[10px] font-black text-slate-400 underline">✕ Hapus teks</button>
                            )}
                            {parseError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                    <p className="text-[10px] font-black text-red-600">⚠️ {parseError}</p>
                                </div>
                            )}
                            <button onClick={handleParse} disabled={parsing || !chatText.trim()}
                                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                                {parsing
                                    ? <><span className="animate-spin">⏳</span><span>AI membaca & mencocokkan inventory...</span></>
                                    : <><span>🤖</span><span>Parse & Cari di Inventory</span></>}
                            </button>
                        </div>
                    </>
                )}

                {/* STEP 2: REVIEW */}
                {!success && step === 'review' && (
                    <>
                        {/* Progress */}
                        <div className={`rounded-2xl px-4 py-3 border ${allDecided ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className={`text-[10px] font-black uppercase ${allDecided ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {allDecided ? '✅ Semua item sudah dikonfirmasi' : `⏳ Konfirmasi item (${decidedCount}/${items.length})`}
                                </p>
                                <button onClick={() => { setStep('input'); setItems([]); }}
                                    className="text-[10px] font-black text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                    ← Edit Teks
                                </button>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${allDecided ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                    style={{ width: `${(decidedCount / Math.max(items.length, 1)) * 100}%` }} />
                            </div>
                            {!allDecided && <p className="text-[9px] text-amber-600 mt-1.5">Tiap item harus dikonfirmasi: apply suggest atau buat item baru</p>}
                        </div>

                        {/* Lokasi */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                            <p className="text-[10px] font-black text-slate-500 uppercase">📍 Lokasi Penyimpanan *</p>
                            <select value={locationId} onChange={e => setLocationId(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                <option value="">-- Pilih Lokasi --</option>
                                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                            </select>
                        </div>

                        {/* Item list */}
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={item.key} className={`rounded-2xl border-2 overflow-hidden transition-all ${item.decision === 'existing' ? 'border-emerald-400 bg-emerald-50' :
                                        item.decision === 'new' ? 'border-blue-400 bg-blue-50' :
                                            'border-slate-200 bg-white'
                                    }`}>
                                    {/* Status bar setelah decide */}
                                    {item.decision && (
                                        <div className={`px-4 py-2 flex items-center gap-2 ${item.decision === 'existing' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                                            <span className="text-white text-[10px] font-black flex-1 truncate">
                                                {item.decision === 'existing'
                                                    ? `✅ Apply: ${item.decidedItem?.qr_id} — ${item.decidedItem?.item_name}`
                                                    : '🆕 Buat item baru — QR akan digenerate'}
                                            </span>
                                            <button onClick={() => updateItem(item.key, { decision: null, decidedItem: null, searchOpen: false })}
                                                className="text-white/70 text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-lg flex-shrink-0">
                                                Ubah
                                            </button>
                                        </div>
                                    )}

                                    <div className="p-4 space-y-3">
                                        {/* No + Kategori + Hapus */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">#{idx + 1}</span>
                                            <select value={item.category} onChange={e => updateItem(item.key, { category: e.target.value })}
                                                className="text-[9px] font-black rounded-lg px-2 py-1 outline-none appearance-none border border-slate-200 bg-slate-50 text-slate-600">
                                                <option value="Material">Material</option>
                                                <option value="Tools">Tools</option>
                                            </select>
                                            <button onClick={() => removeItem(item.key)}
                                                className="ml-auto text-red-300 font-black text-lg leading-none">✕</button>
                                        </div>

                                        {/* Nama item */}
                                        <input type="text" value={item.item_name}
                                            onChange={e => updateItem(item.key, { item_name: e.target.value })}
                                            placeholder="Nama item *"
                                            className={`w-full p-3 rounded-xl outline-none font-bold text-slate-800 border transition-all ${!item.item_name.trim() ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`} />

                                        {/* Qty + Unit */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase flex-shrink-0">Qty:</label>
                                            <button onClick={() => updateItem(item.key, { qty: Math.max(1, item.qty - 1) })}
                                                className="w-8 h-8 bg-slate-100 rounded-lg font-black text-slate-500 flex items-center justify-center active:scale-95">−</button>
                                            <input type="number" min="1" value={item.qty}
                                                onChange={e => updateItem(item.key, { qty: Number(e.target.value) })}
                                                className="w-14 text-center font-black text-blue-600 text-sm border border-slate-200 rounded-lg py-1.5 outline-none bg-white" />
                                            <button onClick={() => updateItem(item.key, { qty: item.qty + 1 })}
                                                className="w-8 h-8 bg-slate-100 rounded-lg font-black text-slate-500 flex items-center justify-center active:scale-95">＋</button>
                                            <select value={item.unit} onChange={e => updateItem(item.key, { unit: e.target.value })}
                                                className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-600 appearance-none">
                                                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>

                                        {/* Suggestion + Decision (hanya tampil kalau belum decide) */}
                                        {!item.decision && (
                                            <div className="space-y-2">
                                                {item.suggestion ? (
                                                    <div className="bg-slate-50 rounded-xl p-3 space-y-2.5 border border-slate-200">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-slate-600">🤖 AI Suggest:</span>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${confidenceBadge(item.suggestionConfidence)}`}>
                                                                {confidenceLabel(item.suggestionConfidence)}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                            <p className="font-bold text-sm text-slate-800">{item.suggestion.item_name}</p>
                                                            <p className="text-[10px] font-mono text-slate-400">{item.suggestion.qr_id}</p>
                                                            <p className="text-[10px] text-slate-500">Stok: {item.suggestion.stock_qty} {item.suggestion.unit}</p>
                                                            {item.suggestionReason && <p className="text-[9px] text-slate-400 italic mt-0.5">"{item.suggestionReason}"</p>}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => decideExisting(item.key, item.suggestion)}
                                                                className="flex-1 bg-emerald-600 text-white font-black text-[10px] py-2.5 rounded-xl active:scale-95">
                                                                ✅ Apply Suggest
                                                            </button>
                                                            <button onClick={() => decideNew(item.key)}
                                                                className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 font-black text-[10px] py-2.5 rounded-xl active:scale-95">
                                                                🆕 Item Baru
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                                                        <p className="text-[10px] text-blue-600 font-bold mb-2">🤖 AI tidak menemukan item serupa di inventory</p>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => decideNew(item.key)}
                                                                className="flex-1 bg-blue-600 text-white font-black text-[10px] py-2.5 rounded-xl active:scale-95">
                                                                🆕 Buat Item Baru
                                                            </button>
                                                            <button onClick={() => updateItem(item.key, { searchOpen: !item.searchOpen })}
                                                                className="flex-1 bg-white text-slate-600 border border-slate-200 font-black text-[10px] py-2.5 rounded-xl active:scale-95">
                                                                🔍 Cari Manual
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Link cari manual (jika ada suggestion tapi mau cari sendiri) */}
                                                {item.suggestion && (
                                                    <button onClick={() => updateItem(item.key, { searchOpen: !item.searchOpen })}
                                                        className="w-full text-[9px] font-black text-slate-400 underline text-center">
                                                        {item.searchOpen ? '▲ Tutup pencarian' : '🔍 Cari item lain di inventory'}
                                                    </button>
                                                )}

                                                {/* Search panel */}
                                                {item.searchOpen && (
                                                    <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
                                                        <input type="text" value={item.searchQuery}
                                                            onChange={e => handleItemSearch(item.key, e.target.value)}
                                                            placeholder="Ketik nama item di inventory..."
                                                            autoFocus
                                                            className="w-full p-2.5 bg-white border border-blue-200 rounded-xl outline-none text-xs font-medium text-slate-700" />
                                                        {item.searching && <p className="text-[9px] text-slate-400 animate-pulse text-center">Mencari...</p>}
                                                        {item.searchResults.length > 0 && (
                                                            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-52 overflow-y-auto shadow-sm">
                                                                {item.searchResults.map((inv: any) => (
                                                                    <button key={inv.qr_id} onClick={() => decideExisting(item.key, inv)}
                                                                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 active:scale-[0.98] transition-all">
                                                                        <div className="flex justify-between items-start gap-2">
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="font-bold text-xs text-slate-800 truncate">{inv.item_name}</p>
                                                                                <p className="text-[9px] font-mono text-slate-400">{inv.qr_id} · Total: {inv.stock_qty} {inv.unit}</p>
                                                                                {/* Lokasi per gudang */}
                                                                                {inv.locations && inv.locations.length > 0 && (
                                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                                        {inv.locations.map((loc: any) => (
                                                                                            <span key={loc.location_id}
                                                                                                className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                                                                                                📍 {loc.location_name}: {loc.stock_qty} {inv.unit}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex-shrink-0 mt-0.5">Pilih</span>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {item.searchQuery.length >= 2 && !item.searching && item.searchResults.length === 0 && (
                                                            <div className="text-center py-2 space-y-1.5">
                                                                <p className="text-[9px] text-slate-400 italic">Tidak ditemukan di inventory</p>
                                                                <button onClick={() => decideNew(item.key)}
                                                                    className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                                                                    🆕 Buat sebagai item baru
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tambah manual */}
                        <button onClick={addManualItem}
                            className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-3 text-[10px] font-black text-slate-400 uppercase active:bg-slate-50">
                            ＋ Tambah Item Manual
                        </button>

                        {/* Submit */}
                        {items.length > 0 && (
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Ringkasan Import</p>
                                        <p className="font-black text-slate-800 text-lg mt-0.5">{items.length} item</p>
                                        <div className="flex gap-3 mt-1">
                                            <p className="text-[10px] text-emerald-600 font-bold">✅ {items.filter(i => i.decision === 'existing').length} existing</p>
                                            <p className="text-[10px] text-blue-600 font-bold">🆕 {items.filter(i => i.decision === 'new').length} baru</p>
                                            {items.filter(i => !i.decision).length > 0 && <p className="text-[10px] text-amber-600 font-bold">⏳ {items.filter(i => !i.decision).length} belum dikonfirmasi</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400">Lokasi</p>
                                        <p className="font-bold text-sm text-slate-700">
                                            {locationId ? locations.find(l => String(l.id) === locationId)?.location_name : '—'}
                                        </p>
                                    </div>
                                </div>
                                {items.filter(i => i.decision === 'new').length > 0 && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                                        <p className="text-[10px] font-black text-amber-700">⚠️ Item baru: HPP belum diisi</p>
                                        <p className="text-[10px] text-amber-600 mt-0.5">Update harga beli di halaman inventory setelah import</p>
                                    </div>
                                )}
                                <button onClick={handleSubmit}
                                    disabled={submitting || !allDecided || !locationId}
                                    className={`w-full font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50 ${allDecided && locationId ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}>
                                    {submitting ? '⏳ Menyimpan...' :
                                        !locationId ? '📍 Pilih lokasi dulu' :
                                            !allDecided ? `⏳ Konfirmasi ${items.length - decidedCount} item lagi` :
                                                `✓ Import ${items.length} Item ke Inventory`}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function InventoryImportPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <InventoryImportContent />
        </Suspense>
    );
}
