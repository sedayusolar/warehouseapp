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

    // --- LOGIC SCANNER (VERCEL COMPLIANT) ---
    useEffect(() => {
        let scanner: any = null;

        const startScanner = () => {
            if (showScanner) {
                scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
                scanner.render(onScanSuccess, (err: any) => {
                    // ignore scan errors
                });
            }
        };

        startScanner();

        return () => {
            if (scanner) {
                scanner.clear().catch((error: any) => console.error("Scanner clear failed", error));
            }
        };
    }, [showScanner]);

    async function onScanSuccess(decodedText: string) {
        setShowScanner(false);
        try {
            // Nembak API get_item_by_qr.php yang baru kita buat
            const res = await fetch(`https://sedayu.com/api/warehouse/get_item_by_qr.php?qr=${decodedText}`);
            const result = await res.json();

            if (result.status === 'success') {
                const item = result.data;
                const existing = cart.find(i => i.qr_id === item.qr_id);

                if (existing) {
                    alert("Barang ini sudah ada di keranjang!");
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
                alert(result.message || "Barang tidak terdaftar!");
            }
        } catch (e) {
            alert("Gagal koneksi ke server untuk cek barang.");
        }
    }

    // --- LOGIC SIGNATURE ---
    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
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
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        if (e.touches) e.preventDefault();
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
            alert("Mohon lengkapi Nama Proyek, PIC, Tanggal, dan Barang!");
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
                alert(`Berhasil Simpan! Kode: ${result.trx_code}`);
                router.push('/');
            } else {
                alert(result.message);
            }
        } catch (error) {
            alert('Terjadi kesalahan koneksi ke API.');
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-slate-50 pb-24 font-sans">
            {/* Header */}
            <div className="bg-slate-900 p-6 text-white shadow-md flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Checkout</h1>
                    <p className="text-slate-400 text-xs tracking-widest uppercase">Warehouse System</p>
                </div>
                <button onClick={() => router.push('/')} className="p-2 bg-slate-800 rounded-full">✕</button>
            </div>

            <div className="p-4 space-y-6">
                {/* Tombol Scanner */}
                {!showScanner ? (
                    <button
                        onClick={() => setShowScanner(true)}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <span className="text-xl">📷</span> MULAI SCAN BARANG
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
                        <button
                            onClick={() => setShowScanner(false)}
                            className="w-full py-2 text-red-500 font-semibold"
                        >
                            Batalkan Scan
                        </button>
                    </div>
                )}

                {/* List Items in Cart */}
                <div className="space-y-4">
                    {cart.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 leading-tight">{item.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                                            {item.qr_id}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.type === 'TOOLS' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {item.type}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 ml-2">
                                    <input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => {
                                            const newCart = [...cart];
                                            newCart[index].qty = e.target.value;
                                            setCart(newCart);
                                        }}
                                        className="w-12 p-1 text-center border rounded-lg bg-slate-50 font-bold text-slate-700 outline-blue-500"
                                    />
                                    <button
                                        onClick={() => setCart(cart.filter((_, i) => i !== index))}
                                        className="bg-red-50 text-red-500 p-2 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Photo Attachment */}
                            <label className="flex items-center justify-center w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 cursor-pointer hover:bg-slate-50 transition-all">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e: any) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                const nc = [...cart];
                                                nc[index].photo_base64 = reader.result;
                                                setCart(nc);
                                            };
                                            reader.readAsDataURL(e.target.files[0]);
                                        }
                                    }}
                                />
                                {item.photo_base64 ? (
                                    <span className="flex items-center gap-2 text-emerald-600 font-bold">
                                        <span>✅</span> Foto Barang Siap
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 text-slate-400 font-medium">
                                        <span>📸</span> Lampirkan Foto Kondisi
                                    </span>
                                )}
                            </label>
                        </div>
                    ))}
                </div>

                {/* Form Induk (Muncul jika ada barang) */}
                {cart.length > 0 && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 space-y-5">
                        <div className="border-b pb-2">
                            <h3 className="font-bold text-lg text-slate-800">Finalisasi Pengeluaran</h3>
                            <p className="text-slate-400 text-xs">Lengkapi data administrasi proyek</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tanggal Keluar Barang</label>
                                <input
                                    type="date"
                                    value={checkoutDate}
                                    onChange={(e) => setCheckoutDate(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama Proyek</label>
                                <input
                                    type="text"
                                    placeholder="Cth: PLTS Atap Jonggol"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nama PIC (Penerima)</label>
                                <input
                                    type="text"
                                    placeholder="Nama Lengkap Teknisi"
                                    value={picName}
                                    onChange={(e) => setPicName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Signature Area */}
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tanda Tangan PIC</label>
                                <button onClick={clearSignature} className="text-[10px] text-blue-500 font-bold hover:underline mb-1">RESET TTD</button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width={500} height={300}
                                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)}
                                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
                                className="w-full h-72 bg-slate-50 rounded-2xl border-2 border-slate-100 touch-none cursor-crosshair shadow-inner"
                            />
                            <p className="text-[9px] text-center text-slate-400 italic">Harap tanda tangan di dalam kotak abu-abu di atas</p>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${loading ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-200'}`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Memproses...
                                </>
                            ) : (
                                'KIRIM REQUEST PENGELUARAN'
                            )}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}