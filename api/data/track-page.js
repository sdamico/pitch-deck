const { sql } = require('../_lib/db');
const { getSession } = require('../_lib/auth');

// NOTE: In-memory rate limiting is instance-scoped in serverless environments.
// This is acceptable for tracking endpoints where occasional duplicates are harmless.
// For auth endpoints, use DB-backed rate limiting instead.

// Per-session rate limiting: track last event timestamp per session
const rateLimitMap = new Map();
let rateLimitRequestCount = 0;
const MAX_INT32 = 2147483647;

function checkRateLimit(sessionId) {
  const now = Date.now();

  // Periodic cleanup: every 100 requests, purge entries older than 60s
  rateLimitRequestCount++;
  if (rateLimitRequestCount % 100 === 0) {
    for (const [key, ts] of rateLimitMap) {
      if (now - ts > 60000) rateLimitMap.delete(key);
    }
  }

  const lastTs = rateLimitMap.get(sessionId);
  if (lastTs && now - lastTs < 1000) {
    return false; // Too fast — reject
  }
  rateLimitMap.set(sessionId, now);
  return true;
}

function parseTrackPageTarget(slug) {
  const fileMatch = slug.match(/^file:(\d+)$/);
  if (fileMatch) {
    const fileId = Number(fileMatch[1]);
    if (!Number.isSafeInteger(fileId) || fileId <= 0 || fileId > MAX_INT32) {
      return null;
    }
    return { type: 'file', fileId };
  }

  if (slug.startsWith('file:')) {
    return null;
  }

  return { type: 'page', slug };
}

async function trackTargetExists(target) {
  if (target.type === 'file') {
    const { rows } = await sql`
      SELECT id FROM data_room_files
      WHERE id = ${target.fileId}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  const { rows } = await sql`
    SELECT id FROM data_room_files
    WHERE type = 'page' AND slug = ${target.slug}
    LIMIT 1
  `;
  return rows.length > 0;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  try {
    const session = await getSession(req);
    if (!session) {
      res.writeHead(401);
      res.end();
      return;
    }

    // Per-session rate limit: max 1 event per second
    if (!checkRateLimit(session.id)) {
      res.writeHead(429);
      res.end();
      return;
    }

    let data;
    if (req.body) {
      data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      const body = await new Promise((resolve, reject) => {
        let buf = '';
        req.on('data', chunk => {
          buf += chunk;
          if (buf.length > 4096) {
            reject(new Error('Body too large'));
          }
        });
        req.on('end', () => resolve(buf));
      });
      data = JSON.parse(body);
    }

    const slug = String(data.slug || '').trim();
    const eventType = data.event_type;

    if (!slug || !['view', 'heartbeat'].includes(eventType)) {
      res.writeHead(400);
      res.end();
      return;
    }

    // Slug sanity check: max 200 chars, alphanumeric + hyphens + underscores + colon (for file:<id>)
    if (slug.length > 200 || !/^[a-zA-Z0-9_:-]+$/.test(slug)) {
      res.writeHead(400);
      res.end();
      return;
    }

    const target = parseTrackPageTarget(slug);
    if (!target) {
      res.writeHead(400);
      res.end();
      return;
    }

    if (!(await trackTargetExists(target))) {
      res.writeHead(404);
      res.end();
      return;
    }

    await sql`
      INSERT INTO data_room_page_views (session_id, email, page_slug, event_type)
      VALUES (${session.id}, ${session.email}, ${slug}, ${eventType})
    `;

    res.writeHead(204);
    res.end();
  } catch (e) {
    if (e.message === 'Body too large') {
      res.writeHead(413);
      res.end();
      return;
    }
    console.error('Track page view error:', e);
    res.writeHead(500);
    res.end();
  }
};
