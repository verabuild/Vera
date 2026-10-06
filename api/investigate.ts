import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InputType, Network } from '../src/lib/types.js';
import { localSignals } from '../src/lib/investigator.js';
import { inspectWallet, inspectTransaction } from '../src/server/solana.js';
import { inspectMagicEdenWallet } from '../src/server/magicEden.js';
import { explainWithGemini } from '../src/server/gemini.js';
import { consumeUsageQuota, persistScan } from '../src/server/db.js';
import { inspectDomainRegistration } from '../src/server/domainIntel.js';
import { inspectThreatIntel } from '../src/server/threatIntel.js';
import { inspectWebReputation } from '../src/server/reputationIntel.js';
import { verifyPrivyAccessToken, privyServerConfigured } from '../src/server/privyAuth.js';
import { getAnonymousSubject } from '../src/server/anonymousSession.js';
import { investigateUrlProviders, investigateWalletProviders } from '../src/server/providerOrchestrator.js';
import { buildStatusReport } from '../src/server/statusReport.js';

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

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
      urlhausConfigured: Boolean(process.env.URLHAUS_AUTH_KEY),
      webReputationConfigured: Boolean(process.env.TAVILY_API_KEY),
      privyConfigured: privyServerConfigured(),
      usageLimitsConfigured: Boolean(process.env.DATABASE_URL && process.env.VERA_ANON_SECRET && process.env.VERA_ANON_SECRET.length >= 32),
      solanaConfigured: Boolean(process.env.SOLANA_MAINNET_RPC_URL),
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const authorization = req.headers.authorization;
    const bearer = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    let authenticatedUserId: string | null = null;
    if (bearer) {
      if (!privyServerConfigured()) {
        return json(res, 503, { error: 'Sign-in verification is not configured on the server yet.' });
      }
      try {
        authenticatedUserId = await verifyPrivyAccessToken(bearer);
      } catch {
        return json(res, 401, { error: 'Your sign-in session is invalid or expired. Please sign in again.' });
      }
      if (!authenticatedUserId) {
        return json(res, 401, { error: 'Your sign-in session could not be verified. Please sign in again.' });
      }
    }

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

    if (!process.env.DATABASE_URL) {
      return json(res, 503, { error: 'VERA usage limits are temporarily unavailable. Please try again later.' });
    }

    let quota;
    try {
      if (authenticatedUserId) {
        quota = await consumeUsageQuota(`privy:${authenticatedUserId}`, new Date().toISOString().slice(0, 10), 5);
      } else {
        const anonymousSubject = getAnonymousSubject(req, res);
        if (!anonymousSubject) {
          return json(res, 503, { error: 'Anonymous usage protection is not configured. Please try again later.' });
        }
        quota = await consumeUsageQuota(`anonymous:${anonymousSubject}`, 'lifetime', 2);
      }
    } catch (error) {
      console.error('VERA quota error', error);
      return json(res, 503, {
        error: 'Investigation service temporarily unavailable',
        detail: 'VERA could not verify your investigation allowance. No investigation was executed.'
      });
    }

    if (!quota.allowed) {
      return json(res, 429, authenticatedUserId
        ? { error: 'You have used your five investigations for today. Your allowance resets at 00:00 UTC.', remaining: 0, signupRequired: false }
        : { error: 'You have used your two free investigations. Sign in to continue with five investigations per day.', remaining: 0, signupRequired: true });
    }

    let assessment = localSignals(inputType, input.trim());

    if (inputType === 'URL') {
      const providers = await investigateUrlProviders(input.trim());
      const domainEvidence = providers.domain;
      const threatEvidence = providers.threat;
      const reputationEvidence = providers.reputation;
      const evidence = [
        ...assessment.evidence,
        ...domainEvidence,
        ...threatEvidence,
        ...reputationEvidence,
        ...providers.surface,
        ...providers.openphish,
        ...providers.urlscan,
        ...providers.chainabuse,
        {
          id: 'website-identity-unverified',
          title: 'Website operator identity not independently verified',
          detail: 'VERA reports observable infrastructure and reputation evidence. It does not treat those signals as proof of who operates a site.',
          severity: 'info' as const,
          source: 'VERA evidence policy',
          state: 'UNKNOWN' as const,
          observedAt: new Date().toISOString()
        }
      ];

      const urlhausMatch = threatEvidence.some((item) => item.id === 'urlhaus-match');
      const openphishMatch = providers.openphish.some((item) => item.id === 'openphish-match');
      const checkedChainabuse = providers.chainabuse.some(
        (item) => item.id === 'chainabuse-reports' && Number(item.metadata?.checkedCount ?? 0) > 0
      );
      const negativeReputation = reputationEvidence.find((item) => item.id === 'web-reputation-negative-reports');
      const reputationMetadata = negativeReputation?.metadata;
      const distinctNegativeSources = Number(reputationMetadata?.distinctNegativeSourceDomains ?? 0);
      const reputationWarnings = Number(reputationMetadata?.reputationWarningCount ?? 0);
      const recentlyRegistered = domainEvidence.some((item) => item.id === 'domain-recent-registration');
      const establishedRegistration = domainEvidence.some((item) => item.id === 'domain-registration-age');
      const dnsResolves = domainEvidence.some((item) => item.id === 'domain-dns-resolves');
      const threatNoMatch = threatEvidence.some((item) => item.id === 'urlhaus-no-match');
      const threatUnavailable = threatEvidence.every((item) => item.state === 'UNKNOWN');

      if (urlhausMatch || openphishMatch) {
        assessment = {
          ...assessment,
          state: 'CONFIRMED_MALICIOUS',
          headline: openphishMatch ? 'Known phishing URL reported by OpenPhish' : 'Known malware URL reported by URLhaus',
          explanation: openphishMatch
            ? 'OpenPhish returned a phishing-database match for this URL.'
            : 'URLhaus returned a malware-distribution match for this URL.',
          action: 'Stop the interaction and use an independently verified destination.',
          evidence,
          confidence: 'HIGH'
        };
      } else if (checkedChainabuse) {
        assessment = {
          ...assessment,
          state: 'SUSPICIOUS',
          headline: 'Chainabuse reports this destination',
          explanation: 'Chainabuse returned checked reports associated with this target. Review the report details as supporting risk evidence.',
          action: 'Pause and independently verify the destination before proceeding.',
          evidence,
          confidence: 'HIGH'
        };
      } else if (negativeReputation && (distinctNegativeSources >= 2 || reputationWarnings > 0)) {
        assessment = {
          ...assessment,
          state: 'SUSPICIOUS',
          headline: 'Public reports raise reputation concerns',
          explanation: 'VERA found multiple public reports containing risk language about this domain. Search results are supporting evidence and may be incomplete or mistaken.',
          action: 'Review the linked reports and verify the domain independently before proceeding.',
          evidence,
          confidence: 'MEDIUM'
        };
      } else if (recentlyRegistered) {
        assessment = {
          ...assessment,
          state: 'SUSPICIOUS',
          headline: 'Recently registered domain needs extra scrutiny',
          explanation: 'VERA found a recent registration date. Domain age is a caution signal, not proof of maliciousness.',
          action: 'Verify the operator and exact domain independently before proceeding.',
          evidence,
          confidence: 'MEDIUM'
        };
      } else if (threatNoMatch) {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          headline: 'Threat feeds returned no match',
          explanation: threatUnavailable
            ? 'The primary malware feed was unavailable, so no positive safety conclusion is possible.'
            : 'URLhaus returned no malware-URL match. A no-match does not establish that the site is legitimate.',
          action: 'Review the complete evidence trail and verify the exact hostname independently.',
          evidence,
          confidence: 'LOW'
        };
      } else if (establishedRegistration && dnsResolves) {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          headline: 'Domain and infrastructure evidence collected',
          explanation: 'VERA found resolving DNS and registration evidence, but these signals do not verify the operator or site intent.',
          action: 'Verify the exact hostname independently before sensitive actions.',
          evidence,
          confidence: 'LOW'
        };
      } else {
        assessment = {
          ...assessment,
          evidence,
          explanation: assessment.explanation + ' Website identity and intent remain unverified.'
        };
      }
    }

    if (inputType === 'TX') {
      const evidence = await inspectTransaction(input.trim(), network);
      const failed = evidence.some((item) => item.id === 'tx-status' && item.detail.startsWith('The transaction record contains'));
      const found = evidence.some((item) => item.id === 'tx-signature-verified');
      const unavailable = evidence.some((item) => item.id === 'tx-lookup-unavailable');
      const invalid = evidence.some((item) => item.id === 'tx-invalid-signature');
      const transfers = evidence.find((item) => item.id === 'tx-transfers');

      if (invalid) {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          headline: 'VERA could not validate this transaction signature',
          explanation: 'The supplied value does not match the expected Solana transaction-signature format.',
          action: 'Paste a Solana transaction signature from the correct network and investigate it again.',
          evidence,
          confidence: 'HIGH',
          network
        };
      } else if (unavailable) {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          headline: 'Transaction evidence is unavailable',
          explanation: 'VERA could not retrieve the transaction from the selected Solana RPC. An unavailable lookup must not be treated as a clean result.',
          action: 'Confirm the signature and network, then retry from a trusted transaction explorer or RPC source.',
          evidence,
          confidence: 'LOW',
          network
        };
      } else if (!found) {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          headline: 'VERA could not locate this transaction',
          explanation: 'No transaction record was returned for this signature on the selected network. VERA cannot infer what the transaction would do without the underlying chain record.',
          action: 'Check that the signature belongs to the selected network and retry once the transaction is available.',
          evidence,
          confidence: 'LOW',
          network
        };
      } else if (failed) {
        assessment = {
          ...assessment,
          state: 'SUPPORTED',
          headline: 'Transaction execution failed',
          explanation: 'VERA verified the transaction record and found a runtime failure. A failed transaction is not automatically malicious, but the attempted instructions should be reviewed before repeating the action.',
          action: 'Do not blindly retry. Review the failed instruction, referenced programs, signers and any transfer instructions first.',
          evidence,
          confidence: 'HIGH',
          network
        };
      } else {
        assessment = {
          ...assessment,
          state: transfers ? 'SUPPORTED' : 'VERIFIED',
          headline: transfers ? 'Transaction parsed with asset movement' : 'Transaction parsed successfully',
          explanation: transfers
            ? 'VERA verified the transaction record and identified parsed transfer instructions. Successful execution confirms what the chain processed, not that the interaction was intended or safe.'
            : 'VERA verified the transaction record and parsed its signers, programs, fee and execution metadata. Transaction existence and successful execution are not a safety guarantee.',
          action: transfers
            ? 'Review every transfer destination, asset, amount and referenced program before considering the transaction outcome expected.'
            : 'Review the referenced programs, signers and execution logs against the action you intended to perform.',
          evidence,
          confidence: 'HIGH',
          network
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
      assessment: finalAssessment,
      usage: { remaining: quota.remaining, dailyLimit: authenticatedUserId ? 5 : 2, period: authenticatedUserId ? 'UTC day' : 'lifetime' }
    };

    try {
      await persistScan(
        scan.id,
        inputType,
        input.trim(),
        network,
        finalAssessment,
        authenticatedUserId ?? undefined
      );
    } catch (error) {
      // Persistence must never turn a completed read-only investigation into a
      // user-facing 500. The scan remains available in the response/local history.
      console.error('VERA persistence error', error);
    }

    return json(res, 200, scan);
  } catch (error) {
    console.error('VERA investigation error', error);
    return json(res, 500, {
      error: 'Investigation failed',
      detail: 'VERA encountered an unexpected server error before it could complete the investigation. Check the server logs for the failing stage.'
    });
  }
}
