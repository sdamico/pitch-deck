const { readFileSync } = require('fs');
const { join } = require('path');
const { getSession } = require('./_lib/auth');
const { sql } = require('./_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }

  const session = await getSession(req);

  if (!session) {
    res.writeHead(302, { Location: '/login.html?next=%2Fdata' });
    res.end();
    return;
  }

  // Check data room access (exact email match, then domain pattern match)
  const { rows } = await sql`
    SELECT id FROM data_room_access
    WHERE LOWER(email) = LOWER(${session.email})
       OR (email LIKE '@%' AND LOWER(${session.email}) LIKE '%' || LOWER(email))
  `;

  if (rows.length === 0) {
    // Also allow admins
    const adminCheck = await sql`
      SELECT id FROM admins WHERE LOWER(email) = LOWER(${session.email})
    `;
    if (adminCheck.rows.length === 0) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Access Denied</title><style>body{background:#000;color:#ECEEE2;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}div{text-align:center}h1{font-size:20px;font-weight:400;margin-bottom:8px}p{color:rgba(236,238,226,0.5);font-size:14px}</style></head><body><div><h1>Access Denied</h1><p>You don\'t have access to the data room. Contact the team for access.</p></div></body></html>');
      return;
    }
  }

  const html = readFileSync(join(process.cwd(), 'content', 'data-room.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
};
