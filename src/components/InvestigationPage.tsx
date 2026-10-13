import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeftRight, ArrowUpRight, Check, Copy, FileSearch, Link2,
  Mail, ShieldCheck, TriangleAlert, Wallet
} from "lucide-react";
import type { Assessment, Scan } from "../lib/types";
import AuthControls from "./AuthControls";
import InvestigationExplorer from "./InvestigationExplorer";
import { OFFICIAL_VERA_LOGO } from "../lib/brand";

type Props = {
  scan: Scan;
  onBack: () => void;
  onInvestigations: () => void;
  onInvestigateAnother: () => void;
};

const inputIcons = {
  URL: Link2,
  MESSAGE: Mail,
  WALLET: Wallet,
  TX: ArrowLeftRight,
} as const;

function verdictConfig(assessment: Assessment) {
  if (assessment.verdict === "SAFE") return {
    label: "SAFE",
    copy: "No significant malicious indicators detected.",
    icon: ShieldCheck,
    className: "investigation-verdict-safe",
  };
  if (assessment.verdict === "NOT_SAFE") return {
    label: "NOT SAFE",
    copy: "Multiple risk indicators require you to stop and verify independently.",
    icon: TriangleAlert,
    className: "investigation-verdict-danger",
  };
  if (assessment.verdict === "CAUTION") return {
    label: "CAUTION",
    copy: "Risk signals require additional verification before you act.",
    icon: TriangleAlert,
    className: "investigation-verdict-caution",
  };
  return {
    label: "REVIEW",
    copy: "The available evidence is inconclusive.",
    icon: Activity,
    className: "investigation-verdict-review",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(overall: "COMPLETE" | "PARTIAL" | "CONFIRMED_FINDING") {
  if (overall === "CONFIRMED_FINDING") return "CONFIRMED FINDING";
  if (overall === "COMPLETE") return "INVESTIGATION COMPLETE";
  return "INVESTIGATION PARTIAL";
}

function InvestigationPage({ scan, onBack, onInvestigations, onInvestigateAnother }: Props) {
  const Icon = inputIcons[scan.type];
  const config = verdictConfig(scan.assessment);
  const VerdictIcon = config.icon;
  const targetTitle = useMemo(() => {
    if (scan.type === "URL") {
      try {
        const candidate = /^https?:\/\//i.test(scan.input) ? scan.input : `https://${scan.input}`;
        return new URL(candidate).hostname.replace(/^www\./i, "") || "Website analysis";
      } catch { return "Website analysis"; }
    }
    if (scan.type === "WALLET") return "Wallet intelligence";
    if (scan.type === "TX") return "Transaction analysis";
    return "Message analysis";
  }, [scan.input, scan.type]);
  const report = scan.assessment.statusReport;
  const [copied, setCopied] = useState(false);
  const [revealCount, setRevealCount] = useState(0);

  const decisiveSignals = useMemo(
    () => scan.assessment.evidence.filter((item) => item.severity === "high"),
    [scan.assessment.evidence],
  );

  const visibleEvidence = useMemo(
    () => evidenceFilter === "all"
      ? scan.assessment.evidence
      : scan.assessment.evidence.filter((item) => item.severity === evidenceFilter),
    [evidenceFilter, scan.assessment.evidence],
  );

  useEffect(() => {
    setRevealCount(0);
    const timers = scan.assessment.evidence.slice(0, 8).map((_, index) =>
      window.setTimeout(() => setRevealCount(index + 1), 110 + index * 85)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [scan.id, scan.assessment.evidence]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(scan.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };


  return <main className="investigation-page investigation-gloam-inspired">
    <header className="investigation-topbar">
      <button className="investigation-brand" onClick={onBack} aria-label="Back to VERA"><span className="investigation-brand-mark"><img src={OFFICIAL_VERA_LOGO} alt="" /></span><span>VERA</span></button>
      <div className="investigation-topbar-center"><span className="nav-live" /> SECURITY INTELLIGENCE</div>
      <div className="investigation-topbar-actions">
        <button className="investigation-top-link" onClick={onInvestigations}><FileSearch size={14} /> Find a report</button>
        <AuthControls />
      </div>
    </header>

    <div className="investigation-app-shell">
      <aside className="investigation-rail">
        <div className="rail-section">
          <span className="rail-label">CURRENT CASE</span>
          <div className="rail-target"><Icon size={15} /><span>{scan.type === "URL" ? "Website / Link" : scan.type}</span></div>
          <p className="rail-input" title={scan.input}>{scan.input}</p>
        </div>
        <div className="rail-divider" />
        <div className="rail-section"><span className="rail-label">STATUS</span><div className="rail-status"><span className="rail-status-dot" /> {report ? statusLabel(report.overall) : "ASSESSING"}</div></div>
        <div className="rail-section rail-meta"><span className="rail-label">CASE ID</span><strong>{scan.id.slice(0, 8).toUpperCase()}</strong><span>{formatDate(scan.createdAt)}</span></div>
        <div className="rail-bottom"><span className="rail-readonly"><ShieldCheck size={13} /> Read-only</span><button onClick={onInvestigateAnother} className="rail-new">New investigation <ArrowUpRight size={13} /></button></div>
      </aside>

      <section className="investigation-canvas">
        <div className="investigation-canvas-head">
          <div className="investigation-room-heading"><span className="investigation-eyebrow">VERA / SECURITY INTELLIGENCE</span><h1 title={targetTitle}>{targetTitle}</h1><p>Evidence, identity and observed signals behind this assessment.</p></div>
          <div className="canvas-meta">{scan.assessment.network && <span>{scan.assessment.network}</span>}<span>{formatDate(scan.createdAt)}</span></div>
        </div>

        <section className="investigation-field">
          <div className="field-glint" aria-hidden="true" />
          <div className="field-target"><span className="investigation-eyebrow">TARGET</span><div className="field-target-row"><Icon size={16} /><strong title={scan.input}>{scan.input}</strong></div><span className="field-target-meta">VERA inspected this target using available security, reputation, infrastructure and on-chain evidence.</span></div>
          <div className={`field-verdict ${config.className}`}><div className="field-verdict-mark"><VerdictIcon size={25} /></div><div><span className="investigation-eyebrow">ASSESSMENT</span><strong>{config.label}</strong><p>{config.copy}</p></div></div>
        </section>

        {report && <section className="investigation-stat-row"><div><span>Coverage</span><strong>{report.coverage}%</strong></div><div><span>Decisive signals</span><strong>{report.decisiveFindings}</strong></div><div><span>Checks</span><strong>{report.checks.length}</strong></div><div><span>Mode</span><strong>Read-only</strong></div></section>}

        <section className="investigation-id-card" aria-label="Investigation ID">
          <div className="investigation-id-copy"><span className="investigation-eyebrow">INVESTIGATION ID</span><strong>{scan.id}</strong><p>Copy this reference to reopen or share this saved report.</p></div>
          <div className="investigation-id-actions"><button type="button" onClick={copyId}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy ID</>}</button><button type="button" className="find-saved-report" onClick={onInvestigations}><FileSearch size={14} /> Look up another ID</button></div>
        </section>

        <section className="investigation-slide-deck">
          <article className="slide-card slide-primary"><div className="slide-card-index">01 / DECISION</div><span className="investigation-eyebrow">WHY THIS RESULT</span><h2>{scan.assessment.headline}</h2><p>{scan.assessment.explanation}</p><div className="slide-action"><span className="investigation-eyebrow">NEXT BEST ACTION</span><strong>{scan.assessment.action}</strong></div></article>
          <article className="slide-card slide-signals"><div className="slide-card-index">02 / SIGNALS</div><div className="investigation-section-head compact"><div><span className="investigation-eyebrow">DECISIVE SIGNALS</span><h2>What moved the assessment</h2></div><span className="investigation-count">{decisiveSignals.length}</span></div><div className="signal-stack">{(decisiveSignals.length ? decisiveSignals.slice(0, 3) : scan.assessment.evidence.slice(0, 3)).map((item, index) => <article className={`signal-row evidence-reveal ${index < revealCount ? "is-visible" : ""}`} key={item.id}><span className={`evidence-dot dot-${item.severity}`} /><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.source}</small></div></article>)}{scan.assessment.evidence.length === 0 && <div className="investigation-empty"><Activity size={17} /> No evidence was recorded.</div>}</div></article>
        </section>

        <section className="investigation-next-strip"><div><span className="investigation-eyebrow">KEEP MOVING</span><strong>Have another link, wallet or message to check?</strong><span>Start a fresh investigation without leaving this workspace.</span></div><button onClick={onInvestigateAnother}>Investigate another <ArrowUpRight size={14} /></button></section>

        <InvestigationExplorer scan={scan} />
        <div className="investigation-principle"><ShieldCheck size={15} /><span>Investigate first. Understand the evidence. Then decide.</span></div>
      </section>
    </div>
  </main>;
}

export default InvestigationPage;
