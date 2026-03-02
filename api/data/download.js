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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const fileId = url.searchParams.get('id');

  if (!fileId) {
    res.writeHead(400);
    res.end();
    return;
  }

  // Use encode() to get base64 from bytea — avoids driver-specific bytea handling
  const { rows } = await sql`
    SELECT id, name, encode(content, 'base64') AS content_b64, mime_type, size_bytes, page_id
    FROM data_room_files
    WHERE id = ${parseInt(fileId)}
  `;

  if (rows.length === 0) {
    res.writeHead(404);
    res.end();
    return;
  }

  const file = rows[0];

  // View-based access check: null view_id with no full_access flag means no access (not full access)
  if (!isAdmin && !fullAccess) {
    if (!viewId) {
      // No explicit view scope and no full_access — deny
      res.writeHead(403);
      res.end();
      return;
    }
    // View-scoped check: file must be in the view, or be a page asset whose parent is in view
    const checkId = file.page_id || file.id;
    const { rows: allowed } = await sql`
      SELECT 1 FROM view_files WHERE view_id = ${viewId} AND file_id = ${checkId}
    `;
    if (allowed.length === 0) {
      res.writeHead(403);
      res.end();
      return;
    }
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

  // Log the download
  await sql`
    INSERT INTO data_room_downloads (file_id, file_name, session_id, email, ip)
    VALUES (${file.id}, ${file.name}, ${session.id}, ${session.email}, ${ip})
  `;

  // Decode base64 to binary and serve
  const buffer = Buffer.from(file.content_b64 || '', 'base64');
  const preview = url.searchParams.get('preview') === '1';
  const disposition = preview ? 'inline' : `attachment; filename="${encodeURIComponent(file.name)}"`;
  res.writeHead(200, {
    'Content-Type': file.mime_type || 'application/octet-stream',
    'Content-Length': buffer.length,
    'Content-Disposition': disposition,
    'Cache-Control': 'no-store',
  });
  res.end(buffer);
};
