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
        state: 'VERIFIED',
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

export async function inspectDomainRegistration(rawUrl: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();

  try {
    const url = normalizeUrlInput(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

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

    // Add a separate live DNS signal so the scan can still return useful
    // infrastructure evidence when the RDAP service is unavailable.
    const dnsEvidence = await inspectDns(hostname, observedAt);

    // RDAP is a domain-registration service, not a subdomain lookup. A common
    // pasted hostname such as www.google.com must be checked as google.com.
    const lookupHost = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    const lookup = async (domain: string) => fetch(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(RDAP_TIMEOUT_MS)
      }
    );
    let response = await lookup(lookupHost);
    if (response.status === 404 && lookupHost !== hostname) {
      response = await lookup(hostname);
    }

    if (response.status === 404) {
      return [dnsEvidence, {
        id: 'domain-rdap-not-found',
        title: 'No domain registration record returned',
        detail: `The public RDAP lookup did not return a registration record for ${lookupHost}. This may reflect an unsupported domain, lookup limitation, or missing record; it is not proof of maliciousness.`,
        severity: 'medium',
        source: 'Public RDAP domain lookup',
        state: 'UNKNOWN',
        observedAt,
        metadata: { hostname, lookupHost, httpStatus: 404 }
      }];
    }

    if (!response.ok) throw new Error(`RDAP responded with HTTP ${response.status}`);

    const data = await response.json() as RdapResponse;
    const registrationEvent = data.events?.find((event) =>
      ['registration', 'registered'].includes((event.eventAction || '').toLowerCase())
    );

    if (!registrationEvent?.eventDate) {
      return [dnsEvidence, {
        id: 'domain-registration-date-unavailable',
        title: 'Registration date unavailable',
        detail: `RDAP returned domain data for ${lookupHost}, but no registration date was available to VERA.`,
        severity: 'info',
        source: 'Public RDAP domain lookup',
        state: 'UNKNOWN',
        observedAt,
        metadata: { hostname, lookupHost }
      }];
    }

    const registeredAt = new Date(registrationEvent.eventDate);
    if (Number.isNaN(registeredAt.getTime())) throw new Error('RDAP returned an invalid registration date');

    const ageDays = Math.max(0, Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000));
    const isNew = ageDays < NEW_DOMAIN_DAYS;

    return [dnsEvidence, {
      id: isNew ? 'domain-recent-registration' : 'domain-registration-age',
      title: isNew ? 'Recently registered domain' : 'Domain registration date found',
      detail: isNew
        ? `${lookupHost} appears to have been registered ${ageDays} day(s) ago. Newly registered domains can deserve extra scrutiny, but domain age alone does not establish maliciousness.`
        : `RDAP reports a registration date of ${registeredAt.toISOString().slice(0, 10)} for ${lookupHost} (approximately ${ageDays} days ago). Domain age alone does not establish legitimacy.`,
      severity: isNew ? 'medium' : 'info',
      source: 'Public RDAP domain lookup (rdap.org)',
      state: 'SUPPORTED',
      observedAt,
      metadata: { hostname, lookupHost, registeredAt: registeredAt.toISOString(), ageDays, lookupUrl: `https://rdap.org/domain/${encodeURIComponent(lookupHost)}` }
    }];
  } catch {
    const urlEvidence = (() => { try { return normalizeUrlInput(rawUrl); } catch { return null; } })();
    const fallbackDnsEvidence = urlEvidence ? await inspectDns(urlEvidence.hostname.toLowerCase(), observedAt) : null;
    return [...(fallbackDnsEvidence ? [fallbackDnsEvidence] : []), {
      id: 'domain-intelligence-unavailable',
      title: 'Domain intelligence unavailable',
      detail: 'VERA could not retrieve a reliable public domain registration record during this scan. No conclusion about the domain’s safety can be drawn from this lookup.',
      severity: 'info',
      source: 'Public RDAP domain lookup',
      state: 'UNKNOWN',
      observedAt
    }];
  }
}
