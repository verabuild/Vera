import type { Assessment, Evidence, InputType } from './types.js';

const highRiskPhrases = ['seed phrase', 'private key', 'recovery phrase', 'send crypto', 'verification code', 'claim now', 'connect your wallet'];
const suspiciousHostTerms = ['airdrop', 'claim', 'verify', 'wallet-connect', 'free'];

/**
 * Accept common user-pasted URL forms without treating arbitrary text or
 * non-web schemes as a valid web address.
 */
export function normalizeUrlInput(input: string): URL {
  let candidate = input.trim();

  // Remove common wrappers from copied links: Markdown angle brackets,
  // quotation marks, and surrounding parentheses.
  candidate = candidate.replace(/^<(.+)>$/, '$1').replace(/^[("'\u201c\u2018]+/, '').replace(/[)"'\u201d\u2019]+$/, '');

  // If a user pasted a sentence containing a link, scan the first URL-like token.
  if (/\s/.test(candidate)) {
    const match = candidate.match(/(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:\/[^\s<>"']*)?/i);
    if (match) candidate = match[0];
  }

  candidate = candidate.replace(/[.,!?;:]+$/, '').replace(/[)\]}]+$/, '');

  if (!candidate) throw new Error('Empty URL');
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    throw new Error('Unsupported URL scheme');
  }

  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  else if (/^www\./i.test(candidate)) candidate = `https://${candidate}`;
  else if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  const url = new URL(candidate);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported URL scheme');
  if (!url.hostname || !url.hostname.includes('.')) throw new Error('Missing public hostname');
  if (url.username || url.password) throw new Error('URLs containing embedded credentials are not supported');
  return url;
}


export function localSignals(type: InputType, input: string): Assessment {
  const evidence: Evidence[] = [];
  const now = new Date().toISOString();

  if (type === 'MESSAGE') {
    const lower = input.toLowerCase();
    const hits = highRiskPhrases.filter((p) => lower.includes(p));
    if (hits.length) {
      evidence.push({ id: 'message-risk-language', title: 'High-risk request language', detail: `The message contains: ${hits.join(', ')}. These phrases are commonly associated with credential theft or irreversible transfers. This is a risk signal, not proof of malicious intent.`, severity: 'high', source: 'VERA deterministic message rules', state: 'SUPPORTED', observedAt: now });
      return { state: 'SUSPICIOUS', headline: 'Pause before following this message', explanation: 'The request contains language that can expose credentials, verification codes, or funds. VERA cannot establish who sent it from message text alone.', action: 'Do not share secrets or send funds. Verify the sender through an independent official channel.', evidence, confidence: 'MEDIUM' };
    }
  }

  if (type === 'URL') {
    try {
      const url = normalizeUrlInput(input);
      const host = url.hostname.toLowerCase();
      const hits = suspiciousHostTerms.filter((term) => host.includes(term));
      if (hits.length) {
        evidence.push({ id: 'url-host-signal', title: 'Suspicious hostname pattern', detail: `Hostname contains: ${hits.join(', ')}. This can occur on legitimate sites too, so it is not proof of compromise.`, severity: 'medium', source: 'VERA deterministic URL rules', state: 'SUPPORTED', observedAt: now });
        return { state: 'SUSPICIOUS', headline: 'The URL deserves verification', explanation: 'The hostname contains patterns frequently seen in promotional, verification, or wallet-themed links. VERA has not independently confirmed the site identity.', action: 'Open the service from a trusted bookmark or official domain instead of using this link.', evidence, confidence: 'MEDIUM' };
      }
      evidence.push({ id: 'url-structure', title: 'URL structure parsed', detail: `${url.protocol === 'https:' ? 'HTTPS' : 'HTTP'} URL with hostname ${host}. ${url.protocol === 'https:' ? 'Transport encryption does not establish that the site itself is legitimate.' : 'This URL does not use HTTPS, so transport is not encrypted by TLS.'}`, severity: 'info', source: 'VERA URL parser', state: 'VERIFIED', observedAt: now });
      return { state: 'UNKNOWN', headline: 'No decisive trust evidence yet', explanation: 'VERA can parse the URL, but URL structure alone cannot prove identity, reputation, or safety.', action: 'Verify the domain through an independent official source before entering credentials or connecting a wallet.', evidence, confidence: 'LOW' };
    } catch {
      evidence.push({ id: 'url-invalid', title: 'Invalid URL format', detail: 'The supplied value could not be parsed as a standard URL.', severity: 'medium', source: 'VERA URL parser', state: 'VERIFIED', observedAt: now });
      return { state: 'UNKNOWN', headline: 'VERA could not parse this URL', explanation: 'Paste a full link, a www address, or a domain such as example.com. VERA will normalise common web-link formats.', action: 'Check the link and scan it again.', evidence, confidence: 'HIGH' };
    }
  }

  return { state: 'UNKNOWN', headline: 'More evidence is required', explanation: 'VERA has not found enough deterministic evidence to make a stronger assessment.', action: 'Verify the identity and intended action independently before proceeding.', evidence, confidence: 'LOW' };
}