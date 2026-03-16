const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

function parseOptionalBoolean(value) {
  if (value == null || value === '') return null;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

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
          dra.full_access,
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
      SELECT dra.id, dra.email, dra.granted_by, dra.created_at, dra.view_id, dra.full_access, v.name AS view_name
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
    const fullAccessInput = parseOptionalBoolean(data.full_access);

    if (data.view_id != null && !Number.isInteger(viewId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid view_id' }));
      return;
    }
    if (fullAccessInput === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid full_access' }));
      return;
    }

    let rows;
    if (fullAccessInput == null && viewId == null) {
      // Preserve existing full_access state when caller doesn't specify either field.
      const result = await sql`
        INSERT INTO data_room_access (email, granted_by, view_id, full_access)
        VALUES (${email}, ${grantedBy}, ${viewId}, false)
        ON CONFLICT (email) DO UPDATE
          SET view_id = ${viewId}
        RETURNING id, email, granted_by, created_at, view_id, full_access
      `;
      rows = result.rows;
    } else {
      // Default when scoping to a view is to clear full-access unless explicitly provided.
      const fullAccess = fullAccessInput == null ? false : fullAccessInput;
      const result = await sql`
        INSERT INTO data_room_access (email, granted_by, view_id, full_access)
        VALUES (${email}, ${grantedBy}, ${viewId}, ${fullAccess})
        ON CONFLICT (email) DO UPDATE
          SET view_id = ${viewId}, full_access = ${fullAccess}
        RETURNING id, email, granted_by, created_at, view_id, full_access
      `;
      rows = result.rows;
    }

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
    const fullAccessInput = parseOptionalBoolean(data.full_access);

    if (data.view_id != null && !Number.isInteger(viewId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid view_id' }));
      return;
    }
    if (fullAccessInput === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid full_access' }));
      return;
    }

    let rows;
    if (fullAccessInput != null) {
      const result = await sql`
        UPDATE data_room_access
        SET view_id = ${viewId}, full_access = ${fullAccessInput}
        WHERE LOWER(email) = LOWER(${email})
        RETURNING id, email, view_id, full_access
      `;
      rows = result.rows;
    } else if (viewId != null) {
      // Setting a scoped view with no explicit full_access should remove broad access.
      const result = await sql`
        UPDATE data_room_access
        SET view_id = ${viewId}, full_access = false
        WHERE LOWER(email) = LOWER(${email})
        RETURNING id, email, view_id, full_access
      `;
      rows = result.rows;
    } else {
      const result = await sql`
        UPDATE data_room_access
        SET view_id = ${viewId}
        WHERE LOWER(email) = LOWER(${email})
        RETURNING id, email, view_id, full_access
      `;
      rows = result.rows;
    }

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
