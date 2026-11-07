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

// D&D Beyond character JSON. tests/fixtures/ddb-character.json is a made-up file in the shape
// community tools describe; it is not a real export (none was available on 2026-11-07).
const DDB_TEXT = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'ddb-character.json'), 'utf8');

test('D&D Beyond: the file is recognised, and scores add species and ASI bonuses', () => {
  assert.equal(T.detectJson(DDB_TEXT), 'ddb');
  assert.equal(T.detectJson(JSON.stringify(T.makeExport(SHEET, 'X'))), 'site');
  assert.equal(T.detectJson('{"a":1}'), 'unknown');
  assert.equal(T.detectJson('nope'), 'invalid');
  const r = T.fromDdbJson(JSON.parse(DDB_TEXT), { spellIndex: SPELLS });
  const cs = r.patch.characterStats;
  assert.equal(r.name, 'Brakka Stonehelm');
  assert.deepEqual([cs.characterClass, cs.subclass, cs.level, cs.profBonus], ['Fighter', 'Champion', 5, 3]);
  assert.deepEqual([cs.species, cs.subrace, cs.speed], ['Dwarf', 'Hill', 25]);
  assert.deepEqual([cs.str, cs.dex, cs.con, cs.int, cs.wis, cs.cha], [17, 10, 16, 8, 14, 12]);
  assert.deepEqual(cs.saveProfs, { str: 1, con: 1 });
  assert.deepEqual(cs.skillProfs, { Athletics: 2, Intimidation: 1 });
  assert.deepEqual([cs.armorProf, cs.weaponProf, cs.toolProf, cs.languages], ['Heavy Armor, Shields', 'Martial Weapons', "Smith's Tools", 'Common, Dwarvish']);
  assert.ok(r.warnings.some((w) => /Multiclass "Fighter 4 \/ Cleric 1"/.test(w)));
  assert.ok(r.warnings.some((w) => /portrait/.test(w)));
});

test('D&D Beyond: HP, coins, gear with AC, spells, features and background', () => {
  const r = T.fromDdbJson(JSON.parse(DDB_TEXT), { spellIndex: SPELLS });
  assert.deepEqual(r.patch.hp, { max: 51, current: 44, temp: 3 }, '36 + CON +3 × 5 levels, 7 damage taken');
  assert.deepEqual(r.patch.currency, { platinum: 1, gold: 55, electrum: 0, silver: 30, copper: 12 });
  const by = (n) => r.patch.items.find((i) => i.name === n);
  assert.deepEqual([by('Chain Mail').type, by('Chain Mail').armorCategory, by('Chain Mail').statBonuses.ac, by('Chain Mail').equipped], ['Armor', 'Heavy', 16, true]);
  assert.deepEqual([by('Shield').type, by('Shield').statBonuses.ac, by('Shield').equipped], ['Shield', 2, true]);
  assert.deepEqual([by('Warhammer').proficiencyType, by('Warhammer').equipped], ['Martial', true]);
  assert.equal(by('Handaxe').equipped, false, 'one item per slot is equipped');
  assert.equal(by('Potion of Healing').qty, 2);
  assert.equal(by('Cloak of Protection').attunementRequired, true);
  assert.equal(by('Chain Mail').desc, 'Made of interlocking metal rings.');
  if (Object.keys(SPELLS).length) assert.deepEqual(r.patch.spells.map((s) => s.name + ':' + s.levelNum), ['Bless:1', 'Cure Wounds:1', 'Toll the Dead:0', 'Sacred Flame:0']);
  assert.deepEqual(r.patch.featureCards.map((c) => c.name), ['Second Wind', 'Action Surge', 'Spellcasting', 'Darkvision', 'Dwarven Resilience', 'Athlete'], 'Extra Attack (level 5) is above Fighter 4');
  assert.deepEqual([r.patch.backgroundInfo.name, r.patch.backgroundInfo.alignment, r.patch.backgroundInfo.personality], ['Soldier', 'Lawful Good', 'I face problems head-on.']);
  assert.deepEqual(r.patch.deathSaves.successes, [true, true, false]);
  assert.equal(r.patch.xp, 2700);
});

test('D&D Beyond: a sheet the site and the builder can use; files that are not characters are refused', () => {
  const read = T.fromDdbJson(JSON.parse(DDB_TEXT));
  const { sheet } = T.sheetFromPdf({ items: [{ name: 'Staff of the Magi' }], characterStats: {} }, read);
  assert.equal(sheet.campaign, "Brakka Stonehelm's Vault");
  assert.equal(sheet.items.length, 7);
  const single = JSON.parse(DDB_TEXT);
  single.data.classes = [single.data.classes[1]];
  const E = require('../character-engine.js');
  const out = E.buildFromSheet(T.fromDdbJson(single).patch.characterStats, JSON.parse(JSON.stringify(require('../rules/srd5.js'))), { name: 'Brakka' });
  assert.ok(out.ok, out.reason);
  assert.deepEqual([out.build.classes[0].id, out.build.species, out.build.subrace], ['fighter', 'dwarf', 'hill']);
  assert.throws(() => T.fromDdbJson({ data: { name: 'x' } }), /not a D&D Beyond character file/);
  assert.equal(T.stripHtml('<p>A &amp; B</p><p>C</p>'), 'A & B\nC');
});

test('D&D Beyond: description headings are not imported as features', () => {
  const d = JSON.parse(DDB_TEXT);
  const data = d.data || d;
  const heading = (name) => ({ definition: { name: name } });
  data.race.racialTraits = data.race.racialTraits.concat(['Ability Score Increase', 'Age', 'Size', 'Speed', 'Languages', 'Alignment'].map(heading));
  data.classes[0].classFeatures = [heading('Hit Points'), heading('Proficiencies'), heading('Equipment')].concat(data.classes[0].classFeatures);
  const r = T.fromDdbJson(d, { spellIndex: SPELLS });
  const names = r.patch.featureCards.map((c) => c.name);
  assert.deepEqual(names, ['Second Wind', 'Action Surge', 'Spellcasting', 'Darkvision', 'Dwarven Resilience', 'Athlete']);
  // A real feature that only sounds like a heading stays: "Ability Score Improvement" is a class feature.
  const fighter = data.classes.find((c) => c.classFeatures.some((f) => f.definition.name === 'Second Wind'));
  fighter.classFeatures.push({ definition: { name: 'Ability Score Improvement', requiredLevel: 4 } });
  assert.ok(T.fromDdbJson(d, { spellIndex: SPELLS }).patch.featureCards.some((c) => c.name === 'Ability Score Improvement'));
});

/* ---------- 7.2 A sheet into a fillable PDF ---------- */

test('PDF out: a sheet becomes the official form fields, and reads back the same', () => {
  const sheet = JSON.parse(JSON.stringify(SHEET));
  sheet.characterStats = Object.assign({}, sheet.characterStats, { str: 16, dex: 14, con: 12, int: 10, wis: 13, cha: 8, profBonus: 2, level: 3, characterClass: 'Fighter', species: 'Dwarf',
    saveProfs: { str: 1, con: 1 }, skillProfs: { Athletics: 1, Perception: 2 }, skillCustomBonuses: {}, saveCustomBonuses: {}, speed: 25 });
  sheet.hp = { max: 28, current: 20, temp: 0 };
  sheet.currency = { platinum: 0, gold: 15, electrum: 0, silver: 3, copper: 0 };
  sheet.deathSaves = { successes: [true, false, false], failures: [false, false, false] };
  const entries = T.toPdfFields(sheet, { name: 'Brakka', ac: 18, attacks: [{ name: 'Warhammer', toHitText: '+5', damage: '1d8+3', damageType: 'bludgeoning' }],
    spellcasting: [], spellsByLevel: {} });
  const val = (n) => { const e = entries.find((x) => x.names.includes(n)); return e && (e.value !== undefined ? e.value : e.checked); };
  assert.equal(val('CharacterName'), 'Brakka');
  assert.equal(val('ClassLevel'), 'Fighter 3');
  assert.equal(val('STRmod'), '+3');
  assert.equal(val('CHamod'), '-1', 'the official sheet spells it CHamod');
  assert.equal(val('ST Strength'), '+5');
  assert.equal(val('Check Box 11'), true, 'STR save box');
  assert.equal(val('Athletics'), '+5');
  assert.equal(val('Perception'), '+5', 'expertise: +1 WIS + 2 × 2');
  assert.equal(val('Passive'), '15');
  assert.equal(val('Wpn Name'), 'Warhammer');
  assert.equal(val('Wpn1 Damage'), '1d8+3 bludgeoning');
  assert.equal(val('AC'), '18');
  assert.equal(val('Check Box 12'), true, 'one death save success');
  // Reading it back with the importer gives the same character.
  const fields = {};
  entries.forEach((e) => { fields[e.names[0]] = e.value !== undefined ? e.value : e.checked; });
  const back = T.fromPdfFields(fields, {}).patch;
  assert.deepEqual([back.characterStats.str, back.characterStats.cha, back.characterStats.level], [16, 8, 3]);
  assert.deepEqual(back.characterStats.saveProfs, { str: 1, con: 1 });
  assert.deepEqual(back.characterStats.skillProfs, { Athletics: 1, Perception: 2 });
  assert.deepEqual([back.hp.max, back.hp.current, back.currency.gold], [28, 20, 15]);
});
