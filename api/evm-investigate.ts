import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CHAIN_REGISTRY, isEvmChainId, type EvmChainId } from '../src/lib/chains.js';
import type { Evidence } from '../src/lib/types.js';
import { createEvmAdapter } from '../src/server/chainAdapters/evm.js';
import { verifyPrivyAccessToken, privyServerConfigured } from '../src/server/privyAuth.js';
import { consumeUsageQuota } from '../src/server/db.js';
import { consumeFallbackQuota, getAnonymousSubject } from '../src/server/anonymousSession.js';

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader('Content-Type', 'application/json').setHeader('Cache-Control', 'no-store').json(body);
}

function statusReport(evidence: Evidence[]) {
  const checks = evidence.map((item) => ({
    name: item.title,
    status: item.state === 'UNKNOWN' ? 'UNAVAILABLE' as const : item.severity === 'high' ? 'MATCH' as const : 'CHECKED' as const,
    source: item.source,
    detail: item.detail
  }));
  const complete = checks.filter((item) => item.status !== 'UNAVAILABLE').length;
  return {
    overall: 'PARTIAL' as const,
    coverage: checks.length ? Math.round((complete / checks.length) * 100) : 0,
    checkedAt: new Date().toISOString(),
    checks,
    decisiveFindings: evidence.filter((item) => item.severity === 'high' && item.state !== 'UNKNOWN').length
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { chainId, investigationType, address } = req.body ?? {};
    if (typeof chainId !== 'string' || !isEvmChainId(chainId) ||
        (investigationType !== 'TOKEN' && investigationType !== 'CONTRACT' && investigationType !== 'ADDRESS') ||
        typeof address !== 'string' || !address.trim() || address.length > 128) {
      return json(res, 400, { error: 'Provide a supported EVM chain, TOKEN or CONTRACT investigation type, and an address.' });
    }

    const chain = CHAIN_REGISTRY[chainId as EvmChainId];
    if (!chain.enabledForInvestigation || process.env.VERA_ENABLE_EVM_INVESTIGATIONS !== 'true' ||
        !chain.rpcEnvVar || !process.env[chain.rpcEnvVar]) {
      return json(res, 503, {
        error: `${chain.name} investigations are not enabled yet.`,
        detail: 'The selected chain remains gated until its server-side RPC is configured and verified.'
      });
    }

    const authorization = req.headers.authorization;
    const bearer = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim() : '';
    let userId: string | null = null;
    if (bearer) {
      if (!privyServerConfigured()) return json(res, 503, { error: 'Sign-in verification is not configured on the server.' });
      try { userId = await verifyPrivyAccessToken(bearer); }
      catch { return json(res, 401, { error: 'Your sign-in session is invalid or expired. Please sign in again.' }); }
      if (!userId) return json(res, 401, { error: 'Your sign-in session could not be verified.' });
    }

    const period = userId ? new Date().toISOString().slice(0, 10) : 'lifetime';
    const subject = userId ? `privy:${userId}` : (() => {
      const anonymous = getAnonymousSubject(req, res);
      return anonymous ? `anonymous:${anonymous}` : null;
    })();
    if (!subject) return json(res, 503, { error: 'Anonymous usage protection is not configured. No investigation was executed.' });

    let quota: { allowed: boolean; remaining: number; degraded?: boolean };
    try {
      quota = process.env.DATABASE_URL
        ? await consumeUsageQuota(subject, period, userId ? 10 : 5)
        : consumeFallbackQuota(req, res, subject, period, userId ? 10 : 5);
    } catch (error) {
      console.error('VERA EVM quota error; using signed fallback', error);
      quota = consumeFallbackQuota(req, res, subject, period, userId ? 10 : 5);
    }
    if (!quota.allowed) {
      return json(res, 429, userId
        ? { error: 'You have used your ten investigations for today.', remaining: 0 }
        : { error: 'You have used your five free investigations. Sign in to continue.', remaining: 0, signupRequired: true });
    }

    const adapter = createEvmAdapter(chainId as EvmChainId);
    let evidence: Evidence[];
    try {
      evidence = investigationType === 'TOKEN'
        ? await adapter.inspectToken({ chain: chainId as EvmChainId, address: address.trim() })
        : investigationType === 'CONTRACT'
          ? await adapter.inspectContract({ chain: chainId as EvmChainId, address: address.trim() })
          : await adapter.inspectAddress({ chain: chainId as EvmChainId, address: address.trim() });
    } catch (error) {
      console.error(`VERA EVM ${chainId} ${investigationType} provider error`, error);
      evidence = [{
        id: 'evm-provider-unavailable',
        title: 'EVM chain evidence unavailable',
        detail: 'VERA could not complete the selected chain lookup. Provider failures are unknown evidence, not proof that the address is safe.',
        severity: 'info', source: 'VERA EVM RPC adapter', state: 'UNKNOWN',
        observedAt: new Date().toISOString(), metadata: { chainId, investigationType }
      }];
    }

    const invalid = evidence.some((item) => item.id.endsWith('-invalid'));
    const assessment = {
      state: invalid ? 'UNKNOWN' as const : 'SUPPORTED' as const,
      headline: invalid ? 'The supplied EVM address could not be validated' :
        investigationType === 'TOKEN' ? 'Token contract evidence collected' : investigationType === 'CONTRACT' ? 'Smart contract evidence collected' : 'Wallet address evidence collected',
      explanation: evidence.some((item) => item.state === 'UNKNOWN')
        ? 'VERA collected only partial evidence. Unavailable checks are not clean results, and this baseline is not a complete security audit.'
        : 'VERA collected read-only contract evidence. Metadata and deployed bytecode do not establish that a token or contract is safe.',
      action: 'Review each finding and independently verify the contract, privileged controls and intended interaction before connecting a wallet or approving a transaction.',
      evidence,
      confidence: 'LOW' as const,
      verdict: 'REVIEW' as const,
      chainId,
      statusReport: statusReport(evidence)
    };
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    return json(res, 200, {
      id, createdAt, inputType: investigationType, input: address.trim(), chainId,
      assessment, usage: { remaining: quota.remaining, dailyLimit: userId ? 10 : 5 }
    });
  } catch (error) {
    console.error('VERA EVM investigation error', error);
    return json(res, 500, { error: 'Investigation failed', detail: 'The EVM investigation could not be completed. Check server logs for the failing stage.' });
  }
}
