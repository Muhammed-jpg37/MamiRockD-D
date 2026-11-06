#!/usr/bin/env node
/* Merges duplicates in spell-catalog.json / spell-catalog.js: one entry per spell per ruleset.

   - Entries are grouped by ruleset and name (case-insensitive). Book names the
     SRD renamed (Tenser's Floating Disk → Floating Disk) count as the SRD name.
   - A spell that is in the SRD for its ruleset is rebuilt from the SRD data
     (rules/srd5-spells.js for 2014, rules/srd52-spells.js for 2024): real stats,
     class lists and text. It takes the SRD name; the other names go in `aliases`.
     source is 'SRD' (5.1) or 'SRD52' (5.2).
   - Other spells are kept as they are (one entry per name per ruleset).
   - Every entry lists the books it appears in (`books`).

   The Spells tab's existing fields keep their format (classes as names,
   components as "V, S, M (…)", "Concentration, up to …" durations), so the
   tab works unchanged. New fields: ritual, concentration, aliases, books,
   textIssue (2024 spells with garbled source text).

   Usage: node tools/merge-spell-catalog.js   (run tools/tag-spell-catalog.js first)
   Safe to run again: a merged catalog comes out the same. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'spell-catalog.json');
const JS_PATH = path.join(ROOT, 'spell-catalog.js');

const SRD = {
  '2014': { spells: require('../rules/srd5-spells.js'), source: 'SRD', license: 'srd51' },
  '2024': { spells: require('../rules/srd52-spells.js'), source: 'SRD52', license: 'srd52' }
};

// Book name → SRD name. Both SRDs use the same names for these.
const RENAMES = {
  "Melf's Acid Arrow": 'Acid Arrow',
  "Bigby's Hand": 'Arcane Hand',
  "Mordenkainen's Sword": 'Arcane Sword',
  "Nystul's Magic Aura": "Arcanist's Magic Aura",
  "Evard's Black Tentacles": 'Black Tentacles',
  "Mordenkainen's Faithful Hound": 'Faithful Hound',
  "Tenser's Floating Disk": 'Floating Disk',
  "Otiluke's Freezing Sphere": 'Freezing Sphere',
  "Tasha's Hideous Laughter": 'Hideous Laughter',
  "Drawmij's Instant Summons": 'Instant Summons',
  "Otto's Irresistible Dance": 'Irresistible Dance',
  "Mordenkainen's Magnificent Mansion": 'Magnificent Mansion',
  "Mordenkainen's Private Sanctum": 'Private Sanctum',
  "Otiluke's Resilient Sphere": 'Resilient Sphere',
  "Leomund's Secret Chest": 'Secret Chest',
  "Rary's Telepathic Bond": 'Telepathic Bond',
  "Leomund's Tiny Hut": 'Tiny Hut'
};

// Preferred book when a non-SRD spell appears in several.
const BOOK_ORDER = ['SRD', 'SRD52', 'PHB', 'XPHB', 'XGE', 'TCE'];
const bookRank = (b) => (BOOK_ORDER.includes(b) ? BOOK_ORDER.indexOf(b) : BOOK_ORDER.length);

const SCHOOL_LETTER = { Abjuration: 'A', Conjuration: 'C', Divination: 'D', Enchantment: 'E', Illusion: 'I', Necromancy: 'N', Transmutation: 'T', Evocation: 'V' };

const key = (name) => String(name).trim().toLowerCase();
const RENAME_KEYS = new Map(Object.entries(RENAMES).map(([from, to]) => [key(from), to]));
const canonical = (name) => RENAME_KEYS.get(key(name)) || name;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// A short summary for the list view: the first paragraph, cut at a sentence end near 220 characters.
function summary(desc) {
  const first = desc[0] || '';
  if (first.length <= 240) return first;
  const cut = first.slice(0, 240);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

// One catalog entry from SRD data, in the format the Spells tab reads.
function fromSrd(s, ruleset, group) {
  const srd = SRD[ruleset];
  const material = s.material ? ' (' + lowerFirst(s.material).replace(/\.$/, '') + ')' : '';
  const components = s.components.map((c) => (c === 'M' ? 'M' + material : c)).join(', ');
  const duration = s.concentration ? 'Concentration, ' + lowerFirst(s.duration) : s.duration;
  const tags = [...new Set(group.flatMap((e) => (Array.isArray(e.tags) ? e.tags : [])))];
  // Keep an old damage string only when it names the SRD damage type ("8d6 Fire").
  const oldDamage = group.map((e) => e.damage).find((d) => d && s.damageType && s.damageType.split(', ').some((t) => d.includes(t)));
  const out = {
    name: s.name,
    source: srd.source,
    ruleset: ruleset,
    license: srd.license,
    levelText: s.level === 0 ? 'Cantrip' : 'Level ' + s.level,
    levelNum: s.level,
    school: SCHOOL_LETTER[s.school],
    schoolName: s.school,
    classes: s.classes.map(cap),
    castingTime: s.castingTime,
    range: s.range,
    components: components,
    duration: duration,
    quickEffect: summary(s.desc),
    desc: s.desc.join('\n\n'),
    higherLevels: s.higherLevel.join('\n\n') || 'No higher level benefit.',
    tags: tags,
    damage: oldDamage || s.damageType || '',
    ritual: s.ritual,
    concentration: s.concentration
  };
  if (s.textIssue) out.textIssue = s.textIssue;
  return out;
}

const catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
for (const e of catalog) {
  if (!SRD[e.ruleset]) throw new Error('Untagged spell ' + e.name + ' (' + e.source + '): run tools/tag-spell-catalog.js first');
}

// Group by ruleset + canonical name.
const groups = new Map();
for (const e of catalog) {
  const k = e.ruleset + '|' + key(canonical(e.name));
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(e);
}

const srdIndex = {};
for (const rs of Object.keys(SRD)) srdIndex[rs] = new Map(SRD[rs].spells.map((s) => [key(s.name), s]));

let rebuilt = 0;
const merged = [];
for (const [k, group] of groups) {
  const ruleset = k.split('|')[0];
  const name = canonical(group[0].name);
  const books = [...new Set(group.flatMap((e) => (Array.isArray(e.books) ? e.books : [e.source])))].sort((a, b) => bookRank(a) - bookRank(b) || a.localeCompare(b));
  const names = [...new Set(group.flatMap((e) => [e.name].concat(e.aliases || [])))];
  const s = srdIndex[ruleset].get(key(name));

  let out;
  if (s) {
    if (!books.includes(SRD[ruleset].source)) books.unshift(SRD[ruleset].source);
    out = fromSrd(s, ruleset, group);
    rebuilt++;
  } else {
    if (group.length > 1) throw new Error('Two non-SRD entries for ' + name + ' in ' + ruleset + ' — decide which to keep');
    out = Object.assign({}, group[0]);
    delete out.aliases;
    delete out.books;
  }
  const aliases = names.filter((n) => key(n) !== key(out.name)).sort();
  if (aliases.length) out.aliases = aliases;
  out.books = books;
  merged.push(out);
}

merged.sort((a, b) => a.ruleset.localeCompare(b.ruleset) || a.levelNum - b.levelNum || a.name.localeCompare(b.name));

// Every SRD spell must be there exactly once.
for (const rs of Object.keys(SRD)) {
  for (const s of SRD[rs].spells) {
    const n = merged.filter((e) => e.ruleset === rs && key(e.name) === key(s.name)).length;
    if (n !== 1) throw new Error(rs + ' SRD spell ' + s.name + ' appears ' + n + ' times');
  }
}

const text = JSON.stringify(merged, null, 2).replace(/\n/g, '\r\n');
fs.writeFileSync(JSON_PATH, text);
fs.writeFileSync(JS_PATH, 'window.SPELL_CATALOG = ' + text + ';\r\n');

const count = (rs, lic) => merged.filter((e) => e.ruleset === rs && (!lic || e.license === lic)).length;
console.log('Merged ' + catalog.length + ' entries into ' + merged.length + ' (' + rebuilt + ' rebuilt from SRD data).');
console.log('2014: ' + count('2014') + ' (' + count('2014', 'srd51') + ' SRD), 2024: ' + count('2024') + ' (' + count('2024', 'srd52') + ' SRD)');
