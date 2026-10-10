import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPersistedScan } from '../src/server/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)) {
    return res.status(400).json({ error: 'Enter a valid Investigation ID.' });
  }

  try {
    const scan = await getPersistedScan(id);
    if (!scan) return res.status(404).json({ error: 'No saved investigation was found for that ID.' });
    return res.status(200).json({ scan });
  } catch (error) {
    console.error('VERA investigation lookup error', error);
    return res.status(503).json({ error: 'Investigation lookup is temporarily unavailable. Please try again.' });
  }
}
