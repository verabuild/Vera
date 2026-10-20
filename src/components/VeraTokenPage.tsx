import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleHelp, Compass, ExternalLink, Fingerprint, Layers3, LockKeyhole, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { OFFICIAL_VERA_LOGO } from "../lib/brand";

const researchTracks = [
  {
    id: "utility",
    number: "01",
    label: "Potential utility",
    title: "Utility must solve a real product need.",
    summary: "Any future role for $VERA would need to be useful to the VERA ecosystem, not a requirement added simply to create demand for a token.",
    points: [
      ["Optional product credits", "Assess whether credits for advanced investigations or higher-volume usage make sense without restricting essential safety information."],
      ["Threat intelligence contributions", "Explore accountable ways to reward validated, useful intelligence, with safeguards against spam, manipulation and false reports."],
      ["Ecosystem participation", "Evaluate whether a token adds measurable value to integrations, contributors or ecosystem funding compared with simpler alternatives."]
    ]
  },
  {
    id: "economics",
    number: "02",
    label: "Token economics",
    title: "The model comes after the evidence.",
    summary: "Supply, distribution and incentives should follow a validated product model. They are not being presented as settled decisions.",
    points: [
      ["Supply and distribution", "Research supply design, allocation principles, vesting and transparent disclosure before considering any proposal."],
      ["Treasury and sustainability", "Evaluate funding needs, treasury governance, long-term operating costs and conflicts of interest."],
      ["Liquidity and market risks", "Assess market structure, concentration, manipulation risks and clear disclosures. Liquidity is not backing or a promise of value."]
    ]
  },
  {
    id: "governance",
    number: "03",
    label: "Risk & governance",
    title: "Trust is a launch requirement.",
    summary: "A token proposal cannot move forward responsibly without security, legal and operational review.",
    points: [
      ["Independent security review", "Any proposed contracts would require a serious security assessment and a clear plan for handling vulnerabilities."],
      ["Legal and jurisdictional review", "Review applicable laws, distribution restrictions, disclosures and operational responsibilities before making commitments."],
      ["Abuse and fairness controls", "Consider Sybil resistance, transparent eligibility, governance capture, insider concentration and incentive abuse."]
    ]
  }
];

const gates = [
  { title: "Demonstrated user demand", detail: "Evidence that a token solves a genuine problem for VERA users or contributors." },
  { title: "Sustainable product economics", detail: "A credible operating model that does not depend on speculative demand." },
  { title: "Security and legal assessment", detail: "Independent technical review and qualified legal advice appropriate to the eventual design." },
  { title: "Transparent public proposal", detail: "Clear, reviewable terms, risks, distribution principles and a documented decision before any launch commitment." }
];

const questions = [
  ["Has $VERA launched?", "No launch is being announced on this page. $VERA is a proposed ecosystem-token research topic, and this page documents what is being evaluated."],
  ["What is the token supply or allocation?", "No supply, allocation, vesting schedule or treasury distribution has been confirmed. Those parameters remain undecided."],
  ["Which blockchain or contract will it use?", "No network or token contract has been confirmed. Do not treat any address shared elsewhere as official based on this page."],
  ["Does $VERA have a price or promised return?", "No. This page makes no price, return, profit, backing or future-value promise."],
  ["Will users need a token to use VERA safely?", "The research principle is that essential safety information should remain accessible without token ownership. Any future product model must be evaluated against that principle."],
  ["When will it launch?", "There is no confirmed timeline. A decision would depend on product evidence, sustainability, security and legal review."]
];

export default function VeraTokenPage() {
  const [activeTrack, setActiveTrack] = useState("utility");
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const track = researchTracks.find((item) => item.id === activeTrack) ?? researchTracks[0];

  return <main className="token-page">
    <header className="token-nav">
      <a className="token-brand" href="/" aria-label="VERA homepage"><img src={OFFICIAL_VERA_LOGO} alt="VERA" /><span>VERA <i>/</i> ECOSYSTEM RESEARCH</span></a>
      <a className="token-back" href="/"><ArrowLeft size={14} /> Back to VERA</a>
    </header>

    <section className="token-hero">
      <div className="token-hero-copy">
        <div className="token-status"><span /> PROPOSED RESEARCH <i>·</i> NO LAUNCH ANNOUNCED</div>
        <p className="token-eyebrow">THE $VERA RESEARCH BRIEF / 001</p>
        <h1>Build the ecosystem.<br /><em>Earn the right to expand it.</em></h1>
        <p className="token-lead">A transparent look at the proposed $VERA ecosystem token: what we are evaluating, what must be proven, and what has not been decided.</p>
        <div className="token-hero-actions">
          <a className="token-primary" href="#research">Explore the research <ArrowUpRight size={15} /></a>
          <a className="token-secondary" href="#decision-gates">Decision criteria <ChevronDown size={15} /></a>
        </div>
        <div className="token-principles"><span><ShieldCheck size={14} /> Evidence before incentives</span><span><LockKeyhole size={14} /> Safety without token ownership</span><span><Fingerprint size={14} /> No invented parameters</span></div>
      </div>
      <div className="token-orbit-panel" aria-label="Illustration of the proposed VERA ecosystem research">
        <div className="token-orbit token-orbit-outer" /><div className="token-orbit token-orbit-inner" />
        <div className="token-orbit-node node-top"><Sparkles size={15} /><span>UTILITY</span></div>
        <div className="token-orbit-node node-right"><Scale size={15} /><span>GOVERNANCE</span></div>
        <div className="token-orbit-node node-bottom"><ShieldCheck size={15} /><span>TRUST</span></div>
        <div className="token-orbit-core"><img src={OFFICIAL_VERA_LOGO} alt="" /><strong>$VERA</strong><small>UNDER RESEARCH</small></div>
        <div className="token-orbit-caption">DESIGN IS NOT A COMMITMENT</div>
      </div>
      <div className="token-hero-index"><span>VERA / ECOSYSTEM</span><span>STATUS 01 — EXPLORATION</span></div>
    </section>

    <section className="token-notice" aria-label="Important status disclosure">
      <div className="token-notice-icon"><CircleHelp size={19} /></div>
      <div><strong>This is a research page, not a token launch page.</strong><p>No token contract, network, supply, allocation, price, launch date or finalized utility has been announced. Nothing here is an offer to buy or an investment recommendation.</p></div>
      <span className="token-notice-tag">UNCONFIRMED</span>
    </section>

    <section className="token-research" id="research">
      <div className="token-section-heading"><div><span className="token-kicker">01 / AREAS UNDER REVIEW</span><h2>Questions before<br /><em>tokenomics.</em></h2></div><p>Choose a research track to explore the questions that would need credible answers before a design could be proposed.</p></div>
      <div className="token-research-layout">
        <div className="token-track-list" role="tablist" aria-label="Token research tracks">
          {researchTracks.map((item) => <button type="button" role="tab" aria-selected={activeTrack === item.id} className={activeTrack === item.id ? "active" : ""} key={item.id} onClick={() => setActiveTrack(item.id)}><span>{item.number}</span><strong>{item.label}</strong><ArrowUpRight size={15} /></button>)}
          <div className="token-track-foot"><Compass size={16} /><span>Research first.<br />Decisions only when justified.</span></div>
        </div>
        <article className="token-track-detail" key={track.id} role="tabpanel">
          <div className="token-detail-meta"><span>RESEARCH TRACK {track.number}</span><span><i /> IN EVALUATION</span></div>
          <h3>{track.title}</h3><p className="token-detail-summary">{track.summary}</p>
          <div className="token-question-list">{track.points.map(([title, detail], index) => <div className="token-question-row" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{detail}</p></div><Layers3 size={15} /></div>)}</div>
        </article>
      </div>
    </section>

    <section className="token-gates" id="decision-gates">
      <div className="token-section-heading"><div><span className="token-kicker">02 / DECISION GATES</span><h2>Progress is earned.<br /><em>Not assumed.</em></h2></div><p>A token should only advance beyond research if the product and the people who rely on it benefit from a defensible, transparent model.</p></div>
      <div className="token-gate-grid">{gates.map((gate, index) => <article key={gate.title}><div className="token-gate-top"><span>GATE / 0{index + 1}</span><Check size={15} /></div><h3>{gate.title}</h3><p>{gate.detail}</p><div className="token-gate-line"><span /></div></article>)}</div>
      <div className="token-gate-note"><ShieldCheck size={17} /><p><strong>Non-negotiable principle</strong> Essential VERA safety information should not be withheld from people because they do not hold a token.</p></div>
    </section>

    <section className="token-faq" id="questions">
      <div className="token-section-heading"><div><span className="token-kicker">03 / WHAT IS KNOWN</span><h2>Clear answers.<br /><em>No speculation.</em></h2></div><p>These answers distinguish current research from decisions that have not been made.</p></div>
      <div className="token-faq-list">{questions.map(([question, answer], index) => <article className={openQuestion === index ? "open" : ""} key={question}><button type="button" aria-expanded={openQuestion === index} onClick={() => setOpenQuestion(openQuestion === index ? null : index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><ChevronDown size={17} /></button>{openQuestion === index && <div className="token-faq-answer"><p>{answer}</p></div>}</article>)}</div>
    </section>

    <section className="token-bottom-cta">
      <span className="token-kicker">THE NEXT STEP IS EVIDENCE</span><h2>Useful first.<br /><em>Token second.</em></h2><p>VERA's core mission remains helping people understand digital risk before they act. Any future ecosystem design must support that mission, not distract from it.</p>
      <div><a href="/" className="token-primary">Return to VERA <ArrowUpRight size={15} /></a><a href="https://github.com/verabuild/Vera/blob/main/ROADMAP.md" target="_blank" rel="noreferrer noopener" className="token-secondary">Read the public roadmap <ExternalLink size={14} /></a></div>
    </section>

    <footer className="token-footer"><a href="/" className="token-footer-brand"><img src={OFFICIAL_VERA_LOGO} alt="VERA" /><span>VERA <i>⇴</i> Know before you act.</span></a><span>$VERA / PROPOSED RESEARCH ONLY</span><a href="https://github.com/verabuild/Vera" target="_blank" rel="noreferrer noopener">PUBLIC SOURCE <ExternalLink size={12} /></a></footer>
  </main>;
}
