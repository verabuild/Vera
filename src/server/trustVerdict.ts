import type { Evidence } from '../lib/types.js';

export type UrlVerdict = 'SAFE' | 'NOT_SAFE' | 'CAUTION' | 'REVIEW';

const TRUSTED_ROOTS = new Set([
  'google.com',
  'gmail.com',
  'youtube.com',
  'chatgpt.com',
  'openai.com',
  'claude.ai',
  'anthropic.com',
  'apple.com',
  'icloud.com',
  'microsoft.com',
  'office.com',
  'outlook.com',
  'live.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'wikipedia.org',
  'cloudflare.com',
  'vercel.com',
  'netlify.com',
  'npmjs.com',
  'nodejs.org',
  'python.org',
  'docker.com',
  'stripe.com',
  'paypal.com',
  'shopify.com',
  'notion.so',
  'figma.com',
  'canva.com',
  'zoom.us',
  'slack.com',
  'dropbox.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'whatsapp.com',
  'telegram.org',
  'discord.com',
  'reddit.com',
  'spotify.com',
  'twitch.tv',
  'x.com',
  'solana.com',
  'phantom.app',
  'coinbase.com',
  'binance.com',
  'kraken.com',
  'superteam.fun',
  'aws.amazon.com',
  'amazon.com'
]);

export function trustedRootFor(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  for (const root of TRUSTED_ROOTS) {
    if (host === root || host.endsWith(`.${root}`)) return root;
  }
  return null;
}

function numericStatus(evidence: Evidence[]) {
  const surface = evidence.find((item) => item.id === 'surface-response');
  const status = Number(surface?.metadata?.status);
  return Number.isFinite(status) ? status : null;
}

export function isTrustedDomain(hostname: string) {
  return Boolean(trustedRootFor(hostname));
}

export function deriveUrlVerdict(
  hostname: string,
  evidence: Evidence[]
): { verdict: UrlVerdict; headline: string; explanation: string; action: string; confidence: 'LOW' | 'MEDIUM' | 'HIGH' } {
  const trustedRoot = trustedRootFor(hostname);

  const urlhausMatch = evidence.some((item) => item.id === 'urlhaus-match');
  const openPhishMatch = evidence.some((item) => item.id === 'openphish-match');
  const chainabuseReports = evidence.some(
    (item) => item.id === 'chainabuse-reports' && Number(item.metadata?.checkedCount ?? 0) > 0
  );
  const negativeReputation = evidence.find((item) => item.id === 'web-reputation-negative-reports');
  const negativeSourceCount = Number(negativeReputation?.metadata?.distinctNegativeSourceDomains ?? 0);
  const reputationWarnings = Number(negativeReputation?.metadata?.reputationWarningCount ?? 0);
  const urlscanMalicious = evidence.some((item) => item.id === 'urlscan-malicious-history');
  const recentlyRegistered = evidence.some((item) => item.id === 'domain-recent-registration');
  const establishedRegistration = evidence.find((item) => item.id === 'domain-registration-age');
  const ageDays = Number(establishedRegistration?.metadata?.ageDays ?? 0);
  const dnsResolves = evidence.some((item) => item.id === 'domain-dns-resolves');
  const urlhausUnavailable = evidence.some((item) => item.id === 'urlhaus-unavailable');
  const openPhishUnavailable = evidence.some((item) => item.id === 'openphish-unavailable');
  const surfaceUnavailable = evidence.some((item) => item.id === 'surface-unavailable');
  const surfaceStatus = numericStatus(evidence);
  const strongThreatMatch = urlhausMatch || openPhishMatch;
  // Tavily is public-web reputation evidence, not authoritative threat intelligence.
  // For domains in VERA's curated established-domain registry, negative search
  // results can refer to scams, impersonation, reviews, or abuse occurring
  // around the brand rather than the trusted domain itself. They must not by
  // themselves downgrade an established domain to CAUTION.
  const reputationRiskForVerdict = trustedRoot ? false : (negativeSourceCount >= 2 || reputationWarnings > 0);

  const corroboratingFlags = [
    urlhausMatch,
    openPhishMatch,
    chainabuseReports,
    reputationRiskForVerdict,
    urlscanMalicious
  ].filter(Boolean).length;

  if (strongThreatMatch) {
    return {
      verdict: 'NOT_SAFE',
      headline: 'NOT SAFE · Known malicious or phishing destination',
      explanation: 'VERA found a direct match in a known malicious/phishing intelligence source. Do not treat this destination as safe.',
      action: 'Do not open, connect, sign in, pay, or send funds through this destination. Use an independently verified official domain instead.',
      confidence: 'HIGH'
    };
  }

  if (corroboratingFlags >= 2) {
    return {
      verdict: 'NOT_SAFE',
      headline: 'NOT SAFE · Multiple independent risk signals',
      explanation: 'VERA found corroborating risk signals across multiple independent intelligence sources. The combined evidence is sufficient to advise against interacting with this destination.',
      action: 'Stop and independently verify the destination through a trusted source before taking any action.',
      confidence: 'HIGH'
    };
  }

  const safeInfrastructure =
    Boolean(trustedRoot) &&
    !recentlyRegistered &&
    ageDays >= 365 &&
    dnsResolves &&
    !urlhausUnavailable &&
    !openPhishUnavailable &&
    !surfaceUnavailable &&
    surfaceStatus !== null &&
    surfaceStatus >= 200 &&
    surfaceStatus < 400 &&
    !chainabuseReports &&
    (!trustedRoot || (negativeSourceCount === 0 && reputationWarnings === 0)) &&
    !urlscanMalicious &&
    evidence.some((item) => item.id === 'urlhaus-no-match') &&
    evidence.some((item) => item.id === 'openphish-no-match');

  if (safeInfrastructure) {
    return {
      verdict: 'SAFE',
      headline: 'SAFE · Established website',
      explanation: `VERA verified a live, established ${trustedRoot} domain and found no known malware/phishing match in the checked threat sources. No risk system can guarantee that every future page or account action is harmless, but the current evidence is consistent with a legitimate destination.`,
      action: 'Proceed to the verified domain. Keep normal security practices and check the hostname before entering sensitive information.',
      confidence: 'HIGH'
    };
  }

  if (recentlyRegistered || chainabuseReports || urlscanMalicious || reputationRiskForVerdict) {
    return {
      verdict: 'CAUTION',
      headline: 'CAUTION · Risk signals require review',
      explanation: 'VERA found a cautionary signal, but not enough independent evidence to classify the destination as confirmed malicious.',
      action: 'Pause and verify the exact domain through an independent trusted source before entering credentials, connecting a wallet, or sending funds.',
      confidence: 'MEDIUM'
    };
  }

  return {
    verdict: 'REVIEW',
    headline: 'REVIEW · No decisive trust verdict',
    explanation: 'VERA collected infrastructure and threat-intelligence evidence, but the available signals are not sufficient to prove that the destination is either safe or malicious.',
    action: 'Verify the exact hostname through an independent trusted source before taking sensitive actions.',
    confidence: 'LOW'
  };
}
