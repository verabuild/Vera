import { ArrowLeft, CheckCircle2, Cookie, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";

type LegalKey = "terms" | "privacy" | "cookies" | "disclosures";

const pages: Record<LegalKey, {
  eyebrow: string;
  title: string;
  intro: string;
  icon: typeof ShieldCheck;
  sections: { heading: string; body: string }[];
}> = {
  terms: {
    eyebrow: "VERA · BETA TERMS",
    title: "Terms of use",
    intro: "VERA is a beta decision-intelligence service designed to help you pause, inspect evidence and make your own decision.",
    icon: ShieldCheck,
    sections: [
      { heading: "1. The service", body: "VERA analyses URLs, messages, Solana addresses and Solana transaction signatures using deterministic checks, third-party intelligence sources and, where configured, AI-assisted explanation. VERA does not execute transactions, custody assets, sign messages or move funds on your behalf." },
      { heading: "2. Beta status", body: "VERA is provided in beta. Features, limits, data sources and verdict logic may change as the system is improved. Temporary outages, incomplete provider responses and false positives or false negatives are possible." },
      { heading: "3. Your responsibility", body: "You remain responsible for the decision you make after an investigation. Do not treat a VERA result as a substitute for checking an official domain, reviewing a transaction, verifying a recipient or using your normal security controls." },
      { heading: "4. Investigation inputs", body: "You may investigate a public link, message text, Solana address or transaction signature. Do not submit seed phrases, private keys, passwords, authentication codes or other secrets. VERA is not designed to receive them." },
      { heading: "5. Usage limits and accounts", body: "The current intended beta allowance is five anonymous investigations and ten authenticated investigations per UTC day. Limits can be affected by authentication, database availability, signed fallback controls and deployment configuration. A wallet connection is not required to investigate. Check the live response for the remaining allowance; these limits may change as the beta evolves." },
      { heading: "6. Third-party sources", body: "VERA may query third-party infrastructure, reputation, blockchain and threat-intelligence services. Their availability, accuracy and coverage are outside VERA's control. A source returning no match is not proof that an entity is safe." },
      { heading: "7. Prohibited use", body: "Do not use VERA to facilitate fraud, credential theft, malware distribution, unauthorised access, evasion of security controls or unlawful financial activity. Automated abuse intended to exhaust shared resources is also prohibited." },
      { heading: "8. Intellectual property", body: "VERA, its branding, software and original content remain the property of their respective rights holders. These terms grant a limited right to use the service as made available; they do not transfer ownership." },
      { heading: "9. Availability and liability", body: "VERA is provided on an as-available basis during beta. No security, accuracy, completeness, availability or loss-prevention guarantee is made. To the extent permitted by applicable law, VERA disclaims liability for losses arising from reliance on an investigation result. Nothing in this section excludes liability that cannot legally be excluded. The operator should obtain qualified legal review for the jurisdictions in which VERA is offered." },
      { heading: "10. Changes", body: "These terms may be updated as VERA moves from beta toward production. The current version published on this page applies to use of the service after publication." }
    ]
  },
  privacy: {
    eyebrow: "VERA · PRIVACY",
    title: "Privacy",
    intro: "VERA is designed to minimise stored investigation data while still providing abuse controls, authentication and a useful evidence trail.",
    icon: ShieldCheck,
    sections: [
      { heading: "What VERA processes", body: "Depending on the investigation mode, VERA processes the URL, message text, Solana address or transaction signature you submit, together with technical evidence returned by connected sources. Signed-in users also provide the account identifier needed to authenticate and enforce usage limits." },
      { heading: "What VERA stores", body: "When backend persistence is enabled, the scan record can include an input hash, a preview, network metadata and a structured report. MESSAGE and TX previews are redacted, but hashes and structured evidence may still be sensitive or linkable. URL and WALLET records may contain the submitted URL/address and a short preview. Recent investigation history is also stored locally in your browser. Do not submit secrets or unnecessary personal information." },
      { heading: "Third-party processing", body: "A URL investigation may send the target URL or hostname to configured threat-intelligence, reputation, DNS, RDAP, website-inspection and related services. A message containing links may cause those links to be submitted through the same pipeline. Solana addresses or transaction details may be queried against public RPC infrastructure and configured services such as Helius, Breadcrumbs, Magic Eden, DEX Screener or Chainabuse when relevant. AI explanation may process submitted input and collected evidence through Gemini. Only configure providers whose terms and data handling you accept; those providers have their own privacy, logging and retention policies." },
      { heading: "Authentication", body: "VERA uses Privy for optional sign-in with email, Google or a Solana wallet. Authentication tokens are verified server-side. VERA does not require a wallet connection simply to investigate a link, message, address or transaction." },
      { heading: "Cookies and local storage", body: "VERA uses a signed first-party anonymous-session cookie and, when needed, a signed quota cookie to enforce beta usage limits. The selected colour theme and recent scan history are stored locally in your browser. See the Cookies page for more detail." },
      { heading: "Analytics and infrastructure", body: "The site uses Vercel Analytics and its hosting infrastructure. Service providers may process technical request metadata required to operate, secure and measure the service under their own policies." },
      { heading: "Security", body: "VERA uses server-side secrets for provider credentials and signed controls, and is designed not to request seed phrases or private keys. No online system can promise perfect security, so never submit secrets to the investigator." },
      { heading: "Your choices", body: "You can use the investigator without connecting a wallet, sign out, clear local browser data and stop using the service. For access, correction or deletion requests, contact verabuild1@gmail.com and include enough information to identify the relevant record without sending credentials or secrets. Requests will be assessed against the records actually retained, operational/security needs and applicable law; this page does not promise immediate deletion from third-party providers." }
    ]
  },
  cookies: {
    eyebrow: "VERA · COOKIES",
    title: "Cookies",
    intro: "VERA uses a small number of first-party controls to keep the beta usable, secure and within its published usage limits.",
    icon: Cookie,
    sections: [
      { heading: "Anonymous session cookie", body: "VERA uses a signed, HttpOnly first-party cookie to distinguish an anonymous browser session. The value is random and signed server-side; VERA derives a hash for quota tracking instead of using the raw session identifier as a database subject." },
      { heading: "Quota cookie", body: "When the durable usage database is temporarily unavailable, VERA can use a separately signed HttpOnly cookie as a continuity fallback for beta usage limits. The cookie contains a signed counter and period, not investigation content." },
      { heading: "Preferences stored locally", body: "The site's selected theme is stored in browser local storage under the VERA theme key. Recent investigation history is also stored locally in the browser. These are not cookies." },
      { heading: "Third-party services", body: "Authentication, analytics, hosting and other integrated services may use their own cookies or storage according to their policies. VERA does not control those third-party mechanisms." },
      { heading: "Managing cookies", body: "You can clear cookies and local storage through your browser settings. Doing so may reset your anonymous session and local history and may affect the beta usage experience. The service currently uses these controls for session continuity, quota enforcement and preferences; do not assume that clearing browser storage deletes records already stored by VERA or external providers." }
    ]
  },
  disclosures: {
    eyebrow: "VERA · RISK DISCLOSURE",
    title: "Risk disclosures",
    intro: "VERA is an evidence and decision-support layer. A verdict is a snapshot of available evidence, not a guarantee about what happens next.",
    icon: TriangleAlert,
    sections: [
      { heading: "SAFE does not mean guaranteed safe", body: "A SAFE result means VERA found evidence that currently supports a legitimate and low-risk interpretation, including stronger checks for recognised official domains where available. It does not guarantee that every page, account, message, advertisement, login flow or future action on that domain is harmless." },
      { heading: "NOT SAFE means stop", body: "A NOT SAFE result is used when VERA finds a direct malicious/phishing match or enough corroborating risk signals to advise against interaction. Do not open, sign in, connect, pay or send funds through the destination until it has been independently verified." },
      { heading: "CAUTION and REVIEW", body: "CAUTION means risk signals deserve additional scrutiny without being treated as confirmed maliciousness. REVIEW means the available evidence is inconclusive. Neither should be interpreted as approval." },
      { heading: "Third-party intelligence is incomplete", body: "Threat feeds, public reports, scan histories, blockchain data and reputation sources can be delayed, incomplete, unavailable or wrong. No-match results are coverage statements, not proof of legitimacy." },
      { heading: "Blockchain risk", body: "A successful Solana transaction proves what the network processed; it does not prove that the action was intended or safe. Transfers can be difficult or impossible to reverse, and VERA never signs or executes a transaction for you." },
      { heading: "AI is explanatory, not authoritative", body: "AI-generated explanations are constrained by the evidence collected by VERA but can still be mistaken. Deterministic evidence and the underlying source records should take priority over persuasive language." },
      { heading: "Security and financial decisions", body: "VERA is not a financial adviser, legal adviser or replacement for professional cybersecurity review. Never share seed phrases, private keys, passwords or one-time codes with VERA or any other investigation service." },
      { heading: "Beta limitations", body: "The beta may change quickly as new providers, heuristics, verdict rules and monitoring features are introduced. Investigate again when circumstances change, especially before a high-value or irreversible action." }
    ]
  }
};

export default function LegalPage({ page }: { page: LegalKey }) {
  const content = pages[page];
  const Icon = content.icon;
  return <main className="legal-page">
    <div className="legal-shell">
      <a className="legal-back" href="/"><ArrowLeft size={14} /> Back to VERA</a>
      <div className="legal-hero">
        <div className="legal-icon"><Icon size={22} /></div>
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        <div className="legal-meta"><CheckCircle2 size={13} /> Policy version · Updated October 16, 2026</div>
      </div>
      <section className="legal-content">
        {content.sections.map((section) => <article key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></article>)}
      </section>
      <div className="legal-foot"><span>Questions or data requests</span><a href="mailto:verabuild1@gmail.com">verabuild1@gmail.com <ExternalLink size={12} /></a></div>
    </div>
  </main>;
}
