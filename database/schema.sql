CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  privy_user_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_user_id TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('url','domain','wallet','token','transaction','message')),
  identifier TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, identifier)
);

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('URL','MESSAGE','WALLET','TX')),
  input_hash TEXT NOT NULL,
  input_preview TEXT NOT NULL,
  network TEXT CHECK (network IN ('mainnet','devnet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high')),
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  claim TEXT NOT NULL,
  evidence_state TEXT NOT NULL CHECK (evidence_state IN ('VERIFIED','SUPPORTED','UNKNOWN')),
  severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
  risk_state TEXT NOT NULL CHECK (risk_state IN ('VERIFIED','SUPPORTED','UNKNOWN','SUSPICIOUS','CONFIRMED_MALICIOUS')),
  confidence TEXT CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
  explanation TEXT NOT NULL,
  ai_explanation TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  user_decision TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scans_input_hash_idx ON scans(input_hash);
CREATE INDEX IF NOT EXISTS signals_entity_idx ON signals(entity_id);
CREATE INDEX IF NOT EXISTS evidence_scan_idx ON evidence(scan_id);
CREATE INDEX IF NOT EXISTS actions_scan_idx ON actions(scan_id);

CREATE TABLE IF NOT EXISTS usage_counters (
  subject_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_id, period_key)
);
