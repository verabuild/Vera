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
      <button className="investigation-brand" onClick={onBack} aria-label="Back to VERA"><span className="investigation-brand-mark"><img src={"data:image/jpeg;base64,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"} alt="" /></span><span>VERA</span></button>
      <div className="investigation-topbar-center"><span className="nav-live" /> INVESTIGATION</div>
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
          <div><span className="investigation-eyebrow">INVESTIGATION ROOM</span><h1>Understand what you are about to act on.</h1></div>
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
          <div className="investigation-id-actions"><div className="investigation-id-actions"><button type="button" onClick={copyId}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy ID</>}</button><button type="button" className="find-saved-report" onClick={onInvestigations}><FileSearch size={14} /> Find a report</button></div><button type="button" className="find-saved-report" onClick={onInvestigations}><FileSearch size={14} /> Find a report</button></div>
        </section>

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
          </div>
        </section>
        <div className="investigation-principle"><ShieldCheck size={15} /><span>Investigate first. Understand the evidence. Then decide.</span></div>
      </section>
    </div>
  </main>;
}

export default InvestigationPage;
