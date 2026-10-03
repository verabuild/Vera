import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import type { Assessment, InputType, Network } from '../lib/types.js';

let pool: Pool | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;

  pool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
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

export async function persistScan(
  scanId: string,
  inputType: InputType,
  input: string,
  network: Network,
  assessment: Assessment
) {
  const db = getPool();
  if (!db) return;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const inputHash = createHash('sha256').update(input).digest('hex');

    await client.query(
      `INSERT INTO scans(id,input_type,input_hash,input_preview,network)
       VALUES($1,$2,$3,$4,$5)`,
      [scanId, inputType, inputHash, input.slice(0, 500), network]
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
