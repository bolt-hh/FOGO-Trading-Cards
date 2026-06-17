// POST /api/tap-score
// Validates inputs + runs anti-abuse checks in JS, then delegates all DB
// work to the process_tap() Postgres RPC (1 round-trip vs the previous 7).

// ── Kill switch: set to true to pause the game immediately ───────────
// Flip back to false and redeploy to re-open.
const GAME_PAUSED = false;

const SUPABASE_URL        = 'https://nhdktvsllunlgdsaninx.supabase.co';
const TPS                 = 100000;   // Fogo TPS used in fogo_equivalent calc
const MIN_STD_DEV_MS      = 8;        // below this = suspiciously robotic cadence
const MAX_VIRTUAL_FACTOR  = 4.5;      // max legitimate clicks = physical × 4.5 + 50
const MAX_VIRTUAL_ADDITIVE = 50;

// ── Supabase helpers (service role) ────────────────────────────────
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return {
    Authorization:  `Bearer ${key}`,
    apikey:         key,
    'Content-Type': 'application/json',
  };
}

async function sbPost(path, body) {
  const h = { ...sbHeaders(), Prefer: 'return=representation' };
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST', headers: h, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB POST ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Lightweight deterministic hash for IP (no raw IP stored) ───────
function hashIP(ip) {
  let h = 0x811c9dc5;
  for (const c of (ip || '')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Anti-abuse: timestamp analysis ─────────────────────────────────
function analyseTimestamps(ts, clicks, maxCps) {
  const cpsLimit = maxCps || 30;
  if (!Array.isArray(ts) || ts.length < 3) return { flagged: false };

  const serverCount = ts.length;
  if (serverCount > clicks + 5) return { flagged: true, reason: 'timestamp_mismatch' };

  const GAME_DURATION_MS = 10000;
  const gameCps = (ts.length / GAME_DURATION_MS) * 1000;
  if (gameCps > cpsLimit) return { flagged: true, reason: 'rate_exceeded' };

  // Deduplicate burst timestamps (power-up virtual clicks share timestamps)
  const dedupedTs = ts.filter((v, i) => i === 0 || v !== ts[i - 1]);
  if (dedupedTs.length < 3) return { flagged: false };

  // Variance — robotic timing has near-zero std dev
  const intervals = [];
  for (let i = 1; i < dedupedTs.length; i++) intervals.push(dedupedTs[i] - dedupedTs[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < MIN_STD_DEV_MS && dedupedTs.length > 15) {
    return { flagged: true, reason: 'low_variance' };
  }

  // Runs test — detects artificial jitter
  if (intervals.length >= 12) {
    const aboveMean = intervals.map(v => v >= mean ? 1 : -1);
    let runCount = 1;
    for (let i = 1; i < aboveMean.length; i++) {
      if (aboveMean[i] !== aboveMean[i - 1]) runCount++;
    }
    if (runCount > intervals.length * 0.95) {
      return { flagged: true, reason: 'artificial_jitter' };
    }
  }

  return { flagged: false };
}

// ── Main handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Kill switch — returns before any DB interaction
  if (GAME_PAUSED) {
    return res.status(503).json({ ok: false, paused: true, error: 'Game paused for maintenance — back shortly! 🔧' });
  }

  const {
    wallet_address, x_handle, kol_ref,
    clicks, physical_clicks, max_concurrent_fingers,
    duration_ms, click_timestamps, physical_click_timestamps,
    page_load_ts, play_pressed_ts,
  } = req.body || {};

  // ── Input validation ──────────────────────────────────────────────
  if (!wallet_address || typeof wallet_address !== 'string') {
    return res.status(400).json({ error: 'wallet_address required' });
  }
  if (!x_handle || typeof x_handle !== 'string') {
    return res.status(400).json({ error: 'x_handle required' });
  }
  if (typeof clicks !== 'number' || clicks < 0 || clicks > 2000) {
    return res.status(400).json({ error: 'clicks out of range' });
  }
  if (typeof duration_ms !== 'number' || duration_ms < 8000 || duration_ms > 13000) {
    return res.status(400).json({ error: 'duration_ms out of range' });
  }

  // ── IP hash (no raw IP stored) ────────────────────────────────────
  const rawIP  = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
              || req.headers['x-real-ip'] || '';
  const ipHash = hashIP(rawIP);

  // ── Anti-abuse analysis (pure JS, no DB) ─────────────────────────
  // Use physical_click_timestamps when available — excludes power-up virtual clicks.
  const physClicks  = (typeof physical_clicks === 'number' && physical_clicks > 0)
    ? physical_clicks : clicks;
  const tsForAbuse  = (Array.isArray(physical_click_timestamps) && physical_click_timestamps.length > 2)
    ? physical_click_timestamps : click_timestamps;

  // CPS ceiling scales with concurrent finger count (capped at 6)
  const rawFingers      = (typeof max_concurrent_fingers === 'number' && max_concurrent_fingers >= 1)
    ? max_concurrent_fingers : null;
  const fingers         = rawFingers ? Math.min(rawFingers, 6) : null;
  const effectiveMaxCPS = fingers
    ? (fingers >= 4 ? 42 : fingers === 3 ? 32 : fingers === 2 ? 26 : 20)
    : 30;

  const cps = physClicks / (duration_ms / 1000);
  let flagged    = cps > effectiveMaxCPS;
  let flagReason = flagged ? 'rate_exceeded' : null;

  // Honeypot: bot scripts fire almost instantly after page load
  if (!flagged && page_load_ts && play_pressed_ts) {
    if (play_pressed_ts - page_load_ts < 1500) {
      flagged    = true;
      flagReason = 'instant_play';
    }
  }

  // Timestamp statistical analysis
  if (!flagged && tsForAbuse) {
    const check = analyseTimestamps(tsForAbuse, physClicks, effectiveMaxCPS);
    flagged    = check.flagged;
    flagReason = check.reason || null;
  }

  // Virtual click ceiling: max = physical × 4.5 + 50
  if (!flagged && physical_clicks) {
    const maxLegitimate = Math.ceil(physical_clicks * MAX_VIRTUAL_FACTOR) + MAX_VIRTUAL_ADDITIVE;
    if (clicks > maxLegitimate) {
      flagged    = true;
      flagReason = 'virtual_click_inflation';
    }
  }

  const leaderboardEligible = !flagged;
  const handle = x_handle.startsWith('@') ? x_handle : '@' + x_handle;

  // ── Single RPC: IP check + insert + points + stats + rank ─────────
  // Replaces 7 individual DB round-trips with 1 call to process_tap().
  let result;
  try {
    const rows = await sbPost('/rpc/process_tap', {
      p_wallet_address:       wallet_address,
      p_x_handle:             handle,
      p_clicks:               clicks,
      p_physical_clicks:      physical_clicks || null,
      p_duration_ms:          duration_ms,
      p_fogo_equivalent:      Math.floor(clicks * TPS / (duration_ms / 10000)),
      p_ip_hash:              ipHash,
      p_flagged:              flagged,
      p_flag_reason:          flagReason,
      p_leaderboard_eligible: leaderboardEligible,
      p_kol_ref:              kol_ref || null,
    });
    // PostgREST wraps RPC results in an array
    result = Array.isArray(rows) ? rows[0] : rows;
  } catch (err) {
    return res.status(500).json({ error: 'db_error', detail: err.message });
  }

  if (!result?.ok) {
    if (result?.error === 'ip_rate_limit') return res.status(429).json({ error: 'ip_rate_limit' });
    return res.status(500).json({ error: result?.error || 'processing_failed' });
  }

  // Leaderboard refresh is now handled inside process_tap() — no extra call needed.
  return res.status(200).json({
    ok:           true,
    flagged:      result.flagged,
    flag_reason:  result.flag_reason,
    tap_pts:      result.tap_pts,
    total_taps:   result.total_taps,
    best_session: result.best_session,
    rank:         result.rank,
  });
}
