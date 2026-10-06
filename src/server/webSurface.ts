import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 4;
const MAX_BODY_BYTES = 220_000;

function isBlockedIp(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) || a === 0;
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

async function assertPublicHostname(hostname: string) {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  if (!lower || lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new Error('Non-public hostname');
  }
  if (isIP(lower)) {
    if (isBlockedIp(lower)) throw new Error('Private or local IP address');
    return;
  }

  const records = await lookup(lower, { all: true, verbatim: true });
  if (!records.length || records.some((entry) => isBlockedIp(entry.address))) {
    throw new Error('Hostname does not resolve exclusively to public IP space');
  }
}

async function readLimited(response: Response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return text;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]{0,300})<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function evidence(item: Omit<Evidence, 'observedAt'>, observedAt: string): Evidence {
  return { ...item, observedAt };
}

export async function inspectWebsiteSurface(rawInput: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();

  let current: URL;
  try {
    current = normalizeUrlInput(rawInput);
  } catch {
    return [evidence({
      id: 'surface-invalid-url',
      title: 'Website surface inspection skipped',
      detail: 'VERA could not normalise the input into a supported HTTP or HTTPS URL.',
      severity: 'info',
      source: 'VERA website surface inspector',
      state: 'UNKNOWN'
    }, observedAt)];
  }

  const redirects: string[] = [];

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHostname(current.hostname);

      const response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'User-Agent': 'VERA-security-scanner/1.0'
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        const next = new URL(location, current);
        redirects.push(next.href);
        current = next;
        continue;
      }

      const contentType = response.headers.get('content-type') ?? '';
      const body = contentType.includes('text/html') ? await readLimited(response) : '';
      const title = extractTitle(body);
      const hsts = response.headers.has('strict-transport-security');
      const csp = response.headers.has('content-security-policy');
      const frameProtection = response.headers.has('x-frame-options');
      const contentLength = response.headers.get('content-length');

      return [evidence({
        id: 'surface-response',
        title: `Website responded with HTTP ${response.status}`,
        detail: `VERA fetched the public URL without executing page JavaScript. The server returned ${response.status}${title ? ` and exposed the page title "${title.slice(0, 120)}"` : ''}.`,
        severity: response.status >= 400 ? 'medium' : 'info',
        source: 'VERA website surface inspector',
        state: 'VERIFIED',
        metadata: {
          requestedUrl: normalizeUrlInput(rawInput).href,
          finalUrl: current.href,
          status: response.status,
          contentType,
          title: title || undefined,
          server: response.headers.get('server'),
          poweredBy: response.headers.get('x-powered-by'),
          contentLength,
          redirects,
          redirectCount: redirects.length,
          securityHeaders: { hsts, csp, frameProtection },
          checkedAt: observedAt
        }
      }, observedAt), {
        id: 'surface-security-headers',
        title: 'Response security headers observed',
        detail: `Security response headers: HSTS ${hsts ? 'present' : 'not observed'}, CSP ${csp ? 'present' : 'not observed'}, X-Frame-Options ${frameProtection ? 'present' : 'not observed'}.`,
        severity: hsts && csp ? 'info' : 'low',
        source: 'VERA website surface inspector',
        state: 'SUPPORTED',
        observedAt,
        metadata: { hsts, csp, frameProtection }
      }];
    }

    throw new Error('Redirect limit exceeded');
  } catch (error) {
    return [evidence({
      id: 'surface-unavailable',
      title: 'Website surface inspection unavailable',
      detail: `VERA could not retrieve the website surface (${error instanceof Error ? error.message : 'network error'}). This is an unavailable check, not evidence of safety or maliciousness.`,
      severity: 'info',
      source: 'VERA website surface inspector',
      state: 'UNKNOWN',
      metadata: { lookupFailed: true }
    }, observedAt)];
  }
}
