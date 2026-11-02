import type { Evidence } from '../../lib/types.js';
import { getChainConfig, isEvmChainId, type EvmChainId } from '../../lib/chains.js';
import type {
  AddressInvestigationRequest,
  ContractInvestigationRequest,
  EvmInvestigationAdapter,
  TokenInvestigationRequest,
  TransactionInvestigationRequest,
} from './types.js';

interface RpcEnvelope<T> {
  jsonrpc?: string;
  id?: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  input: string;
  nonce: string;
  blockNumber: string | null;
  blockHash: string | null;
  transactionIndex: string | null;
}

interface RpcLog { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; }

interface RpcReceipt {
  transactionHash: string;
  status?: string;
  blockNumber: string | null;
  gasUsed: string;
  contractAddress: string | null;
  logs: Array<{ address: string; topics: string[]; data: string }>;
}

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_EVIDENCE_ITEMS = 20;
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const MAX_HISTORY_BLOCKS = 5_000;
const MAX_HISTORY_LOGS = 100;

function evidence(
  id: string,
  title: string,
  detail: string,
  state: Evidence['state'] = 'SUPPORTED',
  severity: Evidence['severity'] = 'info',
  source = 'VERA EVM RPC',
  metadata?: Record<string, unknown>,
): Evidence {
  return {
    id,
    title,
    detail,
    state,
    severity,
    source,
    observedAt: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}

function getRpcUrl(chain: EvmChainId): string {
  const config = getChainConfig(chain);
  const variable = config.rpcEnvVar;
  const value = variable ? process.env[variable]?.trim() : '';

  if (!value) {
    throw new Error(`RPC configuration is missing for ${config.name} (${variable ?? 'not configured'}).`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`RPC configuration for ${config.name} is not a valid URL.`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`RPC configuration for ${config.name} must use HTTP or HTTPS.`);
  }

  return value;
}

async function rpc<T>(chain: EvmChainId, method: string, params: unknown[]): Promise<T> {
  const url = getRpcUrl(chain);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json() as RpcEnvelope<T>;
  if (payload.error) {
    throw new Error(`RPC ${method} failed (${payload.error.code}): ${payload.error.message}`);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
    throw new Error(`RPC ${method} returned no result.`);
  }

  return payload.result as T;
}

async function verifyRpcChain(chain: EvmChainId): Promise<void> {
  const expected = getChainConfig(chain).chainId;
  if (typeof expected !== 'number') throw new Error(`No chain ID is registered for ${chain}.`);

  const actualHex = await rpc<string>(chain, 'eth_chainId', []);
  const actual = Number.parseInt(actualHex, 16);
  if (!Number.isSafeInteger(actual) || actual !== expected) {
    throw new Error(`RPC chain mismatch for ${chain}: expected ${expected}, received ${actualHex}.`);
  }
}

function isValidEvmChain(chain: string): chain is EvmChainId {
  return isEvmChainId(chain);
}

function formatNativeBalance(hex: string): string {
  const value = BigInt(hex);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}


function decodeAbiString(value: string): string | null {
  if (!/^0x[0-9a-fA-F]+$/.test(value) || value.length < 66) return null;
  const data = value.slice(2);
  try {
    const offset = Number(BigInt(`0x${data.slice(0, 64)}`)) * 2;
    if (Number.isSafeInteger(offset) && offset >= 0 && offset + 64 <= data.length) {
      const length = Number(BigInt(`0x${data.slice(offset, offset + 64)}`));
      const start = offset + 64;
      if (Number.isSafeInteger(length) && length >= 0 && start + length * 2 <= data.length) {
        const hex = data.slice(start, start + length * 2);
        const decoded = new TextDecoder().decode(Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)));
        if (decoded.trim()) return decoded.replace(/\0/g, '').trim();
      }
    }
  } catch { /* Try bytes32 below. */ }
  const bytes32 = data.slice(0, 64);
  const decoded = new TextDecoder().decode(Uint8Array.from(bytes32.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))).replace(/\0/g, '').trim();
  return decoded || null;
}

function decodeAbiUint(value: string): bigint | null {
  if (!/^0x[0-9a-fA-F]{64,}$/.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

function contractCodeEvidence(code: string, chain: EvmChainId, address: string): Evidence {
  if (code === '0x' || code === '0x0') {
    return evidence(
      'evm-account-no-contract-code',
      'No contract code observed at this address',
      'The selected chain returned no runtime bytecode for this address at the time of the check. This is consistent with an externally owned account, but does not establish that the address or its activity is safe.',
      'SUPPORTED',
      'info',
      'EVM eth_getCode',
      { chain, address },
    );
  }

  return evidence(
    'evm-contract-code-present',
    'Contract bytecode observed',
    'The selected chain returned runtime bytecode for this address. This confirms contract code is present; it does not establish whether the contract is safe or malicious.',
    'VERIFIED',
    'info',
    'EVM eth_getCode',
    { chain, address, bytecodeBytes: Math.max(0, (code.length - 2) / 2) },
  );
}

/**
 * Read-only JSON-RPC adapter for baseline EVM evidence.
 *
 * This deliberately does not sign, submit, simulate, or approve transactions.
 * The adapter is not wired into the production investigation API until the
 * chain-aware request/report migration and regression suite are complete.
 */
export class EvmRpcInvestigationAdapter implements EvmInvestigationAdapter {
  readonly chain: EvmChainId;

  constructor(chain: EvmChainId) {
    if (!isValidEvmChain(chain)) throw new Error('Unsupported EVM chain.');
    this.chain = chain;
  }

  async inspectAddress(request: AddressInvestigationRequest): Promise<Evidence[]> {
    if (request.chain !== this.chain) throw new Error('Adapter chain does not match the requested chain.');
    const address = request.address.trim();
    if (!ADDRESS_PATTERN.test(address)) {
      return [evidence('evm-address-invalid', 'Invalid EVM address format', 'The supplied value is not a 20-byte hexadecimal EVM address. Format validity does not indicate whether an address is safe.', 'VERIFIED', 'medium', 'VERA address validator', { chain: this.chain })];
    }
    await verifyRpcChain(this.chain);
    const [balance, code, transactionCount] = await Promise.all([
      rpc<string>(this.chain, 'eth_getBalance', [address, 'latest']),
      rpc<string>(this.chain, 'eth_getCode', [address, 'latest']),
      rpc<string>(this.chain, 'eth_getTransactionCount', [address, 'latest']),
    ]);
    const config = getChainConfig(this.chain);
    const result: Evidence[] = [
      evidence('evm-address-format-valid', 'Address format validated', 'The value matches the expected EVM address format. This is a syntax check only and is not a trust or ownership verification.', 'VERIFIED', 'info', 'VERA address validator', { chain: this.chain, address }),
      evidence('evm-native-balance', 'Native asset balance retrieved', `The RPC returned a native balance of ${formatNativeBalance(balance)} ${config.nativeCurrency.symbol}. Balances can change and are not a security verdict.`, 'VERIFIED', 'info', 'EVM eth_getBalance', { chain: this.chain, address, balanceWei: BigInt(balance).toString(), symbol: config.nativeCurrency.symbol }),
      contractCodeEvidence(code, this.chain, address),
      evidence('evm-transaction-count', 'Transaction count retrieved', `The RPC returned a transaction count of ${BigInt(transactionCount).toString()} for this address. This is chain data, not a measure of trustworthiness.`, 'VERIFIED', 'info', 'EVM eth_getTransactionCount', { chain: this.chain, address, transactionCount: BigInt(transactionCount).toString() }),
    ];
    try {
      const latestHex = await rpc<string>(this.chain, 'eth_blockNumber', []);
      const latest = BigInt(latestHex);
      const from = latest > BigInt(MAX_HISTORY_BLOCKS) ? latest - BigInt(MAX_HISTORY_BLOCKS) : 0n;
      const padded = `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;
      const [incoming, outgoing] = await Promise.all([
        rpc<RpcLog[]>(this.chain, 'eth_getLogs', [{ fromBlock: `0x${from.toString(16)}`, toBlock: 'latest', topics: [ERC20_TRANSFER_TOPIC, null, padded] }]),
        rpc<RpcLog[]>(this.chain, 'eth_getLogs', [{ fromBlock: `0x${from.toString(16)}`, toBlock: 'latest', topics: [ERC20_TRANSFER_TOPIC, padded] }]),
      ]);
      const logs = [...incoming, ...outgoing].slice(0, MAX_HISTORY_LOGS);
      const transfers = logs.map((log) => ({
        token: log.address, from: `0x${log.topics[1]?.slice(-40) ?? ''}`, to: `0x${log.topics[2]?.slice(-40) ?? ''}`,
        rawAmount: /^0x[0-9a-fA-F]+$/.test(log.data) ? BigInt(log.data).toString() : null,
        blockNumber: BigInt(log.blockNumber).toString(), transactionHash: log.transactionHash,
      }));
      result.push(evidence('evm-address-token-transfer-history', 'Recent ERC-20 transfer history retrieved', `The RPC returned ${logs.length} standard ERC-20 transfer event(s) in a window of ${MAX_HISTORY_BLOCKS} blocks. This is not a complete wallet history; native transfers, internal calls, non-standard events and older activity are excluded.`, 'SUPPORTED', 'info', 'EVM eth_getLogs', { chain: this.chain, address, fromBlock: from.toString(), toBlock: latest.toString(), transferCount: logs.length, transfers, truncated: incoming.length + outgoing.length > MAX_HISTORY_LOGS, coverage: 'bounded-recent-token-events-only' }));
    } catch (error) {
      result.push(evidence('evm-address-token-transfer-history-unavailable', 'Recent ERC-20 transfer history unavailable', 'The RPC could not retrieve the bounded Transfer event window. Provider range limits or unavailable log indexing may be responsible; no conclusion about wallet history can be drawn.', 'UNKNOWN', 'info', 'EVM eth_getLogs', { chain: this.chain, address, providerError: error instanceof Error ? error.message : 'RPC log lookup failed' }));
    }
    result.push(evidence('evm-address-risk-analysis-pending', 'Address risk coverage is incomplete', 'This bounded lookup does not include complete native-asset history, full token holdings, approvals, known scam labels, interaction patterns, or address attribution. Do not treat this as a full address security assessment.', 'UNKNOWN', 'info', 'VERA coverage disclosure', { chain: this.chain, address, pendingChecks: ['complete native-asset history', 'full token holdings and approvals', 'external risk intelligence', 'attribution'] }));
    if (code !== '0x' && code !== '0x0') {
      const slots = await Promise.all([
        { key: 'implementation', slot: EIP1967_IMPLEMENTATION_SLOT }, { key: 'admin', slot: EIP1967_ADMIN_SLOT }, { key: 'beacon', slot: EIP1967_BEACON_SLOT },
      ].map(async ({ key, slot }) => {
        try {
          const value = await rpc<string>(this.chain, 'eth_getStorageAt', [address, slot, 'latest']);
          const candidate = value.length >= 42 ? `0x${value.slice(-40)}` : null;
          const populated = candidate && !/^0x0{40}$/i.test(candidate);
          return evidence(`evm-eip1967-${key}`, populated ? `EIP-1967 ${key} slot populated` : `EIP-1967 ${key} slot empty`, populated ? `The standard EIP-1967 ${key} slot contains ${candidate}. This is a proxy-pattern signal requiring independent verification.` : `No non-zero address was observed in the standard EIP-1967 ${key} slot. Custom proxy patterns are not ruled out.`, 'SUPPORTED', 'info', 'EVM eth_getStorageAt', { chain: this.chain, address, slot, value: candidate });
        } catch {
          return evidence(`evm-eip1967-${key}-unavailable`, `EIP-1967 ${key} slot unavailable`, 'The RPC could not read this standard proxy storage slot. Proxy status remains unknown.', 'UNKNOWN', 'info', 'EVM eth_getStorageAt', { chain: this.chain, address, slot });
        }
      }));
      result.push(...slots);
      try {
        const ownerRaw = await rpc<string>(this.chain, 'eth_call', [{ to: address, data: '0x8da5cb5b' }, 'latest']);
        const owner = /^0x[0-9a-fA-F]{64}$/.test(ownerRaw) ? `0x${ownerRaw.slice(-40)}` : null;
        result.push(evidence('evm-contract-owner', owner ? 'Contract owner response retrieved' : 'Contract owner response unavailable', owner ? `The contract responded to owner() with ${owner}. Ownership alone does not establish malicious behavior.` : 'The contract did not return a decodable standard owner() response.', owner ? 'SUPPORTED' : 'UNKNOWN', 'info', 'EVM eth_call', { chain: this.chain, address, owner }));
      } catch {
        result.push(evidence('evm-contract-owner-unavailable', 'Contract owner lookup unavailable', 'The standard owner() call failed or is unsupported. Owner controls remain unknown.', 'UNKNOWN', 'info', 'EVM eth_call', { chain: this.chain, address }));
      }
      result.push(evidence('evm-contract-deep-analysis-pending', 'Contract risk coverage remains incomplete', 'VERA checks standard EIP-1967 slots and the common owner() interface. This does not cover custom proxies, verified source, arbitrary privileged functions, implementation bytecode analysis, or independent security reports.', 'UNKNOWN', 'info', 'VERA coverage disclosure', { chain: this.chain, address, pendingChecks: ['custom proxy patterns', 'verified source', 'privileged function analysis', 'implementation bytecode analysis', 'external security intelligence'] }));
    }
    return result.slice(0, MAX_EVIDENCE_ITEMS);
  }

  async inspectTransaction(request: TransactionInvestigationRequest): Promise<Evidence[]> {
    if (request.chain !== this.chain) throw new Error('Adapter chain does not match the requested chain.');
    const hash = request.hash.trim();
    if (!HASH_PATTERN.test(hash)) {
      return [evidence(
        'evm-transaction-hash-invalid',
        'Invalid transaction hash format',
        'The supplied value is not a 32-byte hexadecimal transaction hash.',
        'VERIFIED',
        'medium',
        'VERA transaction validator',
        { chain: this.chain },
      )];
    }

    await verifyRpcChain(this.chain);
    const transaction = await rpc<RpcTransaction | null>(this.chain, 'eth_getTransactionByHash', [hash]);
    if (!transaction) {
      return [evidence(
        'evm-transaction-not-found',
        'Transaction was not found',
        'The selected chain RPC returned no transaction for this hash. The transaction may be unknown to this network or unavailable from this provider; no safety conclusion can be drawn.',
        'UNKNOWN',
        'info',
        'EVM eth_getTransactionByHash',
        { chain: this.chain, hash },
      )];
    }

    const receipt = await rpc<RpcReceipt | null>(this.chain, 'eth_getTransactionReceipt', [hash]);
    const config = getChainConfig(this.chain);
    const result: Evidence[] = [
      evidence(
        'evm-transaction-found',
        'Transaction record retrieved',
        'The selected chain returned a transaction record. Presence on-chain does not establish that the transaction was intended or safe.',
        'VERIFIED',
        'info',
        'EVM eth_getTransactionByHash',
        {
          chain: this.chain,
          hash,
          from: transaction.from,
          to: transaction.to,
          valueWei: BigInt(transaction.value).toString(),
          nonce: BigInt(transaction.nonce).toString(),
          blockNumber: transaction.blockNumber ? BigInt(transaction.blockNumber).toString() : null,
          inputBytes: Math.max(0, (transaction.input?.length ?? 2) - 2) / 2,
          explorerUrl: `${config.explorerUrl}/tx/${hash}`,
        },
      ),
    ];

    if (!receipt) {
      result.push(evidence(
        'evm-transaction-receipt-unavailable',
        'Transaction receipt unavailable',
        'The RPC returned a transaction but no receipt. Execution status and emitted logs cannot be confirmed from this response.',
        'UNKNOWN',
        'info',
        'EVM eth_getTransactionReceipt',
        { chain: this.chain, hash },
      ));
      return result;
    }

    const succeeded = receipt.status === '0x1';
    const failed = receipt.status === '0x0';
    result.push(evidence(
      'evm-transaction-execution-status',
      succeeded ? 'Transaction execution succeeded' : failed ? 'Transaction execution failed' : 'Transaction execution status unclear',
      succeeded
        ? 'The receipt indicates successful execution. This does not prove the transaction was safe or that its effects matched the user’s intent.'
        : failed
          ? 'The receipt indicates execution failure. Failure is not by itself proof of malicious intent; review the attempted interaction before retrying.'
          : 'The receipt did not provide a recognized execution status, so Vera cannot classify the outcome.',
      succeeded || failed ? 'VERIFIED' : 'UNKNOWN',
      failed ? 'medium' : 'info',
      'EVM eth_getTransactionReceipt',
      {
        chain: this.chain,
        hash,
        status: receipt.status ?? null,
        blockNumber: receipt.blockNumber ? BigInt(receipt.blockNumber).toString() : null,
        gasUsed: receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : null,
        logCount: receipt.logs?.length ?? 0,
        createdContract: receipt.contractAddress,
      },
    ));
    const transferLogs = (receipt.logs ?? []).filter((log) =>
      Array.isArray(log.topics) && log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC
      && log.topics.length >= 3 && /^0x[0-9a-fA-F]{64}$/.test(log.topics[1])
      && /^0x[0-9a-fA-F]{64}$/.test(log.topics[2]) && /^0x[0-9a-fA-F]{64}$/.test(log.data)
    );
    if (transferLogs.length) {
      const transfers = transferLogs.slice(0, 12).map((log) => ({
        token: log.address,
        from: `0x${log.topics[1].slice(-40)}`,
        to: `0x${log.topics[2].slice(-40)}`,
        rawAmount: BigInt(log.data).toString(),
      }));
      result.push(evidence(
        'evm-erc20-transfers',
        'ERC-20 transfer events decoded',
        `The receipt contains ${transferLogs.length} standard ERC-20 Transfer event(s). Amounts are raw token units because token decimals were not independently resolved in this transaction lookup. Event logs show emitted transfer events; they do not establish intent or token legitimacy.`,
        'SUPPORTED', 'info', 'EVM transaction receipt logs',
        { chain: this.chain, hash, totalTransferEvents: transferLogs.length, transfers, truncated: transferLogs.length > transfers.length },
      ));
    } else {
      result.push(evidence(
        'evm-erc20-transfers-none-observed',
        'No standard ERC-20 transfer events observed',
        'No decodable standard ERC-20 Transfer event was found in the receipt logs. This does not rule out native transfers, non-standard token events, internal calls, or other contract effects.',
        'SUPPORTED', 'info', 'EVM transaction receipt logs', { chain: this.chain, hash },
      ));
    }

    result.push(evidence(
      'evm-transaction-effects-analysis-pending',
      'Transaction effect analysis is incomplete',
      'This baseline adapter retrieves the transaction and receipt but does not yet decode internal calls, approval changes, traces, or contract-specific effects. Standard ERC-20 Transfer receipt events are decoded separately when present. Execution status alone is not a security verdict.',
      'UNKNOWN',
      'info',
      'VERA coverage disclosure',
      { chain: this.chain, hash, pendingChecks: ['internal calls and traces', 'token transfers', 'approval changes', 'contract-specific effects'] },
    ));
    return result;
  }

  async inspectToken(request: TokenInvestigationRequest): Promise<Evidence[]> {
    if (request.chain !== this.chain) throw new Error('Adapter chain does not match the requested chain.');
    const address = request.address.trim();
    if (!ADDRESS_PATTERN.test(address)) {
      return [evidence('evm-token-address-invalid', 'Invalid token contract address', 'The supplied value is not a valid EVM address.', 'VERIFIED', 'medium', 'VERA address validator', { chain: this.chain })];
    }

    await verifyRpcChain(this.chain);
    const code = await rpc<string>(this.chain, 'eth_getCode', [address, 'latest']);
    if (code === '0x' || code === '0x0') {
      return [
        contractCodeEvidence(code, this.chain, address),
        evidence('evm-token-contract-missing', 'Token contract not found', 'No runtime bytecode was returned for this address on the selected chain. Token metadata checks were not attempted.', 'UNKNOWN', 'medium', 'EVM eth_getCode', { chain: this.chain, address }),
      ];
    }

    const result: Evidence[] = [contractCodeEvidence(code, this.chain, address)];
    const calls = [
      { key: 'name', selector: '0x06fdde03' },
      { key: 'symbol', selector: '0x95d89b41' },
      { key: 'decimals', selector: '0x313ce567' },
      { key: 'totalSupply', selector: '0x18160ddd' },
    ] as const;
    const values = await Promise.all(calls.map(async (call) => {
      try {
        const raw = await rpc<string>(this.chain, 'eth_call', [{ to: address, data: call.selector }, 'latest']);
        return { ...call, raw, error: null as string | null };
      } catch (error) {
        return { ...call, raw: null, error: error instanceof Error ? error.message : 'RPC call failed' };
      }
    }));

    for (const item of values) {
      if (item.raw === null) {
        result.push(evidence(
          `evm-token-${item.key}-unavailable`,
          `Token ${item.key} unavailable`,
          `The selected RPC could not retrieve the token ${item.key} value. This may indicate unsupported metadata, a non-standard token, or provider limitations; it is not a maliciousness finding.`,
          'UNKNOWN', 'info', 'EVM eth_call', { chain: this.chain, address, method: item.selector, providerError: item.error },
        ));
        continue;
      }
      if (item.key === 'name' || item.key === 'symbol') {
        const decoded = decodeAbiString(item.raw);
        result.push(evidence(
          `evm-token-${item.key}`,
          decoded ? `Token ${item.key} retrieved` : `Token ${item.key} could not be decoded`,
          decoded ? `The contract returned token ${item.key}: ${decoded}. Metadata is self-reported by the contract and is not a trust signal.` : `The contract returned data that Vera could not decode as a standard string or bytes32 value.`,
          decoded ? 'VERIFIED' : 'UNKNOWN', 'info', 'EVM eth_call', { chain: this.chain, address, value: decoded },
        ));
      } else {
        const decoded = decodeAbiUint(item.raw);
        const value = decoded === null ? null : decoded.toString();
        result.push(evidence(
          `evm-token-${item.key}`,
          value !== null ? `Token ${item.key} retrieved` : `Token ${item.key} could not be decoded`,
          value !== null ? `The contract returned ${item.key} value ${value}${item.key === 'decimals' ? '. This value controls display scaling and is not a safety signal.' : '. This is the raw on-chain quantity and does not establish circulating supply or liquidity.'}` : 'The contract returned data that Vera could not decode as an unsigned integer.',
          value !== null ? 'VERIFIED' : 'UNKNOWN', 'info', 'EVM eth_call', { chain: this.chain, address, value },
        ));
      }
    }

    result.push(evidence(
      'evm-token-risk-coverage-pending',
      'Token risk coverage remains incomplete',
      'Basic ERC-20 metadata calls do not establish token safety. Holder concentration, liquidity, transfer restrictions, privileged controls, proxy behavior, honeypot behavior, and independent threat intelligence are not assessed here.',
      'UNKNOWN', 'info', 'VERA coverage disclosure',
      { chain: this.chain, address, pendingChecks: ['holder concentration', 'liquidity', 'transfer restrictions', 'privileged controls', 'proxy behavior', 'honeypot behavior', 'external threat intelligence'] },
    ));
    return result.slice(0, MAX_EVIDENCE_ITEMS);
  }

  async inspectContract(request: ContractInvestigationRequest): Promise<Evidence[]> {
    if (request.chain !== this.chain) throw new Error('Adapter chain does not match the requested chain.');
    if (!ADDRESS_PATTERN.test(request.address.trim())) {
      return [evidence('evm-contract-address-invalid', 'Invalid contract address', 'The supplied value is not a valid EVM address.', 'VERIFIED', 'medium', 'VERA address validator', { chain: this.chain })];
    }

    const address = request.address.trim();
    await verifyRpcChain(this.chain);
    const code = await rpc<string>(this.chain, 'eth_getCode', [address, 'latest']);
    const result = [contractCodeEvidence(code, this.chain, address)];
    if (code === '0x' || code === '0x0') {
      result.push(evidence(
        'evm-contract-analysis-not-applicable',
        'No contract bytecode found at this address',
        'No runtime bytecode was returned for the address on the selected chain. Contract-specific checks cannot be completed from this result.',
        'UNKNOWN',
        'info',
        'VERA EVM coverage disclosure',
        { chain: this.chain, address },
      ));
      return result;
    }

    result.push(evidence(
      'evm-contract-deep-analysis-pending',
      'Deep contract risk analysis not yet available',
      'This baseline adapter confirms runtime bytecode exists. Verified-source analysis, proxy and upgradeability detection, owner/admin controls, dangerous function patterns, and external security intelligence are not yet implemented in this adapter.',
      'UNKNOWN',
      'info',
      'VERA coverage disclosure',
      { chain: this.chain, address },
    ));
    return result;
  }
}

export function createEvmAdapter(chain: EvmChainId): EvmRpcInvestigationAdapter {
  return new EvmRpcInvestigationAdapter(chain);
}
