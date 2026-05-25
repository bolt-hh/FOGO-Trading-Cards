// GET /api/tap-leaderboard
// Returns the top 25 players ranked by cumulative (all-time) taps,
// plus the top 10 single-session bests.
// Uses the tap_leaderboard view created by tap_scores_migration.sql.

const SUPABASE_URL = 'https://nhdktvsllunlgdsaninx.supabase.co';

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return {
    Authorization: `Bearer ${key}`,
    apikey:        key,
    'Content-Type': 'application/json',
  };
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`SB GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional wallet param to include caller's position if outside top 25
  const callerWallet = req.query.wallet || null;

  // ── Cumulative leaderboard (top 25) ──
  const top = await sbGet(
    '/tap_leaderboard?select=wallet_address,x_handle,total_taps,best_session,total_plays,last_played&order=total_taps.desc&limit=25'
  );

  // ── Best single sessions (top 10) ──
  const sessions = await sbGet(
    '/tap_scores?flagged=eq.false&select=wallet_address,x_handle,clicks,played_at&order=clicks.desc&limit=10'
  );

  // ── Caller's own row (if outside top 25) ──
  let callerRow = null;
  if (callerWallet && Array.isArray(top)) {
    const inTop = top.some(r => r.wallet_address === callerWallet);
    if (!inTop) {
      const rows = await sbGet(
        `/tap_leaderboard?wallet_address=eq.${encodeURIComponent(callerWallet)}&select=wallet_address,x_handle,total_taps,best_session,total_plays`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        // Count how many players are ahead
        const ahead = await sbGet(
          `/tap_leaderboard?total_taps=gt.${rows[0].total_taps}&select=wallet_address`
        );
        callerRow = {
          ...rows[0],
          rank: Array.isArray(ahead) ? ahead.length + 1 : null,
        };
      }
    }
  }

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  return res.status(200).json({
    cumulative:   Array.isArray(top)      ? top      : [],
    sessions:     Array.isArray(sessions) ? sessions : [],
    caller:       callerRow,
    generated_at: new Date().toISOString(),
  });
}
