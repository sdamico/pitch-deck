const { randomBytes } = require('crypto');
const { sql } = require('./_lib/db');
const { isEmailAllowed } = require('./_lib/email-check');
const { siteUrl, resendFrom } = require('./_lib/config');
const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  try {
    let data;
    if (req.body) {
      data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      const body = await new Promise((resolve, reject) => {
        let buf = '';
        req.on('data', chunk => {
          buf += chunk;
          if (buf.length > 4096) {
            reject(new Error('Body too large'));
          }
        });
        req.on('end', () => resolve(buf));
      });
      data = JSON.parse(body);
    }

    const email = (data.email || '').trim().toLowerCase();

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Please enter a valid email address' }));
      return;
    }

    // F9: Global rate limit — max 20 magic links per minute across all users
    const { rows: globalRate } = await sql`
      SELECT COUNT(*) AS cnt FROM magic_tokens
      WHERE created_at > NOW() - INTERVAL '1 minute'
    `;
    if (parseInt(globalRate[0].cnt) >= 20) {
      // Still return 200 to prevent enumeration
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Uniform response to prevent email enumeration:
    // check allowlist + rate limit, but always return 200 regardless
    const allowed = await isEmailAllowed(email);

    let rateLimited = false;
    if (allowed) {
      const { rows: recent } = await sql`
        SELECT id FROM magic_tokens
        WHERE email = ${email}
          AND created_at > NOW() - INTERVAL '60 seconds'
      `;
      rateLimited = recent.length > 0;
    }

    if (allowed && !rateLimited) {
      // F25: Opportunistic cleanup of expired/used tokens (~1% of requests)
      if (Math.random() < 0.01) {
        await sql`
          DELETE FROM magic_tokens
          WHERE (expires_at < NOW() - INTERVAL '1 day')
             OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day')
        `;
      }

      // Generate token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

      await sql`
        INSERT INTO magic_tokens (email, token, expires_at)
        VALUES (${email}, ${token}, ${expiresAt.toISOString()})
      `;

      // Send email via Resend
      // siteUrl imported from config
      const next = (data.next || '').trim();
      const nextSuffix = next && next.startsWith('/') ? `&next=${encodeURIComponent(next)}` : '';
      const verifyUrl = `${siteUrl}/api/verify?token=${token}${nextSuffix}`;

      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: resendFrom,
        to: email,
        subject: 'Your deck link',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 460px; margin: 0 auto; padding: 40px 0;">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Click below to view the pitch deck:
            </p>
            <a href="${verifyUrl}" style="display: inline-block; background: #E85D2C; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
              Open deck
            </a>
            <p style="color: #999; font-size: 13px; margin-top: 32px; line-height: 1.5;">
              Or copy and paste this link into your browser:
            </p>
            <p style="background: #f5f5f5; border-radius: 4px; padding: 12px; word-break: break-all; font-family: monospace; font-size: 13px; color: #333; margin: 0 0 32px 0; user-select: all; -webkit-user-select: all;">
              ${verifyUrl}
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 0; line-height: 1.5;">
              This link expires in 15 minutes. If you didn't request this, you can ignore this email.
            </p>
          </div>
        `,
      });
    }

    // Always return 200 to prevent email enumeration
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    if (e.message === 'Body too large') {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large' }));
      return;
    }
    console.error('Login error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Something went wrong — try again' }));
  }
};
