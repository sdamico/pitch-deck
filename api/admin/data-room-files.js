const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  // GET — list all files (without content)
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pageId = url.searchParams.get('page_id');

    let rows;
    if (pageId) {
      // Return assets for a specific page
      ({ rows } = await sql`
        SELECT id, name, folder, size_bytes, mime_type, uploaded_by, created_at, type, slug, page_id
        FROM data_room_files
        WHERE page_id = ${parseInt(pageId)}
        ORDER BY name
      `);
    } else {
      ({ rows } = await sql`
        SELECT id, name, folder, size_bytes, mime_type, uploaded_by, created_at, type, slug, page_id
        FROM data_room_files
        ORDER BY folder, name
      `);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // POST — move/rename file
  if (req.method === 'POST') {
    const data = await parseBody(req);
    const action = data.action;

    if (action === 'move') {
      const id = parseInt(data.id);
      const newFolder = data.folder;
      const newName = data.name;

      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'id required' }));
        return;
      }

      if (newFolder !== undefined && newName !== undefined) {
        await sql`UPDATE data_room_files SET folder = ${newFolder}, name = ${newName} WHERE id = ${id}`;
      } else if (newFolder !== undefined) {
        await sql`UPDATE data_room_files SET folder = ${newFolder} WHERE id = ${id}`;
      } else if (newName !== undefined) {
        await sql`UPDATE data_room_files SET name = ${newName} WHERE id = ${id}`;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown action' }));
    return;
  }

  // DELETE — delete file
  if (req.method === 'DELETE') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');

    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'id required' }));
      return;
    }

    await sql`DELETE FROM data_room_files WHERE id = ${parseInt(id)}`;

    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
};
