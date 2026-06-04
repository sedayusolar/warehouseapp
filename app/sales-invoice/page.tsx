import { useState, useEffect, useCallback } from "react";

const PROXY_URL = "https://sedayu.com/api/jurnal_proxy.php";
const API_KEY = "SedayuSolar_TopSecret_2026";

const STATUS_MAP = {
    open: { label: "Open", color: "#2563EB", bg: "#EFF6FF" },
    paid: { label: "Lunas", color: "#16A34A", bg: "#F0FDF4" },
    overdue: { label: "Jatuh Tempo", color: "#DC2626", bg: "#FEF2F2" },
    partial: { label: "Partial", color: "#D97706", bg: "#FFFBEB" },
    void: { label: "Void", color: "#6B7280", bg: "#F9FAFB" },
    draft: { label: "Draft", color: "#7C3AED", bg: "#F5F3FF" },
};

const fmt = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Default date range: last 3 months
const defaultFrom = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
};
const defaultTo = () => new Date().toISOString().split("T")[0];

export default function JurnalInvoiceDashboard() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState(defaultFrom());
    const [toDate, setToDate] = useState(defaultTo());
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortKey, setSortKey] = useState("transaction_date");
    const [sortDir, setSortDir] = useState("desc");
    const [summary, setSummary] = useState({ total: 0, paid: 0, unpaid: 0, overdue: 0 });
    const [searchInput, setSearchInput] = useState("");

    const fetchInvoices = useCallback(async (pg = 1, q = search, from = fromDate, to = toDate) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                action: "list_invoices",
                page: String(pg),
                per_page: "20",
                from_date: from,
                to_date: to,
            });
            if (q) params.set("search", q);

            const res = await fetch(`${PROXY_URL}?${params}`, {
                headers: { "X-API-KEY": API_KEY },
            });
            const r = await res.json();

            if (!res.ok) {
                setError(r.message || `Error ${res.status}`);
                setInvoices([]);
                return;
            }

            // Jurnal API response structure
            const data = r.sales_invoices || r.data || [];
            const meta = r.meta || {};
            setInvoices(data);
            setTotalCount(meta.total_count || data.length);
            setTotalPages(Math.ceil((meta.total_count || data.length) / 20) || 1);
            setPage(pg);

            // Summary
            const all = data;
            setSummary({
                total: all.reduce((s, i) => s + (i.amount || 0), 0),
                paid: all.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0),
                unpaid: all.filter(i => ["open", "partial"].includes(i.status)).reduce((s, i) => s + (i.amount || 0), 0),
                overdue: all.filter(i => i.status === "overdue").reduce((s, i) => s + (i.amount || 0), 0),
            });
        } catch (e) {
            setError("Gagal koneksi ke server proxy. Pastikan jurnal_proxy.php sudah di-deploy.");
            setInvoices([]);
        }
        setLoading(false);
    }, [search, fromDate, toDate]);

    useEffect(() => { fetchInvoices(1); }, []);

    const handleSearch = () => {
        setSearch(searchInput);
        fetchInvoices(1, searchInput, fromDate, toDate);
    };

    const handleDateFilter = () => {
        fetchInvoices(1, search, fromDate, toDate);
    };

    // Client-side filter & sort
    const filtered = invoices
        .filter(inv => statusFilter === "all" || inv.status === statusFilter)
        .sort((a, b) => {
            let va = a[sortKey] ?? "";
            let vb = b[sortKey] ?? "";
            if (typeof va === "string") va = va.toLowerCase();
            if (typeof vb === "string") vb = vb.toLowerCase();
            return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });

    const handleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const SortIcon = ({ k }) => {
        if (sortKey !== k) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
        return <span style={{ marginLeft: 4, color: "#E8890A" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
    };

    return (
        <div style={{
            fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
            background: "#0D1621",
            minHeight: "100vh",
            color: "#E2E8F0",
        }}>
            {/* ── HEADER ── */}
            <div style={{
                background: "linear-gradient(135deg, #0F2340 0%, #1A3A5C 100%)",
                borderBottom: "1px solid #1E2D3D",
                padding: "20px 24px 16px",
            }}>
                <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 10, color: "#E8890A", fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
                                PT. Selaras Daya Usaha · Jurnal by Mekari
                            </div>
                            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
                                Sales Invoice
                            </h1>
                        </div>
                        <button onClick={() => fetchInvoices(page)}
                            style={{
                                background: "#E8890A", color: "#fff", border: "none",
                                borderRadius: 10, padding: "8px 18px", fontWeight: 800,
                                fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                            }}>
                            ↻ Refresh
                        </button>
                    </div>

                    {/* ── SUMMARY CARDS ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
                        {[
                            { label: "Total Invoice", value: fmt(summary.total), color: "#60A5FA", icon: "📄" },
                            { label: "Lunas", value: fmt(summary.paid), color: "#34D399", icon: "✅" },
                            { label: "Belum Lunas", value: fmt(summary.unpaid), color: "#FBBF24", icon: "⏳" },
                            { label: "Jatuh Tempo", value: fmt(summary.overdue), color: "#F87171", icon: "🔴" },
                        ].map((c, i) => (
                            <div key={i} style={{
                                background: "#0D1F35", borderRadius: 12, padding: "12px 16px",
                                border: "1px solid #1E2D3D",
                            }}>
                                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                                    {c.icon} {c.label}
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                                    {c.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── FILTER BAR ── */}
            <div style={{
                background: "#0F1E2D", borderBottom: "1px solid #1E2D3D",
                padding: "12px 24px",
            }}>
                <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>

                    {/* Search */}
                    <div style={{ display: "flex", flex: "1 1 220px", gap: 0 }}>
                        <input
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSearch()}
                            placeholder="Cari nomor invoice, customer..."
                            style={{
                                flex: 1, background: "#0D1621", border: "1px solid #1E3A5C",
                                borderRight: "none", borderRadius: "10px 0 0 10px",
                                padding: "9px 14px", color: "#E2E8F0", fontSize: 13,
                                outline: "none",
                            }}
                        />
                        <button onClick={handleSearch} style={{
                            background: "#1A3A5C", border: "1px solid #1E3A5C", borderLeft: "none",
                            borderRadius: "0 10px 10px 0", padding: "9px 14px", cursor: "pointer",
                            color: "#60A5FA", fontSize: 14,
                        }}>🔍</button>
                    </div>

                    {/* Date Range */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>DARI</span>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                            style={{
                                background: "#0D1621", border: "1px solid #1E3A5C", borderRadius: 10,
                                padding: "8px 10px", color: "#E2E8F0", fontSize: 12, outline: "none",
                            }} />
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>S/D</span>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                            style={{
                                background: "#0D1621", border: "1px solid #1E3A5C", borderRadius: 10,
                                padding: "8px 10px", color: "#E2E8F0", fontSize: 12, outline: "none",
                            }} />
                        <button onClick={handleDateFilter} style={{
                            background: "#E8890A", border: "none", borderRadius: 10,
                            padding: "8px 14px", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
                        }}>Filter</button>
                    </div>

                    {/* Status filter */}
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
                        background: "#0D1621", border: "1px solid #1E3A5C", borderRadius: 10,
                        padding: "9px 12px", color: "#E2E8F0", fontSize: 12, outline: "none",
                    }}>
                        <option value="all">Semua Status</option>
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── TABLE AREA ── */}
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>

                {/* Error */}
                {error && (
                    <div style={{
                        background: "#1F0A0A", border: "1px solid #7F1D1D", borderRadius: 12,
                        padding: "14px 18px", marginBottom: 16, color: "#FCA5A5", fontSize: 13,
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#475569" }}>
                        <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>Memuat data dari Jurnal...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>Tidak ada invoice ditemukan</p>
                        <p style={{ fontSize: 12, marginTop: 6, color: "#1E3A5C" }}>Coba ubah filter atau rentang tanggal</p>
                    </div>
                ) : (
                    <>
                        {/* Count */}
                        <div style={{ marginBottom: 12, fontSize: 12, color: "#475569", fontWeight: 600 }}>
                            Menampilkan {filtered.length} invoice
                            {totalCount > 20 && ` dari ${totalCount} total`}
                            {statusFilter !== "all" && ` · Filter: ${STATUS_MAP[statusFilter]?.label}`}
                        </div>

                        {/* Table */}
                        <div style={{ background: "#0F1E2D", borderRadius: 16, border: "1px solid #1E2D3D", overflow: "hidden" }}>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                                    <thead>
                                        <tr style={{ background: "#0D1621", borderBottom: "1px solid #1E2D3D" }}>
                                            {[
                                                { key: "transaction_no", label: "No. Invoice" },
                                                { key: "person_name", label: "Customer" },
                                                { key: "transaction_date", label: "Tanggal" },
                                                { key: "due_date", label: "Jatuh Tempo" },
                                                { key: "amount", label: "Total" },
                                                { key: "remaining", label: "Sisa" },
                                                { key: "status", label: "Status" },
                                            ].map(col => (
                                                <th key={col.key}
                                                    onClick={() => handleSort(col.key)}
                                                    style={{
                                                        padding: "12px 16px", textAlign: "left",
                                                        fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                                        letterSpacing: 1.5, color: "#475569", cursor: "pointer",
                                                        whiteSpace: "nowrap", userSelect: "none",
                                                    }}>
                                                    {col.label}<SortIcon k={col.key} />
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((inv, i) => {
                                            const st = STATUS_MAP[inv.status] || { label: inv.status, color: "#94A3B8", bg: "#1E293B" };
                                            const isOverdue = inv.status === "overdue";
                                            return (
                                                <tr key={inv.id || i}
                                                    style={{
                                                        borderBottom: "1px solid #1A2D3D",
                                                        background: isOverdue ? "#1A0A0A" : i % 2 === 0 ? "#0F1E2D" : "#0D1B2A",
                                                        transition: "background 0.15s",
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = "#162030"}
                                                    onMouseLeave={e => e.currentTarget.style.background = isOverdue ? "#1A0A0A" : i % 2 === 0 ? "#0F1E2D" : "#0D1B2A"}
                                                >
                                                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#60A5FA", fontWeight: 700, fontFamily: "monospace" }}>
                                                        {inv.transaction_no || inv.invoice_no || "—"}
                                                    </td>
                                                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#CBD5E1", maxWidth: 200 }}>
                                                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {inv.person_name || inv.customer_name || "—"}
                                                        </div>
                                                        {inv.person_email && (
                                                            <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{inv.person_email}</div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>
                                                        {fmtDate(inv.transaction_date || inv.invoice_date)}
                                                    </td>
                                                    <td style={{ padding: "11px 16px", fontSize: 12, whiteSpace: "nowrap", color: isOverdue ? "#F87171" : "#94A3B8" }}>
                                                        {fmtDate(inv.due_date)}
                                                        {isOverdue && " ⚠️"}
                                                    </td>
                                                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#E2E8F0", fontWeight: 700, whiteSpace: "nowrap", textAlign: "right" }}>
                                                        {fmt(inv.amount || inv.total)}
                                                    </td>
                                                    <td style={{
                                                        padding: "11px 16px", fontSize: 12, whiteSpace: "nowrap", textAlign: "right",
                                                        color: (inv.remaining_amount || 0) > 0 ? "#FBBF24" : "#34D399", fontWeight: 600
                                                    }}>
                                                        {fmt(inv.remaining_amount || inv.remaining || 0)}
                                                    </td>
                                                    <td style={{ padding: "11px 16px" }}>
                                                        <span style={{
                                                            background: st.bg + "22",
                                                            color: st.color,
                                                            border: `1px solid ${st.color}44`,
                                                            borderRadius: 8, padding: "3px 10px",
                                                            fontSize: 10, fontWeight: 800, whiteSpace: "nowrap",
                                                        }}>
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

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
                                <button disabled={page <= 1}
                                    onClick={() => fetchInvoices(page - 1)}
                                    style={{
                                        background: page <= 1 ? "#1E2D3D" : "#1A3A5C",
                                        color: page <= 1 ? "#334155" : "#E2E8F0",
                                        border: "1px solid #1E2D3D", borderRadius: 10,
                                        padding: "8px 16px", cursor: page <= 1 ? "not-allowed" : "pointer",
                                        fontWeight: 800, fontSize: 12,
                                    }}>← Prev</button>

                                {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                                    const p = i + 1;
                                    return (
                                        <button key={p} onClick={() => fetchInvoices(p)}
                                            style={{
                                                background: page === p ? "#E8890A" : "#1A3A5C",
                                                color: "#fff", border: "none", borderRadius: 10,
                                                padding: "8px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12,
                                            }}>{p}</button>
                                    );
                                })}

                                <button disabled={page >= totalPages}
                                    onClick={() => fetchInvoices(page + 1)}
                                    style={{
                                        background: page >= totalPages ? "#1E2D3D" : "#1A3A5C",
                                        color: page >= totalPages ? "#334155" : "#E2E8F0",
                                        border: "1px solid #1E2D3D", borderRadius: 10,
                                        padding: "8px 16px", cursor: page >= totalPages ? "not-allowed" : "pointer",
                                        fontWeight: 800, fontSize: 12,
                                    }}>Next →</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        * { box-sizing: border-box; }
      `}</style>
        </div>
    );
}
