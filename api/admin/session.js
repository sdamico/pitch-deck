const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }

  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = (url.searchParams.get('id') || '').trim().toLowerCase();

  if (!/^[a-f0-9]{32}$/.test(id)) {
    res.writeHead(400);
    res.end();
    return;
  }

  const { rows: sessionRows } = await sql`
    SELECT id, email, ip, user_agent, created_at, last_seen
    FROM sessions WHERE md5(id) = ${id}
  `;

  if (sessionRows.length === 0) {
    res.writeHead(404);
    res.end();
    return;
  }

  const rawSessionId = sessionRows[0].id;

  const { rows: eventRows } = await sql`
    SELECT slide_index, event_type, created_at
    FROM events
    WHERE session_id = ${rawSessionId}
    ORDER BY created_at ASC
  `;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    session: {
      id,
      email: sessionRows[0].email,
      ip: sessionRows[0].ip,
      user_agent: sessionRows[0].user_agent,
      created_at: sessionRows[0].created_at,
      last_seen: sessionRows[0].last_seen,
    },
    events: eventRows,
  }));
};
