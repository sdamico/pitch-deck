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
    const slug = new URL(req.url, `http://${req.headers.host}`).searchParams.get('slug');
    const next = slug ? `/data/pages/${encodeURIComponent(slug)}` : '/data';
    res.writeHead(302, { Location: `/login.html?next=${encodeURIComponent(next)}` });
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
  const slug = url.searchParams.get('slug');
  const asset = url.searchParams.get('asset');

  if (!slug) {
    res.writeHead(400);
    res.end();
    return;
  }

  // Look up the page entry point
  const { rows: pages } = await sql`
    SELECT id, name, encode(content, 'base64') AS content_b64, mime_type
    FROM data_room_files
    WHERE slug = ${slug} AND type = 'page'
  `;

  if (pages.length === 0) {
    res.writeHead(404);
    res.end('Page not found');
    return;
  }

  const page = pages[0];

  // View-based access check: null view_id with no full_access flag means no access (not full access)
  if (!isAdmin && !fullAccess) {
    if (!viewId) {
      // No explicit view scope and no full_access — deny
      res.writeHead(403);
      res.end();
      return;
    }
    // View-scoped check: page must be in the view
    const { rows: allowed } = await sql`
      SELECT 1 FROM view_files WHERE view_id = ${viewId} AND file_id = ${page.id}
    `;
    if (allowed.length === 0) {
      res.writeHead(403);
      res.end();
      return;
    }
  }

  // Serve asset file
  if (asset) {
    const { rows: assets } = await sql`
      SELECT name, encode(content, 'base64') AS content_b64, mime_type
      FROM data_room_files
      WHERE page_id = ${page.id} AND name = ${asset}
    `;

    if (assets.length === 0) {
      res.writeHead(404);
      res.end('Asset not found');
      return;
    }

    const file = assets[0];
    const buffer = Buffer.from(file.content_b64 || '', 'base64');
    res.writeHead(200, {
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(buffer);
    return;
  }

  // Serve page HTML — inject <base> tag so relative asset paths resolve correctly
  let html = Buffer.from(page.content_b64 || '', 'base64').toString('utf8');
  const baseTag = `<base href="/data/pages/${encodeURIComponent(slug)}/">`;
  // Insert after <head> if present, otherwise prepend
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + baseTag);
  } else if (html.includes('<HEAD>')) {
    html = html.replace('<HEAD>', '<HEAD>' + baseTag);
  } else {
    html = baseTag + html;
  }

  // Inject page view tracking script
  const trackingScript = `<script>(function(){var s="${slug.replace(/"/g, '\\"')}";function t(e){try{navigator.sendBeacon("/api/data/track-page",new Blob([JSON.stringify({slug:s,event_type:e})],{type:"application/json"}))}catch(x){}}t("view");setInterval(function(){t("heartbeat")},30000)})()</script>`;
  if (html.includes('</body>')) {
    html = html.replace('</body>', trackingScript + '</body>');
  } else if (html.includes('</BODY>')) {
    html = html.replace('</BODY>', trackingScript + '</BODY>');
  } else {
    html += trackingScript;
  }

  const buffer = Buffer.from(html, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
  });
  res.end(buffer);
};
