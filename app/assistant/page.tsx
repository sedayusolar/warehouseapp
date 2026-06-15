'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'answer' | 'query_result' | 'propose_change' | 'error';
    data?: any[];
    sql?: string;
    title?: string;
    count?: number;
    change_description?: string;
    sql_preview?: string;
    loading?: boolean;
};

const SUGGESTIONS = [
    "Berapa total stok semua item di inventory?",
    "Item apa yang stoknya paling rendah?",
    "Tampilkan semua GR yang belum diapprove",
    "Total nilai inventory per lokasi gudang",
    "Siapa yang paling banyak checkout material?",
    "Item apa saja yang sudah keluar ke project Diamond?",
    "Berapa total biaya material per proyek?",
    "Stok kabel NYY di semua gudang berapa?",
];

function AssistantContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSql, setShowSql] = useState<Record<string, boolean>>({});
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role !== 'ADMIN') { router.push('/'); return; }
        setUser(parsed);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getHistory = () => messages
        .filter(m => !m.loading && m.type !== 'error')
        .map(m => ({
            role: m.role,
            content: m.role === 'assistant'
                ? (m.type === 'query_result'
                    ? `${m.message}\n\nHasil: ${m.count} baris data. Kolom: ${m.data?.[0] ? Object.keys(m.data[0]).join(', ') : '-'}`
                    : m.content || m.message || '')
                : m.content
        }));

    const sendMessage = async (text?: string) => {
        const question = (text || input).trim();
        if (!question || loading) return;
        setInput('');

        const userMsg: Message = {
            id: `u_${Date.now()}`,
            role: 'user',
            content: question,
            type: 'answer',
        };
        const loadingMsg: Message = {
            id: `l_${Date.now()}`,
            role: 'assistant',
            content: '',
            loading: true,
        };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setLoading(true);

        try {
            const res = await fetch(`${BASE_URL}/ai_query.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ question, history: getHistory() }),
            });
            const r = await res.json();

            const assistantMsg: Message = {
                id: `a_${Date.now()}`,
                role: 'assistant',
                content: r.message || '',
                type: r.status === 'error' ? 'error' : (r.type || 'answer'),
                data: r.data,
                sql: r.sql,
                title: r.title,
                count: r.count,
                message: r.message,
                change_description: r.change_description,
                sql_preview: r.sql_preview,
            };

            setMessages(prev => prev.filter(m => !m.loading).concat(assistantMsg));
        } catch {
            setMessages(prev => prev.filter(m => !m.loading).concat({
                id: `e_${Date.now()}`,
                role: 'assistant',
                content: 'Koneksi gagal. Coba lagi.',
                type: 'error',
            }));
        }
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const formatValue = (val: any): string => {
        if (val === null || val === undefined) return '—';
        if (typeof val === 'number') {
            if (val > 100000) return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
            return val.toLocaleString('id-ID');
        }
        return String(val);
    };

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-900 pt-16 pb-24 font-sans flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push('/')} className="text-slate-400 font-black text-xs bg-slate-700 px-3 py-1.5 rounded-xl active:scale-95">← Back</button>
                <div className="flex-1">
                    <p className="font-black text-white text-sm">🤖 WMS Assistant</p>
                    <p className="text-[10px] text-slate-400">AI dapat membaca database — tidak bisa mengubah data langsung</p>
                </div>
                <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-1 rounded-lg">ADMIN ONLY</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">

                {/* Welcome */}
                {messages.length === 0 && (
                    <div className="space-y-4">
                        <div className="text-center py-8 space-y-2">
                            <p className="text-4xl">🤖</p>
                            <p className="font-black text-white text-lg">WMS AI Assistant</p>
                            <p className="text-slate-400 text-sm">Tanya apapun tentang inventory, stok, transaksi, atau proyek</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} onClick={() => sendMessage(s)}
                                    className="text-left bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium px-4 py-3 rounded-2xl hover:bg-slate-700 hover:border-slate-500 active:scale-[0.98] transition-all">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message list */}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                                <p className="text-sm font-medium">{msg.content}</p>
                            </div>
                        ) : (
                            <div className="flex-1 max-w-full space-y-2">
                                {msg.loading ? (
                                    <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 w-fit">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="text-slate-400 text-xs">AI sedang menganalisis...</span>
                                        </div>
                                    </div>
                                ) : msg.type === 'error' ? (
                                    <div className="bg-red-900/50 border border-red-700 rounded-2xl rounded-tl-sm px-4 py-3">
                                        <p className="text-red-300 text-sm">⚠️ {msg.content || msg.message}</p>
                                    </div>
                                ) : msg.type === 'propose_change' ? (
                                    <div className="bg-amber-900/30 border border-amber-700 rounded-2xl rounded-tl-sm p-4 space-y-3">
                                        <p className="text-amber-300 font-black text-xs uppercase">⚠️ Perubahan Data Diperlukan</p>
                                        <p className="text-slate-300 text-sm">{msg.message}</p>
                                        {msg.change_description && (
                                            <div className="bg-slate-800 rounded-xl p-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Yang perlu dilakukan:</p>
                                                <p className="text-slate-300 text-xs">{msg.change_description}</p>
                                            </div>
                                        )}
                                        {msg.sql_preview && (
                                            <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
                                                {msg.sql_preview}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-amber-500">Jalankan SQL di atas melalui phpMyAdmin setelah dikonfirmasi.</p>
                                    </div>
                                ) : msg.type === 'query_result' ? (
                                    <div className="space-y-2">
                                        {msg.message && (
                                            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                                                <p className="text-slate-300 text-sm">{msg.message}</p>
                                            </div>
                                        )}
                                        {msg.data && msg.data.length > 0 && (
                                            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                                                <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                                                    <p className="font-black text-white text-xs">{msg.title || 'Hasil'} <span className="text-slate-400 font-normal">({msg.count} baris)</span></p>
                                                    <button onClick={() => setShowSql(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                                        className="text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest">
                                                        {showSql[msg.id] ? '▲ SQL' : '▼ SQL'}
                                                    </button>
                                                </div>
                                                {showSql[msg.id] && msg.sql && (
                                                    <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 font-mono text-xs text-emerald-400 overflow-x-auto">
                                                        {msg.sql}
                                                    </div>
                                                )}
                                                <div className="overflow-x-auto max-h-80">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-700/50 sticky top-0">
                                                            <tr>
                                                                {Object.keys(msg.data[0]).map(col => (
                                                                    <th key={col} className="text-left px-3 py-2 text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-700/50">
                                                            {msg.data.map((row, i) => (
                                                                <tr key={i} className="hover:bg-slate-700/30">
                                                                    {Object.values(row).map((val, j) => (
                                                                        <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatValue(val)}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                        {msg.data && msg.data.length === 0 && (
                                            <div className="bg-slate-800 rounded-2xl px-4 py-3">
                                                <p className="text-slate-400 text-sm italic">Tidak ada data ditemukan.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{msg.content || msg.message}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-slate-800 border-t border-slate-700 p-4 max-w-3xl mx-auto w-full">
                {messages.length > 0 && (
                    <button onClick={() => setMessages([])}
                        className="text-[10px] font-black text-slate-500 uppercase mb-2 hover:text-slate-300">
                        ✕ Clear conversation
                    </button>
                )}
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Tanya tentang inventory, stok, transaksi... (Enter untuk kirim)"
                        rows={2}
                        className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-2xl px-4 py-3 text-sm outline-none resize-none placeholder:text-slate-500 focus:border-blue-500 transition-all"
                    />
                    <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                        className="bg-blue-600 text-white font-black w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 disabled:opacity-40 flex-shrink-0 transition-all shadow-lg shadow-blue-900/50">
                        {loading ? <span className="animate-spin text-lg">⏳</span> : <span className="text-lg">↑</span>}
                    </button>
                </div>
                <p className="text-[9px] text-slate-600 mt-1.5 text-center">AI hanya bisa membaca data · Perubahan data memerlukan konfirmasi Admin</p>
            </div>
        </main>
    );
}

export default function AssistantPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <AssistantContent />
        </Suspense>
    );
}
