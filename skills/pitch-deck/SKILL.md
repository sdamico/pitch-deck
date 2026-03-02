---
name: pitch-deck
description: >
  Full-stack 16:9 pitch deck framework: slide engine with scroll animations, magic link auth,
  session analytics, admin dashboard, data room. Build pipeline: slides.yaml → build.js → page.html.
  Design system with 4 slide types, 15+ component classes, CSS custom properties, and responsive
  desktop/mobile layouts. Deploy on Vercel.
---

# Pitch Deck — Design System & Build Guide

## Architecture Overview

```
content/
  slides.yaml          ← Slide manifest (sections + ordering)
  head.html            ← CSS design system (1200 lines)
  slides/*.html        ← Individual slide files
  tail.html            ← JavaScript engine (520 lines)
  page.html            ← Generated output (DO NOT EDIT)
build.js               ← Build pipeline (zero deps)
public/
  login.html           ← Magic link login
  join.html            ← Invite-code registration
  fonts/*.woff2        ← Inter, DM Serif Text, JetBrains Mono
api/                   ← Vercel serverless endpoints
  _lib/                ← Shared auth, DB, config
  admin/               ← Admin dashboard routes
migrations/            ← PostgreSQL schema (7 files)
```

### Build Pipeline

`node build.js` reads `slides.yaml`, concatenates `head.html` + all slide files + `tail.html`,
injects navigation JS arrays (`groups[]`, `sectionNames{}`), writes `content/page.html`.

**Zero external build dependencies** — uses only Node.js `fs` + `path`.

### Manifest Format (`content/slides.yaml`)

```yaml
sections:
  - name: Section Name
    slides:
      - slide-slug
      - another-slug
  - name: Next Section
    slides:
      - third-slug
```

Slide slugs must be kebab-case, matching `content/slides/<slug>.html`.
The build system maps each slide to its section index for dot-rail navigation.

---

## CSS Design Tokens

All theming is driven by `:root` custom properties in `content/head.html`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `--bg` | `#000000` | Page background |
| `--bg-deep` | `#000000` | Deep background variant |
| `--bg-surface` | `rgba(255,255,255,0.03)` | Card/surface fill |
| `--text` | `#ECEEE2` | Primary text (warm cream) |
| `--text-secondary` | `rgba(236,238,226,0.5)` | Secondary text |
| `--text-muted` | `rgba(236,238,226,0.2)` | Tertiary/muted text |
| `--accent` | `#E85D2C` | Accent color (burnt orange) |
| `--accent-soft` | `rgba(232,93,44,0.12)` | Accent at low opacity |
| `--divider` | `rgba(236,238,226,0.08)` | Borders and dividers |

### Typography

| Font | Weights | Usage |
|------|---------|-------|
| **Inter** | 400, 700 | Body, labels, cards, UI chrome |
| **DM Serif Text** | 400 | Headlines, hero titles, big numbers |
| **JetBrains Mono** | 300-500 | Navigation dots, slide counter, bar labels |

### Key Sizes

- **Slide canvas**: 1600×900px, scaled to fit viewport
- **Section padding**: `32px 200px` (desktop), `32px 60px` (mobile)
- **Spacing rhythm**: 16, 24, 32, 48, 64px
- **Border radius**: 8px (cards), 12px (accordions), 100px (pills)

---

## Slide Types (4)

Every slide wraps in `<div class="slide">` which provides viewport-height centering and scaling.

### 1. `.hero` — Opening title slide
Full-screen centered with radial accent gradient backdrop. Animated entry with staggered keyframes.

**Structure**: `.hero-title` → `.hero-descriptor` → `.hero-benefit` → `.hero-stats` → `.hero-scroll`

**Key classes**: `.hero-logo-lockup`, `.stat-block` (`.stat-number` + `.stat-label`), `.scroll-line`

### 2. `.section` — Standard content slide
The workhorse. 1600×900 canvas with `padding: 32px 200px`, flexbox column with vertical centering.
Header block (`.section-label` + `.section-title` + `.section-subtitle`) followed by any component grid.

**Pattern**: header in first `.reveal`, body components in subsequent `.reveal.reveal-delay-N` wrappers.

### 3. `.act-divider` — Cinematic section break
Full-canvas centered text with dark overlay. Optional `.has-bg` variant for background images.

**Structure**: `.act-label` → `.act-title` → `.act-subtitle` → optional `.act-stats`

### 4. `.cta-section` — Closing / call-to-action
Centered layout for the final slide. Typically: brand mark → `.cta-title` → `.cta-sub` → `.footer`.

---

## Component Library (15+ classes)

All components go inside `.section` slides. Wrap in `.reveal .reveal-delay-N` for scroll animation.

### Grid Components

| Class | Columns | Best For |
|-------|---------|----------|
| `.cap-grid` | 3 (default) | Feature cards, capabilities |
| `.cap-grid.cols-2` | 2 | Two-item comparisons |
| `.cap-grid.cols-4` | 4 | Dense feature grids |
| `.channels-grid` | 3 | Priorities, product specs |
| `.window-grid` | 2 | KPI callouts, big metrics |
| `.timeline-grid` | 3 | Roadmap, milestones |
| `.team-grid` | 2 | Team bios with photos |
| `.partner-grid` | 4 | Investor/partner cards (expandable on mobile) |

All grid components use `gap: 1px` with `background: var(--divider)` for 1px borders between cells.

### Data Visualization

| Class | Purpose |
|-------|---------|
| `.bar-chart` | Animated vertical bar chart (bars grow on scroll) |
| `.comparison-table` | 3-column feature comparison with check/x marks |
| `.econ-callout` | Single big-number emphasis block |
| `.inline-bar` | Horizontal progress bar with labels |

**Bar chart**: Each `.bar` contains `.bar-value` (label above), `.bar-fill` (the bar itself), `.bar-label` (below). Set `data-height="0-100"` for percentage height. Initial `style="height:0"` — JS animates on scroll.

### Interactive

| Class | Purpose |
|-------|---------|
| `.accordion-row` + `.accordion-expand` | Click-to-expand panels |
| `.core-tab` + `.tab-container` | Tab navigation with active state (`.core-tab-active`) |

### Decorative

| Class | Purpose |
|-------|---------|
| `.logo-wall` + `.logo-pill` | Flex-wrapped pill badges (investors, press, partners) |
| `.detail-card` | Simple dark card for supporting details |

### Images

| Class | Purpose |
|-------|---------|
| `.hero-bg-img` | Full-bleed hero background (absolute, `opacity: 0.3`, `background-size: cover`) |
| `.slide-img` | Block image with rounded corners + border (fills container width) |
| `.slide-img-sm` | Small product thumbnail (`max-width: 200px`, `margin-bottom: 16px`) |
| `.img-text-grid` | 2-column grid: text left, image right (`gap: 64px`, vertically centered) |

**Hero background**: Add a `<div class="hero-bg-img" style="background-image:url('images/photo.png')">` inside `.hero`.

**Side-by-side layout**: Use `.img-text-grid` with text content on the left and `<img class="slide-img">` on the right.

**Product thumbnails**: Add `<img class="slide-img-sm">` at the top of a `.channel-card` or `.cap-card`.

Images go in `public/images/` and are referenced as `images/filename.png` (relative to the build output).

### Utility

| Class | Purpose |
|-------|---------|
| `.cap-card.featured` | Highlighted card (accent-tinted background) |
| `.highlight` | Inline accent badge (`SHIPPING NOW`, `Q3 2026`) |
| `.partner-card.featured` | Highlighted partner (accent name color) |
| `.timeline-card.current` | Current timeline phase (accent year color) |
| `.bar-fill.muted` | Dimmed bar (past/projected data) |

---

## Animation System

### Scroll Reveals
Add `.reveal` to any element for fade-up-on-scroll animation (opacity 0→1, translateY 32px→0).

Stagger with delay classes:
- `.reveal-delay-1` — 80ms delay
- `.reveal-delay-2` — 160ms delay
- `.reveal-delay-3` — 240ms delay
- `.reveal-delay-4` — 320ms delay

Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (smooth deceleration)

IntersectionObserver adds `.visible` class when 20% of element enters viewport.

### Hero Keyframes
Hero elements use `@keyframes heroReveal` with cascading animation-delay (0.1s → 1.4s).
`.scroll-line` pulses with `@keyframes scrollPulse`.

### Bar Chart Animation
Bars start at `height: 0` and animate to their `data-height` percentage when the chart scrolls into view (IntersectionObserver trigger).

---

## Responsive Behavior

| Feature | Desktop (>1024px) | Mobile (≤1024px) |
|---------|-------------------|------------------|
| Navigation | Dot rail on right edge | FAB bottom sheet |
| Slide padding | `32px 200px` | `32px 60px` |
| Slide height | `100vh` / `100dvh` | `100vw * 9/16` (portrait) |
| Partner cards | Always expanded | Tap to expand |
| Progress indicator | Appears on scroll (fades) | Always visible FAB |

---

## Workflow: Adding a Slide

1. Create `content/slides/<name>.html` with `<div class="slide">` wrapper
2. Add the slug to the appropriate section in `content/slides.yaml`
3. Run `node build.js` to regenerate `content/page.html`
4. Test with `node dev-server.js` (serves on localhost)

## Workflow: Theming

1. Edit CSS custom properties in `:root` block of `content/head.html`
2. Grep for hardcoded accent RGB values: `232,93,44` and `E85D2C`
3. Update `public/login.html` and `public/join.html` (they have independent inline styles)
4. Rebuild with `node build.js`

## Creating a New Deck

This repo is both a framework and a working example. To create a new deck:

```bash
# Clone the template into a new repo
gh repo create my-deck --clone --private
cd my-deck
# Pull the framework from pitch-deck
git remote add template https://github.com/sdamico/pitch-deck.git
git pull template main --allow-unrelated-histories
git remote remove template
```

Then replace the demo content:
1. **Delete all demo slides**: `rm content/slides/*.html`
2. **Clear the manifest**: edit `content/slides.yaml` to have one empty section
3. **Re-brand**: run `/pitch-deck:customize` to change colors, fonts, brand name
4. **Create your hero**: run `/pitch-deck:add-slide hero --section "Your Company" --type hero`
5. **Add slides**: run `/pitch-deck:add-slide <name> --section "Section"` for each slide
6. **Set up Vercel**: connect the new repo, add `POSTGRES_URL` + `RESEND_API_KEY` env vars
7. **Run migrations**: execute `migrations/*.sql` against your Vercel Postgres instance

Each deck gets its own repo, its own Vercel deployment, its own auth database, and its own analytics.

### Loading the Plugin in Claude Code

The plugin ships with the repo, but Claude Code needs to know where to find it.
Add a `--plugin-dir` flag to your `claude` alias in `~/.zshrc`:

```bash
# In ~/.zshrc — add the path to your new deck repo
alias claude="claude --plugin-dir $HOME/repos/my-deck"
```

Then restart your shell (`source ~/.zshrc`) and start a new Claude Code session.
The `/pitch-deck:*` commands and design system skill will be available automatically.

## Commands

- `/pitch-deck:add-slide <name>` — scaffold a slide + update YAML
- `/pitch-deck:build` — run build, report stats
- `/pitch-deck:customize <change>` — update theme colors/fonts/brand
