import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BrainCircuit, Check, ChevronRight, ClipboardPaste,
  ExternalLink, FileSearch, Fingerprint, Globe2, Link2, LockKeyhole,
  MessageSquareText, Radar, RefreshCw, ScanSearch, ShieldCheck, Sparkles,
  TriangleAlert, WalletCards, X, Zap, HeartCrack, Building2, BriefcaseBusiness,
  CircleDollarSign, BadgeAlert, ArrowDownRight
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { usePrivy } from "@privy-io/react-auth";
import AuthControls from "./components/AuthControls";
import LegalPage from "./components/LegalPage";
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

function SignupPrompt() {
  const { login } = usePrivy();
  return <div className="signup-prompt"><div><strong>Your two free investigations are used.</strong><p>Sign in with Google, email or a Solana wallet to continue. You’ll get five investigations per day.</p></div><button className="auth-button auth-login" onClick={() => login()}><ShieldCheck size={14} /> Sign in to continue</button></div>;
}

function StateBadge({ state }: { state: Assessment["state"] }) {
  const Icon = state === "VERIFIED" || state === "SUPPORTED" ? ShieldCheck : state === "CONFIRMED_MALICIOUS" ? TriangleAlert : Activity;
  return <span className={`state-badge state-${state.toLowerCase()}`}><Icon size={12} />{state.replace("_", " ")}</span>;
}

function VerdictBanner({ assessment }: { assessment: Assessment }) {
  if (!assessment.verdict) return null;
  const config = assessment.verdict === "SAFE"
    ? { label: "SAFE", copy: "No known safety flags detected", icon: ShieldCheck, className: "verdict-safe" }
    : assessment.verdict === "NOT_SAFE"
      ? { label: "NOT SAFE", copy: "Do not interact until independently verified", icon: TriangleAlert, className: "verdict-not-safe" }
      : assessment.verdict === "CAUTION"
        ? { label: "CAUTION", copy: "Risk signals require additional verification", icon: TriangleAlert, className: "verdict-caution" }
        : { label: "REVIEW", copy: "Evidence is inconclusive", icon: Activity, className: "verdict-review" };
  const Icon = config.icon;
  return <div className={`verdict-banner ${config.className}`}><Icon size={17} /><div><strong>{config.label}</strong><span>{config.copy}</span></div></div>;
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


const impactStories = [
  {
    id: "people",
    label: "People & families",
    icon: HeartCrack,
    title: "A scam can outlast the moment it happens.",
    copy: "Reported fraud can mean lost savings, debt, disrupted plans and the difficult work of rebuilding trust. VERA cannot undo a transfer, but it can help people pause before a risky action.",
    stat: "$12.5B",
    statLabel: "reported lost to fraud in the US in 2024",
    source: "Federal Trade Commission",
    url: "https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024"
  },
  {
    id: "business",
    label: "Companies",
    icon: Building2,
    title: "Impersonation puts trust itself at risk.",
    copy: "Fraudsters can copy a brand, mimic a support agent or exploit a familiar name. The damage can spread from the person who pays to the legitimate company forced to respond.",
    stat: "$2.95B",
    statLabel: "reported lost to imposter scams in the US in 2024",
    source: "Federal Trade Commission",
    url: "https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024"
  },
  {
    id: "industry",
    label: "Digital finance",
    icon: CircleDollarSign,
    title: "Crypto fraud can make a transfer difficult to reverse.",
    copy: "The FBI reported that investment fraud involving cryptocurrency accounted for more than $6.5 billion in reported losses in 2024. The figure covers reports to the FBI's IC3, not every scam worldwide.",
    stat: "$6.5B+",
    statLabel: "reported losses from crypto-related investment fraud in 2024",
    source: "FBI Internet Crime Complaint Center",
    url: "https://www.fbi.gov/news/press-releases/fbi-releases-annual-internet-crime-report"
  }
];

function ImpactSection() {
  const [activeImpact, setActiveImpact] = useState("people");
  const active = impactStories.find((item) => item.id === activeImpact) ?? impactStories[0];
  const Icon = active.icon;
  return <section className="impact-section" id="why-vera">
    <div className="impact-kicker"><span className="live-pulse"><span />THE HUMAN COST</span><span className="impact-kicker-line" /></div>
    <div className="impact-heading">
      <div><p className="eyebrow">BEHIND EVERY REPORT IS A REAL CONSEQUENCE</p><h2>Scams don't just steal money.<br /><em>They steal certainty.</em></h2></div>
      <p className="impact-intro">Numbers help show the scale. They never tell the whole story. VERA exists to put evidence between a person and a decision they may not be able to take back.</p>
    </div>
    <div className="impact-stat-grid">
      <a className="impact-stat" href="https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024" target="_blank" rel="noreferrer noopener">
        <span className="impact-stat-label">US CONSUMER REPORTS · 2024</span><strong>$12.5B</strong><span>reported lost to fraud <ExternalLink size={12} /></span>
      </a>
      <a className="impact-stat" href="https://www.fbi.gov/news/press-releases/fbi-releases-annual-internet-crime-report" target="_blank" rel="noreferrer noopener">
        <span className="impact-stat-label">FBI IC3 · 2024</span><strong>859,532</strong><span>internet-crime complaints received <ExternalLink size={12} /></span>
      </a>
      <a className="impact-stat" href="https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf" target="_blank" rel="noreferrer noopener">
        <span className="impact-stat-label">FBI IC3 · CUMULATIVE</span><strong>9M+</strong><span>complaints received since IC3 began <ExternalLink size={12} /></span>
      </a>
    </div>
    <div className="impact-explorer">
      <div className="impact-selector">
        <p className="eyebrow">EXPLORE THE CONSEQUENCES</p>
        {impactStories.map((item) => {
          const ItemIcon = item.icon;
          return <button className={activeImpact === item.id ? "impact-tab active" : "impact-tab"} key={item.id} onClick={() => setActiveImpact(item.id)}><ItemIcon size={17} /><span>{item.label}</span><ChevronRight size={15} /></button>;
        })}
        <div className="impact-quote"><span className="quote-mark">“</span><blockquote>Reporting is one of the first and most important steps in fighting crime.</blockquote><p>FBI Director Kash Patel · April 2025</p><a href="https://www.fbi.gov/news/press-releases/fbi-releases-annual-internet-crime-report" target="_blank" rel="noreferrer noopener">Read the official statement <ArrowUpRight size={12} /></a></div>
      </div>
      <article className="impact-detail" key={active.id}>
        <div className="impact-detail-top"><span className="impact-icon"><Icon size={21} /></span><span className="impact-index">IMPACT FILE / 0{impactStories.findIndex((item) => item.id === active.id) + 1}</span></div>
        <h3>{active.title}</h3><p>{active.copy}</p>
        <div className="impact-feature-stat"><strong>{active.stat}</strong><span>{active.statLabel}</span></div>
        <div className="impact-source"><span>DATA SOURCE</span><a href={active.url} target="_blank" rel="noreferrer noopener">{active.source} <ExternalLink size={12} /></a></div>
        <p className="impact-caveat">Reported figures are not the total global cost of scams. Reporting systems have different scopes, and many incidents go unreported.</p>
      </article>
    </div>
    <div className="impact-bottom"><span><ShieldCheck size={15} /> Prevention starts before the click.</span><button onClick={() => { document.querySelector(".scanner-shell")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Put VERA between you and the risk <ArrowUpRight size={15} /></button></div>
  </section>;
}

const motionChapters = [
  { number: "01", eyebrow: "THE MOMENT BEFORE", title: "Every risky decision starts with a small moment.", copy: "A link looks familiar. A message feels urgent. A transaction asks for a signature. The pressure is often designed to make you move before you think.", tag: "PAUSE", icon: LockKeyhole },
  { number: "02", eyebrow: "EVIDENCE, NOT GUESSWORK", title: "Turn scattered signals into something you can understand.", copy: "VERA brings together available technical checks, reputation signals and context, then separates what is known from what remains uncertain.", tag: "INVESTIGATE", icon: Radar },
  { number: "03", eyebrow: "YOUR DECISION, WITH CONTEXT", title: "Know what you are looking at before you act.", copy: "Get a plain-English assessment, an evidence trail and a practical next step. VERA informs your decision. It never signs or moves funds for you.", tag: "DECIDE", icon: ShieldCheck }
];

function MotionStory() {
  const [active, setActive] = useState(0);
  const chapter = motionChapters[active];
  const Icon = chapter.icon;
  const move = (direction: number) => setActive((current) => (current + direction + motionChapters.length) % motionChapters.length);
  return <section className="motion-story" aria-label="How VERA helps you decide">
    <div className="motion-story-top"><span className="motion-eyebrow"><span className="motion-live-dot" /> A BETTER MOMENT TO DECIDE</span><span className="motion-counter">CHAPTER {String(active + 1).padStart(2, "0")} <i /> 03</span></div>
    <div className="motion-story-heading"><h2>Before the click.<br/><em>Before the cost.</em></h2><p>One deliberate pause can change what happens next.</p></div>
    <div className="motion-track" aria-label="Story chapters">
      {motionChapters.map((item, index) => <button key={item.number} className={index === active ? "motion-track-step active" : "motion-track-step"} onClick={() => setActive(index)} aria-current={index === active ? "step" : undefined}><span>{item.number}</span><i><b /></i><small>{item.tag}</small></button>)}
    </div>
    <div className="motion-stage" key={chapter.number}>
      <div className="motion-stage-copy">
        <span className="motion-stage-index">{chapter.number} / {chapter.eyebrow}</span>
        <h3>{chapter.title}</h3><p>{chapter.copy}</p>
        <div className="motion-stage-bottom"><span><Icon size={15}/>{chapter.tag === "PAUSE" ? "Slow the moment down" : chapter.tag === "INVESTIGATE" ? "Follow the evidence" : "Keep control in your hands"}</span><div className="motion-arrows"><button onClick={() => move(-1)} aria-label="Previous chapter"><ArrowDownRight size={17} className="motion-prev-icon"/></button><button onClick={() => move(1)} aria-label="Next chapter"><ArrowUpRight size={17}/></button></div></div>
      </div>
      <div className="motion-visual" aria-hidden="true">
        <div className="motion-visual-grid"/>
        <div className="motion-visual-orbit orbit-one"/><div className="motion-visual-orbit orbit-two"/>
        <div className="motion-core"><Icon size={28}/><span>VERA</span><small>DECISION INTELLIGENCE</small></div>
        <div className="motion-signal signal-a"><span className="signal-status"/> {active === 0 ? "ACTION DETECTED" : active === 1 ? "SIGNALS CORRELATED" : "ASSESSMENT READY"}</div>
        <div className="motion-signal signal-b">{active === 0 ? "PAUSE BEFORE YOU SIGN" : active === 1 ? "EVIDENCE / CONTEXT / RISK" : "YOU REMAIN IN CONTROL"}</div>
        <div className="motion-visual-index">VERA / {chapter.number}</div>
      </div>
    </div>
    <div className="motion-story-foot"><span>READ-ONLY BY DESIGN</span><span>NO WALLET CONNECTION REQUIRED</span><span>UNCERTAINTY IS SHOWN, NOT HIDDEN</span></div>
  </section>;
}

const roadmapPhases = [
  {
    phase: "01",
    window: "0–6 WEEKS",
    title: "Make the verdict obvious.",
    outcome: "A user understands SAFE, CAUTION, REVIEW or NOT SAFE in one glance.",
    builds: "Hard verdict policy, evidence precedence, freshness, provider health and regression fixtures.",
    exit: "Every verdict is reproducible from recorded evidence.",
    tag: "TRUST"
  },
  {
    phase: "02",
    window: "6–12 WEEKS",
    title: "Understand the transaction.",
    outcome: "VERA explains what a Solana transaction is actually trying to do.",
    builds: "Instruction decoding, program registry, signer roles, asset flows, recipient screening and authority changes.",
    exit: "Known transaction fixtures classify correctly.",
    tag: "INTENT"
  },
  {
    phase: "03",
    window: "3–5 MONTHS",
    title: "Follow the attack path.",
    outcome: "A message and the destination it points to become one investigation.",
    builds: "All-link inspection, impersonation heuristics, lookalike domains, QR/link expansion, shareable reports.",
    exit: "One investigation explains message cues and downstream target risk.",
    tag: "CONTEXT"
  },
  {
    phase: "04",
    window: "5–7 MONTHS",
    title: "Build the threat graph.",
    outcome: "VERA learns relationships between domains, wallets, URLs, brands and transactions.",
    builds: "Entity graph, reusable indicators, user reports, verdict feedback, deduplication and correction workflows.",
    exit: "Repeated indicators become faster to assess and user feedback improves evaluation.",
    tag: "NETWORK"
  },
  {
    phase: "05",
    window: "7–10 MONTHS",
    title: "Become infrastructure.",
    outcome: "Other products can call VERA before their users act.",
    builds: "API, SDK, batch scans, webhooks, embeddable decision cards, audit logs and provider health.",
    exit: "An external product receives a stable verdict and evidence schema.",
    tag: "PLATFORM"
  },
  {
    phase: "06",
    window: "10–12 MONTHS",
    title: "Stay useful after the scan.",
    outcome: "VERA becomes continuous protection, not a one-time checker.",
    builds: "Watchlists, recurring re-checks, address monitoring, domain-change detection, alerts and team policies.",
    exit: "Users return because VERA detects change, not because they remember to scan.",
    tag: "EVERGREEN"
  }
];

function RoadmapSection() {
  const [active, setActive] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const phase = roadmapPhases[active];

  function move(delta: number) {
    setActive((current) => Math.max(0, Math.min(roadmapPhases.length - 1, current + delta)));
  }

  return <section className="roadmap-section motion-visible" id="roadmap">
    <div className="roadmap-heading">
      <div>
        <div className="section-label">THE ROAD AHEAD</div>
        <h2>Built to become <strong>evergreen.</strong></h2>
      </div>
      <p>From a frictionless beta scanner to a continuous safety layer for the moments before you act.</p>
    </div>

    <div className="roadmap-rail" aria-label="VERA roadmap timeline">
      <div className="roadmap-rail-line"><span style={{ width: `${(active / (roadmapPhases.length - 1)) * 100}%` }} /></div>
      {roadmapPhases.map((item, index) => <button type="button" key={item.phase} className={`roadmap-node ${index === active ? "active" : ""} ${index < active ? "complete" : ""}`} onClick={() => setActive(index)} aria-label={`Roadmap phase ${item.phase}: ${item.title}`}>
        <span>{item.phase}</span><i />
      </button>)}
    </div>

    <div
      className="roadmap-card"
      onPointerDown={(event) => { setDragStart(event.clientX); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerUp={(event) => {
        if (dragStart !== null) {
          const delta = event.clientX - dragStart;
          if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
        }
        setDragStart(null);
      }}
      onPointerCancel={() => setDragStart(null)}
    >
      <div className="roadmap-card-main">
        <div className="roadmap-meta"><span>{phase.phase} / {phase.tag}</span><strong>{phase.window}</strong></div>
        <h3>{phase.title}</h3>
        <p className="roadmap-outcome">{phase.outcome}</p>
        <div className="roadmap-detail-grid">
          <div><span>PRIORITY BUILDS</span><p>{phase.builds}</p></div>
          <div><span>EXIT CRITERIA</span><p>{phase.exit}</p></div>
        </div>
      </div>
      <div className="roadmap-visual" aria-hidden="true">
        <div className="roadmap-grid" />
        <div className="roadmap-orbit orbit-a" />
        <div className="roadmap-orbit orbit-b" />
        <div className="roadmap-core"><span>VERA</span><small>{phase.tag}</small></div>
        <div className="roadmap-marker marker-left"><i />{phase.phase === "01" ? "VERDICT" : phase.phase === "02" ? "INTENT" : phase.phase === "03" ? "ATTACK PATH" : phase.phase === "04" ? "THREAT GRAPH" : phase.phase === "05" ? "API / SDK" : "CONTINUOUS"}</div>
        <div className="roadmap-marker marker-right">{phase.phase === "06" ? "WATCH / ALERT" : `NEXT · ${roadmapPhases[Math.min(active + 1, roadmapPhases.length - 1)].tag}`}<i /></div>
        <span className="roadmap-visual-index">2026 → 2027</span>
      </div>
    </div>

    <div className="roadmap-controls">
      <div><span>Swipe or use the controls</span><b>{String(active + 1).padStart(2, "0")} / {String(roadmapPhases.length).padStart(2, "0")}</b></div>
      <div>
        <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous roadmap phase"><ArrowDownRight size={16} className="roadmap-prev" /></button>
        <button type="button" onClick={() => move(1)} disabled={active === roadmapPhases.length - 1} aria-label="Next roadmap phase"><ArrowUpRight size={16} /></button>
      </div>
    </div>

    <div className="roadmap-principle"><ShieldCheck size={14} /><span>Evergreen by design</span><p>New intelligence becomes a module, new evidence improves decisions, and continuous monitoring creates the reason to return.</p><a href="https://github.com/verabuild/Vera/blob/main/ROADMAP.md" target="_blank" rel="noreferrer noopener">View the full roadmap <ExternalLink size={11} /></a></div>
  </section>;
}

function StatusReportPanel({ assessment }: { assessment: Assessment }) {
  const report = assessment.statusReport;
  if (!report) return null;
  const overallLabel = report.overall === "CONFIRMED_FINDING"
    ? "CONFIRMED FINDING"
    : report.overall === "COMPLETE"
      ? "INVESTIGATION COMPLETE"
      : "INVESTIGATION PARTIAL";

  return <div className="status-report">
    <div className="status-report-head">
      <div><p className="eyebrow">INVESTIGATION STATUS</p><h3>{overallLabel}</h3></div>
      <div className="status-coverage"><strong>{report.coverage}%</strong><span>coverage</span></div>
    </div>
    <div className="status-summary">
      <span>{report.decisiveFindings} decisive signal{report.decisiveFindings === 1 ? "" : "s"}</span>
      <span>Checked {new Date(report.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
    <div className="status-checks">
      {report.checks.map((check) => <div className="status-check" key={check.name}>
        <span className={`status-check-dot status-${check.status.toLowerCase()}`} />
        <div><strong>{check.name}</strong><span>{check.status.replace("_", " ")}</span></div>
      </div>)}
    </div>
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
    <StatusReportPanel assessment={assessment} />
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
      <div className="evidence-main"><div className="evidence-title"><strong>{item.title}</strong><span>{item.state}</span></div><p>{item.detail}</p><small>{item.source}</small>{Array.isArray(item.metadata?.reports) && <div className="evidence-links">{item.metadata.reports.map((report, index) => { if (typeof report !== "object" || report === null) return null; const link = report as Record<string, unknown>; if (typeof link.url !== "string" || !(link.url.startsWith("https://") || link.url.startsWith("http://"))) return null; return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + index}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>; })}</div>}{Array.isArray(item.metadata?.results) && <div className="evidence-links">{item.metadata.results.map((report, index) => { if (typeof report !== "object" || report === null) return null; const link = report as Record<string, unknown>; if (typeof link.url !== "string" || !(link.url.startsWith("https://") || link.url.startsWith("http://"))) return null; return <a href={link.url} target="_blank" rel="noreferrer noopener" key={link.url + index}>{typeof link.title === "string" ? link.title : link.url}<ExternalLink size={11} /></a>; })}</div>}</div>
    </div>)}</div>
  </section>;
}

export default function App() {
  const legalPath = window.location.pathname.replace(/\\/+$/, "");
  if (legalPath === "/terms" || legalPath === "/privacy" || legalPath === "/cookies" || legalPath === "/disclosures") {
    return <LegalPage page={legalPath.slice(1) as "terms" | "privacy" | "cookies" | "disclosures"} />;
  }
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">(() => {
    try { return (localStorage.getItem("vera-theme") as "light" | "dark" | "auto") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const resolved = themeMode === "auto" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : themeMode;
      root.dataset.theme = resolved;
    };
    applyTheme();
    try { localStorage.setItem("vera-theme", themeMode); } catch { /* storage may be unavailable */ }
    const preference = window.matchMedia("(prefers-color-scheme: light)");
    preference.addEventListener("change", applyTheme);
    return () => preference.removeEventListener("change", applyTheme);
  }, [themeMode]);
  const [mode, setMode] = useState<InputType>("URL");
  const [input, setInput] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<Scan[]>([]);
  const [busy, setBusy] = useState(false);
  const [network, setNetwork] = useState<Network>("mainnet");
  const [error, setError] = useState<string | null>(null);
  const [signupPrompt, setSignupPrompt] = useState(false);
  const { getAccessToken } = usePrivy();
  const [cursor, setCursor] = useState({ x: 50, y: 50 });

  useEffect(() => setHistory(loadScans()), []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(".impact-section, .principles, .history, .result-section, .motion-story, .scanner-shell, .hero-copy");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("motion-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("motion-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const placeholder = useMemo(() => ({
    URL: "Paste a link you want VERA to inspect…",
    MESSAGE: "Paste the message, DM or email you want VERA to analyse…",
    WALLET: "Paste a Solana wallet address…",
    TX: "Paste a Solana transaction signature…"
  }[mode]), [mode]);

  async function scan() {
    setBusy(true); setError(null); setSignupPrompt(false);
    try {
      const accessToken = import.meta.env.VITE_PRIVY_APP_ID ? await getAccessToken() : null;
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        credentials: "same-origin",
        body: JSON.stringify({ inputType: mode, input: input.trim(), network })
      });
      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      let data: { id?: string; createdAt?: string; assessment?: Assessment; error?: string; detail?: string; signupRequired?: boolean } = {};
      if (raw) {
        if (contentType.includes("application/json")) {
          try { data = JSON.parse(raw); } catch { /* fall through to raw server error */ }
        } else {
          data.error = raw;
        }
      }
      if (!response.ok) {
        if (data.signupRequired) setSignupPrompt(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation failed");
      if (!assessment) {
        setAssessment({
          state: "UNKNOWN",
          headline: "Live investigation is temporarily unavailable",
          explanation: "VERA could not reach the live evidence service. This fallback does not claim a live finding.",
          action: "Retry the investigation.",
          evidence: [],
          confidence: "LOW",
          network
        });
      }
    }
    finally { setBusy(false); }
  }

  function clear() { setInput(""); setAssessment(null); setError(null); }
  function restore(scan: Scan) { setMode(scan.type); setInput(scan.input); setAssessment(scan.assessment); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <main onMouseMove={(event) => { const r = event.currentTarget.getBoundingClientRect(); setCursor({ x: ((event.clientX-r.left)/r.width)*100, y: ((event.clientY-r.top)/r.height)*100 }); }} style={{ "--mx": `${cursor.x}%`, "--my": `${cursor.y}%` } as React.CSSProperties}>
    <nav className="nav">
      <div className="brand"><img className="brand-logo" src="/vera-logo.jpg" alt="VERA" /></div>
      <div className="nav-center"><span className="nav-live" /><strong>DECISION INTELLIGENCE</strong></div>
      <div className="nav-actions"><span className="nav-status"><ShieldCheck size={13} /> READ-ONLY</span>{import.meta.env.VITE_PRIVY_APP_ID ? <AuthControls /> : <span className="auth-status">SIGN-IN SETUP PENDING</span>}<button className="ghost-button">How it works <ChevronRight size={14} /></button></div>
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

        {(mode === "WALLET" || mode === "TX") && <div className="network-row"><span className="eyebrow">SOLANA NETWORK</span><div><button className={`network-choice ${network === "mainnet" ? "active" : ""}`} onClick={() => setNetwork("mainnet")}>Mainnet</button><button className={`network-choice ${network === "devnet" ? "active" : ""}`} onClick={() => setNetwork("devnet")}>Devnet</button></div></div>}

        <div className="input-wrap">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} rows={4} spellCheck={false} />
          <button className="paste" onClick={() => navigator.clipboard?.readText().then(setInput)}><ClipboardPaste size={14} /> Paste</button>
        </div>

        {error && <div className="error-note"><TriangleAlert size={15} />{error}</div>}
        {signupPrompt && import.meta.env.VITE_PRIVY_APP_ID && <SignupPrompt />}
        {busy && <LiveInvestigation />}
        <button className="scan-button" onClick={scan} disabled={busy || !input.trim()}>{busy ? <><RefreshCw size={16} className="spin" /> Investigating signals…</> : <><ScanSearch size={16} /> Investigate with VERA <ArrowUpRight size={16} /></>}</button>
        <div className="trust-note"><Check size={13} /> No wallet connection required <span /> <LockKeyhole size={12} /> Read-only investigation <span /> <Activity size={12} /> Live evidence</div>
      </div>
    </section>

    <MotionStory />

    <ImpactSection />

    {assessment && <section className="result-section" id="result"><div className="section-label">INVESTIGATION RESULT</div><AssessmentPanel assessment={assessment} /><button className="secondary-button" onClick={clear}><X size={14} /> Start new investigation</button></section>}

    <section className="principles">
      <div className="section-intro"><div className="section-label">THE VERA METHOD</div><h2>From raw signals to a <strong>clear next move.</strong></h2><p>VERA separates what was observed from what it means, so you can act with context instead of guesswork.</p></div>
      <div className="principle-grid">
        <article><span>01</span><BrainCircuit size={21} /><h3>Understand</h3><p>Translate technical complexity into plain language without hiding consequences.</p></article>
        <article><span>02</span><Fingerprint size={21} /><h3>Verify</h3><p>Connect live and deterministic signals to the evidence actually available.</p></article>
        <article><span>03</span><ArrowUpRight size={21} /><h3>Act</h3><p>Turn the assessment into a specific, practical next step.</p></article>
      </div>
    </section>

    <RoadmapSection />

     <section className="history">
      <div className="history-head"><div><div className="section-label">INVESTIGATION TRAIL</div><h2>Recent checks</h2></div><span className="muted"><LockKeyhole size={11} /> Stored locally in this demo</span></div>
      {history.length === 0 ? <div className="empty"><FileSearch size={20} /><div><strong>No investigations yet</strong><p>Your recent checks will appear here after you investigate something.</p></div></div> : <div className="history-list">{history.map((scan) => <button className="history-row" key={scan.id} onClick={() => restore(scan)}><span className="history-type">{scan.type}</span><span className="history-input">{scan.input}</span><StateBadge state={scan.assessment.state} /><ChevronRight size={16} /></button>)}</div>}
    </section>

    <footer className="site-footer"><div className="footer-brand"><div className="brand"><img className="brand-logo" src="/vera-logo.jpg" alt="VERA" /></div><p>Know before you act.</p><small>Evidence before action. No financial execution.</small></div><nav className="footer-links" aria-label="Project links"><a href="https://github.com/verabuild/Vera" target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> GitHub <span>Source code</span></a><a href="https://x.com/verabuild" target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> X <span>@verabuild</span></a><a href="mailto:verabuild1@gmail.com"><ExternalLink size={14} /> Email <span>verabuild1@gmail.com</span></a><a href="#roadmap"><ExternalLink size={14} /> Roadmap <span>6–12 month product path</span></a><a href="https://github.com/verabuild/Vera/blob/main/README.md" target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Documentation <span>Project overview</span></a></nav><div className="footer-legal"><nav className="legal-links" aria-label="Legal"><a href="/terms" target="_blank" rel="noreferrer noopener">Terms</a><a href="/privacy" target="_blank" rel="noreferrer noopener">Privacy</a><a href="/cookies" target="_blank" rel="noreferrer noopener">Cookies</a><a href="/disclosures" target="_blank" rel="noreferrer noopener">Risk disclosures</a></nav><div className="theme-switch" role="group" aria-label="Colour theme">{(["light", "dark", "auto"] as const).map((theme) => <button key={theme} type="button" className={themeMode === theme ? "active" : ""} aria-pressed={themeMode === theme} onClick={() => setThemeMode(theme)}>{theme[0].toUpperCase() + theme.slice(1)}</button>)}</div><small className="footer-copyright">VERA · Decision intelligence</small></div></footer>
    <Analytics />
  </main>;
}
