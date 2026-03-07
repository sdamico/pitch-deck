---
name: build
description: "Build the pitch deck — runs build.js and reports slide count + output size."
allowed-tools: [Bash, Read]
model: haiku
---

# Build Deck

Run the pitch deck build pipeline and report results.

## Steps

1. Run the build:
   ```bash
   cd $CLAUDE_PROJECT_ROOT && node build.js
   ```

2. Report:
   - Number of slides
   - Output file size
   - Any errors from the build

3. If the build fails, read `build.js` and the error output to diagnose the issue.
