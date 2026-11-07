// Run with: npm test   (node --test tests/)
// The campaign item store (homebrew editor, Items tab) and how a store item
// becomes a sheet item when the DM gives it with Gift Loot.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// In Node the editor puts itself on module.exports; in the browser runner, on window.
const mod = require('../homebrew-editor.js');
const HB = (mod && mod.HomebrewEditor) || globalThis.HomebrewEditor;

test('items: the form becomes a store entry, empty fields dropped', () => {
  const def = HB.toDef('items', {
    name: 'Cloak of Dusk', icon: '', type: 'Misc', rarity: 'Very Rare', slot: 'cloak',
    weight: '1', acBonus: '2', attunementRequired: false, desc: ' Shadows cling to it. '
  });
  assert.deepEqual(def, {
    name: 'Cloak of Dusk', icon: '🎁', type: 'Misc', rarity: 'Very Rare', slot: 'cloak',
    weight: 1, acBonus: 2, desc: 'Shadows cling to it.'
  });
});

test('items: no slot and no weight are left out, a weight of 0 is kept', () => {
  const none = HB.toDef('items', { name: 'Potion', type: 'Consumable', rarity: 'Common', slot: '', weight: '' });
  assert.equal('slot' in none, false);
  assert.equal('weight' in none, false);
  const zero = HB.toDef('items', { name: 'Feather', type: 'Misc', rarity: 'Common', weight: '0' });
  assert.equal(zero.weight, 0);
});

test('items: a store item becomes a full sheet item', () => {
  const it = HB.itemForSheet({ name: 'Ring of Embers', icon: '💍', type: 'Ring', rarity: 'Rare', slot: 'ring1', acBonus: 1, attunementRequired: true, desc: 'Warm.' }, 2);
  assert.equal(it.name, 'Ring of Embers');
  assert.equal(it.qty, 2);
  assert.equal(it.slot, 'ring1');
  assert.equal(it.attunementRequired, true);
  assert.equal(it.statBonuses.ac, 1);
  assert.equal(it.armorCategory, 'Bonus');   // an AC bonus on a non-armour item counts as a bonus
  assert.equal(it.equipped, false);
  assert.deepEqual(it.buffs, []);
  assert.deepEqual(it.skillBonuses, {});
});

test('items: defaults for a bare store item', () => {
  const it = HB.itemForSheet({ name: 'Trinket' });
  assert.equal(it.qty, 1);
  assert.equal(it.type, 'Wondrous Item');
  assert.equal(it.rarity, 'Common');
  assert.equal(it.slot, null);
  assert.equal(it.armorCategory, null);
  assert.equal(it.weight, 0);
  assert.equal(it.statBonuses.ac, 0);
});
