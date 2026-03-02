const { sql } = require('../_lib/db');
const { isAdminAuthed, parseBody } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (!(await isAdminAuthed(req))) {
    res.writeHead(401);
    res.end();
    return;
  }

  // GET — list all rules
  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT id, pattern, rule_type, created_at
      FROM email_rules
      ORDER BY created_at DESC
    `;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }

  // POST — create rule
  if (req.method === 'POST') {
    const data = await parseBody(req);
    const pattern = (data.pattern || '').trim().toLowerCase();
    const ruleType = data.rule_type;

    if (!pattern || !['allow', 'block'].includes(ruleType)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'pattern and rule_type (allow|block) required' }));
      return;
    }

    const { rows } = await sql`
      INSERT INTO email_rules (pattern, rule_type)
      VALUES (${pattern}, ${ruleType})
      RETURNING id, pattern, rule_type, created_at
    `;

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows[0]));
    return;
  }

  // DELETE — remove rule
  if (req.method === 'DELETE') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');

    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'id required' }));
      return;
    }

    await sql`DELETE FROM email_rules WHERE id = ${parseInt(id)}`;
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end();
};
