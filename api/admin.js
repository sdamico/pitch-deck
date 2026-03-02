const { readFileSync } = require('fs');
const { join } = require('path');
const { randomBytes } = require('crypto');
const { isAdminAuthed, isAdmin, checkPassword, createAdminSession, parseBody } = require('./_lib/admin-auth');
const { sql } = require('./_lib/db');

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const { siteUrl, resendFrom } = require('./_lib/config');

module.exports = async (req, res) => {
  // Handle admin login POST
  if (req.method === 'POST') {
    const data = await parseBody(req);

    // Password-based login (legacy / bootstrap)
    if (data.password) {
      // F2: IP-based rate limiting — 5 attempts per 15 minutes
      const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
      const { rows: attempts } = await sql`
        SELECT COUNT(*) AS cnt FROM admin_login_attempts
        WHERE ip = ${ip} AND attempted_at > NOW() - INTERVAL '15 minutes'
      `;
      if (parseInt(attempts[0].cnt) >= 5) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many attempts. Try again later.' }));
        return;
      }

      if (checkPassword(data.password)) {
        // Log successful attempt
        await sql`INSERT INTO admin_login_attempts (ip, success) VALUES (${ip}, true)`;
        const sessionId = await createAdminSession('password-login', ip, req.headers['user-agent'] || '');
        res.setHeader(
          'Set-Cookie',
          `admin-auth=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } else {
        // Log failed attempt
        await sql`INSERT INTO admin_login_attempts (ip, success) VALUES (${ip}, false)`;
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
      return;
    }

    // Email-based login — send magic link if email is an admin
    if (data.email) {
      const email = (data.email || '').trim().toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Please enter a valid email address' }));
        return;
      }

      // Always return 200 to prevent admin email enumeration
      const adminUser = await isAdmin(email);

      if (adminUser) {
        // Rate limit: 1 token per 60s
        const { rows: recent } = await sql`
          SELECT id FROM magic_tokens
          WHERE email = ${email}
            AND created_at > NOW() - INTERVAL '60 seconds'
            AND used_at IS NULL
        `;

        if (recent.length === 0) {
          const token = randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

          await sql`
            INSERT INTO magic_tokens (email, token, expires_at)
            VALUES (${email}, ${token}, ${expiresAt.toISOString()})
          `;

          // siteUrl imported from config
          const verifyUrl = `${siteUrl}/api/verify?token=${token}&next=admin`;

          const { Resend } = require('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: resendFrom,
            to: email,
            subject: 'Admin login',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 460px; margin: 0 auto; padding: 40px 0;">
                <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                  Click below to sign in to the Admin dashboard:
                </p>
                <a href="${verifyUrl}" style="display: inline-block; background: #E85D2C; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                  Open admin dashboard
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
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, method: 'email' }));
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'password or email required' }));
    return;
  }

  // Check if authed
  if (!(await isAdminAuthed(req))) {
    // Serve login form — supports both email and password login
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — BASED</title>
<style>
  @font-face { font-family: 'Inter'; src: url('/fonts/Inter-Regular.woff2') format('woff2'); font-weight: 400; }
  @font-face { font-family: 'JetBrains Mono'; src: url('/fonts/JetBrainsMono-Latin.woff2') format('woff2'); font-weight: 300; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #111; color: #ECEEE2; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .box { width: 100%; max-width: 360px; padding: 0 24px; }
  h1 { font-size: 16px; font-weight: 400; text-align: center; margin-bottom: 32px; color: rgba(236,238,226,0.5); }
  label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(236,238,226,0.35); margin-bottom: 12px; }
  input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(236,238,226,0.1); border-radius: 6px; padding: 14px 16px; color: #ECEEE2; font-family: 'JetBrains Mono', monospace; font-size: 15px; outline: none; }
  input:focus { border-color: rgba(232,93,44,0.5); }
  button { width: 100%; margin-top: 16px; padding: 14px; background: rgba(232,93,44,0.12); border: 1px solid rgba(232,93,44,0.3); border-radius: 6px; color: #E85D2C; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; }
  button:hover { background: rgba(232,93,44,0.2); border-color: rgba(232,93,44,0.5); }
  .error { margin-top: 16px; font-size: 13px; color: rgba(239,68,68,0.8); text-align: center; display: none; }
  .success { margin-top: 16px; font-size: 13px; color: #E85D2C; text-align: center; display: none; }
  .divider { display: flex; align-items: center; gap: 16px; margin: 28px 0; }
  .divider-line { flex: 1; height: 1px; background: rgba(236,238,226,0.1); }
  .divider-text { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(236,238,226,0.2); }
  .toggle-link { display: block; text-align: center; margin-top: 24px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: rgba(236,238,226,0.25); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .toggle-link:hover { color: rgba(236,238,226,0.4); }
  .hidden { display: none; }
</style></head><body>
<div class="box">
  <h1>Admin Dashboard</h1>

  <!-- Email login (primary) -->
  <form id="email-form">
    <label for="em">Admin Email</label>
    <input type="email" id="em" placeholder="you@company.com" autofocus>
    <button type="submit">Send Login Link</button>
    <div class="success" id="email-ok">Check your email for a login link</div>
    <div class="error" id="email-err">Something went wrong</div>
  </form>

  <!-- Password login (fallback) -->
  <div class="toggle-link" id="show-pw">Sign in with password instead</div>
  <form id="pw-form" class="hidden">
    <label for="pw">Admin Password</label>
    <input type="password" id="pw" placeholder="Enter admin password">
    <button type="submit">Sign In</button>
    <div class="error" id="pw-err">Incorrect password</div>
  </form>
</div>
<script>
document.getElementById('show-pw').addEventListener('click', function() {
  document.getElementById('pw-form').classList.toggle('hidden');
  this.style.display = 'none';
  document.getElementById('pw').focus();
});

document.getElementById('email-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  document.getElementById('email-err').style.display = 'none';
  document.getElementById('email-ok').style.display = 'none';
  var email = document.getElementById('em').value.trim();
  if (!email) return;
  try {
    var r = await fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
    if (r.ok) {
      document.getElementById('email-ok').style.display = 'block';
      document.getElementById('em').value = '';
    } else {
      document.getElementById('email-err').style.display = 'block';
    }
  } catch(e) {
    document.getElementById('email-err').style.display = 'block';
  }
});

document.getElementById('pw-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  document.getElementById('pw-err').style.display = 'none';
  var r = await fetch('/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('pw').value }) });
  if (r.ok) location.reload();
  else { document.getElementById('pw-err').style.display = 'block'; document.getElementById('pw').value = ''; document.getElementById('pw').focus(); }
});
</script></body></html>`);
    return;
  }

  // Serve admin dashboard
  const html = readFileSync(join(process.cwd(), 'content', 'admin.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
};
