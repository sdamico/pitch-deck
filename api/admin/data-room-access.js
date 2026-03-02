const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  // GET — list all users with access, plus all known viewer emails for easy toggling
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const view = url.searchParams.get('view');

    if (view === 'viewers') {
      // Return all known emails: sessions + whitelisted + already-granted
      const { rows } = await sql`
        SELECT e.email,
          CASE WHEN dra.id IS NOT NULL THEN true ELSE false END AS has_access,
          dra.view_id,
          v.name AS view_name
        FROM (
          SELECT DISTINCT LOWER(email) AS email FROM sessions
          UNION
          SELECT LOWER(pattern) FROM email_rules WHERE rule_type = 'allow' AND pattern NOT LIKE '@%'
          UNION
          SELECT LOWER(email) FROM data_room_access WHERE email NOT LIKE '@%'
        ) e
        LEFT JOIN data_room_access dra ON LOWER(dra.email) = e.email
        LEFT JOIN views v ON v.id = dra.view_id
        ORDER BY e.email
      `;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      return;
    }

    const { rows } = await sql`
      SELECT dra.id, dra.email, dra.granted_by, dra.created_at, dra.view_id, v.name AS view_name
      FROM data_room_access dra
      LEFT JOIN views v ON v.id = dra.view_id
      ORDER BY dra.created_at DESC
    `;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // POST — grant access (with optional view_id)
  if (req.method === 'POST') {
    const data = await parseBody(req);
    const email = (data.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid email required' }));
      return;
    }

    const grantedBy = data.granted_by || null;
    const viewId = data.view_id != null ? parseInt(data.view_id) : null;

    const { rows } = await sql`
      INSERT INTO data_room_access (email, granted_by, view_id)
      VALUES (${email}, ${grantedBy}, ${viewId})
      ON CONFLICT (email) DO UPDATE SET view_id = ${viewId}
      RETURNING id, email, granted_by, created_at, view_id
    `;

    res.writeHead(rows.length > 0 ? 200 : 201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows[0]));
    return;
  }

  // PATCH — update view_id on existing access row
  if (req.method === 'PATCH') {
    const data = await parseBody(req);
    const email = (data.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid email required' }));
      return;
    }

    const viewId = data.view_id != null ? parseInt(data.view_id) : null;

    const { rows } = await sql`
      UPDATE data_room_access
      SET view_id = ${viewId}
      WHERE LOWER(email) = LOWER(${email})
      RETURNING id, email, view_id
    `;

    if (rows.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access row not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows[0]));
    return;
  }

  // DELETE — revoke access
  if (req.method === 'DELETE') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');
    const email = url.searchParams.get('email');

    if (id) {
      await sql`DELETE FROM data_room_access WHERE id = ${parseInt(id)}`;
    } else if (email) {
      await sql`DELETE FROM data_room_access WHERE LOWER(email) = LOWER(${email})`;
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'id or email required' }));
      return;
    }

    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
};
