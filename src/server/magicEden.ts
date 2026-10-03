import type { Evidence, Network } from '../lib/types';

export async function inspectMagicEdenWallet(address: string, network: Network): Promise<Evidence[]> {
  const base = network === 'devnet'
    ? (process.env.MAGIC_EDEN_DEVNET_BASE_URL || 'https://api-devnet.magiceden.dev/v2')
    : (process.env.MAGIC_EDEN_MAINNET_BASE_URL || 'https://api-mainnet.magiceden.dev/v2');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (process.env.MAGIC_EDEN_API_KEY) headers.Authorization = `Bearer ${process.env.MAGIC_EDEN_API_KEY}`;
  const observedAt = new Date().toISOString();
  const url = `${base}/wallets/${encodeURIComponent(address)}/tokens`;
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as unknown;
    const count = Array.isArray(data) ? data.length : (Array.isArray((data as any)?.tokens) ? (data as any).tokens.length : 0);
    return [{ id: 'magic-eden-tokens', title: 'Magic Eden wallet intelligence', detail: `Magic Eden returned wallet token/NFT data for this address (${count} top-level items observed). Marketplace data is evidence, not proof of project safety.`, severity: 'info', source: 'Magic Eden Solana API', state: 'SUPPORTED', observedAt, metadata: { count } }];
  } catch (error) {
    return [{ id: 'magic-eden-unavailable', title: 'Magic Eden intelligence unavailable', detail: 'VERA could not retrieve Magic Eden wallet data for this scan. No safety conclusion is inferred from the missing source.', severity: 'info', source: 'Magic Eden Solana API', state: 'UNKNOWN', observedAt, metadata: { error: error instanceof Error ? error.message : 'unknown' } }];
  }
}