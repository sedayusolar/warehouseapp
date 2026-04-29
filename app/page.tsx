'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [cart, setCart] = useState<any[]>([]);
  const [projectName, setProjectName] = useState('');
  const [picName, setPicName] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingDraft, setFetchingDraft] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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
              stock: item.current_stock || 999, // Ambil stok saat ini dari API detail
              photo_base64: ''
            })));
          }
        } catch (err: any) { console.error(err); }
        setFetchingDraft(false);
      };
      loadData();
    }
  }, [editId]);

  useEffect(() => {
    let scanner: any = null;
    if (showScanner) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(onScanSuccess, (err: any) => { console.log(err); });
    }
    return () => { if (scanner) scanner.clear().catch((error: any) => console.error(error)); };
  }, [showScanner]);

  async function onScanSuccess(decodedText: string) {
    setShowScanner(false);
    try {
      const res = await fetch(`https://sedayu.com/api/warehouse/get_item_by_qr.php?qr=${decodedText}`);
      const result = await res.json();
      if (result.status === 'success') {
        const item = result.data;
        if (cart.find((i: any) => i.qr_id === item.qr_id)) {
          alert("Barang sudah ada di list!");
        } else {
          setCart([...cart, {
            qr_id: item.qr_id,
            name: item.item_name,
            type: item.qr_id.startsWith('SDU-TOL') ? 'TOOLS' : 'MATERIAL',
            qty: 1,
            stock: item.stock_qty, // Simpan info stok asli
            photo_base64: ''
          }]);
        }
      }
    } catch (err: any) { alert("Gagal koneksi server."); }
  }

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineTo(x, y); ctx.stroke(); if (e.touches) e.preventDefault();
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    const signatureBase64 = canvasRef.current?.toDataURL('image/png');
    if (!projectName || !checkoutDate || cart.length === 0) { alert("Data tidak lengkap!"); return; }

    // --- VALIDASI SOFT (Frontend) ---
    if (!isDraft) {
      for (const item of cart) {
        if (Number(item.qty) > Number(item.stock)) {
          alert(`Stok tidak cukup untuk ${item.name}! (Max: ${item.stock})`);
          return;
        }
      }
      if (!picName || !signatureBase64) { alert("Nama PIC & TTD wajib untuk Submit!"); return; }
    }

    setLoading(true);
    try {
      const response = await fetch('https://sedayu.com/api/warehouse/checkout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, project_name: projectName, pic_name: picName, checkout_date: checkoutDate, signature_base64: isDraft ? '' : signatureBase64, transaction_status: isDraft ? 'DRAFT' : 'SUBMITTED', items: cart })
      });
      const result = await response.json();
      if (result.status === 'success') {
        alert(isDraft ? "Draft tersimpan!" : "Submit berhasil!");
        router.push('/transactions');
      } else { alert("Error: " + result.message); }
    } catch (err: any) { alert("Gagal koneksi."); }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">{editId ? 'Edit Draft' : 'Checkout'}</h1>
        <button onClick={() => router.push('/transactions')} className="p-2 bg-slate-800 rounded-full text-xs">✕</button>
      </div>
      <div className="p-4 space-y-6">
        {fetchingDraft ? <div className="text-center py-20 font-bold animate-pulse text-slate-400">LOADING DRAFT...</div> : (
          <>
            {!showScanner ? (
              <button onClick={() => setShowScanner(true)} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all">📷 SCAN BARANG</button>
            ) : (
              <div className="space-y-4">
                <div id="reader" className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black"></div>
                <button onClick={() => setShowScanner(false)} className="w-full text-red-500 font-bold">Batal</button>
              </div>
            )}

            <div className="space-y-3">
              {cart.map((item: any, index: number) => (
                <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-400">Stok: {item.stock} | {item.qr_id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="number" value={item.qty} onChange={(e: any) => { const nc = [...cart]; nc[index].qty = e.target.value; setCart(nc); }} className={`w-12 text-center border rounded font-bold ${Number(item.qty) > Number(item.stock) ? 'text-red-500 border-red-500' : 'text-slate-700'}`} />
                    <button onClick={() => setCart(cart.filter((_: any, i: number) => i !== index))} className="text-red-500 font-bold">✕</button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="bg-white p-6 rounded-3xl shadow-xl border space-y-4">
                <input type="date" value={checkoutDate} onChange={(e: any) => setCheckoutDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border outline-none text-slate-700" />
                <input type="text" placeholder="Nama Proyek" value={projectName} onChange={(e: any) => setProjectName(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border outline-none text-slate-700" />
                <input type="text" placeholder="Nama PIC" value={picName} onChange={(e: any) => setPicName(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border outline-none text-slate-700" />
                <div className="space-y-2">
                  <div className="flex justify-between"><label className="text-[10px] font-bold text-slate-400">TTD PIC</label><button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 300)} className="text-[10px] text-blue-500 font-bold">RESET</button></div>
                  <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="w-full h-72 bg-slate-50 rounded-2xl border-2 touch-none shadow-inner" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={() => handleSubmit(true)} disabled={loading} className="bg-slate-200 py-4 rounded-2xl font-bold text-sm text-slate-600 active:scale-95 transition-all">DRAFT</button>
                  <button onClick={() => handleSubmit(false)} disabled={loading} className="bg-emerald-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all">{loading ? '...' : 'SUBMIT'}</button>
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
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-400">LOADING SYSTEM...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}