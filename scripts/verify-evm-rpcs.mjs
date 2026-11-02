import { CHAIN_REGISTRY } from '../src/lib/chains.ts';

const chains = Object.values(CHAIN_REGISTRY).filter((chain) => chain.family === 'evm');
const strict = process.argv.includes('--strict');
let failures = 0;
let skipped = 0;

for (const chain of chains) {
  const variable = chain.rpcEnvVar;
  const endpoint = variable ? process.env[variable]?.trim() : '';
  if (!endpoint) {
    skipped += 1;
    console.log(`SKIP ${chain.id}: ${variable ?? 'RPC variable not defined'} is not configured`);
    continue;
  }

  try {
    const url = new URL(endpoint);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('RPC URL must use HTTP or HTTPS');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message ?? 'JSON-RPC error');
    const actual = Number.parseInt(payload.result, 16);
    if (!Number.isSafeInteger(actual) || actual !== chain.chainId) {
      throw new Error(`chain ID mismatch: expected ${chain.chainId}, received ${payload.result}`);
    }
    console.log(`PASS ${chain.id}: RPC returned registered chain ID ${actual}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${chain.id}: ${error instanceof Error ? error.message : 'RPC verification failed'}`);
  }
}

console.log(`EVM RPC verification: ${chains.length - skipped - failures} passed, ${skipped} skipped, ${failures} failed.`);
if (failures || (strict && skipped)) process.exitCode = 1;
