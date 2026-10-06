import type { Assessment, Evidence, InputType, InvestigationCheck, InvestigationStatusReport, Network } from '../lib/types.js';

function checkFromEvidence(name: string, sourceMatch: RegExp, evidence: Evidence[]): InvestigationCheck {
  const items = evidence.filter((item) => sourceMatch.test(item.source));
  if (!items.length) return {
    name,
    status: 'SKIPPED',
    source: name,
    detail: 'This check was not requested for the current investigation type.'
  };

  if (items.some((item) => /(?:match|reported|confirmed|negative)/i.test(item.id) || item.severity === 'high')) {
    return {
      name,
      status: 'MATCH',
      source: items[0].source,
      detail: items[0].detail
    };
  }

  if (items.some((item) => /not-configured/i.test(item.id))) {
    return {
      name,
      status: 'SKIPPED',
      source: items[0].source,
      detail: items[0].detail
    };
  }

  if (items.some((item) => /no-match|no-reports|no-clear-reports|no-a-record|invalid/i.test(item.id))) {
    return {
      name,
      status: 'NO_MATCH',
      source: items[0].source,
      detail: items[0].detail
    };
  }

  return {
    name,
    status: 'CHECKED',
    source: items[0].source,
    detail: items[0].detail
  };
}

export function buildStatusReport(inputType: InputType, evidence: Evidence[], assessment: Assessment, network: Network): InvestigationStatusReport {
  const checks: InvestigationCheck[] = [];

  if (inputType === 'URL') {
    checks.push(
      checkFromEvidence('URL parsing', /VERA URL parser/i, evidence),
      checkFromEvidence('Website surface', /website surface inspector/i, evidence),
      checkFromEvidence('Domain registration', /domain intelligence|RDAP|DNS-over-HTTPS/i, evidence),
      checkFromEvidence('URLhaus malware feed', /URLhaus/i, evidence),
      checkFromEvidence('OpenPhish phishing feed', /OpenPhish/i, evidence),
      checkFromEvidence('urlscan history', /urlscan.io/i, evidence),
      checkFromEvidence('Public web reputation', /Tavily/i, evidence),
      checkFromEvidence('Chainabuse reports', /Chainabuse/i, evidence)
    );
  } else if (inputType === 'WALLET') {
    checks.push(
      checkFromEvidence('Solana account state', /Solana RPC/i, evidence),
      checkFromEvidence('Token inventory', /parsed token accounts|Solana RPC/i, evidence),
      checkFromEvidence('Delegation signals', /delegated token permissions/i, evidence),
      checkFromEvidence('Recent activity', /recent on-chain activity|Solana RPC/i, evidence),
      checkFromEvidence('Marketplace intelligence', /Magic Eden/i, evidence),
      checkFromEvidence('Chainabuse reports', /Chainabuse/i, evidence)
    );
  } else if (inputType === 'TX') {
    checks.push(
      checkFromEvidence('Transaction retrieval', /Solana RPC/i, evidence),
      checkFromEvidence('Execution status', /Solana transaction metadata/i, evidence),
      checkFromEvidence('Program and signer analysis', /Solana transaction message/i, evidence),
      checkFromEvidence('Asset movement analysis', /Solana parsed instructions|Solana transaction metadata/i, evidence),
      checkFromEvidence('Permission change analysis', /Solana parsed instructions/i, evidence)
    );
  } else {
    checks.push(checkFromEvidence('Deterministic message analysis', /VERA deterministic message rules|VERA message parser/i, evidence));
  }

  const counted = checks.filter((check) => check.status !== 'SKIPPED');
  const complete = counted.filter((check) => check.status === 'CHECKED' || check.status === 'NO_MATCH' || check.status === 'MATCH').length;
  const coverage = counted.length ? Math.round((complete / counted.length) * 100) : 0;
  const decisiveFindings = evidence.filter((item) => item.severity === 'high' && item.state !== 'UNKNOWN').length;
  const overall = assessment.state === 'CONFIRMED_MALICIOUS'
    ? 'CONFIRMED_FINDING'
    : coverage === 100
      ? 'COMPLETE'
      : 'PARTIAL';

  return { overall, coverage, checkedAt: new Date().toISOString(), checks, decisiveFindings };
}
