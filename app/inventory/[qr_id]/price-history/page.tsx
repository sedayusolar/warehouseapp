'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const formatRp = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

const formatDate = (str: string) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

function PriceHistoryContent() {
    const router = useRouter();
    const params = useParams();
    const qr_id = params?.qr_id as string;

    const [item, setItem] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!qr_id) return;
        fetch(`${BASE_URL}/get_price_history.php?qr_id=${encodeURIComponent(qr_id)}`, {
            headers: { 'X-API-KEY': API_KEY }
        })
            .then(r => r.json())
            .then(r => {
                if (r.status === 'success') {
                    setItem(r.item);
                    setHistory(r.history);
                    setStats(r.stats);
                }
            })
            .finally(() => setLoading(false));
    }, [qr_id]);

    // Build mini chart data
    const chartData = history.filter(h => Number(h.unit_price) > 0);
    const maxPrice = chartData.length ? Math.max(...chartData.map(h => Number(h.unit_price))) : 1;
    const minPrice = chartData.length ? Math.min(...chartData.map(h => Number(h.unit_price))) : 0;
    const priceRange = maxPrice - minPrice || 1;

    const getY = (price: number) => {
        // 0 = top (high price), 100 = bottom (low price)
        return 100 - ((price - minPrice) / priceRange) * 80 - 10;
    };

    // SVG polyline points
    const svgPoints = chartData.map((h, i) => {
        const x = chartData.length === 1 ? 50 : (i / (chartData.length - 1)) * 96 + 2;
        const y = getY(Number(h.unit_price));
        return `${x},${y}`;
    }).join(' ');

    const svgFill = chartData.length > 1
        ? `${svgPoints} ${(96 / (chartData.length - 1)) * (chartData.length - 1) + 2},105 2,105`
        : '';

    if (loading) return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 flex items-center justify-center">
            <p className="text-slate-400 font-bold animate-pulse">Memuat data...</p>
        </main>
    );

    if (!item) return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 flex items-center justify-center">
            <p className="text-slate-400 italic">Item tidak ditemukan.</p>
        </main>
    );

    const latestBatch = [...history].reverse().find(h => Number(h.unit_price) > 0);
    const prevBatch = [...history].reverse().find(h => Number(h.unit_price) > 0 && h.id !== latestBatch?.id);
    const priceTrend = latestBatch && prevBatch
        ? Number(latestBatch.unit_price) - Number(prevBatch.unit_price)
        : 0;

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* ACTION BAR */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-800 text-sm truncate">{item.item_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                    </div>
                    <button onClick={() => router.back()}
                        className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-xs font-black uppercase flex-shrink-0 ml-3 active:scale-95">
                        ← Kembali
                    </button>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto space-y-4">

                {/* STATS CARDS */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-sm col-span-2 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Terkini</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">
                                {latestBatch ? formatRp(Number(latestBatch.unit_price)) : '—'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">per {item.unit}</p>
                        </div>
                        {priceTrend !== 0 && (
                            <div className={`flex flex-col items-center px-4 py-2 rounded-2xl ${priceTrend > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                <span className="text-xl">{priceTrend > 0 ? '📈' : '📉'}</span>
                                <p className={`text-xs font-black mt-1 ${priceTrend > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {priceTrend > 0 ? '+' : ''}{formatRp(priceTrend)}
                                </p>
                                <p className="text-[9px] text-slate-400">vs batch lalu</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-3.5 shadow-sm">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Harga Terendah</p>
                        <p className="font-black text-emerald-700 text-base mt-1">{formatRp(Number(stats?.min_price || 0))}</p>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-3.5 shadow-sm">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">Harga Tertinggi</p>
                        <p className="font-black text-red-700 text-base mt-1">{formatRp(Number(stats?.max_price || 0))}</p>
                    </div>
                    <div className="bg-blue-50 rounded-2xl p-3.5 shadow-sm">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Rata-rata HPP</p>
                        <p className="font-black text-blue-700 text-base mt-1">{formatRp(Number(stats?.avg_price || 0))}</p>
                    </div>
                    <div className="bg-slate-100 rounded-2xl p-3.5 shadow-sm">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Batch</p>
                        <p className="font-black text-slate-700 text-base mt-1">{stats?.total_batches || 0}x masuk</p>
                        <p className="text-[9px] text-slate-400">{stats?.total_qty_in || 0} {item.unit} total</p>
                    </div>
                </div>

                {/* MINI CHART */}
                {chartData.length >= 2 && (
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tren Harga</p>
                        <div className="relative">
                            <svg viewBox="0 0 100 80" className="w-full h-36" preserveAspectRatio="none">
                                {/* Grid lines */}
                                <line x1="0" y1="10" x2="100" y2="10" stroke="#f1f5f9" strokeWidth="0.5" />
                                <line x1="0" y1="35" x2="100" y2="35" stroke="#f1f5f9" strokeWidth="0.5" />
                                <line x1="0" y1="60" x2="100" y2="60" stroke="#f1f5f9" strokeWidth="0.5" />
                                {/* Fill area */}
                                {svgFill && (
                                    <polygon points={svgFill} fill="#dbeafe" opacity="0.5" />
                                )}
                                {/* Line */}
                                <polyline
                                    points={svgPoints}
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                {/* Dots */}
                                {chartData.map((h, i) => {
                                    const x = chartData.length === 1 ? 50 : (i / (chartData.length - 1)) * 96 + 2;
                                    const y = getY(Number(h.unit_price));
                                    return (
                                        <circle key={i} cx={x} cy={y} r="1.5"
                                            fill={i === chartData.length - 1 ? '#2563eb' : 'white'}
                                            stroke="#2563eb" strokeWidth="1" />
                                    );
                                })}
                            </svg>
                            {/* Y axis labels */}
                            <div className="absolute top-0 right-0 flex flex-col justify-between h-full py-1 text-right">
                                <p className="text-[8px] text-slate-400 font-mono">{formatRp(maxPrice)}</p>
                                <p className="text-[8px] text-slate-400 font-mono">{formatRp(minPrice)}</p>
                            </div>
                        </div>
                        {/* X axis — tanggal pertama dan terakhir */}
                        <div className="flex justify-between mt-1">
                            <p className="text-[9px] text-slate-400">{formatDate(chartData[0]?.received_at)}</p>
                            <p className="text-[9px] text-slate-400">{formatDate(chartData[chartData.length - 1]?.received_at)}</p>
                        </div>
                    </div>
                )}

                {chartData.length === 1 && (
                    <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                        <p className="text-slate-400 text-sm italic">Grafik tersedia setelah ada 2+ batch dengan harga.</p>
                    </div>
                )}

                {/* TABEL RIWAYAT */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Riwayat Batch ({history.length})
                        </p>
                    </div>

                    {history.length === 0 ? (
                        <p className="text-center text-slate-300 italic py-8 text-sm">Belum ada data batch.</p>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {[...history].reverse().map((batch, idx) => {
                                const isInitial = !batch.po_id;
                                const isLatest = idx === 0;
                                const prevPrice = idx < history.length - 1
                                    ? Number([...history].reverse()[idx + 1]?.unit_price)
                                    : null;
                                const diff = prevPrice !== null && Number(batch.unit_price) > 0 && prevPrice > 0
                                    ? Number(batch.unit_price) - prevPrice
                                    : null;

                                return (
                                    <div key={batch.id} className={`px-4 py-3.5 ${isLatest ? 'bg-blue-50/50' : ''}`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {isLatest && (
                                                        <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full">TERBARU</span>
                                                    )}
                                                    {isInitial && (
                                                        <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">STOK AWAL</span>
                                                    )}
                                                    {batch.po_code && (
                                                        <span className="text-[8px] font-mono text-slate-400">{batch.po_code}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-slate-700">
                                                    {batch.supplier || (isInitial ? 'Stok awal sistem' : '—')}
                                                </p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-[10px] text-slate-400">{formatDate(batch.received_at)}</p>
                                                    <p className="text-[10px] text-slate-400">📍 {batch.location_name || '—'}</p>
                                                </div>
                                                <div className="flex gap-3 mt-1">
                                                    <p className="text-[10px] text-slate-500">
                                                        Masuk: <span className="font-bold text-slate-700">{batch.qty_in} {item.unit}</span>
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        Sisa: <span className={`font-bold ${Number(batch.qty_remaining) === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                            {batch.qty_remaining} {item.unit}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-black text-slate-900 text-sm">
                                                    {Number(batch.unit_price) > 0 ? formatRp(Number(batch.unit_price)) : <span className="text-slate-300 italic text-xs">Belum diisi</span>}
                                                </p>
                                                <p className="text-[9px] text-slate-400">/{item.unit}</p>
                                                {diff !== null && (
                                                    <p className={`text-[9px] font-black mt-0.5 ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {diff !== 0 ? formatRp(Math.abs(diff)) : 'sama'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {/* Progress bar sisa */}
                                        {batch.qty_in > 0 && (
                                            <div className="mt-2 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${Number(batch.qty_remaining) === 0 ? 'bg-slate-300' : 'bg-emerald-500'}`}
                                                    style={{ width: `${(batch.qty_remaining / batch.qty_in) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <Navbar />
        </main>
    );
}

export default function PriceHistoryPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <PriceHistoryContent />
        </Suspense>
    );
}
