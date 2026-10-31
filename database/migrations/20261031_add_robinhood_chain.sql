-- Extend the existing chain identity constraint without rewriting scan data.
-- Existing Solana and EVM chain IDs remain unchanged.
ALTER TABLE scans
  DROP CONSTRAINT IF EXISTS scans_chain_id_check;

ALTER TABLE scans
  ADD CONSTRAINT scans_chain_id_check
  CHECK (chain_id IN ('solana', 'ethereum', 'base', 'bsc', 'arbitrum', 'polygon', 'robinhood'));

CREATE INDEX IF NOT EXISTS scans_chain_id_created_at_idx
  ON scans (chain_id, created_at DESC);
