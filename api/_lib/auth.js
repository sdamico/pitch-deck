const { sql } = require('./db');

function parseCookies(str) {
  const obj = {};
  for (const pair of str.split(';')) {
    try {
      const [key, ...rest] = pair.trim().split('=');
      if (key) obj[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
    } catch {
      // Skip malformed cookie pairs
    }
  }
  return obj;
}

async function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies['site-auth'];
  if (!sessionId) return null;

  const { rows } = await sql`
    SELECT id, email, created_at, last_seen
    FROM sessions
    WHERE id = ${sessionId} AND created_at > NOW() - INTERVAL '7 days'
  `;
  if (rows.length === 0) return null;

  // Update last_seen
  await sql`UPDATE sessions SET last_seen = NOW() WHERE id = ${sessionId}`;

  return rows[0];
}

module.exports = { parseCookies, getSession };
