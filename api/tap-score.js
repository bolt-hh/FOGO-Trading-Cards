// POST /api/tap-score
// Records a Speed Run play. Validates anti-abuse, inserts into tap_scores,
// and awards tap_pts to card_submissions (10 clicks = 1 point).

// ── Kill switch: set to true to pause the game immediately ───────
// Flip back to false and redeploy to re-open.
const GAME_PAUSED = false;

const SUPABASE_URL   = 'https://nhdktvsllunlgdsaninx.supabase.co';
const TPS            = 100000;    // Fogo TPS used in punchline calc
const MIN_STD_DEV_MS = 8;         // below this = suspiciously robotic cadence (applied to physical taps only)
const MAX_PLAYS_HOUR = 30;        // IP-level rate limit (no daily wallet cap — unlimited plays)

// Dynamic click ceiling: physical taps × max power-up multiplier factor + flat bonus
// Genesis (5× for ~half game ≈ 3× session avg) + Surge + Lightning overhead = 4.5×
// Airdrop (+20) + Lightning total bonus ≈ 50 flat
// A macro targeting 499 with low physical clicks will exceed this and get flagged.
const MAX_VIRTUAL_FACTOR  = 4.5;
const MAX_VIRTUAL_ADDITIVE = 50;

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

// Lifetime cap: once a wallet has earned 2,000 tap points total,
// all further tap points convert at 100:1 regardless of daily resets.
const LIFETIME_DIM_THRESHOLD = 2000;
const TAP_RATE_LIFETIME      = 100;  // taps per point after lifetime cap

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
function analyseTimestamps(ts, clicks, maxCps) {
  // maxCps is effectiveMaxCPS passed from the handler — finger-aware and device-aware
  const cpsLimit = maxCps || 30; // 30 = safe fallback if somehow called without a limit
  if (!Array.isArray(ts) || ts.length < 3) return { flagged: false };

  // Server-side recount — allow generous slack for power-up virtual clicks
  // (Block Surge/Genesis/Lightning add bonus clicks with identical timestamps;
  //  ts.length may be less than clicks if client only sends physical timestamps)
  const serverCount = ts.length;
  if (serverCount > clicks + 5) {
    // More timestamps than clicks is suspicious (shouldn't happen)
    return { flagged: true, reason: 'timestamp_mismatch' };
  }

  // Click rate — use the full game duration (10s) not the tap span.
  // Using span punishes burst-tappers who tap hard then pause: a player who
  // taps 160 times in 5s then stops has span-CPS=32 but game-CPS=16.
  // Both measures should agree with the stored physical_cps (clicks/10s).
  const GAME_DURATION_MS = 10000;
  const gameCps = (ts.length / GAME_DURATION_MS) * 1000;
  if (gameCps > cpsLimit) return { flagged: true, reason: 'rate_exceeded' };

  // ── Deduplicate burst timestamps before statistical analysis ──────
  // Power-ups (Surge, Genesis, Lightning) push identical timestamps for bonus
  // clicks. Strip duplicates so variance/runs checks measure human cadence only.
  const dedupedTs = ts.filter((v, i) => i === 0 || v !== ts[i - 1]);
  if (dedupedTs.length < 3) return { flagged: false }; // not enough unique taps to analyse

  // Variance — robotic timing has near-zero std dev (on deduped physical cadence)
  const intervals = [];
  for (let i = 1; i < dedupedTs.length; i++) intervals.push(dedupedTs[i] - dedupedTs[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < MIN_STD_DEV_MS && dedupedTs.length > 15) {
    return { flagged: true, reason: 'low_variance' };
  }

  // Runs test — detects artificial jitter (bots that add ±Nms noise to fake randomness)
  // Applied to deduped cadence only — power-up bursts would otherwise create
  // long runs of 0ms intervals that look like bot patterns.
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

// ── Main handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Kill switch — returns before any DB interaction
  if (GAME_PAUSED) {
    return res.status(503).json({ ok: false, paused: true, error: 'Game paused for maintenance — back shortly! 🔧' });
  }

  const { wallet_address, x_handle, kol_ref, clicks, physical_clicks,
          max_concurrent_fingers,
          duration_ms, click_timestamps, physical_click_timestamps,
          page_load_ts, play_pressed_ts } = req.body || {};

  // ── Input validation ──
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

  // ── Rate limiting: IP-level only (no daily wallet cap — unlimited plays) ──
  const hourAgo = new Date(Date.now() - 3600_000);
  const rawIP   = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || req.headers['x-real-ip'] || '';
  const ipHash  = hashIP(rawIP);

  const recentByIP = await sbGet(
    `/tap_scores?ip_hash=eq.${ipHash}&played_at=gte.${hourAgo.toISOString()}&select=id`
  );
  if (Array.isArray(recentByIP) && recentByIP.length >= MAX_PLAYS_HOUR) {
    return res.status(429).json({ error: 'ip_rate_limit' });
  }

  // ── Anti-abuse analysis ──
  // Use physical_clicks/physical_click_timestamps when available —
  // these exclude power-up virtual clicks (Surge ×2, Genesis ×5, Airdrop +20, Lightning +6)
  // so anti-cheat measures actual human tapping speed, not inflated totals.
  const physClicks = (typeof physical_clicks === 'number' && physical_clicks > 0)
    ? physical_clicks : clicks;
  const tsForAbuse = (Array.isArray(physical_click_timestamps) && physical_click_timestamps.length > 2)
    ? physical_click_timestamps : click_timestamps;

  // Scale CPS ceiling by touch finger count:
  // 1 finger (or desktop mouse): 20 CPS
  // 2 fingers: 26 CPS
  // 3 fingers: 30 CPS
  // 4+ fingers: 36 CPS
  // Falls back to 30 CPS if no finger data sent — generous enough for fast mobile single-finger
  // Cap at 6 fingers max — physically the most one hand can place simultaneously.
  // Prevents zoom exploit where players enlarge the button to fit 8-10 fingers.
  const rawFingers = (typeof max_concurrent_fingers === 'number' && max_concurrent_fingers >= 1)
    ? max_concurrent_fingers : null;
  const fingers = rawFingers ? Math.min(rawFingers, 6) : null;

  // CPS ceiling per finger count (raised 4-finger to 42 for fast iOS players)
  // Fallback 30 CPS (not 25) when no finger data arrives — mobile players often
  // send null if touch detection fires late, and single-finger mobile can hit 25+.
  const effectiveMaxCPS = fingers
    ? (fingers >= 4 ? 42 : fingers === 3 ? 32 : fingers === 2 ? 26 : 20)
    : 30;

  const cps = physClicks / (duration_ms / 1000);
  let flagged    = cps > effectiveMaxCPS;
  let flagReason = flagged ? 'rate_exceeded' : null;

  // Layer 4 — page load honeypot: bot scripts fire almost instantly after load
  if (!flagged && page_load_ts && play_pressed_ts) {
    const prePlayMs = play_pressed_ts - page_load_ts;
    if (prePlayMs < 1500) {
      flagged    = true;
      flagReason = 'instant_play';
    }
  }

  if (!flagged && tsForAbuse) {
    const check = analyseTimestamps(tsForAbuse, physClicks, effectiveMaxCPS);
    flagged    = check.flagged;
    flagReason = check.reason || null;
  }

  // ── Dynamic virtual click ceiling ──
  // Max legitimate = physical × 4.5 + 50
  // (Genesis 5× for ~half game ≈ 3× session + Surge + Lightning overhead = 4.5×;
  //  Airdrop +20 + Lightning total bonus ≈ 50 flat)
  // A macro targeting 499 with low physical taps will exceed this and get flagged.
  if (!flagged && physical_clicks) {
    const maxLegitimate = Math.ceil(physical_clicks * MAX_VIRTUAL_FACTOR) + MAX_VIRTUAL_ADDITIVE;
    if (clicks > maxLegitimate) {
      flagged    = true;
      flagReason = 'virtual_click_inflation';
    }
  }

  // leaderboard_eligible: false if flagged (still records + earns raffle points, just off leaderboard)
  const leaderboardEligible = !flagged;

  // ── Insert into tap_scores ──
  // click_timestamps used above for anti-cheat (in-memory only) — not persisted to DB.
  // Storing ~0.5KB of JSON per row caused severe IO exhaustion at scale.
  const handle = x_handle.startsWith('@') ? x_handle : '@' + x_handle;
  await sbPost('/tap_scores', {
    wallet_address,
    x_handle:             handle,
    clicks,
    physical_clicks:      physical_clicks || null,
    duration_ms,
    fogo_equivalent:      Math.floor(clicks * TPS / (duration_ms / 10000)),
    ip_hash:              ipHash,
    flagged,
    flag_reason:          flagReason,
    leaderboard_eligible: leaderboardEligible,
  });

  // ── Trigger leaderboard snapshot refresh (rate-limited to once/30s, fire-and-forget) ──
  // maybe_refresh_leaderboard() checks the _leaderboard_refresh table and only runs
  // REFRESH MATERIALIZED VIEW CONCURRENTLY if >30s have elapsed — no locking for readers.
  fetch(`${SUPABASE_URL}/rest/v1/rpc/maybe_refresh_leaderboard`, {
    method: 'POST', headers: sbHeaders(), body: '{}',
  }).catch(() => {/* non-critical */});

  // ── Award points: calcTapPts + card_submissions fetch in parallel ──
  const [basePts, subsInit] = await Promise.all([
    calcTapPts(wallet_address, clicks),
    sbGet(`/card_submissions?wallet_address=eq.${encodeURIComponent(wallet_address)}&select=total_points,tap_points,entry_count,points_breakdown,total_volume_usd`),
  ]);
  let tapPts = basePts;

  if (!flagged && basePts > 0) {
    let subs = subsInit;

    // ── Auto-register: new wallet arriving via play.html direct flow ──
    if (!Array.isArray(subs) || subs.length === 0) {
      try {
        const handle = x_handle.startsWith('@') ? x_handle : '@' + x_handle;
        // Look up kol_id from kols table so game registrations match card registrations
        let kolId = null;
        if (kol_ref) {
          try {
            const kolRows = await sbGet(`/kols?handle=eq.${encodeURIComponent(kol_ref)}&select=id&limit=1`);
            if (Array.isArray(kolRows) && kolRows[0]) kolId = kolRows[0].id;
          } catch (_) { /* non-critical — kol_passcode fallback still stored */ }
        }
        await sbPost('/card_submissions', {
          wallet_address,
          twitter_handle:  handle,
          kol_passcode:    kol_ref || null,
          kol_id:          kolId   || null,
          total_points:    0,
          tap_points:      0,
          entry_count:     0,
          points_breakdown: {},
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
      const sub             = subs[0];
      const multi           = volMultiplier(sub.total_volume_usd || 0);
      const currentTapPts   = sub.tap_points || 0;

      // Lifetime cap: if wallet has already earned ≥ 2,000 tap pts, switch to 100:1
      const lifetimePts = currentTapPts >= LIFETIME_DIM_THRESHOLD
        ? Math.floor(clicks / TAP_RATE_LIFETIME)
        : basePts;

      tapPts = Math.round(lifetimePts * multi);
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

  // ── Build cumulative stats + rank in parallel ──
  const [allPlays, lbData] = await Promise.all([
    sbGet(`/tap_scores?wallet_address=eq.${encodeURIComponent(wallet_address)}&flagged=eq.false&select=clicks&order=clicks.desc`),
    sbGet('/tap_leaderboard?select=wallet_address,total_taps&order=total_taps.desc&limit=500').catch(() => null),
  ]);

  const totalTaps   = Array.isArray(allPlays)
    ? allPlays.reduce((s, r) => s + (r.clicks || 0), 0)
    : clicks;
  const bestSession = Array.isArray(allPlays) && allPlays.length > 0
    ? allPlays[0].clicks
    : clicks;

  let rank = null;
  try {
    if (Array.isArray(lbData)) {
      const idx = lbData.findIndex(r => r.wallet_address === wallet_address);
      rank = idx >= 0 ? idx + 1 : lbData.length + 1;
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
