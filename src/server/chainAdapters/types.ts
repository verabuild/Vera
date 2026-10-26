import type { Evidence } from '../../lib/types.js';
import type { ChainId, EvmChainId } from '../../lib/chains.js';

export interface AddressInvestigationRequest {
  chain: ChainId;
  address: string;
}

export interface TransactionInvestigationRequest {
  chain: ChainId;
  hash: string;
}

export interface TokenInvestigationRequest {
  chain: EvmChainId;
  address: string;
}

export interface ContractInvestigationRequest {
  chain: EvmChainId;
  address: string;
}

/**
 * Read-only adapter boundary for chain-specific investigation.
 *
 * Adapters collect observable evidence only. They must not sign transactions,
 * request private keys, or convert provider failures into "no risk found".
 * Callers should wrap each operation with the existing settled-evidence pattern
 * so an unavailable provider becomes an UNKNOWN evidence item.
 */
export interface ChainInvestigationAdapter {
  readonly chain: ChainId;
  inspectAddress(request: AddressInvestigationRequest): Promise<Evidence[]>;
  inspectTransaction(request: TransactionInvestigationRequest): Promise<Evidence[]>;
}

export interface EvmInvestigationAdapter extends ChainInvestigationAdapter {
  readonly chain: EvmChainId;
  inspectToken(request: TokenInvestigationRequest): Promise<Evidence[]>;
  inspectContract(request: ContractInvestigationRequest): Promise<Evidence[]>;
}
