const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  // GET — list all admins
  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT id, email, created_at
      FROM admins
      ORDER BY created_at ASC
    `;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // POST — add admin
  if (req.method === 'POST') {
    const data = await parseBody(req);
    const email = (data.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid email required' }));
      return;
    }

    // Upsert to avoid duplicate errors
    const { rows } = await sql`
      INSERT INTO admins (email)
      VALUES (${email})
      ON CONFLICT (email) DO UPDATE SET email = ${email}
      RETURNING id, email, created_at
    `;

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows[0]));
    return;
  }

  // DELETE — remove admin
  if (req.method === 'DELETE') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');

    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'id required' }));
      return;
    }

    await sql`DELETE FROM admins WHERE id = ${parseInt(id)}`;
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
};
