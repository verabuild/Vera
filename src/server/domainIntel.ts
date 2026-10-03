import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const RDAP_TIMEOUT_MS = 8000;
const NEW_DOMAIN_DAYS = 30;

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapResponse = { events?: RdapEvent[]; ldhName?: string };

export async function inspectDomainRegistration(rawUrl: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();

  try {
    const url = normalizeUrlInput(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

    if (!hostname || hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
      return [{
        id: 'domain-registration-not-applicable',
        title: 'Domain registration lookup not applicable',
        detail: 'This address does not contain a public DNS hostname that VERA can check through RDAP.',
        severity: 'info',
        source: 'VERA domain intelligence',
        state: 'UNKNOWN',
        observedAt
      }];
    }

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
      return [{
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
      return [{
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

    return [{
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
    return [{
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
