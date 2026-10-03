import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { InputType, Network } from '../src/lib/types';
import { localSignals } from '../src/lib/investigator';
import { inspectWallet } from '../src/server/solana';
import { inspectMagicEdenWallet } from '../src/server/magicEden';
import { explainWithGemini } from '../src/server/gemini';
import { persistScan } from '../src/server/db';

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
