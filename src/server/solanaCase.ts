import { Connection, PublicKey } from '@solana/web3.js';
import type { Network } from '../lib/types.js';
import { rpcUrl } from './solana.js';

export type CaseTransfer = {
  signature: string;
  slot: number;
  blockTime: number | null;
  source: string;
  destination: string;
  sourceTokenAccount?: string;
  destinationTokenAccount?: string;
  asset: string;
  mint?: string;
  rawAmount: string;
  amount: number | null;
  decimals?: number;
  kind: 'SOL' | 'TOKEN';
  sourceSeed: boolean;
  depth: number;
};

export type CaseTraceResult = {
  network: Network;
  generatedAt: string;
  seeds: string[];
  nodes: string[];
  transfers: CaseTransfer[];
  checkedTransactions: number;
  truncated: boolean;
  limitations: string[];
};

function parsedTransfer(instruction: unknown): {
  kind: 'SOL' | 'TOKEN'; source: string; destination: string; mint?: string;
  rawAmount: string; amount: number | null; decimals?: number; asset: string;
} | null {
  if (!instruction || typeof instruction !== 'object') return null;
  const row = instruction as Record<string, unknown>;
  const parsed = row.parsed;
  if (!parsed || typeof parsed !== 'object') return null;
  const parsedRow = parsed as Record<string, unknown>;
  const type = parsedRow.type;
  if (type !== 'transfer' && type !== 'transferChecked') return null;
  const info = parsedRow.info;
  if (!info || typeof info !== 'object') return null;
  const data = info as Record<string, unknown>;
  const source = typeof data.source === 'string' ? data.source : '';
  const destination = typeof data.destination === 'string' ? data.destination : '';
  if (!source || !destination) return null;

  const mint = typeof data.mint === 'string' ? data.mint : undefined;
  const tokenAmount = data.tokenAmount && typeof data.tokenAmount === 'object'
    ? data.tokenAmount as Record<string, unknown> : null;
  const raw = typeof tokenAmount?.amount === 'string' ? tokenAmount.amount
    : typeof data.amount === 'string' ? data.amount
    : typeof data.lamports === 'number' ? String(data.lamports) : '';
  if (!raw || !/^\d+$/.test(raw)) return null;

  if (!mint && typeof data.lamports === 'number') {
    return { kind: 'SOL', source, destination, rawAmount: raw, amount: Number(data.lamports) / 1e9, asset: 'SOL' };
  }

  const decimals = typeof tokenAmount?.decimals === 'number' ? tokenAmount.decimals : undefined;
  const amount = decimals === undefined ? null : Number(raw) / (10 ** decimals);
  return {
    kind: 'TOKEN', source, destination, mint, rawAmount: raw, amount, decimals,
    asset: mint ? `SPL token · ${mint}` : 'SPL token'
  };
}

export async function traceSolanaCase(input: {
  addresses: string[]; signatures: string[]; network: Network; maxDepth?: number;
}): Promise<CaseTraceResult> {
  const seeds = [...new Set(input.addresses.map((item) => item.trim()).filter(Boolean))];
  const signatures = [...new Set(input.signatures.map((item) => item.trim()).filter(Boolean))];
  for (const address of seeds) new PublicKey(address);
  const connection = new Connection(rpcUrl(input.network), 'confirmed');
  const MAX_NODES = 14;
  const MAX_TRANSACTIONS = 80;
  const maxDepth = Math.min(Math.max(input.maxDepth ?? 2, 1), 2);
  const discovered = new Set(seeds);
  const depthByAddress = new Map<string, number>(seeds.map((address) => [address, 0]));
  const pendingSignatures = new Set(signatures);
  const transfers: CaseTransfer[] = [];
  let checkedTransactions = 0;
  let truncated = false;
  const seenSignatures = new Set<string>();

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const frontier = [...discovered].filter((address) => depthByAddress.get(address) === depth);
    if (frontier.length) {
      const signatureResults = await Promise.allSettled(frontier.map((address) =>
        connection.getSignaturesForAddress(new PublicKey(address), { limit: 8 })
      ));
      for (const result of signatureResults) {
        if (result.status === 'fulfilled') {
          for (const item of result.value) pendingSignatures.add(item.signature);
        }
      }
    }

    const batch = [...pendingSignatures].filter((signature) => !seenSignatures.has(signature)).slice(0, MAX_TRANSACTIONS - checkedTransactions);
    if (batch.length < pendingSignatures.size) truncated = true;
    pendingSignatures.clear();
    if (!batch.length) break;
    batch.forEach((signature) => seenSignatures.add(signature));

    const txResults: PromiseSettledResult<Awaited<ReturnType<typeof connection.getParsedTransaction>>>[] = [];
    // Keep public-RPC concurrency bounded so one case does not trigger an avoidable rate-limit burst.
    for (let offset = 0; offset < batch.length; offset += 8) {
      const chunk = batch.slice(offset, offset + 8);
      const chunkResults = await Promise.allSettled(chunk.map((signature) =>
        connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
      ));
      txResults.push(...chunkResults);
    }
    checkedTransactions += batch.length;
    const newDestinations: string[] = [];

    for (let index = 0; index < txResults.length; index += 1) {
      const result = txResults[index];
      if (result.status !== 'fulfilled' || !result.value || result.value.meta?.err) continue;
      const tx = result.value;
      const message = tx.transaction.message;
      const accountKeys = message.accountKeys.map((account) => account.pubkey.toBase58());
      const tokenAccountOwners = new Map<string, string>();
      for (const balance of [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]) {
        const tokenAccount = accountKeys[balance.accountIndex];
        if (tokenAccount && typeof balance.owner === 'string') tokenAccountOwners.set(tokenAccount, balance.owner);
      }
      const instructions: unknown[] = [...message.instructions];
      for (const inner of tx.meta?.innerInstructions ?? []) instructions.push(...inner.instructions);
      const signature = batch[index];
      for (const instruction of instructions) {
        const parsed = parsedTransfer(instruction);
        if (!parsed) continue;
        // SPL transfer instructions identify token accounts, not necessarily the wallet owners.
        // Resolve owners from the transaction's pre/post token-balance metadata when available.
        const sourceOwner = parsed.kind === 'TOKEN' ? tokenAccountOwners.get(parsed.source) : undefined;
        const destinationOwner = parsed.kind === 'TOKEN' ? tokenAccountOwners.get(parsed.destination) : undefined;
        const source = sourceOwner ?? parsed.source;
        const destination = destinationOwner ?? parsed.destination;
        const sourceSeed = seeds.includes(source) || seeds.includes(parsed.source);
        const sourceDepth = depthByAddress.get(source) ?? depthByAddress.get(parsed.source) ?? depth;
        const transferDepth = Math.min(sourceDepth, depth + 1);
        transfers.push({
          signature, slot: tx.slot, blockTime: tx.blockTime ?? null, ...parsed,
          source, destination,
          ...(sourceOwner ? { sourceTokenAccount: parsed.source } : {}),
          ...(destinationOwner ? { destinationTokenAccount: parsed.destination } : {}),
          sourceSeed, depth: transferDepth
        });
        if (transferDepth < maxDepth && !discovered.has(destination) && discovered.size < MAX_NODES) {
          discovered.add(destination);
          depthByAddress.set(destination, transferDepth + 1);
          newDestinations.push(destination);
        } else if (discovered.size >= MAX_NODES && !discovered.has(destination)) {
          truncated = true;
        }
      }
    }

    if (depth === maxDepth || discovered.size >= MAX_NODES) break;
    // Only addresses first reached at the next depth are queried in the next pass.
    if (!newDestinations.length) break;
  }

  const uniqueTransfers = [...new Map(transfers.map((item) => [
    `${item.signature}:${item.source}:${item.destination}:${item.mint ?? item.kind}:${item.rawAmount}`, item
  ])).values()].sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

  return {
    network: input.network,
    generatedAt: new Date().toISOString(),
    seeds,
    nodes: [...new Set(uniqueTransfers.flatMap((item) => [item.source, item.destination]).concat(seeds))],
    transfers: uniqueTransfers,
    checkedTransactions,
    truncated,
    limitations: [
      'This report covers only recent address history returned by the selected RPC and is not a complete historical trace.',
      'Observed transfers are not automatically attributed to the reported theft; review the incident timeline and transaction context before linking them to a case.',
      'A transaction connection proves an on-chain transfer, not common ownership, criminal intent or a person’s real-world identity.',
      'Token transfers are shown only where Solana returned parseable transfer instructions. Swaps, bridges, pooled accounts and unsupported instructions may require specialist review.',
      'Exchange labels and account ownership are not inferred from an address alone.'
    ]
  };
}
