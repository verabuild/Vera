import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const RDAP_TIMEOUT_MS = 8000;
const NEW_DOMAIN_DAYS = 30;

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapResponse = { events?: RdapEvent[]; ldhName?: string };


type DnsJsonResponse = {
  Status?: number;
  Answer?: Array<{ name?: string; type?: number; data?: string; TTL?: number }>;
};

async function inspectDns(hostname: string, observedAt: string): Promise<Evidence> {
  try {
    const query = new URL('https://cloudflare-dns.com/dns-query');
    query.searchParams.set('name', hostname);
    query.searchParams.set('type', 'A');
    const response = await fetch(query, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`DNS-over-HTTPS returned HTTP ${response.status}`);
    const data = await response.json() as DnsJsonResponse;
    const addresses = (data.Answer || [])
      .filter((answer) => answer.type === 1 && answer.data)
      .map((answer) => answer.data as string);

    if (addresses.length) {
      return {
        id: 'domain-dns-resolves',
        title: 'Domain DNS records found',
        detail: `${hostname} currently resolves to ${[...new Set(addresses)].slice(0, 4).join(', ')} according to Cloudflare DNS-over-HTTPS. DNS resolution confirms the hostname has address records; it does not establish that the website is trustworthy.`,
        severity: 'info',
        source: 'Cloudflare DNS-over-HTTPS',
        state: 'SUPPORTED',
        observedAt,
        metadata: { hostname, addresses: [...new Set(addresses)], resolver: 'Cloudflare' }
      };
    }

    return {
      id: 'domain-dns-no-a-record',
      title: 'No IPv4 DNS answer returned',
      detail: `Cloudflare DNS-over-HTTPS did not return an IPv4 address for ${hostname}. The domain may use IPv6, may not resolve, or the lookup may be inconclusive.`,
      severity: 'info',
      source: 'Cloudflare DNS-over-HTTPS',
      state: 'UNKNOWN',
      observedAt,
      metadata: { hostname, dnsStatus: data.Status }
    };
  } catch {
    return {
      id: 'domain-dns-unavailable',
      title: 'DNS lookup unavailable',
      detail: 'VERA could not retrieve DNS evidence during this scan. This is a lookup limitation, not a trust verdict.',
      severity: 'info',
      source: 'Cloudflare DNS-over-HTTPS',
      state: 'UNKNOWN',
      observedAt,
      metadata: { hostname }
    };
  }
}

type RdapBootstrap = { services?: Array<[string[], string[]]> };

async function fetchJson(url: string, timeoutMs = 5000): Promise<Response> {
  return fetch(url, {
    headers: { Accept: 'application/rdap+json, application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
}

async function findRdapResponse(domain: string): Promise<{ response: Response; provider: string }> {
  const attempts: Array<{ url: string; provider: string }> = [];

  // IANA's bootstrap file maps each top-level domain to its authoritative RDAP service.
  // This avoids relying solely on rdap.org's redirect/aggregator.
  try {
    const bootstrapResponse = await fetchJson('https://data.iana.org/rdap/dns.json', 4000);
    if (bootstrapResponse.ok) {
      const bootstrap = await bootstrapResponse.json() as RdapBootstrap;
      const tld = domain.split('.').pop()?.toLowerCase();
      const service = bootstrap.services?.find(([tlds]) => tlds.some((item) => item.toLowerCase() === tld));
      const base = service?.[1]?.[0];
      if (base) attempts.push({
        url: `${base.replace(/\/$/, '')}/domain/${encodeURIComponent(domain)}`,
        provider: new URL(base).hostname
      });
    }
  } catch {
    // Continue to the independent fallback below.
  }

  attempts.push({
    url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
    provider: 'rdap.org'
  });

  let lastError = 'No RDAP provider returned a usable response';
  for (const attempt of attempts) {
    try {
      const response = await fetchJson(attempt.url, 5000);
      if (response.ok) return { response, provider: attempt.provider };
      lastError = `${attempt.provider} returned HTTP ${response.status}`;
    } catch (error) {
      lastError = `${attempt.provider} request failed: ${error instanceof Error ? error.name : 'network error'}`;
    }
  }
  throw new Error(lastError);
}

export async function inspectDomainRegistration(rawUrl: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  let hostname = '';

  try {
    const url = normalizeUrlInput(rawUrl);
    hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const dnsEvidence = await inspectDns(hostname, observedAt);

    if (!hostname || hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
      return [dnsEvidence, {
        id: 'domain-registration-not-applicable',
        title: 'Domain registration lookup not applicable',
        detail: 'This address does not contain a public DNS hostname that VERA can check through RDAP.',
        severity: 'info',
        source: 'VERA domain intelligence',
        state: 'UNKNOWN',
        observedAt
      }];
    }

    const lookupHost = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    const { response, provider } = await findRdapResponse(lookupHost);
    const data = await response.json() as RdapResponse;
    const registrationEvent = data.events?.find((event) =>
      ['registration', 'registered'].includes((event.eventAction || '').toLowerCase())
    );

    if (!registrationEvent?.eventDate) {
      return [dnsEvidence, {
        id: 'domain-registration-date-unavailable',
        title: 'Registration date unavailable',
        detail: `${provider} returned domain data for ${lookupHost}, but no registration date was available. Domain registration details may be redacted or omitted by the registry.`,
        severity: 'info',
        source: `RDAP registry: ${provider}`,
        state: 'UNKNOWN',
        observedAt,
        metadata: { hostname, lookupHost, provider }
      }];
    }

    const registeredAt = new Date(registrationEvent.eventDate);
    if (Number.isNaN(registeredAt.getTime())) {
      return [dnsEvidence, {
        id: 'domain-registration-date-invalid',
        title: 'Registration date could not be verified',
        detail: `${provider} returned a registration date that VERA could not interpret reliably.`,
        severity: 'info',
        source: `RDAP registry: ${provider}`,
        state: 'UNKNOWN',
        observedAt,
        metadata: { hostname, lookupHost, provider }
      }];
    }

    const ageDays = Math.max(0, Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000));
    const isNew = ageDays < NEW_DOMAIN_DAYS;

    return [dnsEvidence, {
      id: isNew ? 'domain-recent-registration' : 'domain-registration-age',
      title: isNew ? 'Recently registered domain' : 'Domain registration date found',
      detail: isNew
        ? `${lookupHost} appears to have been registered ${ageDays} day(s) ago. Newly registered domains can deserve extra scrutiny, but domain age alone does not establish maliciousness.`
        : `The registry reports a registration date of ${registeredAt.toISOString().slice(0, 10)} for ${lookupHost} (approximately ${ageDays} days ago). Domain age alone does not establish legitimacy.`,
      severity: isNew ? 'medium' : 'info',
      source: `RDAP registry: ${provider}`,
      state: 'SUPPORTED',
      observedAt,
      metadata: { hostname, lookupHost, provider, registeredAt: registeredAt.toISOString(), ageDays, lookupUrl: `https://rdap.org/domain/${encodeURIComponent(lookupHost)}` }
    }];
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown RDAP lookup failure';
    const fallbackDnsEvidence = hostname ? await inspectDns(hostname, observedAt) : null;
    return [...(fallbackDnsEvidence ? [fallbackDnsEvidence] : []), {
      id: 'domain-intelligence-unavailable',
      title: 'Domain registration lookup unavailable',
      detail: `VERA could not retrieve domain registration data: ${detail}. DNS evidence, if present, is reported separately and does not establish trustworthiness.`,
      severity: 'info',
      source: 'IANA RDAP bootstrap and registry fallback',
      state: 'UNKNOWN',
      observedAt,
      metadata: { hostname: hostname || undefined, lookupFailed: true }
    }];
  }
}
