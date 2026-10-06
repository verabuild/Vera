import type { Evidence, Network } from '../lib/types.js';
import { inspectWallet } from './solana.js';
import { inspectMagicEdenWallet } from './magicEden.js';
import { inspectDomainRegistration } from './domainIntel.js';
import { inspectThreatIntel } from './threatIntel.js';
import { inspectWebReputation } from './reputationIntel.js';
import { inspectOpenPhish } from './openphish.js';
import { inspectUrlscan } from './urlscanIntel.js';
import { inspectChainabuseTarget } from './chainabuse.js';
import { inspectWebsiteSurface } from './webSurface.js';
import { inspectSolanaTokenMarkets } from './tokenIntel.js';

async function settledEvidence(provider: string, run: () => Promise<Evidence[]>): Promise<Evidence[]> {
  try {
    return await run();
  } catch (error) {
    console.error(`VERA ${provider} provider error`, error);
    return [{
      id: `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-unavailable`,
      title: `${provider} evidence unavailable`,
      detail: `VERA could not complete the ${provider} check. The missing source is treated as unknown and does not reduce the risk assessment.`,
      severity: 'info',
      source: `VERA ${provider}`,
      state: 'UNKNOWN',
      observedAt: new Date().toISOString(),
      metadata: { provider, lookupFailed: true }
    }];
  }
}

export interface UrlInvestigationEvidence {
  domain: Evidence[];
  threat: Evidence[];
  reputation: Evidence[];
  surface: Evidence[];
  openphish: Evidence[];
  urlscan: Evidence[];
  chainabuse: Evidence[];
}

export async function investigateUrlProviders(rawUrl: string): Promise<UrlInvestigationEvidence> {
  const results = await Promise.all([
    settledEvidence('Domain intelligence', () => inspectDomainRegistration(rawUrl)),
    settledEvidence('Threat intelligence', () => inspectThreatIntel(rawUrl)),
    settledEvidence('Web reputation', () => inspectWebReputation(rawUrl)),
    settledEvidence('Website surface', () => inspectWebsiteSurface(rawUrl)),
    settledEvidence('OpenPhish', () => inspectOpenPhish(rawUrl)),
    settledEvidence('urlscan', () => inspectUrlscan(rawUrl)),
    settledEvidence('Chainabuse', async () => {
      let target = rawUrl.trim();
      if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
      const parsed = new URL(target);
      return inspectChainabuseTarget({ type: 'URL', value: parsed.href });
    })
  ]);

  return {
    domain: results[0],
    threat: results[1],
    reputation: results[2],
    surface: results[3],
    openphish: results[4],
    urlscan: results[5],
    chainabuse: results[6]
  };
}

export async function investigateWalletProviders(address: string, network: Network): Promise<Evidence[]> {
  const [solana, marketplace, chainabuse, markets] = await Promise.all([
    settledEvidence('Solana RPC', () => inspectWallet(address, network)),
    settledEvidence('Magic Eden', () => inspectMagicEdenWallet(address, network)),
    settledEvidence('Chainabuse', () => inspectChainabuseTarget({ type: 'ADDRESS', value: address, chain: 'solana' })),
    settledEvidence('DEX Screener', () => inspectSolanaTokenMarkets(address))
  ]);

  return [...solana, ...marketplace, ...chainabuse, ...markets];
}
