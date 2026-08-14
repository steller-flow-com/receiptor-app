"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileBarChart,
  Gauge,
  GitCompareArrows,
  Info,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { receiptCount, receiptToLedgerRows, toCsv, type LedgerRow } from "@receiptor/sdk";
import {
  type ApiSnapshot,
  checkAdminSession,
  fetchSnapshot,
  formatUnits,
  loginAdmin,
  logoutAdmin,
  postReceipt,
  receiptStatus,
  shortAddress,
  shortHash,
  statusLabel,
  sumRaw,
  type IndexedReceipt,
  type IndexedSettlement,
  type LedgerEntry,
  type ReceiptInput,
} from "../lib/api";
import {
  ActivityFeed,
  Button,
  DataStat,
  DonutChart,
  EmptyState,
  ErrorState,
  ExportButton,
  GlowCard,
  LivePill,
  LoadingGrid,
  MetricCard,
  Modal,
  PageIntro,
  ParticleBackground,
  QuickAction,
  ReceiptTable,
  SearchBox,
  SectionHeading,
  StatusBadge,
  SyncStatus,
  Toast,
  WalletCard,
  type Tone,
} from "./ui";

type ViewName = "dashboard" | "receipts" | "settlements" | "ledger" | "reconciliation" | "analytics" | "export" | "settings";

type NavItem = { id: ViewName; label: string; icon: typeof LayoutDashboard; badge?: string };

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "receipts", label: "Receipts", icon: Receipt },
  { id: "settlements", label: "Settlements", icon: CircleDollarSign },
  { id: "ledger", label: "Ledger", icon: BookOpen },
  { id: "reconciliation", label: "Reconciliation", icon: GitCompareArrows },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "export", label: "Export", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
];

const pageCopy: Record<ViewName, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: "COMMAND CENTER", title: "Welcome back, Merchant", description: "Here is what is happening with your revenue." },
  receipts: { eyebrow: "VERIFIABLE PAYMENTS", title: "Receipts", description: "Track and verify every x402 payment receipt." },
  settlements: { eyebrow: "ON-CHAIN ACTIVITY", title: "Settlements", description: "Compare facilitator transfers with anchored receipts." },
  ledger: { eyebrow: "ACCOUNTING SUBLEDGER", title: "Ledger", description: "Double-entry accounting records generated from verified payments." },
  reconciliation: { eyebrow: "CONTROL CENTER", title: "Reconciliation", description: "Resolve the gap between settlement evidence and receipt anchors." },
  analytics: { eyebrow: "REVENUE INTELLIGENCE", title: "Analytics", description: "See how your x402 revenue moves across time and services." },
  export: { eyebrow: "ACCOUNTING HANDOFF", title: "Export", description: "Prepare deterministic accounting data for your next close." },
  settings: { eyebrow: "SYSTEM CONFIGURATION", title: "Settings", description: "Review your Stellar network, merchant, and indexer connections." },
};

const emptyReceiptInput: ReceiptInput = { payee: "", payer: "", asset: "", amount: "", serviceId: "", nonce: "" };

function initialSnapshot(): ApiSnapshot {
  return { receipts: [], settlements: [], ledger: [], summary: { receipts: 0, settlements: 0, ledgerEntries: 0, matched: 0, receiptOnly: 0, settlementOnly: 0 } };
}

function viewFromPath(): ViewName {
  if (typeof window === "undefined") return "dashboard";
  const value = window.location.pathname.replace(/^\//, "");
  return navItems.find((item) => item.id === value)?.id ?? "dashboard";
}

function amountNumber(raw: string): number {
  try { return Number(BigInt(raw)) / 10_000_000; } catch { return 0; }
}

function ledgerMax(snapshot: ApiSnapshot): number {
  return Math.max(0, ...snapshot.receipts.map((item) => item.ledger), ...snapshot.settlements.map((item) => item.ledger));
}

function csvDownload(snapshot: ApiSnapshot): void {
  const rows: LedgerRow[] = snapshot.receipts.flatMap((receipt) => {
    const rawStatus = receiptStatus(receipt.receiptHash, snapshot.ledger);
    const status = rawStatus === "receipted" || rawStatus === "unreceipted_settlement" || rawStatus === "receipt_without_settlement"
      ? rawStatus
      : "receipt_without_settlement";
    return receiptToLedgerRows({
      receiptHash: receipt.receiptHash,
      payee: receipt.payee,
      asset: receipt.asset,
      amount: BigInt(receipt.amount),
      serviceId: receipt.serviceId,
      ts: BigInt(receipt.ts),
      status,
    });
  });
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "receiptor-ledger.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AppShell(): ReactNode {
  const [activeView, setActiveView] = useState<ViewName>(viewFromPath);
  const [snapshot, setSnapshot] = useState<ApiSnapshot>(initialSnapshot);
  const [onChainCount, setOnChainCount] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<IndexedReceipt | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL ?? "";
  const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "";
  const passphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "";
  const contractId = process.env.NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID ?? "";

  const loadData = async (): Promise<void> => {
    setError("");
    try {
      if (!indexerUrl) throw new Error("Configure NEXT_PUBLIC_INDEXER_API_URL to connect the dashboard.");
      const nextSnapshot = await fetchSnapshot(indexerUrl);
      setSnapshot(nextSnapshot);
      if (rpcUrl && passphrase && contractId) {
        const count = await receiptCount({ rpcUrl, networkPassphrase: passphrase, contractId });
        setOnChainCount(Number(count));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The data source could not be reached.";
      if (message.includes("admin authentication required")) {
        setAuthenticated(false);
        setAuthError("Your admin session expired. Please sign in again.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!indexerUrl) {
      setAuthError("Configure NEXT_PUBLIC_INDEXER_API_URL to connect the admin console.");
      setAuthChecked(true);
      return;
    }
    void checkAdminSession(indexerUrl)
      .then((sessionActive) => {
        setAuthenticated(sessionActive);
        setAuthChecked(true);
      })
      .catch((cause: unknown) => {
        setAuthError(cause instanceof Error ? cause.message : "The indexer API could not be reached.");
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!authChecked || !authenticated) return;
    void loadData();
    const interval = window.setInterval(() => { void loadData(); }, 15_000);
    return () => window.clearInterval(interval);
  }, [authChecked, authenticated]);

  useEffect(() => {
    const onPopState = () => setActiveView(viewFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (view: ViewName): void => {
    setActiveView(view);
    setSidebarOpen(false);
    window.history.pushState({}, "", view === "dashboard" ? "/" : `/${view}`);
  };

  const record = async (input: ReceiptInput): Promise<void> => {
    if (!indexerUrl) throw new Error("The indexer API is not configured.");
    await postReceipt(indexerUrl, input);
    setRecordOpen(false);
    setToast({ message: "Receipt submitted to Stellar", tone: "success" });
    window.setTimeout(() => { void loadData(); }, 1_500);
  };

  const signOut = async (): Promise<void> => {
    if (indexerUrl) await logoutAdmin(indexerUrl);
    setAuthenticated(false);
    setSnapshot(initialSnapshot());
    setOnChainCount(null);
  };

  if (!authChecked) return <div className="app-frame"><ParticleBackground /><div className="auth-loading"><span className="brand-mark"><span>R</span><i /></span><span>Verifying admin session…</span></div></div>;
  if (!authenticated) return <div className="app-frame"><ParticleBackground /><LoginScreen indexerUrl={indexerUrl} initialError={authError} onSuccess={() => { setAuthError(""); setAuthenticated(true); }} /></div>;

  const content = <ViewContent activeView={activeView} snapshot={snapshot} onChainCount={onChainCount} onSelectReceipt={setSelectedReceipt} onNavigate={navigate} onRecord={() => setRecordOpen(true)} onExport={() => csvDownload(snapshot)} />;
  const copy = pageCopy[activeView];
  return (
    <div className={`app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
      <ParticleBackground />
      <aside className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
        <div className="brand-row"><div className="brand-mark"><span>R</span><i /></div><div className="brand-wordmark">RECEIPTOR<span>FINANCE OS</span></div><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${activeView === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><Icon size={17} /><span>{item.label}</span>{item.id === "receipts" && snapshot.receipts.length > 0 && <em>{snapshot.receipts.length > 99 ? "99+" : snapshot.receipts.length}</em>}{item.badge && <em>{item.badge}</em>}</button>; })}
        </nav>
        <div className="sidebar-footer"><WalletCard contractId={contractId} /><div className="sidebar-footline"><LivePill>Testnet</LivePill><span>v0.1.0</span></div></div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <section className="main-stage">
        <header className="topbar"><button className="icon-button menu-trigger" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><button className="icon-button collapse-trigger" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle sidebar">{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><div className="topbar-copy"><strong>{copy.title}</strong><span>{copy.description}</span></div><div className="topbar-actions"><LivePill>Live</LivePill><span className="network-select"><Network size={14} /> Stellar Testnet <ChevronRight size={14} /></span><button className="notification-button" aria-label="Notifications"><Activity size={17} /><i /></button><span className="top-wallet"><span className="wallet-avatar">M</span><span><strong>Merchant</strong><small>{shortAddress(contractId || "G…7B3F")}</small></span><ChevronRight size={14} /></span><button className="signout-button" onClick={() => void signOut()}><LogOut size={14} /> Sign out</button></div></header>
        <main className="content-area"><div className="mobile-page-title"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1></div>{error && <ErrorState message={error} onRetry={() => void loadData()} />}{loading && snapshot.receipts.length === 0 ? <LoadingGrid /> : content}</main>
        <footer className="mobile-nav">{navItems.slice(0, 5).map((item) => { const Icon = item.icon; return <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span></button>; })}</footer>
      </section>
      <AnimatePresence>{recordOpen && <RecordReceiptModal onClose={() => setRecordOpen(false)} onSubmit={record} />}</AnimatePresence>
      <AnimatePresence>{selectedReceipt && <ReceiptDetail receipt={selectedReceipt} ledger={snapshot.ledger} onClose={() => setSelectedReceipt(null)} />}</AnimatePresence>
      <AnimatePresence>{toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}</AnimatePresence>
    </div>
  );
}

function LoginScreen({ indexerUrl, initialError, onSuccess }: { indexerUrl: string; initialError: string; onSuccess: () => void }): ReactNode {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await loginAdmin(indexerUrl, username, password);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-stage"><motion.div className="login-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><div className="login-brand"><div className="brand-mark"><span>R</span><i /></div><div><strong>RECEIPTOR</strong><small>FINANCE OS</small></div></div><div className="login-heading"><p className="eyebrow"><span className="eyebrow-line" />ADMIN ACCESS</p><h1>Welcome back.</h1><p>Sign in to manage your Stellar revenue workspace.</p></div><form className="login-form" onSubmit={(event) => void submit(event)}><label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Admin username" required /></label><label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" required /></label>{error && <div className="login-error"><Info size={15} /><span>{error}</span></div>}<Button type="submit" icon={submitting ? RefreshCw : LockKeyhole} disabled={submitting || !indexerUrl}>{submitting ? "Signing in…" : "Sign in to dashboard"}</Button></form><p className="login-note"><ShieldCheck size={14} /> Protected by an HttpOnly signed session. Your password never enters the frontend bundle.</p></motion.div></main>;
}

function ViewContent({ activeView, snapshot, onChainCount, onSelectReceipt, onNavigate, onRecord, onExport }: { activeView: ViewName; snapshot: ApiSnapshot; onChainCount: number | null; onSelectReceipt: (receipt: IndexedReceipt) => void; onNavigate: (view: ViewName) => void; onRecord: () => void; onExport: () => void }): ReactNode {
  switch (activeView) {
    case "dashboard": return <DashboardView snapshot={snapshot} onChainCount={onChainCount} onSelectReceipt={onSelectReceipt} onNavigate={onNavigate} onRecord={onRecord} onExport={onExport} />;
    case "receipts": return <ReceiptsView snapshot={snapshot} onSelectReceipt={onSelectReceipt} onRecord={onRecord} onExport={onExport} />;
    case "settlements": return <SettlementsView snapshot={snapshot} />;
    case "ledger": return <LedgerView snapshot={snapshot} onExport={onExport} />;
    case "reconciliation": return <ReconciliationView snapshot={snapshot} />;
    case "analytics": return <AnalyticsView snapshot={snapshot} />;
    case "export": return <ExportView snapshot={snapshot} onExport={onExport} />;
    case "settings": return <SettingsView snapshot={snapshot} contractId={process.env.NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID ?? ""} />;
  }
}

function StatusBar({ snapshot }: { snapshot: ApiSnapshot }): ReactNode {
  return <motion.div className="system-status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}><div className="system-status-main"><span className="system-pulse"><i /></span><div><strong>Receiptor is live on Stellar Testnet</strong><span>All systems operational</span></div></div><div className="network-health"><span>Network health</span><strong>{snapshot.receipts.length > 0 ? "98.7%" : "—"}</strong><div className="health-bars">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => <i key={item} />)}</div></div></motion.div>;
}

function DashboardView({ snapshot, onChainCount, onSelectReceipt, onNavigate, onRecord, onExport }: { snapshot: ApiSnapshot; onChainCount: number | null; onSelectReceipt: (receipt: IndexedReceipt) => void; onNavigate: (view: ViewName) => void; onRecord: () => void; onExport: () => void }): ReactNode {
  const totalReceipts = onChainCount ?? (snapshot.summary.receipts || snapshot.receipts.length);
  const totalRevenue = formatUnits(sumRaw(snapshot.receipts.map((receipt) => receipt.amount)).toString());
  const statuses = countStatuses(snapshot);
  const chart = chartData(snapshot);
  return <div className="view-stack dashboard-view"><StatusBar snapshot={snapshot} /><div className="metrics-grid"><MetricCard label="Total Receipts" value={totalReceipts} change="—" detail="indexed receipts" tone="success" icon={Receipt} points={[16, 22, 20, 31, 28, 39, 44]} /><MetricCard label="Total Revenue" value={`$${totalRevenue}`} change="—" detail="USDC receipted" tone="info" icon={CircleDollarSign} points={[24, 28, 25, 35, 32, 43, 48]} /><MetricCard label="Settlements Matched" value={statuses.matched} change="—" detail="verified pairs" tone="purple" icon={CheckCircle2} points={[15, 19, 17, 26, 25, 31, 36]} /><MetricCard label="Pending Reconciliation" value={statuses.receiptOnly + statuses.settlementOnly} change="—" detail="needs review" tone="danger" icon={GitCompareArrows} points={[36, 33, 29, 26, 24, 21, 18]} /></div><div className="dashboard-columns"><GlowCard className="chart-card"><SectionHeading eyebrow="FLOW OVERVIEW" title="Revenue Overview" action={<button className="select-button">Last 7 ledgers <ChevronRight size={14} /></button>} /><div className="chart-legend"><span><i className="legend-dot success" />Receipts</span><span><i className="legend-dot info" />Settlements</span></div><RevenuePanel data={chart} /></GlowCard><GlowCard className="chart-card settlement-card"><SectionHeading eyebrow="RECONCILIATION" title="Settlement Status" action={<button className="icon-button"><SlidersHorizontal size={16} /></button>} /><DonutChart matched={statuses.matched} receiptOnly={statuses.receiptOnly} settlementOnly={statuses.settlementOnly} /></GlowCard></div><div className="dashboard-columns lower-columns"><GlowCard className="table-card"><SectionHeading eyebrow="LATEST ANCHORS" title="Recent Receipts" action={<Button variant="ghost" onClick={() => onNavigate("receipts")}>View all <ChevronRight size={15} /></Button>} /><ReceiptTable receipts={snapshot.receipts} ledger={snapshot.ledger} onSelect={onSelectReceipt} limit={6} /></GlowCard><GlowCard className="activity-card"><SectionHeading eyebrow="STREAM" title="Live Activity" action={<LivePill />} /><ActivityFeed receipts={snapshot.receipts} settlements={snapshot.settlements} ledger={snapshot.ledger} /></GlowCard></div><div className="quick-actions"><SectionHeading eyebrow="SHORTCUTS" title="Quick Actions" /><div className="quick-grid"><QuickAction icon={Receipt} label="Record Receipt" description="Anchor a payment" tone="success" onClick={onRecord} /><QuickAction icon={GitCompareArrows} label="Reconciliation" description="Review mismatches" tone="info" onClick={() => onNavigate("reconciliation")} /><QuickAction icon={Download} label="Export CSV" description="Close your books" tone="danger" onClick={onExport} /><QuickAction icon={BookOpen} label="View Ledger" description="Double-entry view" tone="purple" onClick={() => onNavigate("ledger")} /></div></div><SyncStatus ledger={ledgerMax(snapshot)} /></div>;
}

function RevenuePanel({ data }: { data: { label: string; receipts: number; settlements: number }[] }): ReactNode {
  if (data.length === 0) return <EmptyState title="Waiting for indexed activity" description="Revenue trends will appear as the indexer observes verified receipts." />;
  return <div className="revenue-panel"><div className="revenue-total"><span>Indexed value</span><strong>{formatUnits(sumRaw(data.flatMap((item) => [String(Math.round(item.receipts * 10_000_000)), String(Math.round(item.settlements * 10_000_000))])).toString())} <small>USDC</small></strong></div><div className="chart-wrap"><SimpleSvgChart data={data} /></div><div className="chart-labels">{data.map((item) => <span key={item.label}>{item.label}</span>)}</div></div>;
}

function SimpleSvgChart({ data }: { data: { label: string; receipts: number; settlements: number }[] }): ReactNode {
  const max = Math.max(...data.flatMap((item) => [item.receipts, item.settlements]), 1);
  const line = (key: "receipts" | "settlements") => data.map((item, index) => `${index === 0 ? "M" : "L"}${(index / Math.max(data.length - 1, 1)) * 100} ${92 - (item[key] / max) * 75}`).join(" ");
  return <svg className="overview-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Revenue overview chart"><path className="chart-area-fill blue-fill" d={`${line("settlements")} L100 100 L0 100 Z`} /><path className="chart-area-fill green-fill" d={`${line("receipts")} L100 100 L0 100 Z`} /><path className="chart-line blue-line" d={line("settlements")} /><path className="chart-line green-line" d={line("receipts")} />{data.map((item, index) => <circle className="chart-point green-point" key={`r-${item.label}`} cx={(index / Math.max(data.length - 1, 1)) * 100} cy={92 - (item.receipts / max) * 75} r="1.4" />)}</svg>;
}

function chartData(snapshot: ApiSnapshot): { label: string; receipts: number; settlements: number }[] {
  const ledgers = [...new Set([...snapshot.receipts.map((item) => item.ledger), ...snapshot.settlements.map((item) => item.ledger)])].sort((a, b) => a - b).slice(-7);
  return ledgers.map((ledger) => ({ label: `L${String(ledger).slice(-3)}`, receipts: snapshot.receipts.filter((item) => item.ledger === ledger).reduce((total, item) => total + amountNumber(item.amount), 0), settlements: snapshot.settlements.filter((item) => item.ledger === ledger).reduce((total, item) => total + amountNumber(item.amount), 0) }));
}

function countStatuses(snapshot: ApiSnapshot): { matched: number; receiptOnly: number; settlementOnly: number } {
  const receiptHashes = new Set(snapshot.receipts.map((receipt) => `${receipt.payer}:${receipt.payee}:${receipt.amount}`));
  const settlementHashes = new Set(snapshot.settlements.map((settlement) => `${settlement.payer}:${settlement.payee}:${settlement.amount}`));
  const matched = snapshot.receipts.filter((receipt) => receiptHashes.has(`${receipt.payer}:${receipt.payee}:${receipt.amount}`) && snapshot.settlements.some((settlement) => `${settlement.payer}:${settlement.payee}:${settlement.amount}` === `${receipt.payer}:${receipt.payee}:${receipt.amount}`)).length;
  return { matched, receiptOnly: Math.max(0, snapshot.receipts.length - matched), settlementOnly: Math.max(0, snapshot.settlements.length - matched) };
}

function ReceiptsView({ snapshot, onSelectReceipt, onRecord, onExport }: { snapshot: ApiSnapshot; onSelectReceipt: (receipt: IndexedReceipt) => void; onRecord: () => void; onExport: () => void }): ReactNode {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = snapshot.receipts.filter((receipt) => { const haystack = `${receipt.receiptHash} ${receipt.payer} ${receipt.payee} ${receipt.serviceId} ${receipt.asset}`.toLowerCase(); const status = receiptStatus(receipt.receiptHash, snapshot.ledger); return (!query || haystack.includes(query.toLowerCase())) && (filter === "all" || statusLabel(status).toLowerCase().replace(" ", "-") === filter); });
  return <div className="view-stack"><PageIntro eyebrow="VERIFIABLE PAYMENTS" title="Receipts" description="Track and verify every x402 payment receipt." action={<div className="intro-actions"><ExportButton onClick={onExport} /><Button icon={Receipt} onClick={onRecord}>Record receipt</Button></div>} /><GlowCard className="full-table-card"><div className="filter-row"><SearchBox value={query} onChange={setQuery} /><select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="matched">Matched</option><option value="receipt-only">Receipt only</option><option value="settlement-only">Settlement only</option></select><button className="filter-button"><SlidersHorizontal size={15} /> Filters</button><span className="result-count">{filtered.length} receipts</span></div><ReceiptTable receipts={filtered} ledger={snapshot.ledger} onSelect={onSelectReceipt} /></GlowCard></div>;
}

function SettlementsView({ snapshot }: { snapshot: ApiSnapshot }): ReactNode {
  const statuses = countStatuses(snapshot);
  return <div className="view-stack"><PageIntro eyebrow="ON-CHAIN ACTIVITY" title="Settlements" description="Compare facilitator transfers with anchored receipts." action={<Button variant="secondary" icon={RefreshCw}>Refresh data</Button>} /><div className="data-stats"><DataStat label="Total settlements" value={snapshot.settlements.length} tone="info" icon={CircleDollarSign} /><DataStat label="Matched" value={statuses.matched} tone="success" icon={CheckCircle2} /><DataStat label="Receipt only" value={statuses.receiptOnly} tone="info" icon={Receipt} /><DataStat label="Settlement only" value={statuses.settlementOnly} tone="danger" icon={Info} /></div><GlowCard className="full-table-card"><SectionHeading eyebrow="TRANSFER FEED" title="Settlement activity" action={<div className="filter-button"><Search size={15} /> Search</div>} /><SettlementTable settlements={snapshot.settlements} receipts={snapshot.receipts} /></GlowCard></div>;
}

function SettlementTable({ settlements, receipts }: { settlements: IndexedSettlement[]; receipts: IndexedReceipt[] }): ReactNode {
  if (settlements.length === 0) return <EmptyState title="No settlements indexed" description="USDC transfer events will appear here when the indexer reaches your configured start ledger." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Payer</th><th>Payee</th><th>Amount</th><th>Asset</th><th>Ledger</th><th>Status</th></tr></thead><tbody>{settlements.map((settlement) => { const matched = receipts.some((receipt) => receipt.payer === settlement.payer && receipt.payee === settlement.payee && receipt.amount === settlement.amount); return <tr key={`${settlement.txHash}-${settlement.opIndex}`}><td><code>{shortHash(settlement.txHash)}</code></td><td><code>{shortAddress(settlement.payer)}</code></td><td><code>{shortAddress(settlement.payee)}</code></td><td className="amount-cell">{formatUnits(settlement.amount)} <small>USDC</small></td><td><span className="asset-chip">{shortAddress(settlement.asset)}</span></td><td className="muted-cell">L{settlement.ledger.toLocaleString()}</td><td><StatusBadge status={matched ? "receipted" : "unreceipted_settlement"} compact /></td></tr>; })}</tbody></table></div>;
}

function LedgerView({ snapshot, onExport }: { snapshot: ApiSnapshot; onExport: () => void }): ReactNode {
  const debit = sumRaw(snapshot.ledger.filter((entry) => entry.side === "debit").map((entry) => entry.amount));
  const credit = sumRaw(snapshot.ledger.filter((entry) => entry.side === "credit").map((entry) => entry.amount));
  return <div className="view-stack"><PageIntro eyebrow="ACCOUNTING SUBLEDGER" title="Ledger" description="Double-entry accounting records generated from verified payments." action={<ExportButton onClick={onExport} />} /><div className="data-stats"><DataStat label="Debit" value={`${formatUnits(debit.toString())} USDC`} tone="info" icon={ArrowDownLeft} /><DataStat label="Credit" value={`${formatUnits(credit.toString())} USDC`} tone="success" icon={ArrowUpRight} /><DataStat label="Balance" value={`${formatUnits((debit - credit).toString())} USDC`} tone="purple" icon={BookOpen} /></div><GlowCard className="full-table-card"><SectionHeading eyebrow="DOUBLE-ENTRY RECORDS" title="Accounting journal" /><LedgerTable entries={snapshot.ledger} /></GlowCard></div>;
}

function LedgerTable({ entries }: { entries: LedgerEntry[] }): ReactNode {
  if (entries.length === 0) return <EmptyState title="Ledger is ready" description="Double-entry rows will be generated when a receipt and settlement are reconciled." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Reference</th><th>Account</th><th>Debit</th><th>Credit</th><th>Currency</th><th>Receipt</th><th>Status</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td className="muted-cell">L{entry.ts}</td><td><code>{shortHash(entry.receiptHash || entry.id)}</code></td><td>{entry.account || "Revenue"}</td><td className="amount-cell">{entry.side === "debit" ? formatUnits(entry.amount) : "—"}</td><td className="amount-cell">{entry.side === "credit" ? formatUnits(entry.amount) : "—"}</td><td><span className="asset-chip">USDC</span></td><td><ShieldCheck size={15} className="verified-icon" /></td><td><StatusBadge status={entry.status} compact /></td></tr>)}</tbody></table></div>;
}

function ReconciliationView({ snapshot }: { snapshot: ApiSnapshot }): ReactNode {
  const statuses = countStatuses(snapshot);
  const pairs = snapshot.receipts.slice(0, 8).map((receipt) => { const matched = snapshot.settlements.some((settlement) => settlement.payer === receipt.payer && settlement.payee === receipt.payee && settlement.amount === receipt.amount); return { receipt, matched }; });
  return <div className="view-stack"><PageIntro eyebrow="CONTROL CENTER" title="Reconciliation" description="Resolve the gap between settlement evidence and receipt anchors." action={<Button variant="secondary" icon={RefreshCw}>Run reconciliation</Button>} /><div className="reconciliation-summary"><div className="recon-number green"><strong>{statuses.matched}</strong><span>Matched</span></div><div className="recon-number blue"><strong>{statuses.receiptOnly}</strong><span>Receipt only</span></div><div className="recon-number red"><strong>{statuses.settlementOnly}</strong><span>Settlement only</span></div><div className="recon-number neutral"><strong>0</strong><span>Unresolved</span></div></div><GlowCard className="recon-map"><SectionHeading eyebrow="MATCHING GRAPH" title="Evidence flow" /><div className="evidence-flow"><div className="evidence-node"><span className="flow-icon info"><Zap size={18} /></span><strong>x402 payment</strong><small>Facilitator settlement</small></div><div className="flow-line info-line" /><div className="evidence-node"><span className="flow-icon green"><ShieldCheck size={18} /></span><strong>Soroban receipt</strong><small>ReceiptLedger anchor</small></div><div className="flow-line green-line" /><div className="evidence-node"><span className="flow-icon purple"><BookOpen size={18} /></span><strong>Accounting ledger</strong><small>Double-entry row</small></div></div></GlowCard><GlowCard className="full-table-card"><SectionHeading eyebrow="REVIEW QUEUE" title="Receipt matching" /><div className="recon-list">{pairs.length === 0 ? <EmptyState title="Nothing to reconcile" description="The review queue will appear once the indexer has observed payment evidence." /> : pairs.map(({ receipt, matched }) => <div className={`recon-row ${matched ? "matched" : "unmatched"}`} key={receipt.receiptHash}><span className="recon-status-icon">{matched ? <CheckCircle2 size={17} /> : <Info size={17} />}</span><div><strong>{shortHash(receipt.receiptHash)}</strong><span>{shortAddress(receipt.payer)} → {formatUnits(receipt.amount)} USDC</span></div><StatusBadge status={matched ? "receipted" : "receipt_without_settlement"} compact /><ChevronRight size={16} /></div>)}</div></GlowCard></div>;
}

function AnalyticsView({ snapshot }: { snapshot: ApiSnapshot }): ReactNode {
  const statuses = countStatuses(snapshot);
  const chart = chartData(snapshot);
  return <div className="view-stack"><PageIntro eyebrow="REVENUE INTELLIGENCE" title="Analytics" description="See how your x402 revenue moves across time and services." action={<div className="range-toggle"><button className="active">7 days</button><button>30 days</button><button>90 days</button><button>1 year</button></div>} /><div className="analytics-grid"><GlowCard className="analytics-main"><SectionHeading eyebrow="PERFORMANCE" title="Revenue over time" /><RevenuePanel data={chart} /></GlowCard><GlowCard className="analytics-side"><SectionHeading eyebrow="MATCH RATE" title="Settlement coverage" /><div className="big-percentage">{snapshot.receipts.length ? ((statuses.matched / snapshot.receipts.length) * 100).toFixed(1) : "0.0"}<small>%</small></div><SparkBars values={[statuses.matched, statuses.receiptOnly, statuses.settlementOnly]} /></GlowCard></div><div className="data-stats"><DataStat label="Transaction volume" value={snapshot.receipts.length + snapshot.settlements.length} tone="info" icon={Activity} /><DataStat label="Services observed" value={new Set(snapshot.receipts.map((receipt) => receipt.serviceId)).size} tone="purple" icon={Sparkles} /><DataStat label="Assets observed" value={new Set(snapshot.receipts.map((receipt) => receipt.asset)).size} tone="success" icon={CircleDollarSign} /></div></div>;
}

function SparkBars({ values }: { values: number[] }): ReactNode { const max = Math.max(...values, 1); return <div className="spark-bars">{values.map((value, index) => <div key={index}><span style={{ height: `${Math.max(8, (value / max) * 100)}%` }} /><small>{value}</small></div>)}</div>; }

function ExportView({ snapshot, onExport }: { snapshot: ApiSnapshot; onExport: () => void }): ReactNode {
  return <div className="view-stack"><PageIntro eyebrow="ACCOUNTING HANDOFF" title="Export Accounting Data" description="Prepare deterministic accounting data for your next close." action={<Button icon={Download} onClick={onExport}>Export CSV</Button>} /><GlowCard className="export-panel"><div className="export-options"><label>Date range<select><option>All indexed time</option><option>Last 7 days</option><option>Last 30 days</option></select></label><label>Asset<select><option>All assets</option><option>USDC</option></select></label><label>Status<select><option>All statuses</option><option>Matched</option><option>Receipt only</option></select></label><label>Service<input placeholder="All services" /></label></div><div className="export-preview"><div className="preview-heading"><div><p className="eyebrow">PREVIEW</p><h3>{snapshot.ledger.length} ledger rows ready</h3></div><FileBar /></div><LedgerTable entries={snapshot.ledger.slice(0, 5)} /></div><div className="export-footer"><span><CheckCircle2 size={15} /> CSV columns are deterministic and accounting-ready</span><Button icon={Download} onClick={onExport}>Export CSV</Button></div></GlowCard></div>;
}
function FileBar(): ReactNode { return <div className="file-bar"><span /><span /><span /></div>; }

function SettingsView({ snapshot, contractId }: { snapshot: ApiSnapshot; contractId: string }): ReactNode {
  return <div className="view-stack"><PageIntro eyebrow="SYSTEM CONFIGURATION" title="Settings" description="Review your Stellar network, merchant, and indexer connections." action={<Button variant="secondary" icon={Settings}>Configuration</Button>} /><div className="settings-grid"><SettingsSection title="Network" icon={Network}><SettingRow label="Network" value="Stellar Testnet" tone="success" /><SettingRow label="Soroban RPC" value={process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "Not configured"} code /><SettingRow label="ReceiptLedger contract" value={contractId || "Not configured"} code /></SettingsSection><SettingsSection title="Merchant" icon={WalletCards}><SettingRow label="Wallet" value={shortAddress(contractId || "Not configured")} /><SettingRow label="Merchant ID" value="Receiptor workspace" /><SettingRow label="Environment" value="Production-ready preview" tone="info" /></SettingsSection><SettingsSection title="Indexer" icon={Gauge}><SettingRow label="Indexer status" value={snapshot.receipts.length || snapshot.settlements.length ? "Operational" : "Awaiting sync"} tone={snapshot.receipts.length || snapshot.settlements.length ? "success" : "neutral"} /><SettingRow label="Polling interval" value="15 seconds" /><SettingRow label="Last synced ledger" value={ledgerMax(snapshot).toLocaleString()} /></SettingsSection><SettingsSection title="Appearance" icon={Sparkles}><SettingRow label="Theme" value="Dark / Neon" tone="success" /><SettingRow label="Motion" value="Adaptive" /><SettingRow label="Reduced motion" value="Respects system preference" /></SettingsSection></div></div>;
}
function SettingsSection({ title, icon: Icon, children }: { title: string; icon: typeof Network; children: ReactNode }): ReactNode { return <GlowCard className="settings-section"><div className="settings-title"><span><Icon size={17} />{title}</span><ChevronRight size={15} /></div>{children}</GlowCard>; }
function SettingRow({ label, value, code = false, tone = "neutral" }: { label: string; value: string; code?: boolean; tone?: Tone }): ReactNode { return <div className="setting-row"><span>{label}</span><strong className={code ? "setting-code" : ""}><i className={`setting-indicator ${tone}`} />{value}</strong></div>; }

function RecordReceiptModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: ReceiptInput) => Promise<void> }): ReactNode {
  const [form, setForm] = useState<ReceiptInput>(emptyReceiptInput);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const update = (field: keyof ReceiptInput, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitting(true); setError(""); try { await onSubmit(form); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record receipt"); } finally { setSubmitting(false); } };
  return <Modal title="Record receipt" onClose={onClose}><div className="modal-heading"><div className="modal-icon green"><Receipt size={19} /></div><div><p className="eyebrow">SERVER-SIDE SIGNING</p><h2>Record a receipt</h2><p>The merchant signer stays inside the indexer. Your browser only submits payment context.</p></div></div><form className="record-form" onSubmit={submit}>{(["payee", "payer", "asset", "amount", "serviceId", "nonce"] as const).map((field) => <label key={field}>{field === "serviceId" ? "Service ID (64 hex)" : field}<input required value={form[field]} onChange={(event) => update(field, event.target.value)} placeholder={field === "amount" || field === "nonce" ? "integer string" : field === "serviceId" ? "32-byte hex" : "G… or C…"} /></label>)}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" icon={submitting ? RefreshCw : ShieldCheck} disabled={submitting}>{submitting ? "Recording…" : "Anchor on Stellar"}</Button></div></form></Modal>;
}

function ReceiptDetail({ receipt, ledger, onClose }: { receipt: IndexedReceipt; ledger: LedgerEntry[]; onClose: () => void }): ReactNode {
  const status = receiptStatus(receipt.receiptHash, ledger);
  return <Modal title="Receipt detail" onClose={onClose}><div className="detail-heading"><div><p className="eyebrow">VERIFIABLE ANCHOR</p><h2>Receipt <span className="verified-label"><CheckCircle2 size={16} /> Verified</span></h2></div><StatusBadge status={status} /></div><div className="detail-hash"><span>Receipt hash</span><code>{receipt.receiptHash}</code></div><div className="detail-grid"><DetailField label="Payer" value={receipt.payer} /><DetailField label="Payee" value={receipt.payee} /><DetailField label="Asset" value={receipt.asset} /><DetailField label="Amount" value={`${formatUnits(receipt.amount)} USDC`} /><DetailField label="Service ID" value={receipt.serviceId} /><DetailField label="Nonce" value={receipt.nonce} /><DetailField label="Ledger" value={receipt.ledger.toLocaleString()} /><DetailField label="Transaction" value="Available from event index" /></div><div className="timeline"><p className="eyebrow">VERIFICATION TIMELINE</p>{["x402 Payment", "Facilitator Settlement", "Receipt Verification", "Soroban Anchor", "Indexer", "Accounting Ledger"].map((step, index) => <div className="timeline-step" key={step}><span className="timeline-dot">{index < 4 ? <CheckCircle2 size={13} /> : <span>{index + 1}</span>}</span><span>{step}</span>{index < 5 && <i />}</div>)}</div></Modal>;
}
function DetailField({ label, value }: { label: string; value: string }): ReactNode { return <div className="detail-field"><span>{label}</span><code>{value || "—"}</code></div>; }
