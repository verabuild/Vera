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
      return [evidence(
        'evm-address-invalid',
        'Invalid EVM address format',
        'The supplied value is not a 20-byte hexadecimal EVM address. Format validity does not indicate whether an address is safe.',
        'VERIFIED',
        'medium',
        'VERA address validator',
        { chain: this.chain },
      )];
    }

    await verifyRpcChain(this.chain);
    const [balance, code, transactionCount] = await Promise.all([
      rpc<string>(this.chain, 'eth_getBalance', [address, 'latest']),
      rpc<string>(this.chain, 'eth_getCode', [address, 'latest']),
      rpc<string>(this.chain, 'eth_getTransactionCount', [address, 'latest']),
    ]);

    const config = getChainConfig(this.chain);
    return [
      evidence(
        'evm-address-format-valid',
        'Address format validated',
        'The value matches the expected EVM address format. This is a syntax check only and is not a trust or ownership verification.',
        'VERIFIED',
        'info',
        'VERA address validator',
        { chain: this.chain, address },
      ),
      evidence(
        'evm-native-balance',
        'Native asset balance retrieved',
        `The RPC returned a native balance of ${formatNativeBalance(balance)} ${config.nativeCurrency.symbol}. Balances can change and are not a security verdict.`,
        'VERIFIED',
        'info',
        'EVM eth_getBalance',
        { chain: this.chain, address, balanceWei: BigInt(balance).toString(), symbol: config.nativeCurrency.symbol },
      ),
      contractCodeEvidence(code, this.chain, address),
      evidence(
        'evm-transaction-count',
        'Transaction count retrieved',
        `The RPC returned a transaction count of ${BigInt(transactionCount).toString()} for this address. This is chain data, not a measure of trustworthiness.`,
        'VERIFIED',
        'info',
        'EVM eth_getTransactionCount',
        { chain: this.chain, address, transactionCount: BigInt(transactionCount).toString() },
      ),
    ].slice(0, MAX_EVIDENCE_ITEMS);
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
    return result;
  }

  async inspectToken(request: TokenInvestigationRequest): Promise<Evidence[]> {
    if (request.chain !== this.chain) throw new Error('Adapter chain does not match the requested chain.');
    if (!ADDRESS_PATTERN.test(request.address.trim())) {
      return [evidence('evm-token-address-invalid', 'Invalid token contract address', 'The supplied value is not a valid EVM address.', 'VERIFIED', 'medium', 'VERA address validator', { chain: this.chain })];
    }

    const result = await this.inspectAddress({ chain: this.chain, address: request.address });
    return [
      ...result,
      evidence(
        'evm-token-deep-analysis-pending',
        'Token-specific risk analysis not yet available',
        'This baseline adapter validates the address and collects chain-level account evidence only. It has not yet checked ERC-20 metadata, transfer restrictions, holder concentration, liquidity, privileged token controls, or honeypot behavior.',
        'UNKNOWN',
        'info',
        'VERA coverage disclosure',
        { chain: this.chain, address: request.address, tokenChecks: 'pending' },
      ),
    ];
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
