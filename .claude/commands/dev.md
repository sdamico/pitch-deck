---
name: dev
description: "Start the dev server with live reload — auto-rebuilds on file changes."
allowed-tools: [Bash, Read]
model: haiku
---

# Dev Server

Start the pitch deck dev server with live reload.

## Steps

1. Kill any existing dev server on port 3334:
   ```bash
   cd $CLAUDE_PROJECT_ROOT && lsof -ti:3334 | xargs kill 2>/dev/null; sleep 0.3
   ```

2. Build all decks first:
   ```bash
   cd $CLAUDE_PROJECT_ROOT && node build.js
   ```

3. Start the dev server in the background:
   ```bash
   cd $CLAUDE_PROJECT_ROOT && node dev-server.js &
   ```

4. Report the URLs:
   - Main deck: http://localhost:3334/
   - Unit economics: http://localhost:3334/unit-economics-deck
   - Platform strategy: http://localhost:3334/platform-strategy-deck
   - Note: Live reload is active — edits to slides, head.html, tail*.html, or deck manifests trigger auto-rebuild + browser refresh.
