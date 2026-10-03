import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import type { Assessment, InputType, Network } from '../lib/types';

let pool: Pool | null = null;
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  pool ||= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  return pool;
}

export async function persistScan(scanId: string, inputType: InputType, input: string, network: Network, assessment: Assessment) {
  const db = getPool();
  if (!db) return;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inputHash = createHash('sha256').update(input).digest('hex');
    await client.query(`INSERT INTO scans(id,input_type,input_hash,input_preview,network) VALUES($1,$2,$3,$4,$5)`, [scanId, inputType, inputHash, input.slice(0, 500), network]);
    const assessmentRow = await client.query(`INSERT INTO assessments(scan_id,risk_state,confidence,explanation,ai_explanation,action) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [scanId, assessment.state, assessment.confidence ?? null, assessment.explanation, assessment.aiExplanation ?? null, assessment.action]);
    for (const item of assessment.evidence) {
      await client.query(`INSERT INTO evidence(scan_id,source,claim,evidence_state,severity,metadata) VALUES($1,$2,$3,$4,$5,$6)`, [scanId, item.source, `${item.title}: ${item.detail}`, item.state, item.severity, JSON.stringify(item.metadata ?? {})]);
    }
    await client.query('COMMIT');
    return assessmentRow.rows[0]?.id as string | undefined;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}