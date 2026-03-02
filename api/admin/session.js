const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');

  if (!id) {
    res.writeHead(400);
    res.end();
    return;
  }

  const { rows: sessionRows } = await sql`
    SELECT id, email, ip, user_agent, created_at, last_seen
    FROM sessions WHERE id = ${id}
  `;

  if (sessionRows.length === 0) {
    res.writeHead(404);
    res.end();
    return;
  }

  const { rows: eventRows } = await sql`
    SELECT slide_index, event_type, created_at
    FROM events
    WHERE session_id = ${id}
    ORDER BY created_at ASC
  `;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    session: sessionRows[0],
    events: eventRows,
  }));
};
