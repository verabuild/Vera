import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleHelp, Compass, ExternalLink, Fingerprint, Layers3, LockKeyhole, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { OFFICIAL_VERA_LOGO } from "../lib/brand";

const researchTracks = [
  {
    id: "utility",
    number: "01",
    label: "Ecosystem utility",
    title: "Security utility built around real investigations.",
    summary: "Our token utility roadmap connects $VERA to three practical parts of the security ecosystem: advanced investigations, verified intelligence contributions and ecosystem participation.",
    points: [
      ["Optional investigation credits", "Planned utility: use $VERA-linked credits for advanced investigation workflows and higher-volume usage. Essential safety information remains accessible without token ownership."],
      ["Validated threat intelligence", "Planned contributor program: recognize independently validated threat reports and useful security intelligence, with quality controls to prevent spam and false reporting."],
      ["Ecosystem participation", "Planned ecosystem participation: connect contributors and integrations to product development through defined participation programs and transparent eligibility."]
    ]
  },
  {
    id: "economics",
    number: "02",
    label: "Supply & economics",
    title: "Defined launch parameters. Transparent economics.",
    summary: "$VERA launches with an announced supply of one billion tokens on Robinhood Chain. The economic model prioritizes sustainable product development and transparent launch terms.",
    points: [
      ["Total supply", "1,000,000,000 $VERA is the announced total supply. On-chain supply must be verified against the official contract after deployment."],
      ["Distribution and vesting", "Allocation percentages, team or contributor vesting, public distribution and treasury arrangements remain to be determined and disclosed."],
      ["Liquidity and market risks", "Liquidity arrangements and launch mechanics have not been publicly confirmed. Liquidity is not backing, and no price, volume or return is promised."]
    ]
  },
  {
    id: "governance",
    number: "03",
    label: "Risk & governance",
    title: "Trust must be built into the design.",
    summary: "Security, accountability and transparent operations are core principles of the $VERA ecosystem.",
    points: [
      ["Independent security review", "Prioritize contract verification, security testing and independent assessment of supporting infrastructure."],
      ["Legal and jurisdictional review", "Maintain appropriate distribution disclosures and review applicable legal and operational requirements."],
      ["Abuse and fairness controls", "Design contributor eligibility and reward controls to address Sybil abuse, false reporting and concentration risks."]
    ]
  }
];

const gates = [
  { title: "Product-led development", detail: "Prioritize utility that solves identifiable needs for investigators, contributors and ecosystem developers." },
  { title: "Sustainable infrastructure", detail: "Build durable security services through engineering, reliable data infrastructure and product adoption." },
  { title: "Security and legal assessment", detail: "Independent technical review and qualified legal advice appropriate to the final design." },
  { title: "Transparent public terms", detail: "Publish the final supply, distribution, vesting, liquidity and risk disclosures before launch." }
];

const questions = [
  ["Has $VERA launched?", "$VERA is live on Robinhood Chain. Official contract: 0xbaf6033ccd41734acc7e14038c9b06910543650e. Verify before interacting."],
  ["What is the announced supply?", "The announced total supply is 1,000,000,000 $VERA. The on-chain supply has not yet been verified."],
  ["Which network is $VERA on?", "Robinhood Chain. Official contract: 0xbaf6033ccd41734acc7e14038c9b06910543650e."],
  ["Which launch platform will be used?", "The official purchase link is available above."],
  ["What will $VERA do?", "The utility roadmap focuses on advanced investigation credits, validated threat-intelligence contributions and ecosystem participation. These token-linked features are planned development milestones, distinct from Vera's existing investigation product."],
  ["Will users need $VERA to use Vera safely?", "No. Essential safety information remains accessible without token ownership. Token-linked features are intended to extend the experience."],
  ["Is there a price or promised return?", "No. This page makes no price, profit, backing, trading-volume or future-value promise."]
];

export default function VeraTokenPage() {
  const [activeTrack, setActiveTrack] = useState("utility");
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const track = researchTracks.find((item) => item.id === activeTrack) ?? researchTracks[0];

  return <main className="token-page">
    <header className="token-nav">
      <a className="token-brand" href="/" aria-label="VERA homepage"><img src={OFFICIAL_VERA_LOGO} alt="VERA" /><span>VERA <i>/</i> ECOSYSTEM TOKEN</span></a>
      <a className="token-back" href="/"><ArrowLeft size={14} /> Back to VERA</a>
    </header>

    <section className="token-hero">
      <div className="token-hero-copy">
        <div className="token-status"><span /> LIVE <i>·</i> ROBINHOOD CHAIN</div>
        <p className="token-eyebrow">THE VERA SECURITY ECOSYSTEM</p>
        <h1>Security before action.<br /><em>Utility with purpose.</em></h1>
        <p className="token-lead">$VERA is the ecosystem token for Vera, a Web2 and Web3 security intelligence platform. Our mission is to make risk assessment accessible before users click, connect, sign or pay. The token utility roadmap extends that mission through advanced investigations, validated intelligence and ecosystem participation.</p>
        <div className="token-hero-actions">
          <a className="token-primary" href="https://ponsfamily.com/launchpad/0xbaf6033ccd41734acc7e14038c9b06910543650e" target="_blank" rel="noopener noreferrer">Buy $VERA <ArrowUpRight size={15} /></a>
          <a className="token-secondary" href="#roadmap">Development roadmap <ChevronDown size={15} /></a>
        </div>
        <div className="token-principles"><span><ShieldCheck size={14} /> Product-led utility</span><span><LockKeyhole size={14} /> Safety without token ownership</span><span><Fingerprint size={14} /> Transparent by design</span></div>
      </div>
      <div className="token-orbit-panel" aria-label="Illustration of the VERA token ecosystem">
        <div className="token-orbit token-orbit-outer" /><div className="token-orbit token-orbit-inner" />
        <div className="token-orbit-node node-top"><Sparkles size={15} /><span>UTILITY</span></div>
        <div className="token-orbit-node node-right"><Scale size={15} /><span>INTELLIGENCE</span></div>
        <div className="token-orbit-node node-bottom"><ShieldCheck size={15} /><span>TRUST</span></div>
        <div className="token-orbit-core"><img src={OFFICIAL_VERA_LOGO} alt="" /><strong>$VERA</strong><small>ROBINHOOD CHAIN</small></div>
        <div className="token-orbit-caption">LIVE / ROBINHOOD CHAIN</div>
      </div>
      <div className="token-hero-index"><span>VERA / ECOSYSTEM</span><span>STATUS 03 — LIVE</span></div>
    </section>

    <section className="token-notice" aria-label="Important token status disclosure">
      <div className="token-notice-icon"><CircleHelp size={19} /></div>
      <div><strong>$VERA is live on Robinhood Chain.</strong><p>Robinhood Chain · 1,000,000,000 $VERA. Verify the official contract below before trading.</p></div>
      <span className="token-notice-tag">LIVE</span>
    </section>

    <section className="token-gates" aria-label="Official token contract"><div className="token-gate-note" style={{flexWrap:"wrap"}}><ShieldCheck size={17}/><div style={{minWidth:0}}><strong>Official contract · Robinhood Chain</strong><p style={{overflowWrap:"anywhere"}}>0xbaf6033ccd41734acc7e14038c9b06910543650e</p><button type="button" className="token-secondary" onClick={async (event) => { const button = event.currentTarget; try { await navigator.clipboard.writeText("0xbaf6033ccd41734acc7e14038c9b06910543650e"); button.textContent="Copied"; } catch { button.textContent="Select and copy address above"; } }}>Copy contract</button></div><a className="token-primary" href="https://ponsfamily.com/launchpad/0xbaf6033ccd41734acc7e14038c9b06910543650e" target="_blank" rel="noopener noreferrer">Buy $VERA</a><a className="token-secondary" href="https://dexscreener.com/search?q=0xbaf6033ccd41734acc7e14038c9b06910543650e" target="_blank" rel="noopener noreferrer">DEX Screener search</a><a className="token-secondary" href="https://www.geckoterminal.com/search?query=0xbaf6033ccd41734acc7e14038c9b06910543650e" target="_blank" rel="noopener noreferrer">GeckoTerminal search</a></div></section>
    <section className="token-gates" id="tokenomics">
      <div className="token-section-heading"><div><span className="token-kicker">01 / TOKENOMICS</span><h2>$VERA at a glance.<br /><em>Built for the ecosystem.</em></h2></div><p>The official launch date, network and announced token supply.</p></div>
      <div className="token-gate-grid">
        <article><div className="token-gate-top"><span>NETWORK</span><Layers3 size={15} /></div><h3>Robinhood Chain</h3><p>Announced network for the $VERA token launch.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>ANNOUNCED TOTAL SUPPLY</span><Scale size={15} /></div><h3>1,000,000,000 $VERA</h3><p>One billion tokens announced for the ecosystem.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>LAUNCH SCHEDULE</span><Compass size={15} /></div><h3>November 28</h3><p>2026 · 11 AM UTC.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>TOKEN PURPOSE</span><LockKeyhole size={15} /></div><h3>Ecosystem utility</h3><p>Advanced investigations, intelligence contributions and ecosystem participation are the planned utility pillars.</p><div className="token-gate-line"><span /></div></article>
      </div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Official token information</strong> The official contract is published above. Distribution, vesting and liquidity details remain subject to verification. No trading volume or financial return is promised.</p></div>
    </section>

    <section className="token-gates" id="product">
      <div className="token-section-heading"><div><span className="token-kicker">THE PRODUCT BEHIND $VERA</span><h2>Built before the token.<br /><em>Building beyond the launch.</em></h2></div><p>Vera brings security evidence into one investigation experience so users can understand risk before taking action.</p></div>
      <div className="token-gate-grid">
        <article><div className="token-gate-top"><span>WEB SECURITY</span><ShieldCheck size={15} /></div><h3>Link &amp; message intelligence</h3><p>Investigate suspicious URLs and messages using available threat intelligence, domain context and evidence-led explanations.</p></article>
        <article><div className="token-gate-top"><span>ON-CHAIN SECURITY</span><Fingerprint size={15} /></div><h3>Solana investigations</h3><p>Inspect public wallet and transaction activity and review associated risk evidence in the investigation workspace.</p></article>
        <article><div className="token-gate-top"><span>MULTICHAIN DEVELOPMENT</span><Layers3 size={15} /></div><h3>EVM expansion</h3><p>Extend investigation infrastructure across Ethereum, Base, Polygon, Arbitrum, BNB Smart Chain and Robinhood Chain. Availability varies by network and release validation.</p></article>
        <article><div className="token-gate-top"><span>DECISION INTELLIGENCE</span><Compass size={15} /></div><h3>Evidence into action</h3><p>Present findings, source coverage and practical next steps in plain language. A risk assessment does not guarantee safety.</p></article>
      </div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Product first.</strong> <a href="/">Open the investigation console</a> and experience Vera directly.</p></div>
    </section>

    <section className="token-research" id="research">
      <div className="token-section-heading"><div><span className="token-kicker">02 / UTILITY & ECONOMICS</span><h2>Designed around<br /><em>real product value.</em></h2></div><p>Three connected pillars define the utility roadmap. Vera's existing investigation product is the foundation; token-linked features will be delivered in stages.</p></div>
      <div className="token-research-layout">
        <div className="token-track-list" role="tablist" aria-label="Token research tracks">
          {researchTracks.map((item) => <button type="button" role="tab" aria-selected={activeTrack === item.id} className={activeTrack === item.id ? "active" : ""} key={item.id} onClick={() => setActiveTrack(item.id)}><span>{item.number}</span><strong>{item.label}</strong><ArrowUpRight size={15} /></button>)}
          <div className="token-track-foot"><Compass size={16} /><span>Real investigations.<br />Practical utility.</span></div>
        </div>
        <article className="token-track-detail" key={track.id} role="tabpanel">
          <div className="token-detail-meta"><span>ECOSYSTEM PILLAR {track.number}</span><span><i /> DEVELOPMENT ROADMAP</span></div>
          <h3>{track.title}</h3><p className="token-detail-summary">{track.summary}</p>
          <div className="token-question-list">{track.points.map(([title, detail], index) => <div className="token-question-row" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{detail}</p></div><Layers3 size={15} /></div>)}</div>
        </article>
      </div>
    </section>

    <section className="token-gates" id="roadmap">
      <div className="token-section-heading"><div><span className="token-kicker">03 / DEVELOPMENT ROADMAP</span><h2>Build the product.<br /><em>Grow the ecosystem.</em></h2></div><p>The token roadmap follows Vera's product development. Each stage depends on delivery, evidence and responsible review.</p></div>
      <div className="token-gate-grid">
        <article><div className="token-gate-top"><span>PHASE / 01</span><Check size={15} /></div><h3>Launch & community growth</h3><p>Publish verified launch details and transparent terms, and grow an informed community around Vera.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PHASE / 02</span><Check size={15} /></div><h3>Security infrastructure</h3><p>Expand investigation capabilities, threat-intelligence coverage and multi-chain security infrastructure.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PHASE / 03</span><Check size={15} /></div><h3>Utility development</h3><p>Develop and test advanced investigation credits and a validated intelligence contribution program; publish eligibility, feature access and safeguards before activation.</p><div className="token-gate-line"><span /></div></article>
        <article><div className="token-gate-top"><span>PHASE / 04</span><Check size={15} /></div><h3>Long-term expansion</h3><p>Expand toward developer APIs, continuous monitoring and ecosystem integrations, with token-linked participation introduced where supported by the product.</p><div className="token-gate-line"><span /></div></article>
      </div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Development funding vision</strong> Development priorities include engineering, security reviews, RPC and data services, ecosystem integrations and community growth.</p></div>
    </section>

    <section className="token-faq" id="decision-gates">
      <div className="token-section-heading"><div><span className="token-kicker">04 / ECOSYSTEM STANDARDS</span><h2>Built on security.<br /><em>Designed for trust.</em></h2></div><p>Our standards guide product delivery, token utility and the protection of users across the ecosystem.</p></div>
      <div className="token-gate-grid">{gates.map((gate, index) => <article key={gate.title}><div className="token-gate-top"><span>STANDARD / 0{index + 1}</span><Check size={15} /></div><h3>{gate.title}</h3><p>{gate.detail}</p><div className="token-gate-line"><span /></div></article>)}</div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Non-negotiable principle</strong> Essential VERA safety information should remain accessible without token ownership.</p></div>
    </section>

    <section className="token-faq" id="questions">
      <div className="token-section-heading"><div><span className="token-kicker">05 / COMMON QUESTIONS</span><h2>Frequently asked<br /><em>questions.</em></h2></div><p>Announced launch details, planned utility and what users should verify.</p></div>
      <div className="token-faq-list">{questions.map(([question, answer], index) => <article className={openQuestion === index ? "open" : ""} key={question}><button type="button" aria-expanded={openQuestion === index} onClick={() => setOpenQuestion(openQuestion === index ? null : index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><ChevronDown size={17} /></button>{openQuestion === index && <div className="token-faq-answer"><p>{answer}</p></div>}</article>)}</div>
    </section>

    <section className="token-bottom-cta">
      <span className="token-kicker">THE MISSION REMAINS THE SAME</span><h2>Know before you act.<br /><em>Build what comes next.</em></h2><p>Vera is building security intelligence for everyday digital decisions. $VERA extends that mission through a product-led utility roadmap. Discover the investigation platform and follow the official launch.</p>
      <div><a href="/" className="token-primary">Explore VERA <ArrowUpRight size={15} /></a><a href="https://x.com/verabuild" target="_blank" rel="noreferrer noopener" className="token-secondary">Follow official launch updates <ExternalLink size={14} /></a></div>
    </section>

    <footer className="token-footer"><a href="/" className="token-footer-brand"><img src={OFFICIAL_VERA_LOGO} alt="VERA" /><span>VERA <i>⇴</i> Know before you act.</span></a><span>$VERA / LIVE</span><a href="https://github.com/verabuild/Vera" target="_blank" rel="noreferrer noopener">PUBLIC SOURCE <ExternalLink size={12} /></a></footer>
  </main>;
}
