const { getSession } = require('../_lib/auth');
const { sql } = require('../_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }

  const session = await getSession(req);
  if (!session) {
    res.writeHead(401);
    res.end();
    return;
  }

  // Check data room access and capture view_id / full_access flag
  let viewId = null;
  let fullAccess = false;
  let isAdmin = false;

  const { rows: access } = await sql`
    SELECT id, view_id, full_access FROM data_room_access
    WHERE LOWER(email) = LOWER(${session.email})
       OR (email LIKE '@%' AND LOWER(${session.email}) LIKE '%' || LOWER(email))
    ORDER BY CASE WHEN email LIKE '@%' THEN 1 ELSE 0 END
    LIMIT 1
  `;
  if (access.length > 0) {
    viewId = access[0].view_id;
    fullAccess = access[0].full_access === true;
  } else {
    const { rows: admin } = await sql`
      SELECT id FROM admins WHERE LOWER(email) = LOWER(${session.email})
    `;
    if (admin.length === 0) {
      res.writeHead(403);
      res.end();
      return;
    }
    isAdmin = true;
  }

  let rows;

  if (!isAdmin && !fullAccess) {
    if (!viewId) {
      // No explicit view scope and no full_access — deny
      res.writeHead(403);
      res.end();
      return;
    }
    // User has a scoped view — only return files that are in the view
    const result = await sql`
      SELECT f.id, f.name, f.folder, f.size_bytes, f.mime_type, f.created_at, f.type, f.slug
      FROM data_room_files f
      INNER JOIN view_files vf ON vf.file_id = f.id AND vf.view_id = ${viewId}
      WHERE f.name != '.folder' AND f.page_id IS NULL
      ORDER BY f.folder, f.name
    `;
    rows = result.rows;
  } else {
    // Admin or explicit full_access — return all files
    const result = await sql`
      SELECT id, name, folder, size_bytes, mime_type, created_at, type, slug
      FROM data_room_files
      WHERE name != '.folder' AND page_id IS NULL
      ORDER BY folder, name
    `;
    rows = result.rows;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(rows));
};
