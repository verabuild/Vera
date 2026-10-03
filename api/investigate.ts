import type { VercelRequest, VercelResponse } from '@vercel/node';
import { localSignals } from '../src/lib/investigator';
import { inspectWallet } from '../src/server/solana';
import { inspectMagicEdenWallet } from '../src/server/magicEden';
import { explainWithGemini } from '../src/server/gemini';
import { persistScan } from '../src/server/db';
import type { InputType, Network } from '../src/lib/types';

const allowedTypes = new Set<InputType>(['URL', 'MESSAGE', 'WALLET', 'TX']);
const allowedNetworks = new Set<Network>(['mainnet', 'devnet']);

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const { inputType, input, network = 'mainnet' } = req.body ?? {};
    if (!allowedTypes.has(inputType) || typeof input !== 'string' || !input.trim() || input.length > 10000) return json(res, 400, { error: 'Invalid investigation request' });
    if (!allowedNetworks.has(network)) return json(res, 400, { error: 'Invalid Solana network' });

    let assessment = localSignals(inputType, input.trim());
    if (inputType === 'WALLET') {
      const [solanaEvidence, meEvidence] = await Promise.all([
        inspectWallet(input.trim(), network),
        inspectMagicEdenWallet(input.trim(), network)
      ]);
      assessment = { ...assessment, state: 'SUPPORTED', headline: `Wallet evidence collected on ${network}`, explanation: 'VERA found live chain evidence for this public address. This describes observable state and does not mean assets or projects associated with the wallet are safe.', action: 'Review the evidence before interacting with any asset or signing a transaction.', evidence: [...solanaEvidence, ...meEvidence], confidence: 'HIGH', network };
    }
    const aiExplanation = await explainWithGemini(input.trim(), assessment, assessment.evidence);
    const scan = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), inputType, input: input.trim(), network, assessment: { ...assessment, aiExplanation: aiExplanation || undefined } };
    await persistScan(scan.id, inputType, input.trim(), network, scan.assessment);
    return json(res, 200, scan);
  } catch (error) {
    return json(res, 500, { error: 'Investigation failed', detail: error instanceof Error ? error.message : 'Unknown error' });
  }
}