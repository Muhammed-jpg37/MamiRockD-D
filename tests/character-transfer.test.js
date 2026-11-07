// Run with: npm test   (node --test tests/)
// Character files (character-transfer.js): export, import, and what an import keeps or drops.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// In Node the module puts itself on module.exports; in the browser runner, on window.
const mod = require('../character-transfer.js');
const T = (mod && mod.CharacterTransfer) || globalThis.CharacterTransfer;

const SHEET = {
  campaign: "Lyra's Vault",
  characterStats: { level: 5, characterClass: 'Wizard', species: 'Elf', int: 17 },
  items: [{ name: 'Staff', qty: 1 }],
  hp: { current: 20, max: 28 },
  spellbook: { catalog: [1, 2, 3], spells: [{ name: 'Fireball' }] },
  build: { name: 'Lyra', details: { portrait: 'data:image/webp;base64,AAAA' } },
  activeTab: 'spells'
};

test('character files: export then import gives the same sheet under the file\'s name', () => {
  const file = T.makeExport(SHEET, 'Lyra');
  assert.equal(file.format, 'mamirock-character');
  assert.equal(file.version, 1);
  assert.equal(file.sheet.spellbook.catalog, undefined, 'the shared catalog is not exported');
  assert.equal(SHEET.spellbook.catalog.length, 3, 'the original sheet is untouched');
  const back = T.parseExport(JSON.stringify(file));
  assert.equal(back.name, 'Lyra');
  assert.deepEqual(back.sheet.characterStats, SHEET.characterStats);
  assert.deepEqual(back.sheet.items, SHEET.items);
  assert.equal(back.sheet.build.details.portrait, 'data:image/webp;base64,AAAA');
  assert.equal(back.sheet.campaign, "Lyra's Vault");
  assert.equal(back.sheet.activeTab, undefined);
  assert.deepEqual(back.warnings, []);
  assert.equal(T.fileName("Lyra O'Neil"), 'lyra-o-neil.mamirock.json');
});

test('character files: wrong or broken files are refused with a message', () => {
  assert.throws(() => T.parseExport('not json'), /not JSON/);
  assert.throws(() => T.parseExport('{"a":1}'), /not a MamiRock character file/);
  assert.throws(() => T.parseExport(JSON.stringify({ format: 'mamirock-character', version: 1 })), /no character sheet/);
  assert.throws(() => T.parseExport(JSON.stringify({ format: 'mamirock-character', version: 1, sheet: { items: [] } })), /no stats/);
  assert.throws(() => T.parseExport(JSON.stringify({ format: 'mamirock-character', version: 99, sheet: SHEET })), /newer version/);
  assert.throws(() => T.parseExport('x'.repeat(1600000)), /too large/);
  assert.throws(() => T.makeExport(null, 'X'), /no sheet/);
});

test('character files: an import drops bad items and portraits that are not pictures', () => {
  const file = T.makeExport(Object.assign({}, SHEET, {
    items: [{ name: 'Rope' }, null, { qty: 2 }, 'text'],
    portrait: 'https://example.com/x.png',
    build: { name: 'Old', details: { portrait: 'javascript:alert(1)' } }
  }), 'New Name');
  const r = T.parseExport(JSON.stringify(file));
  assert.deepEqual(r.sheet.items, [{ name: 'Rope' }]);
  assert.equal(r.sheet.portrait, undefined);
  assert.equal(r.sheet.build.details.portrait, undefined);
  assert.equal(r.sheet.build.name, 'New Name');
  assert.equal(r.warnings.length, 1);
});
