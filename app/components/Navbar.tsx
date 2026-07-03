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
    { label: 'Transfer', icon: '🚚', path: '/transfer' },  // ← BARU
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

// ── DRAWER per role — dikelompokan jadi submenu ──
const DRAWER_STAFF = [
    {
        group: 'Utama', items: [
            { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
        ]
    },
    {
        group: 'Barang Keluar', items: [
            { label: 'Checkout', icon: '🛒', path: '/checkout' },
            { label: 'Delivery Order (DO)', icon: '📄', path: '/delivery-order' },
            { label: 'Transfer Gudang', icon: '🚚', path: '/transfer' },
            { label: 'Riwayat Transfer', icon: '📋', path: '/transfer-list' },
        ]
    },
    {
        group: 'Check In', items: [
            { label: 'Check In', icon: '✅', path: '/checkin' },
            { label: 'Check In Project', icon: '📦', path: '/checkin-project' },
            { label: 'Check In List', icon: '📥', path: '/checkin-list' },
        ]
    },
    {
        group: 'Inventory', items: [
            { label: 'Inventory', icon: '📦', path: '/inventory' },
            { label: 'Adjustment', icon: '🔄', path: '/stock-adjustment' },
        ]
    },
    {
        group: 'Purchase / GR', items: [
            { label: 'Input GR', icon: '📥', path: '/purchase' },
            { label: 'Status GR', icon: '📄', path: '/purchase-list' },
        ]
    },
    {
        group: 'Laporan', items: [
            { label: 'Transaksi', icon: '📋', path: '/transactions' },
            { label: 'Cost Report', icon: '💰', path: '/cost-report' },
        ]
    },
];

const DRAWER_ADMIN = [
    ...DRAWER_STAFF,
    {
        group: 'Administrasi', items: [
            { label: 'Users', icon: '👥', path: '/users' },
        ]
    },
];

const DRAWER_MANAGER = [
    {
        group: 'Utama', items: [
            { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
        ]
    },
    {
        group: 'Approval', items: [
            { label: 'Approve Checkout', icon: '⏳', path: '/transactions' },
            { label: 'Approve Check In', icon: '✅', path: '/checkin-list' },
            { label: 'Approve Transfer', icon: '🚚', path: '/transfer-list' },
            { label: 'Approve DO', icon: '📄', path: '/delivery-order' },
            { label: 'Status GR', icon: '📄', path: '/purchase-list' },
        ]
    },
    {
        group: 'Inventory & Laporan', items: [
            { label: 'Inventory', icon: '📦', path: '/inventory' },
            { label: 'Cost Report', icon: '💰', path: '/cost-report' },
        ]
    },
];

const DRAWER_PROCUREMENT = [
    {
        group: 'Utama', items: [
            { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
        ]
    },
    {
        group: 'GR & Inventory', items: [
            { label: 'Status GR', icon: '📄', path: '/purchase-list' },
            { label: 'Inventory', icon: '📦', path: '/inventory' },
        ]
    },
    {
        group: 'Laporan', items: [
            { label: 'Transaksi', icon: '📋', path: '/transactions' },
            { label: 'Cost Report', icon: '💰', path: '/cost-report' },
        ]
    },
];

const DRAWER_ENGINEER = [
    {
        group: 'Utama', items: [
            { label: 'Dashboard', icon: '🏠', path: '/dashboard' },
            { label: 'Transaksi', icon: '📋', path: '/transactions' },
        ]
    },
];

const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/inventory': 'Inventory',
    '/checkout': 'Checkout',
    '/transactions': 'Transaksi',
    '/checkin': 'Check In',
    '/checkin-project': 'Check In per Project',
    '/transfer': 'Transfer Gudang',
    '/transfer-list': 'Approval Transfer',
    '/purchase': 'Input GR',
    '/purchase-list': 'Status GR',
    '/checkin-list': 'Check In List',
    '/users': 'Users',
    '/cost-report': 'Cost Report',
    '/stock-adjustment': 'Adjustment',
    '/delivery-order': 'Delivery Order',
};

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [pendingCheckin, setPendingCheckin] = useState(0);
    const [pendingCheckout, setPendingCheckout] = useState(0);
    const [pendingTransfer, setPendingTransfer] = useState(0);
    const [pendingProcurement, setPendingProcurement] = useState(0);
    const [pendingDO, setPendingDO] = useState(0);   // ← BARU (DO butuh aksi: approve manager / verifikasi staff)

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) { const parsed = JSON.parse(u); setUser(parsed); fetchBadges(parsed.role); }
    }, []);

    const fetchBadges = async (role: string) => {
        try {
            const res = await fetch(`${BASE_URL}/get_dashboard.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') {
                setPendingCheckin(r.pending_checkin_count || 0);
                setPendingCheckout(r.pending_approval?.length || 0);
            }
        } catch { }

        // Badge procurement
        try {
            const res2 = await fetch(`${BASE_URL}/get_purchase_list.php?status=PENDING&count=1`, { headers: { 'X-API-KEY': API_KEY } });
            const r2 = await res2.json();
            if (r2.status === 'success') setPendingProcurement(r2.data?.length || 0);
        } catch { }

        // Badge transfer pending
        try {
            const res3 = await fetch(`${BASE_URL}/get_transfer_list.php?status=PENDING&count=1`, { headers: { 'X-API-KEY': API_KEY } });
            const r3 = await res3.json();
            if (r3.status === 'success') setPendingTransfer(r3.data?.length || 0);
        } catch { }

        // Badge Delivery Order — beda status yang dihitung tergantung role
        try {
            const statuses = (role === 'MANAGER' || role === 'ADMIN')
                ? ['PENDING_SURAT_JALAN', 'PENDING_KELUAR_GUDANG']       // butuh approval manager
                : ['REJECTED_SURAT_JALAN', 'SURAT_JALAN_TERBIT', 'REJECTED_KELUAR_GUDANG']; // butuh aksi staff (revisi/verifikasi)
            const results = await Promise.all(statuses.map(s =>
                fetch(`${BASE_URL}/get_do_list.php?status=${s}`, { headers: { 'X-API-KEY': API_KEY } }).then(r => r.json())
            ));
            const total = results.reduce((sum, r) => sum + (r.status === 'success' ? (r.data?.length || 0) : 0), 0);
            setPendingDO(total);
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

    const isPathActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
    const activeGroup = drawerItems.find(g => g.items.some(it => isPathActive(it.path)))?.group;

    useEffect(() => {
        if (activeGroup) setOpenGroups(prev => new Set(prev).add(activeGroup));
    }, [pathname]); // eslint-disable-line

    const isGroupOpen = (group: string) => openGroups.has(group);
    const toggleGroup = (group: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group); else next.add(group);
            return next;
        });
    };

    const totalBadge = pendingCheckin + pendingCheckout;

    const title = Object.entries(PAGE_TITLES).find(([k]) =>
        pathname === k || pathname.startsWith(k + '/')
    )?.[1] ?? 'Menu';

    const getBadge = (path: string) => {
        if (path === '/transactions') return pendingCheckout;
        if (path === '/checkin-list') return pendingCheckin;
        if (path === '/transfer-list') return pendingTransfer;
        if (path === '/transfer') return pendingTransfer;
        if (path === '/delivery-order') return pendingDO;   // ← BARU (relevan buat MANAGER/ADMIN maupun STAFF, beda status)
        if (path === '/purchase-list') {
            if (role === 'PROCUREMENT') return pendingProcurement;
            if (role === 'MANAGER' || role === 'ADMIN') return pendingCheckout;
        }
        return 0;
    };

    const groupBadgeTotal = (items: { path: string }[]) => items.reduce((s, it) => s + getBadge(it.path), 0);

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
                        {/* Badge transfer untuk manager */}
                        {(role === 'MANAGER' || role === 'ADMIN') && pendingTransfer > 0 && (
                            <button onClick={() => router.push('/transfer-list')}
                                className="bg-violet-50 border border-violet-200 text-violet-700 font-black text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                                <span>🚚</span><span>{pendingTransfer}</span>
                            </button>
                        )}
                        {/* Badge Delivery Order — MANAGER/ADMIN & STAFF ← BARU */}
                        {pendingDO > 0 && (
                            <button onClick={() => router.push('/delivery-order')}
                                className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                                <span>📄</span><span>{pendingDO}</span>
                            </button>
                        )}
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
                        <div className="flex-1 overflow-y-auto py-2">
                            {drawerItems.map((grp) => {
                                const open = isGroupOpen(grp.group);
                                const grpBadge = groupBadgeTotal(grp.items);
                                const isUngrouped = grp.group === 'Utama';
                                if (isUngrouped) {
                                    return grp.items.map((item) => {
                                        const isActive = isPathActive(item.path);
                                        const badge = getBadge(item.path);
                                        return (
                                            <button key={item.path}
                                                onClick={() => { setShowDrawer(false); router.push(item.path); }}
                                                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-all active:bg-slate-50
                                                    ${isActive ? 'bg-blue-50 border-r-4 border-blue-600' : 'hover:bg-slate-50'}`}>
                                                <span className="text-lg w-6 text-center">{item.icon}</span>
                                                <span className={`text-sm font-bold flex-1 text-left ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{item.label}</span>
                                                {badge > 0 && (
                                                    <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>
                                                )}
                                            </button>
                                        );
                                    });
                                }
                                return (
                                    <div key={grp.group} className="mb-1">
                                        <button onClick={() => toggleGroup(grp.group)}
                                            className="w-full flex items-center gap-2 px-5 py-2.5 mt-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest flex-1 text-left ${open ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {grp.group}
                                            </span>
                                            {grpBadge > 0 && !open && (
                                                <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">{grpBadge}</span>
                                            )}
                                            <span className={`text-slate-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                                        </button>
                                        {open && grp.items.map((item) => {
                                            const isActive = isPathActive(item.path);
                                            const badge = getBadge(item.path);
                                            return (
                                                <button key={item.path}
                                                    onClick={() => { setShowDrawer(false); router.push(item.path); }}
                                                    className={`w-full flex items-center gap-3 pl-8 pr-5 py-3 transition-all active:bg-slate-50
                                                        ${isActive ? 'bg-blue-50 border-r-4 border-blue-600' : 'hover:bg-slate-50'}`}>
                                                    <span className="text-base w-6 text-center">{item.icon}</span>
                                                    <span className={`text-sm font-bold flex-1 text-left ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{item.label}</span>
                                                    {badge > 0 && (
                                                        <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
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
