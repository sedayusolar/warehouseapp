'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const API_KEY = "SedayuSolar_TopSecret_2026"; // Kunci Rahasia

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');

        try {
            const res = await fetch('https://sedayu.com/api/warehouse/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': API_KEY
                },
                body: JSON.stringify({ username, password }),
            });

            const result = await res.json();
            if (result.status === 'success') {
                localStorage.setItem('user', JSON.stringify(result.user));
                router.push('/');
            } else {
                setError(result.message || 'Login Gagal');
            }
        } catch (err) { setError('Gagal koneksi ke server.'); }
        finally { setLoading(false); }
    };

    return (
        <main className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SEDAYU SOLAR</h1>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Warehouse Login</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-blue-500" />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-blue-500" />
                    {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                    <button disabled={loading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest">
                        {loading ? 'MENGECEK...' : 'MASUK'}
                    </button>
                </form>
            </div>
        </main>
    );
}