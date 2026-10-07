import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeftRight, ArrowUpRight, Check, CheckCircle2,
  ChevronRight, Clock3, Copy, ExternalLink, FileSearch, Fingerprint, Link2,
  Mail, ShieldCheck, TriangleAlert, Wallet
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
      <button className="investigation-brand" onClick={onBack} aria-label="Back to VERA"><span className="investigation-brand-mark"><img src={"data:image/webp;base64,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"} alt="" /></span><span>VERA</span></button>
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
