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

// Fillable PDF sheets: field values as pdf-lib reads them (text, or true/false for checkboxes),
// with the official WotC 2014 sheet's field names (some end in a space, like "Race ").
const OFFICIAL = {
  CharacterName: 'Thora Ironbrow', ClassLevel: 'Cleric 3 / Fighter 1', 'Race ': 'Hill Dwarf', Background: 'Acolyte', Alignment: 'Lawful Good',
  STR: '14', DEX: '10', CON: '16', INT: '8', WIS: '16', CHA: '12', ProfBonus: '+2', AC: '18', Initiative: '+0', Speed: '25 ft',
  HPMax: '38', HPCurrent: '30', 'ST Wisdom': '+5', 'Check Box 21': true, 'Check Box 22': true, 'Check Box 29': true, 'Religion ': '+3',
  'Check Box 12': true, GP: '15', SP: '7', Equipment: 'Mace\nChain mail\n2 Daggers\nHoly symbol, Rations x5',
  ProficienciesLang: 'Armor: Light, Medium, Heavy, Shields\nWeapons: Simple, Martial\nLanguages: Common, Dwarvish',
  'Features and Traits': 'Darkvision. Channel Divinity.', 'Spells 1014': 'Sacred Flame', 'Spells 1015': 'Cure Wounds', 'Spells 1016': 'Not A Real Spell'
};
const SPELLS = {};
require('../rules/srd5-spells.js').forEach ? require('../rules/srd5-spells.js').forEach((s) => { SPELLS[s.name.toLowerCase()] = s; }) : null;

test('PDF sheets: stats, proficiencies, expertise and death saves from the official sheet', () => {
  const r = T.fromPdfFields(OFFICIAL, { spellIndex: SPELLS });
  const cs = r.patch.characterStats;
  assert.equal(r.name, 'Thora Ironbrow');
  assert.deepEqual([cs.characterClass, cs.level, cs.species], ['Cleric', 4, 'Hill Dwarf']);
  assert.deepEqual([cs.str, cs.dex, cs.con, cs.int, cs.wis, cs.cha], [14, 10, 16, 8, 16, 12]);
  assert.deepEqual([cs.profBonus, cs.ac, cs.unarmoredBaseAc, cs.initBonus, cs.speed], [2, 18, 18, 0, 25]);
  assert.deepEqual(cs.saveProfs, { wis: 1, cha: 1 });
  assert.deepEqual(cs.skillProfs, { Insight: 1, Religion: 2 }, 'Religion +3 with INT 8 and PB 2 is expertise');
  assert.equal(cs.languages, 'Common, Dwarvish');
  assert.equal(cs.armorProf, 'Light, Medium, Heavy, Shields');
  assert.deepEqual(r.patch.hp, { max: 38, current: 30, temp: 0 });
  assert.deepEqual(r.patch.deathSaves.successes, [true, false, false]);
  assert.equal(r.patch.currency.gold, 15);
  assert.ok(r.warnings.some((w) => /Multiclass/.test(w)));
});

test('PDF sheets: equipment lines, spells and long text are kept', () => {
  const r = T.fromPdfFields(OFFICIAL, { spellIndex: SPELLS });
  assert.deepEqual(r.patch.items.map((i) => i.qty + ' ' + i.name), ['1 Mace', '1 Chain mail', '2 Daggers', '1 Holy symbol', '5 Rations']);
  if (Object.keys(SPELLS).length) {
    assert.deepEqual(r.patch.spells.map((s) => [s.name, s.levelNum]), [['Sacred Flame', 0], ['Cure Wounds', 1], ['Not A Real Spell', null]]);
    assert.ok(r.warnings.some((w) => /Not A Real Spell/.test(w)));
  }
  assert.deepEqual(r.patch.featureCards.map((c) => c.name), ['Features & Traits', 'Proficiencies & languages']);
  assert.equal(r.patch.backgroundInfo.name, 'Acolyte');
});

test('PDF sheets: a full sheet on the site\'s empty sheet, and DEX not counted twice in AC', () => {
  const base = { campaign: 'x', items: [{ name: 'Staff of the Magi' }], characterStats: { armorProf: 'All Armor', str: 1 }, spellbook: { catalog: [1], open: true } };
  const read = T.fromPdfFields(Object.assign({}, OFFICIAL, { DEX: '16' }), { spellIndex: SPELLS });
  const { name, sheet } = T.sheetFromPdf(base, read);
  assert.equal(name, 'Thora Ironbrow');
  assert.equal(sheet.campaign, "Thora Ironbrow's Vault");
  assert.ok(!sheet.items.some((i) => i.name === 'Staff of the Magi'), 'the empty sheet\'s items are replaced');
  assert.equal(sheet.characterStats.armorProf, 'Light, Medium, Heavy, Shields');
  assert.equal(sheet.spellbook.catalog, undefined);
  assert.equal(sheet.spellbook.open, true);
  assert.equal(sheet.characterStats.unarmoredBaseAc, 15, 'AC 18 with DEX +3: base 15, the sheet adds DEX back');
});

test('PDF sheets: other field names, empty PDFs and odd class lines', () => {
  const r = T.fromPdfFields({ 'Character Name': 'Ana', 'Class & Level': 'Level 2 Wizard', Species: 'Elf', Strength: '9', Dexterity: '14', Constitution: '12', Intelligence: '16', Wisdom: '11', Charisma: '10', 'HP Max': '12' });
  assert.deepEqual([r.name, r.patch.characterStats.characterClass, r.patch.characterStats.level, r.patch.characterStats.int], ['Ana', 'Wizard', 2, 16]);
  assert.throws(() => T.fromPdfFields({ CharacterName: 'X', 'Check Box 11': false }), /no filled-in character sheet fields/);
  assert.deepEqual(T.parseClassLevel('Fighter 3 / Rogue 2'), { cls: 'Fighter', level: 5, multi: true, classes: ['Fighter', 'Rogue'] });
  const missing = T.fromPdfFields({ CharacterName: 'B', ClassLevel: 'Bard 1', STR: '10', DEX: '10', CON: '10', INT: '10', WIS: '' });
  assert.ok(missing.warnings.some((w) => /WIS, CHA/.test(w)));
});

test('PDF sheets: what the PDF gives is enough for the character builder conversion', () => {
  const E = require('../character-engine.js');
  const rules = JSON.parse(JSON.stringify(require('../rules/srd5.js')));
  const r = T.fromPdfFields({ CharacterName: 'Mira', ClassLevel: 'Rogue 5', 'Race ': 'Lightfoot Halfling', STR: '8', DEX: '18', CON: '12', INT: '13', WIS: '12', CHA: '14', ProfBonus: '+3', 'Check Box 39': true, 'Check Box 23': true, 'Check Box 34': true, 'Check Box 29': true, HPMax: '33' });
  const out = E.buildFromSheet(r.patch.characterStats, rules, { name: r.name });
  assert.ok(out.ok, out.reason);
  assert.equal(out.build.classes[0].id, 'rogue');
  assert.equal(out.build.species, 'halfling');
});
