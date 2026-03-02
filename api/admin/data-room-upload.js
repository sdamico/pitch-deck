const { sql } = require('../_lib/db');
const { isAdminAuthed } = require('../_lib/admin-auth');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_PREFIXES = [
  'application/pdf', 'application/json', 'application/xml',
  'text/', 'image/', 'video/', 'audio/',
  'application/zip', 'application/gzip',
  'application/vnd.openxmlformats', 'application/vnd.ms-',
  'application/octet-stream'
];

function sanitizeFilename(name) {
  // Strip path components and dangerous characters
  return String(name)
    .replace(/[/\\]/g, '_')           // no path traversal
    .replace(/[<>"'`]/g, '')          // no HTML injection chars
    .replace(/\.\./g, '_')            // no parent directory
    .substring(0, 255);               // reasonable length limit
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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
  const action = url.searchParams.get('action') || 'simple';

  try {
    // --- Create page (entry point with empty content) ---
    if (action === 'create-page') {
      const name = url.searchParams.get('name');
      const slug = url.searchParams.get('slug');
      const folder = url.searchParams.get('folder') || '/';
      const uploadedBy = url.searchParams.get('uploaded_by') || null;

      if (!name || !slug) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'name and slug required' }));
        return;
      }

      // Validate slug format
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'slug must be lowercase alphanumeric with hyphens' }));
        return;
      }

      const safeName = sanitizeFilename(name);

      const { rows } = await sql`
        INSERT INTO data_room_files (name, folder, size_bytes, mime_type, uploaded_by, type, slug)
        VALUES (${safeName}, ${folder}, 0, 'text/html', ${uploadedBy}, 'page', ${slug})
        RETURNING id, slug
      `;

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows[0]));
      return;
    }

    // --- Chunked upload: init (creates row with empty bytea) ---
    if (action === 'init') {
      const filename = url.searchParams.get('filename');
      const folder = url.searchParams.get('folder') || '/';
      const sizeBytes = parseInt(url.searchParams.get('size') || '0');
      const mimeType = url.searchParams.get('mime_type') || 'application/octet-stream';
      const uploadedBy = url.searchParams.get('uploaded_by') || null;
      const pageId = url.searchParams.get('page_id') ? parseInt(url.searchParams.get('page_id')) : null;
      const isEntry = url.searchParams.get('is_entry') === '1';

      if (!filename) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'filename required' }));
        return;
      }

      const safeName = filename ? sanitizeFilename(filename) : null;

      if (sizeBytes > MAX_FILE_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File too large. Maximum size is 50MB.' }));
        return;
      }

      // If this is the entry HTML for a page, update the page row's content instead of inserting
      if (isEntry && pageId) {
        await sql`UPDATE data_room_files SET content = ''::bytea, size_bytes = ${sizeBytes} WHERE id = ${pageId}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: pageId }));
        return;
      }

      const { rows } = await sql`
        INSERT INTO data_room_files (name, folder, size_bytes, mime_type, uploaded_by, page_id)
        VALUES (${safeName}, ${folder}, ${sizeBytes}, ${mimeType}, ${uploadedBy}, ${pageId})
        RETURNING id
      `;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: rows[0].id }));
      return;
    }

    // --- Chunked upload: append chunk (base64 text → bytea via decode()) ---
    if (action === 'chunk') {
      const id = parseInt(url.searchParams.get('id'));
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'id required' }));
        return;
      }

      // Read the base64 chunk from request body with size enforcement
      const chunks = [];
      let totalBytes = 0;
      let tooLarge = false;
      for await (const chunk of req) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_FILE_SIZE) {
          tooLarge = true;
          req.socket?.destroy();
          break;
        }
        chunks.push(chunk);
      }
      if (tooLarge) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File too large. Maximum size is 50MB.' }));
        return;
      }
      const chunkBase64 = Buffer.concat(chunks).toString('utf8');

      // Append decoded binary to the bytea column
      await sql`
        UPDATE data_room_files
        SET content = content || decode(${chunkBase64}, 'base64')
        WHERE id = ${id}
      `;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // --- Chunked upload: finish ---
    if (action === 'finish') {
      const id = parseInt(url.searchParams.get('id'));
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'id required' }));
        return;
      }

      const { rows } = await sql`
        SELECT id, name, folder, size_bytes, mime_type, uploaded_by, created_at
        FROM data_room_files WHERE id = ${id}
      `;

      if (rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'file not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows[0]));
      return;
    }

    // --- Simple upload (small files < 4MB) ---
    if (action === 'simple') {
      const filename = url.searchParams.get('filename');
      const folder = url.searchParams.get('folder') || '/';
      const uploadedBy = url.searchParams.get('uploaded_by') || null;
      const pageId = url.searchParams.get('page_id') ? parseInt(url.searchParams.get('page_id')) : null;
      const isEntry = url.searchParams.get('is_entry') === '1';

      if (!filename) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'filename required' }));
        return;
      }

      const safeName = filename ? sanitizeFilename(filename) : null;

      const chunks = [];
      let totalBytes = 0;
      let tooLarge = false;
      for await (const chunk of req) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_FILE_SIZE) {
          tooLarge = true;
          req.socket?.destroy();
          break;
        }
        chunks.push(chunk);
      }
      if (tooLarge) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File too large. Maximum size is 50MB.' }));
        return;
      }
      const buffer = Buffer.concat(chunks);
      const contentBase64 = buffer.toString('base64');
      const sizeBytes = buffer.length;
      const mimeType = req.headers['content-type'] || 'application/octet-stream';

      if (!ALLOWED_MIME_PREFIXES.some(p => mimeType.startsWith(p))) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File type not allowed' }));
        return;
      }

      // If this is the entry HTML for a page, update the page row's content
      if (isEntry && pageId) {
        await sql`
          UPDATE data_room_files
          SET content = decode(${contentBase64}, 'base64'), size_bytes = ${sizeBytes}
          WHERE id = ${pageId}
        `;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: pageId, updated: true }));
        return;
      }

      const { rows } = await sql`
        INSERT INTO data_room_files (name, folder, content, size_bytes, mime_type, uploaded_by, page_id)
        VALUES (${safeName}, ${folder}, decode(${contentBase64}, 'base64'), ${sizeBytes}, ${mimeType}, ${uploadedBy}, ${pageId})
        RETURNING id, name, folder, size_bytes, mime_type, uploaded_by, created_at
      `;

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows[0]));
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown action' }));
  } catch (e) {
    console.error('Upload error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upload failed' }));
  }
};
