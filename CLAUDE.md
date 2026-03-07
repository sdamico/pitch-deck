# Pitch Deck

## Working on Slides

**Always use the skill commands** for slide work — they load the full component library and scaffolding templates:

| Command | When to use |
|---------|-------------|
| `/add-slide <name> [--deck <deck>] [--section <section>] [--type <type>]` | Creating any new slide — scaffolds HTML + updates manifest |
| `/customize <change>` | Changing colors, fonts, or branding — knows all grep targets |
| `/build [deck-name]` | Building decks — reports slide count + output size |
| `/publish [deck-name]` | Publish standalone decks to the data room as hosted pages |
| `/dev` | Starting dev server with live reload (port 3334) |

**Do not create or modify slides without using `/add-slide` or reading the reference files first.**
The component library, HTML templates, and style rules are in the skill — not repeated here.

### Reference Files

| File | Contents |
|------|----------|
| `skills/pitch-deck/SKILL.md` | Framework: architecture, build pipeline, slide types, full component library, animation system |
| `content/head.html` | CSS source of truth (design system implementation) |

## Typography

| Role | Font | Weight | CSS Classes |
|------|------|--------|-------------|
| Headlines | DM Serif Text | 400 | `.section-title`, `.hero-title`, `.act-title` |
| Body | Inter | 400/700 | Body text, `.cap-card h4`, `.section-subtitle` |
| Data/Mono | JetBrains Mono | 300/500 | `.bar-label`, data tables, footnotes |

## Color Tokens

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#000000` | Background |
| `--text` | `#ECEEE2` | Primary text (warm cream) |
| `--text-secondary` | `rgba(236,238,226,0.5)` | Subtitles, descriptions |
| `--text-muted` | `rgba(236,238,226,0.2)` | Labels, captions |
| `--accent` | `#E85D2C` | Burnt orange accent |
| `--accent-soft` | `rgba(232,93,44,0.12)` | Accent backgrounds |
| `--divider` | `rgba(236,238,226,0.08)` | Borders, separators |

## Quick Reference

- **Canvas**: 1600×900 (16:9), CSS `scaleSlides()` scales `.slide > *` to fit viewport
- **Scroll**: `scroll-snap-type: y mandatory` on `html`, `scroll-snap-align: start` on `.slide`
- **Slide types**: `.hero`, `.section`, `.act-divider`, `.cta-section`
- **Reveals**: `.reveal` + `.reveal-delay-1` through `.reveal-delay-4` (intersection observer)
- **Bar charts**: `.bar-chart` with `.bar-fill[data-height]` animated on intersection
- **Style rule**: No inline styles for reusable patterns — use CSS classes in `content/head.html`

### Section Labeling Pattern

```html
<div class="section-label">LABEL</div>     <!-- accent uppercase micro-label -->
<div class="section-title">Title</div>     <!-- serif headline -->
<div class="section-subtitle">Sub</div>    <!-- 18px secondary text -->
```

### Images / Assets

Images in `public/images/` (served at `/images/` via Vercel).

## Hosting / Auth

- Hosted on Vercel (serverless Node.js)
- Auth: magic link email (Resend API) → session cookie
- Admin: password-protected dashboard at `/admin`
- Data room: file uploads + hosted pages at `/data`
- DB: Vercel Postgres (Neon)
