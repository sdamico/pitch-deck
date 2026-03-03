const { parseCookies } = require('./_lib/auth');
const { sql } = require('./_lib/db');
const { deleteAdminSession } = require('./_lib/admin-auth');

module.exports = async (req, res) => {
  // F16: Enforce POST method
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  const cookies = parseCookies(req.headers.cookie || '');

  // Revoke viewer session without deleting analytics-linked session rows.
  const sessionId = cookies['site-auth'];
  if (sessionId) {
    await sql`
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE id = ${sessionId}
    `;
  }

  // Delete admin session from DB before clearing cookie
  const adminToken = cookies['admin-auth'];
  if (adminToken) {
    await deleteAdminSession(adminToken);
  }

  res.setHeader('Set-Cookie', [
    'site-auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'admin-auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
  ]);
  res.writeHead(302, { Location: '/login.html' });
  res.end();
};
