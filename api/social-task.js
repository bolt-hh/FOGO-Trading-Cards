// POST /api/social-task
// Records a self-reported social follow and awards 200 tap_pts to card_submissions.
// One-time per wallet per task_id — idempotent if already completed.

const SUPABASE_URL = 'https://nhdktvsllunlgdsaninx.supabase.co';
const POINTS_PER_FOLLOW = 200;

const VALID_TASKS = new Set([
  'follow_fogo',
  'follow_valiant',
  'follow_ignition',
  'follow_brasa',
  'follow_pyron',
]);

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return {
    Authorization:  `Bearer ${key}`,
    apikey:         key,
    'Content-Type': 'application/json',
  };
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`SB GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPatch(path, body) {
  const h = { ...sbHeaders(), Prefer: 'return=minimal' };
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH', headers: h, body: JSON.stringify(body),
  });
  if (!r.ok && r.status !== 204) {
    throw new Error(`SB PATCH ${path} → ${r.status}: ${await r.text()}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet_address, task_id } = req.body || {};

  if (!wallet_address || typeof wallet_address !== 'string') {
    return res.status(400).json({ error: 'wallet_address required' });
  }
  if (!task_id || !VALID_TASKS.has(task_id)) {
    return res.status(400).json({ error: 'invalid task_id' });
  }

  // Fetch current card_submissions row
  const rows = await sbGet(
    `/card_submissions?wallet_address=eq.${encodeURIComponent(wallet_address)}&select=total_points,tap_points,points_breakdown`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(404).json({ error: 'wallet not registered' });
  }

  const sub = rows[0];
  const breakdown = sub.points_breakdown || {};
  const existingFollows = Array.isArray(breakdown.social_follows) ? breakdown.social_follows : [];

  // Idempotent — already completed
  if (existingFollows.includes(task_id)) {
    return res.status(200).json({ ok: true, already_done: true, total_points: sub.total_points });
  }

  // Award points
  const newFollows   = [...existingFollows, task_id];
  const newBreakdown = { ...breakdown, social_follows: newFollows };
  const newTotal     = (sub.total_points || 0) + POINTS_PER_FOLLOW;

  await sbPatch(
    `/card_submissions?wallet_address=eq.${encodeURIComponent(wallet_address)}`,
    {
      total_points:     newTotal,
      entry_count:      newTotal,
      points_breakdown: newBreakdown,
    }
  );

  return res.status(200).json({
    ok:           true,
    task_id,
    pts_awarded:  POINTS_PER_FOLLOW,
    total_points: newTotal,
    follows_done: newFollows.length,
  });
}
