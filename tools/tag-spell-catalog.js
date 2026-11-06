#!/usr/bin/env node
/* Tags every spell in spell-catalog.json and spell-catalog.js with:
     ruleset: '2014' | '2024'            which rules version its book belongs to
     license: 'srd51' | 'srd52' | 'none' whether the spell is in a CC-BY SRD
   `source` (the book) is already there.

   A spell counts as SRD when its name is in rules/srd5-spells.js (2014) or
   rules/srd52-spells.js (2024) for the same ruleset. The SRD renames some
   spells (Tenser's Floating Disk → Floating Disk); those book entries stay
   'none' here and are matched when duplicates are merged.

   Usage: node tools/tag-spell-catalog.js
   Safe to run again. Fails on a book it doesn't know. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'spell-catalog.json');
const JS_PATH = path.join(ROOT, 'spell-catalog.js');

// Book abbreviation → rules version (full list in tools/spell-books.js).
const BOOKS = Object.fromEntries(Object.entries(require('./spell-books.js')).map(([k, v]) => [k, v.ruleset]));

const key = (name) => String(name).trim().toLowerCase();
const SRD51 = new Set(require('../rules/srd5-spells.js').map((s) => key(s.name)));
const SRD52 = new Set(require('../rules/srd52-spells.js').map((s) => key(s.name)));

function licenseOf(spell, ruleset) {
  if (ruleset === '2014' && SRD51.has(key(spell.name))) return 'srd51';
  if (ruleset === '2024' && SRD52.has(key(spell.name))) return 'srd52';
  return 'none';
}

const catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const counts = {};

const tagged = catalog.map((spell) => {
  const ruleset = BOOKS[spell.source];
  if (!ruleset) throw new Error('Unknown book "' + spell.source + '" on ' + spell.name + ' — add it to tools/spell-books.js');
  const license = licenseOf(spell, ruleset);
  if (spell.source === 'SRD' && license !== 'srd51') throw new Error('SRD entry not in SRD 5.1 data: ' + spell.name);
  if (spell.source === 'SRD52' && license !== 'srd52') throw new Error('SRD52 entry not in SRD 5.2 data: ' + spell.name);
  const k = ruleset + ' ' + license;
  counts[k] = (counts[k] || 0) + 1;

  // Put the new fields right after `source`, keep everything else in its order.
  const out = {};
  for (const [f, v] of Object.entries(spell)) {
    if (f === 'ruleset' || f === 'license') continue;
    out[f] = v;
    if (f === 'source') { out.ruleset = ruleset; out.license = license; }
  }
  return out;
});

// Same formatting the files already use: 2-space JSON with CRLF line ends.
const text = JSON.stringify(tagged, null, 2).replace(/\n/g, '\r\n');
fs.writeFileSync(JSON_PATH, text);
fs.writeFileSync(JS_PATH, 'window.SPELL_CATALOG = ' + text + ';\r\n');

console.log('Tagged ' + tagged.length + ' spells:', counts);
