import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const TIMEOUT_MS = 5000;

type PhishTankResponse = {
  results?: {
    in_database?: boolean | string;
    verified?: boolean | string;
    valid?: boolean | string;
    phish_id?: number | string;
    phish_detail_page?: string;
  };
};

function boolLike(value: unknown): boolean {
  return value === true || value === 'true' || value === 'y' || value === 'yes';
}

export async function inspectThreatIntel(rawInput: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  let url: URL;

  try {
    url = normalizeUrlInput(rawInput);
  } catch {
    return [{
      id: 'threat-intel-invalid-url',
      title: 'Threat-intelligence check skipped',
      detail: 'VERA could not normalise this input into a supported HTTP or HTTPS URL, so no reputation lookup was performed.',
      severity: 'info',
      source: 'VERA threat-intelligence layer',
      state: 'UNKNOWN',
      observedAt
    }];
  }

  try {
    const body = new URLSearchParams({ url: url.href, format: 'json' });
    const appKey = process.env.PHISHTANK_APP_KEY;
    if (appKey) body.set('app_key', appKey);

    const response = await fetch('https://checkurl.phishtank.com/checkurl/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VERA-security-scanner/1.0'
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return [{
        id: 'phishtank-unavailable',
        title: 'PhishTank lookup unavailable',
        detail: `PhishTank returned HTTP ${response.status}. VERA treats an unavailable provider as unknown, not as a clean result.`,
        severity: 'info',
        source: 'PhishTank API',
        state: 'UNKNOWN',
        observedAt,
        metadata: { provider: 'PhishTank', httpStatus: response.status }
      }];
    }

    const data = await response.json() as PhishTankResponse;
    const result = data.results;
    const listed = boolLike(result?.in_database);
    const verified = boolLike(result?.verified);
    const valid = boolLike(result?.valid);

    if (listed && verified && valid) {
      return [{
        id: 'phishtank-match',
        title: 'Phishing URL verified by PhishTank',
        detail: 'PhishTank reports this URL as a verified and currently valid phishing entry. This is a strong external threat signal.',
        severity: 'high',
        source: 'PhishTank API',
        state: 'VERIFIED',
        observedAt,
        metadata: {
          provider: 'PhishTank',
          providerResult: 'MATCH',
          phishId: result?.phish_id,
          detailPage: result?.phish_detail_page
        }
      }];
    }

    return [{
      id: 'phishtank-no-match',
      title: 'No verified phishing match in PhishTank',
      detail: 'PhishTank returned no verified-and-valid phishing match for this URL at the time of the lookup. This does not prove that the website is legitimate or safe.',
      severity: 'info',
      source: 'PhishTank API',
      state: 'SUPPORTED',
      observedAt,
      metadata: {
        provider: 'PhishTank',
        providerResult: 'NO_MATCH',
        inDatabase: listed,
        verified,
        valid
      }
    }];
  } catch (error) {
    return [{
      id: 'phishtank-unavailable',
      title: 'PhishTank lookup unavailable',
      detail: `VERA could not complete the PhishTank lookup (${error instanceof Error ? error.name : 'network error'}). This is an unavailable check, not a clean result.`,
      severity: 'info',
      source: 'PhishTank API',
      state: 'UNKNOWN',
      observedAt,
      metadata: { provider: 'PhishTank', lookupFailed: true }
    }];
  }
}
