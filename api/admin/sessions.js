const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  const { rows } = await sql`
    WITH event_gaps AS (
      SELECT
        session_id,
        EXTRACT(EPOCH FROM (
          created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at)
        )) AS gap
      FROM events
    ),
    active_time AS (
      SELECT
        session_id,
        COALESCE(SUM(CASE WHEN gap <= 60 THEN gap ELSE 0 END), 0) AS active_seconds
      FROM event_gaps
      GROUP BY session_id
    )
    SELECT
      s.id,
      s.email,
      s.ip,
      s.created_at,
      s.last_seen,
      COUNT(DISTINCT e.slide_index) FILTER (WHERE e.event_type = 'view') AS slides_viewed,
      MAX(e.slide_index) FILTER (WHERE e.event_type = 'view') AS max_slide,
      COUNT(*) FILTER (WHERE e.event_type = 'heartbeat') AS heartbeat_count,
      COALESCE(at.active_seconds, 0) AS duration_seconds
    FROM sessions s
    LEFT JOIN events e ON e.session_id = s.id
    LEFT JOIN active_time at ON at.session_id = s.id
    GROUP BY s.id, at.active_seconds
    ORDER BY s.created_at DESC
    LIMIT 200
  `;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(rows));
};
