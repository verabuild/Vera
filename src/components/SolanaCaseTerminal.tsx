import { useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Activity, ArrowUpRight, ChevronLeft, Clipboard, Download,
  Fingerprint, GitBranch, Network as NetworkIcon, Search, ShieldAlert,
  ShieldCheck, Wallet, XCircle
} from 'lucide-react';
import type { Network } from '../lib/types';
import { OFFICIAL_VERA_LOGO } from '../lib/brand';

type Transfer = {
  signature: string; slot: number; blockTime: number | null; source: string; destination: string;
  asset: string; mint?: string; rawAmount: string; amount: number | null; decimals?: number;
  kind: 'SOL' | 'TOKEN'; sourceSeed: boolean; depth: number;
};
type TraceResult = {
  network: Network; generatedAt: string; seeds: string[]; nodes: string[]; transfers: Transfer[];
  checkedTransactions: number; truncated: boolean; limitations: string[];
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
  const parsedAddresses = useMemo(() => splitLines(addresses), [addresses]);
  const parsedSignatures = useMemo(() => splitLines(signatures), [signatures]);

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
    const report = JSON.stringify(result, null, 2);
    try { await navigator.clipboard.writeText(report); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Clipboard access was blocked. Use Export JSON to save the evidence report instead.'); }
  }
  function exportEvidence() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `vera-solana-case-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="case-terminal">
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
      <div className="case-metric-grid"><article><span>OBSERVED TRANSFERS</span><strong>{result.transfers.length}</strong></article><article><span>ADDRESSES IN GRAPH</span><strong>{result.nodes.length}</strong></article><article><span>TRANSACTIONS CHECKED</span><strong>{result.checkedTransactions}</strong></article><article><span>TRACE COVERAGE</span><strong>{result.truncated ? 'CAPPED' : 'RECENT'}</strong></article></div>
      {result.truncated && <div className="case-warning"><ShieldAlert size={15} /> This trace reached its safety limits. It may omit relevant transfers and must not be treated as complete.</div>}
      <div className="case-graph-panel"><div className="case-graph-heading"><div><span>TRANSFER GRAPH / TABLE VIEW</span><h3>Observed movement</h3></div><span className="case-readonly-tag"><span /> READ-ONLY EVIDENCE</span></div>
        {result.transfers.length ? <div className="case-transfer-list">{result.transfers.map((transfer, index) => <article className="case-transfer" key={`${transfer.signature}-${transfer.source}-${transfer.destination}-${index}`}>
          <div className="case-transfer-flow"><span className={transfer.sourceSeed ? 'case-node case-node-seed' : 'case-node'} title={transfer.source}>{shorten(transfer.source)}</span><div className="case-flow-line"><span>{transfer.kind === 'SOL' ? 'SOL' : 'TOKEN'}</span><ArrowUpRight size={14} /></div><span className="case-node" title={transfer.destination}>{shorten(transfer.destination)}</span></div>
          <div className="case-transfer-data"><strong>{amountLabel(transfer)}</strong><span>{dateLabel(transfer.blockTime)}</span><span>Slot {transfer.slot.toLocaleString()}</span></div>
          <div className="case-transfer-meta"><span>{transfer.asset}</span>{transfer.kind === "TOKEN" && transfer.sourceTokenAccount && transfer.destinationTokenAccount && <span className="case-token-accounts" title={"Source token account: " + transfer.sourceTokenAccount + "\nDestination token account: " + transfer.destinationTokenAccount}>Token accounts: {shorten(transfer.sourceTokenAccount)} → {shorten(transfer.destinationTokenAccount)}</span>}<a href={`https://solscan.io/tx/${encodeURIComponent(transfer.signature)}${result.network === 'devnet' ? '?cluster=devnet' : ''}`} target="_blank" rel="noreferrer noopener">View transaction <ArrowUpRight size={12} /></a><button type="button" onClick={() => navigator.clipboard?.writeText(transfer.signature)} title="Copy signature"><Clipboard size={12} /> Copy signature</button></div>
        </article>)}</div> : <div className="case-empty-result"><GitBranch size={21} /><strong>No parseable transfers returned</strong><p>VERA did not find recent parseable transfer instructions in the transactions returned by the selected RPC. Try adding the full transaction signature or another known intermediary address.</p></div>}
      </div>
      <div className="case-evidence-limitations"><div><ShieldCheck size={16} /><strong>Interpretation guardrails</strong></div>{result.limitations.map((item) => <p key={item}>{item}</p>)}</div>
    </section>}

    <footer className="case-footer"><span>VERA / SOLANA INVESTIGATION TERMINAL</span><span>Public-chain evidence only · No financial execution</span><a href="/">Return to VERA <ArrowUpRight size={12} /></a></footer>
  </main>;
}
