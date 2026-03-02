const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }

  // Per-page summary: unique viewers, total views, total time (heartbeats * 30s)
  const { rows: pageSummary } = await sql`
    SELECT
      page_slug,
      COUNT(*) FILTER (WHERE event_type = 'view') AS total_views,
      COUNT(*) FILTER (WHERE event_type = 'heartbeat') AS heartbeat_count,
      COUNT(DISTINCT email) FILTER (WHERE event_type = 'view') AS unique_viewers,
      MIN(created_at) AS first_viewed,
      MAX(created_at) AS last_viewed
    FROM data_room_page_views
    GROUP BY page_slug
    ORDER BY total_views DESC
  `;

  // Per-viewer breakdown: email, pages viewed, last viewed, total time
  const { rows: viewerDetails } = await sql`
    SELECT
      email,
      page_slug,
      COUNT(*) FILTER (WHERE event_type = 'view') AS views,
      COUNT(*) FILTER (WHERE event_type = 'heartbeat') AS heartbeats,
      MIN(created_at) AS first_viewed,
      MAX(created_at) AS last_viewed
    FROM data_room_page_views
    WHERE email IS NOT NULL
    GROUP BY email, page_slug
    ORDER BY last_viewed DESC
  `;

  // Resolve file:<id> slugs to file names
  const fileIds = [];
  const allSlugs = pageSummary.map(r => r.page_slug).concat(viewerDetails.map(r => r.page_slug));
  for (const s of allSlugs) {
    const m = s.match(/^file:(\d+)$/);
    if (m) fileIds.push(parseInt(m[1]));
  }

  let fileNames = {};
  if (fileIds.length > 0) {
    const uniqueIds = [...new Set(fileIds)];
    const { rows: files } = await sql`
      SELECT id, name FROM data_room_files WHERE id = ANY(${uniqueIds})
    `;
    for (const f of files) {
      fileNames[f.id] = f.name;
    }
  }

  function resolveSlug(slug) {
    const m = slug.match(/^file:(\d+)$/);
    if (m) {
      const name = fileNames[parseInt(m[1])];
      return { slug, type: 'file', display_name: name || 'File #' + m[1] };
    }
    return { slug, type: 'page', display_name: slug };
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    pages: pageSummary.map(r => ({
      ...resolveSlug(r.page_slug),
      total_views: parseInt(r.total_views || '0'),
      unique_viewers: parseInt(r.unique_viewers || '0'),
      total_time_seconds: parseInt(r.heartbeat_count || '0') * 30,
      first_viewed: r.first_viewed,
      last_viewed: r.last_viewed,
    })),
    viewers: viewerDetails.map(r => ({
      email: r.email,
      ...resolveSlug(r.page_slug),
      views: parseInt(r.views || '0'),
      time_seconds: parseInt(r.heartbeats || '0') * 30,
      first_viewed: r.first_viewed,
      last_viewed: r.last_viewed,
    })),
  }));
};
