import type { Network } from '../lib/types.js';

type ProviderState = 'READY' | 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'NO_MATCH' | 'SKIPPED';

export type EnrichedTransfer = {
  signature: string;
  slot: number;
  blockTime: number | null;
  source: string;
  destination: string;
  asset: string;
  mint?: string;
  rawAmount: string;
  amount: number | null;
  decimals?: number;
  kind: 'SOL' | 'TOKEN';
  sourceSeed: boolean;
  depth: number;
  sourceProvider: 'Helius';
};

export type CaseIntelligence = {
  providers: {
    helius: { state: ProviderState; detail: string };
    breadcrumbs: { state: ProviderState; detail: string };
    dexscreener: { state: ProviderState; detail: string };
  };
  historyTransfers: EnrichedTransfer[];
  labels: Array<{ address: string; label: string; tags: string[]; sourceUrl: string }>;
  riskSignals: Array<{ address: string; riskScore: string; tags: string[]; incomingHop: number | null; outgoingHop: number | null; sourceUrl: string }>;
  markets: Array<{ mint: string; pairUrl: string; dexId: string; priceUsd: string | null; liquidityUsd: number | null; volume24h: number | null }>;
};

const safeObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};
const stringValue = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberValue = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

async function heliusHistory(addresses: string[], network: Network) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return { state: 'NOT_CONFIGURED' as const, detail: 'Add HELIUS_API_KEY on the server to enable expanded parsed history.', transfers: [] as EnrichedTransfer[] };
  if (network !== 'mainnet') return { state: 'SKIPPED' as const, detail: 'Expanded Helius history is currently enabled for Solana Mainnet only.', transfers: [] as EnrichedTransfer[] };
  const outcomes = await Promise.allSettled(addresses.slice(0, 8).map(async (address) => {
    const url = new URL(`https://api-mainnet.helius-rpc.com/v0/addresses/${encodeURIComponent(address)}/transactions`);
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('limit', '20');
    url.searchParams.set('sort-order', 'desc');
    url.searchParams.set('token-accounts', 'balanceChanged');
    const payload = await fetchJson(url.toString());
    return { address, rows: Array.isArray(payload) ? payload : [] };
  }));
  const fulfilled = outcomes.filter((item): item is PromiseFulfilledResult<{ address: string; rows: unknown[] }> => item.status === 'fulfilled');
  if (!fulfilled.length) return { state: 'UNAVAILABLE' as const, detail: 'Helius could not return parsed address history for this case.', transfers: [] as EnrichedTransfer[] };
  const transfers: EnrichedTransfer[] = [];
  for (const outcome of fulfilled) {
    for (const raw of outcome.value.rows) {
      const tx = safeObject(raw);
      const signature = stringValue(tx.signature);
      if (!signature) continue;
      const slot = numberValue(tx.slot) ?? 0;
      const blockTime = numberValue(tx.timestamp);
      const nativeTransfers = Array.isArray(tx.nativeTransfers) ? tx.nativeTransfers : [];
      for (const rawTransfer of nativeTransfers) {
        const transfer = safeObject(rawTransfer);
        const source = stringValue(transfer.fromUserAccount);
        const destination = stringValue(transfer.toUserAccount);
        const lamports = numberValue(transfer.amount);
        if (!source || !destination || lamports === null || lamports < 0) continue;
        transfers.push({ signature, slot, blockTime, source, destination, asset: 'SOL', rawAmount: String(Math.round(lamports)), amount: lamports / 1e9, kind: 'SOL', sourceSeed: addresses.includes(source), depth: 0, sourceProvider: 'Helius' });
      }
      const tokenTransfers = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : [];
      for (const rawTransfer of tokenTransfers) {
        const transfer = safeObject(rawTransfer);
        const source = stringValue(transfer.fromUserAccount);
        const destination = stringValue(transfer.toUserAccount);
        const mint = stringValue(transfer.mint) ?? undefined;
        const amount = numberValue(transfer.tokenAmount);
        if (!source || !destination || amount === null) continue;
        transfers.push({ signature, slot, blockTime, source, destination, asset: mint ? `Token · ${mint}` : 'Token', ...(mint ? { mint } : {}), rawAmount: String(amount), amount, kind: 'TOKEN', sourceSeed: addresses.includes(source), depth: 0, sourceProvider: 'Helius' });
      }
      if (transfers.length >= 180) break;
    }
    if (transfers.length >= 180) break;
  }
  const unique = [...new Map(transfers.map((item) => [`${item.signature}:${item.source}:${item.destination}:${item.mint ?? item.kind}:${item.rawAmount}`, item])).values()];
  return { state: unique.length ? 'READY' as const : 'NO_MATCH' as const, detail: unique.length ? `Parsed history returned ${unique.length} additional transfer records. History is capped per address and may overlap the RPC trace.` : 'Helius returned address history but no parseable SOL or token transfer rows.', transfers: unique };
}

async function breadcrumbsIntelligence(addresses: string[], network: Network) {
  const apiKey = process.env.BREADCRUMBS_API_KEY;
  if (!apiKey) return { state: 'NOT_CONFIGURED' as const, detail: 'Add BREADCRUMBS_API_KEY on the server for optional attribution and risk signals.', labels: [] as CaseIntelligence['labels'], riskSignals: [] as CaseIntelligence['riskSignals'] };
  if (network !== 'mainnet') return { state: 'SKIPPED' as const, detail: 'Attribution lookup is skipped for Devnet; public intelligence applies to real-chain addresses.', labels: [] as CaseIntelligence['labels'], riskSignals: [] as CaseIntelligence['riskSignals'] };
  const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' };
  const outcomes = await Promise.allSettled(addresses.slice(0, 8).map(async (address) => {
    const [attribution, risk] = await Promise.allSettled([
      fetchJson('https://v2.breadcrumbs.one/attribution/address', { method: 'POST', headers, body: JSON.stringify({ address, chain: 'SOL' }) }),
      fetchJson(`https://v2.breadcrumbs.one/risk/address?chain=SOL&address=${encodeURIComponent(address)}`, { headers: { 'X-API-KEY': apiKey } })
    ]);
    return { address, attribution: attribution.status === 'fulfilled' ? safeObject(attribution.value) : null, risk: risk.status === 'fulfilled' ? safeObject(risk.value) : null };
  }));
  const fulfilled = outcomes.filter((item): item is PromiseFulfilledResult<{ address: string; attribution: Record<string, unknown> | null; risk: Record<string, unknown> | null }> => item.status === 'fulfilled');
  if (!fulfilled.length) return { state: 'UNAVAILABLE' as const, detail: 'Breadcrumbs could not return attribution or risk data for this case.', labels: [] as CaseIntelligence['labels'], riskSignals: [] as CaseIntelligence['riskSignals'] };
  const labels: CaseIntelligence['labels'] = [];
  const riskSignals: CaseIntelligence['riskSignals'] = [];
  for (const outcome of fulfilled) {
    const { address, attribution, risk } = outcome.value;
    const label = attribution ? stringValue(attribution.entity) ?? stringValue(attribution.label) ?? stringValue(attribution.name) : null;
    const tagsRaw = attribution?.tags ?? attribution?.entity_tags ?? risk?.entity_tags;
    const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : [];
    if (label || tags.length) labels.push({ address, label: label ?? 'Public intelligence tags', tags, sourceUrl: 'https://app.breadcrumbs.app/' });
    if (risk || label || tags.length) {
      const incoming = safeObject(risk?.closest_incoming_exposure);
      const outgoing = safeObject(risk?.closest_outgoing_exposure);
      const score = stringValue(risk?.risk_score) ?? stringValue(attribution?.risk_score) ?? 'Not supplied';
      riskSignals.push({ address, riskScore: score, tags, incomingHop: numberValue(incoming.hop), outgoingHop: numberValue(outgoing.hop), sourceUrl: 'https://app.breadcrumbs.app/' });
    }
  }
  return { state: labels.length || riskSignals.length ? 'READY' as const : 'NO_MATCH' as const, detail: labels.length || riskSignals.length ? 'Public attribution and risk signals were returned. Treat provider labels as sourced claims, not proof of ownership or wrongdoing.' : 'The provider returned no address labels or risk signals for this case.', labels, riskSignals };
}

async function dexscreenerMarkets(mints: string[], network: Network) {
  if (network !== 'mainnet') return { state: 'SKIPPED' as const, detail: 'Market pairs are not queried for Devnet addresses.', markets: [] as CaseIntelligence['markets'] };
  const candidates = [...new Set(mints)].slice(0, 5);
  if (!candidates.length) return { state: 'NO_MATCH' as const, detail: 'No token mint was available from the observed transfers.', markets: [] as CaseIntelligence['markets'] };
  const outcomes = await Promise.allSettled(candidates.map(async (mint) => {
    const payload = safeObject(await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`));
    const pairs = Array.isArray(payload.pairs) ? payload.pairs.map(safeObject) : [];
    const solanaPairs = pairs.filter((pair) => pair.chainId === 'solana').sort((a, b) => (numberValue(safeObject(b.liquidity).usd) ?? 0) - (numberValue(safeObject(a.liquidity).usd) ?? 0));
    return solanaPairs.slice(0, 2).map((pair) => ({
      mint,
      pairUrl: stringValue(pair.url) ?? `https://dexscreener.com/solana/${encodeURIComponent(mint)}`,
      dexId: stringValue(pair.dexId) ?? 'DEX',
      priceUsd: stringValue(pair.priceUsd) ?? (numberValue(pair.priceUsd) !== null ? String(pair.priceUsd) : null),
      liquidityUsd: numberValue(safeObject(pair.liquidity).usd),
      volume24h: numberValue(safeObject(pair.volume).h24)
    }));
  }));
  const markets = outcomes.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
  const succeeded = outcomes.filter((item) => item.status === 'fulfilled').length;
  return { state: markets.length ? 'READY' as const : succeeded ? 'NO_MATCH' as const : 'UNAVAILABLE' as const, detail: markets.length ? `Market context found for ${new Set(markets.map((item) => item.mint)).size} token mint(s). Liquidity and volume are snapshots, not proof of legitimacy.` : succeeded ? 'No matching Solana market pairs were returned.' : 'DEX Screener could not be reached.', markets };
}

export async function enrichSolanaCase(input: { addresses: string[]; transfers: Array<{ mint?: string; source?: string; destination?: string }>; network: Network }): Promise<CaseIntelligence> {
  const seeds = [...new Set(input.addresses)];
  const intelligenceAddresses = [...new Set([...seeds, ...input.transfers.flatMap((transfer) => [transfer.source, transfer.destination]).filter((address): address is string => Boolean(address))])].slice(0, 8);
  const mints = input.transfers.map((transfer) => transfer.mint).filter((mint): mint is string => Boolean(mint));
  const [helius, breadcrumbs, dexscreener] = await Promise.all([
    heliusHistory(seeds, input.network).catch(() => ({ state: 'UNAVAILABLE' as const, detail: 'Helius history lookup failed or timed out.', transfers: [] as EnrichedTransfer[] })),
    breadcrumbsIntelligence(intelligenceAddresses, input.network).catch(() => ({ state: 'UNAVAILABLE' as const, detail: 'Breadcrumbs lookup failed or timed out.', labels: [] as CaseIntelligence['labels'], riskSignals: [] as CaseIntelligence['riskSignals'] })),
    dexscreenerMarkets(mints, input.network).catch(() => ({ state: 'UNAVAILABLE' as const, detail: 'DEX Screener lookup failed or timed out.', markets: [] as CaseIntelligence['markets'] }))
  ]);
  return {
    providers: {
      helius: { state: helius.state, detail: helius.detail },
      breadcrumbs: { state: breadcrumbs.state, detail: breadcrumbs.detail },
      dexscreener: { state: dexscreener.state, detail: dexscreener.detail }
    },
    historyTransfers: helius.transfers,
    labels: breadcrumbs.labels,
    riskSignals: breadcrumbs.riskSignals,
    markets: dexscreener.markets
  };
}
