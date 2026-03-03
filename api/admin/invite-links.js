const { randomBytes } = require('crypto');
const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');
const { siteUrl } = require('../_lib/config');

function parsePositiveIntegerStrict(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET — list all invite links
  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT il.id, il.code, il.label, il.view_id, v.name AS view_name,
             il.grant_dr, il.expires_at, il.max_uses, il.use_count, il.created_at
      FROM invite_links il
      LEFT JOIN views v ON v.id = il.view_id
      ORDER BY il.created_at DESC
    `;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // POST — create new invite link
  if (req.method === 'POST') {
    let data;
    if (req.body) {
      data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      const body = await new Promise((resolve) => {
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
      data = body;
    }

    const code = randomBytes(16).toString('hex');
    const label = (data.label || '').trim() || null;
    const viewId = data.view_id != null ? parsePositiveIntegerStrict(data.view_id) : null;
    const grantDr = data.grant_dr === true; // default false — require explicit opt-in to avoid unscoped data room grants
    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
    const maxUses = data.max_uses != null ? parsePositiveIntegerStrict(data.max_uses) : null;

    if (data.view_id != null && viewId === null) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid view_id' }));
      return;
    }
    if (expiresAt !== null && isNaN(expiresAt.getTime())) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid expires_at' }));
      return;
    }
    if (data.max_uses != null && maxUses === null) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'max_uses must be a positive number' }));
      return;
    }

    const { rows } = await sql`
      INSERT INTO invite_links (code, label, view_id, grant_dr, expires_at, max_uses)
      VALUES (${code}, ${label}, ${viewId}, ${grantDr}, ${expiresAt}, ${maxUses})
      RETURNING id, code, label, view_id, grant_dr, expires_at, max_uses, use_count, created_at
    `;

    // siteUrl imported from config
    const link = rows[0];
    link.url = `${siteUrl}/join.html?code=${link.code}`;

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(link));
    return;
  }

  // DELETE — remove invite link
  if (req.method === 'DELETE') {
    const idParam = url.searchParams.get('id');
    const id = parsePositiveIntegerStrict(idParam);
    if (id === null) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid id required' }));
      return;
    }
    await sql`DELETE FROM invite_links WHERE id = ${id}`;
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
};
