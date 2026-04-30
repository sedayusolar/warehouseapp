'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

function InventoryContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filter state
    const [filterLocation, setFilterLocation] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [form, setForm] = useState({
        item_name: '',
        category: '',
        unit: '',
        stock_qty: 0,
        storage_location_id: '',
    });
    const [newItemQr, setNewItemQr] = useState('');
    const [newItemName, setNewItemName] = useState('');

    // Edit state
    const [editingQr, setEditingQr] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    const [savingEdit, setSavingEdit] = useState(false);

    // Stock log state
    const [logQr, setLogQr] = useState<string | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLog, setLoadingLog] = useState(false);

    const handleStartEdit = (item: any) => {
        setEditingQr(item.qr_id);
        setLogQr(null);
        setEditForm({
            item_name: item.item_name,
            category: item.category,
            unit: item.unit,
            stock_qty: item.stock_qty,
            storage_location_id: item.storage_location_id || '',
            note: '',
        });
    };

    const fetchLog = async (qrId: string) => {
        if (logQr === qrId) { setLogQr(null); return; } // toggle
        setLogQr(qrId);
        setLoadingLog(true);
        try {
            const res = await fetch(`${BASE_URL}/get_stock_logs.php?qr_id=${qrId}`, {
                headers: { 'X-API-KEY': API_KEY }
            });
            const result = await res.json();
            if (result.status === 'success') setLogs(result.data);
            else setLogs([]);
        } catch { setLogs([]); }
        setLoadingLog(false);
    };

    const handleSaveEdit = async () => {
        if (!editForm.item_name || !editForm.category || !editForm.unit) {
            alert("Nama, kategori, dan satuan wajib diisi."); return;
        }
        setSavingEdit(true);
        try {
            const res = await fetch(`${BASE_URL}/update_item.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    qr_id: editingQr,
                    ...editForm,
                    stock_qty: Number(editForm.stock_qty),
                    adjusted_by: user?.name || 'unknown',
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                setEditingQr(null);
                fetchItems(filterLocation, filterCategory);
            } else {
                alert("Gagal: " + result.message);
            }
        } catch (e) { alert("Gagal koneksi server."); }
        setSavingEdit(false);
    };

    const handlePrintQr = (qrId: string, itemName: string) => {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>QR Label - ${qrId}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f8f9fa; }
        .label { background:white; border:2px solid #000; border-radius:8px; padding:16px; width:200px; text-align:center; }
        .company { font-size:9px; font-weight:bold; letter-spacing:2px; color:#666; margin-bottom:8px; }
        .qr-box { display:flex; justify-content:center; margin:8px 0; }
        .qr-id { font-size:12px; font-weight:900; letter-spacing:1px; margin:6px 0 4px; }
        .item-name { font-size:10px; color:#333; line-height:1.3; word-break:break-word; }
        @media print { body { background:white; } }
    </style>
</head>
<body>
    <div class="label">
        <div class="company">⚡ SEDAYU SOLAR</div>
        <div class="qr-box" id="qrcode"></div>
        <div class="qr-id">${qrId}</div>
        <div class="item-name">${itemName}</div>
    </div>
    <script>
        new QRCode(document.getElementById('qrcode'), {
            text: '${qrId}', width: 130, height: 130,
            colorDark:'#000000', colorLight:'#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        setTimeout(() => window.print(), 800);
    <\/script>
</body>
</html>`);
        win.document.close();
    };

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) { router.push('/login'); return; }
        setUser(JSON.parse(loggedInUser));
        fetchLocations();
        fetchItems();
    }, []);

    const fetchLocations = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
            const result = await res.json();
            if (result.status === 'success') setLocations(result.data);
        } catch (e) { console.error("Gagal fetch locations", e); }
    };

    const fetchItems = async (locId = '', cat = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (locId) params.append('location_id', locId);
            if (cat) params.append('category', cat);
            const res = await fetch(`${BASE_URL}/get_items.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const result = await res.json();
            if (result.status === 'success') setItems(result.data);
        } catch (e) { console.error("Gagal fetch items", e); }
        setLoading(false);
    };

    const handleFilterChange = (locId: string, cat: string) => {
        setFilterLocation(locId);
        setFilterCategory(cat);
        fetchItems(locId, cat);
    };

    const handleSubmitItem = async () => {
        if (!form.item_name || !form.category || !form.unit) {
            alert("Nama barang, kategori, dan satuan wajib diisi!"); return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/add_item.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ ...form, stock_qty: Number(form.stock_qty) })
            });
            const result = await res.json();
            if (result.status === 'success') {
                setNewItemQr(result.qr_id);
                setNewItemName(form.item_name);
                setForm({ item_name: '', category: '', unit: '', stock_qty: 0, storage_location_id: '' });
                fetchItems(filterLocation, filterCategory);
            } else {
                alert("Gagal: " + result.message);
            }
        } catch (e) { alert("Gagal koneksi server."); }
        setSubmitting(false);
    };

    const filtered = items.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.qr_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-28 font-sans text-slate-900">
            {/* HEADER */}
            <div className="bg-slate-900 text-white sticky top-0 z-20 shadow-lg">
                <div className="p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">Inventory List</h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{user.name} · {user.role}</p>
                    </div>
                    {user.role !== 'MANAGER' && (
                        <button
                            onClick={() => { setShowForm(v => !v); setNewItemQr(''); }}
                            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${showForm ? 'bg-slate-700 text-slate-300' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'}`}
                        >
                            {showForm ? '✕ Tutup' : '＋ Daftarkan'}
                        </button>
                    )}
                </div>

                {/* FILTER BAR */}
                <div className="px-4 pb-4 space-y-2">
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="🔍 Cari nama / QR ID..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full p-3 bg-slate-800 text-white placeholder-slate-500 rounded-xl outline-none text-sm font-medium"
                    />
                    {/* Filter row */}
                    <div className="flex gap-2">
                        <select
                            value={filterLocation}
                            onChange={e => handleFilterChange(e.target.value, filterCategory)}
                            className="flex-1 p-2.5 bg-slate-800 text-slate-200 rounded-xl outline-none text-xs font-bold appearance-none"
                        >
                            <option value="">Semua Lokasi</option>
                            {locations.map((l: any) => (
                                <option key={l.id} value={l.id}>{l.location_name}</option>
                            ))}
                        </select>
                        <select
                            value={filterCategory}
                            onChange={e => handleFilterChange(filterLocation, e.target.value)}
                            className="flex-1 p-2.5 bg-slate-800 text-slate-200 rounded-xl outline-none text-xs font-bold appearance-none"
                        >
                            <option value="">Semua Kategori</option>
                            <option value="Material">Material</option>
                            <option value="Tools">Tools</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4 max-w-4xl mx-auto">

                {/* FORM REGISTER */}
                {showForm && (
                    <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4 border border-blue-100">
                        <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Daftarkan Inventory Baru</h2>

                        {newItemQr && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">✅ Berhasil Didaftarkan!</p>
                                <p className="font-black text-2xl text-emerald-700 font-mono">{newItemQr}</p>
                                <p className="text-xs text-slate-500">{newItemName}</p>
                                <button
                                    onClick={() => handlePrintQr(newItemQr, newItemName)}
                                    className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md"
                                >
                                    🖨️ Print Label QR
                                </button>
                            </div>
                        )}

                        <input
                            type="text"
                            placeholder="Nama Barang *"
                            value={form.item_name}
                            onChange={e => setForm({ ...form, item_name: e.target.value })}
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none"
                            >
                                <option value="">Kategori *</option>
                                <option value="Material">Material</option>
                                <option value="Tools">Tools</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Satuan * (pcs, m, kg...)"
                                value={form.unit}
                                onChange={e => setForm({ ...form, unit: e.target.value })}
                                className="p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Stok Awal</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.stock_qty}
                                    onChange={e => setForm({ ...form, stock_qty: Number(e.target.value) })}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lokasi Penyimpanan</label>
                                <select
                                    value={form.storage_location_id}
                                    onChange={e => setForm({ ...form, storage_location_id: e.target.value })}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none mt-1"
                                >
                                    <option value="">-- Pilih Lokasi --</option>
                                    {locations.map((l: any) => (
                                        <option key={l.id} value={l.id}>{l.location_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmitItem}
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {submitting ? 'Menyimpan...' : '✓ Daftarkan & Generate QR ID'}
                        </button>
                    </div>
                )}

                {/* INVENTORY LIST */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Memuat Data...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-300 italic text-sm">Tidak ada item ditemukan.</div>
                ) : (
                    <>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {filtered.length} item ditemukan
                        </p>

                        {/* GROUP BY CATEGORY */}
                        {['Material', 'Tools'].map(cat => {
                            const group = filtered.filter(i => i.category === cat);
                            if (group.length === 0) return null;
                            return (
                                <div key={cat} className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                                        {cat === 'Material' ? '📦' : '🛠️'} {cat} ({group.length})
                                    </h3>
                                    {group.map((item: any) => (
                                        <div
                                            key={item.qr_id}
                                            className={`bg-white rounded-2xl shadow-sm border-l-4 ${item.category === 'Material' ? 'border-l-emerald-500' : 'border-l-amber-500'} overflow-hidden`}
                                        >
                                            {/* EDIT MODE */}
                                            {editingQr === item.qr_id ? (
                                                <div className="p-4 space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Edit Item</p>
                                                        <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={editForm.item_name}
                                                        onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                                                        placeholder="Nama Barang *"
                                                        className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm"
                                                    />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <select
                                                            value={editForm.category}
                                                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                            className="p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none"
                                                        >
                                                            <option value="Material">Material</option>
                                                            <option value="Tools">Tools</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={editForm.unit}
                                                            onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                                                            placeholder="Satuan *"
                                                            className="p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Stok Fisik</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={editForm.stock_qty}
                                                                onChange={e => setEditForm({ ...editForm, stock_qty: e.target.value })}
                                                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm mt-1"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Lokasi</label>
                                                            <select
                                                                value={editForm.storage_location_id}
                                                                onChange={e => setEditForm({ ...editForm, storage_location_id: e.target.value })}
                                                                className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none mt-1"
                                                            >
                                                                <option value="">-- Pilih --</option>
                                                                {locations.map((l: any) => (
                                                                    <option key={l.id} value={l.id}>{l.location_name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={editForm.note}
                                                        onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                                        placeholder="Catatan perubahan stok (opsional)..."
                                                        className="w-full p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm"
                                                    />
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={() => setEditingQr(null)}
                                                            className="flex-1 bg-slate-100 text-slate-500 font-black py-2.5 rounded-xl text-xs"
                                                        >
                                                            Batal
                                                        </button>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            disabled={savingEdit}
                                                            className="flex-1 bg-blue-600 text-white font-black py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50"
                                                        >
                                                            {savingEdit ? 'Menyimpan...' : '✓ Simpan'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* NORMAL MODE */
                                                <div className="p-4">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-800 text-sm leading-tight">{item.item_name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                                <button
                                                                    onClick={() => handlePrintQr(item.qr_id, item.item_name)}
                                                                    className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md active:scale-95 transition-all"
                                                                >
                                                                    🖨️ Print
                                                                </button>
                                                            </div>
                                                            {item.location_name && (
                                                                <span className="inline-block mt-1.5 text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                                    📍 {item.location_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="text-right">
                                                                <p className={`text-lg font-black ${Number(item.available_qty) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                    {item.available_qty}
                                                                    <span className="text-[10px] font-bold text-slate-400 ml-1">{item.unit}</span>
                                                                </p>
                                                                <p className="text-[9px] text-slate-400 font-bold">tersedia</p>
                                                                {Number(item.reserved_qty) > 0 && (
                                                                    <p className="text-[9px] text-orange-500 font-black">⏳ {item.reserved_qty} pending</p>
                                                                )}
                                                            </div>
                                                            {user.role !== 'MANAGER' && (
                                                                <button
                                                                    onClick={() => handleStartEdit(item)}
                                                                    className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg active:scale-95 transition-all"
                                                                >
                                                                    ✏️ Edit
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => fetchLog(item.qr_id)}
                                                                className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg active:scale-95 transition-all"
                                                            >
                                                                📋 Log
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Stok bar */}
                                                    <div className="mt-3">
                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${Number(item.available_qty) > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                                                                style={{ width: `${Math.min(100, (Number(item.available_qty) / Math.max(Number(item.stock_qty), 1)) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 mt-1 block">Stok fisik: {item.stock_qty} {item.unit}</span>
                                                    </div>

                                                    {/* STOCK LOG PANEL */}
                                                    {logQr === item.qr_id && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">📋 Riwayat Adjustment Stok</p>
                                                            {loadingLog ? (
                                                                <p className="text-[10px] text-slate-400 animate-pulse py-2">Memuat log...</p>
                                                            ) : logs.length === 0 ? (
                                                                <p className="text-[10px] text-slate-300 italic py-2">Belum ada perubahan stok tercatat.</p>
                                                            ) : (
                                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                                    {logs.map((log: any) => (
                                                                        <div key={log.id} className="flex justify-between items-start gap-2 bg-slate-50 rounded-xl p-2.5">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className={`text-[10px] font-black ${log.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                        {log.diff > 0 ? `+${log.diff}` : log.diff}
                                                                                    </span>
                                                                                    <span className="text-[10px] text-slate-500">
                                                                                        ({log.stock_before} → {log.stock_after})
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-[9px] text-slate-400 font-bold">{log.adjusted_by}</p>
                                                                                {log.note && <p className="text-[9px] text-slate-500 italic mt-0.5">"{log.note}"</p>}
                                                                            </div>
                                                                            <p className="text-[9px] text-slate-300 flex-shrink-0">{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* BOTTOM MENU */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-50 p-4 pb-6">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button onClick={() => router.push('/')} className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                        🏠 Menu Utama
                    </button>
                    <button onClick={() => router.push('/transactions')} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all">
                        📋 Transaksi
                    </button>
                </div>
            </div>
        </main>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <InventoryContent />
        </Suspense>
    );
}
