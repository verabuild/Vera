import type { Evidence } from '../lib/types.js';

const TIMEOUT_MS = 4000;

type Pair = {
  dexId?: string;
  pairAddress?: string;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
};

function looksLikeSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export async function inspectSolanaTokenMarkets(address: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();

  if (!looksLikeSolanaAddress(address)) {
    return [{
      id: 'dex-token-skipped',
      title: 'Token market lookup skipped',
      detail: 'The supplied value is not shaped like a Solana address.',
      severity: 'info',
      source: 'DEX Screener public API',
      state: 'UNKNOWN',
      observedAt
    }];
  }

  try {
    const endpoint = `https://api.dexscreener.com/token-pairs/v1/solana/${encodeURIComponent(address.trim())}`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json', 'User-Agent': 'VERA-security-scanner/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (response.status === 404) {
      return [{
        id: 'dex-token-no-markets',
        title: 'No DEX market data returned for this address',
        detail: 'DEX Screener did not return token-pair data for this address. This is compatible with a wallet address and is not a risk judgment.',
        severity: 'info',
        source: 'DEX Screener public API',
        state: 'UNKNOWN',
        observedAt
      }];
    }

    if (!response.ok) {
      return [{
        id: 'dex-token-unavailable',
        title: 'DEX market lookup unavailable',
        detail: `DEX Screener returned HTTP ${response.status}. Market enrichment is unavailable and is not treated as a clean result.`,
        severity: 'info',
        source: 'DEX Screener public API',
        state: 'UNKNOWN',
        observedAt
      }];
    }

    const data = await response.json() as unknown;
    const pairs = Array.isArray(data) ? data as Pair[] : [];
    if (!pairs.length) {
      return [{
        id: 'dex-token-no-markets',
        title: 'No DEX market data returned',
        detail: 'No Solana token-pair market data was returned for this address.',
        severity: 'info',
        source: 'DEX Screener public API',
        state: 'UNKNOWN',
        observedAt
      }];
    }

    const bestLiquidity = Math.max(0, ...pairs.map((pair) => Number(pair.liquidity?.usd ?? 0)).filter(Number.isFinite));
    const h24Volume = Math.max(0, ...pairs.map((pair) => Number(pair.volume?.h24 ?? 0)).filter(Number.isFinite));
    return [{
      id: 'dex-token-markets',
      title: 'Solana token market data found',
      detail: `DEX Screener returned ${pairs.length} trading pair(s) for this address. Market depth and volume are market-context signals, not a safety verdict.`,
      severity: 'info',
      source: 'DEX Screener public API',
      state: 'SUPPORTED',
      observedAt,
      metadata: {
        pairCount: pairs.length,
        bestLiquidityUsd: bestLiquidity,
        highest24hVolumeUsd: h24Volume,
        pairs: pairs.slice(0, 8).map((pair) => ({
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          url: pair.url,
          baseToken: pair.baseToken,
          quoteToken: pair.quoteToken,
          priceUsd: pair.priceUsd,
          liquidityUsd: pair.liquidity?.usd,
          volume24hUsd: pair.volume?.h24,
          fdv: pair.fdv,
          marketCap: pair.marketCap
        }))
      }
    }];
  } catch (error) {
    return [{
      id: 'dex-token-unavailable',
      title: 'DEX market lookup unavailable',
      detail: `VERA could not complete the DEX market lookup (${error instanceof Error ? error.name : 'network error'}).`,
      severity: 'info',
      source: 'DEX Screener public API',
      state: 'UNKNOWN',
      observedAt
    }];
  }
}
