---
name: customize
description: "Change theme colors, fonts, and branding across the deck."
argument-hint: "<what-to-change>"
allowed-tools: [Read, Edit, Glob, Grep]
model: sonnet
---

# Customize Theme

Help the user change the deck's visual identity: accent color, background, fonts, brand name, or other design tokens.

## Arguments

Parse `$ARGUMENTS` for what the user wants to change. Common requests:
- "accent color to blue" → change `--accent` and derived values
- "dark mode with green" → change `--bg`, `--accent`, etc.
- "brand name to Acme" → update all brand references
- "fonts to Poppins" → update `@font-face` declarations + font stacks

## Design Tokens (in `content/head.html`)

The design system is driven by CSS custom properties in `:root`:

```css
:root {
  --bg: #000000;           /* Page background */
  --bg-deep: #000000;      /* Deep background (same as bg by default) */
  --bg-surface: rgba(255,255,255,0.03);  /* Card/surface background */
  --text: #ECEEE2;         /* Primary text color */
  --text-secondary: rgba(236,238,226,0.5);  /* Secondary text */
  --text-muted: rgba(236,238,226,0.2);      /* Muted/tertiary text */
  --accent: #E85D2C;       /* Accent color (burnt orange) */
  --accent-soft: rgba(232,93,44,0.12);      /* Accent at low opacity */
  --divider: rgba(236,238,226,0.08);        /* Border/divider color */
}
```

## Accent Color Change Checklist

When changing `--accent`, update ALL of these:
1. **`:root` variables** in `content/head.html`:
   - `--accent` — the solid color (e.g. `#3B82F6`)
   - `--accent-soft` — same color at ~12% opacity (e.g. `rgba(59,130,246,0.12)`)
2. **Hardcoded accent references** in `content/head.html`:
   - `.hero::after` radial gradient uses `rgba(232,93,44,0.15)` — update RGB values
   - `.accordion-row` border uses `rgba(232,93,44,...)` — update RGB values
   - `.core-tab-active` border uses `rgba(232,93,44,...)` — update RGB values
   - `.tab-container` uses `rgba(232,93,44,...)` — update RGB values
   - `.partner-card.featured` uses `rgba(232,93,44,...)` — update RGB values
3. **Login/join pages** — `public/login.html` and `public/join.html`:
   - `.wordmark` color (`#E85D2C`)
   - `input:focus` border-color (`rgba(232,93,44,0.5)`)
   - `button` background/border/color (multiple `rgba(232,93,44,...)` values)
   - `.success .icon` color
   - `.email-highlight` color
   - `.retry a` color/hover

Use `Grep` with pattern `232,93,44|E85D2C|e85d2c` to find all accent color references.

## Brand Name Change Checklist

When changing the brand name:
1. `content/head.html` — `<title>` tag, `.nav` span
2. `content/slides/hero.html` — hero title text
3. `content/slides/close.html` — CTA branding, footer text
4. `public/login.html` — `<title>`, `.wordmark` text
5. `public/join.html` — `<title>`, `.wordmark` text

Use `Grep` to find all occurrences of the current brand name.

## Font Change Checklist

Fonts are loaded via `@font-face` in `content/head.html`:
1. Replace `@font-face` declarations with new font files
2. Update `font-family` references throughout the CSS
3. Add new `.woff2` files to `public/fonts/`
4. Update login.html and join.html `@font-face` declarations

Current font stack:
- **Inter** (400, 700) — body text, labels, UI elements
- **DM Serif Text** (400) — headings, hero titles, big numbers
- **JetBrains Mono** (300-500) — code, navigation, timestamps

## Style Rules

- All visual patterns must use CSS classes defined in `content/head.html` — never add inline styles for design-system patterns. See the "Style Rules" section in the project's CLAUDE.md for full guidance.
- When adding new visual elements during customization, check existing component classes in `content/head.html` before creating new ones.

## Workflow

1. **Read** the files that need changes
2. **Grep** for all instances of the value being changed
3. **Edit** each file, updating all references consistently (always prefer CSS classes over inline styles)
4. **Report** what was changed and remind user to run `/pitch-deck:build`
