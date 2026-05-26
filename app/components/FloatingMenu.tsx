'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

export default function FloatingMenu() {
    const router = useRouter();
    const pathname = usePathname();
    const [showMenu, setShowMenu] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [pendingCheckin, setPendingCheckin] = useState(0);
    const [pendingCheckout, setPendingCheckout] = useState(0);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) {
            setUser(JSON.parse(u));
            fetchBadges();
        }
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
    };

    const handleLogout = () => {
        setShowMenu(false);
        localStorage.removeItem('user');
        router.push('/login');
    };

    if (!user) return null;

    const MENU_STAFF = [
        { label: 'Dashboard', icon: '🏠', path: '/dashboard', color: 'bg-slate-700' },
        { label: 'Checkout', icon: '📦', path: '/checkout', color: 'bg-blue-600' },
        { label: 'Check In', icon: '✅', path: '/checkin', color: 'bg-emerald-500' },
        { label: 'Transaksi', icon: '📋', path: '/transactions', color: 'bg-blue-700' },
        { label: 'Inventory', icon: '🗃️', path: '/inventory', color: 'bg-slate-600' },
        { label: 'Adjustment', icon: '🔄', path: '/stock-adjustment', color: 'bg-slate-500' },
        { label: 'Check In List', icon: '📥', path: '/checkin-list', color: 'bg-emerald-700', badge: pendingCheckin },
        { label: 'Cost Report', icon: '💰', path: '/cost-report', color: 'bg-violet-600' },
        ...(user.role === 'ADMIN' ? [
            { label: 'Users', icon: '👥', path: '/users', color: 'bg-slate-500' },
        ] : []),
    ];

    const MENU_MANAGER = [
        { label: 'Dashboard', icon: '🏠', path: '/dashboard', color: 'bg-slate-700' },
        { label: 'Approve Checkout', icon: '⏳', path: '/transactions', color: 'bg-amber-500', badge: pendingCheckout },
        { label: 'Approve Check In', icon: '✅', path: '/checkin-list', color: 'bg-emerald-600', badge: pendingCheckin },
        { label: 'Inventory', icon: '🗃️', path: '/inventory', color: 'bg-slate-600' },
        { label: 'Cost Report', icon: '💰', path: '/cost-report', color: 'bg-violet-600' },
    ];

    const menus = user.role === 'MANAGER' ? MENU_MANAGER : MENU_STAFF;

    return (
        <>
            {/* BACKDROP */}
            {showMenu && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowMenu(false)} />
            )}

            {/* MENU ITEMS */}
            {showMenu && (
                <div className="fixed bottom-24 right-4 z-50 flex flex-col-reverse gap-2 items-end">
                    {/* Logout */}
                    <button onClick={handleLogout}
                        className="bg-red-600 text-white font-black flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl active:scale-95 transition-all">
                        <span className="text-base">🚪</span>
                        <span className="text-xs uppercase tracking-widest">Logout</span>
                    </button>

                    {menus.filter(m => m.path !== pathname).map((item) => (
                        <button key={item.path}
                            onClick={() => { setShowMenu(false); router.push(item.path); }}
                            className={`${item.color} text-white font-black flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl active:scale-95 transition-all`}>
                            <span className="text-base">{item.icon}</span>
                            <span className="text-xs uppercase tracking-widest whitespace-nowrap">{item.label}</span>
                            {(item as any).badge > 0 && (
                                <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center ml-1">
                                    {(item as any).badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* FAB */}
            <button onClick={() => setShowMenu(v => !v)}
                className={`fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full font-black text-white text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center
                    ${showMenu ? 'bg-red-500' : 'bg-blue-600'}`}>
                {showMenu ? '✕' : '☰'}
            </button>

            {/* Pending badges on FAB saat menu tutup */}
            {!showMenu && (pendingCheckin + pendingCheckout) > 0 && (
                <div className="fixed bottom-16 right-3 z-50 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                    {pendingCheckin + pendingCheckout}
                </div>
            )}
        </>
    );
}
