import { useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Activity, ArrowUpRight, ChevronLeft, Clipboard, Download, Ellipsis, ExternalLink,
  Fingerprint, GitBranch, Network as NetworkIcon, Search, ShieldAlert,
  ShieldCheck, Wallet, XCircle, ChartNoAxesCombined, FileText
} from 'lucide-react';
import type { Network } from '../lib/types';
import { OFFICIAL_VERA_LOGO } from '../lib/brand';

type Transfer = {
  signature: string; slot: number; blockTime: number | null; source: string; destination: string;
  sourceTokenAccount?: string; destinationTokenAccount?: string;
  asset: string; mint?: string; rawAmount: string; amount: number | null; decimals?: number;
  kind: 'SOL' | 'TOKEN'; sourceSeed: boolean; depth: number; sourceProvider?: 'Helius';
};
type TraceResult = {
  network: Network; generatedAt: string; seeds: string[]; nodes: string[]; transfers: Transfer[];
  checkedTransactions: number; truncated: boolean; limitations: string[];
  externalIntelligence?: {
    providers: Record<'helius' | 'breadcrumbs' | 'dexscreener', { state: string; detail: string }>;
    historyTransfers: Transfer[];
    labels: Array<{ address: string; label: string; tags: string[]; sourceUrl: string }>;
    riskSignals: Array<{ address: string; riskScore: string; tags: string[]; incomingHop: number | null; outgoingHop: number | null; sourceUrl: string }>;
    markets: Array<{ mint: string; pairUrl: string; dexId: string; priceUsd: string | null; liquidityUsd: number | null; volume24h: number | null }>;
  };
};

const EXAMPLE_WALLETS = 'GUXCBv2rkBSYZth6hfi1jqe5fa9g5P3VQZjtVNGmBzqo\n7giwwYn1wNJwCuuQbiUjFgdyWb9ZBAyDPgHS3W1syJEj\n9R9tx1cXxN1CbdyMvQKVnsWNGGmnGcc8kEK8QMCNcB2g\n8CPcov5BDnegcfK3MFQBcJS63Ut6qGgPWPpsQfZ4MUKt\nGtyw72PaH7Ubz1jUNyyDDie6PMHnN5cz9d6v5A9cZzoA\nCxkdNnA3cMzU9xGPFyaXM2Lr2nEwm1hkv66xYjMdKor2\nBmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6';

function splitLines(value: string) {
  return [...new Set(value.split(/[\n,\s]+/).map((item) => item.trim()).filter(Boolean))];
}
function shorten(value: string) { return value.length > 20 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value; }
function dateLabel(value: number | null) {
  return value ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ' UTC' : 'Timestamp unavailable';
}
function amountLabel(transfer: Transfer) {
  if (transfer.amount === null) return `Raw units: ${transfer.rawAmount}`;
  return `${transfer.amount.toLocaleString(undefined, { maximumFractionDigits: transfer.kind === 'SOL' ? 9 : 8 })} ${transfer.kind === 'SOL' ? 'SOL' : transfer.mint ? 'tokens' : 'token units'}`;
}

export default function SolanaCaseTerminal() {
  const { getAccessToken } = usePrivy();
  const [addresses, setAddresses] = useState('');
  const [signatures, setSignatures] = useState('');
  const [network, setNetwork] = useState<Network>('mainnet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [caseNotes, setCaseNotes] = useState('');
  const parsedAddresses = useMemo(() => splitLines(addresses), [addresses]);
  const parsedSignatures = useMemo(() => splitLines(signatures), [signatures]);
  const allTransfers = useMemo(() => {
    if (!result) return [];
    const combined = [...result.transfers, ...(result.externalIntelligence?.historyTransfers ?? [])];
    return [...new Map(combined.map((item) => [`${item.signature}:${item.source}:${item.destination}:${item.mint ?? item.kind}:${item.rawAmount}`, item])).values()];
  }, [result]);
  const graphNodes = useMemo(() => {
    if (!result) return [];
    const addresses = [...new Set(allTransfers.flatMap((item) => [item.source, item.destination]).concat(result.seeds))].slice(0, 14);
    return addresses.map((address, index) => {
      const angle = (Math.PI * 2 * index / Math.max(addresses.length, 1)) - Math.PI / 2;
      return { address, x: 380 + Math.cos(angle) * (addresses.length > 7 ? 285 : 225), y: 165 + Math.sin(angle) * 112, seed: result.seeds.includes(address) };
    });
  }, [allTransfers, result]);
  const activityBins = useMemo(() => {
    const bins = new Map<string, { label: string; count: number; incoming: number; outgoing: number }>();
    for (const transfer of allTransfers) {
      const key = transfer.blockTime ? new Date(transfer.blockTime * 1000).toISOString().slice(0, 10) : 'unknown';
      const bin = bins.get(key) ?? { label: key === 'unknown' ? 'Unknown time' : key.slice(5), count: 0, incoming: 0, outgoing: 0 };
      bin.count += 1;
      if (result?.seeds.includes(transfer.destination)) bin.incoming += 1;
      if (result?.seeds.includes(transfer.source)) bin.outgoing += 1;
      bins.set(key, bin);
    }
    return [...bins.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([, value]) => value);
  }, [allTransfers, result]);

  async function investigate() {
    setBusy(true); setError(''); setResult(null);
    try {
      const accessToken = import.meta.env.VITE_PRIVY_APP_ID ? await getAccessToken() : null;
      const response = await fetch('/api/solana-case', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify({ addresses, signatures, network })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ? `${data.error}${data.detail ? ` ${data.detail}` : ''}` : `Request failed (HTTP ${response.status})`);
      if (!data.result || !Array.isArray(data.result.transfers)) throw new Error('VERA returned an incomplete trace response.');
      setResult(data.result as TraceResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The case trace could not be completed.');
    } finally { setBusy(false); }
  }

  async function copyEvidence() {
    if (!result) return;
    const report = JSON.stringify({ ...result, investigatorNotes: caseNotes.trim() || null }, null, 2);
    try { await navigator.clipboard.writeText(report); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Clipboard access was blocked. Use Export JSON to save the evidence report instead.'); }
  }
  function exportEvidence() {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ ...result, investigatorNotes: caseNotes.trim() || null }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `vera-solana-case-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="case-terminal">
    <div className="case-dna-backdrop" aria-hidden="true"><svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="case-dna-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4b5059" stopOpacity=".12"/><stop offset=".42" stopColor="#f4f6fa" stopOpacity=".9"/><stop offset=".62" stopColor="#8c929c" stopOpacity=".6"/><stop offset="1" stopColor="#3a3f47" stopOpacity=".08"/></linearGradient><linearGradient id="case-dna-rung" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7f8793" stopOpacity=".08"/><stop offset=".5" stopColor="#f7f8fa" stopOpacity=".68"/><stop offset="1" stopColor="#7f8793" stopOpacity=".08"/></linearGradient></defs>{[0,1].map((strand) => <path key={strand} className={`case-dna-strand case-dna-strand-${strand}`} d={Array.from({length:41},(_,i)=>{const y=i*24;const x=600+(strand===0?1:-1)*Math.sin(i*Math.PI/5)*126;return `${i===0?'M':'L'} ${x} ${y}`;}).join(' ')} fill="none" stroke="url(#case-dna-metal)" strokeWidth="5" strokeLinecap="round"/>)}{Array.from({length:40},(_,i)=>{const y=i*24;const x1=600+Math.sin(i*Math.PI/5)*126;const x2=600-Math.sin(i*Math.PI/5)*126;return <line key={i} className="case-dna-rung" x1={x1} y1={y} x2={x2} y2={y} stroke="url(#case-dna-rung)" strokeWidth="2.2"/>;})}</svg><span className="case-dna-halo case-dna-halo-a"/><span className="case-dna-halo case-dna-halo-b"/></div>
    <header className="case-topbar">
      <a className="case-brand" href="/" aria-label="VERA home"><img src={OFFICIAL_VERA_LOGO} alt="" /><span>VERA</span></a>
      <div className="case-topbar-center"><span /> SOLANA INVESTIGATION TERMINAL</div>
      <a className="case-back-link" href="/"><ChevronLeft size={15} /> Main scanner</a>
    </header>

    <section className="case-hero">
      <div className="case-hero-copy">
        <span className="case-kicker"><span className="case-kicker-dot" /> ON-CHAIN FORENSICS / 01</span>
        <h1>Follow the<br /><em>evidence.</em></h1>
        <p>Turn a theft report into a verifiable transaction trail. Start with wallets and signatures, inspect the transfers VERA can establish, and export the evidence for the next step.</p>
        <div className="case-hero-assurances"><span><ShieldCheck size={14} /> Read-only</span><span><GitBranch size={14} /> Transaction-linked</span><span><Fingerprint size={14} /> Evidence first</span></div>
      </div>
      <div className="case-hero-orbit" aria-hidden="true"><div className="case-orbit orbit-a" /><div className="case-orbit orbit-b" /><div className="case-orbit-core"><img src={OFFICIAL_VERA_LOGO} alt="" /></div><div className="case-orbit-point point-a" /><div className="case-orbit-point point-b" /><div className="case-orbit-point point-c" /></div>
    </section>

    <section className="case-workspace">
      <div className="case-input-column">
        <div className="case-section-heading"><span>01 / CASE INTAKE</span><h2>Start with what you know.</h2><p>Paste public wallet addresses and full Solana transaction signatures. You can include several of each.</p><button className="case-load-example" type="button" onClick={() => { setAddresses(EXAMPLE_WALLETS); setSignatures(""); setResult(null); setError(""); }}>Load reported case addresses <ArrowUpRight size={12} /></button></div>
        <div className="case-field">
          <label htmlFor="case-addresses"><span><Wallet size={14} /> Wallet addresses</span><small>{parsedAddresses.length}/8 max</small></label>
          <textarea id="case-addresses" value={addresses} onChange={(event) => setAddresses(event.target.value)} placeholder="One public Solana address per line" rows={5} spellCheck={false} />
          <small className="case-field-hint">Include victim wallets and known intermediary or destination addresses.</small>
        </div>
        <div className="case-field">
          <label htmlFor="case-signatures"><span><Activity size={14} /> Transaction signatures</span><small>{parsedSignatures.length}/5 max</small></label>
          <textarea id="case-signatures" value={signatures} onChange={(event) => setSignatures(event.target.value)} placeholder="Paste complete transaction signatures" rows={3} spellCheck={false} />
          <small className="case-field-hint">Use the full signature, not an abbreviated explorer URL.</small>
        </div>
        <div className="case-network-picker"><span>NETWORK</span><div><button type="button" className={network === 'mainnet' ? 'active' : ''} onClick={() => setNetwork('mainnet')}>Mainnet</button><button type="button" className={network === 'devnet' ? 'active' : ''} onClick={() => setNetwork('devnet')}>Devnet</button></div></div>
        {error && <div className="case-error"><XCircle size={15} />{error}</div>}
        <button className="case-run-button" type="button" onClick={investigate} disabled={busy || (!parsedAddresses.length && !parsedSignatures.length) || parsedAddresses.length > 8 || parsedSignatures.length > 5}>
          {busy ? <><span className="case-spinner" /> Tracing public transactions…</> : <><Search size={16} /> Run case investigation <ArrowUpRight size={16} /></>}
        </button>
        <div className="case-intake-foot"><ShieldCheck size={14} /> VERA never asks for seed phrases or private keys.</div>
      </div>

      <aside className="case-method-card">
        <span className="case-method-index">METHOD / 001</span><NetworkIcon size={20} />
        <h3>Follow transfers, not assumptions.</h3>
        <p>VERA checks recent address history and supplied transactions, then links parseable transfer instructions to their transaction signatures.</p>
        <div className="case-method-rule" />
        <div className="case-method-row"><span>01</span><div><strong>Verify the record</strong><small>Retrieve data from the selected Solana RPC.</small></div></div>
        <div className="case-method-row"><span>02</span><div><strong>Connect observed transfers</strong><small>Show sender, recipient, asset and timestamp when available.</small></div></div>
        <div className="case-method-row"><span>03</span><div><strong>Preserve the evidence</strong><small>Export a JSON report with limitations included.</small></div></div>
        <div className="case-method-caveat"><ShieldAlert size={14} /><span>Wallet relationships do not establish a real-world identity or prove criminal intent.</span></div>
      </aside>
    </section>

    {result && <section className="case-results" aria-live="polite">
      <div className="case-results-head"><div><span className="case-kicker">02 / TRACE RESULTS</span><h2>What the chain returned.</h2><p>Generated {new Date(result.generatedAt).toLocaleString()} · {result.network.toUpperCase()}</p></div><div className="case-export-actions"><button type="button" onClick={copyEvidence}><Clipboard size={14} /> {copied ? 'Copied' : 'Copy evidence'}</button><button type="button" onClick={exportEvidence}><Download size={14} /> Export JSON</button></div></div>
      <div className="case-metric-grid"><article><span>OBSERVED TRANSFERS</span><strong>{allTransfers.length}</strong></article><article><span>ADDRESSES IN GRAPH</span><strong>{graphNodes.length}</strong></article><article><span>TRANSACTIONS CHECKED</span><strong>{result.checkedTransactions}</strong></article><article><span>TRACE COVERAGE</span><strong>{result.truncated ? 'CAPPED' : 'RECENT'}</strong></article></div>
      {result.truncated && <div className="case-warning"><ShieldAlert size={15} /> This trace reached its safety limits. It may omit relevant transfers and must not be treated as complete.</div>}
      <div className="case-graph-panel"><div className="case-graph-heading"><div><span>TRANSFER GRAPH / TABLE VIEW</span><h3>Observed movement</h3></div><div className="case-graph-tools"><span className="case-readonly-tag"><span /> READ-ONLY EVIDENCE</span><div className="case-more-wrap"><button className="case-more-button" type="button" aria-expanded={moreOpen} aria-label="More investigation views" onClick={() => setMoreOpen((open) => !open)}><Ellipsis size={17}/><span>More</span></button>{moreOpen && <div className="case-more-menu" role="menu"><button type="button" role="menuitem" onClick={() => { document.getElementById('case-network-graph')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMoreOpen(false); }}>Network graph</button><button type="button" role="menuitem" onClick={() => { document.getElementById('case-activity-chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMoreOpen(false); }}>Activity charts</button><button type="button" role="menuitem" onClick={() => { document.getElementById('case-external-intelligence')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMoreOpen(false); }}>External intelligence</button><button type="button" role="menuitem" onClick={() => { document.getElementById('case-notes')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMoreOpen(false); }}>Case notes</button><button type="button" role="menuitem" onClick={() => { document.getElementById('case-limitations')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMoreOpen(false); }}>Evidence limits</button></div>}</div></div></div>
        {allTransfers.length ? <div className="case-transfer-list">{allTransfers.map((transfer, index) => <article className="case-transfer" key={`${transfer.signature}-${transfer.source}-${transfer.destination}-${index}`}>
          <div className="case-transfer-flow"><span className={transfer.sourceSeed ? 'case-node case-node-seed' : 'case-node'} title={transfer.source}>{shorten(transfer.source)}</span><div className="case-flow-line"><span>{transfer.kind === 'SOL' ? 'SOL' : 'TOKEN'}</span><ArrowUpRight size={14} /></div><span className="case-node" title={transfer.destination}>{shorten(transfer.destination)}</span></div>
          <div className="case-transfer-data"><strong>{amountLabel(transfer)}</strong><span>{dateLabel(transfer.blockTime)}</span><span>Slot {transfer.slot.toLocaleString()}</span></div>
          <div className="case-transfer-meta"><span>{transfer.asset}{transfer.sourceProvider ? ` · ${transfer.sourceProvider} parsed history` : ' · Solana RPC'}</span>{transfer.kind === "TOKEN" && transfer.sourceTokenAccount && transfer.destinationTokenAccount && <span className="case-token-accounts" title={"Source token account: " + transfer.sourceTokenAccount + "\nDestination token account: " + transfer.destinationTokenAccount}>Token accounts: {shorten(transfer.sourceTokenAccount)} → {shorten(transfer.destinationTokenAccount)}</span>}<a href={`https://solscan.io/tx/${encodeURIComponent(transfer.signature)}${result.network === 'devnet' ? '?cluster=devnet' : ''}`} target="_blank" rel="noreferrer noopener">View transaction <ArrowUpRight size={12} /></a><button type="button" onClick={() => navigator.clipboard?.writeText(transfer.signature)} title="Copy signature"><Clipboard size={12} /> Copy signature</button></div>
        </article>)}</div> : <div className="case-empty-result"><GitBranch size={21} /><strong>No parseable transfers returned</strong><p>VERA did not find recent parseable transfer instructions in the transactions returned by the selected RPC. Try adding the full transaction signature or another known intermediary address.</p></div>}
      </div>
      <section className="case-analysis-grid" id="case-analysis">
        <article className="case-analysis-card case-network-card" id="case-network-graph">
          <div className="case-analysis-heading"><div><span>RELATIONSHIP MAP / 01</span><h3>Address network</h3><p>Edges represent observed transfer records, not proof of shared ownership.</p></div><NetworkIcon size={18}/></div>
          {graphNodes.length > 1 ? <div className="case-network-canvas"><svg viewBox="0 0 760 330" role="img" aria-label="Graph of observed transfer connections">{allTransfers.slice(0,36).map((transfer,index)=>{const from=graphNodes.find((node)=>node.address===transfer.source);const to=graphNodes.find((node)=>node.address===transfer.destination);if(!from||!to)return null;return <line key={`edge-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={transfer.sourceSeed?'case-graph-edge case-graph-edge-seed':'case-graph-edge'}/>;})}{graphNodes.map((node)=><g key={node.address}><circle cx={node.x} cy={node.y} r={node.seed?8:5.5} className={node.seed?'case-graph-node case-graph-node-seed':'case-graph-node'}/><text x={node.x} y={node.y+22} textAnchor="middle" className="case-graph-label">{shorten(node.address)}</text></g>)}</svg></div> : <div className="case-chart-empty">Add wallet addresses or transaction signatures to build the relationship map.</div>}
          <div className="case-address-chips">{graphNodes.map((node)=><a key={node.address} href={`https://solscan.io/account/${encodeURIComponent(node.address)}${result.network==='devnet'?'?cluster=devnet':''}`} target="_blank" rel="noreferrer noopener" title={node.address}><span className={node.seed?'case-address-seed-dot':'case-address-dot'}/>{shorten(node.address)} <ExternalLink size={10}/></a>)}</div>
        </article>
        <article className="case-analysis-card" id="case-activity-chart">
          <div className="case-analysis-heading"><div><span>ACTIVITY / 02</span><h3>Transfer activity</h3><p>Observed record count by date. Not a USD-value chart.</p></div><ChartNoAxesCombined size={18}/></div>
          {activityBins.length ? <div className="case-activity-chart">{activityBins.map((bin)=><div className="case-activity-column" key={bin.label}><span className="case-activity-count">{bin.count}</span><div className="case-activity-bar-track"><span style={{height:`${Math.max(8,(bin.count/Math.max(...activityBins.map((item)=>item.count)))*100)}%`}}/></div><small>{bin.label}</small></div>)}</div> : <div className="case-chart-empty">No timestamped transfers are available to plot.</div>}
          <div className="case-chart-legend"><span><i/> Total observed transfers</span><small>{allTransfers.length} records in the current case</small></div>
        </article>
      </section>
      <section className="case-analysis-card case-intelligence-panel" id="case-external-intelligence">
        <div className="case-analysis-heading"><div><span>ENRICHMENT / 03</span><h3>External intelligence</h3><p>Independent sources add context. Missing data is not a clean result.</p></div><ExternalLink size={18}/></div>
        <div className="case-provider-grid">{(['helius','breadcrumbs','dexscreener'] as const).map((provider)=>{const item=result.externalIntelligence?.providers[provider]??{state:'NOT_CONFIGURED',detail:'External provider information is not attached to this report.'};const title=provider==='helius'?'Helius parsed history':provider==='breadcrumbs'?'Breadcrumbs attribution & risk':'DEX Screener market context';const href=provider==='helius'?'https://www.helius.dev/docs/getting-data':provider==='breadcrumbs'?'https://docs.breadcrumbs.app/':'https://docs.dexscreener.com/api/reference';return <article className="case-provider-card" key={provider}><div><strong>{title}</strong><span className={`case-provider-state state-${item.state.toLowerCase().replace(/_/g,'-')}`}>{item.state.replace(/_/g,' ')}</span></div><p>{item.detail}</p><a href={href} target="_blank" rel="noreferrer noopener">Provider documentation <ExternalLink size={11}/></a></article>;})}</div>
        {(result.externalIntelligence?.labels.length??0)>0&&<div className="case-intel-subsection"><h4>Public address attribution</h4>{result.externalIntelligence!.labels.map((item)=><article className="case-intel-row" key={item.address}><div><strong>{item.label}</strong><small>{shorten(item.address)}</small></div><span>{item.tags.length?item.tags.join(' · '):'No tags returned'}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">Source <ExternalLink size={10}/></a></article>)}</div>}
        {(result.externalIntelligence?.riskSignals.length??0)>0&&<div className="case-intel-subsection"><h4>Provider risk signals</h4>{result.externalIntelligence!.riskSignals.map((item)=><article className="case-intel-row" key={item.address}><div><strong>{shorten(item.address)}</strong><small>Provider risk: {item.riskScore}</small></div><span>{item.tags.length?item.tags.join(' · '):'No risk tags returned'}{item.incomingHop!==null?` · Incoming exposure ${item.incomingHop} hop(s)`:''}{item.outgoingHop!==null?` · Outgoing exposure ${item.outgoingHop} hop(s)`:''}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">Source <ExternalLink size={10}/></a></article>)}</div>}
        {(result.externalIntelligence?.markets.length??0)>0&&<div className="case-intel-subsection"><h4>Token market snapshots</h4><div className="case-market-grid">{result.externalIntelligence!.markets.map((market,index)=><a className="case-market-card" href={market.pairUrl} target="_blank" rel="noreferrer noopener" key={market.mint+index}><span>{market.dexId} · {shorten(market.mint)}</span><strong>{market.priceUsd?`$${Number(market.priceUsd).toLocaleString(undefined,{maximumFractionDigits:8})}`:'Price unavailable'}</strong><small>Liquidity {market.liquidityUsd===null?'n/a':`$${market.liquidityUsd.toLocaleString(undefined,{maximumFractionDigits:0})}`} · 24h volume {market.volume24h===null?'n/a':`$${market.volume24h.toLocaleString(undefined,{maximumFractionDigits:0})}`}</small><span className="case-market-open">Open pair <ArrowUpRight size={11}/></span></a>)}</div></div>}
        <p className="case-intelligence-footnote">Provider availability depends on server configuration, chain support and third-party service health. Labels and market snapshots are contextual evidence, not a verdict.</p>
      </section>
      <section className="case-analysis-card case-notes-panel" id="case-notes">
        <div className="case-analysis-heading"><div><span>INVESTIGATOR WORKSPACE / 04</span><h3>Case notes</h3><p>Keep working hypotheses separate from observed records. Notes are included when you copy or export the report.</p></div><FileText size={18}/></div>
        <textarea className="case-notes-input" value={caseNotes} onChange={(event)=>setCaseNotes(event.target.value)} placeholder="Record incident context, questions to verify, or follow-up tasks. Avoid entering seed phrases, private keys, or unnecessary personal data." rows={4}/>
      </section>
      <div className="case-evidence-limitations" id="case-limitations"><div><ShieldCheck size={16} /><strong>Interpretation guardrails</strong></div>{result.limitations.map((item) => <p key={item}>{item}</p>)}</div>
    </section>}

    <footer className="case-footer"><span>VERA / SOLANA INVESTIGATION TERMINAL</span><span>Public-chain evidence only · No financial execution</span><a href="/">Return to VERA <ArrowUpRight size={12} /></a></footer>
  </main>;
}
