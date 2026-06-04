'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Navbar from '../../components/Navbar';
import { useRouter, useSearchParams } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

interface POItem {
    id: number;
    qr_id: string;
    item_name: string;
    qty: number;
    unit: string;
    unit_price: number;
    location_id: number;
    location_name: string;
    category: string;
    photo_path?: string;
    photo_base64?: string;  // baru/ganti foto
    is_new?: boolean;       // item baru ditambah
    is_deleted?: boolean;   // item akan dihapus
}

function PurchaseEditContent() {
    const router = useRouter();
    const params = useSearchParams();
    const po_id = parseInt(params.get('id') || '0');

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [header, setHeader] = useState<any>(null);
    const [items, setItems] = useState<POItem[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [procNote, setProcNote] = useState('');
    const [newSjPhoto, setNewSjPhoto] = useState<string | null>(null);
    const [newSjPreview, setNewSjPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const sjInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (!['PROCUREMENT', 'ADMIN'].includes(parsed.role)) { router.push('/purchase-list'); return; }
        setUser(parsed);
        if (!po_id) { router.push('/purchase-list'); return; }
        fetchPO();
        fetchLocations();
    }, []);

    const fetchPO = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_purchase_list.php?id=${po_id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setHeader(r.header);
                setProcNote(r.header.procurement_note || '');
                setItems(r.items.map((i: any) => ({ ...i, is_deleted: false, is_new: false })));
            }
        } catch { }
        setLoading(false);
    };

    const fetchLocations = async () => {
        const res = await fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setLocations(r.data);
    };

    // ── Item helpers ──
    const updateItem = (idx: number, field: keyof POItem, val: any) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    };

    const deleteItem = (idx: number) => {
        setItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, is_deleted: !item.is_deleted } : item
        ));
    };

    const addNewItem = () => {
        const newItem: POItem = {
            id: 0, qr_id: '', item_name: '', qty: 1, unit: 'pcs',
            unit_price: 0, location_id: 1, location_name: locations[0]?.location_name || 'Gudang LT1',
            category: 'Material', is_new: true, is_deleted: false,
        };
        setItems(prev => [...prev, newItem]);
    };

    const handleItemPhoto = (idx: number, file: File) => {
        const reader = new FileReader();
        reader.onload = e => {
            updateItem(idx, 'photo_base64', e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSjPhoto = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => {
            const result = e.target?.result as string;
            setNewSjPhoto(result);
            setNewSjPreview(result);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        const activeItems = items.filter(i => !i.is_deleted);
        if (activeItems.length === 0) { alert('Minimal 1 item harus ada.'); return; }

        // Validasi item baru
        for (const item of activeItems) {
            if (!item.item_name.trim()) { alert('Nama item tidak boleh kosong.'); return; }
            if (item.qty <= 0) { alert(`Qty ${item.item_name} harus lebih dari 0.`); return; }
        }

        setSubmitting(true); setError('');
        try {
            const deletedIds = items.filter(i => i.is_deleted && !i.is_new).map(i => i.id);
            const sendItems = activeItems.map(i => ({
                id: i.id,
                qr_id: i.qr_id,
                item_name: i.item_name,
                qty: i.qty,
                unit: i.unit,
                unit_price: i.unit_price,
                location_id: i.location_id,
                location_name: i.location_name,
                category: i.category,
                photo_base64: i.photo_base64 || null,
            }));

            const res = await fetch(`${BASE_URL}/update_purchase_order.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    po_id,
                    updated_by: user?.name,
                    procurement_note: procNote,
                    sj_photo_base64: newSjPhoto || null,
                    deleted_item_ids: deletedIds,
                    items: sendItems,
                }),
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert('✅ GR berhasil direvisi dan dikirim ke Manager!');
                router.push('/purchase-list');
            } else {
                setError(r.message || 'Terjadi kesalahan.');
            }
        } catch { setError('Gagal koneksi ke server.'); }
        setSubmitting(false);
    };

    if (!user || loading) return (
        <div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Memuat...</div>
    );
    if (!header) return (
        <div className="h-screen flex items-center justify-center text-red-500 font-bold">GR tidak ditemukan.</div>
    );

    const activeItems = items.filter(i => !i.is_deleted);
    const deletedItems = items.filter(i => i.is_deleted && !i.is_new);
    const totalValue = activeItems.reduce((s, i) => s + (i.qty * i.unit_price), 0);
    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-28 font-sans">

            {/* TOP INFO */}
            <div className="bg-white border-b border-slate-100 shadow-sm px-4 py-4 max-w-2xl mx-auto">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">✏️</div>
                    <div className="flex-1">
                        <p className="font-black text-slate-800 text-sm">Revisi GR — {header.po_code}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Supplier: {header.supplier}</p>
                        {header.rejection_note && (
                            <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                <p className="text-[9px] font-black text-red-500 uppercase">Alasan Penolakan Manager</p>
                                <p className="text-xs text-red-700 mt-0.5">{header.rejection_note}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">

                {/* FOTO SJ */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Foto Surat Jalan / Dokumen</p>
                    {/* Foto existing */}
                    {header.sj_photo_path && !newSjPreview && (
                        <div className="mb-3">
                            <p className="text-[9px] text-slate-400 mb-1">Foto saat ini:</p>
                            <img src={`${BASE_URL}/${header.sj_photo_path}`} alt="SJ" className="w-full max-h-40 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                        </div>
                    )}
                    {newSjPreview && (
                        <div className="mb-3">
                            <p className="text-[9px] text-emerald-600 font-bold mb-1">Foto baru (akan menggantikan):</p>
                            <img src={newSjPreview} alt="SJ Baru" className="w-full max-h-40 object-contain rounded-xl border border-emerald-200 bg-slate-50" />
                        </div>
                    )}
                    <input ref={sjInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && handleSjPhoto(e.target.files[0])} />
                    <button onClick={() => sjInputRef.current?.click()}
                        className="w-full bg-slate-100 text-slate-600 font-black text-xs py-3 rounded-xl uppercase active:scale-95">
                        📷 {newSjPreview ? 'Ganti Foto SJ' : header.sj_photo_path ? 'Ganti Foto SJ' : 'Upload Foto SJ'}
                    </button>
                </div>

                {/* ITEM LIST */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Item GR ({activeItems.length} aktif{deletedItems.length > 0 ? `, ${deletedItems.length} akan dihapus` : ''})
                        </p>
                        <button onClick={addNewItem}
                            className="bg-violet-600 text-white font-black text-[10px] px-4 py-2 rounded-xl uppercase active:scale-95 shadow-md">
                            ＋ Tambah Item
                        </button>
                    </div>

                    <div className="space-y-3">
                        {items.map((item, idx) => (
                            <div key={idx} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
                                ${item.is_deleted ? 'border-red-200 opacity-60' : item.is_new ? 'border-violet-200' : 'border-slate-100'}`}>

                                {/* Badge */}
                                {item.is_new && !item.is_deleted && (
                                    <div className="bg-violet-500 px-4 py-1">
                                        <p className="text-[9px] font-black text-white uppercase">✨ Item Baru</p>
                                    </div>
                                )}
                                {item.is_deleted && (
                                    <div className="bg-red-500 px-4 py-1 flex justify-between items-center">
                                        <p className="text-[9px] font-black text-white uppercase">🗑️ Akan Dihapus</p>
                                        <button onClick={() => deleteItem(idx)} className="text-[9px] text-white font-black underline">Batalkan</button>
                                    </div>
                                )}

                                <div className="p-4 space-y-3">
                                    {/* Nama item */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Nama Item *</label>
                                        <input type="text" value={item.item_name}
                                            onChange={e => updateItem(idx, 'item_name', e.target.value)}
                                            disabled={item.is_deleted}
                                            placeholder="Nama barang..."
                                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm disabled:opacity-50" />
                                    </div>

                                    {/* QR ID */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">QR ID / Kode Barang</label>
                                        <input type="text" value={item.qr_id}
                                            onChange={e => updateItem(idx, 'qr_id', e.target.value)}
                                            disabled={item.is_deleted || !item.is_new}
                                            placeholder="SDU-MAT-XXX"
                                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-mono text-slate-600 text-sm disabled:opacity-50" />
                                    </div>

                                    {/* Qty + Unit + HPP */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Qty *</label>
                                            <input type="number" value={item.qty} min={1}
                                                onChange={e => updateItem(idx, 'qty', parseInt(e.target.value) || 0)}
                                                disabled={item.is_deleted}
                                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-black text-slate-700 text-sm text-center disabled:opacity-50" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Unit</label>
                                            <input type="text" value={item.unit}
                                                onChange={e => updateItem(idx, 'unit', e.target.value)}
                                                disabled={item.is_deleted}
                                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm disabled:opacity-50" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase">HPP/Unit</label>
                                            <input type="number" value={item.unit_price} min={0}
                                                onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                disabled={item.is_deleted}
                                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm disabled:opacity-50" />
                                        </div>
                                    </div>

                                    {/* Subtotal */}
                                    {!item.is_deleted && item.unit_price > 0 && (
                                        <p className="text-[10px] font-black text-emerald-600 text-right">
                                            Subtotal: {fmt(item.qty * item.unit_price)}
                                        </p>
                                    )}

                                    {/* Lokasi */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Lokasi Gudang</label>
                                        <select value={item.location_id}
                                            onChange={e => {
                                                const loc = locations.find(l => String(l.id) === e.target.value);
                                                updateItem(idx, 'location_id', parseInt(e.target.value));
                                                updateItem(idx, 'location_name', loc?.location_name || '');
                                            }}
                                            disabled={item.is_deleted}
                                            className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm appearance-none disabled:opacity-50">
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                                        </select>
                                    </div>

                                    {/* Foto item */}
                                    {!item.is_deleted && (
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Foto Item</label>
                                            {item.photo_base64 ? (
                                                <div className="mb-2">
                                                    <img src={item.photo_base64} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-emerald-200" />
                                                    <p className="text-[9px] text-emerald-600 font-bold mt-1">Foto baru dipilih</p>
                                                </div>
                                            ) : item.photo_path ? (
                                                <div className="mb-2">
                                                    <img src={`${BASE_URL}/${item.photo_path}`} alt="existing" className="w-24 h-24 object-cover rounded-xl border border-slate-100" />
                                                    <p className="text-[9px] text-slate-400 mt-1">Foto saat ini</p>
                                                </div>
                                            ) : null}
                                            <label className="inline-block cursor-pointer bg-slate-100 text-slate-600 font-black text-[10px] px-4 py-2 rounded-xl uppercase active:scale-95">
                                                📷 {item.photo_path || item.photo_base64 ? 'Ganti Foto' : 'Upload Foto'}
                                                <input type="file" accept="image/*" className="hidden"
                                                    onChange={e => e.target.files?.[0] && handleItemPhoto(idx, e.target.files[0])} />
                                            </label>
                                        </div>
                                    )}

                                    {/* Tombol hapus */}
                                    {!item.is_deleted && (
                                        <button onClick={() => deleteItem(idx)}
                                            className="w-full bg-red-50 text-red-500 font-black text-[10px] py-2.5 rounded-xl border border-red-100 uppercase active:scale-95">
                                            🗑️ Hapus Item Ini
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add item button bawah */}
                    <button onClick={addNewItem}
                        className="w-full mt-3 bg-slate-100 text-slate-500 font-black text-xs py-3.5 rounded-2xl uppercase border-2 border-dashed border-slate-200 active:scale-95">
                        ＋ Tambah Item Baru
                    </button>
                </div>

                {/* CATATAN */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Catatan Revisi</label>
                    <textarea value={procNote} onChange={e => setProcNote(e.target.value)} rows={3}
                        placeholder="Jelaskan perubahan yang dilakukan..."
                        className="w-full mt-2 p-3 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 text-sm resize-none" />
                </div>

                {/* TOTAL */}
                <div className="bg-slate-800 rounded-2xl p-5 flex justify-between items-center">
                    <p className="text-sm font-black text-white">Total Nilai GR</p>
                    <p className="text-lg font-black text-emerald-400">{fmt(totalValue)}</p>
                </div>

                {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-xs font-bold text-red-600 text-center">{error}</p></div>}

                {/* SUBMIT */}
                <button onClick={handleSubmit} disabled={submitting || activeItems.length === 0}
                    className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                    {submitting ? '⏳ Menyimpan...' : '🚀 KIRIM REVISI KE MANAGER'}
                </button>
                <button onClick={() => router.push('/purchase-list')}
                    className="w-full bg-slate-100 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase">
                    ← Kembali ke List GR
                </button>
            </div>
            <Navbar />
        </main>
    );
}

export default function PurchaseEditPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <PurchaseEditContent />
        </Suspense>
    );
}
