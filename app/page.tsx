'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (!loggedInUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(loggedInUser));
    }
  }, []);

  if (!user) return null;

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

        {user.role !== 'MANAGER' && (
          <button onClick={() => router.push('/stock-adjustment')} className="bg-slate-600 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
            🔄 Stock Adjustment
          </button>
        )}

        {user.role !== 'MANAGER' && (
          <button onClick={() => router.push('/checkin')} className="bg-emerald-700 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
            ✅ Check In Barang
          </button>
        )}

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