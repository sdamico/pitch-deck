---
name: add-slide
description: "Scaffold a new slide and update the YAML manifest."
argument-hint: "<slide-name> [--section <section-name>] [--type hero|section|act-divider|cta]"
allowed-tools: [Read, Write, Edit, Bash, Glob]
model: sonnet
---

# Add Slide

Create a new slide HTML file and register it in the manifest.

## Arguments

Parse `$ARGUMENTS` to extract:
- **slide-name**: kebab-case slug for the slide file (e.g. `market-size`)
- **--section <name>**: Section to add the slide to (creates a new section if it doesn't exist)
- **--type <type>**: Slide layout type (default: `section`)

## Slide Types

### `hero` — Full-screen title slide
Centered layout with radial gradient backdrop. Use for opening slides.
```html
<div class="slide">
<section class="hero">
  <div class="hero-title">
    <div class="hero-logo-lockup">
      <span style="font-family:'Inter',sans-serif;font-weight:700;font-size:140px;letter-spacing:0.08em;color:var(--accent)">BRAND</span>
    </div>
  </div>
  <div class="hero-descriptor">Tagline goes here</div>
  <div class="hero-benefit">One-liner value proposition.</div>
  <div class="hero-stats">
    <div class="stat-block">
      <div class="stat-number">$10M</div>
      <div class="stat-label">ARR</div>
    </div>
  </div>
  <div class="hero-scroll">
    <span>Scroll</span>
    <div class="scroll-line"></div>
  </div>
</section>
</div>
```

### `section` — Standard content slide (default)
Vertically centered 1600x900 canvas with label/title/subtitle header and flexible body.
```html
<div class="slide">
<section class="section">
  <div class="reveal">
    <div class="section-label">Section Name</div>
    <div class="section-title">Big claim goes here.</div>
    <div class="section-subtitle">Supporting detail in 1-2 sentences.</div>
  </div>

  <!-- Body: use any component grid below -->
</section>
</div>
```

### `act-divider` — Cinematic section break
Centered text with dark overlay. Use between major sections.
```html
<div class="slide">
<section class="act-divider">
  <div class="act-label">Act II</div>
  <div class="act-title">The Product</div>
  <div class="act-subtitle">Optional supporting line.</div>
</section>
</div>
```

### `cta` — Call-to-action / closing slide
Centered layout for final ask or closing statement.
```html
<div class="slide">
<section class="cta-section reveal">
  <div style="margin-bottom:48px">
    <span style="font-family:'Inter',sans-serif;font-weight:700;font-size:64px;letter-spacing:0.08em;color:var(--accent);opacity:0.6">BRAND</span>
  </div>
  <div class="cta-title">Closing statement.</div>
  <div class="cta-sub">Supporting tagline.</div>
  <div class="footer" style="border-top:none;padding:24px 0 0">
    BRAND &bull; Confidential &bull; 2026
  </div>
</section>
</div>
```

## Component Library (for `section` slide bodies)

Pick the right component for the content. Wrap each in `reveal reveal-delay-N` for staggered animation.

### Capability Grid (2/3/4 columns)
Best for: feature cards, product specs, capabilities
```html
<div class="cap-grid [cols-2|cols-4] reveal reveal-delay-1">
  <div class="cap-card [featured]">
    <div class="cap-icon">ICON</div>
    <h4>Card Title</h4>
    <p>Description text.</p>
  </div>
</div>
```

### Channels Grid (3 columns)
Best for: priorities, use-of-funds, product details with sub-labels
```html
<div class="channels-grid reveal reveal-delay-1">
  <div class="channel-card">
    <div class="channel-label">Label</div>
    <h4>Title</h4>
    <div class="channel-sub">Subtitle</div>
    <div class="channel-divider"></div>
    <p>Detail paragraph.</p>
  </div>
</div>
```

### Window Grid (2 columns)
Best for: key metrics, KPI callouts
```html
<div class="window-grid reveal reveal-delay-1">
  <div class="window-card">
    <div class="wc-number">$10M</div>
    <h4>Metric Name</h4>
    <p>Context for the number.</p>
  </div>
</div>
```

### Bar Chart (animated)
Best for: revenue growth, time-series data
```html
<div class="bar-chart reveal reveal-delay-1">
  <div class="bar">
    <div class="bar-value">$1M</div>
    <div class="bar-fill [muted]" data-height="50" style="height:0"></div>
    <div class="bar-label">Q1 '26</div>
  </div>
</div>
```
`data-height` is a percentage (0-100) of the chart height. Bars animate on scroll via IntersectionObserver.

### Econ Callout
Best for: single big-number emphasis (TAM, valuation, etc.)
```html
<div class="econ-callout reveal reveal-delay-2">
  <div class="econ-callout-number">$300B</div>
  <div class="econ-callout-label">Description of what the number means.</div>
</div>
```

### Timeline Grid (3 columns)
Best for: roadmap, milestones
```html
<div class="timeline-grid reveal reveal-delay-1">
  <div class="timeline-card [current]">
    <div class="timeline-year">2025</div>
    <div class="timeline-number">$1M</div>
    <div class="timeline-desc">Milestone description.</div>
    <div class="timeline-tag">NOW</div>
  </div>
</div>
```

### Team Grid (2 columns)
Best for: team bios
```html
<div class="team-grid reveal reveal-delay-1">
  <div class="team-card">
    <div class="team-photo">SD</div>
    <div>
      <h4>Full Name</h4>
      <div class="team-role">Title</div>
      <p>Bio paragraph.</p>
    </div>
  </div>
</div>
```

### Logo Wall
Best for: investor logos, partner logos, press mentions
```html
<div class="logo-wall reveal reveal-delay-1">
  <span class="logo-pill">Brand Name</span>
</div>
```

### Comparison Table
Best for: competitive comparison, feature matrix
```html
<div class="comparison-table reveal reveal-delay-1">
  <div class="comparison-header">
    <div class="ch-label">Feature</div>
    <div class="ch-core">Us</div>
    <div class="ch-other">Them</div>
  </div>
  <div class="comparison-row">
    <div class="cr-label">Feature name</div>
    <div class="cr-core"><span class="cr-check">&#x2713;</span> Yes</div>
    <div class="cr-other"><span class="cr-x">&#x2717;</span> No</div>
  </div>
</div>
```

### Partner Grid (4 columns, expandable on mobile)
Best for: investor details, partner deep-dives
```html
<div class="partner-grid reveal reveal-delay-1">
  <div class="partner-card [featured]" onclick="togglePartnerCard(this)">
    <div class="pc-header">
      <div class="pc-name">Name</div>
      <span class="pc-chevron">&#x25BC;</span>
    </div>
    <div class="pc-type">Category</div>
    <div class="pc-stats">
      <div class="pc-stat"><span>Label</span><span>Value</span></div>
    </div>
  </div>
</div>
```

### Inline Bar (horizontal progress bar)
Best for: market share, penetration rate
```html
<div class="inline-bar reveal reveal-delay-1">
  <div class="inline-bar-label">Label</div>
  <div class="inline-bar-track">
    <div class="inline-bar-fill green" style="width:65%">65% — Label</div>
  </div>
  <div class="inline-bar-annotation">
    <span>Left label</span>
    <span>Right label</span>
  </div>
</div>
```

## Style Rules

- **Use CSS classes, not inline styles.** Check the component library above and `content/head.html` for existing classes before adding any `style=""` attributes. Inline styles are only acceptable for one-off spacing (e.g., `margin-top` on a specific element) or truly unique positioning.
- If the slide needs a visual pattern not covered by existing classes, add a new CSS class to `content/head.html` inside the `<style>` block, grouped under a comment header (e.g., `/* ─── STEP CARDS ─── */`).
- If a pattern appears on 2+ slides, it **must** be a named CSS class — never duplicate inline styles across slides.

## Workflow

1. **Read** `content/decks/main.yaml` to understand current structure
2. **Read** `content/head.html` to check existing component classes before creating new patterns
3. **Create** `content/slides/<slide-name>.html` using the appropriate template and existing CSS classes
4. **Add CSS** to `content/head.html` if a new visual pattern is needed (never use inline styles for reusable patterns)
5. **Update** `content/decks/main.yaml`:
   - If `--section` matches an existing section, append the slide slug to that section's slides list
   - If `--section` is new, create a new section entry
   - If no `--section`, append to the last section
6. **Build**: Run `cd $CLAUDE_PROJECT_ROOT && node build.js`
7. **Report**: Confirm the slide was added and the build succeeded
