#!/usr/bin/env node
//
// publish.js — Upload standalone decks to the data room as hosted pages.
//
// Usage:
//   node publish.js                # publish all standalone decks
//   node publish.js unit-economics # publish a single deck
//
// Reads POSTGRES_URL from .env.local. Writes directly to the database.
// Assets (fonts + images listed in YAML) are uploaded as page children.

const { readFileSync, existsSync, readdirSync } = require('fs');
const { join, extname } = require('path');

// ---------- env ----------

function loadEnv() {
  const envFile = join(__dirname, '.env.local');
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

if (!process.env.POSTGRES_URL) {
  console.error('Missing POSTGRES_URL. Set in .env.local or environment.');
  process.exit(1);
}

// ---------- db ----------

const { sql } = require('@vercel/postgres');

// ---------- helpers ----------

const MIME_TYPES = {
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

function mimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Shared fonts — every standalone deck needs these
const FONTS = [
  'fonts/Inter-Regular.woff2',
  'fonts/Inter-Bold.woff2',
  'fonts/DMSerifText-Regular.woff2',
  'fonts/JetBrainsMono-Latin.woff2',
];

function parseSimpleYaml(text) {
  const result = { assets: [] };
  let inAssets = false;
  for (const line of text.split('\n')) {
    if (line.match(/^assets:\s*$/)) {
      inAssets = true;
      continue;
    }
    if (inAssets) {
      const m = line.match(/^\s+-\s+(.+)$/);
      if (m) {
        result.assets.push(m[1].trim());
        continue;
      }
      inAssets = false;
    }
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (kv && kv[1] !== 'sections') {
      result[kv[1]] = kv[2].trim();
    }
  }
  return result;
}

async function upsertAsset(pageId, name, content, mime) {
  const sizeBytes = content.length;
  const contentBase64 = content.toString('base64');

  const { rows: existing } = await sql`
    SELECT id FROM data_room_files
    WHERE page_id = ${pageId} AND name = ${name}
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE data_room_files
      SET content = decode(${contentBase64}, 'base64'),
          size_bytes = ${sizeBytes},
          mime_type = ${mime}
      WHERE id = ${existing[0].id}
    `;
  } else {
    await sql`
      INSERT INTO data_room_files (name, folder, content, size_bytes, mime_type, page_id)
      VALUES (${name}, '/', decode(${contentBase64}, 'base64'), ${sizeBytes}, ${mime}, ${pageId})
    `;
  }
}

// ---------- main ----------

async function main() {
  const filter = process.argv[2];

  // Discover standalone decks
  const decksDir = join(__dirname, 'content', 'decks');
  const yamls = readdirSync(decksDir).filter(f => f.endsWith('.yaml'));

  const decks = [];
  for (const file of yamls) {
    const text = readFileSync(join(decksDir, file), 'utf8');
    const meta = parseSimpleYaml(text);
    if (meta.tail !== 'minimal') continue;

    const name = file.replace('.yaml', '');
    if (filter && name !== filter) continue;

    const outputPath = join(__dirname, 'content', meta.output);
    if (!existsSync(outputPath)) {
      console.warn(`  skip ${name} — ${meta.output} not built (run /build first)`);
      continue;
    }

    decks.push({
      name,
      title: meta.title || name,
      slug: meta.slug || name,
      folder: meta.folder || '/',
      outputPath,
      assets: [...FONTS, ...meta.assets],
    });
  }

  if (decks.length === 0) {
    console.log('No decks to publish.' + (filter ? ` No standalone deck named "${filter}".` : ''));
    process.exit(0);
  }

  console.log(`Publishing ${decks.length} deck(s)\n`);

  for (const deck of decks) {
    const html = readFileSync(deck.outputPath, 'utf8');
    const sizeBytes = Buffer.byteLength(html, 'utf8');
    const sizeKB = (sizeBytes / 1024).toFixed(0);
    const contentBase64 = Buffer.from(html, 'utf8').toString('base64');

    // Upsert page
    const { rows: existing } = await sql`
      SELECT id FROM data_room_files
      WHERE slug = ${deck.slug} AND type = 'page'
    `;

    let pageId;
    if (existing.length > 0) {
      pageId = existing[0].id;
      await sql`
        UPDATE data_room_files
        SET content = decode(${contentBase64}, 'base64'),
            size_bytes = ${sizeBytes},
            name = ${deck.title}
        WHERE id = ${pageId}
      `;
      console.log(`  update  ${deck.slug} (${sizeKB} KB)`);
    } else {
      const { rows } = await sql`
        INSERT INTO data_room_files (name, folder, content, size_bytes, mime_type, type, slug)
        VALUES (${deck.title}, ${deck.folder}, decode(${contentBase64}, 'base64'), ${sizeBytes}, 'text/html', 'page', ${deck.slug})
        RETURNING id
      `;
      pageId = rows[0].id;
      console.log(`  create  ${deck.slug} (${sizeKB} KB)`);
    }

    // Upload assets
    let assetCount = 0;
    for (const assetPath of deck.assets) {
      const fullPath = join(__dirname, 'public', assetPath);
      if (!existsSync(fullPath)) {
        console.warn(`    warn  missing ${assetPath}`);
        continue;
      }
      const content = readFileSync(fullPath);
      await upsertAsset(pageId, assetPath, content, mimeType(assetPath));
      assetCount++;
    }
    console.log(`          ${assetCount} assets → /data/pages/${deck.slug}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Publish failed:', err.message);
  process.exit(1);
});
