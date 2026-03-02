const { sql } = require('./_lib/db');
const { getSession } = require('./_lib/auth');

// NOTE: In-memory rate limiting is instance-scoped in serverless environments.
// This is acceptable for tracking endpoints where occasional duplicates are harmless.
// For auth endpoints, use DB-backed rate limiting instead.

// Per-session rate limiting: track last event timestamp per session
const rateLimitMap = new Map();
let rateLimitRequestCount = 0;

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

    const slideIndex = parseInt(data.slide_index, 10);
    const eventType = data.event_type;

    if (isNaN(slideIndex) || !['view', 'heartbeat'].includes(eventType)) {
      res.writeHead(400);
      res.end();
      return;
    }

    // Bounds check: slide_index must be between 0 and 99
    if (slideIndex < 0 || slideIndex > 99) {
      res.writeHead(400);
      res.end();
      return;
    }

    await sql`
      INSERT INTO events (session_id, slide_index, event_type)
      VALUES (${session.id}, ${slideIndex}, ${eventType})
    `;

    res.writeHead(204);
    res.end();
  } catch (e) {
    if (e.message === 'Body too large') {
      res.writeHead(413);
      res.end();
      return;
    }
    console.error('Track error:', e);
    res.writeHead(500);
    res.end();
  }
};
