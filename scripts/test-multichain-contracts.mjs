import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const chains = read('src/lib/chains.ts');
const adapter = read('src/server/chainAdapters/evm.ts');
const api = read('api/investigate.ts');
const types = read('src/lib/types.ts');

const evmChains = ['ethereum', 'base', 'bsc', 'arbitrum', 'polygon', 'robinhood'];

for (const chain of evmChains) {
  const start = chains.indexOf(`  ${chain}: {`);
  assert.notEqual(start, -1, `chain registry must include ${chain}`);
  const next = chains.indexOf('\n  },', start);
  assert.notEqual(next, -1, `registry entry for ${chain} must be closed`);
  const entry = chains.slice(start, next);
  assert.match(entry, /enabledForInvestigation:\s*false/, `${chain} must remain disabled until release gates pass`);
  assert.match(entry, /availability:\s*'planned'/, `${chain} must remain marked planned`);
  assert.match(entry, /rpcEnvVar:\s*'EVM_[A-Z_]+_RPC_URL'/, `${chain} must use a server-side RPC variable`);
}

assert.match(adapter, /eth_chainId/, 'adapter must verify the connected RPC chain');
assert.match(adapter, /actual !== expected/, 'adapter must reject a chain ID mismatch');
assert.match(adapter, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/, 'RPC requests must have a timeout');
assert.match(adapter, /must use HTTP or HTTPS/, 'RPC URL protocols must be validated');
assert.match(adapter, /'UNKNOWN'/, 'missing coverage must be represented as unknown');
assert.match(adapter, /does not establish that the address or its activity is safe/i, 'account state must not be presented as a safety verdict');
assert.match(adapter, /does not yet decode internal calls, ERC-20 transfers, approval changes/i, 'transaction coverage limitations must be disclosed');

assert.match(api, /VERA_ENABLE_EVM_INVESTIGATIONS !== 'true'/, 'EVM feature flag must be enforced server-side');
assert.match(api, /!chain\.enabledForInvestigation/, 'registry approval must be enforced server-side');
assert.match(api, /verdict:\s*'REVIEW'/, 'baseline EVM investigations must not produce a SAFE verdict');
assert.doesNotMatch(api, /coverage === 100 \? 'COMPLETE'/, 'baseline-only EVM coverage must not claim a complete investigation');
assert.match(api, /assessment\.state === 'CONFIRMED_MALICIOUS'.*'CONFIRMED_FINDING'.*'PARTIAL'/s, 'EVM reports must remain partial unless a confirmed finding exists');
assert.match(api, /state: invalid \? 'UNKNOWN'/, 'invalid EVM inputs must not be presented as safe');
assert.match(api, /EVM chain evidence unavailable/, 'provider failures must return unavailable evidence');
assert.match(api, /requestedChainId !== undefined.*Unsupported investigation chain/s, 'unsupported chain IDs must be rejected');

assert.match(types, /export type Network = 'mainnet' \| 'devnet'/, 'legacy Solana network contract must remain stable');
assert.match(types, /chainId\?: ChainId/, 'chain identity must be optional for legacy persisted scans');

console.log('Multichain source-contract regression checks passed.');
console.log(`Verified ${evmChains.length} EVM chains remain gated and baseline evidence stays review-only.`);
