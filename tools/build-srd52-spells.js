#!/usr/bin/env node
/* Builds rules/srd52-spells.js from the 5e-bits SRD 5.2 (2024 rules) spell list.

   Source: https://github.com/5e-bits/5e-srd-api — packages/5e-database/src/2024/en/5e-SRD-Spells.json
   (same data as the archived 5e-bits/5e-database repo; dataset under the MIT licence,
   spell text SRD 5.2, CC-BY-4.0).

   Usage:
     curl -o spells52.json https://raw.githubusercontent.com/5e-bits/5e-srd-api/main/packages/5e-database/src/2024/en/5e-SRD-Spells.json
     node tools/build-srd52-spells.js spells52.json

   Writes rules/srd52-spells.js. Run it again to regenerate; do not edit the output by hand.

   The source was extracted from the SRD PDF and has some faults. This script repairs the
   mechanical ones and marks the rest (see TEXT_ISSUES) instead of guessing their text. */
'use strict';

const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node tools/build-srd52-spells.js <2024 5e-SRD-Spells.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(input, 'utf8'));

const CLASSES = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
const ABILITIES = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };

// Spells whose description in the source is garbled. Their stats are fine; the text
// should be checked against the SRD 5.2 PDF (https://www.dndbeyond.com/srd).
const TEXT_ISSUES = {
  'control-water': 'Text from Control Weather (its tables) is mixed into this description.',
  'control-weather': 'Description stops mid-sentence; the rest and its tables ended up in Control Water.',
  'divine-word': 'The Divine Word Effects table is missing the 31–40 Hit Points row.',
  'creation': 'The duration table at the end is flattened into plain text.',
  'greater-restoration': 'The list of effects it can end is cut off.',
  'guards-and-wards': 'Description stops mid-sentence.',
  'telekinesis': 'Description stops mid-sentence.'
};

// Fields the source gets wrong, corrected from the SRD 5.2 text.
const FIXES = {
  'protection-from-evil-and-good': { concentration: true } // SRD: "Concentration, up to 10 minutes"
};

const idOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "whirl- pool" → "whirlpool": line-break hyphens left over from the PDF.
const fixText = (s) => String(s).replace(/([a-z])- ([a-z])/g, '$1$2').replace(/\s+$/g, '').replace(/^\s+/g, '');
const paragraphs = (s) => String(s || '').split('\n').map(fixText).filter(Boolean);

const repaired = [];

const spells = raw.map((s) => {
  // Some entries have the components stuck in the range: "Touch Component: V, S".
  let range = s.range;
  let components = s.components.slice();
  const m = /^(.*?)\s+Components?:\s*(.+)$/i.exec(range);
  if (m) {
    range = m[1];
    if (!components.length) components = m[2].split(/\s*,\s*/).map((c) => c.trim().charAt(0).toUpperCase());
    repaired.push(s.name + ': components moved out of range');
  }

  // "up to 1 minute" / "Concentration up to 10 minutes" → "Up to 1 minute"; concentration is its own flag.
  const duration = cap(String(s.duration).replace(/^Concentration,?\s*/i, ''));

  const desc = paragraphs(s.description);
  const out = {
    id: idOf(s.name),
    name: s.name,
    level: s.level,
    school: s.school.name,
    castingTime: s.casting_time,
    ritual: !!s.ritual,
    range: range,
    components: components,
    material: s.material ? cap(s.material) : null,
    duration: duration,
    concentration: !!s.concentration,
    classes: s.classes.map((c) => c.index).filter((c) => CLASSES.includes(c)).sort(),
    desc: desc,
    higherLevel: paragraphs(s.higher_level),
    ruleset: '2024',
    source: 'SRD',
    license: 'srd52'
  };
  if (s.attack_type) out.attack = s.attack_type;
  // The 2024 source has no save field; take the first saving throw the text asks for.
  const save = /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/.exec(desc.join(' '));
  if (save) out.save = ABILITIES[save[1].toLowerCase()];
  const types = [].concat(s.damage || []).map((d) => d && d.damage_type && d.damage_type.name).filter(Boolean);
  if (types.length) out.damageType = [...new Set(types)].join(', ');
  if (TEXT_ISSUES[s.index]) out.textIssue = TEXT_ISSUES[s.index];
  if (FIXES[s.index]) {
    Object.assign(out, FIXES[s.index]);
    repaired.push(s.name + ': ' + Object.keys(FIXES[s.index]).join(', ') + ' corrected');
  }
  return out;
}).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

// Sanity checks: fail loudly instead of writing bad data.
const ids = new Set();
for (const s of spells) {
  if (ids.has(s.id)) throw new Error('Duplicate id ' + s.id);
  ids.add(s.id);
  if (!(s.level >= 0 && s.level <= 9)) throw new Error('Bad level on ' + s.name);
  if (!s.classes.length) throw new Error('No class list on ' + s.name);
  if (!s.desc.length) throw new Error('No description on ' + s.name);
  if (!s.components.length || s.components.some((c) => !['V', 'S', 'M'].includes(c))) throw new Error('Bad components on ' + s.name);
  if (/component/i.test(s.range)) throw new Error('Components still in range on ' + s.name);
  if (s.components.includes('M') !== !!s.material) throw new Error('Material does not match M on ' + s.name);
}
for (const id of Object.keys(TEXT_ISSUES).concat(Object.keys(FIXES))) {
  if (!raw.some((s) => s.index === id)) throw new Error('TEXT_ISSUES or FIXES names a spell not in the source: ' + id);
}
if (spells.length !== 339) throw new Error('Expected the 339 SRD 5.2 spells, got ' + spells.length);

const header = `/* ========================================================
   D&D 5e (2024) SPELLS — SRD 5.2 content only (339 spells)
   GENERATED by tools/build-srd52-spells.js. Do not edit by hand.

   This work includes material taken from the System Reference
   Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC and
   available at https://www.dndbeyond.com/srd. The SRD 5.2 is
   licensed under the Creative Commons Attribution 4.0
   International License available at
   https://creativecommons.org/licenses/by/4.0/legalcode.

   Converted from the 5e-bits 5e-database dataset
   (https://github.com/5e-bits/5e-srd-api), MIT licence,
   Copyright (c) 2018-2020 Adrian Padua, Christopher Ward.

   Same fields as rules/srd5-spells.js (2014). Differences:
   castingTime uses 2024 wording ("Action", "Bonus Action",
   "Reaction, which you take when …"); save is read from the
   text; there is no area field. textIssue marks the few spells
   whose source text is garbled — check those against the SRD.
   ======================================================== */
`;

const body = `(function (root) {
  'use strict';
  const SPELLS_SRD52 = ${JSON.stringify(spells, null, 1)};

  if (typeof module !== 'undefined' && module.exports) module.exports = SPELLS_SRD52;
  else root.SPELLS_SRD52 = SPELLS_SRD52;
})(typeof window !== 'undefined' ? window : this);
`;

const outPath = path.join(__dirname, '..', 'rules', 'srd52-spells.js');
fs.writeFileSync(outPath, header + body);
console.log('Repaired: ' + repaired.length + ' (' + repaired.join('; ') + ')');
console.log('Marked with textIssue: ' + Object.keys(TEXT_ISSUES).length);
console.log('Wrote ' + spells.length + ' spells to ' + path.relative(process.cwd(), outPath));
