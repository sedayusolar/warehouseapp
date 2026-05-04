'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true); // ← tambah state loading

  useEffect(() => {
    try {
      const loggedInUser = localStorage.getItem('user');
      if (!loggedInUser) {
        router.push('/login');
      } else {
        setUser(JSON.parse(loggedInUser));
      }
    } catch (e) {
      router.push('/login');
    } finally {
      setChecking(false);
    }
  }, []);

  // Tampilkan loading spinner, bukan null — iOS tidak stuck di blank
  if (checking || !user) return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Memuat...</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center space-y-8 font-sans">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tighter">SEDAYU SOLAR</h1>
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mt-2">Warehouse Management System</p>
      </div>

      <div className="w-full max-w-sm grid gap-4">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Logged in as:</p>
          <p className="font-bold text-lg">{user.name}</p>
          <span className="text-[9px] bg-blue-600 px-2 py-0.5 rounded-full font-black uppercase">{user.role}</span>
        </div>

        {user.role !== 'MANAGER' && (
          <button onClick={() => router.push('/checkout')} className="bg-blue-600 py-6 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">
            📦 Scan & Checkout
          </button>
        )}

        <button onClick={() => router.push('/transactions')} className="bg-white text-slate-900 py-6 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
          📋 Riwayat Transaksi
        </button>

        <button onClick={() => router.push('/inventory')} className="bg-slate-700 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
          🗃️ Inventory List
        </button>

        <button
          onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}
          className="text-red-400 text-xs font-bold uppercase pt-4"
        >
          Logout dari Sistem
        </button>
      </div>
    </main>
  );
}
