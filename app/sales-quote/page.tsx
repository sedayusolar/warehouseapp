'use client';
import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const SYNC_LABEL: Record<string, string> = { PENDING: 'Belum Sync', SYNCED: 'Tersinkron', FAILED: 'Gagal Sync' };
const SYNC_COLOR: Record<string, string> = {
    PENDING: 'text-orange-500 bg-orange-50',
    SYNCED: 'text-emerald-600 bg-emerald-50',
    FAILED: 'text-red-500 bg-red-50',
};

const fmtRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

function SalesQuoteContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [tab, setTab] = useState<'baru' | 'list'>('baru');

    // ── Form ──
    const [cart, setCart] = useState<any[]>([]);
    const [customerId, setCustomerId] = useState<number | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [quoteDate, setQuoteDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [termName, setTermName] = useState('');
    const [discountUnit, setDiscountUnit] = useState('0');
    const [message, setMessage] = useState('');
    const [memo, setMemo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // ── Customer picker ──
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerRaw, setCustomerRaw] = useState<any[]>([]);
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');

    // ── Product picker ──
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [productRaw, setProductRaw] = useState<any[]>([]);
    const [productResults, setProductResults] = useState<any[]>([]);
    const [productLoading, setProductLoading] = useState(false);
    const [productError, setProductError] = useState('');

    // ── List ──
    const [listStatus, setListStatus] = useState<string>('');
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [detailQuote, setDetailQuote] = useState<any>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (!['ADMIN', 'MANAGER'].includes(parsed.role)) {
            alert("Akses ditolak! Halaman ini hanya untuk Admin dan Manager.");
            router.push('/dashboard');
            return;
        }
        setUser(parsed);
        setQuoteDate(new Date().toISOString().slice(0, 10));
    }, []);

    useEffect(() => { if (tab === 'list') fetchQuotes(listStatus); }, [tab, listStatus]);

    const fetchQuotes = async (status: string) => {
        setLoadingList(true);
        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            const res = await fetch(`${BASE_URL}/get_quote_list.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setQuotes(r.data);
        } catch { }
        setLoadingList(false);
    };

    const openDetail = async (item: any) => {
        setDetailQuote(item); setDetailItems([]); setLoadingDetail(true);
        try {
            const res = await fetch(`${BASE_URL}/get_quote_detail.php?id=${item.id}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') { setDetailQuote(r.header); setDetailItems(r.items); }
        } catch { }
        setLoadingDetail(false);
    };

    const retrySync = async () => {
        if (!detailQuote) return;
        setRetrying(true);
        try {
            const res = await fetch(`${BASE_URL}/retry_quote_sync.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ id: detailQuote.id })
            });
            const r = await res.json();
            alert(r.message);
            if (r.status === 'success') { setDetailQuote(null); fetchQuotes(listStatus); }
        } catch { alert('Gagal koneksi.'); }
        setRetrying(false);
    };

    const refreshFromJurnal = async () => {
        if (!detailQuote) return;
        setRefreshing(true);
        try {
            const res = await fetch(`${BASE_URL}/refresh_quote.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ id: detailQuote.id })
            });
            const r = await res.json();
            if (r.status === 'success') { await openDetail(detailQuote); fetchQuotes(listStatus); }
            else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setRefreshing(false);
    };

    // ── Customer picker ──
    const fetchCustomers = async () => {
        setCustomerLoading(true); setCustomerError('');
        try {
            const params = new URLSearchParams({ action: 'list_customers', page: '1', per_page: '100' });
            const res = await fetch(`${BASE_URL}/jurnal_proxy.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (!res.ok || !Array.isArray(r.customers)) {
                setCustomerError(r.message || 'Gagal ambil data customer.'); setCustomerRaw([]); setCustomerResults([]);
            } else { setCustomerRaw(r.customers); setCustomerResults(r.customers); }
        } catch { setCustomerError('Gagal koneksi.'); setCustomerRaw([]); setCustomerResults([]); }
        setCustomerLoading(false);
    };
    const openCustomerPicker = () => { setShowCustomerPicker(true); setCustomerSearch(''); fetchCustomers(); };
    const handleCustomerSearch = (val: string) => {
        setCustomerSearch(val);
        const q = val.trim().toLowerCase();
        setCustomerResults(!q ? customerRaw : customerRaw.filter((c: any) => (c.display_name || '').toLowerCase().includes(q)));
    };
    const selectCustomer = (c: any) => {
        setCustomerId(c.id); setCustomerName(c.display_name || '');
        setEmail(c.email || ''); setAddress(c.billing_address || c.address || '');
        setShowCustomerPicker(false);
    };

    // ── Product picker ──
    const fetchProducts = async () => {
        setProductLoading(true); setProductError('');
        try {
            const params = new URLSearchParams({ action: 'list_products', page: '1', per_page: '100' });
            const res = await fetch(`${BASE_URL}/jurnal_proxy.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (!res.ok || !Array.isArray(r.products)) {
                setProductError(r.message || 'Gagal ambil data produk.'); setProductRaw([]); setProductResults([]);
            } else {
                // /products balikin unit sebagai object {id,name} — ratain jadi unit_name biar konsisten dipakai di UI
                const normalized = r.products.map((p: any) => ({ ...p, unit_name: p.unit?.name || '' }));
                setProductRaw(normalized); setProductResults(normalized);
            }
        } catch { setProductError('Gagal koneksi.'); setProductRaw([]); setProductResults([]); }
        setProductLoading(false);
    };
    const openProductPicker = () => { setShowProductPicker(true); setProductSearch(''); fetchProducts(); };
    const handleProductSearch = (val: string) => {
        setProductSearch(val);
        const q = val.trim().toLowerCase();
        setProductResults(!q ? productRaw : productRaw.filter((p: any) =>
            (p.name || '').toLowerCase().includes(q) || (p.product_code || '').toLowerCase().includes(q)));
    };
    const selectProduct = (p: any) => {
        if (cart.find(i => i.product_id === p.id)) { alert(`${p.name} udah ada di list!`); return; }
        setCart(prev => [...prev, {
            product_id: p.id, product_name: p.name, product_code: p.product_code || '',
            unit_name: p.unit_name || '', quantity: 1, rate: parseFloat(p.sell_price_per_unit) || 0, discount: 0
        }]);
        setShowProductPicker(false);
    };

    const cartTotal = cart.reduce((s, i) => s + (i.quantity * i.rate * (1 - i.discount / 100)), 0);

    const resetForm = () => {
        setCart([]); setCustomerId(null); setCustomerName(''); setEmail(''); setAddress('');
        setDueDate(''); setTermName(''); setDiscountUnit('0'); setMessage(''); setMemo('');
        setQuoteDate(new Date().toISOString().slice(0, 10));
    };

    const handleSubmit = async () => {
        if (!customerName || !quoteDate || cart.length === 0) { alert('Customer, tanggal, dan minimal 1 produk wajib diisi!'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/add_quote.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({
                    customer_id: customerId, customer_name: customerName, email, address,
                    quote_date: quoteDate, due_date: dueDate, term_name: termName,
                    discount_unit: parseFloat(discountUnit) || 0, message, memo,
                    staff_name: user?.name || 'unknown',
                    items: cart.map(i => ({
                        product_id: i.product_id, product_name: i.product_name, product_code: i.product_code,
                        unit_name: i.unit_name, quantity: i.quantity, rate: i.rate, discount: i.discount
                    }))
                })
            });
            const r = await res.json();
            if (r.status === 'success') {
                alert(r.sync_status === 'SYNCED' ? `✅ ${r.message}` : `⚠️ ${r.message}`);
                resetForm();
                setTab('list'); setListStatus('');
            } else alert('Gagal: ' + r.message);
        } catch { alert('Gagal koneksi.'); }
        setSubmitting(false);
    };

    const printQuote = (id: number) => {
        window.open(`https://sedayu.com/api/warehouse/print_quote.html?id=${id}`, '_blank');
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900">
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setTab('baru')}
                        className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${tab === 'baru' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>
                        📝 Quote Baru
                    </button>
                    <button onClick={() => setTab('list')}
                        className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${tab === 'list' ? 'bg-white text-blue-600 shadow' : 'text-slate-500'}`}>
                        📋 Riwayat
                    </button>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">
                {tab === 'baru' && (
                    <>
                        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Customer *</label>
                                <button type="button" onClick={openCustomerPicker}
                                    className="w-full mt-1 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-left font-bold text-slate-700 flex justify-between items-center">
                                    <span className={customerName ? 'text-slate-700' : 'text-slate-400 font-medium'}>
                                        {customerName || 'Pilih customer...'}
                                    </span>
                                    <span className="text-blue-500 text-xs">🔍 Cari</span>
                                </button>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
                                <input type="text" value={email} onChange={e => setEmail(e.target.value)}
                                    className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Alamat</label>
                                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                                    className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tanggal Quote *</label>
                                    <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)}
                                        className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Expiry / Due Date</label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                        className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Term</label>
                                    <input type="text" value={termName} onChange={e => setTermName(e.target.value)} placeholder="Net 30, COD, dst"
                                        className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Diskon Header (%)</label>
                                    <input type="number" value={discountUnit} onChange={e => setDiscountUnit(e.target.value)}
                                        className="w-full mt-1 p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Produk</p>
                                <button type="button" onClick={openProductPicker}
                                    className="px-3 py-2 bg-blue-600 text-white font-black text-[10px] rounded-lg uppercase">＋ Tambah Produk</button>
                            </div>
                            {cart.length === 0 ? (
                                <p className="text-center text-xs text-slate-300 italic py-6">Belum ada produk ditambahkan.</p>
                            ) : cart.map((item, idx) => (
                                <div key={idx} className="bg-slate-50 rounded-xl p-3.5 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-slate-800">{item.product_name}</p>
                                            <p className="text-[10px] text-slate-400">{item.product_code} · {item.unit_name}</p>
                                        </div>
                                        <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-300 font-black text-xs flex-shrink-0">✕</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase">Qty</label>
                                            <input type="number" min="0.01" step="0.01" value={item.quantity}
                                                onChange={e => { const nc = [...cart]; nc[idx].quantity = parseFloat(e.target.value) || 0; setCart(nc); }}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase">Harga</label>
                                            <input type="number" min="0" value={item.rate}
                                                onChange={e => { const nc = [...cart]; nc[idx].rate = parseFloat(e.target.value) || 0; setCart(nc); }}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase">Disc %</label>
                                            <input type="number" min="0" max="100" value={item.discount}
                                                onChange={e => { const nc = [...cart]; nc[idx].discount = parseFloat(e.target.value) || 0; setCart(nc); }}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" />
                                        </div>
                                    </div>
                                    <p className="text-right text-xs font-black text-slate-700">{fmtRp(item.quantity * item.rate * (1 - item.discount / 100))}</p>
                                </div>
                            ))}
                            {cart.length > 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <p className="text-xs font-black text-slate-400 uppercase">Total</p>
                                    <p className="text-lg font-black text-slate-900">{fmtRp(cartTotal * (1 - (parseFloat(discountUnit) || 0) / 100))}</p>
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                                <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Message (opsional)..."
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                                <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo internal (opsional)..."
                                    className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm text-slate-700" />
                                <button onClick={handleSubmit} disabled={submitting}
                                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                    {submitting ? 'Menyimpan & Sync...' : '✓ Simpan & Push ke Jurnal'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {tab === 'list' && (
                    <>
                        <div className="flex gap-2">
                            {(['', 'PENDING', 'SYNCED', 'FAILED'] as const).map(s => (
                                <button key={s} onClick={() => setListStatus(s)}
                                    className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${listStatus === s ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>
                                    {s ? SYNC_LABEL[s] : 'Semua'}
                                </button>
                            ))}
                        </div>
                        {loadingList ? (
                            <p className="text-center py-16 text-slate-400 font-bold text-[10px] uppercase animate-pulse">Memuat...</p>
                        ) : quotes.length === 0 ? (
                            <p className="text-center py-16 text-slate-300 italic text-sm">Belum ada quote.</p>
                        ) : quotes.map((q: any) => (
                            <button key={q.id} onClick={() => openDetail(q)}
                                className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all active:scale-[0.99]">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${SYNC_COLOR[q.sync_status]}`}>{SYNC_LABEL[q.sync_status]}</span>
                                            <span className="text-[10px] font-mono text-slate-400">{q.quote_code}</span>
                                            {q.jurnal_transaction_no && <span className="text-[10px] font-mono text-blue-500">{q.jurnal_transaction_no}</span>}
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 mt-1">{q.customer_name}</p>
                                        <p className="text-[10px] text-slate-400">{q.total_items} item · {q.quote_date} · by {q.staff_name}</p>
                                    </div>
                                    <p className="font-black text-sm text-slate-900 flex-shrink-0">{fmtRp(Number(q.total_value))}</p>
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>

            {/* CUSTOMER PICKER MODAL */}
            {showCustomerPicker && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col" onClick={() => setShowCustomerPicker(false)}>
                    <div className="mt-16 flex-1 bg-white rounded-t-3xl p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-sm text-slate-800">👤 Pilih Customer</h3>
                            <button onClick={() => setShowCustomerPicker(false)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        <input type="text" value={customerSearch} onChange={e => handleCustomerSearch(e.target.value)}
                            placeholder="Cari nama customer..."
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 mb-3" />
                        {customerLoading && <p className="text-center text-xs text-slate-400 animate-pulse py-6">Memuat dari Jurnal...</p>}
                        {customerError && <p className="text-center text-xs text-red-500 py-6">{customerError}</p>}
                        {!customerLoading && !customerError && customerResults.length === 0 && (
                            <p className="text-center text-xs text-slate-300 italic py-6">Tidak ada customer ditemukan.</p>
                        )}
                        <div className="space-y-2">
                            {customerResults.map((c: any) => (
                                <button key={c.id} onClick={() => selectCustomer(c)}
                                    className="w-full text-left bg-slate-50 hover:bg-blue-50 rounded-2xl p-3.5 transition-all active:scale-[0.99]">
                                    <p className="font-bold text-sm text-slate-800">{c.display_name}</p>
                                    {c.address && <p className="text-[10px] text-slate-400 truncate mt-0.5">{c.address}</p>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* PRODUCT PICKER MODAL */}
            {showProductPicker && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col" onClick={() => setShowProductPicker(false)}>
                    <div className="mt-16 flex-1 bg-white rounded-t-3xl p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-sm text-slate-800">📦 Pilih Produk</h3>
                            <button onClick={() => setShowProductPicker(false)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400 w-8 h-8 flex items-center justify-center">✕</button>
                        </div>
                        <input type="text" value={productSearch} onChange={e => handleProductSearch(e.target.value)}
                            placeholder="Cari nama / kode produk..."
                            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 mb-3" />
                        {productLoading && <p className="text-center text-xs text-slate-400 animate-pulse py-6">Memuat dari Jurnal...</p>}
                        {productError && <p className="text-center text-xs text-red-500 py-6">{productError}</p>}
                        {!productLoading && !productError && productResults.length === 0 && (
                            <p className="text-center text-xs text-slate-300 italic py-6">Tidak ada produk ditemukan.</p>
                        )}
                        <div className="space-y-2">
                            {productResults.map((p: any) => (
                                <button key={p.id} onClick={() => selectProduct(p)}
                                    className="w-full text-left bg-slate-50 hover:bg-blue-50 rounded-2xl p-3.5 transition-all active:scale-[0.99] flex justify-between items-center">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-slate-800">{p.name}</p>
                                        <p className="text-[10px] text-slate-400">{p.product_code} · {p.unit_name}</p>
                                    </div>
                                    <p className="font-black text-xs text-slate-700 flex-shrink-0">{fmtRp(parseFloat(p.sell_price_per_unit) || 0)}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {detailQuote && (
                <div className="fixed inset-0 z-50 bg-black/60 flex flex-col" onClick={() => setDetailQuote(null)}>
                    <div className="flex-1 overflow-y-auto mt-16" onClick={e => e.stopPropagation()}>
                        <div className="bg-white min-h-full rounded-t-3xl p-5 pb-28 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${SYNC_COLOR[detailQuote.sync_status]}`}>{SYNC_LABEL[detailQuote.sync_status]}</span>
                                    <h2 className="font-black text-lg text-slate-900 mt-1">{detailQuote.quote_code}</h2>
                                    {detailQuote.jurnal_transaction_no && <p className="text-xs font-mono text-blue-500">{detailQuote.jurnal_transaction_no}</p>}
                                    <p className="text-xs text-slate-500">{detailQuote.customer_name} · {detailQuote.quote_date}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Staff: {detailQuote.staff_name}</p>
                                    {detailQuote.sync_error && <p className="text-[10px] text-red-400 italic mt-1">Error: {detailQuote.sync_error}</p>}
                                </div>
                                <button onClick={() => setDetailQuote(null)} className="bg-slate-100 p-2 rounded-full font-black text-slate-400">✕</button>
                            </div>

                            {loadingDetail ? (
                                <p className="text-center text-slate-400 animate-pulse py-10">Memuat...</p>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Item ({detailItems.length})</p>
                                    {detailItems.map((it: any) => (
                                        <div key={it.id} className="bg-slate-50 rounded-xl p-3.5">
                                            <p className="font-bold text-sm text-slate-800">{it.product_name}</p>
                                            <p className="text-[10px] text-slate-400">{it.product_code} · Qty: {it.quantity} {it.unit_name}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">{fmtRp(it.rate)} × {it.quantity} {it.discount > 0 ? `(-${it.discount}%)` : ''} = <span className="font-bold">{fmtRp(it.quantity * it.rate * (1 - it.discount / 100))}</span></p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {detailQuote.sync_status === 'SYNCED' && (
                                <div className="flex gap-2">
                                    <button onClick={refreshFromJurnal} disabled={refreshing}
                                        className="flex-1 bg-slate-100 text-slate-600 font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest disabled:opacity-50">
                                        {refreshing ? 'Refreshing...' : '🔄 Refresh dari Jurnal'}
                                    </button>
                                    <button onClick={() => printQuote(detailQuote.id)}
                                        className="flex-1 bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest">
                                        🖨️ Print Quote
                                    </button>
                                </div>
                            )}
                            {detailQuote.sync_status === 'FAILED' && (
                                <button onClick={retrySync} disabled={retrying}
                                    className="w-full bg-amber-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest disabled:opacity-50">
                                    {retrying ? 'Mencoba lagi...' : '🔄 Coba Sync Lagi'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Navbar />
        </main>
    );
}

export default function SalesQuotePage() {
    return <SalesQuoteContent />;
}
