const { sql } = require('./db');

async function isEmailAllowed(email) {
  const lower = email.toLowerCase();

  // Admins always have access (bypass all rules)
  const { rows: adminRows } = await sql`
    SELECT id FROM admins WHERE LOWER(email) = ${lower}
  `;
  if (adminRows.length > 0) return true;

  // Check explicit block rules first
  const { rows: blockRules } = await sql`
    SELECT pattern FROM email_rules WHERE rule_type = 'block'
  `;
  for (const rule of blockRules) {
    if (matchesPattern(lower, rule.pattern)) return false;
  }

  // Check access mode
  const { rows: settings } = await sql`
    SELECT value FROM settings WHERE key = 'access_mode'
  `;
  const mode = settings[0]?.value || 'allow_all';

  if (mode === 'allow_all') return true;

  // Whitelist mode — must match an allow rule
  const { rows: allowRules } = await sql`
    SELECT pattern FROM email_rules WHERE rule_type = 'allow'
  `;
  for (const rule of allowRules) {
    if (matchesPattern(lower, rule.pattern)) return true;
  }

  return false;
}

function matchesPattern(email, pattern) {
  const p = pattern.toLowerCase();
  // Domain pattern: @domain.com
  if (p.startsWith('@')) {
    const domain = email.split('@')[1];
    const patternDomain = p.substring(1);
    // Match exact domain or any subdomain
    return domain === patternDomain || domain.endsWith('.' + patternDomain);
  }
  // Exact email match
  return email === p;
}

module.exports = { isEmailAllowed };
