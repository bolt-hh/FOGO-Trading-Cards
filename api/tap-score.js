// POST /api/tap-score
// Records a Speed Run play. Validates anti-abuse, inserts into tap_scores,
// and awards tap_pts to card_submissions (10 clicks = 1 point).

const SUPABASE_URL   = 'https://nhdktvsllunlgdsaninx.supabase.co';
const TPS            = 100000;    // Fogo TPS used in punchline calc
const MAX_CPS        = 15;        // clicks/sec above this = flagged (human physiological ceiling ~16 CPS)
const MIN_STD_DEV_MS = 8;         // below this = suspiciously robotic cadence
const MAX_PLAYS_DAY  = 200;       // hard ceiling per wallet per calendar day
const MAX_PLAYS_HOUR = 30;        // IP-level rate limit

// ── Supabase helpers (service role) ──────────────────────────────
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return {
    Authorization:   `Bearer ${key}`,
    apikey:          key,
    'Content-Type':  'application/json',
  };
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`SB GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPost(path, body) {
  const h = { ...sbHeaders(), Prefer: 'return=representation' };
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST', headers: h, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB POST ${path} → ${r.status}: ${await r.text()}`);
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

// ── Lightweight deterministic hash for IP (no raw IP stored) ─────
function hashIP(ip) {
  let h = 0x811c9dc5;
  for (const c of (ip || '')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Tap point helpers (not exposed to client) ────────────────────

// Diminishing returns: first 1,000 taps in 24hrs → 1pt/10 taps
// Beyond 1,000 taps → 1pt/20 taps. Threshold is invisible to users.
const TAP_DIM_THRESHOLD = 1000;
const TAP_RATE_NORMAL   = 10;   // taps per point (standard)
const TAP_RATE_DIM      = 20;   // taps per point (diminished)

async function calcTapPts(walletAddress, newClicks) {
  const dayAgo = new Date(Date.now() - 86400000);
  try {
    const recent = await sbGet(
      `/tap_scores?wallet_address=eq.${encodeURIComponent(walletAddress)}&played_at=gte.${dayAgo.toISOString()}&flagged=eq.false&select=clicks`
    );
    const tapsSoFar = Array.isArray(recent)
      ? recent.reduce((s, r) => s + (r.clicks || 0), 0)
      : 0;

    if (tapsSoFar >= TAP_DIM_THRESHOLD) {
      // Entire session at diminished rate
      return Math.floor(newClicks / TAP_RATE_DIM);
    }
    const normalTaps = Math.min(newClicks, TAP_DIM_THRESHOLD - tapsSoFar);
    const dimTaps    = newClicks - normalTaps;
    return Math.floor(normalTaps / TAP_RATE_NORMAL) + Math.floor(dimTaps / TAP_RATE_DIM);
  } catch (_) {
    // Fallback to standard rate if DB lookup fails
    return Math.floor(newClicks / TAP_RATE_NORMAL);
  }
}

// On-chain volume multiplier (applied on top of diminishing returns)
function volMultiplier(volUsd) {
  if (!volUsd || volUsd < 100)  return 1.0;   // no meaningful on-chain activity
  if (volUsd < 1000)            return 1.5;   // Spot Accumulator tier
  return 2.0;                                  // Tactical Trader and above
}

// ── Anti-abuse checks ─────────────────────────────────────────────
function analyseTimestamps(ts, clicks) {
  if (!Array.isArray(ts) || ts.length < 3) return { flagged: false };

  // Server-side recount — client click count must match timestamp array length
  const serverCount = ts.length;
  if (Math.abs(serverCount - clicks) > 3) {
    return { flagged: true, reason: 'timestamp_mismatch' };
  }

  // Click rate
  const spanMs = ts[ts.length - 1] - ts[0];
  if (spanMs > 0) {
    const cps = (ts.length / spanMs) * 1000;
    if (cps > MAX_CPS) return { flagged: true, reason: 'rate_exceeded' };
  }

  // Variance — robotic timing has near-zero std dev
  const intervals = [];
  for (let i = 1; i < ts.length; i++) intervals.push(ts[i] - ts[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < MIN_STD_DEV_MS && clicks > 15) {
    return { flagged: true, reason: 'low_variance' };
  }

  // Runs test — detects artificial jitter (bots that add ±Nms noise to fake randomness)
  // Real humans have genuinely messy cadence; bots that randomise intervals tend to
  // alternate above/below the mean in a perfectly regular pattern.
  if (intervals.length >= 12) {
    const aboveMean = intervals.map(v => v >= mean ? 1 : -1);
    let runCount = 1;
    for (let i = 1; i < aboveMean.length; i++) {
      if (aboveMean[i] !== aboveMean[i - 1]) runCount++;
    }
    // More than 95% of transitions alternating = machine-like jitter
    // (85% was too aggressive — real humans self-correct their pace, naturally
    //  producing above/below-mean alternations that easily exceeded the old threshold)
    if (runCount > intervals.length * 0.95) {
      return { flagged: true, reason: 'artificial_jitter' };
    }
  }

  return { flagged: false };
}

// ── Main handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet_address, x_handle, kol_ref, clicks, duration_ms, click_timestamps,
          page_load_ts, play_pressed_ts } = req.body || {};

  // ── Input validation ──
  if (!wallet_address || typeof wallet_address !== 'string') {
    return res.status(400).json({ error: 'wallet_address required' });
  }
  if (!x_handle || typeof x_handle !== 'string') {
    return res.status(400).json({ error: 'x_handle required' });
  }
  if (typeof clicks !== 'number' || clicks < 0 || clicks > 500) {
    return res.status(400).json({ error: 'clicks out of range' });
  }
  if (typeof duration_ms !== 'number' || duration_ms < 8000 || duration_ms > 13000) {
    return res.status(400).json({ error: 'duration_ms out of range' });
  }

  // ── Rate limiting: wallet-level (plays per day) ──
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const todayPlays = await sbGet(
    `/tap_scores?wallet_address=eq.${encodeURIComponent(wallet_address)}&played_at=gte.${dayStart.toISOString()}&select=id`
  );
  if (Array.isArray(todayPlays) && todayPlays.length >= MAX_PLAYS_DAY) {
    return res.status(429).json({ error: 'daily_limit_reached' });
  }

  // ── Rate limiting: IP-level (plays per hour) ──
  const rawIP = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
             || req.headers['x-real-ip'] || '';
  const ipHash = hashIP(rawIP);

  const hourAgo = new Date(Date.now() - 3600_000);
  const recentByIP = await sbGet(
    `/tap_scores?ip_hash=eq.${ipHash}&played_at=gte.${hourAgo.toISOString()}&select=id`
  );
  if (Array.isArray(recentByIP) && recentByIP.length >= MAX_PLAYS_HOUR) {
    return res.status(429).json({ error: 'ip_rate_limit' });
  }

  // ── Anti-abuse analysis ──
  const cps = clicks / (duration_ms / 1000);
  let flagged    = cps > MAX_CPS;
  let flagReason = flagged ? 'rate_exceeded' : null;

  // Layer 4 — page load honeypot: bot scripts fire almost instantly after load
  if (!flagged && page_load_ts && play_pressed_ts) {
    const prePlayMs = play_pressed_ts - page_load_ts;
    if (prePlayMs < 1500) {
      flagged    = true;
      flagReason = 'instant_play';
    }
  }

  if (!flagged && click_timestamps) {
    const check = analyseTimestamps(click_timestamps, clicks);
    flagged    = check.flagged;
    flagReason = check.reason || null;
  }

  // ── Insert into tap_scores ──
  const handle = x_handle.startsWith('@') ? x_handle : '@' + x_handle;
  await sbPost('/tap_scores', {
    wallet_address,
    x_handle:         handle,
    clicks,
    duration_ms,
    fogo_equivalent:  Math.floor(clicks * TPS / (duration_ms / 10000)),
    click_timestamps: click_timestamps || null,
    ip_hash:          ipHash,
    flagged,
    flag_reason:      flagReason,
  });

  // ── Award points to card_submissions (only if clean play) ──
  // Compute tap points with diminishing returns + on-chain volume multiplier
  const basePts = await calcTapPts(wallet_address, clicks);
  let   tapPts  = basePts; // will be adjusted by multiplier after fetching vol

  if (!flagged && basePts > 0) {
    let subs = await sbGet(
      `/card_submissions?wallet_address=eq.${encodeURIComponent(wallet_address)}&select=total_points,tap_points,entry_count,points_breakdown,total_volume_usd`
    );

    // ── Auto-register: new wallet arriving via play.html direct flow ──
    if (!Array.isArray(subs) || subs.length === 0) {
      try {
        const handle = x_handle.startsWith('@') ? x_handle : '@' + x_handle;
        await sbPost('/card_submissions', {
          wallet_address,
          x_handle:        handle,
          kol_ref:         kol_ref || null,
          total_points:    0,
          tap_points:      0,
          entry_count:     0,
          points_breakdown: {},
          registered_via:  'speed_run',
        });
        subs = [{ total_points: 0, tap_points: 0, entry_count: 0, points_breakdown: {}, total_volume_usd: 0 }];
      } catch (_) {
        // If insert fails (e.g. duplicate), re-fetch
        subs = await sbGet(
          `/card_submissions?wallet_address=eq.${encodeURIComponent(wallet_address)}&select=total_points,tap_points,entry_count,points_breakdown,total_volume_usd`
        );
      }
    }

    if (Array.isArray(subs) && subs.length > 0) {
      const sub        = subs[0];
      const multi      = volMultiplier(sub.total_volume_usd || 0);
      tapPts           = Math.round(basePts * multi);
      const newTapPts  = (sub.tap_points   || 0) + tapPts;
      const newTotal   = (sub.total_points || 0) + tapPts;
      const newBrk     = {
        ...(sub.points_breakdown || {}),
        tap: newTapPts,
      };
      await sbPatch(
        `/card_submissions?wallet_address=eq.${encodeURIComponent(wallet_address)}`,
        {
          tap_points:       newTapPts,
          total_points:     newTotal,
          entry_count:      newTotal,
          points_breakdown: newBrk,
        }
      );
    }
  }

  // ── Build cumulative stats for the response ──
  const allPlays = await sbGet(
    `/tap_scores?wallet_address=eq.${encodeURIComponent(wallet_address)}&flagged=eq.false&select=clicks&order=clicks.desc`
  );

  const totalTaps   = Array.isArray(allPlays)
    ? allPlays.reduce((s, r) => s + (r.clicks || 0), 0)
    : clicks;
  const bestSession = Array.isArray(allPlays) && allPlays.length > 0
    ? allPlays[0].clicks
    : clicks;

  // Approximate rank: count wallets with higher total than this one
  // Uses the leaderboard view (created by migration)
  let rank = null;
  try {
    const lb = await sbGet('/tap_leaderboard?select=wallet_address,total_taps&order=total_taps.desc&limit=500');
    if (Array.isArray(lb)) {
      const idx = lb.findIndex(r => r.wallet_address === wallet_address);
      rank = idx >= 0 ? idx + 1 : lb.length + 1;
    }
  } catch (_) { /* rank stays null — non-critical */ }

  return res.status(200).json({
    ok:           true,
    flagged,
    flag_reason:  flagReason,
    tap_pts:      flagged ? 0 : tapPts,
    total_taps:   totalTaps,
    best_session: bestSession,
    rank,
  });
}
