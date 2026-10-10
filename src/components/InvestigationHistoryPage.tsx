import { useState } from "react";
import { ChevronRight, FileSearch, ArrowUpRight, ArrowLeft, Link2, Mail, Wallet, ArrowLeftRight, ShieldCheck, TriangleAlert, Activity, Search } from "lucide-react";
import type { Scan } from "../lib/types";

type Props = {
  scans: Scan[];
  onBack: () => void;
  onOpen: (scan: Scan) => void;
  onInvestigate: () => void;
  onLookup: (id: string) => void;
};

const typeLabels = {
  URL: "Website / Link",
  MESSAGE: "Message",
  WALLET: "Wallet",
  TX: "Transaction",
} as const;

const typeIcons = {
  URL: Link2,
  MESSAGE: Mail,
  WALLET: Wallet,
  TX: ArrowLeftRight,
} as const;

function statusFor(scan: Scan) {
  if (scan.assessment.verdict === "SAFE") return { label: "SAFE", className: "history-verdict-safe", icon: ShieldCheck };
  if (scan.assessment.verdict === "NOT_SAFE") return { label: "NOT SAFE", className: "history-verdict-danger", icon: TriangleAlert };
  if (scan.assessment.verdict === "CAUTION") return { label: "CAUTION", className: "history-verdict-caution", icon: TriangleAlert };
  return { label: "REVIEW", className: "history-verdict-review", icon: Activity };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InvestigationHistoryPage({ scans, onBack, onOpen, onInvestigate, onLookup }: Props) {
  const [referenceId, setReferenceId] = useState("");
  return <main className="investigation-history-page">
    <header className="investigation-nav">
      <button className="investigation-back" onClick={onBack}><ArrowLeft size={15} /> VERA</button>
      <div className="investigation-nav-center"><span className="nav-live" /> INVESTIGATIONS</div>
      <button className="investigation-new" onClick={onInvestigate}>New investigation <ArrowUpRight size={14} /></button>
    </header>

    <div className="history-page-shell">
      <form className="investigation-reference-lookup" onSubmit={(event) => { event.preventDefault(); const id = referenceId.trim(); if (id) onLookup(id); }}>
        <div><span className="investigation-eyebrow">INVESTIGATION LOOKUP</span><strong>Have an Investigation ID?</strong><p>Paste an ID to reopen the original saved report. You do not need to run the investigation again.</p></div>
        <div className="investigation-reference-controls"><input aria-label="Investigation ID" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="Paste Investigation ID" autoComplete="off" spellCheck={false} required /><button type="submit" disabled={!referenceId.trim()}><Search size={15} /> Find report</button></div>
      </form>

      <div className="history-page-heading">
        <div><span className="investigation-eyebrow">INVESTIGATION TRAIL</span><h1>All investigations</h1><p>Review what you have investigated and return to the evidence.</p></div>
        <div className="history-page-count"><strong>{scans.length}</strong><span>stored locally</span></div>
      </div>

      {scans.length === 0
        ? <div className="investigation-empty history-page-empty"><FileSearch size={24} /><div><strong>No investigations yet</strong><p>Your investigation history will appear here after your first check.</p><button onClick={onInvestigate}>Start an investigation <ArrowUpRight size={14} /></button></div></div>
        : <div className="history-page-list">{scans.map((scan) => {
          const Icon = typeIcons[scan.type];
          const status = statusFor(scan);
          const StatusIcon = status.icon;
          return <button className="history-page-row" key={scan.id} onClick={() => onOpen(scan)}>
            <span className="history-page-type"><Icon size={15} /><span>{typeLabels[scan.type]}</span></span>
            <span className="history-page-target">{scan.input}</span>
            <span className={`history-page-verdict ${status.className}`}><StatusIcon size={12} /> {status.label}</span>
            <span className="history-page-date">{formatDate(scan.createdAt)}</span>
            <ChevronRight size={16} />
          </button>;
        })}</div>}

      <div className="investigation-principle"><ShieldCheck size={15} /><span>Investigate first. Understand the evidence. Then decide.</span></div>
    </div>
  </main>;
}
