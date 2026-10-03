import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InputType, Network } from '../src/lib/types.js';
import { localSignals } from '../src/lib/investigator.js';
import { inspectWallet } from '../src/server/solana.js';
import { inspectMagicEdenWallet } from '../src/server/magicEden.js';
import { explainWithGemini } from '../src/server/gemini.js';
import { persistScan } from '../src/server/db.js';
import { inspectDomainRegistration } from '../src/server/domainIntel.js';
import { inspectWebRisk } from '../src/server/threatIntel.js';

const allowedTypes = new Set<InputType>(['URL', 'MESSAGE', 'WALLET', 'TX']);
const allowedNetworks = new Set<Network>(['mainnet', 'devnet']);

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function applyCors(req: VercelRequest, res: VercelResponse) {
  const configured = process.env.VERA_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const requestOrigin = req.headers.origin;
  const allowOrigin =
    requestOrigin && configured?.includes(requestOrigin)
      ? requestOrigin
      : configured?.length
        ? configured[0]
        : undefined;

  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'vera-investigate',
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      solanaConfigured: Boolean(process.env.SOLANA_MAINNET_RPC_URL),
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { inputType, input, network = 'mainnet' } = req.body ?? {};

    if (
      !allowedTypes.has(inputType) ||
      typeof input !== 'string' ||
      !input.trim() ||
      input.length > 10000
    ) {
      return json(res, 400, { error: 'Invalid investigation request' });
    }

    if (!allowedNetworks.has(network)) {
      return json(res, 400, { error: 'Invalid Solana network' });
    }

    let assessment = localSignals(inputType, input.trim());

    if (inputType === 'URL') {
      const [domainEvidence, threatEvidence] = await Promise.all([
        inspectDomainRegistration(input.trim()),
        inspectWebRisk(input.trim())
      ]);
      const evidence = [...assessment.evidence, ...domainEvidence, threatEvidence];
      const threatMatch = threatEvidence.id === 'threat-intel-match';
      const threatNoMatch = threatEvidence.id === 'threat-intel-no-match';
      const threatUnavailable = threatEvidence.state === 'UNKNOWN';
      const recentlyRegistered = domainEvidence.some((item) => item.id === 'domain-recent-registration');
      const establishedRegistration = domainEvidence.some((item) => item.id === 'domain-registration-age');
      const dnsResolves = domainEvidence.some((item) => item.id === 'domain-dns-resolves');
      const registrationUnavailable = domainEvidence.some((item) =>
        ['domain-intelligence-unavailable', 'domain-registration-date-unavailable', 'domain-registration-date-invalid'].includes(item.id)
      );

      // Domain age and DNS are supporting context only. They must never turn a URL
      // into VERIFIED or imply that its content, operator, or intent is safe.
      if (threatMatch) {
        assessment = {
          ...assessment,
          state: 'CONFIRMED_MALICIOUS',
          evidence,
          headline: 'Known threat reported by Google Web Risk',
          explanation: `Google Web Risk reported a known threat match for this URL. Review the threat category in the evidence trail. This is a provider-reported finding, not a claim that VERA independently inspected every part of the page. ${'VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.'}`,
          action: 'Do not proceed to the page, enter credentials, connect a wallet, download files, or send funds. Report the URL through the relevant platform and use an independently verified official site.',
          confidence: 'HIGH'
        };
      } else if (recentlyRegistered) {
        assessment = {
          ...assessment,
          evidence,
          headline: 'Newly registered domain needs extra scrutiny',
          explanation: 'VERA found a recent domain registration date. Newness is a caution signal, not proof of a scam. VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.',
          action: 'Pause before entering credentials, connecting a wallet, or sending funds. Reach the service through its independently verified official website instead.',
          confidence: 'MEDIUM'
        };
      } else if (threatNoMatch && assessment.state !== 'SUSPICIOUS') {
        assessment = {
          ...assessment,
          state: 'SUPPORTED',
          evidence,
          headline: 'No known threats detected by Google Web Risk',
          explanation: 'Google Web Risk returned no match for its checked threat categories at the time of this scan. This is a useful reputation signal, not proof that the site is legitimate or safe; newly emerging or unlisted threats may not be detected. VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.',
          action: 'Before entering credentials, connecting a wallet, or signing a transaction, confirm the exact hostname through an independently verified official source.',
          confidence: 'LOW'
        };
      } else if (establishedRegistration && dnsResolves && assessment.state !== 'SUSPICIOUS') {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          evidence,
          headline: threatUnavailable ? 'Domain evidence found; threat check unavailable' : 'No immediate domain-age warning found',
          explanation: threatUnavailable ? 'The hostname resolves and the registry reports an established registration date, but VERA could not complete the live threat-intelligence check. DNS and domain age are supporting signals only. VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.' : 'The hostname resolves and the registry reports an established registration date. These are supporting signals only: VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.',
          action: 'Before taking a sensitive action, confirm the exact hostname against the service’s official website or a trusted bookmark. Do not rely on domain age or HTTPS alone.',
          confidence: 'LOW'
        };
      } else if (registrationUnavailable && dnsResolves && assessment.state !== 'SUSPICIOUS') {
        assessment = {
          ...assessment,
          evidence,
          headline: 'Domain resolves, but trust evidence is incomplete',
          explanation: 'VERA confirmed DNS address records, but could not verify a reliable domain registration date. DNS resolution only shows that the hostname resolves. VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.',
          action: 'Confirm the exact hostname through an independent official source before entering credentials, connecting a wallet, or signing a transaction.',
          confidence: 'LOW'
        };
      } else {
        assessment = {
          ...assessment,
          evidence,
          explanation: assessment.explanation + ' VERA has not verified the page content, operator identity, or current threat reputation, so this is not a safety verdict.'
        };
      }
    }

    if (inputType === 'WALLET') {
      const [solanaEvidence, meEvidence] = await Promise.all([
        inspectWallet(input.trim(), network),
        inspectMagicEdenWallet(input.trim(), network)
      ]);

      const evidence = [...solanaEvidence, ...meEvidence];
      const invalidAddress = solanaEvidence.some(
        (item) => item.id === 'wallet-invalid'
      );

      assessment = invalidAddress
        ? {
            ...assessment,
            state: 'UNKNOWN',
            headline: 'VERA could not validate this wallet',
            explanation:
              'The supplied value is not a valid Solana public address, so live wallet intelligence cannot be interpreted.',
            action: 'Check the address and scan it again.',
            evidence,
            confidence: 'HIGH',
            network
          }
        : {
            ...assessment,
            state: 'SUPPORTED',
            headline: `Wallet evidence collected on ${network}`,
            explanation:
              'VERA found live chain evidence for this public address. This describes observable state and does not mean assets or projects associated with the wallet are safe.',
            action:
              'Review the evidence before interacting with any asset or signing a transaction.',
            evidence,
            confidence: 'HIGH',
            network
          };
    }

    const aiExplanation = await explainWithGemini(
      input.trim(),
      assessment,
      assessment.evidence
    );

    const finalAssessment = {
      ...assessment,
      aiExplanation: aiExplanation || undefined
    };

    const scan = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      inputType,
      input: input.trim(),
      network,
      assessment: finalAssessment
    };

    await persistScan(
      scan.id,
      inputType,
      input.trim(),
      network,
      finalAssessment
    );

    return json(res, 200, scan);
  } catch (error) {
    console.error('VERA investigation error', error);
    return json(res, 500, {
      error: 'Investigation failed',
      detail: 'The investigation service encountered an unexpected error.'
    });
  }
}
