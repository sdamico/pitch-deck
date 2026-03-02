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

  const { rows } = await sql`
    SELECT d.id, d.file_name, d.email, d.ip, d.created_at,
           f.name AS current_file_name, f.folder
    FROM data_room_downloads d
    LEFT JOIN data_room_files f ON d.file_id = f.id
    ORDER BY d.created_at DESC
    LIMIT 500
  `;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(rows));
};
