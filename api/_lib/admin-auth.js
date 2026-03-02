const { timingSafeEqual, createHash, randomBytes } = require('crypto');
const { parseCookies } = require('./auth');
const { sql } = require('./db');

/** Timing-safe password comparison using SHA-256 to normalize length */
function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  const inputHash = createHash('sha256').update(String(input)).digest();
  const expectedHash = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(inputHash, expectedHash);
}

/** Create a random, DB-backed admin session with 24h expiry */
async function createAdminSession(email, ip, userAgent) {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await sql`
    INSERT INTO admin_sessions (id, email, expires_at, ip, user_agent)
    VALUES (${id}, ${email}, ${expiresAt.toISOString()}, ${ip}, ${userAgent})
  `;
  return id;
}

/** Delete an admin session (proper revocation on logout) */
async function deleteAdminSession(token) {
  if (!token) return;
  await sql`DELETE FROM admin_sessions WHERE id = ${token}`;
}

/** Check if request has valid admin auth (DB-backed session or admin email session) */
async function isAdminAuthed(req) {
  const cookies = parseCookies(req.headers.cookie || '');

  // Check DB-backed admin session token
  const token = cookies['admin-auth'];
  if (token) {
    const { rows } = await sql`
      SELECT id FROM admin_sessions
      WHERE id = ${token} AND expires_at > NOW()
    `;
    if (rows.length > 0) return true;
  }

  // Session-based: check if the viewer session belongs to an admin
  const sessionId = cookies['site-auth'];
  if (sessionId) {
    const { rows } = await sql`
      SELECT s.email FROM sessions s
      INNER JOIN admins a ON LOWER(s.email) = LOWER(a.email)
      WHERE s.id = ${sessionId} AND s.created_at > NOW() - INTERVAL '7 days'
    `;
    if (rows.length > 0) return true;
  }

  return false;
}

/** Check if an email is an admin */
async function isAdmin(email) {
  const { rows } = await sql`
    SELECT id FROM admins WHERE LOWER(email) = LOWER(${email})
  `;
  return rows.length > 0;
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
      return;
    }
    let buf = '';
    req.on('data', chunk => {
      buf += chunk;
      if (buf.length > 4096) { buf = '{}'; }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(buf)); }
      catch { resolve({}); }
    });
  });
}

module.exports = { isAdminAuthed, isAdmin, checkPassword, createAdminSession, deleteAdminSession, parseBody };
