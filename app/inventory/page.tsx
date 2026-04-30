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
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-1">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">✅ Berhasil Didaftarkan!</p>
                                <p className="font-black text-2xl text-emerald-700 font-mono">{newItemQr}</p>
                                <p className="text-xs text-emerald-600">QR ID otomatis — print & tempel ke barang</p>
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
                                            className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${item.category === 'Material' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm leading-tight">{item.item_name}</p>
                                                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{item.qr_id}</p>
                                                    {item.location_name && (
                                                        <span className="inline-block mt-1.5 text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                            📍 {item.location_name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className={`text-lg font-black ${Number(item.available_qty) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {item.available_qty}
                                                        <span className="text-[10px] font-bold text-slate-400 ml-1">{item.unit}</span>
                                                    </p>
                                                    <p className="text-[9px] text-slate-400 font-bold">tersedia</p>
                                                    {Number(item.reserved_qty) > 0 && (
                                                        <p className="text-[9px] text-orange-500 font-black mt-0.5">
                                                            ⏳ {item.reserved_qty} pending
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stok bar visual */}
                                            <div className="mt-3">
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${Number(item.available_qty) > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                                                        style={{ width: `${Math.min(100, (Number(item.available_qty) / Math.max(Number(item.stock_qty), 1)) * 100)}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[9px] text-slate-400">Stok fisik: {item.stock_qty} {item.unit}</span>
                                                </div>
                                            </div>
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
