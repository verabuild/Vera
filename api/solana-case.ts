import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Network } from '../src/lib/types.js';
import { traceSolanaCase } from '../src/server/solanaCase.js';
import { consumeFallbackQuota, getAnonymousSubject } from '../src/server/anonymousSession.js';
import { consumeUsageQuota } from '../src/server/db.js';
import { privyServerConfigured, verifyPrivyAccessToken } from '../src/server/privyAuth.js';

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function listOf(value: unknown) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(/[\n,\s]+/).map((part) => part.trim()).filter(Boolean))];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const body = req.body ?? {};
  const network: Network = body.network === 'devnet' ? 'devnet' : 'mainnet';
  const addresses = listOf(body.addresses);
  const signatures = listOf(body.signatures);

  if (addresses.length > 8 || signatures.length > 5) {
    return json(res, 400, { error: 'A case can include up to eight wallet addresses and five transaction signatures.' });
  }
  if (!addresses.length && !signatures.length) {
    return json(res, 400, { error: 'Add at least one Solana wallet address or transaction signature.' });
  }
  if (signatures.some((signature) => !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature))) {
    return json(res, 400, { error: 'One or more transaction signatures are incomplete or malformed. Paste the full Solana signature.' });
  }

  const authorization = req.headers.authorization;
  const bearer = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim() : '';
  let authenticatedUserId: string | null = null;
  if (bearer) {
    if (!privyServerConfigured()) return json(res, 503, { error: 'Sign-in verification is not configured on the server yet.' });
    try { authenticatedUserId = await verifyPrivyAccessToken(bearer); }
    catch { return json(res, 401, { error: 'Your sign-in session is invalid or expired. Please sign in again.' }); }
    if (!authenticatedUserId) return json(res, 401, { error: 'Your sign-in session could not be verified. Please sign in again.' });
  }

  const periodKey = authenticatedUserId ? new Date().toISOString().slice(0, 10) : 'lifetime';
  const subjectId = authenticatedUserId
    ? `privy:${authenticatedUserId}`
    : (() => { const subject = getAnonymousSubject(req, res); return subject ? `anonymous:${subject}` : null; })();
  if (!subjectId) return json(res, 503, { error: 'Case investigation is not configured on the server.', detail: 'Anonymous usage protection must be configured before this endpoint can run.' });

  let quota: { allowed: boolean; remaining: number };
  try {
    quota = process.env.DATABASE_URL
      ? await consumeUsageQuota(subjectId, periodKey, authenticatedUserId ? 10 : 5)
      : consumeFallbackQuota(req, res, subjectId, periodKey, authenticatedUserId ? 10 : 5);
  } catch {
    if (!process.env.VERA_ANON_SECRET || process.env.VERA_ANON_SECRET.length < 32) {
      return json(res, 503, { error: 'Usage protection is unavailable. No case trace was run.' });
    }
    quota = consumeFallbackQuota(req, res, subjectId, periodKey, authenticatedUserId ? 10 : 5);
  }
  if (!quota.allowed) {
    return json(res, 429, authenticatedUserId
      ? { error: 'You have used your ten investigations for today. Your allowance resets at 00:00 UTC.' }
      : { error: 'You have used your five free investigations. Sign in through VERA for ten investigations per day.' });
  }

  try {
    const result = await traceSolanaCase({ addresses, signatures, network, maxDepth: 2 });
    return json(res, 200, { ok: true, result, remaining: quota.remaining });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const invalidKey = /Invalid public key|Non-base58 character|Invalid character/i.test(message);
    return json(res, invalidKey ? 400 : 502, {
      error: invalidKey ? 'One or more wallet addresses are not valid Solana public keys.' : 'VERA could not complete this case trace.',
      detail: invalidKey ? 'Check the address for missing or extra characters.' : 'The selected Solana RPC may be unavailable or may have rate-limited the request. No conclusion should be drawn from an incomplete trace.'
    });
  }
}
