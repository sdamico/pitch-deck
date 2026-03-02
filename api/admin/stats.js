const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  // Unique viewers
  const { rows: viewerRows } = await sql`
    SELECT COUNT(DISTINCT email) AS count FROM sessions
  `;

  // Average active duration (based on heartbeat gaps ≤ 60s)
  const { rows: durationRows } = await sql`
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
    SELECT AVG(active_seconds) AS avg_seconds
    FROM active_time
    WHERE active_seconds > 0
  `;

  // Total sessions
  const { rows: sessionCountRows } = await sql`
    SELECT COUNT(*) AS count FROM sessions
  `;

  // Slide heatmap (views per slide)
  const { rows: heatmapRows } = await sql`
    SELECT slide_index, COUNT(*) AS views
    FROM events
    WHERE event_type = 'view'
    GROUP BY slide_index
    ORDER BY slide_index ASC
  `;

  // Most viewed slide
  const { rows: topSlideRows } = await sql`
    SELECT slide_index, COUNT(*) AS views
    FROM events
    WHERE event_type = 'view'
    GROUP BY slide_index
    ORDER BY views DESC
    LIMIT 1
  `;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    unique_viewers: parseInt(viewerRows[0]?.count || '0'),
    total_sessions: parseInt(sessionCountRows[0]?.count || '0'),
    avg_duration_seconds: parseFloat(durationRows[0]?.avg_seconds || '0'),
    most_viewed_slide: topSlideRows[0] ? {
      index: topSlideRows[0].slide_index,
      views: parseInt(topSlideRows[0].views),
    } : null,
    slide_heatmap: heatmapRows.map(r => ({
      slide_index: r.slide_index,
      views: parseInt(r.views),
    })),
  }));
};
