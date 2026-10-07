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
import { consumeFallbackQuota, getAnonymousSubject } from '../src/server/anonymousSession.js';
import { investigateUrlProviders, investigateWalletProviders } from '../src/server/providerOrchestrator.js';
import { buildStatusReport } from '../src/server/statusReport.js';
import { deriveUrlVerdict, trustedRootFor } from '../src/server/trustVerdict.js';
import { normalizeUrlInput } from '../src/lib/investigator.js';

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
      urlscanConfigured: true,
      chainabuseConfigured: Boolean(process.env.CHAINABUSE_API_KEY),
      openPhishConfigured: true,
      privyConfigured: privyServerConfigured(),
      usageLimitsConfigured: Boolean(
        (process.env.DATABASE_URL || process.env.VERA_ANON_SECRET) &&
        process.env.VERA_ANON_SECRET &&
        process.env.VERA_ANON_SECRET.length >= 32
      ),
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

    let quota: { allowed: boolean; remaining: number; degraded?: boolean };
    const periodKey = authenticatedUserId
      ? new Date().toISOString().slice(0, 10)
      : 'lifetime';
    const subjectId = authenticatedUserId
      ? `privy:${authenticatedUserId}`
      : (() => {
          const anonymousSubject = getAnonymousSubject(req, res);
          return anonymousSubject ? `anonymous:${anonymousSubject}` : null;
        })();

    if (!subjectId) {
      return json(res, 503, {
        error: 'Investigation service unavailable',
        detail: 'Anonymous usage protection is not configured. No investigation was executed.'
      });
    }

    try {
      if (process.env.DATABASE_URL) {
        quota = await consumeUsageQuota(subjectId, periodKey, authenticatedUserId ? 10 : 5);
      } else {
        quota = consumeFallbackQuota(req, res, subjectId, periodKey, authenticatedUserId ? 5 : 2);
      }
    } catch (error) {
      console.error('VERA durable quota error; switching to signed fallback', error);
      quota = consumeFallbackQuota(req, res, subjectId, periodKey, authenticatedUserId ? 5 : 2);
    }

    if (!quota.allowed) {
      return json(res, 429, authenticatedUserId
        ? { error: 'You have used your ten investigations for today. Your allowance resets at 00:00 UTC.', remaining: 0, signupRequired: false }
        : { error: 'You have used your five free investigations. Sign in to continue with ten investigations per day.', remaining: 0, signupRequired: true });
    }

    let assessment = localSignals(inputType, input.trim());

    if (inputType === 'URL') {
      const providers = await investigateUrlProviders(input.trim());
      const evidence = [
        ...assessment.evidence,
        ...providers.domain,
        ...providers.threat,
        ...providers.reputation,
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

      try {
        const hostname = normalizeUrlInput(input.trim()).hostname.toLowerCase();
        const trustedRoot = trustedRootFor(hostname);
        if (trustedRoot) {
          evidence.push({
            id: 'trusted-domain-registry-match',
            title: 'Established-domain registry match',
            detail: `The hostname matches VERA's curated established-domain registry for ${trustedRoot}. This is a deterministic identity signal; it is not a guarantee against compromise of an individual account or page.`,
            severity: 'info',
            source: 'VERA trusted-domain registry',
            state: 'SUPPORTED',
            observedAt: new Date().toISOString(),
            metadata: { hostname, trustedRoot }
          });
        }
        const verdict = deriveUrlVerdict(hostname, evidence);
        assessment = {
          ...assessment,
          state: verdict.verdict === 'NOT_SAFE'
            ? (evidence.some((item) => item.id === 'urlhaus-match' || item.id === 'openphish-match') ? 'CONFIRMED_MALICIOUS' : 'SUSPICIOUS')
            : verdict.verdict === 'CAUTION'
              ? 'SUSPICIOUS'
              : verdict.verdict === 'SAFE'
                ? 'VERIFIED'
                : 'UNKNOWN',
          headline: verdict.headline,
          explanation: verdict.explanation,
          action: verdict.action,
          evidence,
          confidence: verdict.confidence,
          verdict: verdict.verdict
        };
      } catch {
        assessment = {
          ...assessment,
          state: 'UNKNOWN',
          headline: 'VERA could not classify this URL',
          explanation: 'The URL evidence was collected, but VERA could not derive a final deterministic verdict from the normalized hostname.',
          action: 'Verify the exact hostname through an independent trusted source before taking sensitive actions.',
          evidence,
          confidence: 'LOW',
          verdict: 'REVIEW'
        };
      }
    }

    if (inputType === 'MESSAGE') {
      const linkEvidence = assessment.evidence.find((item) => item.id === 'message-links-present');
      const links = linkEvidence?.metadata?.links;
      if (Array.isArray(links) && typeof links[0] === 'string') {
        const linkedUrl = links[0];
        const providers = await investigateUrlProviders(linkedUrl);
        const linkedEvidence = [
          ...providers.domain,
          ...providers.threat,
          ...providers.reputation,
          ...providers.surface,
          ...providers.openphish,
          ...providers.urlscan,
          ...providers.chainabuse
        ];
        const linkedThreat = providers.threat.some((item) => item.id === 'urlhaus-match');
        const linkedPhish = providers.openphish.some((item) => item.id === 'openphish-match');
        assessment = {
          ...assessment,
          evidence: [...assessment.evidence, ...linkedEvidence],
          state: linkedThreat || linkedPhish ? 'CONFIRMED_MALICIOUS' : assessment.state,
          headline: linkedThreat || linkedPhish
            ? 'Message contains a known malicious link'
            : assessment.headline,
          explanation: linkedThreat || linkedPhish
            ? 'VERA followed the first detected URL through its read-only threat-intelligence pipeline and found a confirmed provider match.'
            : assessment.explanation,
          action: linkedThreat || linkedPhish
            ? 'Do not open or interact with the linked destination. Verify the sender through an independent channel.'
            : assessment.action,
          confidence: linkedThreat || linkedPhish ? 'HIGH' : assessment.confidence,
          verdict: linkedThreat || linkedPhish ? 'NOT_SAFE' : assessment.verdict
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
      const evidence = await investigateWalletProviders(input.trim(), network);
      const invalidAddress = evidence.some((item) => item.id === 'wallet-invalid');
      const reported = evidence.some((item) => item.id === 'chainabuse-reports');

      assessment = invalidAddress
        ? {
            ...assessment,
            state: 'UNKNOWN',
            headline: 'VERA could not validate this wallet or address',
            explanation: 'The supplied value is not a valid Solana public address.',
            action: 'Check the address and scan it again.',
            evidence,
            confidence: 'HIGH',
            network
          }
        : {
            ...assessment,
            state: reported ? 'SUSPICIOUS' : 'SUPPORTED',
            headline: reported ? 'Address has reported-risk evidence' : `Wallet and address evidence collected on ${network}`,
            explanation: reported
              ? 'VERA found public fraud-report evidence associated with this address. Review the individual reports before interacting with it.'
              : 'VERA collected live Solana account, token, delegation, recent activity and marketplace evidence. Observable chain state is not a safety guarantee.',
            action: reported
              ? 'Pause and independently verify the recipient before transferring funds or signing an interaction.'
              : 'Review the evidence before transferring funds or signing an interaction involving this address.',
            evidence,
            confidence: 'HIGH',
            network
          };
    }

    assessment = {
      ...assessment,
      statusReport: buildStatusReport(inputType, assessment.evidence, assessment, network)
    };



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
      usage: {
        remaining: quota.remaining,
        protection: quota.degraded ? 'degraded-fallback' : 'durable',
        dailyLimit: authenticatedUserId ? 5 : 2,
        period: authenticatedUserId ? 'UTC day' : 'lifetime'
      }
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
