import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import type { Assessment, InputType, Network } from '../lib/types.js';

let pool: Pool | null = null;
let usageSchemaPromise: Promise<void> | null = null;
let scanReportSchemaPromise: Promise<void> | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;

  pool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 8000,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false }
  });

  return pool;
}

function entityType(inputType: InputType) {
  switch (inputType) {
    case 'URL': return 'url';
    case 'MESSAGE': return 'message';
    case 'WALLET': return 'wallet';
    case 'TX': return 'transaction';
  }
}

function entityIdentifier(inputType: InputType, input: string) {
  // Messages and transaction payloads are sensitive user inputs.
  // Store a deterministic hash rather than the raw content.
  if (inputType === 'MESSAGE' || inputType === 'TX') {
    return createHash('sha256').update(input).digest('hex');
  }

  return input;
}

async function ensureUsageSchema(db: Pool) {
  usageSchemaPromise ||= db.query(
    'CREATE TABLE IF NOT EXISTS usage_counters (' +
    'subject_id TEXT NOT NULL, ' +
    'period_key TEXT NOT NULL, ' +
    'usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0), ' +
    'updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
    'PRIMARY KEY(subject_id, period_key)' +
    ')'
  ).then(() => undefined).catch((error) => {
    usageSchemaPromise = null;
    throw error;
  });

  return usageSchemaPromise;
}

export async function consumeUsageQuota(subjectId: string, periodKey: string, limit: number) {
  const db = getPool();
  if (!db) throw new Error('Database unavailable');

  await ensureUsageSchema(db);

  const result = await db.query(
    `INSERT INTO usage_counters(subject_id, period_key, usage_count) VALUES($1,$2,1)
     ON CONFLICT(subject_id, period_key) DO UPDATE
       SET usage_count = usage_counters.usage_count + 1, updated_at = now()
       WHERE usage_counters.usage_count < $3
     RETURNING usage_count`,
    [subjectId, periodKey, limit]
  );

  if (!result.rows.length) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: Math.max(0, limit - Number(result.rows[0].usage_count)) };
}

export async function getPersistedScan(scanId: string) {
  const db = getPool();
  if (!db) throw new Error('Database unavailable');

  scanReportSchemaPromise ||= db.query(
    'ALTER TABLE scans ADD COLUMN IF NOT EXISTS report_json JSONB'
  ).then(() => undefined).catch((error) => {
    scanReportSchemaPromise = null;
    throw error;
  });
  await scanReportSchemaPromise;

  const result = await db.query(
    'SELECT report_json FROM scans WHERE id = $1 LIMIT 1',
    [scanId]
  );
  const report = result.rows[0]?.report_json;
  if (!report || typeof report !== 'object') return null;
  return report;
}

export async function persistScan(
  scanId: string,
  inputType: InputType,
  input: string,
  network: Network,
  assessment: Assessment,
  privyUserId?: string
) {
  const db = getPool();
  if (!db) return;

  scanReportSchemaPromise ||= db.query('ALTER TABLE scans ADD COLUMN IF NOT EXISTS report_json JSONB').then(() => undefined).catch((error) => { scanReportSchemaPromise = null; throw error; });
  await scanReportSchemaPromise;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    let userId: string | null = null;
    if (privyUserId) {
      const userResult = await client.query(
        `INSERT INTO users(privy_user_id)
         VALUES($1)
         ON CONFLICT(privy_user_id) DO UPDATE SET privy_user_id = EXCLUDED.privy_user_id
         RETURNING id`,
        [privyUserId]
      );
      userId = userResult.rows[0]?.id as string | undefined ?? null;
    }

    const inputHash = createHash('sha256').update(input).digest('hex');
    const preview = inputType === 'MESSAGE'
      ? '[message content redacted]'
      : inputType === 'TX'
        ? '[transaction input redacted]'
        : input.slice(0, 500);

    await client.query(
      `INSERT INTO scans(id,user_id,input_type,input_hash,input_preview,network,report_json)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [scanId, userId, inputType, inputHash, preview, network, JSON.stringify({ id: scanId, type: inputType, input: preview, createdAt: new Date().toISOString(), assessment })]
    );

    const entityResult = await client.query(
      `INSERT INTO entities(entity_type,identifier)
       VALUES($1,$2)
       ON CONFLICT(entity_type,identifier)
       DO UPDATE SET last_updated = now()
       RETURNING id`,
      [entityType(inputType), entityIdentifier(inputType, input)]
    );

    const entityId = entityResult.rows[0]?.id as string | undefined;

    const assessmentResult = await client.query(
      `INSERT INTO assessments
       (scan_id,risk_state,confidence,explanation,ai_explanation,action)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        scanId,
        assessment.state,
        assessment.confidence ?? null,
        assessment.explanation,
        assessment.aiExplanation ?? null,
        assessment.action
      ]
    );

    for (const item of assessment.evidence) {
      let signalId: string | null = null;

      if (entityId) {
        const signalResult = await client.query(
          `INSERT INTO signals(entity_id,signal_type,severity,value,source)
           VALUES($1,$2,$3,$4,$5)
           RETURNING id`,
          [
            entityId,
            item.id,
            item.severity,
            JSON.stringify({
              title: item.title,
              detail: item.detail,
              state: item.state,
              ...(item.metadata ?? {})
            }),
            item.source
          ]
        );

        signalId = signalResult.rows[0]?.id ?? null;
      }

      await client.query(
        `INSERT INTO evidence
         (scan_id,signal_id,source,claim,evidence_state,severity,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          scanId,
          signalId,
          item.source,
          `${item.title}: ${item.detail}`,
          item.state,
          item.severity,
          JSON.stringify(item.metadata ?? {})
        ]
      );
    }

    await client.query(
      `INSERT INTO actions(scan_id,action_type)
       VALUES($1,$2)`,
      [scanId, assessment.action]
    );

    await client.query('COMMIT');

    return assessmentResult.rows[0]?.id as string | undefined;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
