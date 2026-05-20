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

  // Filter: only frozen-model wallets with real Fuul-tracked Valiant pts
  // Frozen wallets have _frozen_base_pts in their breakdown
  const targets = allWallets.filter(w => {
    const brk = w.points_breakdown;
    if (!brk) return false;
    const hasFrozenBase = brk._frozen_base_pts !== undefined;
    const hasValiantPts = (brk.valiant || 0) > 0;
    return hasFrozenBase && hasValiantPts;
  });

  const updated = [];
  const skipped = [];
  const errors  = [];

  for (const wallet of targets) {
    const addr = wallet.wallet_address;
    const brk  = wallet.points_breakdown;

    try {
      const storedValiantPts = brk.valiant        || 0;
      const frozenVol        = brk._frozen_vol    || 0;
      const frozenBase       = brk._frozen_base_pts || 0;
      const holderPts        = brk.holder_pts     || 0;
      const ugcPts           = brk.ugc            || 0;

      // Query live Fuul volume
      const fuulVol      = await getFuulVolume(addr);
      const newValiantPts = Math.floor(fuulVol / 50) * 25;
      const deltaPts      = newValiantPts - storedValiantPts;

      if (deltaPts < MIN_DELTA_PTS) {
        skipped.push({ addr: addr.slice(0, 8), delta: deltaPts });
        await sleep(FUUL_DELAY_MS);
        continue;
      }

      const newTotalPts = wallet.total_points + deltaPts;
      const newBrk      = { ...brk, valiant: newValiantPts };
      // total_volume_usd = frozen vol (pre-migration) + live Fuul vol
      const newVolUsd   = frozenVol + fuulVol;

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

  return res.status(200).json({
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
  });
}
