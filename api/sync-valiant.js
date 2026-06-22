// Cron job: sync Valiant (Fuul) volume for all frozen-model wallets every 6 hours.
// Scheduled via vercel.json — also callable manually with the correct Authorization header.

const SUPABASE_URL  = 'https://nhdktvsllunlgdsaninx.supabase.co';
const FUUL_API      = 'https://api.fuul.xyz/api/v1/payouts/leaderboard/volume';
const FUUL_BEARER   = 'f0ccd94978c13f2062b1ac07a00ddc9b3fc7daf322e03b4aa4d9cc3edf681c55';
const MIN_DELTA_PTS = 25;   // skip wallets with <25 pt change to avoid noisy writes
const FUUL_DELAY_MS = 130;  // ms between Fuul requests (rate limit courtesy)

// ── Supabase REST helpers ────────────────────────────────────────────────────
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'Authorization': `Bearer ${key}`,
    'apikey': key,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Supabase PATCH ${path} → ${res.status}: ${await res.text()}`);
  }
}

async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 201) {
    throw new Error(`Supabase POST ${path} → ${res.status}: ${await res.text()}`);
  }
}

// ── Fuul volume query ────────────────────────────────────────────────────────
async function getFuulVolume(address) {
  const params = new URLSearchParams({
    user_identifier: address,
    identifier_type: 'solana_address',
    limit: '1',
  });
  const res = await fetch(`${FUUL_API}?${params}`, {
    headers: { Authorization: `Bearer ${FUUL_BEARER}` },
  });
  const data = await res.json();
  return parseFloat(data.results?.[0]?.total_amount || '0');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Auth: Vercel auto-injects CRON_SECRET as Bearer token for scheduled runs.
  // The same secret can be used to trigger manually.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const startTime = Date.now();

  // Fetch all wallets
  const allWallets = await sbGet(
    '/card_submissions?select=wallet_address,total_points,points_breakdown,total_volume_usd,entry_count'
  );

  // Two wallet models are synced:
  // 1. Frozen-model (pre-migration): identified by _frozen_base_pts, use 'valiant' key for vol pts
  // 2. Live-model (post-migration): no _frozen_base_pts, use 'volume' key for vol pts
  //    These wallets generated cards via the normal flow — we track their Fuul vol and update 'volume'.
  const targets = allWallets.filter(w => {
    const brk = w.points_breakdown;
    if (!brk) return false;
    const isFrozen = brk._frozen_base_pts !== undefined;
    if (isFrozen) return (brk.valiant || 0) > 0;          // frozen: must have valiant pts
    return (w.total_volume_usd || 0) > 0;                  // live: has any on-chain volume
  });

  const updated = [];
  const skipped = [];
  const errors  = [];

  for (const wallet of targets) {
    const addr    = wallet.wallet_address;
    const brk     = wallet.points_breakdown;
    const isFrozen = brk._frozen_base_pts !== undefined;

    try {
      // Frozen model uses 'valiant' key; live model uses 'volume' key
      const storedVolPts = isFrozen ? (brk.valiant || 0) : (brk.volume || 0);
      const frozenVol    = brk._frozen_vol || 0;

      // Query live Fuul volume
      const fuulVol     = await getFuulVolume(addr);
      const newVolPts   = Math.floor(fuulVol / 50) * 25;
      const deltaPts    = newVolPts - storedVolPts;

      if (deltaPts < MIN_DELTA_PTS) {
        skipped.push({ addr: addr.slice(0, 8), delta: deltaPts });
        await sleep(FUUL_DELAY_MS);
        continue;
      }

      const newTotalPts = wallet.total_points + deltaPts;
      // Update the correct breakdown key for each model
      const newBrk = isFrozen
        ? { ...brk, valiant: newVolPts }
        : { ...brk, volume:  newVolPts };
      // total_volume_usd = frozen vol (pre-migration) + live Fuul vol
      const newVolUsd = isFrozen ? (frozenVol + fuulVol) : fuulVol;

      await sbPatch(`/card_submissions?wallet_address=eq.${addr}`, {
        total_points:     newTotalPts,
        entry_count:      newTotalPts,
        points_breakdown: newBrk,
        total_volume_usd: newVolUsd,
      });

      updated.push({
        addr:       addr.slice(0, 8),
        deltaPts,
        newTotalPts,
        fuulVol:    Math.round(fuulVol),
      });

    } catch (e) {
      errors.push({ addr: addr.slice(0, 8), error: e.message });
    }

    await sleep(FUUL_DELAY_MS);
  }

  const result = {
    ran_at:          new Date().toISOString(),
    duration_ms:     Date.now() - startTime,
    wallets_checked: targets.length,
    updated:         updated.length,
    skipped:         skipped.length,
    errors:          errors.length,
    details: {
      updated,
      skipped: skipped.filter(s => s.delta > 0),  // only show ones with any movement
      errors,
    },
  };

  // Persist run to Supabase so the admin dashboard can show sync health
  // even after Vercel's 1-hour log retention window has passed.
  try {
    await sbPost('/cron_logs', {
      job_name:        'sync-valiant',
      ran_at:          result.ran_at,
      duration_ms:     result.duration_ms,
      wallets_checked: result.wallets_checked,
      updated_count:   result.updated,
      skipped_count:   result.skipped,
      errors_count:    result.errors,
      details:         result.details,
    });
  } catch (e) {
    console.error('[sync-valiant] Failed to write cron_log:', e.message);
  }

  return res.status(200).json(result);
}
