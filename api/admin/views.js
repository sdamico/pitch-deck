const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET — list all views, or single view with file_ids
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');

    if (id) {
      const { rows: views } = await sql`
        SELECT id, name, created_at FROM views WHERE id = ${parseInt(id)}
      `;
      if (views.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'View not found' }));
        return;
      }
      const { rows: files } = await sql`
        SELECT file_id FROM view_files WHERE view_id = ${parseInt(id)}
      `;
      const view = views[0];
      view.file_ids = files.map(f => f.file_id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(view));
      return;
    }

    const { rows } = await sql`
      SELECT v.id, v.name, v.created_at, COUNT(vf.file_id)::int AS file_count
      FROM views v
      LEFT JOIN view_files vf ON vf.view_id = v.id
      GROUP BY v.id, v.name, v.created_at
      ORDER BY v.name
    `;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // POST — create view or update file assignments
  if (req.method === 'POST') {
    const data = await parseBody(req);

    // Update file assignments for existing view
    if (data.id && data.file_ids) {
      const viewId = parseInt(data.id);
      const fileIds = data.file_ids;

      // Delete existing assignments
      await sql`DELETE FROM view_files WHERE view_id = ${viewId}`;

      // Insert new assignments
      for (const fileId of fileIds) {
        await sql`
          INSERT INTO view_files (view_id, file_id)
          VALUES (${viewId}, ${parseInt(fileId)})
        `;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: viewId, file_count: fileIds.length }));
      return;
    }

    // Create new view
    const name = (data.name || '').trim();
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Name required' }));
      return;
    }

    try {
      const { rows } = await sql`
        INSERT INTO views (name) VALUES (${name})
        RETURNING id, name, created_at
      `;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows[0]));
    } catch (err) {
      if (err.code === '23505') {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'View name already exists' }));
        return;
      }
      throw err;
    }
    return;
  }

  // DELETE — remove view
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'id required' }));
      return;
    }
    await sql`DELETE FROM views WHERE id = ${parseInt(id)}`;
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
};
