// Run with: npm test   (node --test tests/)
// The SRD catalogs in rules/catalog/ (built by tools/build-srd-catalogs.js): monsters,
// equipment, magic items, conditions and rule sections, 2014 (SRD 5.1) and 2024 (SRD 5.2).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'rules', 'catalog');
const load = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));

const FILES = {
  'srd51-monsters.json': 334, 'srd51-items.json': 237, 'srd51-magic-items.json': 362, 'srd51-conditions.json': 15, 'srd51-rules.json': 134,
  'srd52-monsters.json': 341, 'srd52-items.json': 182, 'srd52-magic-items.json': 262, 'srd52-conditions.json': 15
};

test('catalogs: every file is there, with its count, licence and attribution', () => {
  Object.keys(FILES).forEach((f) => {
    const c = load(f);
    assert.equal(c.entries.length, FILES[f], f);
    assert.equal(c.meta.count, FILES[f], f);
    assert.equal(c.meta.license, 'CC-BY-4.0', f);
    assert.match(c.meta.attribution, /System Reference Document 5\.[12]/, f);
    assert.equal(c.meta.ruleset, f.startsWith('srd51') ? '2014' : '2024', f);
  });
});

test('catalogs: ids are unique per file and every entry has a name and ruleset', () => {
  Object.keys(FILES).forEach((f) => {
    const { meta, entries } = load(f);
    const ids = new Set();
    entries.forEach((e) => {
      assert.ok(e.id && e.name, f + ' entry without id or name');
      assert.equal(e.ruleset, meta.ruleset, f + ' ' + e.id);
      assert.ok(!ids.has(e.id), f + ' duplicate id ' + e.id);
      ids.add(e.id);
    });
  });
});

test('catalogs: monster stat blocks are complete', () => {
  ['srd51-monsters.json', 'srd52-monsters.json'].forEach((f) => {
    load(f).entries.forEach((m) => {
      assert.ok(m.ac > 0 && m.hp > 0, f + ' ' + m.id + ' AC/HP');
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((a) => assert.equal(typeof m.abilities[a], 'number', f + ' ' + m.id + ' ' + a));
      assert.ok(m.cr !== undefined, f + ' ' + m.id + ' CR');
    });
  });
  const goblin = load('srd51-monsters.json').entries.find((m) => m.id === 'goblin');
  assert.equal(goblin.cr, '1/4');
  assert.equal(goblin.xp, 50);
  const scimitar = goblin.actions.find((a) => a.name === 'Scimitar');
  assert.equal(scimitar.attack, 4);
  assert.deepEqual(scimitar.damage, [{ dice: '1d6+2', type: 'Slashing' }]);
});

test('catalogs: weapons, armour and shields carry what the sheet maths will need', () => {
  ['srd51-items.json', 'srd52-items.json'].forEach((f) => {
    const items = load(f).entries;
    const ls = items.find((i) => i.id === 'longsword');
    assert.equal(ls.kind, 'weapon');
    assert.equal(ls.damage, '1d8 slashing');
    assert.equal(ls.versatile, '1d10');
    assert.equal(ls.weaponCategory, 'Martial');
    const cm = items.find((i) => i.id === 'chain_mail');
    assert.equal(cm.kind, 'armor');
    assert.deepEqual([cm.armor.base, cm.armor.dex, cm.armor.category], [16, false, 'Heavy']);
    assert.equal(cm.strMin, 13);
    const sh = items.find((i) => i.id === 'shield');
    assert.equal(sh.kind, 'shield');
    assert.equal(sh.armor.base, 2);
    items.filter((i) => i.kind === 'weapon').forEach((w) => assert.ok(w.damage || /net|blowgun/i.test(w.name) || w.properties, f + ' ' + w.id));
  });
  assert.equal(load('srd52-items.json').entries.find((i) => i.id === 'longsword').mastery, 'Sap');
});

test('catalogs: magic items have a rarity; conditions and rules have text', () => {
  ['srd51-magic-items.json', 'srd52-magic-items.json'].forEach((f) => {
    load(f).entries.forEach((m) => assert.ok(m.rarity, f + ' ' + m.id));
    assert.equal(load(f).entries.find((m) => m.id === 'cloak_of_protection').attunement, true);
  });
  ['srd51-conditions.json', 'srd52-conditions.json'].forEach((f) => {
    const names = load(f).entries.map((c) => c.name);
    ['Blinded', 'Grappled', 'Poisoned', 'Prone', 'Unconscious'].forEach((n) => assert.ok(names.includes(n), f + ' ' + n));
    load(f).entries.forEach((c) => assert.ok(c.desc.length, f + ' ' + c.id));
  });
  const chapters = new Set(load('srd51-rules.json').entries.map((r) => r.chapter));
  ['Combat', 'Using Ability Scores', 'Adventuring', 'Spellcasting'].forEach((c) => assert.ok(chapters.has(c), c));
});
