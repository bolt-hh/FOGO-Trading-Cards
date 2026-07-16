// GET /api/activation/ugc — HHP Activation API (see docs/holohive-activation-api.md)
// Auth: Authorization: Bearer <ACTIVATION_API_TOKEN>. Read-only; no spend/cost data.
// Serves: fogo-tradingcard-2026q2 (default) and fogo-pfp-2026q2 via ?activation_id=

const SUPABASE_URL = 'https://nhdktvsllunlgdsaninx.supabase.co';
const ACTS = {
  'fogo-tradingcard-2026q2': 'fogo-tradingcard',
  'fogo-pfp-2026q2': 'fogo-pfp',
};
const DEFAULT_ID = 'fogo-tradingcard-2026q2';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.ACTIVATION_API_TOKEN;
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || got !== expected) return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query.activation_id || DEFAULT_ID;
  const act = ACTS[id];
  if (!act) return res.status(404).json({ error: 'Unknown activation_id' });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(500).json({ error: 'Server not configured' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hhp_activation_ugc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ act }),
    });
    if (!r.ok) throw new Error(`rpc ${r.status}`);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Upstream error' });
  }
}
