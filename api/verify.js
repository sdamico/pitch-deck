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

  let consumedTokenId = null;
  let sessionId = null;

  try {
    // Atomically find and consume valid, unused, non-expired token (prevents TOCTOU race)
    const { rows } = await sql`
      UPDATE magic_tokens
      SET used_at = NOW()
      WHERE token = ${token} AND used_at IS NULL AND expires_at > NOW()
      RETURNING id, email
    `;

    if (rows.length === 0) {
      // Token invalid, already used, or expired — redirect to login with error hint
      res.writeHead(302, { Location: '/login.html?expired=1' });
      res.end();
      return;
    }

    consumedTokenId = rows[0].id;
    const { email } = rows[0];

    // Create session
    sessionId = randomBytes(32).toString('hex');
    const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const ip = rawIp.substring(0, 45); // Max IPv6 length
    const userAgent = (req.headers['user-agent'] || '').substring(0, 512);

    await sql`
      INSERT INTO sessions (id, email, ip, user_agent)
      VALUES (${sessionId}, ${email}, ${ip}, ${userAgent})
    `;

    // If this verification came from an invite link, auto-grant data room access + allow rule
    if (inviteCode) {
      const { rows: links } = await sql`
        SELECT id, view_id, grant_dr FROM invite_links
        WHERE code = ${inviteCode}
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
    if (next === 'admin' && await isAdmin(email)) {
      redirect = '/admin';
    } else if (next) {
      // Only allow relative paths — reject anything that could redirect externally
      try {
        const parsed = new URL(next, 'http://localhost');
        if (parsed.hostname === 'localhost' && next.startsWith('/')) {
          redirect = next;
        }
      } catch {
        // Invalid URL — ignore
      }
    }

    res.setHeader('Set-Cookie', cookies);
    res.writeHead(302, { Location: redirect });
    res.end();
  } catch (e) {
    console.error('Verify error:', e);

    // Best-effort compensation: avoid burning the magic link on downstream failures.
    if (sessionId) {
      try {
        await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
      } catch (cleanupErr) {
        console.error('Verify cleanup (session delete) error:', cleanupErr);
      }
    }
    if (consumedTokenId) {
      try {
        await sql`
          UPDATE magic_tokens
          SET used_at = NULL
          WHERE id = ${consumedTokenId}
        `;
      } catch (cleanupErr) {
        console.error('Verify cleanup (token reset) error:', cleanupErr);
      }
    }

    res.writeHead(302, { Location: '/login.html' });
    res.end();
  }
};
