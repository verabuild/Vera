import { Connection, PublicKey } from '@solana/web3.js';
import type { Evidence, Network } from '../lib/types.js';

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
    { id: 'wallet-tokens', title: 'Token accounts discovered', detail: `${tokenAccounts.value.length} SPL token accounts and ${token2022Accounts.value.length} Token-2022 accounts were returned. This is inventory data, not a safety judgment.`, severity: 'info', source: 'Solana RPC', state: 'VERIFIED', observedAt, metadata: { count: tokenAccounts.value.length, token2022Count: token2022Accounts.value.length } },\n    { id: 'wallet-delegates', title: 'Delegated token permissions observed', detail: delegated ? `${delegated} token account(s) currently expose a delegate. Delegation can permit another account to transfer tokens within the approved rules, so it deserves review before interacting with those assets.` : 'No active token-account delegates were observed in the returned SPL and Token-2022 inventory.', severity: delegated ? 'medium' : 'info', source: 'Solana RPC parsed token accounts', state: 'VERIFIED', observedAt, metadata: { delegatedAccounts: delegated } },\n    { id: 'wallet-activity', title: 'Recent on-chain activity', detail: `${recentSignatures.length} recent transaction signature(s) were returned for this address. This is a recent-activity snapshot, not a complete transaction history.`, severity: 'info', source: 'Solana RPC', state: recentSignatures.length ? 'VERIFIED' : 'UNKNOWN', observedAt, metadata: { count: recentSignatures.length, signatures: recentSignatures.slice(0, 10).map((item) => ({ signature: item.signature, slot: item.slot, blockTime: item.blockTime, err: item.err })) } }
  ];
}

function isBase58Signature(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value.trim());
}

function parsedInstructionSummary(instruction: unknown) {
  if (!instruction || typeof instruction !== 'object') return null;
  const item = instruction as Record<string, unknown>;
  const program = typeof item.program === 'string' ? item.program : undefined;
  const programId = typeof item.programId === 'string' ? item.programId : undefined;
  const parsed = item.parsed;
  if (!parsed || typeof parsed !== 'object') return { program, programId };
  const parsedRecord = parsed as Record<string, unknown>;
  const type = typeof parsedRecord.type === 'string' ? parsedRecord.type : undefined;
  const info = parsedRecord.info;
  if (!info || typeof info !== 'object') return { program, programId, type };
  const infoRecord = info as Record<string, unknown>;
  const amount = typeof infoRecord.lamports === 'number'
    ? infoRecord.lamports
    : typeof infoRecord.amount === 'string'
      ? Number(infoRecord.amount)
      : undefined;
  const source = typeof infoRecord.source === 'string' ? infoRecord.source : undefined;
  const destination = typeof infoRecord.destination === 'string' ? infoRecord.destination : undefined;
  const mint = typeof infoRecord.mint === 'string' ? infoRecord.mint : undefined;
  return { program, programId, type, amount: Number.isFinite(amount) ? amount : undefined, source, destination, mint };
}

export async function inspectTransaction(signature: string, network: Network): Promise<Evidence[]> {
  const observedAt = new Date().toISOString();
  const trimmed = signature.trim();
  if (!isBase58Signature(trimmed)) {
    return [{
      id: 'tx-invalid-signature',
      title: 'Transaction signature format is invalid',
      detail: 'VERA expects a Solana transaction signature in base58 format. It does not accept a private key, seed phrase, or wallet secret.',
      severity: 'high',
      source: 'VERA transaction parser',
      state: 'VERIFIED',
      observedAt
    }];
  }

  try {
    const connection = new Connection(rpcUrl(network), 'confirmed');
    const tx = await connection.getParsedTransaction(trimmed, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return [{
        id: 'tx-not-found',
        title: 'Transaction was not found',
        detail: `No parsed transaction was returned for this signature on Solana ${network}. The transaction may not exist on this network, may be too recent for the selected RPC, or may be unavailable from this provider.`,
        severity: 'medium',
        source: 'Solana RPC',
        state: 'UNKNOWN',
        observedAt,
        metadata: { signature: trimmed, network }
      }];
    }

    const message = tx.transaction.message;
    const rawInstructions = message.instructions.map(parsedInstructionSummary).filter(Boolean);
    const programIds = [...new Set(rawInstructions.map((item) => item?.programId).filter((value): value is string => Boolean(value)))];
    const programs = [...new Set(rawInstructions.map((item) => item?.program).filter((value): value is string => Boolean(value)))];
    const signers = message.accountKeys.filter((account) => account.signer).map((account) => account.pubkey.toBase58());
    const feeLamports = tx.meta?.fee ?? 0;
    const failed = tx.meta?.err !== null && tx.meta?.err !== undefined;
    const logs = tx.meta?.logMessages ?? [];
    const transferInstructions = rawInstructions.filter((item) =>
      item?.type === 'transfer' || item?.type === 'transferChecked'
    );
    const tokenTransfers = transferInstructions.filter((item) => Boolean(item?.mint));
    const nativeTransfers = transferInstructions.filter((item) => !item?.mint && typeof item?.amount === 'number');

    const evidence: Evidence[] = [
      {
        id: 'tx-signature-verified',
        title: 'Transaction exists on Solana',
        detail: `VERA retrieved a parsed transaction for this signature on ${network}. This proves the signature resolves to a chain record; it does not prove the transaction intent was safe.`,
        severity: 'info',
        source: 'Solana RPC',
        state: 'VERIFIED',
        observedAt,
        metadata: { signature: trimmed, slot: tx.slot, blockTime: tx.blockTime, network }
      },
      {
        id: 'tx-status',
        title: failed ? 'Transaction execution failed' : 'Transaction execution succeeded',
        detail: failed
          ? 'The transaction record contains a runtime error. A failed transaction does not by itself prove malicious intent, but it is important context when assessing what the signer attempted.'
          : 'The transaction was processed without a runtime error. Successful execution does not establish that the signer received the intended outcome or that the interaction was safe.',
        severity: failed ? 'high' : 'info',
        source: 'Solana transaction metadata',
        state: 'VERIFIED',
        observedAt,
        metadata: { error: tx.meta?.err ?? null }
      },
      {
        id: 'tx-signers',
        title: `${signers.length} signer(s) identified`,
        detail: signers.length
          ? `The transaction required signatures from: ${signers.join(', ')}.`
          : 'No signer account was exposed by the parsed message.',
        severity: 'info',
        source: 'Solana transaction message',
        state: 'VERIFIED',
        observedAt,
        metadata: { signers }
      },
      {
        id: 'tx-programs',
        title: `${programIds.length || programs.length} program(s) referenced`,
        detail: programIds.length
          ? `Referenced program IDs: ${programIds.join(', ')}.`
          : `Parsed program labels: ${programs.join(', ') || 'none available'}.`,
        severity: programIds.length > 4 ? 'medium' : 'info',
        source: 'Solana transaction message',
        state: 'VERIFIED',
        observedAt,
        metadata: { programIds, programs, instructionCount: message.instructions.length }
      },
      {
        id: 'tx-fee',
        title: 'Transaction fee observed',
        detail: `${(feeLamports / 1e9).toFixed(9)} SOL fee was recorded for this transaction.`,
        severity: 'info',
        source: 'Solana transaction metadata',
        state: 'VERIFIED',
        observedAt,
        metadata: { lamports: feeLamports }
      }
    ];

    if (nativeTransfers.length || tokenTransfers.length) {
      evidence.push({
        id: 'tx-transfers',
        title: `${nativeTransfers.length + tokenTransfers.length} parsed transfer instruction(s)`,
        detail: `VERA identified ${nativeTransfers.length} native SOL transfer(s) and ${tokenTransfers.length} token transfer instruction(s) in the parsed message. Review the source, destination, asset and amount before treating the transaction as expected.`,
        severity: 'medium',
        source: 'Solana parsed instructions',
        state: 'VERIFIED',
        observedAt,
        metadata: { nativeTransfers, tokenTransfers }
      });
    }

    if (logs.length) {
      evidence.push({
        id: 'tx-program-logs',
        title: 'Program execution logs available',
        detail: `Solana returned ${logs.length} runtime log message(s). Logs can reveal which programs executed and where an instruction failed, but they do not establish user intent.`,
        severity: 'info',
        source: 'Solana transaction metadata',
        state: 'VERIFIED',
        observedAt,
        metadata: { logs: logs.slice(0, 80) }
      });
    }

    return evidence;
  } catch (error) {
    return [{
      id: 'tx-lookup-unavailable',
      title: 'Transaction lookup failed',
      detail: `VERA could not retrieve or parse this transaction from the selected Solana RPC (${error instanceof Error ? error.name : 'network error'}). This is an unavailable check, not evidence that the transaction is safe or malicious.`,
      severity: 'medium',
      source: 'Solana RPC',
      state: 'UNKNOWN',
      observedAt,
      metadata: { network, lookupFailed: true }
    }];
  }
}
