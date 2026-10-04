-- Run this once against the existing Neon database before deploying Privy-backed scans.
ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_privy_user_id_unique_idx
  ON users(privy_user_id)
  WHERE privy_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_counters (
  subject_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_id, period_key)
);
