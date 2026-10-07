import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowLeftRight, ArrowUpRight, Check, CheckCircle2,
  ChevronRight, Clock3, Copy, ExternalLink, FileSearch, Fingerprint, Link2,
  Mail, ShieldCheck, TriangleAlert, Wallet, LogIn, LogOut
} from "lucide-react";
import type { Assessment, Evidence, Scan, Severity } from "../lib/types";
import AuthControls from "./AuthControls";

type Props = {
  scan: Scan;
  onBack: () => void;
  onInvestigations: () => void;
  onInvestigateAnother: () => void;
};

type EvidenceFilter = Severity | "all";

const inputIcons = {
  URL: Link2,
  MESSAGE: Mail,
  WALLET: Wallet,
  TX: ArrowLeftRight,
} as const;

const filterLabels: Record<EvidenceFilter, string> = {
  all: "All",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

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

function checkLabel(status: string) {
  return status.replaceAll("_", " ");
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
  const report = scan.assessment.statusReport;
  const [copied, setCopied] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const evidenceCounts = useMemo(() => {
    const counts: Record<EvidenceFilter, number> = { all: scan.assessment.evidence.length, high: 0, medium: 0, low: 0, info: 0 };
    for (const item of scan.assessment.evidence) counts[item.severity] += 1;
    return counts;
  }, [scan.assessment.evidence]);

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

  const timeline = useMemo(
    () => [...scan.assessment.evidence]
      .filter((item) => item.observedAt)
      .sort((a, b) => new Date(a.observedAt ?? 0).getTime() - new Date(b.observedAt ?? 0).getTime()),
    [scan.assessment.evidence],
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
      <button className="investigation-brand" onClick={onBack} aria-label="Back to VERA"><span className="investigation-brand-mark">V</span><span>VERA</span></button>
      <div className="investigation-topbar-center"><span className="nav-live" /> INVESTIGATION</div>
      <div className="investigation-topbar-actions">
        <button className="investigation-top-link" onClick={onInvestigations}><FileSearch size={14} /> Investigations</button>
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
          <div><span className="investigation-eyebrow">INVESTIGATION ROOM</span><h1>Understand what you are about to act on.</h1></div>
          <div className="canvas-meta">{scan.assessment.network && <span>{scan.assessment.network}</span>}<span>{formatDate(scan.createdAt)}</span></div>
        </div>

        <section className="investigation-field">
          <div className="field-glint" aria-hidden="true" />
          <div className="field-target"><span className="investigation-eyebrow">TARGET</span><div className="field-target-row"><Icon size={16} /><strong title={scan.input}>{scan.input}</strong></div><span className="field-target-meta">VERA inspected this target using available security, reputation, infrastructure and on-chain evidence.</span></div>
          <div className={`field-verdict ${config.className}`}><div className="field-verdict-mark"><VerdictIcon size={25} /></div><div><span className="investigation-eyebrow">ASSESSMENT</span><strong>{config.label}</strong><p>{config.copy}</p></div></div>
        </section>

        {report && <section className="investigation-stat-row"><div><span>Coverage</span><strong>{report.coverage}%</strong></div><div><span>Decisive signals</span><strong>{report.decisiveFindings}</strong></div><div><span>Checks</span><strong>{report.checks.length}</strong></div><div><span>Mode</span><strong>Read-only</strong></div></section>}

        <section className="investigation-slide-deck">
          <article className="slide-card slide-primary"><div className="slide-card-index">01 / DECISION</div><span className="investigation-eyebrow">WHY THIS RESULT</span><h2>{scan.assessment.headline}</h2><p>{scan.assessment.explanation}</p><div className="slide-action"><span className="investigation-eyebrow">NEXT BEST ACTION</span><strong>{scan.assessment.action}</strong></div></article>
          <article className="slide-card slide-signals"><div className="slide-card-index">02 / SIGNALS</div><div className="investigation-section-head compact"><div><span className="investigation-eyebrow">DECISIVE SIGNALS</span><h2>What moved the assessment</h2></div><span className="investigation-count">{decisiveSignals.length}</span></div><div className="signal-stack">{(decisiveSignals.length ? decisiveSignals.slice(0, 3) : scan.assessment.evidence.slice(0, 3)).map((item, index) => <article className={`signal-row evidence-reveal ${index < revealCount ? "is-visible" : ""}`} key={item.id}><span className={`evidence-dot dot-${item.severity}`} /><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.source}</small></div></article>)}{scan.assessment.evidence.length === 0 && <div className="investigation-empty"><Activity size={17} /> No evidence was recorded.</div>}</div></article>
        </section>

        <section className="investigation-next-strip"><div><span className="investigation-eyebrow">KEEP MOVING</span><strong>Have another link, wallet or message to check?</strong><span>Start a fresh investigation without leaving this workspace.</span></div><button onClick={onInvestigateAnother}>Investigate another <ArrowUpRight size={14} /></button></section>

        <section className={`advanced-details ${advancedOpen ? "is-open" : ""}`}>
          <button type="button" className="advanced-details-toggle" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} aria-controls="advanced-investigation-details">
            <span className="advanced-toggle-copy"><span className="advanced-icon"><Fingerprint size={15} /></span><span><span className="investigation-eyebrow">ADVANCED DETAILS</span><strong>Evidence, coverage and investigation trail</strong><small>Open this when you want to inspect the technical evidence behind the assessment.</small></span></span>
            <span className="advanced-toggle-action">{advancedOpen ? "Hide details" : "View details"} <ChevronRight size={15} /></span>
          </button>
          <div id="advanced-investigation-details" className="advanced-details-body" hidden={!advancedOpen}>
            <section className="investigation-section investigation-depth-card"><div className="investigation-section-head"><div><span className="investigation-eyebrow">EVIDENCE</span><h2>What VERA established</h2></div><span className="investigation-count"><Fingerprint size={12} /> {scan.assessment.evidence.length} signals</span></div><div className="evidence-filter-row" aria-label="Filter evidence by severity">{(Object.keys(filterLabels) as EvidenceFilter[]).map((filter) => <button key={filter} type="button" className={evidenceFilter === filter ? "active" : ""} onClick={() => setEvidenceFilter(filter)}>{filterLabels[filter]} <span>{evidenceCounts[filter]}</span></button>)}</div><div className="investigation-evidence">{visibleEvidence.length === 0 ? <div className="investigation-empty"><Activity size={17} /><span>No {filterLabels[evidenceFilter].toLowerCase()} severity evidence was recorded.</span></div> : visibleEvidence.map((item: Evidence, index) => <article className={`investigation-evidence-row evidence-reveal ${index < revealCount ? "is-visible" : ""}`} key={item.id}><div className={`evidence-dot dot-${item.severity}`} /><button className="investigation-evidence-toggle" type="button" onClick={() => setExpandedEvidence(expandedEvidence === item.id ? null : item.id)} aria-expanded={expandedEvidence === item.id}><div className="investigation-evidence-main"><div className="investigation-evidence-title"><strong>{item.title}</strong><span>{item.state}</span><ChevronRight className={expandedEvidence === item.id ? "evidence-chevron open" : "evidence-chevron"} size={13} /></div><p>{item.detail}</p><div className="investigation-evidence-meta"><small>{item.source}</small>{item.observedAt && <small>Observed {formatDate(item.observedAt)}</small>}</div></div></button>{expandedEvidence === item.id && <div className="evidence-expanded"><span className="investigation-eyebrow">EVIDENCE DETAIL</span><p>{item.detail}</p>{Array.isArray(item.metadata?.reports) && <div className="evidence-links">{item.metadata.reports.map((reportItem, linkIndex) => { if (typeof reportItem !== "object" || reportItem === null) return null; const link = reportItem as Record<string, unknown>; if (typeof link.url !== "string" || !(link.url.startsWith("https://") || link.url.startsWith("http://"))) return null; return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + linkIndex}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>; })}</div>}{Array.isArray(item.metadata?.results) && <div className="evidence-links">{item.metadata.results.map((resultItem, linkIndex) => { if (typeof resultItem !== "object" || resultItem === null) return null; const link = resultItem as Record<string, unknown>; if (typeof link.url !== "string" || !(link.url.startsWith("https://") || link.url.startsWith("http://"))) return null; return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + linkIndex}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>; })}</div>}</div>}</article>)}</div></section>
            {timeline.length > 0 && <section className="investigation-section investigation-depth-card"><div className="investigation-section-head"><div><span className="investigation-eyebrow">EVIDENCE TIMELINE</span><h2>When the signals were observed</h2></div><span className="investigation-count">{timeline.length} observations</span></div><div className="investigation-timeline">{timeline.map((item) => <div className="timeline-item" key={item.id}><div className={`timeline-node node-${item.severity}`} /><div className="timeline-line" /><div className="timeline-content"><span>{item.observedAt ? formatDate(item.observedAt) : ""}</span><strong>{item.title}</strong><p>{item.source} · {item.state}</p></div></div>)}</div></section>}
            {report && <section className="investigation-section investigation-depth-card"><div className="investigation-section-head"><div><span className="investigation-eyebrow">COVERAGE</span><h2>How much evidence was available</h2></div><strong className="coverage-number">{report.coverage}%</strong></div><div className="coverage-bar"><span style={{ width: `${Math.max(0, Math.min(100, report.coverage))}%` }} /></div><div className="coverage-grid">{report.checks.map((check) => <div className="coverage-check" key={check.name}><span className={`coverage-dot coverage-${check.status.toLowerCase()}`} /><div><strong>{check.name}</strong><small>{checkLabel(check.status)}</small></div></div>)}</div><p className="coverage-note">Unavailable checks are shown explicitly. VERA does not treat missing evidence as a clean result.</p></section>}
            {scan.assessment.aiExplanation && <section className="investigation-section interpretation-section investigation-depth-card"><div className="investigation-section-head"><div><span className="investigation-eyebrow">INTERPRETATION</span><h2>Evidence in plain language</h2></div></div><p className="interpretation-copy">{scan.assessment.aiExplanation}</p></section>}
            <section className="investigation-footer-card investigation-depth-card"><div><span className="investigation-eyebrow">INVESTIGATION ID</span><strong>{scan.id}</strong><button onClick={copyId}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy ID</>}</button></div></section>
          </div>
        </section>
        <div className="investigation-principle"><ShieldCheck size={15} /><span>Investigate first. Understand the evidence. Then decide.</span></div>
      </section>
    </div>
  </main>;
}

export default InvestigationPage;
