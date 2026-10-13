import { ArrowLeft, ArrowUpRight, ExternalLink, Network, Mail, Github } from "lucide-react";
import { OFFICIAL_VERA_LOGO } from "../lib/brand";

type PublicPageKey = "about" | "how-it-works" | "project" | "contact";

const pages: Record<PublicPageKey, {
  eyebrow: string;
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
}> = {
  about: {
    eyebrow: "ABOUT VERA",
    title: "Know what you are dealing with before you act.",
    intro: "VERA is an evidence-first decision-support tool for moments when a link, message, wallet or transaction does not feel right. It brings available technical signals into one investigation and explains what those signals do, and do not, establish.",
    sections: [
      { heading: "Why VERA exists", body: "Online trust is difficult to judge from appearances. A familiar logo, polished website, confident message or popular token can be copied or manipulated. VERA exists to help people pause and examine evidence before they click, connect, sign or pay." },
      { heading: "One place for Web2 and Web3 signals", body: "VERA supports investigations of URLs, messages, public Solana wallet addresses and Solana transaction inputs. Depending on the input and provider availability, checks can include threat-intelligence records, public scan observations, website technical signals, public reputation reports and blockchain data." },
      { heading: "Evidence before certainty", body: "VERA distinguishes observed signals from interpretation. A provider match can be meaningful evidence; a completed lookup with no match is only a statement about that provider's coverage. Missing or unavailable checks remain unknown rather than being presented as clean." },
      { heading: "You stay in control", body: "VERA is read-only decision support. It does not custody assets, request seed phrases or private keys, sign messages, or execute transactions on your behalf. The purpose is to make evidence easier to understand, not to make the decision for you." },
      { heading: "A beta that should be honest about its limits", body: "VERA is evolving. Data sources can be incomplete, delayed or unavailable, and automated assessments can be wrong. Use the evidence trail, verify important claims independently and do not treat any result as a guarantee of safety." }
    ]
  },
  "how-it-works": {
    eyebrow: "INVESTIGATION METHODOLOGY",
    title: "A clear assessment starts with evidence.",
    intro: "VERA collects available signals for a submitted input, records the state of relevant checks and turns the resulting evidence into a plain-language assessment. The process is designed to show uncertainty instead of hiding it.",
    sections: [
      { heading: "1. Identify the input", body: "The investigator accepts a URL, a message, a public Solana wallet address or a transaction signature. When a message contains links, detected links may be sent through the URL investigation pipeline. Never submit passwords, authentication codes, seed phrases or private keys." },
      { heading: "2. Run relevant checks", body: "Depending on the input, VERA can consult URL threat-intelligence sources, public scan records, website surface information, domain registration and DNS data, public reputation sources, scam reports, public Solana network data and token-market context. Not every check applies to every input, and optional providers may not be configured." },
      { heading: "3. Show the status of each check", body: "A match means a source returned a relevant signal. No match means that source completed and did not return a match. Unavailable means the check could not complete. Skipped means an optional check was not run. These states are not interchangeable." },
      { heading: "4. Separate findings from interpretation", body: "VERA combines structured observations into an assessment and, where configured, an AI-assisted explanation grounded in collected evidence. The explanation can still be mistaken; source records and deterministic findings should take priority over persuasive wording." },
      { heading: "5. Decide with context", body: "SAFE, CAUTION, REVIEW and NOT SAFE communicate different levels of evidence and concern, not guarantees about future behaviour. Verify official identities independently, review transaction details carefully and stop when direct threat evidence is present." },
      { heading: "What VERA cannot establish from a clean lookup", body: "DNS resolution, domain age, a valid certificate or a lack of known threat matches does not by itself verify the operator's identity, the legitimacy of page content, the safety of every action on a site or the absence of a new threat." }
    ]
  },
  project: {
    eyebrow: "PROJECT TRANSPARENCY",
    title: "A public record of what VERA is.",
    intro: "This page links to VERA's public project materials and describes the current scope of the beta without implying independent certification, partnerships or capabilities that have not been established.",
    sections: [
      { heading: "Current scope", body: "The current beta investigates URLs, messages, public Solana wallets and transaction inputs. Available evidence depends on the input type, configured providers, network access and the freshness and coverage of external sources." },
      { heading: "Technical approach", body: "VERA uses a React and TypeScript frontend, a Vercel-hosted investigation API, structured evidence adapters and a Gemini-based explanation layer where configured. The public repository contains the implementation and setup notes; provider credentials are intended to remain server-side." },
      { heading: "Read-only by design", body: "VERA does not request seed phrases or private keys and does not sign or execute transactions. Wallet investigations use public address and blockchain information." },
      { heading: "Source code and updates", body: "The repository is the primary public reference for implementation details. Project updates are shared through the linked official X account. A public repository is not, by itself, proof of an independent security audit or formal certification." },
      { heading: "Beta status", body: "VERA remains a beta product. Features, provider availability, verdict logic and usage limits may change. We aim to make material limitations and uncertainty visible rather than imply that every investigation is complete." }
    ]
  },
  contact: {
    eyebrow: "CONTACT VERA",
    title: "Corrections, questions and security reports.",
    intro: "If you have a question about VERA, believe an assessment is incorrect, need to make a privacy request or have identified a potential security issue, use the official contact channel below.",
    sections: [
      { heading: "General enquiries and feedback", body: "Share the page or investigation reference involved and describe what you observed. Avoid including passwords, authentication codes, seed phrases, private keys or other sensitive secrets." },
      { heading: "Privacy and data requests", body: "You can email a request about personal information or retained investigation records. We will assess it against the data actually held and applicable requirements; sending a request does not imply that every record can always be identified or removed immediately." },
      { heading: "Potential security issues", body: "Please report suspected vulnerabilities privately rather than posting exploit details or sensitive data publicly. Include a concise description, affected route or feature, and safe reproduction steps where possible. Do not access, alter or disclose other people's data." },
      { heading: "Official project links", body: "Use the linked repository and official project account to check project materials and updates. Be cautious of accounts or websites claiming to represent VERA that are not linked from this site." }
    ]
  }
};

export default function PublicPage({ page }: { page: PublicPageKey }) {
  const content = pages[page];
  return <main className="public-page">
    <header className="public-page-nav">
      <a className="public-page-brand" href="/" aria-label="VERA home"><img src={OFFICIAL_VERA_LOGO} alt="VERA mark" /></a>
      <nav aria-label="Main navigation">
        <a href="/about">About</a>
        <a href="/how-it-works">Methodology</a>
        <a href="/project">Project</a>
        <a href="/contact">Contact</a>
      </nav>
    </header>
    <div className="public-page-shell">
      <a className="public-page-back" href="/"><ArrowLeft size={14} /> Back to VERA</a>
      <header className="public-page-hero">
        <span className="public-page-kicker"><span />{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
      </header>
      <section className="public-page-sections">
        {content.sections.map((section, index) => <article key={section.heading}>
          <span className="public-section-number">{String(index + 1).padStart(2, "0")}</span>
          <div><h2>{section.heading}</h2><p>{section.body}</p></div>
        </article>)}
      </section>
      <section className="public-page-resources" aria-label="Official project resources">
        <a href="https://github.com/verabuild/Vera" target="_blank" rel="noreferrer noopener"><Github size={16} /><span><strong>Source code</strong><small>GitHub repository</small></span><ExternalLink size={13} /></a>
        <a href="https://x.com/verabuild" target="_blank" rel="noreferrer noopener"><Network size={16} /><span><strong>Project updates</strong><small>Official X account</small></span><ExternalLink size={13} /></a>
        <a href="mailto:verabuild1@gmail.com"><Mail size={16} /><span><strong>Contact</strong><small>verabuild1@gmail.com</small></span><ArrowUpRight size={13} /></a>
      </section>
      <footer className="public-page-footer">
        <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/disclosures">Risk disclosures</a><a href="/contact">Contact</a>
        <span>VERA · Know before you act</span>
      </footer>
    </div>
  </main>;
}
