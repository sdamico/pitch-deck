# pitch-deck

Full-stack pitch deck framework with magic link auth, session tracking, slide analytics, admin dashboard, and a 16:9 animated slide engine. Ships as a Vercel project.

Comes with a demo deck for **American Nail** — a parody nail company "defeating communism one fastener at a time" with products like The Patriot-16, The Citadel, and The Minuteman. The demo showcases every component in the design system: hero backgrounds, bar charts, image grids, capability cards, testimonials, and more.

## Features

- **16:9 animated slide engine** — fixed-canvas scaling, scroll-snap navigation, reveal animations, bar chart animations
- **Magic link auth** — passwordless login via email (Resend)
- **Session tracking** — slide views + heartbeat beacons
- **Admin dashboard** — manage access, invites, analytics
- **Data room** — access-controlled file sharing with download tracking
- **Invite links** — temporary codes for granting access
- **Responsive** — works on desktop + mobile (landscape lock, tap navigation)
- **Dot rail navigation** — section-level nav on desktop, bottom sheet on mobile

## Quick Start

```bash
# Install deps
npm install

# Build the deck (concatenates slides into content/page.html)
node build.js

# Start local dev server (no auth, no DB needed)
node dev-server.js

# Open http://localhost:3334
```

## Deploy to Vercel

### Option A: GitHub Actions (recommended)

A CI workflow at `.github/workflows/deploy.yml` handles build + deploy. Push to `main` deploys to production; PRs get preview deployments with a comment.

1. Create a Vercel project: `vercel link`
2. Add a Neon Postgres database (or any Postgres)
3. Run the migrations in `migrations/` against your database
4. Set these **GitHub repository secrets** (Settings > Secrets > Actions):

| GitHub Secret | Purpose |
|---------------|---------|
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |
| `POSTGRES_URL` | Neon/Postgres connection string |
| `RESEND_API_KEY` | Email sending (magic links) |
| `RESEND_FROM` | Verified sender email address (e.g. `Acme <noreply@acme.com>`) |
| `SITE_URL` | Production URL (e.g. `https://deck.acme.com`) |
| `ADMIN_PASSWORD` | Admin dashboard password |

The workflow syncs these secrets to Vercel env vars on each deploy.

### Option B: Direct Vercel deploy

1. `vercel link` to create/connect a project
2. Set env vars in the Vercel dashboard (see table above, skip VERCEL_* ones)
3. `vercel --prod` to deploy

### Configuration

All runtime config lives in `api/_lib/config.js` and reads from environment variables:

```js
siteUrl:   process.env.SITE_URL    || 'http://localhost:3334'
resendFrom: process.env.RESEND_FROM || 'Pitch Deck <noreply@example.com>'
```

For local dev, create `.env.local` (gitignored) with your values, or just use the defaults.

## Creating Your Own Deck

1. Edit `content/slides.yaml` to define sections and slide order
2. Create HTML files in `content/slides/` for each slide
3. Customize colors in `content/head.html` (`:root` CSS variables)
4. Run `node build.js` to regenerate `content/page.html`

### Slide Types

Each slide is a `<div class="slide">` containing a `<section>` of one type:

- `.hero` — full-bleed hero with background
- `.section` — standard content slide (1600x900, padded)
- `.act-divider` — full-screen interstitial
- `.cta-section` — closing slide

### CSS Variables

```css
:root {
  --bg: #000000;           /* Background */
  --text: #ECEEE2;         /* Primary text */
  --text-secondary: ...;   /* Subtitles */
  --text-muted: ...;       /* Labels */
  --accent: #E85D2C;       /* Brand accent */
  --accent-soft: ...;      /* Accent backgrounds */
  --divider: ...;          /* Borders */
}
```

### Layout Components

- `.cap-grid` — 3/4/2 column card grid
- `.channels-grid` — 3 column info cards
- `.window-grid` — 2 column stat cards
- `.bar-chart` — animated vertical bar chart
- `.comparison-table` — data comparison table
- `.econ-callout` — centered big-number callout
- `.team-grid` — 2 column team member cards
- `.timeline-grid` — 3 column timeline
- `.logo-wall` — horizontal pill-style logo list

## Project Structure

```
pitch-deck/
├── build.js              # Concatenates slides into page.html
├── dev-server.js         # Local dev server (port 3334)
├── package.json
├── vercel.json           # Vercel deployment config
├── content/
│   ├── head.html         # <head>, CSS, nav
│   ├── tail.html         # Scripts (nav, tracking, scaling)
│   ├── slides.yaml       # Slide manifest
│   └── slides/           # Individual slide HTML files
├── api/                  # Vercel serverless functions
│   ├── _lib/             # Shared utilities (auth, db)
│   ├── page.js           # Serve deck (auth required)
│   ├── login.js          # Magic link send
│   ├── verify.js         # Token verification
│   ├── track.js          # Slide tracking beacons
│   ├── admin.js          # Admin dashboard
│   └── admin/            # Admin management endpoints
├── migrations/           # PostgreSQL schema
└── public/               # Static assets (fonts, login page)
```
