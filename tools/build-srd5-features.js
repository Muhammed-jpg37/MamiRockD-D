#!/usr/bin/env node
/* Builds rules/srd5-features.js: SRD 5.1 class / subclass feature text and species trait text,
   from the 5e-bits data, plus the limited uses of features (written by hand below from the
   SRD 5.1 class tables and feature text).

   Source: https://github.com/5e-bits/5e-srd-api — packages/5e-database/src/2014/en/
   (dataset under the MIT licence; the game text is SRD 5.1, CC-BY-4.0).

   Usage:
     mkdir srd && cd srd
     for f in Features Traits; do
       curl -sf -o "2014-$f.json" "https://raw.githubusercontent.com/5e-bits/5e-srd-api/main/packages/5e-database/src/2014/en/5e-SRD-$f.json"
     done
     node tools/build-srd5-features.js srd

   Run it again to regenerate; do not edit the output by hand (edit USES here instead). */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node tools/build-srd5-features.js <folder with 2014-Features.json and 2014-Traits.json>');
  process.exit(1);
}
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, '2014-' + name + '.json'), 'utf8'));

// The key a feature name is looked up by: lower case, no punctuation. "Lay on Hands" -> "lay on hands".
const norm = (s) => String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const paras = (d) => (Array.isArray(d) ? d : String(d || '').split('\n')).map((p) => String(p).trim()).filter(Boolean);

/* ---------- Text ---------- */

const classes = {};   // classId -> { normName: { name, level, subclass?, desc } }
read('Features').forEach((f) => {
  const cls = f.class && f.class.index;
  if (!cls) return;
  const map = classes[cls] = classes[cls] || {};
  const key = norm(f.name);
  const entry = { name: f.name, level: f.level, desc: paras(f.desc).join('\n') };
  if (f.subclass) entry.subclass = f.subclass.index;
  // Several entries share a name with a suffix ("Bardic Inspiration (d6)", "(d8)"): keep the first level's.
  if (!map[key] || map[key].level > f.level) map[key] = entry;
});

const traits = {};    // normName -> { name, desc }
read('Traits').forEach((t) => {
  const key = norm(t.name);
  if (!traits[key]) traits[key] = { name: t.name, desc: paras(t.desc).join('\n') };
});

// Shorter keys for names with a suffix or prefix: "Action Surge (1 use)" -> "action surge",
// "Spellcasting: Bard" -> "spellcasting". The full name keeps its own entry; an alias never
// replaces one, and the lowest level wins among aliases.
function addAliases(map) {
  Object.keys(map).forEach((key) => {
    const e = map[key];
    const short = [norm(e.name.replace(/\s*\(.*?\)\s*/g, ' ')), e.name.indexOf(':') > 0 ? norm(e.name.split(':')[0]) : null];
    short.forEach((k) => {
      if (!k || k === key) return;
      if (!map[k] || (map[k].alias && map[k].level > e.level)) map[k] = Object.assign({ alias: true }, e);
    });
  });
}
Object.values(classes).forEach(addAliases);
addAliases(traits);
// The builder calls the high elf's cantrip trait just "Cantrip".
if (traits['high elf cantrip'] && !traits.cantrip) traits.cantrip = Object.assign({ alias: true }, traits['high elf cantrip']);

/* ---------- Limited uses (SRD 5.1) ----------
   Keyed "<classId>:<feature>" or "species:<trait>" with the feature's normalised base name.
   count: { fixed } | { table: { classLevel: n } } | { perLevel: true } (= class level)
          | { ability, min, plus } (= ability modifier + plus, at least min)
   reset: 'Short Rest' | 'Long Rest'; shortFrom: class level from which it resets on a short rest.
   pool: a pool of points (Lay on Hands) is shown as text, not as pips. */
const USES = {
  'barbarian:rage': { table: { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6 }, reset: 'Long Rest' },
  'bard:bardic inspiration': { ability: 'cha', min: 1, reset: 'Long Rest', shortFrom: 5 },
  'cleric:channel divinity': { table: { 2: 1, 6: 2, 18: 3 }, reset: 'Short Rest' },
  'druid:wild shape': { table: { 2: 2 }, reset: 'Short Rest' },
  'druid:natural recovery': { fixed: 1, reset: 'Long Rest' },
  'fighter:second wind': { fixed: 1, reset: 'Short Rest' },
  'fighter:action surge': { table: { 2: 1, 17: 2 }, reset: 'Short Rest' },
  'fighter:indomitable': { table: { 9: 1, 13: 2, 17: 3 }, reset: 'Long Rest' },
  'monk:ki': { perLevel: true, from: 2, reset: 'Short Rest' },
  'monk:wholeness of body': { fixed: 1, reset: 'Long Rest' },
  'paladin:divine sense': { ability: 'cha', plus: 1, min: 1, reset: 'Long Rest' },
  'paladin:lay on hands': { pool: 5, reset: 'Long Rest' },
  'paladin:channel divinity': { table: { 3: 1 }, reset: 'Short Rest' },
  'paladin:cleansing touch': { ability: 'cha', min: 1, reset: 'Long Rest' },
  'paladin:holy nimbus': { fixed: 1, reset: 'Long Rest' },
  'rogue:stroke of luck': { fixed: 1, reset: 'Short Rest' },
  'sorcerer:font of magic': { perLevel: true, from: 2, reset: 'Long Rest', label: 'Sorcery Points' },
  'warlock:dark ones own luck': { fixed: 1, reset: 'Short Rest' },
  'warlock:hurl through hell': { fixed: 1, reset: 'Long Rest' },
  'warlock:mystic arcanum': { fixed: 1, reset: 'Long Rest' },
  'wizard:arcane recovery': { fixed: 1, reset: 'Long Rest' },
  'species:breath weapon': { fixed: 1, reset: 'Short Rest' },
  'species:relentless endurance': { fixed: 1, reset: 'Long Rest' },
};

/* ---------- Output ---------- */

const header = `/* ========================================================
   D&D 5e (2014) FEATURES — SRD 5.1 content only
   GENERATED by tools/build-srd5-features.js. Do not edit by hand.

   This work includes material taken from the System Reference
   Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and
   available at https://dnd.wizards.com/resources/systems-reference-document.
   The SRD 5.1 is licensed under the Creative Commons Attribution
   4.0 International License available at
   https://creativecommons.org/licenses/by/4.0/legalcode.

   Converted from the 5e-bits/5e-database dataset
   (https://github.com/5e-bits/5e-database), MIT licence,
   Copyright (c) 2018-2020 Adrian Padua, Christopher Ward.

   window.FEATURES_SRD5 (or module.exports in Node):
     classes: { classId: { key: { name, level, subclass?, desc } } }
     traits:  { key: { name, desc } }
     uses:    limited uses by "classId:key" / "species:key"
     lookup(name, classId?) -> the text entry or null
     usesFor(name, classId, ctx) -> { max, reset, label?, pool? } or null
       ctx: { classLevel, mods: { cha, ... } }
   ======================================================== */
`;

const runtime = `
  // The key a feature name is looked up by.
  const norm = (s) => String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // Names the builder uses that differ from the SRD text's: "Action Surge (one use)",
  // "Extra Attack (2)", "Channel Divinity (1/rest)", "Draconic Ancestry: Red (...)".
  function keysFor(name) {
    const raw = String(name || '');
    const keys = [norm(raw)];
    const noParen = raw.replace(/\\s*\\(.*?\\)\\s*/g, ' ').trim();
    keys.push(norm(noParen));
    if (raw.indexOf(':') > 0) keys.push(norm(raw.split(':')[0]));
    // "Wild Shape Improvement", "Favored Enemy improvement": the feature they improve.
    keys.slice().forEach((k) => { const b = k.replace(/ (and .*)?improvements?$/, ''); if (b !== k) keys.push(b); });
    // "Signature Spells" / "Signature Spell".
    keys.slice().forEach((k) => { if (/s$/.test(k)) keys.push(k.replace(/s$/, '')); });
    return keys.filter((k, i) => k && keys.indexOf(k) === i);
  }

  function lookup(name, classId) {
    const keys = keysFor(name);
    if (classId && DATA.classes[classId]) {
      for (const k of keys) if (DATA.classes[classId][k]) return DATA.classes[classId][k];
    }
    for (const k of keys) if (DATA.traits[k]) return DATA.traits[k];
    if (!classId) {
      for (const k of keys) for (const c of Object.keys(DATA.classes)) if (DATA.classes[c][k]) return DATA.classes[c][k];
    }
    return null;
  }

  function usesFor(name, classId, ctx) {
    ctx = ctx || {};
    let u = null;
    for (const k of keysFor(name)) {
      u = DATA.uses[(classId || 'species') + ':' + k];
      if (u) break;
    }
    if (!u) return null;
    const L = Number(ctx.classLevel) || 0;
    const m = (ctx.mods || {})[u.ability] || 0;
    let max = 0;
    if (u.fixed) max = u.fixed;
    else if (u.table) Object.keys(u.table).forEach((lv) => { if (L >= Number(lv)) max = u.table[lv]; });
    else if (u.perLevel) max = L >= (u.from || 1) ? L : 0;
    else if (u.ability) max = Math.max(u.min || 0, m + (u.plus || 0));
    const reset = u.shortFrom && L >= u.shortFrom ? 'Short Rest' : u.reset;
    if (u.pool) return { max: 0, pool: u.pool * L, reset: reset };
    if (!max) return null;
    const out = { max: max, reset: reset };
    if (u.label) out.label = u.label;
    return out;
  }
`;

const DATA = { classes: classes, traits: traits, uses: USES };
const body = header + `(function (root) {
  'use strict';
  const DATA = ${JSON.stringify(DATA)};
${runtime}
  const FEATURES_SRD5 = { classes: DATA.classes, traits: DATA.traits, uses: DATA.uses, lookup: lookup, usesFor: usesFor, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = FEATURES_SRD5;
  else root.FEATURES_SRD5 = FEATURES_SRD5;
})(typeof window !== 'undefined' ? window : this);
`;
const out = path.join(__dirname, '..', 'rules', 'srd5-features.js');
fs.writeFileSync(out, body);
const n = Object.values(classes).reduce((s, m) => s + Object.keys(m).length, 0);
console.log(path.relative(process.cwd(), out), n, 'class features,', Object.keys(traits).length, 'traits,', Math.round(fs.statSync(out).size / 1024) + ' KB');
