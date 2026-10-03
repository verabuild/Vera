import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Brain, Check, ChevronRight, ClipboardPaste, ExternalLink,
  Link2, MessageSquare, Shield, Sparkles, Wallet, X, Zap,
} from "lucide-react";
import type { Network, Assessment, InputType, Scan } from "./lib/types";

const modes: { id: InputType; label: string; icon: typeof Link2 }[] = [
  { id: "URL", label: "URL", icon: Link2 },
  { id: "MESSAGE", label: "MESSAGE", icon: MessageSquare },
  { id: "WALLET", label: "WALLET", icon: Wallet },
  { id: "TX", label: "TX", icon: Zap },
];
const STORAGE_KEY = "vera-scans-v1";

function loadScans(): Scan[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveScans(scans: Scan[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(scans.slice(0, 12))); }
function StateBadge({ state }: { state: Assessment["state"] }) {
  return <span className={`state-badge state-${state.toLowerCase()}`}>{state.replace("_", " ")}</span>;
}
function AssessmentPanel({ assessment }: { assessment: Assessment }) {
  return <section className="assessment">
    <div className="assessment-top"><div><p className="eyebrow">VERA ASSESSMENT</p><h2>{assessment.headline}</h2></div><StateBadge state={assessment.state} /></div>
    <p className="assessment-copy">{assessment.explanation}</p>
    {assessment.aiExplanation && <div className="ai-note"><p className="eyebrow">VERA AI EXPLANATION</p><p>{assessment.aiExplanation}</p></div>}
    <div className="action-box"><div className="action-icon"><ArrowUpRight size={18} /></div><div><p className="eyebrow">RECOMMENDED ACTION</p><p>{assessment.action}</p></div></div>
    <div className="evidence-head"><div><p className="eyebrow">EVIDENCE</p><span>What VERA actually established</span></div><span className="muted">{assessment.evidence.length} signals</span></div>
    <div className="evidence-list">{assessment.evidence.map((item) => <div className="evidence-row" key={item.id}><div className={`evidence-dot dot-${item.severity}`} /><div className="evidence-main"><strong>{item.title}</strong><p>{item.detail}</p><small>{item.source} · {item.state}</small></div></div>)}</div>
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
  useEffect(() => setHistory(loadScans()), []);
  const placeholder = useMemo(() => ({ URL: "Paste a link you are unsure about…", MESSAGE: "Paste a message, DM or email…", WALLET: "Paste a wallet address…", TX: "Paste transaction details or calldata…" }[mode]), [mode]);
  async function scan() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/investigate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputType: mode, input: input.trim(), network }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Investigation failed");
      const scan: Scan = { id: data.id, type: mode, input: input.trim(), createdAt: data.createdAt, assessment: data.assessment };
      setAssessment(data.assessment);
      const next = [scan, ...history.filter((item) => item.input !== input.trim())];
      setHistory(next); saveScans(next);
    } catch (err) { setError(err instanceof Error ? err.message : "Investigation failed"); }
    finally { setBusy(false); }
  }
  function clear() { setInput(""); setAssessment(null); }
  function restore(scan: Scan) { setMode(scan.type); setInput(scan.input); setAssessment(scan.assessment); window.scrollTo({ top: 0, behavior: "smooth" }); }
  return <main>
    <nav className="nav"><div className="brand"><div className="brand-mark">V</div><span>VERA</span></div><div className="nav-center">THE DECISION LAYER</div><button className="ghost-button">Product <ChevronRight size={15} /></button></nav>
    <section className="hero"><div className="hero-copy"><div className="pill"><Sparkles size={14} /> Evidence before action</div><h1>Know<br /><em>before</em> you act.</h1><p>Understand what you are about to click, connect, sign or pay — without needing to understand the technology underneath it.</p></div>
      <div className="scanner-shell"><div className="scanner-head"><div><p className="eyebrow">INVESTIGATE</p><h2>What are you checking?</h2></div><Shield size={21} /></div>
        <div className="mode-row">{modes.map(({ id, label, icon: Icon }) => <button className={`mode ${mode === id ? "active" : ""}`} onClick={() => setMode(id)} key={id}><Icon size={15} /> {label}</button>)}</div>
        {mode === "WALLET" && <div className="network-row"><span className="eyebrow">SOLANA NETWORK</span><div><button className={`network-choice ${network === "mainnet" ? "active" : ""}`} onClick={() => setNetwork("mainnet")}>Mainnet</button><button className={`network-choice ${network === "devnet" ? "active" : ""}`} onClick={() => setNetwork("devnet")}>Devnet</button></div></div>}
        <div className="input-wrap"><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} rows={4} spellCheck={false} /><button className="paste" onClick={() => navigator.clipboard?.readText().then(setInput)}><ClipboardPaste size={15} /> Paste</button></div>
        {error && <div className="error-note">{error}</div>}
        <button className="scan-button" onClick={scan} disabled={busy || !input.trim()}>{busy ? "Investigating…" : "Investigate"} <ArrowUpRight size={17} /></button>
        <div className="trust-note"><Check size={14} /> No wallet connection required<span />Read-only by design</div>
      </div>
    </section>
    {assessment && <section className="result-section"><div className="section-label">RESULT</div><AssessmentPanel assessment={assessment} /><button className="secondary-button" onClick={clear}><X size={15} /> New investigation</button></section>}
    <section className="principles"><div className="section-label">THE VERA MODEL</div><div className="principle-grid"><article><span>01</span><Brain size={21} /><h3>Understand</h3><p>Translate technical complexity into plain language without hiding important consequences.</p></article><article><span>02</span><Shield size={21} /><h3>Evidence</h3><p>Separate observed facts, unavailable evidence and conclusions so uncertainty stays visible.</p></article><article><span>03</span><Zap size={21} /><h3>Act</h3><p>Give a concrete next step instead of a vague safety label.</p></article></div></section>
    <section className="history"><div className="history-head"><div><div className="section-label">RECENT INVESTIGATIONS</div><h2>Your investigation trail</h2></div><span className="muted">Stored locally in this demo</span></div>
      {history.length === 0 ? <div className="empty"><ExternalLink size={20} /><p>Your investigations will appear here.</p></div> : <div className="history-list">{history.map((scan) => <button className="history-row" key={scan.id} onClick={() => restore(scan)}><span className="history-type">{scan.type}</span><span className="history-input">{scan.input}</span><StateBadge state={scan.assessment.state} /><ChevronRight size={16} /></button>)}</div>}
    </section>
    <footer><div className="brand"><div className="brand-mark">V</div><span>VERA</span></div><p>Know before you act.</p><small>Demo build · No financial execution</small></footer>
  </main>;
}