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
  assert.match(entry, /enabledForInvestigation:\\s*true/, `${chain} must be enabled for preview investigation`);
  assert.match(entry, /availability:\\s*'available'/, `${chain} must be available for preview investigation`);
  assert.match(entry, /rpcEnvVar:\s*'EVM_[A-Z_]+_RPC_URL'/, `${chain} must use a server-side RPC variable`);
}

assert.match(adapter, /eth_chainId/, 'adapter must verify the connected RPC chain');
assert.match(adapter, /actual !== expected/, 'adapter must reject a chain ID mismatch');
assert.match(adapter, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/, 'RPC requests must have a timeout');
assert.match(adapter, /must use HTTP or HTTPS/, 'RPC URL protocols must be validated');
assert.match(adapter, /'UNKNOWN'/, 'missing coverage must be represented as unknown');

assert.match(adapter, /eth_call/, 'token inspection must use read-only eth_call metadata lookups');
for (const selector of ['0x06fdde03', '0x95d89b41', '0x313ce567', '0x18160ddd']) {
  assert.ok(adapter.includes(selector), `token adapter must query ERC-20 selector ${selector}`);
}
assert.match(adapter, /Token risk coverage remains incomplete/, 'metadata-only token checks must disclose incomplete risk coverage');
assert.match(adapter, /holder concentration.*liquidity.*transfer restrictions/s, 'token report must disclose deeper checks still pending');
assert.match(adapter, /verifyRpcChain\(this\.chain\)/, 'token metadata lookups must verify the selected RPC chain');

assert.match(adapter, /does not establish that the address or its activity is safe/i, 'account state must not be presented as a safety verdict');
assert.match(adapter, /ERC-20 Transfer event\(s\)/, 'transaction receipts must decode standard ERC-20 transfer logs');
assert.match(adapter, /ERC20_TRANSFER_TOPIC/, 'transfer decoding must match the canonical ERC-20 Transfer topic');
assert.match(adapter, /eth_getLogs/, 'wallet address inspection must retrieve bounded ERC-20 transfer history');
assert.match(adapter, /MAX_HISTORY_BLOCKS/, 'historical event lookup must use a bounded block window');
assert.match(adapter, /MAX_LOG_BLOCK_SPAN = 10/, 'historical log queries must respect ten-block provider range limits');
assert.match(adapter, /getRecentTransferLogs/, 'historical log queries must be chunked instead of issuing an oversized range');
assert.match(adapter, /MAX_LOG_BLOCK_SPAN = 10/, 'historical log queries must respect ten-block provider range limits');
assert.match(adapter, /getRecentTransferLogs/, 'historical log queries must be chunked instead of issuing an oversized range');
assert.match(adapter, /bounded-recent-token-events-only/, 'historical event evidence must disclose its limited coverage');
assert.match(adapter, /EIP1967_IMPLEMENTATION_SLOT/, 'contract inspection must read the standard implementation slot');
assert.match(adapter, /EIP1967_ADMIN_SLOT/, 'contract inspection must read the standard admin slot');
assert.match(adapter, /EIP1967_BEACON_SLOT/, 'contract inspection must read the standard beacon slot');
assert.match(adapter, /0x8da5cb5b/, 'contract inspection must probe the common owner() interface');
assert.match(adapter, /custom proxy patterns/, 'contract analysis must disclose custom proxy coverage gaps');

assert.match(adapter, /rawAmount/, 'transfer evidence must preserve raw token units without guessing decimals');
assert.match(adapter, /does not yet decode internal calls, approval changes, traces/i, 'transaction coverage limitations must be disclosed');

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
