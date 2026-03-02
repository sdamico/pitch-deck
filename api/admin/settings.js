const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

const ALLOWED_KEYS = ['access_mode'];

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  // GET — current settings
  if (req.method === 'GET') {
    const { rows } = await sql`SELECT key, value FROM settings`;
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(settings));
    return;
  }

  // POST — update setting
  if (req.method === 'POST') {
    const data = await parseBody(req);
    const { key, value } = data;

    if (!key || !value) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'key and value required' }));
      return;
    }

    // Reject unknown setting keys
    if (!ALLOWED_KEYS.includes(key)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown setting' }));
      return;
    }

    // Validate value for known settings
    if (key === 'access_mode' && !['allow_all', 'whitelist_only'].includes(value)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'access_mode must be allow_all or whitelist_only' }));
      return;
    }

    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = ${value}
    `;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(405);
  res.end();
};
