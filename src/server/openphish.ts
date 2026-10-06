import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const TIMEOUT_MS = 4500;

type OpenPhishResponse = {
  found?: boolean;
  phish?: {
    id?: number | string;
    url?: string;
    status?: string;
    target_brand?: string;
    verified_at?: string;
  };
};

export async function inspectOpenPhish(rawInput: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();

  let url: URL;
  try {
    url = normalizeUrlInput(rawInput);
  } catch {
    return [{
      id: 'openphish-invalid-url',
      title: 'OpenPhish lookup skipped',
      detail: 'VERA could not normalise the input into a supported HTTP or HTTPS URL.',
      severity: 'info',
      source: 'OpenPhish community phishing database',
      state: 'UNKNOWN',
      observedAt
    }];
  }

  try {
    const endpoint = new URL('https://openphish.eu/api/check');
    endpoint.searchParams.set('url', url.href);
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json', 'User-Agent': 'VERA-security-scanner/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return [{
        id: 'openphish-unavailable',
        title: 'OpenPhish lookup unavailable',
        detail: `OpenPhish returned HTTP ${response.status}. The phishing check is unavailable and is not treated as a clean result.`,
        severity: 'info',
        source: 'OpenPhish API',
        state: 'UNKNOWN',
        observedAt,
        metadata: { httpStatus: response.status }
      }];
    }

    const data = await response.json() as OpenPhishResponse;
    if (data.found) {
      return [{
        id: 'openphish-match',
        title: 'URL listed by OpenPhish',
        detail: 'OpenPhish returned a phishing-database match for this URL. This is a strong phishing signal; avoid credentials, wallet connections and financial actions on the destination.',
        severity: 'high',
        source: 'OpenPhish community phishing database',
        state: 'VERIFIED',
        observedAt,
        metadata: {
          provider: 'OpenPhish',
          url: data.phish?.url ?? url.href,
          status: data.phish?.status,
          targetBrand: data.phish?.target_brand,
          verifiedAt: data.phish?.verified_at,
          id: data.phish?.id
        }
      }];
    }

    return [{
      id: 'openphish-no-match',
      title: 'No OpenPhish record found',
      detail: 'OpenPhish did not return a match for this URL. A no-match is only evidence about this phishing feed and does not establish legitimacy.',
      severity: 'info',
      source: 'OpenPhish community phishing database',
      state: 'SUPPORTED',
      observedAt,
      metadata: { provider: 'OpenPhish', providerResult: 'NO_MATCH' }
    }];
  } catch (error) {
    return [{
      id: 'openphish-unavailable',
      title: 'OpenPhish lookup unavailable',
      detail: `VERA could not complete the OpenPhish lookup (${error instanceof Error ? error.name : 'network error'}). An unavailable check is not a clean result.`,
      severity: 'info',
      source: 'OpenPhish API',
      state: 'UNKNOWN',
      observedAt,
      metadata: { lookupFailed: true }
    }];
  }
}
