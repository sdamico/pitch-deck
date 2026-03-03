const { randomBytes } = require('crypto');
const { sql } = require('./_lib/db');
const { isAdmin } = require('./_lib/admin-auth');

module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const next = url.searchParams.get('next');
  const inviteCode = url.searchParams.get('invite');

  if (!token) {
    res.writeHead(302, { Location: '/login.html' });
    res.end();
    return;
  }

  // GET: Show confirmation page without consuming token (scanner-safe)
  if (req.method === 'GET') {
    try {
      // Check if token is valid without consuming it
      const { rows } = await sql`
        SELECT id, email FROM magic_tokens
        WHERE token = ${token} AND used_at IS NULL AND expires_at > NOW()
      `;

      if (rows.length === 0) {
        // Token invalid, already used, or expired
        res.writeHead(302, { Location: '/login.html?expired=1' });
        res.end();
        return;
      }

      // Show confirmation page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Login</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; text-align: center; }
    .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; }
    .btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h1>Confirm Login</h1>
  <p>Click the button below to complete your login to the pitch deck platform.</p>
  <form method="POST">
    <input type="hidden" name="token" value="${token.replace(/"/g, '&quot;')}" />
    ${next ? `<input type="hidden" name="next" value="${next.replace(/"/g, '&quot;')}" />` : ''}
    ${inviteCode ? `<input type="hidden" name="invite" value="${inviteCode.replace(/"/g, '&quot;')}" />` : ''}
    <button type="submit" class="btn">Complete Login</button>
  </form>
</body>
</html>`);
    } catch (e) {
      console.error('Verify GET error:', e);
      res.writeHead(302, { Location: '/login.html' });
      res.end();
    }
    return;
  }

  // POST: Consume token and create session
  if (req.method === 'POST') {
    try {
      // Parse form data
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 1024) break; // Reasonable limit
      }

      const params = new URLSearchParams(body);
      const formToken = params.get('token');
      const formNext = params.get('next');
      const formInviteCode = params.get('invite');

      if (formToken !== token) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid token');
        return;
      }

      // Atomically find and consume valid, unused, non-expired token (prevents TOCTOU race)
      const { rows } = await sql`
        UPDATE magic_tokens
        SET used_at = NOW()
        WHERE token = ${formToken} AND used_at IS NULL AND expires_at > NOW()
        RETURNING id, email
      `;

      if (rows.length === 0) {
        // Token invalid, already used, or expired
        res.writeHead(302, { Location: '/login.html?expired=1' });
        res.end();
        return;
      }

      const { email } = rows[0];

      // Create session
      const sessionId = randomBytes(32).toString('hex');
      const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
      const ip = rawIp.substring(0, 45); // Max IPv6 length
      const userAgent = (req.headers['user-agent'] || '').substring(0, 512);

      await sql`
        INSERT INTO sessions (id, email, ip, user_agent)
        VALUES (${sessionId}, ${email}, ${ip}, ${userAgent})
      `;

      // If this verification came from an invite link, auto-grant data room access + allow rule
      if (formInviteCode) {
        const { rows: links } = await sql`
          SELECT id, view_id, grant_dr FROM invite_links
          WHERE code = ${formInviteCode}
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (max_uses IS NULL OR use_count <= max_uses)
        `;
        if (links.length > 0) {
          const link = links[0];
          // Grant data_room_access only if invite has grant_dr=true and user doesn't already have access
          if (link.grant_dr !== false) {
            await sql`
              INSERT INTO data_room_access (email, granted_by, view_id)
              VALUES (${email}, ${'invite'}, ${link.view_id})
              ON CONFLICT (email) DO NOTHING
            `;
          }
          // Add allow rule so they can log in again independently (skip if exists)
          const { rows: existing } = await sql`
            SELECT id FROM email_rules
            WHERE LOWER(pattern) = ${email} AND rule_type = 'allow'
          `;
          if (existing.length === 0) {
            await sql`
              INSERT INTO email_rules (pattern, rule_type)
              VALUES (${email}, ${'allow'})
            `;
          }
        }
      }

      // Set session cookie (7 day expiry)
      const cookies = [
        `site-auth=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
      ];

      // Redirect to original page, or /admin for admin logins, or / by default
      let redirect = '/';
      if (formNext === 'admin' && await isAdmin(email)) {
        redirect = '/admin';
      } else if (formNext) {
        // Only allow relative paths — reject anything that could redirect externally
        try {
          const parsed = new URL(formNext, 'http://localhost');
          if (parsed.hostname === 'localhost' && formNext.startsWith('/')) {
            redirect = formNext;
          }
        } catch {
          // Invalid URL — ignore
        }
      }

      res.setHeader('Set-Cookie', cookies);
      res.writeHead(302, { Location: redirect });
      res.end();
    } catch (e) {
      console.error('Verify POST error:', e);
      res.writeHead(302, { Location: '/login.html' });
      res.end();
    }
    return;
  }

  // Other methods not supported
  res.writeHead(405);
  res.end();
};
