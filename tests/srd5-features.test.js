// Run with: npm test   (node --test tests/)
// SRD 5.1 feature text and limited uses (rules/srd5-features.js, feature plan 3.4).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../rules/srd5-features.js');
const R = require('../rules/srd5.js');

test('srd features: every builder feature and species trait has SRD text', () => {
  const missing = [];
  Object.keys(R.classes).forEach((id) => {
    const c = R.classes[id];
    const names = [];
    Object.values(c.features || {}).forEach((list) => names.push(...list));
    Object.values(c.subclasses || {}).forEach((s) => Object.values(s.features || {}).forEach((list) => names.push(...list)));
    names.forEach((n) => { if (!F.lookup(n, id)) missing.push(id + ': ' + n); });
  });
  Object.values(R.species).forEach((s) => {
    const traits = (s.traits || []).concat(...Object.values(s.subraces || {}).map((x) => x.traits || []));
    traits.forEach((t) => { if (!F.lookup(t)) missing.push('species: ' + t); });
  });
  assert.deepEqual(missing, []);
});

test('srd features: names with suffixes find their text', () => {
  assert.equal(F.lookup('Spellcasting', 'bard').name, 'Spellcasting: Bard');
  assert.equal(F.lookup('Spellcasting', 'wizard').name, 'Spellcasting: Wizard', 'the class decides which Spellcasting');
  assert.equal(F.lookup('Action Surge (two uses)', 'fighter').name, 'Action Surge (1 use)');
  assert.equal(F.lookup('Destroy Undead (CR 2)', 'cleric').name, 'Destroy Undead (CR 1/2 or below)');
  assert.equal(F.lookup('Draconic Ancestry: Red (Fire, 15 ft. cone)').name, 'Draconic Ancestry (Red)');
  assert.equal(F.lookup('Cantrip').name, 'High Elf Cantrip');
  assert.match(F.lookup('Rage', 'barbarian').desc, /bonus action/);
  assert.equal(F.lookup('Made-up power', 'fighter'), null);
});

test('srd features: limited uses follow the class tables', () => {
  const at = (name, cls, level, mods) => F.usesFor(name, cls, { classLevel: level, mods: mods || {} });
  assert.deepEqual([1, 3, 6, 12, 17, 20].map((l) => at('Rage', 'barbarian', l).max), [2, 3, 4, 5, 6, 6]);
  assert.deepEqual(at('Bardic Inspiration (d6)', 'bard', 1, { cha: 3 }), { max: 3, reset: 'Long Rest' });
  assert.deepEqual(at('Bardic Inspiration (d8)', 'bard', 5, { cha: 3 }), { max: 3, reset: 'Short Rest' }, 'Font of Inspiration');
  assert.equal(at('Bardic Inspiration (d6)', 'bard', 1, { cha: -1 }).max, 1, 'at least once');
  assert.equal(at('Channel Divinity (2/rest)', 'cleric', 6).max, 2);
  assert.equal(at('Channel Divinity', 'paladin', 3).max, 1);
  assert.equal(at('Action Surge (one use)', 'fighter', 2).max, 1);
  assert.equal(at('Action Surge (two uses)', 'fighter', 17).max, 2);
  assert.equal(at('Indomitable (three uses)', 'fighter', 17).max, 3);
  assert.equal(at('Ki', 'monk', 7).max, 7);
  assert.equal(at('Font of Magic', 'sorcerer', 4).label, 'Sorcery Points');
  assert.equal(at('Divine Sense', 'paladin', 1, { cha: 2 }).max, 3);
  assert.deepEqual(at('Lay on Hands', 'paladin', 4), { max: 0, pool: 20, reset: 'Long Rest' });
  assert.deepEqual(F.usesFor('Breath Weapon', null, {}), { max: 1, reset: 'Short Rest' });
  assert.equal(at('Extra Attack', 'fighter', 5), null, 'no uses');
  assert.equal(at('Rage', 'fighter', 5), null, 'uses belong to their class');
});
