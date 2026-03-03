const { readFileSync } = require('fs');
const { join } = require('path');
const { getSession } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }

  const session = await getSession(req);

  if (!session) {
    res.writeHead(302, { Location: '/login.html' });
    res.end();
    return;
  }

  const html = readFileSync(join(process.cwd(), 'content', 'page.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
};
