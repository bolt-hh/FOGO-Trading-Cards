// Vercel serverless function — proxies api.fogoscan.com to avoid CORS
export default async function handler(req, res) {

  // ── ORIGIN GUARD ──────────────────────────────────────────────────────────
  // Only allow requests that originate from this site.
  // This blocks external scripts from abusing the proxy and burning Vercel quota.
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  const allowed = [
    'https://project-3y7kh.vercel.app',
    'http://localhost',           // local dev
    'http://127.0.0.1',          // local dev
  ];
  // Add custom domain here if you ever point one at Vercel
  const isAllowed = !origin
    // origin is empty on same-origin GET requests (browser quirk) — check referer too
    ? allowed.some(o => referer.startsWith(o)) || referer === ''
    : allowed.some(o => origin.startsWith(o));

  if (!isAllowed) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  // ─────────────────────────────────────────────────────────────────────────

  res.setHeader('Access-Control-Allow-Origin', 'https://project-3y7kh.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Incoming: /api/fogoscan/account/transfer?address=...
  // Upstream: https://api.fogoscan.com/v1/account/transfer?address=...
  const rawPath = req.url || '';
  const path = rawPath
    .replace(/^\/api\/fogoscan/, '')
    .replace(/\?.*$/, '');

  const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const upstream = 'https://api.fogoscan.com/v1' + path + qs;

  try {
    const upstream_res = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://fogoscan.com/',
        'Origin': 'https://fogoscan.com',
      },
    });
    const data = await upstream_res.json();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(upstream_res.status).json(data);
  } catch (e) {
    return res.status(502).json({ success: false, error: 'Proxy error: ' + e.message });
  }
}
