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
};

function PurchaseContent() {
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

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        // MANAGER dan PROCUREMENT tidak bisa input PO
        if (parsed.role === 'MANAGER' || parsed.role === 'PROCUREMENT') {
            router.push('/purchase-list'); return;
        }
        setUser(parsed);
        fetch(`${BASE_URL}/get_locations.php`, { headers: { 'X-API-KEY': API_KEY } })
            .then(r => r.json()).then(r => { if (r.status === 'success') setLocations(r.data); });
    }, []);

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        setSelectedItem(null);
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
        setSelectedItem(item);
        setSearchQuery(item.item_name);
        setSearchResults([]);
    };

    const addExistingToCart = () => {
        if (!selectedItem) { alert("Pilih item terlebih dahulu."); return; }
        if (!modalLocationId || Number(modalQty) <= 0) {
            alert("Pilih lokasi dan isi qty terlebih dahulu."); return;
        }
        const key = `${selectedItem.qr_id}_${Date.now()}`;
        setCart(prev => [...prev, {
            key, qr_id: selectedItem.qr_id, item_name: selectedItem.item_name,
            category: selectedItem.category, unit: selectedItem.unit,
            location_id: modalLocationId, qty: Number(modalQty),
            item_photo: '', isNew: false,
        }]);
        resetModal();
    };

    const addNewToCart = () => {
        if (!newName || !newCategory || !newUnit) { alert("Nama, kategori, satuan wajib."); return; }
        if (!modalLocationId || Number(modalQty) <= 0) { alert("Pilih lokasi dan isi qty."); return; }
        const key = `new_${Date.now()}`;
        setCart(prev => [...prev, {
            key, qr_id: '', item_name: newName,
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

    const updateCartItem = (key: string, field: string, value: any) => {
        setCart(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
    };

    const handleSubmit = async () => {
        if (cart.length === 0) { alert("Tambahkan minimal 1 item."); return; }
        if (!sjPhoto) { alert("Upload foto surat jalan / PO terlebih dahulu."); return; }
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
                        unit_price: 0,  // HPP diisi oleh Procurement
                        item_photo: i.item_photo,
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

            {/* ADD ITEM MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={resetModal}>
                    <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tambah Item</p>
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

                        {/* MODE SEARCH */}
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
                                                className="w-full text-left p-3.5 hover:bg-blue-50 transition-colors flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{item.qr_id} · Stok: {item.stock_qty} {item.unit}</p>
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg flex-shrink-0">Pilih</span>
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

                        {/* MODE ITEM BARU — tanpa field HPP */}
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
                                {/* Info HPP diisi Procurement */}
                                <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-black text-violet-500">💡 HPP akan diisi oleh Tim Procurement</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Foto Item (opsional)</label>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <button onClick={() => newItemPhotoRef.current?.click()}
                                            className="px-3 py-2 bg-slate-100 text-slate-500 font-black text-xs rounded-xl active:scale-95">📷 Upload</button>
                                        {newItemPhotoPreview && (
                                            <img src={newItemPhotoPreview} className="w-12 h-12 object-cover rounded-lg border" alt="" />
                                        )}
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

                        {/* LOKASI + QTY — tanpa HPP */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Lokasi & Jumlah</p>
                            <select value={modalLocationId} onChange={e => setModalLocationId(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
                                <option value="">-- Pilih Lokasi Penyimpanan *</option>
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
                                className={`w-full font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all
                                    ${selectedItem ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                {selectedItem ? `＋ Tambahkan "${selectedItem.item_name}" ke PO` : 'Pilih item dulu dari hasil pencarian'}
                            </button>
                        )}
                        {addMode === 'new' && (
                            <button onClick={addNewToCart}
                                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95">
                                ＋ Tambahkan ke PO
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="p-4 max-w-2xl mx-auto space-y-5">

                {/* SUCCESS — update pesan ke flow baru */}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-3">
                        <p className="text-4xl">✅</p>
                        <p className="font-black text-emerald-700 text-lg">PO Berhasil Diinput!</p>
                        <p className="text-sm text-emerald-600">{success.message}</p>

                        {/* Flow baru */}
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
                                ＋ Input PO Baru
                            </button>
                            <button onClick={() => router.push('/purchase-list')}
                                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-md">
                                📋 Lihat Status PO
                            </button>
                        </div>
                    </div>
                )}

                {!success && (
                    <>
                        {/* Info flow baru */}
                        <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">💡</span>
                            <div>
                                <p className="text-[10px] font-black text-violet-700 uppercase">Info Alur PO Baru</p>
                                <p className="text-[10px] text-violet-600 mt-0.5">
                                    Staff input item & qty → Procurement input HPP & lampirkan dok → Manager approve → Stok masuk
                                </p>
                            </div>
                        </div>

                        {/* FOTO SURAT JALAN */}
                        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📄 Surat Jalan / Packing List</p>
                            {sjPhotoPreview ? (
                                <div className="relative">
                                    <img src={sjPhotoPreview} alt="SJ" className="w-full max-h-64 object-cover rounded-2xl border border-slate-100" />
                                    <button onClick={() => { setSjPhoto(''); setSjPhotoPreview(''); }}
                                        className="absolute top-2 right-2 bg-red-500 text-white font-black text-xs px-2 py-1 rounded-lg">✕ Hapus</button>
                                    <p className="text-[10px] text-emerald-600 font-bold text-center mt-1">✅ Foto tersimpan</p>
                                </div>
                            ) : (
                                <button onClick={() => sjPhotoRef.current?.click()}
                                    className="w-full border-2 border-dashed border-slate-300 rounded-2xl py-10 text-center active:bg-slate-50">
                                    <p className="text-3xl mb-2">📷</p>
                                    <p className="font-black text-slate-400 text-sm">Tap untuk foto surat jalans</p>
                                    <p className="text-[10px] text-slate-300 mt-1">Wajib diisi</p>
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
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item ({cart.length})</p>
                                <button onClick={() => setShowAddModal(true)}
                                    className="bg-blue-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase shadow-md active:scale-95">
                                    ＋ Tambah Item
                                </button>
                            </div>
                            {cart.length === 0 ? (
                                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                                    <p className="text-slate-300 text-sm italic">Belum ada item. Tap ＋ Tambah Item</p>
                                </div>
                            ) : cart.map(item => (
                                <div key={item.key} className={`bg-white rounded-2xl shadow-sm border-l-4 p-4 ${item.category === 'Tools' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {item.isNew && <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">BARU</span>}
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
                                {submitting ? 'Menyimpan...' : `✓ Submit ${cart.length} Item ke Procurement`}
                            </button>
                        )}
                    </>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function PurchasePage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <PurchaseContent />
        </Suspense>
    );
}
