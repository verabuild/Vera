import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const THREAT_TYPES = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'] as const;
const TIMEOUT_MS = 5000;

type WebRiskResponse = {
  threat?: {
    threatTypes?: string[];
    expireTime?: string;
  };
};

/**
 * Checks a URL against Google's Web Risk Lookup API.
 * The API key is server-side only. A clean response means no matching threat
 * was returned by this provider, not that the website is guaranteed safe.
 */
export async function inspectWebRisk(rawInput: string): Promise<Evidence> {
  const observedAt = new Date().toISOString();

  if (!process.env.WEB_RISK_API_KEY) {
    return {
      id: 'threat-intel-not-configured',
      title: 'Threat-intelligence check not configured',
      detail: 'Google Web Risk was not queried because WEB_RISK_API_KEY is not configured. VERA cannot report a clean threat result without a successful provider lookup.',
      severity: 'info',
      source: 'Google Web Risk Lookup API',
      state: 'UNKNOWN',
      observedAt,
      metadata: { provider: 'Google Web Risk', configured: false }
    };
  }

  let url: URL;
  try {
    url = normalizeUrlInput(rawInput);
  } catch {
    return {
      id: 'threat-intel-invalid-url',
      title: 'Threat-intelligence check skipped',
      detail: 'VERA could not normalise this input into a supported HTTP or HTTPS URL, so no reputation lookup was performed.',
      severity: 'info',
      source: 'Google Web Risk Lookup API',
      state: 'UNKNOWN',
      observedAt
    };
  }

  try {
    const endpoint = new URL('https://webrisk.googleapis.com/v1/uris:search');
    endpoint.searchParams.set('uri', url.href);
    for (const threatType of THREAT_TYPES) endpoint.searchParams.append('threatTypes', threatType);

    // Keep authentication in a request header. Google recommends the
    // x-goog-api-key header for API-key authentication because query-string
    // keys can be exposed by URL logging and tracing infrastructure.
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'x-goog-api-key': process.env.WEB_RISK_API_KEY
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      // Preserve the provider's machine-readable error reason for server-side
      // diagnostics, but never return the API key or request URL.
      let providerReason = '';
      try {
        const errorBody = await response.json() as {
          error?: { status?: string; message?: string; details?: Array<{ reason?: string }> };
        };
        providerReason = [
          errorBody.error?.status,
          errorBody.error?.details?.map((detail) => detail.reason).filter(Boolean).join(', '),
          errorBody.error?.message
        ].filter(Boolean).join(' — ');
      } catch {
        // The provider may return a non-JSON error body.
      }

      const category = response.status === 400
        ? 'Google rejected the request as invalid. Check the Web Risk request parameters.'
        : response.status === 403
          ? 'Google rejected the credentials or API-key restrictions. Confirm Web Risk is enabled for the key’s Google Cloud project and that the key is allowed to call Web Risk.'
          : response.status === 429
            ? 'The provider rate limit was reached.'
            : `The provider returned HTTP ${response.status}.`;

      return {
        id: 'threat-intel-unavailable',
        title: 'Threat-intelligence lookup unavailable',
        detail: `Google Web Risk did not return a usable result. ${category} ${providerReason ? `Provider: ${providerReason}. ` : ''}VERA treats this as unknown, not as a clean result.`,
        severity: 'info',
        source: 'Google Web Risk Lookup API',
        state: 'UNKNOWN',
        observedAt,
        metadata: {
          provider: 'Google Web Risk',
          httpStatus: response.status,
          providerStatus: providerReason || undefined
        }
      };
    }

    const data = await response.json() as WebRiskResponse;
    const matchedTypes = [...new Set(data.threat?.threatTypes ?? [])];

    if (matchedTypes.length) {
      return {
        id: 'threat-intel-match',
        title: 'Known threat reported by Google Web Risk',
        detail: `Google Web Risk matched this URL to the following threat category or categories: ${matchedTypes.join(', ')}. This is a provider-reported threat match and should be treated as a serious warning.`,
        severity: 'high',
        source: 'Google Web Risk Lookup API',
        state: 'VERIFIED',
        observedAt,
        metadata: {
          provider: 'Google Web Risk',
          threatTypes: matchedTypes,
          providerResult: 'MATCH',
          expireTime: data.threat?.expireTime
        }
      };
    }

    return {
      id: 'threat-intel-no-match',
      title: 'No known threats detected by Google Web Risk',
      detail: 'Google Web Risk returned no match for the checked threat categories at the time of this lookup. This does not prove that the website is legitimate or safe, and newly emerging or unlisted threats may not be detected.',
      severity: 'info',
      source: 'Google Web Risk Lookup API',
      state: 'SUPPORTED',
      observedAt,
      metadata: {
        provider: 'Google Web Risk',
        threatTypesChecked: [...THREAT_TYPES],
        providerResult: 'NO_MATCH'
      }
    };
  } catch (error) {
    return {
      id: 'threat-intel-unavailable',
      title: 'Threat-intelligence lookup unavailable',
      detail: `VERA could not complete the Google Web Risk lookup (${error instanceof Error ? error.name : 'network error'}). This is an unavailable check, not a clean result.`,
      severity: 'info',
      source: 'Google Web Risk Lookup API',
      state: 'UNKNOWN',
      observedAt,
      metadata: { provider: 'Google Web Risk', lookupFailed: true }
    };
  }
}
