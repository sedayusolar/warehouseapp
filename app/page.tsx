'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function CheckoutCart() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); // Ambil ID jika mode edit

  const [cart, setCart] = useState<any[]>([]);
  const [projectName, setProjectName] = useState('');
  const [picName, setPicName] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- 1. LOGIC LOAD DATA (JIKA MODE EDIT DRAFT) ---
  useEffect(() => {
    if (editId) {
      const loadDraftData = async () => {
        try {
          const res = await fetch(`https://sedayu.com/api/warehouse/get_transaction_detail.php?id=${editId}`);
          const result = await res.json();
          if (result.status === 'success') {
            setProjectName(result.header.project_name);
            setPicName(result.header.pic_name || '');
            setCheckoutDate(result.header.checkout_date);

            // Map barang balik ke format state cart
            const savedItems = result.items.map((item: any) => ({
              qr_id: item.qr_id,
              name: item.item_name,
              type: item.item_type,
              qty: item.qty,
              photo_base64: '' // Foto biasanya tidak ditarik balik (opsional)
            }));
            setCart(savedItems);
          }
        } catch (e) {
          alert("Gagal memuat data draft.");
        }
      };
      loadDraftData();
    }
  }, [editId]);

  // --- 2. LOGIC SCANNER (VERCEL COMPLIANT) ---
  useEffect(() => {
    let scanner: any = null;
    const startScanner = () => {
      if (showScanner) {
        scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
        scanner.render(onScanSuccess, (err: any) => { });
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
      alert("Gagal koneksi ke server.");
    }
  }

  // --- 3. LOGIC SIGNATURE (ACCURATE SCALE) ---
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.clientX || (e.touches && e.touches[0].clientX)) - rect.left) * scaleX;
    const y = ((e.clientY || (e.touches && e.touches[0].clientY)) - rect.top) * scaleY;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.clientX || (e.touches && e.touches[0].clientX)) - rect.left) * scaleX;
    const y = ((e.clientY || (e.touches && e.touches[0].clientY)) - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
    if (e.touches) e.preventDefault();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // --- 4. SUBMIT (SUPPORT INSERT & UPDATE) ---
  const handleSubmit = async (isDraft: boolean = false) => {
    const signatureBase64 = canvasRef.current?.toDataURL('image/png');

    if (!projectName || !checkoutDate || cart.length === 0) {
      alert("Mohon lengkapi Nama Proyek, Tanggal, dan Barang!");
      return;
    }

    if (!isDraft && (!picName || !signatureBase64)) {
      alert("Nama PIC dan Tanda Tangan wajib diisi untuk Submit Resmi!");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://sedayu.com/api/warehouse/checkout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId, // Kirim ID jika sedang mode edit
          project_name: projectName,
          pic_name: picName,
          checkout_date: checkoutDate,
          signature_base64: isDraft ? '' : signatureBase64,
          transaction_status: isDraft ? 'DRAFT' : 'SUBMITTED',
          items: cart
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        alert(isDraft ? "Draft berhasil diperbarui!" : "Berhasil disubmit resmi!");
        router.push('/transactions');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Kesalahan koneksi ke API.');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24 font-sans">
      <div className="bg-slate-900 p-6 text-white shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{editId ? 'Edit Draft' : 'Checkout'}</h1>
          <p className="text-slate-400 text-xs tracking-widest uppercase">Warehouse System</p>
        </div>
        <button onClick={() => router.push('/transactions')} className="p-2 bg-slate-800 rounded-full">✕</button>
      </div>

      <div className="p-4 space-y-6">
        {!showScanner ? (
          <button onClick={() => setShowScanner(true)} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3">
            <span className="text-xl">📷</span> TAMBAH / SCAN BARANG
          </button>
        ) : (
          <div className="space-y-4">
            <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
            <button onClick={() => setShowScanner(false)} className="w-full py-2 text-red-500 font-semibold">Batalkan Scan</button>
          </div>
        )}

        <div className="space-y-4">
          {cart.map((item, index) => (
            <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                <p className="text-[10px] text-slate-400 font-mono">{item.qr_id}</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => {
                    const nc = [...cart]; nc[index].qty = e.target.value; setCart(nc);
                  }}
                  className="w-12 p-1 text-center border rounded-lg font-bold"
                />
                <button onClick={() => setCart(cart.filter((_, i) => i !== index))} className="text-red-500 font-bold">✕</button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border space-y-5">
            <div className="space-y-4">
              <input type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl border outline-none" />
              <input type="text" placeholder="Nama Proyek" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl border outline-none" />
              <input type="text" placeholder="Nama PIC Penerima" value={picName} onChange={(e) => setPicName(e.target.value)} className="w-full p-3.5 bg-slate-50 rounded-xl border outline-none" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tanda Tangan PIC</label>
                <button onClick={clearSignature} className="text-[10px] text-blue-500 font-bold">RESET</button>
              </div>
              <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-72 bg-slate-50 rounded-2xl border-2 touch-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleSubmit(true)} disabled={loading} className="bg-slate-200 py-4 rounded-2xl font-bold text-sm">SIMPAN DRAFT</button>
              <button onClick={() => handleSubmit(false)} disabled={loading} className="bg-emerald-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg">{loading ? 'PROSES...' : 'SUBMIT RESMI'}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}