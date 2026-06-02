'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

// ── BOTTOM NAV per role (max 5) ──
const BOTTOM_STAFF = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Inventory', icon: '📦', path: '/inventory' },
    { label: 'Checkout', icon: '🛒', path: '/checkout' },
    { label: 'Transaksi', icon: '📋', path: '/transactions' },
    { label: 'Input GR', icon: '🛍️', path: '/purchase' },
];

const BOTTOM_MANAGER = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Inventory', icon: '📦', path: '/inventory' },
    { label: 'Approve', icon: '✅', path: '/transactions' },
    { label: 'Check In', icon: '📥', path: '/checkin-list' },
    { label: 'Status GR', icon: '📄', path: '/purchase-list' },
];

const BOTTOM_PROCUREMENT = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Status GR', icon: '📄', path: '/purchase-list' },
    { label: 'Inventory', icon: '📦', path: '/inventory' },
    { label: 'Transaksi', icon: '📋', path: '/transactions' },
    { label: 'Cost', icon: '💰', path: '/cost-report' },
];

const BOTTOM_ENGINEER = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Transaksi', icon: '📋', path: '/transactions' },
];

// ── DRAWER per role ──
const DRAWER_STAFF = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Checkout', icon: '🛒', path: '/checkout' },
    { label: 'Check In', icon: '✅', path: '/checkin' },
    { label: 'Transaksi', icon: '📋', path: '/transactions' },
    { label: 'Inventory', icon: '📦', path: '/inventory' },
    { label: 'Adjustment', icon: '🔄', path: '/stock-adjustment' },
    { label: 'Input GR', icon: '📥', path: '/purchase' },
    { label: 'Status GR', icon: '📄', path: '/purchase-list' },
    { label: 'Check In List', icon: '📥', path: '/checkin-list' },
    { label: 'Cost Report', icon: '💰', path: '/cost-report' },
];

const DRAWER_ADMIN = [
    ...DRAWER_STAFF,
    { label: 'Users', icon: '👥', path: '/users' },
];

const DRAWER_MANAGER = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Approve Checkout', icon: '⏳', path: '/transactions' },
    { label: 'Approve Check In', icon: '✅', path: '/checkin-list' },
    { label: 'Status GR', icon: '📄', path: '/purchase-list' },
    { label: 'Inventory', icon: '📦', path: '/inventory' },
    { label: 'Cost Report', icon: '💰', path: '/cost-report' },
];

const DRAWER_PROCUREMENT = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Status GR', icon: '📄', path: '/purchase-list' },
    { label: 'Inventory', icon: '📦', path: '/inventory' },
    { label: 'Transaksi', icon: '📋', path: '/transactions' },
    { label: 'Cost Report', icon: '💰', path: '/cost-report' },
];

const DRAWER_ENGINEER = [
    { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { label: 'Transaksi', icon: '📋', path: '/transactions' },
];

const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/inventory': 'Inventory',
    '/checkout': 'Checkout',
    '/transactions': 'Transaksi',
    '/checkin': 'Check In',
    '/purchase': 'Input GR',
    '/purchase-list': 'Status GR',
    '/checkin-list': 'Check In List',
    '/users': 'Users',
    '/cost-report': 'Cost Report',
    '/stock-adjustment': 'Adjustment',
};

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [pendingCheckin, setPendingCheckin] = useState(0);
    const [pendingCheckout, setPendingCheckout] = useState(0);
    const [pendingProcurement, setPendingProcurement] = useState(0);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) { setUser(JSON.parse(u)); fetchBadges(); }
    }, []);

    const fetchBadges = async () => {
        try {
            const res = await fetch(`${BASE_URL}/get_dashboard.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setPendingCheckin(r.pending_checkin_count || 0);
                setPendingCheckout(r.pending_approval?.length || 0);
            }
        } catch { }
        // Badge procurement — PO PENDING untuk procurement, PROCUREMENT_REVIEW untuk manager
        try {
            const res2 = await fetch(`${BASE_URL}/get_purchase_list.php?status=PENDING&count=1`, { headers: { 'X-API-KEY': API_KEY } });
            const r2 = await res2.json();
            if (r2.status === 'success') setPendingProcurement(r2.data?.length || 0);
        } catch { }
    };

    const handleLogout = () => {
        setShowDrawer(false);
        localStorage.removeItem('user');
        router.push('/login');
    };

    if (!user) return null;

    const role = user.role;

    const bottomItems =
        role === 'MANAGER' ? BOTTOM_MANAGER :
            role === 'PROCUREMENT' ? BOTTOM_PROCUREMENT :
                role === 'ENGINEER' ? BOTTOM_ENGINEER :
                    BOTTOM_STAFF;

    const drawerItems =
        role === 'ADMIN' ? DRAWER_ADMIN :
            role === 'MANAGER' ? DRAWER_MANAGER :
                role === 'PROCUREMENT' ? DRAWER_PROCUREMENT :
                    role === 'ENGINEER' ? DRAWER_ENGINEER :
                        DRAWER_STAFF;

    const totalBadge = pendingCheckin + pendingCheckout;

    const title = Object.entries(PAGE_TITLES).find(([k]) =>
        pathname === k || pathname.startsWith(k + '/')
    )?.[1] ?? 'Menu';

    const getBadge = (path: string) => {
        if (path === '/transactions') return pendingCheckout;
        if (path === '/checkin-list') return pendingCheckin;
        if (path === '/purchase-list') {
            if (role === 'PROCUREMENT') return pendingProcurement;
            if (role === 'MANAGER' || role === 'ADMIN') return pendingCheckout; // reuse as proxy
        }
        return 0;
    };

    return (
        <>
            {/* ── TOP NAV ── */}
            <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-100 shadow-sm">
                <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowDrawer(true)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-slate-100 transition-all">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#1e3a5f" />
                                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#1e3a5f" />
                                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#1e3a5f" />
                                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#3b82f6" />
                            </svg>
                        </button>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">SEDAYU SOLAR</p>
                            <p className="text-sm font-black text-slate-800 leading-tight">{title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {totalBadge > 0 && (
                            <button onClick={() => router.push('/transactions')}
                                className="bg-amber-50 border border-amber-200 text-amber-700 font-black text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                                <span>⏳</span><span>{totalBadge}</span>
                            </button>
                        )}
                        {/* Badge khusus procurement */}
                        {role === 'PROCUREMENT' && pendingProcurement > 0 && (
                            <button onClick={() => router.push('/purchase-list')}
                                className="bg-orange-50 border border-orange-200 text-orange-700 font-black text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                                <span>📋</span><span>{pendingProcurement}</span>
                            </button>
                        )}
                        <button onClick={() => setShowDrawer(true)}
                            className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-black text-blue-700 text-sm">
                            {user.name?.charAt(0).toUpperCase()}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── DRAWER ── */}
            {showDrawer && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                    <div className="w-72 bg-white h-full flex flex-col shadow-2xl">
                        <div className="bg-[#1e3a5f] p-5 pt-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-black text-white text-lg">
                                    {user.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-black text-white text-sm">{user.name}</p>
                                    <p className="text-[10px] text-blue-200 font-bold uppercase">{user.role}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto py-3">
                            {drawerItems.map((item) => {
                                const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                                const badge = getBadge(item.path);
                                return (
                                    <button key={item.path}
                                        onClick={() => { setShowDrawer(false); router.push(item.path); }}
                                        className={`w-full flex items-center gap-3 px-5 py-3.5 transition-all active:bg-slate-50
                                            ${isActive ? 'bg-blue-50 border-r-4 border-blue-600' : 'hover:bg-slate-50'}`}>
                                        <span className="text-lg w-6 text-center">{item.icon}</span>
                                        <span className={`text-sm font-bold flex-1 text-left ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {item.label}
                                        </span>
                                        {badge > 0 && (
                                            <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                                                {badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <button onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 font-black rounded-2xl active:scale-95">
                                <span>🚪</span><span className="text-sm">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── BOTTOM NAV ── */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
                <div className="max-w-2xl mx-auto flex">
                    {bottomItems.map((item) => {
                        const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                        const badge = getBadge(item.path);
                        return (
                            <button key={item.path} onClick={() => router.push(item.path)}
                                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 active:scale-95 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                                <div className="relative">
                                    <span className="text-xl">{item.icon}</span>
                                    {badge > 0 && (
                                        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                            {badge}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[9px] font-black ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{item.label}</span>
                                {isActive && <div className="w-1 h-1 rounded-full bg-blue-600" />}
                            </button>
                        );
                    })}
                </div>
                <div style={{ height: 'env(safe-area-inset-bottom)' }} className="bg-white" />
            </div>
        </>
    );
}
