'use client';
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const PROXY_URL = "https://sedayu.com/api/warehouse/jurnal_proxy.php";
const API_KEY = "SedayuSolar_TopSecret_2026";

interface Person {
    id: number;
    display_name: string;
    email?: string;
    phone?: string;
}
interface TransactionStatus {
    id: number;
    name: string;
    name_bahasa: string;
}
interface Invoice {
    id: number;
    transaction_no: string;
    person: Person;
    transaction_date: string;   // format: "DD/MM/YYYY"
    due_date: string;           // format: "DD/MM/YYYY"
    original_amount: string;    // string e.g. "9720000.0"
    remaining: string;          // string e.g. "8718000.0"
    subtotal: string | number;
    transaction_status: TransactionStatus;
    status: string;             // "approved" - status dokumen
    currency_code: string;
}
interface Summary { total: number; paid: number; unpaid: number; overdue: number; }

// Status pembayaran dari transaction_status.name
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    "Paid": { label: "Lunas", color: "#16A34A", bg: "#F0FDF4" },
    "Open": { label: "Belum Dibayar", color: "#2563EB", bg: "#EFF6FF" },
    "Partial": { label: "Terbayar Sebagian", color: "#D97706", bg: "#FFFBEB" },
    "Overdue": { label: "Lewat Jatuh Tempo", color: "#DC2626", bg: "#FEF2F2" },
    "Terbayar Sebagian": { label: "Terbayar Sebagian", color: "#D97706", bg: "#FFFBEB" },
    "Lunas": { label: "Lunas", color: "#16A34A", bg: "#F0FDF4" },
    "Belum Dibayar": { label: "Belum Dibayar", color: "#2563EB", bg: "#EFF6FF" },
    "Lewat Jatuh Tempo": { label: "Lewat Jatuh Tempo", color: "#DC2626", bg: "#FEF2F2" },
};

const fmtNum = (s: string | number): number => parseFloat(String(s)) || 0;
const fmt = (n: number): string =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

// Parse "DD/MM/YYYY" → Date
const parseJurnalDate = (d?: string): Date | null => {
    if (!d || !d.includes("/")) return null;
    const parts = d.split("/");
    if (parts.length !== 3) return null;
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
};
const fmtDate = (d?: string): string => {
    const dt = parseJurnalDate(d);
    return dt ? dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

const defaultFrom = (): string => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
};
const defaultTo = (): string => new Date().toISOString().split("T")[0];

const getStatusKey = (inv: Invoice): string =>
    inv.transaction_status?.name || "—";

const STATUS_FILTER_OPTIONS = [
    "Semua", "Paid", "Open", "Partial", "Overdue"
];

export default function JurnalInvoiceDashboard() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState(defaultFrom());
    const [toDate, setToDate] = useState(defaultTo());
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState("Semua");
    const [sortKey, setSortKey] = useState("transaction_date");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [summary, setSummary] = useState<Summary>({ total: 0, paid: 0, unpaid: 0, overdue: 0 });
    const [searchInput, setSearchInput] = useState("");

    // ── Auth guard: harus login dulu ──
    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) { router.push('/login'); return; }
        setAuthChecked(true);
    }, []); // eslint-disable-line

    const fetchInvoices = useCallback(async (
        pg: number = 1,
        q: string = search,
        from: string = fromDate,
        to: string = toDate
    ) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                action: "list_invoices",
                page: String(pg),
                per_page: "25",
                from_date: from,
                to_date: to,
            });
            if (q) params.set("search", q);

            const res = await fetch(`${PROXY_URL}?${params}`, {
                headers: { "X-API-KEY": API_KEY },
            });
            const r = await res.json();

            if (!res.ok) { setError(r.message || `Error ${res.status}`); setInvoices([]); return; }

            const data: Invoice[] = r.sales_invoices || [];
            setInvoices(data);
            setTotalCount(r.total_count || data.length);
            setTotalPages(r.total_pages || Math.ceil((r.total_count || data.length) / 25) || 1);
            setPage(r.current_page || pg);

            // Summary berdasarkan transaction_status
            setSummary({
                total: data.reduce((s, i) => s + fmtNum(i.original_amount), 0),
                paid: data.filter(i => i.transaction_status?.name === "Paid")
                    .reduce((s, i) => s + fmtNum(i.original_amount), 0),
                unpaid: data.filter(i => ["Open", "Partial"].includes(i.transaction_status?.name))
                    .reduce((s, i) => s + fmtNum(i.original_amount), 0),
                overdue: data.filter(i => i.transaction_status?.name === "Overdue")
                    .reduce((s, i) => s + fmtNum(i.original_amount), 0),
            });
        } catch {
            setError("Gagal koneksi ke server proxy.");
            setInvoices([]);
        }
        setLoading(false);
    }, [search, fromDate, toDate]);

    useEffect(() => { if (authChecked) fetchInvoices(1); }, [authChecked]); // eslint-disable-line

    const handleSearch = () => { setSearch(searchInput); fetchInvoices(1, searchInput, fromDate, toDate); };
    const handleDateFilter = () => fetchInvoices(1, search, fromDate, toDate);

    // Client-side filter & sort
    const filtered = invoices
        .filter(inv => statusFilter === "Semua" || getStatusKey(inv) === statusFilter)
        .sort((a, b) => {
            let va: string | number = "";
            let vb: string | number = "";
            if (sortKey === "original_amount" || sortKey === "remaining") {
                va = fmtNum(a[sortKey as "original_amount" | "remaining"]);
                vb = fmtNum(b[sortKey as "original_amount" | "remaining"]);
                return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
            }
            if (sortKey === "person_name") {
                va = (a.person?.display_name || "").toLowerCase();
                vb = (b.person?.display_name || "").toLowerCase();
            } else if (sortKey === "transaction_date" || sortKey === "due_date") {
                const da = parseJurnalDate(a[sortKey as "transaction_date" | "due_date"]);
                const db = parseJurnalDate(b[sortKey as "transaction_date" | "due_date"]);
                const ta = da?.getTime() ?? 0;
                const tb = db?.getTime() ?? 0;
                return sortDir === "asc" ? ta - tb : tb - ta;
            } else {
                va = String((a as unknown as Record<string, unknown>)[sortKey] ?? "").toLowerCase();
                vb = String((b as unknown as Record<string, unknown>)[sortKey] ?? "").toLowerCase();
            }
            return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });

    const handleSort = (key: string) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const SortIcon = ({ k }: { k: string }) => {
        if (sortKey !== k) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
        return <span style={{ marginLeft: 4, color: "#E8890A" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
    };

    const COLS = [
        { key: "transaction_no", label: "No. Invoice" },
        { key: "person_name", label: "Customer" },
        { key: "transaction_date", label: "Tgl Invoice" },
        { key: "due_date", label: "Jatuh Tempo" },
        { key: "original_amount", label: "Total" },
        { key: "remaining", label: "Sisa" },
        { key: "status_pay", label: "Status" },
    ];

    const summaryCards = [
        { label: "Total Invoice", value: fmt(summary.total), color: "#60A5FA", icon: "📄" },
        { label: "Lunas", value: fmt(summary.paid), color: "#34D399", icon: "✅" },
        { label: "Belum Lunas", value: fmt(summary.unpaid), color: "#FBBF24", icon: "⏳" },
        { label: "Jatuh Tempo", value: fmt(summary.overdue), color: "#F87171", icon: "🔴" },
    ];

    // Belum ketauan login atau enggak → jangan render apa-apa dulu (hindari flash data sebelum redirect)
    if (!authChecked) return null;

    return (
        <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#0D1621", minHeight: "100vh", color: "#E2E8F0" }}>

            {/* HEADER */}
            <div style={{ background: "linear-gradient(135deg,#0F2340 0%,#1A3A5C 100%)", borderBottom: "1px solid #1E2D3D", padding: "20px 24px 16px" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 10, color: "#E8890A", fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
                                PT. Selaras Daya Usaha · Jurnal by Mekari
                            </div>
                            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>Sales Invoice</h1>
                        </div>
                        <button onClick={() => fetchInvoices(page)}
                            style={{ background: "#E8890A", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                            ↻ Refresh
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 16 }}>
                        {summaryCards.map((c, i) => (
                            <div key={i} style={{ background: "#0D1F35", borderRadius: 12, padding: "12px 16px", border: "1px solid #1E2D3D" }}>
                                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{c.icon} {c.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: c.color }}>{c.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FILTER BAR */}
            <div style={{ background: "#0F1E2D", borderBottom: "1px solid #1E2D3D", padding: "12px 24px" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "flex", flex: "1 1 220px" }}>
                        <input value={searchInput}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleSearch()}
                            placeholder="Cari nomor invoice, customer..."
                            style={{ flex: 1, background: "#0D1621", border: "1px solid #1E3A5C", borderRight: "none", borderRadius: "10px 0 0 10px", padding: "9px 14px", color: "#E2E8F0", fontSize: 13, outline: "none" }} />
                        <button onClick={handleSearch}
                            style={{ background: "#1A3A5C", border: "1px solid #1E3A5C", borderLeft: "none", borderRadius: "0 10px 10px 0", padding: "9px 14px", cursor: "pointer", color: "#60A5FA", fontSize: 14 }}>
                            🔍
                        </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>DARI</span>
                        <input type="date" value={fromDate}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromDate(e.target.value)}
                            style={{ background: "#0D1621", border: "1px solid #1E3A5C", borderRadius: 10, padding: "8px 10px", color: "#E2E8F0", fontSize: 12, outline: "none" }} />
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>S/D</span>
                        <input type="date" value={toDate}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToDate(e.target.value)}
                            style={{ background: "#0D1621", border: "1px solid #1E3A5C", borderRadius: 10, padding: "8px 10px", color: "#E2E8F0", fontSize: 12, outline: "none" }} />
                        <button onClick={handleDateFilter}
                            style={{ background: "#E8890A", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                            Filter
                        </button>
                    </div>

                    <select value={statusFilter}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                        style={{ background: "#0D1621", border: "1px solid #1E3A5C", borderRadius: 10, padding: "9px 12px", color: "#E2E8F0", fontSize: 12, outline: "none" }}>
                        {STATUS_FILTER_OPTIONS.map(o => <option key={o} value={o}>{o === "Semua" ? "Semua Status" : STATUS_MAP[o]?.label || o}</option>)}
                    </select>
                </div>
            </div>

            {/* TABLE */}
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>
                {error && (
                    <div style={{ background: "#1F0A0A", border: "1px solid #7F1D1D", borderRadius: 12, padding: "14px 18px", marginBottom: 16, color: "#FCA5A5", fontSize: 13 }}>
                        ⚠️ {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#475569" }}>
                        <div style={{ fontSize: 28, marginBottom: 12 }}>⟳</div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>Memuat data dari Jurnal...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>Tidak ada invoice ditemukan</p>
                        <p style={{ fontSize: 12, marginTop: 6 }}>Coba ubah filter atau rentang tanggal</p>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: 12, fontSize: 12, color: "#475569", fontWeight: 600 }}>
                            Menampilkan {filtered.length} dari {totalCount} invoice
                            {statusFilter !== "Semua" && ` · Filter: ${STATUS_MAP[statusFilter]?.label || statusFilter}`}
                        </div>

                        <div style={{ background: "#0F1E2D", borderRadius: 16, border: "1px solid #1E2D3D", overflow: "hidden" }}>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                                    <thead>
                                        <tr style={{ background: "#0D1621", borderBottom: "1px solid #1E2D3D" }}>
                                            {COLS.map(col => (
                                                <th key={col.key} onClick={() => handleSort(col.key)}
                                                    style={{ padding: "12px 14px", textAlign: col.key === "original_amount" || col.key === "remaining" ? "right" : "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "#475569", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
                                                    {col.label}<SortIcon k={col.key} />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((inv, i) => {
                                            const stKey = getStatusKey(inv);
                                            const st = STATUS_MAP[stKey] || { label: stKey, color: "#94A3B8", bg: "#1E293B" };
                                            const isOverdue = stKey === "Overdue" || stKey === "Lewat Jatuh Tempo";
                                            const rowBg = isOverdue ? "#1A0A0A" : i % 2 === 0 ? "#0F1E2D" : "#0D1B2A";
                                            const remaining = fmtNum(inv.remaining);
                                            return (
                                                <tr key={inv.id}
                                                    style={{ borderBottom: "1px solid #1A2D3D", background: rowBg, transition: "background 0.15s" }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#162030"; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>
                                                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#60A5FA", fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                                                        {inv.transaction_no}
                                                    </td>
                                                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#CBD5E1", maxWidth: 180 }}>
                                                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {inv.person?.display_name || "—"}
                                                        </div>
                                                        {inv.person?.phone && <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{inv.person.phone}</div>}
                                                    </td>
                                                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>
                                                        {fmtDate(inv.transaction_date)}
                                                    </td>
                                                    <td style={{ padding: "11px 14px", fontSize: 12, whiteSpace: "nowrap", color: isOverdue ? "#F87171" : "#94A3B8" }}>
                                                        {fmtDate(inv.due_date)}{isOverdue && " ⚠️"}
                                                    </td>
                                                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#E2E8F0", fontWeight: 700, whiteSpace: "nowrap", textAlign: "right" }}>
                                                        {fmt(fmtNum(inv.original_amount))}
                                                    </td>
                                                    <td style={{ padding: "11px 14px", fontSize: 12, whiteSpace: "nowrap", textAlign: "right", color: remaining > 0 ? "#FBBF24" : "#34D399", fontWeight: 600 }}>
                                                        {fmt(remaining)}
                                                    </td>
                                                    <td style={{ padding: "11px 14px" }}>
                                                        <span style={{ background: st.bg + "22", color: st.color, border: `1px solid ${st.color}44`, borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
                                <button disabled={page <= 1} onClick={() => fetchInvoices(page - 1)}
                                    style={{ background: page <= 1 ? "#1E2D3D" : "#1A3A5C", color: page <= 1 ? "#334155" : "#E2E8F0", border: "1px solid #1E2D3D", borderRadius: 10, padding: "8px 16px", cursor: page <= 1 ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12 }}>
                                    ← Prev
                                </button>
                                {[...Array(Math.min(totalPages, 7))].map((_: unknown, i: number) => {
                                    const p = i + 1;
                                    return (
                                        <button key={p} onClick={() => fetchInvoices(p)}
                                            style={{ background: page === p ? "#E8890A" : "#1A3A5C", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12 }}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <button disabled={page >= totalPages} onClick={() => fetchInvoices(page + 1)}
                                    style={{ background: page >= totalPages ? "#1E2D3D" : "#1A3A5C", color: page >= totalPages ? "#334155" : "#E2E8F0", border: "1px solid #1E2D3D", borderRadius: 10, padding: "8px 16px", cursor: page >= totalPages ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12 }}>
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        * { box-sizing: border-box; }
      `}</style>
        </div>
    );
}
