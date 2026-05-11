// Admin mutation endpoint
// All write/delete operations against the DB go through here.
// Requires a valid session token issued by /api/admin-auth.
// Uses the Supabase service role key (never exposed to the client).
import crypto from 'crypto';

// ── Token verification ─────────────────────────────────────────────────────
function verifyToken(token) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || !token || typeof token !== 'string') return false;

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const payload = token.slice(0, dotIdx);
  const sig     = token.slice(dotIdx + 1);

  // Check expiry
  const expires = Number(payload);
  if (!expires || Date.now() > expires) return false;

  // Verify HMAC signature
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ── Supabase REST helper (service role) ────────────────────────────────────
async function sb(method, path, body, extraHeaders = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer':        'return=representation',
      ...extraHeaders,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body   = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { token, action, params = {} } = body || {};

  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired session' });
  }

  try {
    switch (action) {

      // ── Entries ──────────────────────────────────────────────────────────

      case 'deleteEntry': {
        const r = await sb('DELETE', `card_submissions?id=eq.${encodeURIComponent(params.id)}`, null);
        return res.status(200).json({ ok: r.ok });
      }

      case 'deleteSelectedEntries': {
        if (!Array.isArray(params.ids) || !params.ids.length) {
          return res.status(400).json({ error: 'No IDs provided' });
        }
        const idList = params.ids.map(encodeURIComponent).join(',');
        const r = await sb('DELETE', `card_submissions?id=in.(${idList})`, null);
        return res.status(200).json({ ok: r.ok });
      }

      // ── KOLs ─────────────────────────────────────────────────────────────

      case 'addKol': {
        const r = await sb('POST', 'kols', {
          name:   params.name,
          handle: params.handle || null,
          active: true,
        }, { 'Prefer': 'return=representation' });
        return res.status(200).json({ ok: r.ok, data: r.data });
      }

      case 'toggleKolActive': {
        const r = await sb('PATCH', `kols?id=eq.${encodeURIComponent(params.id)}`,
          { active: params.active });
        return res.status(200).json({ ok: r.ok });
      }

      case 'deleteKol': {
        const r = await sb('DELETE', `kols?id=eq.${encodeURIComponent(params.id)}`, null);
        return res.status(200).json({ ok: r.ok });
      }

      // ── UGC ──────────────────────────────────────────────────────────────

      case 'ugcApprove': {
        await sb('PATCH', `ugc_submissions?id=eq.${encodeURIComponent(params.ugcId)}`,
          { status: 'approved', points_awarded: 100 });
        // Add 100pts to card_submissions
        const sub = await sb('GET',
          `card_submissions?wallet_address=eq.${encodeURIComponent(params.walletAddress)}&select=ugc_points,total_points`, null);
        const row = Array.isArray(sub.data) ? sub.data[0] : null;
        if (row) {
          const newUgc   = (row.ugc_points   || 0) + 100;
          const newTotal = (row.total_points || 0) + 100;
          await sb('PATCH',
            `card_submissions?wallet_address=eq.${encodeURIComponent(params.walletAddress)}`,
            { ugc_points: newUgc, total_points: newTotal, entry_count: newTotal });
        }
        return res.status(200).json({ ok: true });
      }

      case 'ugcReject': {
        const r = await sb('PATCH', `ugc_submissions?id=eq.${encodeURIComponent(params.ugcId)}`,
          { status: 'rejected', points_awarded: 0 });
        return res.status(200).json({ ok: r.ok });
      }

      case 'awardUgcPoints': {
        const sub = await sb('GET',
          `card_submissions?wallet_address=eq.${encodeURIComponent(params.wallet)}&select=ugc_points,total_points,points_breakdown`,
          null);
        const row = Array.isArray(sub.data) ? sub.data[0] : null;
        if (!row) return res.status(404).json({ error: 'Wallet not found in submissions' });
        const newUgc   = (row.ugc_points   || 0) + 100;
        const newTotal = (row.total_points || 0) + 100;
        const newBreak = Object.assign({}, row.points_breakdown || {}, { ugc: newUgc });
        await sb('PATCH',
          `card_submissions?wallet_address=eq.${encodeURIComponent(params.wallet)}`,
          { ugc_points: newUgc, total_points: newTotal, entry_count: newTotal, points_breakdown: newBreak });
        if (params.postLink) {
          await sb('POST', 'ugc_submissions', {
            wallet_address: params.wallet,
            post_link:      params.postLink,
            status:         'approved',
            points_awarded: 100,
          });
        }
        return res.status(200).json({ ok: true, newTotal });
      }

      // ── Tasks ─────────────────────────────────────────────────────────────

      case 'addTask': {
        const r = await sb('POST', 'tasks', params.task, { 'Prefer': 'return=representation' });
        return res.status(200).json({ ok: r.ok, data: r.data });
      }

      case 'toggleTask': {
        const r = await sb('PATCH', `tasks?id=eq.${encodeURIComponent(params.id)}`,
          { active: params.active });
        return res.status(200).json({ ok: r.ok });
      }

      case 'deleteTask': {
        const r = await sb('DELETE', `tasks?id=eq.${encodeURIComponent(params.id)}`, null);
        return res.status(200).json({ ok: r.ok });
      }

      case 'updateUgcMax': {
        const r = await sb('PATCH', `tasks?id=eq.${encodeURIComponent(params.id)}`,
          { max_completions: params.val });
        return res.status(200).json({ ok: r.ok });
      }

      // ── Admin reads (service role — sees all columns incl. telegram_handle) ──

      case 'fetchSubmissions': {
        const r = await sb('GET',
          'card_submissions?select=*&order=total_points.desc.nullslast', null,
          { 'Prefer': 'return=representation' });
        return res.status(200).json({ ok: r.ok, data: r.data });
      }

      // ── Tab config ────────────────────────────────────────────────────────

      case 'saveTabsConfig': {
        if (!Array.isArray(params.upserts)) return res.status(400).json({ error: 'Invalid upserts' });
        const r = await sb('POST', 'app_settings', params.upserts,
          { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
        return res.status(200).json({ ok: r.ok });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('[admin-action] error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
