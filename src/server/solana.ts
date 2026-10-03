import { Connection, PublicKey } from '@solana/web3.js';
import type { Evidence, Network } from '../lib/types';

export function rpcUrl(network: Network) {
  return network === 'devnet'
    ? (process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com')
    : (process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet.solana.com');
}

export async function inspectWallet(address: string, network: Network): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  const connection = new Connection(rpcUrl(network), 'confirmed');
  let pubkey: PublicKey;
  try { pubkey = new PublicKey(address); } catch {
    return [{ id: 'wallet-invalid', title: 'Invalid Solana address', detail: 'The supplied value is not a valid Solana public key.', severity: 'high', source: 'Solana RPC / PublicKey parser', state: 'VERIFIED', observedAt }];
  }
  const [balance, account, tokenAccounts] = await Promise.all([
    connection.getBalance(pubkey),
    connection.getAccountInfo(pubkey),
    connection.getParsedTokenAccountsByOwner(pubkey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') })
  ]);
  return [
    { id: 'wallet-address', title: 'Address is valid', detail: `Valid Solana public key on ${network}.`, severity: 'info', source: 'Solana RPC', state: 'VERIFIED', observedAt },
    { id: 'wallet-balance', title: 'Native SOL balance', detail: `${(balance / 1e9).toFixed(9)} SOL.`, severity: 'info', source: 'Solana RPC', state: 'VERIFIED', observedAt, metadata: { lamports: balance } },
    { id: 'wallet-account', title: 'Account status', detail: account ? `Account exists with owner ${account.owner.toBase58()}.` : 'No system account data was returned for this address.', severity: 'info', source: 'Solana RPC', state: 'VERIFIED', observedAt },
    { id: 'wallet-tokens', title: 'Token accounts discovered', detail: `${tokenAccounts.value.length} SPL token accounts were returned. This is inventory data, not a safety judgment.`, severity: 'info', source: 'Solana RPC', state: 'VERIFIED', observedAt, metadata: { count: tokenAccounts.value.length } }
  ];
}