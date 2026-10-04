import type { Evidence } from '../lib/types.js';
import { normalizeUrlInput } from '../lib/investigator.js';

const TIMEOUT_MS = 8000;

type SearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
};

type TavilyResponse = { results?: SearchResult[] };

const NEGATIVE_TERMS = [
  'scam', 'scammer', 'fraud', 'phishing', 'rug pull', 'rugpull',
  'stole', 'stolen', 'not paid', 'never paid', 'withdrawal failed',
  'cannot withdraw', 'could not withdraw', 'fake', 'malware',
  'impersonation', 'warning', 'unsafe', 'high-risk', 'suspicious'
];

const PROMOTIONAL_TERMS = [
  'use my referral', 'referral link', 'sign up now', 'airdrop is live',
  'claim your bonus', 'free bonus', 'join now', 'promo code'
];

const REPUTATION_SITES = [
  'scam-detector.com', 'gridinsoft.com', 'scamadviser.com',
  'urlvoid.com', 'virustotal.com', 'reddit.com', 'x.com',
  'twitter.com', 'trustpilot.com'
];

function hostOf(raw: string): string {
  try { return new URL(raw).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

function cleanText(value: string, max = 700): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function isNegative(result: SearchResult): boolean {
  const title = (result.title ?? '').toLowerCase();
  const text = `${result.title ?? ''} ${result.content ?? ''}`.toLowerCase();
  // Generic review pages often mention the word scam while concluding a site
  // is likely safe. Do not mistake those boilerplate phrases for an accusation.
  if (/likely safe|probably not a scam|not a scam|no evidence of (?:a )?scam|legitimate website/.test(text) &&
      !/users? (?:report|reported|say|said)|lost (?:their )?funds|never paid|withdrawal failed|rug ?pull|phishing campaign/.test(text)) {
    return false;
  }
  const titleLooksAdverse = /scam|fraud|warning|unsafe|suspicious|high.?risk|rug ?pull|phishing/.test(title);
  if (PROMOTIONAL_TERMS.some((term) => text.includes(term))) {
    // Promotional content can still contain a complaint, but do not let a
    // bonus/referral post alone count as a negative report.
    return NEGATIVE_TERMS.some((term) => text.includes(term)) &&
      /scam|scammer|fraud|rug pull|rugpull|not paid|never paid|warning|unsafe|suspicious/.test(text);
  }
  return titleLooksAdverse || NEGATIVE_TERMS.some((term) => text.includes(term));
}

function isReputationSource(result: SearchResult): boolean {
  const host = hostOf(result.url ?? '');
  return REPUTATION_SITES.some((site) => host === site || host.endsWith(`.${site}`));
}

function asEvidence(item: Omit<Evidence, 'observedAt'>, observedAt: string): Evidence {
  return { ...item, observedAt };
}

/**
 * Searches the public web for domain-specific reputation reports.
 * Search results are leads, not proof: evidence links are retained and
 * the classifier never labels a domain confirmed malicious on this basis.
 */
export async function inspectWebReputation(rawInput: string): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  let url: URL;
  try {
    url = normalizeUrlInput(rawInput);
  } catch {
    return [asEvidence({
      id: 'web-reputation-invalid-url',
      title: 'Web reputation search skipped',
      detail: 'VERA could not normalise the input into a supported HTTP or HTTPS URL, so public web reputation was not searched.',
      severity: 'info',
      source: 'VERA web reputation',
      state: 'UNKNOWN'
    }, observedAt)];
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return [asEvidence({
      id: 'web-reputation-not-configured',
      title: 'Public web reputation search is not configured',
      detail: 'VERA did not search for independent user reports because TAVILY_API_KEY is not configured. No conclusion about reputation can be drawn from this missing check.',
      severity: 'info',
      source: 'VERA web reputation',
      state: 'UNKNOWN',
      metadata: { provider: 'Tavily', configured: false }
    }, observedAt)];
  }

  const domain = url.hostname.toLowerCase().replace(/^www\./, '');
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `"${domain}" (scam OR scammer OR fraud OR review OR warning OR Reddit OR X OR Twitter)`,
        topic: 'general',
        search_depth: 'basic',
        max_results: 10,
        include_answer: false,
        include_raw_content: false
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return [asEvidence({
        id: 'web-reputation-unavailable',
        title: 'Public web reputation search unavailable',
        detail: `Tavily returned HTTP ${response.status}. VERA could not complete its public reputation search; this is not a clean result.`,
        severity: 'info',
        source: 'Tavily Search API',
        state: 'UNKNOWN',
        metadata: { provider: 'Tavily', httpStatus: response.status }
      }, observedAt)];
    }

    const data = await response.json() as TavilyResponse;
    const results = (data.results ?? [])
      .filter((item) => typeof item.url === 'string' && typeof item.title === 'string')
      .slice(0, 10);
    const relevant = results.filter((item) => {
      const text = `${item.title ?? ''} ${item.content ?? ''} ${item.url ?? ''}`.toLowerCase();
      return text.includes(domain);
    });
    const negative = relevant.filter(isNegative);
    const uniqueNegativeDomains = new Set(negative.map((item) => hostOf(item.url ?? '')).filter(Boolean));
    const reputationWarnings = negative.filter(isReputationSource);
    const reports = negative.slice(0, 6).map((item) => ({
      title: cleanText(item.title ?? 'Untitled report', 180),
      url: item.url,
      sourceDomain: hostOf(item.url ?? ''),
      excerpt: cleanText(item.content ?? ''),
      publishedDate: item.published_date,
      searchScore: typeof item.score === 'number' ? item.score : undefined,
      reputationSource: isReputationSource(item)
    }));

    if (negative.length > 0) {
      const severity = reputationWarnings.length > 0 || uniqueNegativeDomains.size >= 2 ? 'high' : 'medium';
      return [asEvidence({
        id: 'web-reputation-negative-reports',
        title: `Public web search found ${negative.length} potentially negative report(s)`,
        detail: `A live public-web search returned ${negative.length} result(s) containing scam, fraud, warning, or similar risk language about ${domain}, across ${uniqueNegativeDomains.size} source domain(s). Search snippets and user allegations can be mistaken, coordinated, outdated, or promotional; review the linked sources before treating them as facts. These results are a reason for extra scrutiny, not standalone proof of fraud.`,
        severity,
        source: 'Tavily public web search',
        state: 'SUPPORTED',
        metadata: {
          provider: 'Tavily',
          domain,
          resultCount: relevant.length,
          negativeResultCount: negative.length,
          distinctNegativeSourceDomains: uniqueNegativeDomains.size,
          reputationWarningCount: reputationWarnings.length,
          reports
        }
      }, observedAt)];
    }

    return [asEvidence({
      id: 'web-reputation-no-clear-reports',
      title: 'No clear negative reports found in public web search',
      detail: `VERA searched public web results for ${domain} and did not identify a clear negative report in the returned results. Search coverage is incomplete and results can be missing or manipulated; this does not mean the domain is safe or that users have not reported problems.`,
      severity: 'info',
      source: 'Tavily public web search',
      state: 'UNKNOWN',
      metadata: {
        provider: 'Tavily',
        domain,
        resultCount: relevant.length,
        results: relevant.slice(0, 5).map((item) => ({
          title: cleanText(item.title ?? 'Untitled result', 180),
          url: item.url,
          sourceDomain: hostOf(item.url ?? ''),
          excerpt: cleanText(item.content ?? '', 400),
          publishedDate: item.published_date
        }))
      }
    }, observedAt)];
  } catch (error) {
    return [asEvidence({
      id: 'web-reputation-unavailable',
      title: 'Public web reputation search unavailable',
      detail: `VERA could not complete the public web reputation search (${error instanceof Error ? error.name : 'network error'}). An unavailable search is not evidence that the domain is safe.`,
      severity: 'info',
      source: 'Tavily Search API',
      state: 'UNKNOWN',
      metadata: { provider: 'Tavily', lookupFailed: true }
    }, observedAt)];
  }
}
