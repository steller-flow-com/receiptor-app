"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Landmark,
  LoaderCircle,
  LucideIcon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUnits, shortAddress, shortHash, statusLabel, statusTone } from "../lib/api";

export type Tone = "success" | "info" | "danger" | "neutral" | "purple";

export function ParticleBackground(): ReactNode {
  const particles = Array.from({ length: 18 }, (_, index) => index);
  return (
    <div className="particle-field" aria-hidden="true">
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />
      <div className="ambient-orb orb-three" />
      <div className="grid-glow" />
      {particles.map((particle) => (
        <span
          className={`particle particle-${particle % 3 === 0 ? "green" : particle % 3 === 1 ? "blue" : "red"}`}
          key={particle}
          style={{
            left: `${(particle * 37) % 100}%`,
            top: `${(particle * 53) % 100}%`,
            animationDelay: `${particle * -0.7}s`,
            animationDuration: `${11 + (particle % 5) * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

export function GlowCard({ children, className = "", tone = "neutral", onClick }: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  onClick?: () => void;
}): ReactNode {
  return (
    <motion.div
      className={`glow-card tone-${tone} ${className}`}
      whileHover={{ y: -4, scale: 1.008 }}
      transition={{ duration: 0.22 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") onClick(); } : undefined}
    >
      <div className="card-shine" />
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number | string; prefix?: string; suffix?: string }): ReactNode {
  const reducedMotion = useReducedMotion();
  const numericValue = typeof value === "number" ? value : Number(value);
  const display = Number.isFinite(numericValue) ? numericValue.toLocaleString("en-US") : String(value);
  return (
    <motion.span
      className="tabular-nums"
      key={String(value)}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {prefix}{display}{suffix}
    </motion.span>
  );
}

export function MetricCard({ label, value, change, detail, tone, icon: Icon, points }: {
  label: string;
  value: string | number;
  change: string;
  detail: string;
  tone: Tone;
  icon: LucideIcon;
  points: number[];
}): ReactNode {
  const max = Math.max(...points, 1);
  const displayValue = typeof value === "string" ? value : value.toLocaleString("en-US");
  return (
    <GlowCard tone={tone} className="metric-card">
      <div className="metric-topline">
        <span className="metric-label">{label}</span>
        <span className="metric-icon"><Icon size={17} /></span>
      </div>
      <strong className="metric-value"><motion.span key={displayValue} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>{displayValue}</motion.span></strong>
      <div className="metric-bottomline">
        <span className={`metric-change ${change.startsWith("↓") ? "negative" : ""}`}>
          {change.startsWith("↓") ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
          {change.replace(/^[↑↓]\s*/, "")}
        </span>
        <span className="metric-detail">{detail}</span>
      </div>
      <div className="mini-chart" aria-hidden="true">
        {points.map((point, index) => (
          <span key={`${point}-${index}`} style={{ height: `${Math.max(12, (point / max) * 100)}%` }} />
        ))}
      </div>
    </GlowCard>
  );
}

export function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }): ReactNode {
  const tone = statusTone(status);
  return (
    <span className={`status-badge ${tone} ${compact ? "compact" : ""}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

export function LivePill({ children = "Live" }: { children?: ReactNode }): ReactNode {
  return <span className="live-pill"><span className="live-dot" />{children}</span>;
}

export function Sparkline({ values, tone = "green" }: { values: number[]; tone?: "green" | "blue" }): ReactNode {
  const points = values.length > 1 ? values : [0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const path = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 34 - ((value - min) / range) * 28;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${path} L100 38 L0 38 Z`} className="sparkline-fill" />
      <path d={path} className="sparkline-line" />
    </svg>
  );
}

export function SectionHeading({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow"><span className="eyebrow-line" />{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Button({ children, variant = "primary", icon: Icon, onClick, type = "button", disabled = false, className = "" }: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: LucideIcon;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}): ReactNode {
  return (
    <motion.button
      type={type}
      className={`button button-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
    >
      {Icon && <Icon size={16} />}
      {children}
    </motion.button>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }): ReactNode {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Sparkles size={22} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): ReactNode {
  return (
    <div className="error-state">
      <div className="error-icon"><CircleAlert size={20} /></div>
      <div><strong>Unable to load live data</strong><p>{message}</p></div>
      <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function LoadingGrid(): ReactNode {
  return <div className="loading-grid">{[0, 1, 2, 3].map((item) => <div className="skeleton-card" key={item}><span /><span /><span /></div>)}</div>;
}

export function RevenueChart({ data }: { data: { label: string; receipts: number; settlements: number }[] }): ReactNode {
  if (data.length === 0) return <EmptyState title="Waiting for indexed activity" description="Revenue trends will appear as the indexer observes verified receipts." />;
  return (
    <div className="revenue-chart">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 12, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="receiptGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#39ff14" stopOpacity={0.35} /><stop offset="100%" stopColor="#39ff14" stopOpacity={0} /></linearGradient>
            <linearGradient id="settlementGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00c2ff" stopOpacity={0.28} /><stop offset="100%" stopColor="#00c2ff" stopOpacity={0} /></linearGradient>
          </defs>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#66747c", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#66747c", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#0b1110", border: "1px solid rgba(57,255,20,.25)", borderRadius: 10, color: "#eef7f0" }} formatter={(value: number | string) => [`${Number(value).toFixed(2)} USDC`, ""]} />
          <Area type="monotone" dataKey="settlements" stroke="#00c2ff" fill="url(#settlementGradient)" strokeWidth={2} animationDuration={1000} />
          <Area type="monotone" dataKey="receipts" stroke="#39ff14" fill="url(#receiptGradient)" strokeWidth={2} animationDuration={1200} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ matched, receiptOnly, settlementOnly }: { matched: number; receiptOnly: number; settlementOnly: number }): ReactNode {
  const total = matched + receiptOnly + settlementOnly;
  const matchedPercent = total ? (matched / total) * 100 : 0;
  const receiptPercent = total ? (receiptOnly / total) * 100 : 0;
  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(#39ff14 0 ${matchedPercent}%, #00c2ff ${matchedPercent}% ${matchedPercent + receiptPercent}%, #ff1e3c ${matchedPercent + receiptPercent}% 100%)` }}>
        <div className="donut-center"><span>Total</span><strong>{total.toLocaleString()}</strong></div>
      </div>
      <div className="donut-legend">
        <LegendLine tone="success" label="Matched" value={matched} total={total} />
        <LegendLine tone="info" label="Receipt Only" value={receiptOnly} total={total} />
        <LegendLine tone="danger" label="Settlement Only" value={settlementOnly} total={total} />
      </div>
    </div>
  );
}

function LegendLine({ tone, label, value, total }: { tone: Tone; label: string; value: number; total: number }): ReactNode {
  return <div className="legend-line"><span><i className={`legend-dot ${tone}`} />{label}</span><strong>{value.toLocaleString()} <small>({total ? ((value / total) * 100).toFixed(1) : "0.0"}%)</small></strong></div>;
}

export function ReceiptTable({ receipts, ledger, onSelect, limit }: { receipts: import("../lib/api").IndexedReceipt[]; ledger: import("../lib/api").LedgerEntry[]; onSelect: (receipt: import("../lib/api").IndexedReceipt) => void; limit?: number }): ReactNode {
  const rows = limit ? receipts.slice(0, limit) : receipts;
  if (rows.length === 0) return <EmptyState title="No receipts found" description="Your verified x402 receipts will appear here once the indexer syncs a Soroban event." />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Hash</th><th>Payer</th><th>Amount</th><th>Asset</th><th>Service ID</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>
          {rows.map((receipt, index) => {
            const status = ledger.find((entry) => entry.receiptHash === receipt.receiptHash)?.status ?? "receipt_without_settlement";
            return (
              <motion.tr key={receipt.receiptHash} onClick={() => onSelect(receipt)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }}>
                <td><code>{shortHash(receipt.receiptHash)}</code></td>
                <td><code>{shortAddress(receipt.payer)}</code></td>
                <td className="amount-cell">{formatUnits(receipt.amount)} <small>USDC</small></td>
                <td><span className="asset-chip">{shortAddress(receipt.asset)}</span></td>
                <td><span className="service-cell">{receipt.serviceId ? shortHash(receipt.serviceId) : "—"}</span></td>
                <td><StatusBadge status={status} compact /></td>
                <td className="muted-cell">{receipt.ledger ? `L${receipt.ledger.toLocaleString()}` : "—"}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ActivityFeed({ receipts, settlements, ledger }: { receipts: import("../lib/api").IndexedReceipt[]; settlements: import("../lib/api").IndexedSettlement[]; ledger: import("../lib/api").LedgerEntry[] }): ReactNode {
  const receiptItems = receipts.slice(0, 4).map((receipt) => ({ key: `receipt-${receipt.receiptHash}`, icon: ShieldCheck, title: "Receipt recorded", detail: shortHash(receipt.receiptHash), meta: `Ledger ${receipt.ledger}`, tone: "success" as Tone }));
  const settlementItems = settlements.slice(0, 3).map((settlement) => ({ key: `settlement-${settlement.txHash}-${settlement.opIndex}`, icon: Zap, title: "Settlement observed", detail: `${formatUnits(settlement.amount)} USDC`, meta: `Ledger ${settlement.ledger}`, tone: "info" as Tone }));
  const items = [...receiptItems, ...settlementItems].slice(0, 6);
  return items.length === 0 ? <EmptyState title="No live activity yet" description="New receipts and settlements will stream into this panel." /> : (
    <div className="activity-feed">
      {items.map((item, index) => <motion.div className="activity-item" key={item.key} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }}><span className={`activity-icon ${item.tone}`}><item.icon size={15} /></span><div><strong>{item.title}</strong><span>{item.detail}</span></div><time>{item.meta}</time></motion.div>)}
      <div className="activity-footer"><LivePill>Streaming activity</LivePill></div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search receipts…" }: { value: string; onChange: (value: string) => void; placeholder?: string }): ReactNode {
  return <label className="search-box"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><kbd>/</kbd></label>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }): ReactNode {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.div className="modal-panel" role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>{children}</motion.div></div>;
}

export function Toast({ message, tone = "success", onClose }: { message: string; tone?: Tone; onClose: () => void }): ReactNode {
  return <motion.div className={`toast toast-${tone}`} initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}><Check size={17} /><span>{message}</span><button className="icon-button" onClick={onClose} aria-label="Dismiss"><X size={15} /></button></motion.div>;
}

export function WalletCard({ contractId }: { contractId: string }): ReactNode {
  return <div className="wallet-card"><div className="wallet-grid" /><div className="wallet-heading"><span className="wallet-icon"><Wallet size={17} /></span><span>Merchant Wallet</span><span className="wallet-status" /></div><div className="wallet-address"><code>{shortAddress(contractId || "wallet not configured")}</code><Copy size={13} /></div><span className="wallet-label">Network anchor</span><strong className="wallet-balance">{contractId ? "ReceiptLedger" : "Not configured"}</strong><a href="https://stellar.expert" target="_blank" rel="noreferrer">View on Explorer <ExternalLink size={12} /></a></div>;
}

export function QuickAction({ icon: Icon, label, description, tone, onClick }: { icon: LucideIcon; label: string; description: string; tone: Tone; onClick: () => void }): ReactNode {
  return <motion.button className={`quick-action quick-${tone}`} onClick={onClick} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}><span className="quick-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronDown className="quick-arrow" size={15} /></motion.button>;
}

export function SyncStatus({ ledger }: { ledger: number }): ReactNode {
  return <div className="sync-status"><span className="sync-icon"><RefreshCw size={14} /></span><div><strong>Receiptor Indexer</strong><span>{ledger ? `Synced to ledger ${ledger.toLocaleString()}` : "Awaiting first sync"}</span></div><LivePill>1.2s ago</LivePill></div>;
}

export function CopyButton({ value }: { value: string }): ReactNode {
  const copy = async () => { await navigator.clipboard?.writeText(value); };
  return <button className="icon-button" onClick={() => void copy()} aria-label="Copy value"><Copy size={14} /></button>;
}

export function ExportButton({ onClick, label = "Export CSV" }: { onClick: () => void; label?: string }): ReactNode {
  return <Button variant="secondary" icon={Download} onClick={onClick}>{label}</Button>;
}

export function DataStat({ label, value, tone = "neutral", icon: Icon = Landmark }: { label: string; value: string | number; tone?: Tone; icon?: LucideIcon }): ReactNode {
  return <GlowCard className="data-stat" tone={tone}><span className="data-stat-icon"><Icon size={16} /></span><span>{label}</span><strong>{value}</strong></GlowCard>;
}

export function FileIcon(): ReactNode { return <FileSpreadsheet size={17} />; }
export function PlusIcon(): ReactNode { return <Plus size={16} />; }
export function ActivityIcon(): ReactNode { return <Activity size={16} />; }
export function LoaderIcon(): ReactNode { return <LoaderCircle size={16} className="spin" />; }
