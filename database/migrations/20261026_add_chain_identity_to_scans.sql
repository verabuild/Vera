-- Safe, additive migration: existing scans are assigned to the legacy Solana chain.
-- The legacy network column remains constrained to mainnet/devnet for compatibility.
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS chain_id TEXT NOT NULL DEFAULT 'solana'
  CHECK (chain_id IN ('solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'polygon'));

CREATE INDEX IF NOT EXISTS scans_chain_id_created_at_idx
  ON scans (chain_id, created_at DESC);
