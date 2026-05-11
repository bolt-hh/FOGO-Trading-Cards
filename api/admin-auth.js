// Admin authentication endpoint
// Verifies password server-side (with pepper from env), returns a signed session token.
// The password hash and pepper are NEVER exposed to the client.
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body (Vercel parses JSON automatically when Content-Type is set)
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { password } = body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Missing password' });
  }

  const pepper          = process.env.ADMIN_PEPPER || '';
  const expectedHash    = process.env.ADMIN_PASSWORD_HASH;
  const jwtSecret       = process.env.ADMIN_JWT_SECRET;

  if (!expectedHash || !jwtSecret) {
    console.error('[admin-auth] Missing env vars: ADMIN_PASSWORD_HASH or ADMIN_JWT_SECRET');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Hash the submitted password with the pepper
  const submitted = crypto.createHash('sha256').update(password + pepper).digest('hex');

  // Constant-time comparison to prevent timing attacks
  const expectedBuf  = Buffer.from(expectedHash,  'hex');
  const submittedBuf = Buffer.from(submitted, 'hex');
  const match = expectedBuf.length === submittedBuf.length &&
                crypto.timingSafeEqual(expectedBuf, submittedBuf);

  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Issue a signed session token: "<expiry-ms>.<hmac-sig>"
  const expires = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const payload  = String(expires);
  const sig      = crypto.createHmac('sha256', jwtSecret).update(payload).digest('hex');
  const token    = `${payload}.${sig}`;

  return res.status(200).json({ token, expires });
}
