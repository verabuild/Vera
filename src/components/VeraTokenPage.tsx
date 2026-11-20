import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleHelp, Compass, ExternalLink, Fingerprint, Layers3, LockKeyhole, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { OFFICIAL_VERA_LOGO } from "../lib/brand";

const researchTracks = [
  {
    id: "utility",
    number: "01",
    label: "Ecosystem utility",
    title: "Utility should strengthen the product.",
    summary: "The proposed token should have a practical relationship with Vera's security ecosystem. Any utility must be tested against real user needs before it is promised.",
    points: [
      ["Optional investigation credits", "Evaluate whether $VERA could support optional credits for advanced investigations or higher-volume usage without restricting essential safety information."],
      ["Validated threat intelligence", "Explore incentives for useful, independently validated threat intelligence, with safeguards against spam, manipulation and false reports."],
      ["Ecosystem participation", "Assess whether token-based participation can create measurable value for contributors and integrations."]
    ]
  },
  {
    id: "economics",
    number: "02",
    label: "Supply & economics",
    title: "A clear proposal. Details still under review.",
    summary: "The current working proposal is a one-million-token supply on Solana. Distribution, vesting, liquidity and treasury arrangements have not been finalised.",
    points: [
      ["Proposed total supply", "1,000,000 $VERA is the current working supply proposal. The final mint configuration must be validated against the selected launch mechanism before deployment."],
      ["Distribution and vesting", "Allocation percentages, team or contributor vesting, public distribution and treasury arrangements remain to be determined and disclosed."],
      ["Liquidity and market risks", "Liquidity arrangements and launch mechanics remain undecided. Liquidity is not backing, and no price, volume or return is promised."]
    ]
  },
  {
    id: "governance",
    number: "03",
    label: "Risk & governance",
    title: "Trust must be built into the design.",
    summary: "A token proposal cannot move forward responsibly without technical, legal and operational review.",
    points: [
      ["Independent security review", "Any proposed token contracts and supporting infrastructure will require a serious security assessment."],
      ["Legal and jurisdictional review", "Review applicable laws, distribution restrictions, disclosures and operational responsibilities before any commitment."],
      ["Abuse and fairness controls", "Consider Sybil resistance, transparent eligibility, insider concentration, governance capture and incentive abuse."]
    ]
  }
];

const gates = [
  { title: "Demonstrated user demand", detail: "Evidence that the token supports a genuine need for Vera users, contributors or ecosystem partners." },
  { title: "Sustainable product economics", detail: "A credible development-funding model that does not depend on speculative trading or promised returns." },
  { title: "Security and legal assessment", detail: "Independent technical review and qualified legal advice appropriate to the final design." },
  { title: "Transparent public terms", detail: "Publish the final supply, distribution, vesting, liquidity and risk disclosures before launch." }
];

const questions = [
  ["Has $VERA launched?", "No. This page describes a working proposal and roadmap, not a token launch announcement. No contract address or launch date has been published."],
  ["What is the proposed supply?", "The current working proposal is 1,000,000 $VERA. The final mint configuration has not been deployed and must be checked against the selected launch mechanism."],
  ["Which network is planned?", "Solana is the intended network direction. The final deployment details and token contract have not been confirmed."],
  ["Which launch platform will be used?", "The launch platform has not been announced. The route may change as the supply design, launch mechanics and liquidity arrangements are evaluated."],
  ["What will $VERA do?", "Potential utility areas under evaluation include optional advanced-investigation credits, validated threat-intelligence contributions and ecosystem participation. None of these utilities is live or guaranteed."],
  ["Will users need $VERA to use Vera safely?", "No token should be required to access essential safety information. Any future utility must preserve access to core safety features."],
  ["Is there a price or promised return?", "No. This page makes no price, profit, backing, trading-volume or future-value promise."]
];

export default function VeraTokenPage() {
  const [activeTrack, setActiveTrack] = useState("economics");
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const track = researchTracks.find((item) => item.id === activeTrack) ?? researchTracks[1];

  return <main className="token-page">
    <header className="token-nav">
      <a className="token-brand" href="/" aria-label="VERA homepage"><img src={OFFICIAL_VERA_LOGO} alt="VERA" /><span>VERA <i>/</i> ECOSYSTEM TOKEN</span></a>
      <a className="token-back" href="/"><ArrowLeft size={14} /> Back to VERA</a>
    </header>

    <section className="token-hero">
      <div className="token-hero-copy">
        <div className="token-status"><span /> WORKING PROPOSAL <i>·</i> NOT A LAUNCH ANNOUNCEMENT</div>
        <p className="token-eyebrow">THE $VERA TOKEN BRIEF / 001</p>
        <h1>A stronger ecosystem.<br /><em>A clear path forward.</em></h1>
        <p className="token-lead">A proposed Solana ecosystem token designed around Vera's long-term security mission, with a working supply proposal and a roadmap focused on sustainable product growth.</p>
        <div className="token-hero-actions">
          <a className="token-primary" href="#tokenomics">Explore tokenomics <ArrowUpRight size={15} /></a>
          <a className="token-secondary" href="#roadmap">Development roadmap <ChevronDown size={15} /></a>
        </div>
        <div className="token-principles"><span><ShieldCheck size={14} /> Evidence before incentives</span><span><LockKeyhole size={14} /> Safety without token ownership</span><span><Fingerprint size={14} /> Transparent by design</span></div>
      </div>
      <div className="token-orbit-panel" aria-label="Illustration of the proposed VERA token ecosystem">
        <div className="token-orbit token-orbit-outer" /><div className="token-orbit token-orbit-inner" />
        <div className="token-orbit-node node-top"><Sparkles size={15} /><span>UTILITY</span></div>
        <div className="token-orbit-node node-right"><Scale size={15} /><span>GOVERNANCE</span></div>
        <div className="token-orbit-node node-bottom"><ShieldCheck size={15} /><span>TRUST</span></div>
        <div className="token-orbit-core"><img src={OFFICIAL_VERA_LOGO} alt="" /><strong>$VERA</strong><small>WORKING PROPOSAL</small></div>
        <div className="token-orbit-caption">DESIGN IS NOT A COMMITMENT</div>
      </div>
      <div className="token-hero-index"><span>VERA / ECOSYSTEM</span><span>STATUS 01 — PROPOSAL</span></div>
    </section>

    <section className="token-notice" aria-label="Important token status disclosure">
      <div className="token-notice-icon"><CircleHelp size={19} /></div>
      <div><strong>$VERA is a working proposal, not a live token.</strong><p>Solana is the intended network and 1,000,000 tokens is the proposed supply. The launch platform, contract, distribution, allocations, vesting, liquidity and final utility have not been confirmed. Nothing here is an offer to buy or an investment recommendation.</p></div>
      <span className="token-notice-tag">IN DEVELOPMENT</span>
    </section>

    <section className="token-gates" id="tokenomics">
      <div className="token-section-heading"><div><span className="token-kicker">01 / TOKENOMICS</span><h2>A defined starting point.<br /><em>Transparent details.</em></h2></div><p>The current proposal establishes the intended network and supply while leaving launch-dependent decisions open until they can be responsibly verified.</p></div>
      <div className="token-gate-grid">
        <article><div className="token-gate-top"><span>NETWORK</span><Layers3 size={15} /></div><h3>Solana</h3><p>Intended network direction for the $VERA token.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PROPOSED TOTAL SUPPLY</span><Scale size={15} /></div><h3>1,000,000 $VERA</h3><p>Working supply proposal; final mint configuration is subject to launch-mechanism validation.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>LAUNCH PLATFORM</span><Compass size={15} /></div><h3>To be announced</h3><p>Venue and launch mechanics remain under evaluation.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>DISTRIBUTION & LIQUIDITY</span><LockKeyhole size={15} /></div><h3>To be finalised</h3><p>Allocations, vesting and liquidity arrangements will be disclosed before any launch.</p><div className="token-gate-line"><span /></div></article>
      </div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>No artificial certainty</strong> No allocation percentages, liquidity amounts, price targets or returns are being presented as confirmed.</p></div>
    </section>

    <section className="token-research" id="research">
      <div className="token-section-heading"><div><span className="token-kicker">02 / UTILITY & ECONOMICS</span><h2>Designed around<br /><em>real product value.</em></h2></div><p>Explore the areas being evaluated before token utility, distribution and long-term economics are finalised.</p></div>
      <div className="token-research-layout">
        <div className="token-track-list" role="tablist" aria-label="Token research tracks">
          {researchTracks.map((item) => <button type="button" role="tab" aria-selected={activeTrack === item.id} className={activeTrack === item.id ? "active" : ""} key={item.id} onClick={() => setActiveTrack(item.id)}><span>{item.number}</span><strong>{item.label}</strong><ArrowUpRight size={15} /></button>)}
          <div className="token-track-foot"><Compass size={16} /><span>Research first.<br />Decisions only when justified.</span></div>
        </div>
        <article className="token-track-detail" key={track.id} role="tabpanel">
          <div className="token-detail-meta"><span>RESEARCH TRACK {track.number}</span><span><i /> UNDER REVIEW</span></div>
          <h3>{track.title}</h3><p className="token-detail-summary">{track.summary}</p>
          <div className="token-question-list">{track.points.map(([title, detail], index) => <div className="token-question-row" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{detail}</p></div><Layers3 size={15} /></div>)}</div>
        </article>
      </div>
    </section>

    <section className="token-gates" id="roadmap">
      <div className="token-section-heading"><div><span className="token-kicker">03 / DEVELOPMENT ROADMAP</span><h2>Build the product.<br /><em>Grow the ecosystem.</em></h2></div><p>The token roadmap follows Vera's product development. Each stage depends on delivery, evidence and responsible review.</p></div>
      <div className="token-gate-grid">
        <article><div className="token-gate-top"><span>PHASE / 01</span><Check size={15} /></div><h3>Launch & community growth</h3><p>Introduce the token proposal, publish transparent terms and grow an informed community around Vera.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PHASE / 02</span><Check size={15} /></div><h3>Security infrastructure</h3><p>Expand investigation capabilities, threat-intelligence coverage and multi-chain security infrastructure.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PHASE / 03</span><Check size={15} /></div><h3>Utility development</h3><p>Evaluate practical token utility, optional advanced features and accountable ecosystem contributions.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PHASE / 04</span><Check size={15} /></div><h3>Long-term expansion</h3><p>Explore integrations, sustainable development funding and a broader security ecosystem.</p><div className="token-gate-line"><span /></div></article>
      </div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Development funding vision</strong> Potential priorities include engineering, security audits, RPC and data services, ecosystem integrations and community growth. No fundraising target, allocation or proceeds are confirmed on this page.</p></div>
    </section>

    <section className="token-faq" id="decision-gates">
      <div className="token-section-heading"><div><span className="token-kicker">04 / DECISION GATES</span><h2>Progress is earned.<br /><em>Not assumed.</em></h2></div><p>A token should only advance if the product and the people who rely on it benefit from a defensible, transparent model.</p></div>
      <div className="token-gate-grid">{gates.map((gate, index) => <article key={gate.title}><div className="token-gate-top"><span>GATE / 0{index + 1}</span><Check size={15} /></div><h3>{gate.title}</h3><p>{gate.detail}</p><div className="token-gate-line"><span /></div></article>)}</div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Non-negotiable principle</strong> Essential VERA safety information should remain accessible without token ownership.</p></div>
    </section>

    <section className="token-faq" id="questions">
      <div className="token-section-heading"><div><span className="token-kicker">05 / COMMON QUESTIONS</span><h2>Clear answers.<br /><em>No speculation.</em></h2></div><p>What is currently proposed, what remains open and what users should not assume.</p></div>
      <div className="token-faq-list">{questions.map(([question, answer], index) => <article className={openQuestion === index ? "open" : ""} key={question}><button type="button" aria-expanded={openQuestion === index} onClick={() => setOpenQuestion(openQuestion === index ? null : index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><ChevronDown size={17} /></button>{openQuestion === index && <div className="token-faq-answer"><p>{answer}</p></div>}</article>)}</div>
    </section>

    <section className="token-bottom-cta">
      <span className="token-kicker">THE MISSION REMAINS THE SAME</span><h2>Know before you act.<br /><em>Build what comes next.</em></h2><p>$VERA is being explored as part of a wider vision for a more accessible, evidence-led crypto security ecosystem. Product value comes first; token decisions must support it.</p>
      <div><a href="/" className="token-primary">Return to VERA <ArrowUpRight size={15} /></a><a href="https://github.com/verabuild/Vera/blob/main/ROADMAP.md" target="_blank" rel="noreferrer noopener" className="token-secondary">Read the public roadmap <ExternalLink size={14} /></a></div>
    </section>

    <footer className="token-footer"><a href="/" className="token-footer-brand"><img src={OFFICIAL_VERA_LOGO} alt="VERA" /><span>VERA <i>⇴</i> Know before you act.</span></a><span>$VERA / WORKING PROPOSAL</span><a href="https://github.com/verabuild/Vera" target="_blank" rel="noreferrer noopener">PUBLIC SOURCE <ExternalLink size={12} /></a></footer>
  </main>;
}
