'use client';
import { useState, useEffect, Suspense } from 'react';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const ALLOWED_ROLES = ['ADMIN', 'MANAGER'];

const formatRp = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

function CostReportContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeTab, setActiveTab] = useState<'summary' | 'detail'>('summary');

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (!ALLOWED_ROLES.includes(parsed.role)) {
            alert("Akses ditolak! Halaman ini hanya untuk Admin dan Manager.");
            router.push('/dashboard');
            return;
        }
        setUser(parsed);
        fetchProjects();
        fetchReport();
    }, []);

    const fetchProjects = async () => {
        const res = await fetch(`${BASE_URL}/get_projects.php`, { headers: { 'X-API-KEY': API_KEY } });
        const r = await res.json();
        if (r.status === 'success') setProjects(r.data);
    };

    const fetchReport = async (projId = '', from = '', to = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (projId) params.append('project_name', projId);
            if (from) params.append('date_from', from);
            if (to) params.append('date_to', to);
            const res = await fetch(`${BASE_URL}/get_cost_report.php?${params}`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setData(r);
        } catch { }
        setLoading(false);
    };

    const handleFilter = () => {
        fetchReport(selectedProject, dateFrom, dateTo);
        if (selectedProject) setActiveTab('detail');
        else setActiveTab('summary');
    };

    const handleReset = () => {
        setSelectedProject(''); setDateFrom(''); setDateTo('');
        setActiveTab('summary');
        fetchReport();
    };

    if (!user) return null;

    const gt = data?.grand_total || {};
    const summary = data?.project_summary || [];
    const detail = data?.item_detail || [];

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* FILTER BAR */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto space-y-2">
                    <div className="flex gap-2">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="flex-1 p-2 bg-slate-100 rounded-xl outline-none text-xs font-bold text-slate-600" />
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="flex-1 p-2 bg-slate-100 rounded-xl outline-none text-xs font-bold text-slate-600" />
                    </div>
                    <div className="flex gap-2">
                        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                            className="flex-1 p-2 bg-slate-100 text-slate-600 rounded-xl outline-none text-xs font-bold appearance-none">
                            <option value="">Semua Project</option>
                            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                        </select>
                        <button onClick={() => fetchReport(selectedProject, dateFrom, dateTo)}
                            disabled={loading}
                            className="bg-blue-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase disabled:opacity-50 flex-shrink-0">
                            {loading ? '...' : '🔍'}
                        </button>
                    </div>
                </div>
            </div>


            <div className="p-4 max-w-2xl mx-auto space-y-4">

                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-bold">Memuat report...</div>
                ) : data && (
                    <>
                        {/* GRAND TOTAL CARDS */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900 text-white rounded-2xl p-4 col-span-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cost (APPROVED)</p>
                                <p className="text-3xl font-black mt-1">{formatRp(Number(gt.grand_total) || 0)}</p>
                                {/* Material — primary cost */}
                                <div className="mt-3 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">📦 Material (Konsumsi)</p>
                                        <p className="text-base font-black text-emerald-400">{formatRp(Number(gt.total_material) || 0)}</p>
                                    </div>
                                    <div className="flex justify-between items-center opacity-60">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">🛠️ Tools (Referensi)</p>
                                        <p className="text-sm font-bold text-slate-400">{formatRp(Number(gt.total_tools) || 0)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-2 pt-2 border-t border-slate-700">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase">Transaksi</p>
                                        <p className="text-sm font-black text-white">{gt.total_transaksi || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase">Project</p>
                                        <p className="text-sm font-black text-white">{gt.total_project || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TAB */}
                        {selectedProject && (
                            <div className="flex gap-2 bg-slate-200 p-1 rounded-xl">
                                {(['summary', 'detail'] as const).map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all
                                            ${activeTab === tab ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                                        {tab === 'summary' ? '📊 Summary' : '📋 Detail Item'}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* SUMMARY PER PROJECT */}
                        {(activeTab === 'summary' || !selectedProject) && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Cost per Project ({summary.length})
                                </p>
                                {summary.length === 0 ? (
                                    <p className="text-center text-slate-300 italic py-8">Belum ada data cost.</p>
                                ) : summary.map((proj: any) => {
                                    const pct = gt.grand_total > 0
                                        ? (Number(proj.total_cost) / Number(gt.grand_total)) * 100 : 0;
                                    return (
                                        <button key={proj.project_id || proj.project_name}
                                            onClick={() => {
                                                setSelectedProject(proj.project_name);
                                                setActiveTab('detail');
                                                fetchReport(proj.project_name, dateFrom, dateTo);
                                            }}
                                            className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all active:scale-[0.99]">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm">{proj.project_name}</p>
                                                    <p className="text-[10px] text-slate-400">{proj.total_transaksi} transaksi · {proj.first_checkout} s/d {proj.last_checkout}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="font-black text-slate-900">{formatRp(Number(proj.total_cost))}</p>
                                                    <p className="text-[9px] text-slate-400">{proj.total_transaksi} transaksi</p>
                                                </div>
                                            </div>
                                            {/* Cost bar */}
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="flex gap-3 mt-1.5">
                                                <span className="text-[9px] text-emerald-600">Material: {formatRp(Number(proj.cost_material))}</span>
                                                <span className="text-[9px] text-amber-600">Tools: {formatRp(Number(proj.cost_tools))}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* DETAIL ITEM per project */}
                        {activeTab === 'detail' && selectedProject && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Detail Item ({detail.length})
                                </p>
                                {detail.length === 0 ? (
                                    <p className="text-center text-slate-300 italic py-8">Tidak ada data item.</p>
                                ) : detail.map((item: any) => (
                                    <div key={item.qr_id} className="bg-white rounded-2xl p-4 shadow-sm">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${item.category === 'Tools' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-sm text-slate-800 mt-1">{item.item_name}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{item.qr_id}</p>
                                                <div className="flex gap-3 mt-1">
                                                    <span className="text-[10px] text-slate-500">Qty: <span className="font-bold">{item.total_qty} {item.unit}</span></span>
                                                    <span className="text-[10px] text-slate-500">HPP: <span className="font-bold">{formatRp(Number(item.unit_price))}</span>/{item.unit}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-black text-slate-900">{formatRp(Number(item.total_cost))}</p>
                                                <p className="text-[9px] text-slate-400">{item.total_transaksi}x transaksi</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Subtotal project */}
                                {detail.length > 0 && (
                                    <div className="bg-slate-900 text-white rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Subtotal Project</p>
                                        <p className="text-2xl font-black mt-1">
                                            {formatRp(detail.reduce((s: number, i: any) => s + Number(i.total_cost), 0))}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <Navbar />
        </main>
    );
}

export default function CostReportPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <CostReportContent />
        </Suspense>
    );
}
