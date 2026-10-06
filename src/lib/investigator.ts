import type { Assessment, Evidence, InputType } from './types.js';

const highRiskPhrases = [
  'seed phrase',
  'private key',
  'recovery phrase',
  'send crypto',
  'verification code',
  'claim now',
  'connect your wallet'
];

const suspiciousHostTerms = ['airdrop', 'claim', 'verify', 'wallet-connect', 'free'];

function containsTerm(value: string, term: string) {
  if (term.includes(' ')) return value.includes(term);
  return new RegExp(`\\b${term.replace(/[.*+?^\${}()|[\]\\]/g, '\\\\$&')}\\b`, 'i').test(value);
}

/**
 * Accept common user-pasted URL forms without treating arbitrary text or
 * non-web schemes as a valid web address.
 */
export function normalizeUrlInput(input: string): URL {
  let candidate = input.trim();

  candidate = candidate
    .replace(/^<(.+)>$/, '$1')
    .replace(/^[("'“‘]+/, '')
    .replace(/[)"'”’]+$/, '');

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
    const hits = highRiskPhrases.filter((p) => containsTerm(lower, p));
    const urgencyTerms = ['urgent', 'immediately', 'act now', 'expires today', 'last chance', 'within 24 hours', 'final warning'];
    const impersonationTerms = ['support team', 'customer support', 'official support', 'admin', 'security team', 'compliance team', 'verify your account'];
    const paymentTerms = ['send', 'transfer', 'deposit', 'pay', 'payment', 'usdt', 'usdc', 'sol'];
    const urgencyHits = urgencyTerms.filter((p) => containsTerm(lower, p));
    const impersonationHits = impersonationTerms.filter((p) => containsTerm(lower, p));
    const paymentHits = paymentTerms.filter((p) => containsTerm(lower, p));
    const urlMatches = input.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi) ?? [];

    if (hits.length) {
      evidence.push({ id: 'message-risk-language', title: 'High-risk request language', detail: `The message contains: ${hits.join(', ')}. These phrases can be associated with credential theft or irreversible transfers. This is a risk signal, not proof of malicious intent.`, severity: 'high', source: 'VERA deterministic message rules', state: 'SUPPORTED', observedAt: now });
    }
    if (urgencyHits.length) {
      evidence.push({ id: 'message-urgency', title: 'Pressure or urgency language detected', detail: `The message uses pressure cues: ${urgencyHits.join(', ')}. Urgency can be legitimate, but it reduces the time available to independently verify a sensitive request.`, severity: 'medium', source: 'VERA deterministic message rules', state: 'SUPPORTED', observedAt: now });
    }
    if (impersonationHits.length) {
      evidence.push({ id: 'message-impersonation', title: 'Authority or support identity claim detected', detail: `The message references: ${impersonationHits.join(', ')}. Text alone cannot establish that the sender actually represents that organisation or team.`, severity: 'medium', source: 'VERA deterministic message rules', state: 'SUPPORTED', observedAt: now });
    }
    if (paymentHits.length && (hits.length || urgencyHits.length)) {
      evidence.push({ id: 'message-payment-request', title: 'Potential financial action in a pressured message', detail: 'The message combines payment or transfer language with other risk cues. VERA cannot verify the recipient, payment destination, or sender identity from message text alone.', severity: 'high', source: 'VERA deterministic message rules', state: 'SUPPORTED', observedAt: now });
    }
    if (urlMatches.length) {
      evidence.push({ id: 'message-links-present', title: 'External link(s) detected', detail: `The message contains ${urlMatches.length} web link(s). A link in a message is not evidence that the destination is legitimate; investigate the URL separately before opening or signing in.`, severity: 'medium', source: 'VERA message parser', state: 'SUPPORTED', observedAt: now, metadata: { links: urlMatches.slice(0, 10) } });
    }

    if (evidence.length) {
      const highRisk = hits.length > 0 || (paymentHits.length > 0 && urgencyHits.length > 0);
      return {
        state: highRisk ? 'SUSPICIOUS' : 'SUPPORTED',
        headline: highRisk ? 'Pause before following this message' : 'Message contains review-worthy risk cues',
        explanation: highRisk
          ? 'The message combines signals that can precede credential theft, impersonation, or pressured financial action. VERA cannot establish who sent it or whether the requested destination is legitimate from message text alone.'
          : 'VERA found contextual signals worth checking before acting. These patterns can appear in legitimate messages too, so they are not proof of malicious intent.',
        action: 'Do not share secrets or send funds from the message. Verify the sender and any destination through an independent official channel. If a URL is present, investigate the URL separately.',
        evidence,
        confidence: highRisk ? 'MEDIUM' : 'LOW'
      };
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

      evidence.push({ id: 'url-structure', title: 'URL structure parsed', detail: `${url.protocol === 'https:' ? 'HTTPS' : 'HTTP'} URL with hostname ${host}. ${url.protocol === 'https:' ? 'Transport encryption does not establish that the site itself is legitimate.' : 'This URL does not use HTTPS, so transport is not encrypted by TLS.'}`, severity: 'info', source: 'VERA URL parser', state: 'SUPPORTED', observedAt: now });
      return { state: 'UNKNOWN', headline: 'No decisive trust evidence yet', explanation: 'VERA can parse the URL, but URL structure alone cannot prove identity, reputation, or safety.', action: 'Verify the domain through an independent official source before entering credentials or connecting a wallet.', evidence, confidence: 'LOW' };
    } catch {
      evidence.push({ id: 'url-invalid', title: 'Invalid URL format', detail: 'The supplied value could not be parsed as a standard URL.', severity: 'medium', source: 'VERA URL parser', state: 'UNKNOWN', observedAt: now });
      return { state: 'UNKNOWN', headline: 'VERA could not parse this URL', explanation: 'Paste a full link, a www address, or a domain such as example.com. VERA will normalise common web-link formats.', action: 'Check the link and scan it again.', evidence, confidence: 'HIGH' };
    }
  }

  return {
    state: 'UNKNOWN',
    headline: 'More evidence is required',
    explanation: 'VERA has not found enough deterministic evidence to make a stronger assessment.',
    action: 'Verify the identity and intended outcome independently before taking a sensitive action.',
    evidence,
    confidence: 'LOW'
  };
}
