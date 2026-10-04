import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const TIMEOUT_MS = 7000;

type UrlhausResponse = {
  query_status?: string;
  id?: string | number;
  url?: string;
  url_status?: string | null;
  host?: string;
  date_added?: string;
  threat?: string;
  blacklists?: Record<string, unknown>;
  reporter?: string;
  larted?: string | null;
  tags?: Array<{ tag?: string; urlhaus_reference?: string }>;
  urlhaus_reference?: string;
};

function evidence(
  item: Omit<Evidence, 'observedAt'>,
  observedAt: string
): Evidence {
  return { ...item, observedAt };
}

export async function inspectThreatIntel(rawInput: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  let url: URL;

  try {
    url = normalizeUrlInput(rawInput);
  } catch {
    return [evidence({
      id: 'urlhaus-invalid-url',
      title: 'URLhaus lookup skipped',
      detail: 'VERA could not normalise this input into a supported HTTP or HTTPS URL, so no URLhaus reputation lookup was performed.',
      severity: 'info',
      source: 'VERA threat-intelligence layer',
      state: 'UNKNOWN'
    }, observedAt)];
  }

  const authKey = process.env.URLHAUS_AUTH_KEY;
  if (!authKey) {
    return [evidence({
      id: 'urlhaus-not-configured',
      title: 'URLhaus threat intelligence is not configured',
      detail: 'The server has no URLHAUS_AUTH_KEY configured. VERA did not perform a URLhaus lookup, and this must not be interpreted as a clean result.',
      severity: 'info',
      source: 'URLhaus API configuration',
      state: 'UNKNOWN',
      metadata: { provider: 'URLhaus', configured: false }
    }, observedAt)];
  }

  try {
    const body = new URLSearchParams({ url: url.href });
    const response = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Auth-Key': authKey,
        'User-Agent': 'VERA-security-scanner/1.0'
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return [evidence({
        id: 'urlhaus-unavailable',
        title: 'URLhaus lookup unavailable',
        detail: `URLhaus returned HTTP ${response.status}. VERA treats an unavailable provider as unknown, not as a clean result.`,
        severity: 'info',
        source: 'URLhaus API',
        state: 'UNKNOWN',
        metadata: { provider: 'URLhaus', httpStatus: response.status }
      }, observedAt)];
    }

    const data = await response.json() as UrlhausResponse;

    if (data.query_status === 'ok') {
      const tags = (data.tags ?? []).map((tag) => tag.tag).filter((tag): tag is string => Boolean(tag));
      return [evidence({
        id: 'urlhaus-match',
        title: 'URL listed in URLhaus malware database',
        detail: 'URLhaus returned a matching record. URLhaus tracks URLs associated with malware distribution; treat this as a serious threat signal and avoid visiting or interacting with the URL.',
        severity: 'high',
        source: 'URLhaus (abuse.ch)',
        state: 'VERIFIED',
        metadata: {
          provider: 'URLhaus',
          providerResult: 'MATCH',
          urlhausId: data.id,
          urlStatus: data.url_status ?? undefined,
          host: data.host,
          dateAdded: data.date_added,
          threat: data.threat,
          tags,
          reference: data.urlhaus_reference,
          blacklists: data.blacklists
        }
      }, observedAt)];
    }

    if (data.query_status === 'no_results') {
      return [evidence({
        id: 'urlhaus-no-match',
        title: 'No URLhaus record found',
        detail: 'URLhaus returned no matching record for this URL at the time of the lookup. URLhaus focuses on malware-distribution URLs, so no match does not rule out phishing, impersonation, fraud, or a newly emerging threat.',
        severity: 'info',
        source: 'URLhaus (abuse.ch)',
        state: 'SUPPORTED',
        metadata: { provider: 'URLhaus', providerResult: 'NO_MATCH' }
      }, observedAt)];
    }

    return [evidence({
      id: 'urlhaus-unavailable',
      title: 'URLhaus could not complete the lookup',
      detail: `URLhaus returned query status "${data.query_status ?? 'missing'}". VERA cannot treat this response as evidence that the URL is safe.`,
      severity: 'info',
      source: 'URLhaus API',
      state: 'UNKNOWN',
      metadata: { provider: 'URLhaus', providerResult: data.query_status ?? 'unknown' }
    }, observedAt)];
  } catch (error) {
    return [evidence({
      id: 'urlhaus-unavailable',
      title: 'URLhaus lookup unavailable',
      detail: `VERA could not complete the URLhaus lookup (${error instanceof Error ? error.name : 'network error'}). This is an unavailable check, not a clean result.`,
      severity: 'info',
      source: 'URLhaus API',
      state: 'UNKNOWN',
      metadata: { provider: 'URLhaus', lookupFailed: true }
    }, observedAt)];
  }
}
