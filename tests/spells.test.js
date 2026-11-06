// Run with: npm test   (node --test tests/)
// Checks the generated SRD 5.1 spell data (rules/srd5-spells.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SPELLS = require('../rules/srd5-spells.js');
const SRD = require('../rules/srd5.js');

const byId = (id) => SPELLS.find((s) => s.id === id);
const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

test('all 319 SRD 5.1 spells, with the SRD count per level', () => {
  assert.equal(SPELLS.length, 319);
  const perLevel = {};
  SPELLS.forEach((s) => { perLevel[s.level] = (perLevel[s.level] || 0) + 1; });
  assert.deepEqual(perLevel, { 0: 24, 1: 49, 2: 54, 3: 42, 4: 31, 5: 37, 6: 31, 7: 20, 8: 16, 9: 15 });
});

test('every spell is complete and tagged', () => {
  const ids = new Set();
  for (const s of SPELLS) {
    assert.ok(!ids.has(s.id), 'duplicate id ' + s.id);
    ids.add(s.id);
    assert.ok(SCHOOLS.includes(s.school), s.name + ': school ' + s.school);
    assert.ok(s.castingTime && s.range && s.duration, s.name + ': missing stats');
    assert.ok(s.components.length && s.components.every((c) => ['V', 'S', 'M'].includes(c)), s.name + ': components');
    assert.equal(s.components.includes('M'), !!s.material, s.name + ': material matches M');
    assert.ok(s.desc.length && s.desc.every((p) => p.length > 0), s.name + ': description');
    assert.equal(typeof s.ritual, 'boolean');
    assert.equal(typeof s.concentration, 'boolean');
    assert.deepEqual([s.ruleset, s.source, s.license], ['2014', 'SRD', 'srd51']);
  }
});

test('class lists only use spellcasting classes from the rules', () => {
  for (const s of SPELLS) {
    assert.ok(s.classes.length, s.name + ' has no class');
    s.classes.forEach((c) => {
      assert.ok(SRD.classes[c], s.name + ': unknown class ' + c);
      assert.ok(SRD.classes[c].spellcasting, s.name + ': ' + c + ' is not a caster');
    });
  }
});

test('spot checks against the SRD', () => {
  assert.deepEqual(byId('guidance').classes, ['cleric', 'druid']);
  assert.equal(byId('guidance').concentration, true);
  assert.deepEqual(byId('eldritch_blast').classes, ['warlock']);
  assert.equal(byId('fireball').level, 3);
  assert.equal(byId('fireball').save, 'dex');
  assert.equal(byId('fireball').damageType, 'Fire');
  assert.equal(byId('wish').concentration, false);
  assert.equal(byId('mage_armor').duration, '8 hours');
  assert.equal(byId('detect_magic').ritual, true);
  assert.equal(byId('shield').castingTime, '1 reaction');
  assert.equal(byId('hunters_mark').castingTime, '1 bonus action');
  // Not SRD 5.1: must not be here.
  assert.equal(byId('hex'), undefined);
  assert.equal(byId('chromatic_orb'), undefined);
});

/* --- SRD 5.2 (2024 rules): rules/srd52-spells.js --- */
const SPELLS52 = require('../rules/srd52-spells.js');
const byId52 = (id) => SPELLS52.find((s) => s.id === id);

test('2024: all 339 SRD 5.2 spells, with the count per level', () => {
  assert.equal(SPELLS52.length, 339);
  const perLevel = {};
  SPELLS52.forEach((s) => { perLevel[s.level] = (perLevel[s.level] || 0) + 1; });
  assert.deepEqual(perLevel, { 0: 27, 1: 57, 2: 57, 3: 42, 4: 34, 5: 38, 6: 31, 7: 20, 8: 17, 9: 16 });
});

test('2024: every spell is complete and tagged', () => {
  const ids = new Set();
  for (const s of SPELLS52) {
    assert.ok(!ids.has(s.id), 'duplicate id ' + s.id);
    ids.add(s.id);
    assert.ok(SCHOOLS.includes(s.school), s.name + ': school ' + s.school);
    assert.ok(s.castingTime && s.range && s.duration, s.name + ': missing stats');
    assert.ok(!/component/i.test(s.range), s.name + ': components left in range');
    assert.ok(s.components.length && s.components.every((c) => ['V', 'S', 'M'].includes(c)), s.name + ': components');
    assert.equal(s.components.includes('M'), !!s.material, s.name + ': material matches M');
    assert.ok(!/^concentration/i.test(s.duration), s.name + ': concentration belongs in its flag');
    assert.ok(s.desc.length && s.desc.every((p) => p.length > 0), s.name + ': description');
    assert.ok(s.classes.length && s.classes.every((c) => SRD.classes[c] && SRD.classes[c].spellcasting), s.name + ': classes');
    assert.deepEqual([s.ruleset, s.source, s.license], ['2024', 'SRD', 'srd52']);
  }
});

test('2024: repaired source faults and spot checks', () => {
  // components were stuck in the range field in the source
  assert.equal(byId52('guidance').range, 'Touch');
  assert.deepEqual(byId52('guidance').components, ['V', 'S']);
  assert.deepEqual(byId52('power_word_kill').components, ['V']);
  assert.equal(byId52('protection_from_evil_and_good').concentration, true);
  // 2024 changes from the 2014 spells
  assert.equal(byId52('spiritual_weapon').concentration, true);
  assert.equal(byId52('true_strike').concentration, false);
  assert.equal(byId52('cure_wounds').school, 'Abjuration');
  assert.deepEqual(byId52('hex').classes, ['warlock']);
  assert.equal(byId52('fireball').save, 'dex');
  assert.equal(byId52('feeblemind'), undefined); // replaced by Befuddlement
  assert.ok(byId52('befuddlement'));
  // garbled source text is marked, not guessed
  const marked = SPELLS52.filter((s) => s.textIssue).map((s) => s.id).sort();
  assert.deepEqual(marked, ['control_water', 'control_weather', 'creation', 'divine_word', 'greater_restoration', 'guards_and_wards', 'telekinesis']);
});

/* --- The Spells tab catalog: spell-catalog.json / spell-catalog.js --- */
const CATALOG = require('../spell-catalog.json');

test('catalog: every spell has a ruleset and a license', () => {
  for (const s of CATALOG) {
    assert.ok(['2014', '2024'].includes(s.ruleset), s.name + ' (' + s.source + '): ruleset ' + s.ruleset);
    assert.ok(['srd51', 'srd52', 'none'].includes(s.license), s.name + ': license ' + s.license);
    if (s.license === 'srd51') assert.equal(s.ruleset, '2014', s.name);
    if (s.license === 'srd52') assert.equal(s.ruleset, '2024', s.name);
  }
});

const findIn = (name, ruleset) => CATALOG.filter((s) => s.name === name && s.ruleset === ruleset);

test('catalog: tags follow the book and the SRD lists', () => {
  const one = (name, ruleset) => { const f = findIn(name, ruleset); assert.equal(f.length, 1, name + ' ' + ruleset); return f[0]; };
  assert.deepEqual([one('Fire Bolt', '2014').source, one('Fire Bolt', '2014').license], ['SRD', 'srd51']);
  assert.deepEqual([one('Fire Bolt', '2024').source, one('Fire Bolt', '2024').license], ['SRD52', 'srd52']);
  assert.deepEqual([one('Hex', '2014').source, one('Hex', '2014').license], ['PHB', 'none']);   // not in SRD 5.1
  assert.deepEqual([one('Hex', '2024').source, one('Hex', '2024').license], ['SRD52', 'srd52']); // in SRD 5.2
  assert.ok(CATALOG.filter((s) => s.source === 'SRD').every((s) => s.license === 'srd51'));
  assert.ok(CATALOG.filter((s) => s.source === 'SRD52').every((s) => s.license === 'srd52'));
});

test('catalog: one entry per spell per ruleset', () => {
  const seen = new Set();
  for (const s of CATALOG) {
    const k = s.ruleset + '|' + s.name.toLowerCase();
    assert.ok(!seen.has(k), 'duplicate ' + k);
    seen.add(k);
    assert.ok(Array.isArray(s.books) && s.books.length, s.name + ': books');
  }
  // every SRD spell exactly once, under its SRD name
  assert.equal(CATALOG.filter((s) => s.license === 'srd51').length, SPELLS.length);
  assert.equal(CATALOG.filter((s) => s.license === 'srd52').length, SPELLS52.length);
});

test('catalog: SRD renames and book copies are merged into the SRD entry', () => {
  const disk = findIn('Floating Disk', '2014')[0];
  assert.deepEqual(disk.aliases, ["Tenser's Floating Disk"]);
  assert.deepEqual(disk.books, ['SRD', 'PHB']);
  assert.equal(findIn("Tenser's Floating Disk", '2014').length, 0);
  assert.deepEqual(findIn('Arcane Sword', '2024')[0].aliases, ["Mordenkainen's Sword"]);
  // a different spell with a similar name is not merged
  assert.equal(findIn("Jim's Magic Missile", '2014').length, 1);
  assert.equal(findIn('Magic Missile', '2014')[0].aliases, undefined);
});

test('catalog: SRD entries carry the real SRD stats in the Spells tab format', () => {
  const g = findIn('Guidance', '2014')[0];
  assert.deepEqual(g.classes, ['Cleric', 'Druid']);
  assert.equal(g.duration, 'Concentration, up to 1 minute');
  assert.equal(g.concentration, true);
  const f = findIn('Fireball', '2014')[0];
  assert.equal(f.components, 'V, S, M (a tiny ball of bat guano and sulfur)');
  assert.equal(f.schoolName, 'Evocation');
  assert.equal(f.school, 'V');
  assert.ok(f.desc.includes('The fire spreads around corners.'));
  assert.equal(findIn('Spiritual Weapon', '2024')[0].concentration, true);
  assert.ok(findIn('Control Water', '2024')[0].textIssue);
});

test('catalog: spell-catalog.js holds the same data as the JSON', () => {
  const sandbox = {};
  new Function('window', require('fs').readFileSync(require('path').join(__dirname, '..', 'spell-catalog.js'), 'utf8'))(sandbox);
  assert.deepEqual(sandbox.SPELL_CATALOG, CATALOG);
});
