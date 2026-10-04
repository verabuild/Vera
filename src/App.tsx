import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BrainCircuit, Check, ChevronRight, ClipboardPaste,
  ExternalLink, FileSearch, Fingerprint, Globe2, Link2, LockKeyhole,
  MessageSquareText, Radar, RefreshCw, ScanSearch, ShieldCheck, Sparkles,
  TriangleAlert, WalletCards, X, Zap
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import type { Network, Assessment, InputType, Scan } from "./lib/types";

const modes: { id: InputType; label: string; icon: typeof Link2; description: string }[] = [
  { id: "URL", label: "Link", icon: Globe2, description: "Inspect a website or URL" },
  { id: "MESSAGE", label: "Message", icon: MessageSquareText, description: "Analyse a DM, email or text" },
  { id: "WALLET", label: "Wallet", icon: WalletCards, description: "Inspect a Solana address" },
  { id: "TX", label: "Transaction", icon: Zap, description: "Understand transaction data" },
];

const STORAGE_KEY = "vera-scans-v1";
const liveStages = [
  { label: "Parsing input", icon: ScanSearch },
  { label: "Collecting signals", icon: Radar },
  { label: "Checking evidence", icon: Fingerprint },
  { label: "Building assessment", icon: BrainCircuit },
];

function loadScans(): Scan[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveScans(scans: Scan[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(scans.slice(0, 12))); }

function StateBadge({ state }: { state: Assessment["state"] }) {
  const Icon = state === "VERIFIED" || state === "SUPPORTED" ? ShieldCheck : state === "CONFIRMED_MALICIOUS" ? TriangleAlert : Activity;
  return <span className={`state-badge state-${state.toLowerCase()}`}><Icon size={12} />{state.replace("_", " ")}</span>;
}

function LiveInvestigation() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, liveStages.length - 1)), 650);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="live-investigation" aria-live="polite">
    <div className="live-top">
      <div className="live-pulse"><span />LIVE INVESTIGATION</div>
      <span className="live-count">REAL-TIME</span>
    </div>
    <div className="live-track">
      {liveStages.map(({ label, icon: Icon }, index) => (
        <div className={`live-stage ${index <= stage ? "done" : ""} ${index === stage ? "current" : ""}`} key={label}>
          <div className="stage-icon">{index < stage ? <Check size={13} /> : <Icon size={13} />}</div>
          <span>{label}</span>
        </div>
      ))}
    </div>
    <div className="signal-stream"><span className="signal-dot" /><span>VERA is correlating available evidence. No action is being executed.</span></div>
  </div>;
}

function AssessmentPanel({ assessment }: { assessment: Assessment }) {
  const isHigh = assessment.state === "CONFIRMED_MALICIOUS" || assessment.state === "SUSPICIOUS";
  return <section className={`assessment ${isHigh ? "assessment-alert" : ""}`}>
    <div className="assessment-top">
      <div className="assessment-title">
        <p className="eyebrow">VERA DECISION</p>
        <h2>{assessment.headline}</h2>
      </div>
      <StateBadge state={assessment.state} />
    </div>
    <p className="assessment-copy">{assessment.explanation}</p>
    {assessment.aiExplanation && <div className="ai-note"><div className="ai-note-head"><Sparkles size={15} /><strong>AI interpretation</strong><span>Evidence-grounded</span></div><p>{assessment.aiExplanation}</p></div>}
    <div className="action-box">
      <div className="action-icon"><ArrowUpRight size={18} /></div>
      <div><p className="eyebrow">NEXT BEST ACTION</p><p>{assessment.action}</p></div>
    </div>
    <div className="evidence-head">
      <div><p className="eyebrow">EVIDENCE TRAIL</p><span>What VERA actually established</span></div>
      <span className="signal-count"><Activity size={12} /> {assessment.evidence.length} signals</span>
    </div>
    <div className="evidence-list">{assessment.evidence.map((item) => <div className="evidence-row" key={item.id}>
      <div className={`evidence-dot dot-${item.severity}`} />
      <div className="evidence-main"><div className="evidence-title"><strong>{item.title}</strong><span>{item.state}</span></div><p>{item.detail}</p><small>{item.source}</small>{Array.isArray(item.metadata?.reports) && <div className="evidence-links">{item.metadata.reports.map((report, index) => { if (typeof report !== "object" || report === null) return null; const link = report as Record<string, unknown>; if (typeof link.url !== "string" || !/^https?:\\/\\//i.test(link.url)) return null; return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + index}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>; })}</div>}{Array.isArray(item.metadata?.results) && <div className="evidence-links">{item.metadata.results.map((report, index) => { if (typeof report !== "object" || report === null) return null; const link = report as Record<string, unknown>; if (typeof link.url !== "string" || !/^https?:\\/\\//i.test(link.url)) return null; return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + index}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>; })}</div>}</div>
    </div>)}</div>
  </section>;
}

export default function App() {
  const [mode, setMode] = useState<InputType>("URL");
  const [input, setInput] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<Scan[]>([]);
  const [busy, setBusy] = useState(false);
  const [network, setNetwork] = useState<Network>("mainnet");
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });

  useEffect(() => setHistory(loadScans()), []);
  const placeholder = useMemo(() => ({
    URL: "Paste a link you want VERA to inspect…",
    MESSAGE: "Paste the message, DM or email you want VERA to analyse…",
    WALLET: "Paste a Solana wallet address…",
    TX: "Paste transaction details or calldata…"
  }[mode]), [mode]);

  async function scan() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType: mode, input: input.trim(), network })
      });
      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      let data: { id?: string; createdAt?: string; assessment?: Assessment; error?: string; detail?: string } = {};
      if (raw) {
        if (contentType.includes("application/json")) {
          try { data = JSON.parse(raw); } catch { /* fall through to raw server error */ }
        } else {
          data.error = raw;
        }
      }
      if (!response.ok) {
        const detail = data.detail ? `: ${data.detail}` : "";
        throw new Error(data.error ? `${data.error}${detail}` : `Server returned HTTP ${response.status}`);
      }
      if (!data.assessment || !data.id || !data.createdAt) {
        throw new Error("VERA returned an incomplete investigation response.");
      }
      const scan: Scan = { id: data.id, type: mode, input: input.trim(), createdAt: data.createdAt, assessment: data.assessment };
      setAssessment(data.assessment);
      const next = [scan, ...history.filter((item) => item.input !== input.trim())];
      setHistory(next); saveScans(next);
      window.setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) { setError(err instanceof Error ? err.message : "Investigation failed"); }
    finally { setBusy(false); }
  }

  function clear() { setInput(""); setAssessment(null); setError(null); }
  function restore(scan: Scan) { setMode(scan.type); setInput(scan.input); setAssessment(scan.assessment); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <main onMouseMove={(event) => { const r = event.currentTarget.getBoundingClientRect(); setCursor({ x: ((event.clientX-r.left)/r.width)*100, y: ((event.clientY-r.top)/r.height)*100 }); }} style={{ "--mx": `${cursor.x}%`, "--my": `${cursor.y}%` } as React.CSSProperties}>
    <nav className="nav">
      <div className="brand"><img className="brand-logo" src="/vera-logo.jpg" alt="VERA" /></div>
      <div className="nav-center"><span className="nav-live" /><strong>DECISION INTELLIGENCE</strong></div>
      <div className="nav-actions"><span className="nav-status"><ShieldCheck size={13} /> READ-ONLY</span><button className="ghost-button">How it works <ChevronRight size={14} /></button></div>
    </nav>

    <section className="hero">
      <div className="hero-copy">
        <div className="pill"><span className="pill-live" /><strong>EVIDENCE BEFORE ACTION</strong></div>
        <h1>Know <em>before</em><br />you act.</h1>
        <p>VERA turns technical signals into a clear decision before you <strong>click, connect, sign or pay.</strong></p>
        <div className="hero-proof"><span><ShieldCheck size={14} /> Evidence-led</span><span><LockKeyhole size={14} /> No wallet connection</span><span><Zap size={14} /> Read-only by design</span></div>
      </div>

      <div className="scanner-shell">
        <div className="scanner-head">
          <div><p className="eyebrow">INVESTIGATION CONSOLE</p><h2>What are you about to do?</h2><p className="scanner-sub">Give VERA the thing you're unsure about. We'll show you what the evidence says.</p></div>
          <div className="scanner-orbit"><div className="orbit-ring" /><Radar size={20} /></div>
        </div>

        <div className="mode-row">{modes.map(({ id, label, icon: Icon, description }) => <button className={`mode ${mode === id ? "active" : ""}`} onClick={() => setMode(id)} key={id} title={description}><Icon size={15} /><span>{label}</span></button>)}</div>

        {mode === "WALLET" && <div className="network-row"><span className="eyebrow">SOLANA NETWORK</span><div><button className={`network-choice ${network === "mainnet" ? "active" : ""}`} onClick={() => setNetwork("mainnet")}>Mainnet</button><button className={`network-choice ${network === "devnet" ? "active" : ""}`} onClick={() => setNetwork("devnet")}>Devnet</button></div></div>}

        <div className="input-wrap">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} rows={4} spellCheck={false} />
          <button className="paste" onClick={() => navigator.clipboard?.readText().then(setInput)}><ClipboardPaste size={14} /> Paste</button>
        </div>

        {error && <div className="error-note"><TriangleAlert size={15} />{error}</div>}
        {busy && <LiveInvestigation />}
        <button className="scan-button" onClick={scan} disabled={busy || !input.trim()}>{busy ? <><RefreshCw size={16} className="spin" /> Investigating signals…</> : <><ScanSearch size={16} /> Investigate with VERA <ArrowUpRight size={16} /></>}</button>
        <div className="trust-note"><Check size={13} /> No wallet connection required <span /> <LockKeyhole size={12} /> Read-only investigation <span /> <Activity size={12} /> Live evidence</div>
      </div>
    </section>

    {assessment && <section className="result-section" id="result"><div className="section-label">INVESTIGATION RESULT</div><AssessmentPanel assessment={assessment} /><button className="secondary-button" onClick={clear}><X size={14} /> Start new investigation</button></section>}

    <section className="principles">
      <div className="section-intro"><div className="section-label">THE VERA METHOD</div><h2>From raw signals to a <strong>clear next move.</strong></h2><p>VERA separates what was observed from what it means, so you can act with context instead of guesswork.</p></div>
      <div className="principle-grid">
        <article><span>01</span><BrainCircuit size={21} /><h3>Understand</h3><p>Translate technical complexity into plain language without hiding consequences.</p></article>
        <article><span>02</span><Fingerprint size={21} /><h3>Verify</h3><p>Connect live and deterministic signals to the evidence actually available.</p></article>
        <article><span>03</span><ArrowUpRight size={21} /><h3>Act</h3><p>Turn the assessment into a specific, practical next step.</p></article>
      </div>
    </section>

    <section className="history">
      <div className="history-head"><div><div className="section-label">INVESTIGATION TRAIL</div><h2>Recent checks</h2></div><span className="muted"><LockKeyhole size={11} /> Stored locally in this demo</span></div>
      {history.length === 0 ? <div className="empty"><FileSearch size={20} /><div><strong>No investigations yet</strong><p>Your recent checks will appear here after you investigate something.</p></div></div> : <div className="history-list">{history.map((scan) => <button className="history-row" key={scan.id} onClick={() => restore(scan)}><span className="history-type">{scan.type}</span><span className="history-input">{scan.input}</span><StateBadge state={scan.assessment.state} /><ChevronRight size={16} /></button>)}</div>}
    </section>

    <footer><div className="brand"><img className="brand-logo" src="/vera-logo.jpg" alt="VERA" /></div><p>Know before you act.</p><small>Hackathon build · No financial execution · Read-only</small></footer>
    <Analytics />
  </main>;
}
