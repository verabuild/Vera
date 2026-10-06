import type { Evidence } from '../lib/types.js';

const TIMEOUT_MS = 4500;

type ChainabuseReport = {
  id?: string | number;
  category?: string;
  checked?: boolean;
  trusted?: boolean;
  scammer?: { name?: string };
  description?: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
};

type ChainabuseResponse = ChainabuseReport[] | { reports?: ChainabuseReport[]; data?: ChainabuseReport[] };

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

export async function inspectChainabuseTarget(target: { type: 'URL' | 'ADDRESS'; value: string; chain?: string }): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  const apiKey = process.env.CHAINABUSE_API_KEY;

  if (!apiKey) {
    return [{
      id: 'chainabuse-not-configured',
      title: 'Chainabuse screening not configured',
      detail: 'VERA did not call Chainabuse because CHAINABUSE_API_KEY is not configured. Missing screening data is not treated as a clean result.',
      severity: 'info',
      source: 'Chainabuse public reports',
      state: 'UNKNOWN',
      observedAt,
      metadata: { configured: false }
    }];
  }

  try {
    const endpoint = new URL('https://api.chainabuse.com/v0/reports');
    if (target.type === 'URL') endpoint.searchParams.set('domain', new URL(target.value).hostname);
    else endpoint.searchParams.set('address', target.value);
    if (target.chain) endpoint.searchParams.set('chain', target.chain);
    endpoint.searchParams.set('perPage', '10');

    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        Authorization: authHeader(apiKey),
        'User-Agent': 'VERA-security-scanner/1.0'
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return [{
        id: 'chainabuse-unavailable',
        title: 'Chainabuse screening unavailable',
        detail: `Chainabuse returned HTTP ${response.status}. VERA treats this provider as unavailable, not clean.`,
        severity: 'info',
        source: 'Chainabuse public reports',
        state: 'UNKNOWN',
        observedAt,
        metadata: { httpStatus: response.status, targetType: target.type }
      }];
    }

    const payload = await response.json() as ChainabuseResponse;
    const reports = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.reports)
        ? payload.reports
        : Array.isArray(payload.data)
          ? payload.data
          : [];

    if (reports.length) {
      const checked = reports.filter((report) => report.checked === true).length;
      return [{
        id: 'chainabuse-reports',
        title: `${reports.length} Chainabuse report(s) found`,
        detail: `Chainabuse returned ${reports.length} public report(s) associated with this ${target.type === 'URL' ? 'domain' : 'address'}. ${checked ? `${checked} report(s) are marked checked by Chainabuse moderators.` : 'The returned reports are not necessarily independently verified.'}`,
        severity: checked ? 'high' : 'medium',
        source: 'Chainabuse public reports',
        state: 'SUPPORTED',
        observedAt,
        metadata: {
          reportCount: reports.length,
          checkedCount: checked,
          reports: reports.slice(0, 6).map((report) => ({
            id: report.id,
            category: report.category,
            checked: report.checked,
            trusted: report.trusted,
            description: report.description,
            amount: report.amount,
            currency: report.currency,
            createdAt: report.createdAt
          }))
        }
      }];
    }

    return [{
      id: 'chainabuse-no-reports',
      title: 'No Chainabuse reports returned',
      detail: 'Chainabuse did not return public reports for this target. A no-report result does not establish safety or legitimacy.',
      severity: 'info',
      source: 'Chainabuse public reports',
      state: 'UNKNOWN',
      observedAt,
      metadata: { reportCount: 0, targetType: target.type }
    }];
  } catch (error) {
    return [{
      id: 'chainabuse-unavailable',
      title: 'Chainabuse screening unavailable',
      detail: `VERA could not complete the Chainabuse screening (${error instanceof Error ? error.name : 'network error'}).`,
      severity: 'info',
      source: 'Chainabuse public reports',
      state: 'UNKNOWN',
      observedAt,
      metadata: { targetType: target.type, lookupFailed: true }
    }];
  }
}
