'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('https://sedayu.com/api/warehouse/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await res.json();

            if (result.status === 'success') {
                // --- INI BARIS YANG TADI LO TULIS, TAPI DI DALAM LOGIC SUCCESS ---
                localStorage.setItem('user', JSON.stringify(result.user));

                alert(`Selamat datang, ${result.user.name}!`);
                router.push('/transactions');
            } else {
                setError(result.message || 'Login Gagal');
            }
        } catch (err) {
            setError('Terjadi kesalahan koneksi ke server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-8">

                {/* Logo & Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SEDAYU SOLAR</h1>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Warehouse Management</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-blue-500 text-slate-700 font-medium transition-all"
                            placeholder="Masukkan username"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-blue-500 text-slate-700 font-medium transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg animate-shake">
                            ⚠️ {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-sm"
                    >
                        {loading ? 'MENGECEK...' : 'MASUK KE SISTEM'}
                    </button>
                </form>

                <p className="text-center text-slate-300 text-[9px] uppercase tracking-widest font-bold">
                    © 2026 PT Selaras Daya Utama
                </p>
            </div>
        </main>
    );
}