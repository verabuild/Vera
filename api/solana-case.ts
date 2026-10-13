import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Network } from '../src/lib/types.js';
import { traceSolanaCase } from '../src/server/solanaCase.js';
import { consumeFallbackQuota, getAnonymousSubject } from '../src/server/anonymousSession.js';

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function listOf(value: unknown, max: number) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(/[\n,\s]+/).map((part) => part.trim()).filter(Boolean))].slice(0, max);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const subject = getAnonymousSubject(req, res);
  if (!subject) {
    return json(res, 503, {
      error: 'Case investigation is not configured on the server.',
      detail: 'Anonymous usage protection must be configured before this endpoint can run.'
    });
  }

  const quota = consumeFallbackQuota(req, res, `anonymous:${subject}`, 'lifetime', 5);
  if (!quota.allowed) return json(res, 429, { error: 'You have used your five free investigations. Sign in through the main VERA scanner for your daily allowance.' });

  const body = req.body ?? {};
  const network: Network = body.network === 'devnet' ? 'devnet' : 'mainnet';
  const addresses = listOf(body.addresses, 8);
  const signatures = listOf(body.signatures, 5);

  if (!addresses.length && !signatures.length) {
    return json(res, 400, { error: 'Add at least one Solana wallet address or transaction signature.' });
  }
  if (addresses.length > 8 || signatures.length > 5) {
    return json(res, 400, { error: 'A case can include up to eight wallet addresses and five transaction signatures.' });
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
