---
name: publish
description: "Publish standalone decks to the data room as hosted pages."
argument-hint: "[deck-name | all]"
allowed-tools: [Bash, Read]
model: haiku
---

# Publish Decks

Upload standalone decks to the data room so they're accessible at `/data/pages/<slug>`.

## Steps

1. Build first to ensure output is current:
   ```bash
   cd $CLAUDE_PROJECT_ROOT && node build.js
   ```

2. Run the publish script:
   ```bash
   cd $CLAUDE_PROJECT_ROOT && node publish.js $ARGUMENTS
   ```

3. Report:
   - Which decks were created vs updated
   - The URLs where they're now accessible
   - Any errors

## Notes

- `node publish.js` publishes all standalone decks (tail: minimal)
- `node publish.js unit-economics` publishes a single deck
- Requires `POSTGRES_URL` in `.env.local`
- The main deck (tail: full) is not published — it's served via `api/page.js`
- Existing pages are updated in place (content replaced, slug preserved)
- Data room access control applies — viewers must have the page in their view to see it
