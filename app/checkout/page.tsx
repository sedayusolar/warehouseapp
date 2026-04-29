'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function CheckoutCart() {
    const router = useRouter();
    const [cart, setCart] = useState<any[]>([]);
    const [projectName, setProjectName] = useState('');
    const [picName, setPicName] = useState('');
    const [checkoutDate, setCheckoutDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    // Refs untuk Signature Pad
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // --- LOGIC SCANNER ---
    useEffect(() => {
        if (showScanner) {
            const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render(onScanSuccess, (err) => { });
            return () => scanner.clear();
        }
    }, [showScanner]);

    async function onScanSuccess(decodedText: string) {
        setShowScanner(false);
        try {
            const res = await fetch(`https://sedayu.com/api/warehouse/get_item_by_qr.php?qr=${decodedText}`);
            const result = await res.json();
            if (result.status === 'success') {
                const item = result.data;
                // Cek jika barang sudah ada di keranjang
                const existing = cart.find(i => i.qr_id === item.qr_id);
                if (existing) {
                    alert("Barang sudah ada di keranjang!");
                } else {
                    setCart([...cart, {
                        qr_id: item.qr_id,
                        name: item.item_name,
                        type: item.qr_id.startsWith('SDU-TOL') ? 'TOOLS' : 'MATERIAL',
                        qty: 1,
                        photo_base64: ''
                    }]);
                }
            } else {
                alert("Barang tidak terdaftar!");
            }
        } catch (e) {
            alert("Gagal mengambil data barang.");
        }
    }

    // --- LOGIC SIGNATURE ---
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        e.preventDefault();
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // --- SUBMIT ---
    const handleSubmit = async () => {
        const signatureBase64 = canvasRef.current?.toDataURL('image/png');

        if (!projectName || !picName || !checkoutDate || cart.length === 0) {
            alert("Lengkapi semua data!");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('https://sedayu.com/api/warehouse/checkout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_name: projectName,
                    pic_name: picName,
                    checkout_date: checkoutDate,
                    signature_base64: signatureBase64,
                    items: cart
                })
            });

            const result = await response.json();
            if (result.status === 'success') {
                alert(`Berhasil! Kode: ${result.trx_code}`);
                router.push('/');
            } else {
                alert(result.message);
            }
        } catch (error) {
            alert('Error koneksi.');
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-slate-50 pb-24">
            <div className="bg-slate-900 p-6 text-white shadow-md flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Checkout</h1>
                    <p className="text-slate-400 text-xs">Sedayu Smart System</p>
                </div>
                <button onClick={() => router.push('/')} className="text-slate-400">✕</button>
            </div>

            <div className="p-4 space-y-6">
                {/* Tombol Scan Asli */}
                {!showScanner ? (
                    <button onClick={() => setShowScanner(true)} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                        📷 SCAN QR CODE
                    </button>
                ) : (
                    <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600"></div>
                )}

                {/* List Keranjang */}
                <div className="space-y-4">
                    {cart.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800">{item.name}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.type === 'TOOLS' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {item.qr_id}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={item.qty} onChange={(e) => {
                                        const newCart = [...cart]; newCart[index].qty = e.target.value; setCart(newCart);
                                    }} className="w-12 p-1 text-center border rounded bg-slate-50 font-bold" />
                                    <button onClick={() => setCart(cart.filter((_, i) => i !== index))} className="text-red-400 p-1">✕</button>
                                </div>
                            </div>
                            <label className="flex items-center justify-center w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 cursor-pointer">
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e: any) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => { const nc = [...cart]; nc[index].photo_base64 = reader.result; setCart(nc); };
                                    reader.readAsDataURL(e.target.files[0]);
                                }} />
                                {item.photo_base64 ? '✅ Foto OK' : '📸 Foto Kondisi'}
                            </label>
                        </div>
                    ))}
                </div>

                {/* Form Informasi */}
                {cart.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <h3 className="font-bold text-slate-800 border-b pb-2">Informasi & TTD</h3>
                        <input type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border outline-none" />
                        <input type="text" placeholder="Nama Proyek" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border outline-none" />
                        <input type="text" placeholder="Nama PIC" value={picName} onChange={(e) => setPicName(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border outline-none" />

                        {/* Signature Area */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400">TANDA TANGAN PIC</label>
                            <canvas
                                ref={canvasRef}
                                width={300} height={150}
                                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                className="w-full h-40 bg-slate-50 rounded-xl border-2 border-slate-200 touch-none"
                            />
                            <button onClick={clearSignature} className="text-xs text-blue-500 font-bold">Hapus TTD</button>
                        </div>

                        <button onClick={handleSubmit} disabled={loading} className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg ${loading ? 'bg-slate-400' : 'bg-emerald-600'}`}>
                            {loading ? 'Mengirim...' : 'Kirim Request'}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}