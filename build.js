#!/usr/bin/env node
/**
 * Build content/page.html from individual slide files + manifest.
 *
 * Reads content/slides.yaml, concatenates head.html + slides + tail.html,
 * and injects the groups/sectionNames JS arrays from the manifest.
 *
 * Usage: node build.js
 */
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const dir = join(__dirname, 'content');

// --- Parse slides.yaml (simple parser, no deps) ---
const yaml = readFileSync(join(dir, 'slides.yaml'), 'utf8');
const sections = [];
let current = null;
for (const line of yaml.split('\n')) {
  const nameMatch = line.match(/^\s+- name:\s*(.+)/);
  if (nameMatch) {
    current = { name: nameMatch[1].trim(), slides: [] };
    sections.push(current);
    continue;
  }
  const slideMatch = line.match(/^\s+- ([a-z0-9-]+)/);
  if (slideMatch && current) {
    current.slides.push(slideMatch[1]);
  }
}

// --- Read parts ---
const head = readFileSync(join(dir, 'head.html'), 'utf8');
const tail = readFileSync(join(dir, 'tail.html'), 'utf8');

let slidesHtml = '';
for (const section of sections) {
  for (const slug of section.slides) {
    slidesHtml += readFileSync(join(dir, 'slides', `${slug}.html`), 'utf8');
  }
}

// --- Generate groups JS (matches original formatting) ---
const groups = [];
const names = {};
for (let i = 0; i < sections.length; i++) {
  names[i] = sections[i].name;
  for (let j = 0; j < sections[i].slides.length; j++) {
    groups.push(i);
  }
}

// Comment lines: split at ~5 entries per line
const commentParts = Object.entries(names).map(([k, v]) => `${k}:${v}`);
const commentLine1 = commentParts.slice(0, 5).join(' | ');
const commentLine2 = commentParts.slice(5).join(' | ');

const groupsJs = [
  `  // ${commentLine1}`,
  `  // ${commentLine2}`,
  `  var groups = [${groups.join(', ')}];`,
].join('\n');

// sectionNames object
const nameEntries = Object.entries(names);
const nameLine1 = nameEntries.slice(0, 5).map(([k, v]) => `${k}: '${v}'`).join(', ');
const nameLine2 = nameEntries.slice(5).map(([k, v]) => `${k}: '${v}'`).join(', ');

const sectionNamesJs = [
  '  var sectionNames = {',
  `    ${nameLine1},`,
  `    ${nameLine2}`,
  '  };',
].join('\n');

// --- Assemble ---
let output = head + slidesHtml;
output += tail
  .replace('/*__SLIDE_GROUPS__*/', groupsJs)
  .replace('/*__SECTION_NAMES__*/', sectionNamesJs);

writeFileSync(join(dir, 'page.html'), output);
console.log(`Built content/page.html (${output.length} bytes, ${sections.reduce((n, s) => n + s.slides.length, 0)} slides)`);
