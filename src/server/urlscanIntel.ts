import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const TIMEOUT_MS = 4500;

type UrlscanResult = {
  task?: { uuid?: string; time?: string; visibility?: string };
  page?: { url?: string; domain?: string; status?: string; title?: string; country?: string; server?: string };
  verdicts?: { overall?: { malicious?: boolean; score?: number } };
  lists?: Record<string, unknown>;
};

type UrlscanSearchResponse = {
  results?: Array<{
    _id?: string;
    task?: { time?: string };
    page?: { url?: string; domain?: string; country?: string; server?: string };
    verdicts?: { overall?: { malicious?: boolean; score?: number } };
    result?: string;
  }>;
  total?: number;
};

export async function inspectUrlscan(rawInput: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();

  let url: URL;
  try {
    url = normalizeUrlInput(rawInput);
  } catch {
    return [{
      id: 'urlscan-invalid-url',
      title: 'urlscan lookup skipped',
      detail: 'VERA could not normalise the input into a supported HTTP or HTTPS URL.',
      severity: 'info',
      source: 'urlscan.io',
      state: 'UNKNOWN',
      observedAt
    }];
  }

  const domain = url.hostname.toLowerCase().replace(/^www\./, '');
  try {
    const endpoint = new URL('https://urlscan.io/api/v1/search/');
    endpoint.searchParams.set('q', `domain:${domain}`);
    endpoint.searchParams.set('size', '5');

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'VERA-security-scanner/1.0'
    };
    if (process.env.URLSCAN_API_KEY) headers['API-Key'] = process.env.URLSCAN_API_KEY;

    const response = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return [{
        id: 'urlscan-unavailable',
        title: 'urlscan history unavailable',
        detail: `urlscan.io returned HTTP ${response.status}. Historical scan enrichment is unavailable and is not treated as a clean result.`,
        severity: 'info',
        source: 'urlscan.io Search API',
        state: 'UNKNOWN',
        observedAt,
        metadata: { domain, httpStatus: response.status, authenticated: Boolean(process.env.URLSCAN_API_KEY) }
      }];
    }

    const data = await response.json() as UrlscanSearchResponse;
    const results = Array.isArray(data.results) ? data.results.slice(0, 5) : [];

    return [{
      id: 'urlscan-history',
      title: results.length ? 'Historical urlscan observations found' : 'No urlscan history returned',
      detail: results.length
        ? `urlscan.io returned ${results.length} historical public scan result(s) for ${domain}. Historical observations can reveal prior page metadata or malicious verdict signals, but they are not proof that the current page is unchanged.`
        : `urlscan.io did not return historical public scan results for ${domain}. This is a coverage result, not evidence of safety.`,
      severity: results.some((item) => item.verdicts?.overall?.malicious) ? 'high' : 'info',
      source: 'urlscan.io Search API',
      state: results.some((item) => item.verdicts?.overall?.malicious) ? 'SUPPORTED' : 'UNKNOWN',
      observedAt,
      metadata: {
        domain,
        total: data.total ?? results.length,
        results: results.map((item) => ({
          id: item._id,
          time: item.task?.time,
          url: item.page?.url,
          domain: item.page?.domain,
          country: item.page?.country,
          server: item.page?.server,
          malicious: item.verdicts?.overall?.malicious,
          score: item.verdicts?.overall?.score,
          result: item.result
        }))
      }
    }];
  } catch (error) {
    return [{
      id: 'urlscan-unavailable',
      title: 'urlscan history unavailable',
      detail: `VERA could not complete the urlscan history lookup (${error instanceof Error ? error.name : 'network error'}).`,
      severity: 'info',
      source: 'urlscan.io Search API',
      state: 'UNKNOWN',
      observedAt,
      metadata: { domain, lookupFailed: true }
    }];
  }
}
