import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowUpRight, ArrowLeftRight, Check, ChevronRight,
  Clock3, Copy, ExternalLink, FileSearch, Fingerprint, Globe2, Link2,
  Mail, Radar, ShieldCheck, TriangleAlert, Wallet
} from "lucide-react";
import type { Assessment, Scan } from "../lib/types";

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

function InvestigationPage({ scan, onBack, onInvestigations, onInvestigateAnother }: Props) {
  const Icon = inputIcons[scan.type];
  const config = verdictConfig(scan.assessment);
  const VerdictIcon = config.icon;
  const report = scan.assessment.statusReport;
  const [copied, setCopied] = useState(false);

  const decisiveSignals = useMemo(
    () => scan.assessment.evidence.filter((item) => item.severity === "high"),
    [scan.assessment.evidence],
  );

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(scan.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return <main className="investigation-page">
    <header className="investigation-nav">
      <button className="investigation-back" onClick={onBack}><ArrowLeft size={15} /> VERA</button>
      <div className="investigation-nav-center"><span className="nav-live" /> INVESTIGATION ROOM</div>
      <div className="investigation-nav-actions">
        <button className="investigation-nav-link" onClick={onInvestigations}><FileSearch size={14} /> All investigations</button>
        <button className="investigation-new" onClick={onInvestigateAnother}>New investigation <ArrowUpRight size={14} /></button>
      </div>
    </header>

    <div className="investigation-shell">
      <div className="investigation-breadcrumb"><span>INVESTIGATION</span><ChevronRight size={12} /><span>{scan.type}</span><ChevronRight size={12} /><span className="muted">{scan.id.slice(0, 8).toUpperCase()}</span></div>

      <section className="investigation-hero">
        <div className="investigation-target">
          <div className="investigation-type"><Icon size={14} /> {scan.type === "URL" ? "Website / Link" : scan.type}</div>
          <h1>{scan.input}</h1>
          <div className="investigation-meta"><span><Clock3 size={12} /> {formatDate(scan.createdAt)}</span><span><ShieldCheck size={12} /> Read-only investigation</span>{scan.assessment.network && <span>{scan.assessment.network}</span>}</div>
        </div>
        <div className={`investigation-verdict ${config.className}`}>
          <div className="investigation-verdict-icon"><VerdictIcon size={23} /></div>
          <div><span className="investigation-eyebrow">VERA ASSESSMENT</span><strong>{config.label}</strong><p>{config.copy}</p></div>
        </div>
      </section>

      <section className="investigation-summary">
        <div className="investigation-summary-copy">
          <span className="investigation-eyebrow">WHY?</span>
          <h2>{scan.assessment.headline}</h2>
          <p>{scan.assessment.explanation}</p>
        </div>
        <div className="investigation-action">
          <span className="investigation-eyebrow">NEXT BEST ACTION</span>
          <p>{scan.assessment.action}</p>
        </div>
      </section>

      <section className="investigation-section">
        <div className="investigation-section-head">
          <div><span className="investigation-eyebrow">DECISIVE SIGNALS</span><h2>What influenced the assessment</h2></div>
          <span className="investigation-count">{decisiveSignals.length} decisive</span>
        </div>
        {decisiveSignals.length === 0
          ? <div className="investigation-empty"><Activity size={17} /><span>No high-severity signals were recorded.</span></div>
          : <div className="decisive-grid">{decisiveSignals.slice(0, 6).map((item) => <article className="decisive-card" key={item.id}>
              <span className={`evidence-dot dot-${item.severity}`} />
              <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.source}</small></div>
            </article>)}</div>}
      </section>

      <section className="investigation-section">
        <div className="investigation-section-head">
          <div><span className="investigation-eyebrow">EVIDENCE</span><h2>What VERA established</h2></div>
          <span className="investigation-count"><Fingerprint size={12} /> {scan.assessment.evidence.length} signals</span>
        </div>
        <div className="investigation-evidence">
          {scan.assessment.evidence.map((item) => <article className="investigation-evidence-row" key={item.id}>
            <div className={`evidence-dot dot-${item.severity}`} />
            <div className="investigation-evidence-main">
              <div className="investigation-evidence-title"><strong>{item.title}</strong><span>{item.state}</span></div>
              <p>{item.detail}</p>
              <small>{item.source}</small>
              {Array.isArray(item.metadata?.reports) && <div className="evidence-links">{item.metadata.reports.map((report, index) => {
                if (typeof report !== "object" || report === null) return null;
                const link = report as Record<string, unknown>;
                if (typeof link.url !== "string" || !(link.url.startsWith("https://") || link.url.startsWith("http://"))) return null;
                return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + index}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>;
              })}</div>}
              {Array.isArray(item.metadata?.results) && <div className="evidence-links">{item.metadata.results.map((result, index) => {
                if (typeof result !== "object" || result === null) return null;
                const link = result as Record<string, unknown>;
                if (typeof link.url !== "string" || !(link.url.startsWith("https://") || link.url.startsWith("http://"))) return null;
                return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + index}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>;
              })}</div>}
            </div>
          </article>)}
        </div>
      </section>

      {report && <section className="investigation-section">
        <div className="investigation-section-head">
          <div><span className="investigation-eyebrow">COVERAGE</span><h2>How much evidence was available</h2></div>
          <strong className="coverage-number">{report.coverage}%</strong>
        </div>
        <div className="coverage-bar"><span style={{ width: `${Math.max(0, Math.min(100, report.coverage))}%` }} /></div>
        <div className="coverage-grid">
          {report.checks.map((check) => <div className="coverage-check" key={check.name}><span className={`coverage-dot coverage-${check.status.toLowerCase()}`} /><div><strong>{check.name}</strong><small>{checkLabel(check.status)}</small></div></div>)}
        </div>
        <p className="coverage-note">Unavailable checks are shown explicitly. VERA does not treat missing evidence as a clean result.</p>
      </section>}

      {scan.assessment.aiExplanation && <section className="investigation-section interpretation-section">
        <div className="investigation-section-head"><div><span className="investigation-eyebrow">INTERPRETATION</span><h2>Evidence in plain language</h2></div></div>
        <p className="interpretation-copy">{scan.assessment.aiExplanation}</p>
      </section>}

      <section className="investigation-footer-card">
        <div><span className="investigation-eyebrow">INVESTIGATION ID</span><strong>{scan.id}</strong><button onClick={copyId}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy ID</>}</button></div>
        <div className="investigation-footer-actions"><button onClick={onInvestigations}>View all investigations <ChevronRight size={14} /></button><button onClick={onInvestigateAnother}>Investigate another <ArrowUpRight size={14} /></button></div>
      </section>

      <div className="investigation-principle"><ShieldCheck size={15} /><span>Investigate first. Understand the evidence. Then decide.</span></div>
    </div>
  </main>;
}

export default InvestigationPage;
