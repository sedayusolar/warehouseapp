'use client'; // Kita ubah ke client component dulu biar interaktif
import { useState, useEffect } from 'react';
import Scanner from './components/Scanner';

export default function DashboardGudang() {
  const [items, setItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState("");

  // Ambil data (pakai useEffect karena sekarang kita di client side)
  useEffect(() => {
    fetch('https://sedayu.com/api/warehouse/get_items.php')
      .then(res => res.json())
      .then(data => setItems(data.data || []));
  }, []);

  const handleScanResult = (code: string) => {
    setScannedCode(code);
    setShowScanner(false);
    alert("Berhasil Scan: " + code);
    // Nanti di sini kita tambah logic cari barang otomatis
  };


  return (
    <main className="min-h-screen bg-slate-50 p-6">
      {showScanner && <Scanner onResult={handleScanResult} />}

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">Sedayu Warehouse</h1>
            <p className="text-slate-500">EPC Inventory Management</p>
          </div>
          <button
            onClick={() => {
              alert("Tombol diklik! Mencoba buka kamera..."); // Debug 1
              setShowScanner(true);
            }}
            className="relative z-[9999] bg-blue-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg"
          >
            📸 Scan Barang
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-xs uppercase font-bold tracking-widest">
                  <th className="px-8 py-5">Item Name</th>
                  <th className="px-8 py-5">Category</th>
                  <th className="px-8 py-5">Stock</th>
                  <th className="px-8 py-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-all">
                    <td className="px-8 py-6 font-semibold text-slate-800">{item.item_name}</td>
                    <td className="px-8 py-6 text-slate-500">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-lg font-bold text-slate-900">{item.stock_qty}</span>
                      <span className="ml-2 text-slate-400 text-xs font-medium uppercase">{item.unit}</span>
                    </td>
                    <td className="px-8 py-6 text-right font-bold text-emerald-500">
                      AVAILABLE
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}