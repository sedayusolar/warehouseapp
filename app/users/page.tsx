'use client';
import Navbar from '../components/Navbar';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

const API_KEY = "SedayuSolar_TopSecret_2026";
const BASE_URL = "https://sedayu.com/api/warehouse";

const ROLE_CONFIG: Record<string, { label: string, color: string, bg: string }> = {
    ADMIN: { label: 'Admin', color: 'text-violet-700', bg: 'bg-violet-100' },
    MANAGER: { label: 'Manager', color: 'text-blue-700', bg: 'bg-blue-100' },
    STAFF: { label: 'Staff', color: 'text-slate-600', bg: 'bg-slate-100' },
    ENGINEER: { label: 'Engineer', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

const ROLE_ORDER = ['ADMIN', 'MANAGER', 'STAFF', 'ENGINEER'] as const;

function UserManagementContent() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [modal, setModal] = useState<'create' | 'edit' | 'reset' | 'delete' | null>(null);
    const [target, setTarget] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const [fUsername, setFUsername] = useState('');
    const [fName, setFName] = useState('');
    const [fRole, setFRole] = useState('STAFF');
    const [fPassword, setFPassword] = useState('');
    const [fConfirm, setFConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        const parsed = JSON.parse(u);
        if (parsed.role !== 'ADMIN') {
            alert("Akses ditolak! Hanya Admin.");
            router.push('/dashboard');
            return;
        }
        setUser(parsed);
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/get_users.php`, { headers: { 'X-API-KEY': API_KEY } });
            const r = await res.json();
            if (r.status === 'success') setUsers(r.data);
        } catch { }
        setLoading(false);
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const openCreate = () => {
        setFUsername(''); setFName(''); setFRole('STAFF');
        setFPassword(''); setFConfirm(''); setShowPwd(false);
        setModal('create');
    };

    const openEdit = (u: any) => {
        setTarget(u); setFName(u.name); setFRole(u.role);
        setModal('edit');
    };

    const openReset = (u: any) => {
        setTarget(u); setFPassword(''); setFConfirm(''); setShowPwd(false);
        setModal('reset');
    };

    const openDelete = (u: any) => {
        setTarget(u);
        setModal('delete');
    };

    const closeModal = () => { setModal(null); setTarget(null); setSaving(false); };

    const handleCreate = async () => {
        if (!fUsername || !fName || !fRole || !fPassword) { alert("Semua field wajib diisi."); return; }
        if (fPassword !== fConfirm) { alert("Password dan konfirmasi tidak cocok."); return; }
        if (fPassword.length < 6) { alert("Password minimal 6 karakter."); return; }
        setSaving(true);
        try {
            const res = await fetch(`${BASE_URL}/manage_user.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ action: 'create', username: fUsername, name: fName, role: fRole, password: fPassword })
            });
            const r = await res.json();
            if (r.status === 'success') { showToast(r.message); closeModal(); fetchUsers(); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!fName || !fRole) { alert("Nama dan role wajib."); return; }
        setSaving(true);
        try {
            const res = await fetch(`${BASE_URL}/manage_user.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ action: 'update', id: target.id, name: fName, role: fRole })
            });
            const r = await res.json();
            if (r.status === 'success') { showToast(r.message); closeModal(); fetchUsers(); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSaving(false);
    };

    const handleReset = async () => {
        if (!fPassword) { alert("Password baru wajib diisi."); return; }
        if (fPassword !== fConfirm) { alert("Password dan konfirmasi tidak cocok."); return; }
        if (fPassword.length < 6) { alert("Password minimal 6 karakter."); return; }
        setSaving(true);
        try {
            const res = await fetch(`${BASE_URL}/manage_user.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ action: 'reset_password', id: target.id, new_password: fPassword })
            });
            const r = await res.json();
            if (r.status === 'success') { showToast(r.message); closeModal(); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSaving(false);
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${BASE_URL}/manage_user.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                body: JSON.stringify({ action: 'delete', id: target.id, requestor_name: user?.name })
            });
            const r = await res.json();
            if (r.status === 'success') { showToast(r.message); closeModal(); fetchUsers(); }
            else alert("Gagal: " + r.message);
        } catch { alert("Gagal koneksi."); }
        setSaving(false);
    };

    if (!user) return null;

    const grouped = Object.fromEntries(
        ROLE_ORDER.map(role => [role, users.filter(u => u.role === role)])
    ) as Record<typeof ROLE_ORDER[number], any[]>;

    // Dropdown role options — reusable
    const RoleSelect = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
        <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 appearance-none">
            <option value="STAFF">Staff</option>
            <option value="ENGINEER">Engineer</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
        </select>
    );

    return (
        <main className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans">

            {/* TOAST */}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white font-black text-sm px-6 py-3 rounded-2xl shadow-xl animate-bounce">
                    ✅ {toast}
                </div>
            )}

            {/* MODALS */}
            {modal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4" onClick={closeModal}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>

                        {/* CREATE */}
                        {modal === 'create' && (
                            <>
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Tambah User Baru</p>
                                </div>
                                <input type="text" placeholder="Username *" value={fUsername}
                                    onChange={e => setFUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <input type="text" placeholder="Nama Lengkap *" value={fName}
                                    onChange={e => setFName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <RoleSelect value={fRole} onChange={setFRole} />
                                {fRole === 'ENGINEER' && (
                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 -mt-2">
                                        <p className="text-[10px] text-emerald-700 font-bold">
                                            ✍️ Engineer hanya bisa: lihat transaksi & TTD konfirmasi penerimaan barang di site
                                        </p>
                                    </div>
                                )}
                                <div className="relative">
                                    <input type={showPwd ? 'text' : 'password'} placeholder="Password * (min 6 karakter)" value={fPassword}
                                        onChange={e => setFPassword(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 pr-12" />
                                    <button onClick={() => setShowPwd(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                        {showPwd ? '🙈' : '👁️'}
                                    </button>
                                </div>
                                <input type={showPwd ? 'text' : 'password'} placeholder="Konfirmasi Password *" value={fConfirm}
                                    onChange={e => setFConfirm(e.target.value)}
                                    className={`w-full p-3.5 rounded-xl outline-none font-medium text-slate-700 ${fConfirm && fPassword !== fConfirm ? 'bg-red-50 ring-2 ring-red-300' : 'bg-slate-50'}`} />
                                {fConfirm && fPassword !== fConfirm && (
                                    <p className="text-[10px] text-red-500 font-bold -mt-2">Password tidak cocok</p>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                    <button onClick={handleCreate} disabled={saving}
                                        className="flex-1 bg-blue-600 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {saving ? 'Menyimpan...' : '✓ Buat User'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* EDIT */}
                        {modal === 'edit' && target && (
                            <>
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Edit User</p>
                                    <p className="font-bold text-slate-800 mt-0.5">{target.username}</p>
                                </div>
                                <input type="text" placeholder="Nama Lengkap *" value={fName}
                                    onChange={e => setFName(e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700" />
                                <RoleSelect value={fRole} onChange={setFRole} />
                                {fRole === 'ENGINEER' && (
                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 -mt-2">
                                        <p className="text-[10px] text-emerald-700 font-bold">
                                            ✍️ Engineer hanya bisa: lihat transaksi & TTD konfirmasi penerimaan barang di site
                                        </p>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                    <button onClick={handleUpdate} disabled={saving}
                                        className="flex-1 bg-blue-600 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {saving ? 'Menyimpan...' : '✓ Simpan'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* RESET PASSWORD */}
                        {modal === 'reset' && target && (
                            <>
                                <div>
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Reset Password</p>
                                    <p className="font-bold text-slate-800 mt-0.5">{target.name}</p>
                                    <p className="text-[10px] text-slate-400">@{target.username}</p>
                                </div>
                                <div className="relative">
                                    <input type={showPwd ? 'text' : 'password'} placeholder="Password Baru * (min 6 karakter)" value={fPassword}
                                        onChange={e => setFPassword(e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 pr-12" />
                                    <button onClick={() => setShowPwd(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                        {showPwd ? '🙈' : '👁️'}
                                    </button>
                                </div>
                                <input type={showPwd ? 'text' : 'password'} placeholder="Konfirmasi Password Baru *" value={fConfirm}
                                    onChange={e => setFConfirm(e.target.value)}
                                    className={`w-full p-3.5 rounded-xl outline-none font-medium text-slate-700 ${fConfirm && fPassword !== fConfirm ? 'bg-red-50 ring-2 ring-red-300' : 'bg-slate-50'}`} />
                                {fConfirm && fPassword !== fConfirm && (
                                    <p className="text-[10px] text-red-500 font-bold -mt-2">Password tidak cocok</p>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                    <button onClick={handleReset} disabled={saving}
                                        className="flex-1 bg-amber-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {saving ? 'Menyimpan...' : '🔑 Reset'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* DELETE */}
                        {modal === 'delete' && target && (
                            <>
                                <div className="text-center space-y-2">
                                    <p className="text-4xl">⚠️</p>
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Hapus User</p>
                                    <p className="font-bold text-slate-800">{target.name}</p>
                                    <p className="text-[10px] text-slate-400">@{target.username} · {target.role}</p>
                                    <p className="text-xs text-slate-500 pt-1">Aksi ini tidak bisa dibatalkan.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase">Batal</button>
                                    <button onClick={handleDelete} disabled={saving}
                                        className="flex-1 bg-red-500 text-white font-black py-3.5 rounded-2xl text-xs uppercase shadow-lg disabled:opacity-50">
                                        {saving ? 'Menghapus...' : '🗑️ Hapus'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ACTION BAR */}
            <div className="sticky top-16 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-2">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <p className="text-sm font-black text-slate-600">{users.length} user terdaftar</p>
                    <button onClick={openCreate}
                        className="bg-blue-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-widest shadow-sm active:scale-95">
                        ＋ Tambah
                    </button>
                </div>
            </div>
/div>

            <div className="p-4 max-w-2xl mx-auto space-y-5">
                {loading ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse font-bold">Memuat...</div>
                ) : (
                    <>
                        {/* Summary cards — 4 role */}
                        <div className="grid grid-cols-4 gap-2">
                            {ROLE_ORDER.map(role => (
                                <div key={role} className={`${ROLE_CONFIG[role].bg} rounded-2xl p-3 text-center`}>
                                    <p className={`text-2xl font-black ${ROLE_CONFIG[role].color}`}>{grouped[role].length}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${ROLE_CONFIG[role].color}`}>{ROLE_CONFIG[role].label}</p>
                                </div>
                            ))}
                        </div>

                        {/* User list grouped by role */}
                        {ROLE_ORDER.map(role => {
                            const group = grouped[role];
                            if (!group.length) return null;
                            const cfg = ROLE_CONFIG[role];
                            return (
                                <div key={role} className="space-y-2">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ml-1 ${cfg.color}`}>
                                        {cfg.label} ({group.length})
                                    </p>
                                    {group.map((u: any) => (
                                        <div key={u.id} className="bg-white rounded-2xl shadow-sm p-4">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                                                        <span className={`font-black text-sm ${cfg.color}`}>
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-slate-800 truncate">{u.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">@{u.username}</p>
                                                        <p className="text-[9px] text-slate-300 mt-0.5">
                                                            Dibuat: {new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>

                                            <div className="flex gap-2 mt-3">
                                                <button onClick={() => openEdit(u)}
                                                    className="flex-1 bg-slate-100 text-slate-600 font-black py-2 rounded-xl text-[10px] uppercase active:scale-95">
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => openReset(u)}
                                                    className="flex-1 bg-amber-50 text-amber-600 font-black py-2 rounded-xl text-[10px] uppercase active:scale-95">
                                                    🔑 Password
                                                </button>
                                                {u.role !== 'ADMIN' && (
                                                    <button onClick={() => openDelete(u)}
                                                        className="bg-red-50 text-red-500 font-black py-2 px-3 rounded-xl text-[10px] uppercase active:scale-95">
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            <Navbar />
        </main>
    );
}

export default function UserManagementPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-black animate-pulse text-slate-400">Loading...</div>}>
            <UserManagementContent />
        </Suspense>
    );
}
