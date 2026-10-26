import type { Network } from './types.js';

/**
 * Stable chain identifiers for investigation routing.
 *
 * Keep the existing Solana Network ('mainnet' | 'devnet') type intact:
 * legacy Solana requests and persisted reports depend on that contract.
 * New multichain flows should use ChainId instead.
 */
export type ChainFamily = 'solana' | 'evm';

export type EvmChainId =
  | 'ethereum'
  | 'base'
  | 'bsc'
  | 'arbitrum'
  | 'polygon';

export type ChainId = 'solana' | EvmChainId;

export type ChainAvailability =
  | 'available'
  | 'planned'
  | 'configuration_required';

export interface ChainConfig {
  id: ChainId;
  family: ChainFamily;
  name: string;
  chainId?: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl: string;
  /** Server-side environment variable name; never the secret value. */
  rpcEnvVar?: string;
  availability: ChainAvailability;
  /** Only true after end-to-end checks and regression tests pass. */
  enabledForInvestigation: boolean;
}

export const CHAIN_REGISTRY: Readonly<Record<ChainId, ChainConfig>> = {
  solana: {
    id: 'solana',
    family: 'solana',
    name: 'Solana',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    explorerUrl: 'https://explorer.solana.com',
    availability: 'available',
    enabledForInvestigation: true,
  },
  ethereum: {
    id: 'ethereum',
    family: 'evm',
    name: 'Ethereum Mainnet',
    chainId: 1,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://etherscan.io',
    rpcEnvVar: 'EVM_ETHEREUM_RPC_URL',
    availability: 'planned',
    enabledForInvestigation: false,
  },
  base: {
    id: 'base',
    family: 'evm',
    name: 'Base',
    chainId: 8453,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://basescan.org',
    rpcEnvVar: 'EVM_BASE_RPC_URL',
    availability: 'planned',
    enabledForInvestigation: false,
  },
  bsc: {
    id: 'bsc',
    family: 'evm',
    name: 'BNB Smart Chain',
    chainId: 56,
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    explorerUrl: 'https://bscscan.com',
    rpcEnvVar: 'EVM_BSC_RPC_URL',
    availability: 'planned',
    enabledForInvestigation: false,
  },
  arbitrum: {
    id: 'arbitrum',
    family: 'evm',
    name: 'Arbitrum One',
    chainId: 42161,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://arbiscan.io',
    rpcEnvVar: 'EVM_ARBITRUM_RPC_URL',
    availability: 'planned',
    enabledForInvestigation: false,
  },
  polygon: {
    id: 'polygon',
    family: 'evm',
    name: 'Polygon PoS',
    chainId: 137,
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    explorerUrl: 'https://polygonscan.com',
    rpcEnvVar: 'EVM_POLYGON_RPC_URL',
    availability: 'planned',
    enabledForInvestigation: false,
  },
};

export function getChainConfig(chainId: ChainId): ChainConfig {
  return CHAIN_REGISTRY[chainId];
}

export function isEvmChainId(value: string): value is EvmChainId {
  return value === 'ethereum'
    || value === 'base'
    || value === 'bsc'
    || value === 'arbitrum'
    || value === 'polygon';
}

/**
 * Legacy compatibility helper. Solana network selection is intentionally
 * separate from multichain identity until the API migration is implemented.
 */
export function isLegacySolanaNetwork(value: string): value is Network {
  return value === 'mainnet' || value === 'devnet';
}
