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
    const [projectName, setProjectName] = useState('');
    const [picName, setPicName] = useState('');
    const [checkoutDate, setCheckoutDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingDraft, setFetchingDraft] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // --- ROLE CHECK ---
    useEffect(() => {
        const loggedInUser = localStorage.getItem('user');
        if (!loggedInUser) {
            router.push('/login');
            return;
        }
        const parsedUser = JSON.parse(loggedInUser);
        if (parsedUser.role === 'MANAGER') {
            alert("Manager tidak memiliki akses untuk membuat Checkout.");
            router.push('/transactions');
        }
        setUser(parsedUser);
    }, []);

    // LOAD DATA DRAFT
    useEffect(() => {
        if (editId) {
            const loadData = async () => {
                setFetchingDraft(true);
                try {
                    const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${editId}`);
                    const result = await res.json();
                    if (result.status === 'success') {
                        setProjectName(result.header.project_name);
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
                } catch (err: any) { console.error(err); }
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
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_item_by_qr.php?qr=${decodedText}`);
            const result = await res.json();
            if (result.status === 'success') {
                const item = result.data;
                if (Number(item.stock_qty) <= 0) alert(`⚠️ STOK HABIS: ${item.item_name}`);
                if (cart.find((i: any) => i.qr_id === item.qr_id)) {
                    alert("Barang sudah ada di list!");
                } else {
                    setCart([...cart, {
                        qr_id: item.qr_id,
                        name: item.item_name,
                        type: item.qr_id.startsWith('SDU-TOL') ? 'TOOLS' : 'MATERIAL',
                        qty: 1, stock: item.stock_qty, photo_base64: ''
                    }]);
                }
            }
        } catch (err: any) { alert("Gagal koneksi server."); }
    }

    // SIGNATURE LOGIC
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches[0].clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches[0].clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches[0].clientX) - rect.left) * (canvas.width / rect.width);
        const y = ((e.clientY || e.touches[0].clientY) - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y); ctx.stroke(); if (e.touches) e.preventDefault();
    };

    const handleSubmit = async (isDraft: boolean = false) => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');
        if (!projectName || !checkoutDate || cart.length === 0) { alert("Data belum lengkap!"); return; }
        if (!isDraft) {
            for (const item of cart) {
                if (Number(item.qty) > Number(item.stock)) {
                    alert(`❌ STOK TIDAK CUKUP: ${item.name}`);
                    return;
                }
            }
            if (!picName || !signatureBase64) { alert("PIC & Tanda Tangan wajib!"); return; }
        }

        setLoading(true);
        try {
            const response = await fetch('https://sedayu.com/api/warehouse/checkout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editId, project_name: projectName, pic_name: picName,
                    checkout_date: checkoutDate, signature_base64: isDraft ? '' : signatureBase64,
                    transaction_status: isDraft ? 'DRAFT' : 'SUBMITTED', items: cart
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert("Berhasil!");
                router.push('/transactions');
            }
        } catch (err: any) { alert("Gagal koneksi."); }
        setLoading(false);
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-lg">
                <div>
                    <h1 className="text-xl font-bold">{editId ? 'Lanjutkan Draft' : 'Checkout'}</h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">User: {user.name} ({user.role})</p>
                </div>
                <button onClick={() => router.push('/transactions')} className="bg-slate-800 p-2 rounded-full text-xs">✕</button>
            </div>

            <div className="p-4 space-y-6">
                {fetchingDraft ? <div className="text-center py-20 font-bold animate-pulse text-slate-400">LOADING...</div> : (
                    <>
                        {!showScanner ? (
                            <button onClick={() => setShowScanner(true)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg">📷 SCAN BARANG</button>
                        ) : (
                            <div className="space-y-4">
                                <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
                                <button onClick={() => setShowScanner(false)} className="w-full text-red-500 font-bold text-xs uppercase">Batal</button>
                            </div>
                        )}

                        <div className="space-y-8">
                            {/* MATERIAL */}
                            {cart.filter(i => i.type === 'MATERIAL').length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">📦 Material</h3>
                                    {cart.filter(i => i.type === 'MATERIAL').map((item, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-emerald-500 flex justify-between items-center">
                                            <div className="flex-1"><p className="font-bold text-sm text-slate-800">{item.name}</p><p className="text-[10px] text-slate-400">Stok: {item.stock}</p></div>
                                            <div className="flex items-center gap-3">
                                                <input type="number" value={item.qty} onChange={(e: any) => { const nc = [...cart]; const i = nc.findIndex(it => it.qr_id === item.qr_id); nc[i].qty = e.target.value; setCart(nc); }} className="w-12 text-center border-2 rounded-lg font-black text-blue-600" />
                                                <button onClick={() => setCart(cart.filter(i => i.qr_id !== item.qr_id))} className="text-red-300">✕</button>
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
                                            <div className="flex-1"><p className="font-bold text-sm text-slate-800">{item.name}</p><p className="text-[10px] text-slate-400">Stok: {item.stock}</p></div>
                                            <div className="flex items-center gap-3">
                                                <input type="number" value={item.qty} onChange={(e: any) => { const nc = [...cart]; const i = nc.findIndex(it => it.qr_id === item.qr_id); nc[i].qty = e.target.value; setCart(nc); }} className="w-12 text-center border-2 rounded-lg font-black text-blue-600" />
                                                <button onClick={() => setCart(cart.filter(i => i.qr_id !== item.qr_id))} className="text-red-300">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4">
                                <input type="date" value={checkoutDate} onChange={(e: any) => setCheckoutDate(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl" />
                                <input type="text" placeholder="Nama Proyek" value={projectName} onChange={(e: any) => setProjectName(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl" />
                                <input type="text" placeholder="Nama PIC" value={picName} onChange={(e: any) => setPicName(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl" />
                                <div className="space-y-2">
                                    <div className="flex justify-between"><label className="text-[10px] font-black text-slate-400 uppercase">TTD PIC</label><button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)} className="text-[10px] text-blue-500 font-bold">RESET</button></div>
                                    <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-64 bg-slate-50 rounded-2xl border-2 touch-none shadow-inner" />
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-4">
                                    <button onClick={() => handleSubmit(true)} disabled={loading} className="bg-slate-100 text-slate-500 font-black py-4 rounded-2xl text-[10px]">SIMPAN DRAFT</button>
                                    <button onClick={() => handleSubmit(false)} disabled={loading} className="bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg text-[10px] uppercase">SUBMIT RESMI</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
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