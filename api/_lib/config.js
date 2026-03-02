// Centralized configuration — reads from environment variables with sensible defaults.
// Set SITE_URL, RESEND_FROM, ADMIN_PASSWORD in .env.local or Vercel dashboard.

module.exports = {
  siteUrl: process.env.SITE_URL || 'http://localhost:3334',
  resendFrom: process.env.RESEND_FROM || 'Pitch Deck <noreply@example.com>',
  adminPassword: process.env.ADMIN_PASSWORD || '',
};
