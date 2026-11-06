// Run with: npm test   (node --test tests/)
// Checks the per-class spell rules in rules/srd5.js against the SRD 5.1 class tables.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SRD = require('../rules/srd5.js');

const C = (k) => SRD.classes[k].spellcasting;
const CASTERS = Object.keys(SRD.classes).filter((k) => SRD.classes[k].spellcasting);
const at = (table, lvl) => table[lvl - 1];

test('the eight SRD casters, each prepared or known (never both)', () => {
  assert.deepEqual(CASTERS.sort(), ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']);
  for (const k of CASTERS) {
    const sc = C(k);
    assert.ok(!!sc.known !== !!sc.prepared, k + ': exactly one of known / prepared');
    assert.equal(!!sc.replaceOnLevelUp, !!sc.known, k + ': known casters swap a spell on level up');
  }
});

test('every table has 20 levels and never goes down', () => {
  for (const k of CASTERS) {
    const sc = C(k);
    for (const name of ['cantrips', 'known']) {
      const t = sc[name];
      if (!t) continue;
      assert.equal(t.length, 20, k + '.' + name);
      t.forEach((v, i) => {
        assert.ok(Number.isInteger(v) && v >= 0, k + '.' + name + ' level ' + (i + 1));
        if (i) assert.ok(v >= t[i - 1], k + '.' + name + ' drops at level ' + (i + 1));
      });
    }
  }
});

test('cantrips known (SRD class tables)', () => {
  const expect = {
    bard: [2, 3, 4], cleric: [3, 4, 5], druid: [2, 3, 4], sorcerer: [4, 5, 6], warlock: [2, 3, 4], wizard: [3, 4, 5],
    paladin: [0, 0, 0], ranger: [0, 0, 0]
  };
  for (const k of CASTERS) {
    const t = C(k).cantrips;
    assert.deepEqual([at(t, 1), at(t, 4), at(t, 10)], expect[k], k);
    assert.equal(at(t, 3), at(t, 1), k + ' level 3');
    assert.equal(at(t, 9), at(t, 4), k + ' level 9');
    assert.equal(at(t, 20), at(t, 10), k + ' level 20');
  }
});

test('spells known (SRD class tables)', () => {
  assert.deepEqual(C('bard').known, [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22]);
  assert.deepEqual(C('sorcerer').known, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15]);
  assert.deepEqual(C('warlock').known, [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]);
  assert.deepEqual(C('ranger').known, [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]);
});

test('the bard table already holds the Magical Secrets spells', () => {
  const sc = C('bard');
  assert.deepEqual(sc.magicalSecrets, { 10: 2, 14: 2, 18: 2 });
  // At each Magical Secrets level the table rises by 2 instead of 1 (or 0 at 18).
  assert.equal(at(sc.known, 10) - at(sc.known, 9), 2);
  assert.equal(at(sc.known, 14) - at(sc.known, 13), 2);
  assert.equal(at(sc.known, 18) - at(sc.known, 17), 2);
  assert.deepEqual(SRD.classes.bard.subclasses.lore.additionalMagicalSecrets, { 6: 2 });
  assert.equal(at(sc.known, 6) - at(sc.known, 5), 1, 'Lore secrets are not in the table');
});

test('prepared casters: ability modifier + level (paladin: half level)', () => {
  assert.deepEqual(C('cleric').prepared, { levelDivisor: 1 });
  assert.deepEqual(C('druid').prepared, { levelDivisor: 1 });
  assert.deepEqual(C('paladin').prepared, { levelDivisor: 2 });
  assert.deepEqual(C('wizard').prepared, { levelDivisor: 1, from: 'spellbook' });
});

test('wizard spellbook: six spells at level 1, two more each level', () => {
  assert.deepEqual(C('wizard').spellbook, { start: 6, perLevel: 2 });
});

test('warlock Mystic Arcanum: 6th to 9th level at warlock levels 11, 13, 15, 17', () => {
  assert.deepEqual(C('warlock').mysticArcanum, { 11: 6, 13: 7, 15: 8, 17: 9 });
  // The features list names the same levels.
  const f = SRD.classes.warlock.features;
  Object.entries(C('warlock').mysticArcanum).forEach(([lvl, sl]) => {
    assert.ok(f[lvl].some((x) => x.includes('Mystic Arcanum') && x.includes(sl + 'th')), 'feature at ' + lvl);
  });
});

test('Magical Secrets levels match the bard features', () => {
  const f = SRD.classes.bard.features;
  Object.keys(C('bard').magicalSecrets).forEach((lvl) => assert.ok(f[lvl].includes('Magical Secrets'), 'feature at ' + lvl));
  assert.ok(SRD.classes.bard.subclasses.lore.features[6].includes('Additional Magical Secrets'));
});

test('ritual casting: bard (known), cleric and druid (prepared), wizard (spellbook)', () => {
  const r = {};
  CASTERS.forEach((k) => { if (C(k).ritual) r[k] = C(k).ritual; });
  assert.deepEqual(r, { bard: 'known', cleric: 'prepared', druid: 'prepared', wizard: 'spellbook' });
});

test('every caster gets some spell or cantrip by the level its Spellcasting starts', () => {
  for (const k of CASTERS) {
    const sc = C(k);
    const start = Number(Object.keys(SRD.classes[k].features).find((l) => SRD.classes[k].features[l].some((x) => x === 'Spellcasting' || x === 'Pact Magic')));
    const known = sc.known ? at(sc.known, start) : 1; // prepared casters always prepare at least one
    assert.ok(known + at(sc.cantrips, start) > 0, k + ' at level ' + start);
    if (sc.known && start > 1) assert.equal(at(sc.known, start - 1), 0, k + ' knows no spells before level ' + start);
  }
});
