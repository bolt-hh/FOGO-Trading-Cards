// Vercel serverless function — proxies api.fogoscan.com to avoid CORS
export default async function handler(req, res) {

  // ── ORIGIN GUARD ──────────────────────────────────────────────────────────
  // Only allow requests that originate from this site.
  // This blocks external scripts from abusing the proxy and burning Vercel quota.
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  // Allow any *.vercel.app subdomain, localhost, or custom domains
  const allowedPattern = /^https?:\/\/(localhost|127\.0\.0\.1|fogo-trading-cards\.vercel\.app|card\.fogo\.io)(:\d+)?/;
  // Block requests with neither a valid Origin nor a valid Referer (e.g. curl, server-side abuse)
  const isAllowed = origin
    ? allowedPattern.test(origin)
    : referer !== '' && allowedPattern.test(referer);

  if (!isAllowed) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const allowedOrigins = ['https://fogo-trading-cards.vercel.app', 'https://card.fogo.io'];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
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

  // Block path traversal and only allow known Fogoscan API path prefixes
  const allowedPaths = ['/account', '/token'];
  const pathIsAllowed = allowedPaths.some(p => path.startsWith(p))
    && !/\.\.|\/\/|[^a-zA-Z0-9/_\-.]/.test(path);

  if (!pathIsAllowed) {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }

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
