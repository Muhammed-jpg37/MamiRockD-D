// Run with: npm test   (node --test tests/)
// The Rules section (rules-catalog.js): its small Markdown renderer and its search.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// In Node the section puts itself on module.exports; in the browser runner, on window.
const mod = require('../rules-catalog.js');
const RC = (mod && mod.RulesCatalog) || globalThis.RulesCatalog;

test('rules section: bold, italics, lists and paragraphs', () => {
  const html = RC.md(['**Can\'t See.** You *can\'t* see.', '- one', '- two', 'After.']);
  assert.match(html, /<p><strong>Can&#39;t See\.<\/strong> You <em>can&#39;t<\/em> see\.<\/p>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<p>After\.<\/p>$/);
});

test('rules section: Markdown tables become tables, and text is escaped', () => {
  const html = RC.md(['| Pace | Distance |', '|---|---|', '| Fast | 4 miles |', '<script>x</script>']);
  assert.match(html, /<table class="rc-table"><tr><th>Pace<\/th><th>Distance<\/th><\/tr><tr><td>Fast<\/td><td>4 miles<\/td><\/tr><\/table>/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('rules section: search by name, by text for rules, and by filters', () => {
  const goblin = { name: 'Goblin', type: 'Humanoid (goblinoid)', crValue: 0.25 };
  const dragon = { name: 'Adult Red Dragon', type: 'Dragon', crValue: 17 };
  assert.ok(RC.matches('monsters', goblin, 'gob', ''));
  assert.ok(RC.matches('monsters', goblin, 'humanoid', ''));
  assert.ok(RC.matches('monsters', goblin, '', '0-1'));
  assert.ok(!RC.matches('monsters', dragon, '', '0-1'));
  assert.ok(RC.matches('monsters', dragon, '', '17-30'));
  const rule = { name: 'Cover', chapter: 'Combat', desc: ['Walls, trees and creatures can provide cover.'] };
  assert.ok(RC.matches('rules', rule, 'trees', ''));
  assert.ok(!RC.matches('items', { name: 'Rope', desc: ['trees'] }, 'trees', ''));
  assert.ok(RC.matches('items', { name: 'Rope', kind: 'gear' }, '', 'gear'));
  assert.ok(!RC.matches('items', { name: 'Longsword', kind: 'weapon' }, '', 'gear'));
  assert.ok(RC.matches('magic', { name: 'Bag of Holding', rarity: 'Uncommon' }, '', 'Uncommon'));
});

// Catalog items become store items (homebrew editor shape) and then sheet items that the
// sheet's AC maths recognise: armour = type Armor + category + base AC in statBonuses.ac.
const fs = require('fs');
const path = require('path');
const HBmod = require('../homebrew-editor.js');
const HB = (HBmod && HBmod.HomebrewEditor) || globalThis.HomebrewEditor;
const cat = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'catalog', f), 'utf8')).entries;

test('rules section: armour, shields and weapons from the catalog work on the sheet', () => {
  const items = cat('srd51-items.json');
  const chain = HB.itemForSheet(RC.toStoreDef('items', items.find((i) => i.id === 'chain_mail')), 1);
  assert.deepEqual([chain.type, chain.slot, chain.armorCategory, chain.statBonuses.ac, chain.weight], ['Armor', 'chest', 'Heavy', 16, 55]);
  const leather = HB.itemForSheet(RC.toStoreDef('items', items.find((i) => i.id === 'leather_armor')), 1);
  assert.deepEqual([leather.armorCategory, leather.statBonuses.ac], ['Light', 11]);
  const shield = HB.itemForSheet(RC.toStoreDef('items', items.find((i) => i.id === 'shield')), 1);
  assert.deepEqual([shield.type, shield.slot, shield.armorCategory, shield.statBonuses.ac], ['Shield', 'off', 'Bonus', 2]);
  const sword = HB.itemForSheet(RC.toStoreDef('items', items.find((i) => i.id === 'longsword')), 1);
  assert.deepEqual([sword.type, sword.slot, sword.proficiencyType], ['Weapon', 'main', 'Martial']);
  assert.match(sword.desc, /Damage 1d8 slashing \(versatile 1d10\)/);
  const dagger = RC.toStoreDef('items', items.find((i) => i.id === 'dagger'));
  assert.equal(dagger.proficiencyType, 'Simple');
});

test('rules section: magic items keep rarity and attunement and get a sensible slot', () => {
  const magic = cat('srd51-magic-items.json');
  const cloak = RC.toStoreDef('magic', magic.find((m) => m.id === 'cloak_of_protection'));
  assert.deepEqual([cloak.type, cloak.rarity, cloak.attunementRequired, cloak.slot], ['Wondrous Item', 'Uncommon', true, 'cloak']);
  const potion = RC.toStoreDef('magic', magic.find((m) => /^potion_of_healing/.test(m.id)));
  assert.equal(potion.type, 'Consumable');
  const ring = RC.toStoreDef('magic', magic.find((m) => m.id === 'ring_of_protection'));
  assert.deepEqual([ring.type, ring.slot], ['Ring', 'ring1']);
  assert.equal(RC.slotFromName('Boots of Speed'), 'boots');
  assert.equal(RC.slotFromName('Bag of Holding'), '');
  magic.forEach((m) => assert.ok(RC.toStoreDef('magic', m).desc.length <= 3000, m.id));
});
