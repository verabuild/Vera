import { useMemo, useState } from "react";
import {
  Activity, ArrowLeftRight, CheckCircle2, CircleHelp, ExternalLink,
  Fingerprint, Globe2, Link2, Network, Radar, ShieldAlert, Users, Wallet
} from "lucide-react";
import type { Evidence, Scan, InvestigationCheck } from "../lib/types";

type SectionId = "overview" | "identity" | "threats" | "people" | "journey" | "web3" | "evidence";
type Section = { id: SectionId; label: string; description: string; icon: typeof Activity };

const sections: Section[] = [
  { id: "overview", label: "Overview", description: "The assessment at a glance", icon: Activity },
  { id: "identity", label: "Identity", description: "Domain and infrastructure signals", icon: Globe2 },
  { id: "threats", label: "Threats", description: "Threat intelligence and reputation", icon: ShieldAlert },
  { id: "people", label: "People", description: "Claimed operators and affiliations", icon: Users },
  { id: "journey", label: "Link journey", description: "Redirects and observed destinations", icon: Link2 },
  { id: "web3", label: "Web3 signals", description: "Public blockchain evidence", icon: Wallet },
  { id: "evidence", label: "Evidence", description: "Sources, checks and limitations", icon: Fingerprint },
];

function textOf(item: Evidence | InvestigationCheck) {
  return ["title" in item ? item.title : item.name, "detail" in item ? item.detail : "", item.source, "name" in item ? item.name : ""]
    .filter(Boolean).join(" ").toLowerCase();
}

function matchesSection(item: Evidence, section: Exclude<SectionId, "overview" | "evidence">) {
  const text = textOf(item);
  const patterns: Record<typeof section, RegExp> = {
    identity: /domain|dns|rdap|registr|whois|certificate|cert\b|hosting|http|server|infrastructure|url structure|website title|ip address|tls/,
    threats: /phish|malware|threat|urlhaus|openphish|urlscan|chainabuse|scam|blacklist|blocklist|reputation|web risk|abuse report|malicious|suspicious report/,
    people: /founder|team member|operator|identity|affiliation|social profile|impersonat|brand|organisation|organization|person|account owner|public profile/,
    journey: /redirect|destination|final url|resolved url|navigation|link chain|http status|response status|canonical url/,
    web3: /solana|wallet|token|transaction|signature|on.chain|blockchain|program id|dex|mint address|authority|delegate|account state|magic eden/,
  };
  return patterns[section].test(text);
}

function checkMatchesSection(check: InvestigationCheck, section: Exclude<SectionId, "overview" | "evidence">) {
  const text = textOf(check);
  const patterns: Record<typeof section, RegExp> = {
    identity: /domain|dns|rdap|registr|whois|certificate|http|website|infrastructure|url structure/,
    threats: /phish|threat|urlhaus|openphish|urlscan|chainabuse|scam|reputation|web risk|abuse/,
    people: /identity|social|brand|operator|affiliation|profile|person/,
    journey: /redirect|destination|http surface|link|navigation/,
    web3: /solana|wallet|token|transaction|chain|blockchain|dex|magic eden|address/,
  };
  return patterns[section].test(text);
}

function safeLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}

function EvidenceItem({ item }: { item: Evidence }) {
  const links = useMemo(() => {
    const found: { title: string; url: string }[] = [];
    for (const key of ["reports", "results"]) {
      const list = item.metadata?.[key];
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (typeof entry !== "object" || entry === null) continue;
        const record = entry as Record<string, unknown>;
        if (safeLink(record.url)) found.push({ title: typeof record.title === "string" ? record.title : record.url, url: record.url });
      }
    }
    return found.slice(0, 4);
  }, [item.metadata]);
  return <article className="intel-evidence-item">
    <span className={`intel-severity intel-severity-${item.severity}`} aria-label={`${item.severity} severity`} />
    <div className="intel-evidence-main">
      <div className="intel-evidence-title"><strong>{item.title}</strong><span>{item.state}</span></div>
      <p>{item.detail}</p>
      <div className="intel-evidence-meta"><span>{item.source}</span>{item.observedAt && <time dateTime={item.observedAt}>{new Date(item.observedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>}</div>
      {links.length > 0 && <div className="intel-source-links">{links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.title}<ExternalLink size={11} /></a>)}</div>}
    </div>
  </article>;
}

function CheckRow({ check }: { check: InvestigationCheck }) {
  const status = check.status.toLowerCase();
  const Icon = status === "match" ? ShieldAlert : status === "no_match" || status === "checked" ? CheckCircle2 : CircleHelp;
  return <div className="intel-check-row">
    <Icon size={15} className={`intel-check-icon intel-check-${status}`} />
    <div className="intel-check-copy"><strong>{check.name}</strong><p>{check.detail}</p><span>{check.source}</span></div>
    <span className={`intel-check-status intel-check-status-${status}`}>{check.status.replaceAll("_", " ")}</span>
  </div>;
}

function EmptyEvidence({ title, copy }: { title: string; copy: string }) {
  return <div className="intel-empty-state"><span><CircleHelp size={18} /></span><strong>{title}</strong><p>{copy}</p></div>;
}

export default function InvestigationExplorer({ scan }: { scan: Scan }) {
  const [active, setActive] = useState<SectionId>("overview");
  const evidence = scan.assessment.evidence ?? [];
  const checks = scan.assessment.statusReport?.checks ?? [];
  const selectedSection = sections.find((section) => section.id === active) ?? sections[0];
  const filteredEvidence = useMemo(() => {
    if (active === "overview" || active === "evidence") return evidence;
    return evidence.filter((item) => matchesSection(item, active));
  }, [active, evidence]);
  const filteredChecks = useMemo(() => {
    if (active === "overview" || active === "evidence") return checks;
    return checks.filter((check) => checkMatchesSection(check, active));
  }, [active, checks]);
  const highCount = evidence.filter((item) => item.severity === "high").length;
  const unavailableCount = checks.filter((check) => check.status === "UNAVAILABLE" || check.status === "SKIPPED").length;
  const Icon = selectedSection.icon;

  return <section className="investigation-explorer" aria-label="Investigation intelligence workspace">
    <div className="intel-workspace-heading">
      <div><span className="investigation-eyebrow">INTELLIGENCE WORKSPACE</span><h2>Explore the evidence</h2><p>Move from the assessment to the signals behind it. Each section reflects evidence recorded for this case.</p></div>
      <div className="intel-workspace-metrics"><span><strong>{evidence.length}</strong> signals</span><span><strong>{checks.length}</strong> checks</span></div>
    </div>
    <div className="intel-workspace-layout">
      <nav className="intel-section-nav" aria-label="Investigation sections">
        {sections.map((section, index) => {
          const SectionIcon = section.icon;
          const count = section.id === "overview" ? undefined : section.id === "evidence" ? evidence.length : evidence.filter((item) => matchesSection(item, section.id)).length;
          return <button type="button" key={section.id} className={active === section.id ? "intel-nav-item active" : "intel-nav-item"} onClick={() => setActive(section.id)} aria-current={active === section.id ? "page" : undefined}>
            <span className="intel-nav-index">0{index + 1}</span><SectionIcon size={15} /><span className="intel-nav-label">{section.label}</span>{count !== undefined && <span className="intel-nav-count">{count}</span>}
          </button>;
        })}
        <div className="intel-nav-note"><ShieldAlert size={13} /><span>Missing data is shown as unknown, not as proof of safety.</span></div>
      </nav>
      <div className="intel-section-content" key={active}>
        <div className="intel-section-title"><span className="intel-section-icon"><Icon size={18} /></span><div><h3>{selectedSection.label}</h3><p>{selectedSection.description}</p></div></div>
        {active === "overview" && <div className="intel-overview-grid">
          <article className="intel-overview-card"><span className="investigation-eyebrow">RECORDED SIGNALS</span><strong>{evidence.length}</strong><p>Evidence items returned for this investigation.</p></article>
          <article className="intel-overview-card"><span className="investigation-eyebrow">HIGH-SEVERITY SIGNALS</span><strong>{highCount}</strong><p>Signals marked high severity by the current assessment.</p></article>
          <article className="intel-overview-card"><span className="investigation-eyebrow">CHECKS NOT COMPLETED</span><strong>{unavailableCount}</strong><p>Unavailable or skipped checks that limit coverage.</p></article>
        </div>}
        {(active === "overview" || active === "evidence") && checks.length > 0 && <div className="intel-checks-block"><div className="intel-subhead"><strong>Source coverage</strong><span>{checks.length} recorded checks</span></div>{checks.map((check) => <CheckRow key={check.name} check={check} />)}</div>}
        {active === "identity" && filteredChecks.length === 0 && filteredEvidence.length === 0 && <EmptyEvidence title="No direct identity evidence recorded" copy="VERA did not return evidence that could be confidently grouped into this section. This does not mean the operator or domain is verified." />}
        {active === "threats" && filteredChecks.length === 0 && filteredEvidence.length === 0 && <EmptyEvidence title="No direct threat-intelligence evidence recorded" copy="No matching threat evidence is available in this report section. Check provider coverage below before interpreting this as reassuring." />}
        {active === "people" && filteredChecks.length === 0 && filteredEvidence.length === 0 && <EmptyEvidence title="Operator identity remains unestablished" copy="This report contains no directly classified evidence about founders, operators or affiliations. VERA should not infer real-world identities from an anonymous address or an unsupported claim." />}
        {active === "journey" && filteredChecks.length === 0 && filteredEvidence.length === 0 && <EmptyEvidence title="No redirect evidence recorded" copy="The report does not contain a redirect chain that can be shown here. A missing chain is not evidence that a link has no redirects." />}
        {active === "web3" && filteredChecks.length === 0 && filteredEvidence.length === 0 && <EmptyEvidence title="No direct Web3 evidence recorded" copy="This report contains no signals classified as blockchain-related. Some input types or unsupported networks may not produce on-chain checks." />}
        {filteredEvidence.length > 0 && <div className="intel-evidence-list"><div className="intel-subhead"><strong>{active === "overview" ? "Key evidence" : active === "evidence" ? "All recorded evidence" : `Evidence in ${selectedSection.label.toLowerCase()}`}</strong><span>{filteredEvidence.length} {filteredEvidence.length === 1 ? "item" : "items"}</span></div>{filteredEvidence.map((item) => <EvidenceItem key={item.id} item={item} />)}</div>}
        {active !== "overview" && active !== "evidence" && filteredChecks.length > 0 && <div className="intel-checks-block"><div className="intel-subhead"><strong>Related checks</strong><span>{filteredChecks.length} checks</span></div>{filteredChecks.map((check) => <CheckRow key={check.name} check={check} />)}</div>}
        {active === "evidence" && filteredEvidence.length === 0 && <EmptyEvidence title="No evidence items recorded" copy="The assessment returned no evidence items. Review the provider check states above to understand whether sources were checked, unavailable or skipped." />}
        {active === "overview" && evidence.length === 0 && checks.length === 0 && <EmptyEvidence title="No evidence coverage was returned" copy="VERA could not provide a source-backed report for this case. Treat the result as inconclusive and do not interpret missing data as safety." />}
        {active !== "overview" && active !== "evidence" && filteredEvidence.length === 0 && filteredChecks.length === 0 && !["identity", "threats", "people", "journey", "web3"].includes(active) && <EmptyEvidence title="No evidence available" copy="This section has no source-backed findings in the current report." />}
        <div className="intel-section-foot"><Activity size={13} /><span>Report generated {new Date(scan.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Findings describe the evidence available at that time.</span></div>
      </div>
    </div>
  </section>;
}
