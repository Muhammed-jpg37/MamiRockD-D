// Run with: npm test   (node --test tests/)
// Sheet maths (sheet-maths.js): weapon attack bonus and damage (feature plan 3.1).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mod = require('../sheet-maths.js');
const M = (mod && mod.SheetMaths) || globalThis.SheetMaths;

const load = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'catalog', name), 'utf8')).entries;
const CATALOGS = { 2014: load('srd51-items.json'), 2024: load('srd52-items.json') };

// A fighter-ish sheet: STR 16 (+3), DEX 14 (+2), PB +2, simple and martial weapons.
const CS = { str: 16, dex: 14, weaponProf: 'Simple Weapons, Martial Weapons' };
const OPTS = { scores: { str: 16, dex: 14 }, prof: 2, cs: CS, catalogs: CATALOGS };

test('sheet maths: names find their catalog weapon', () => {
  const name = (n) => { const e = M.findWeapon({ name: n }, CATALOGS); return e && e.id; };
  assert.equal(name('Longsword'), 'longsword');
  assert.equal(name('longswords'), 'longsword');
  assert.equal(name('Longsword +1'), 'longsword');
  assert.equal(name('+2 Dagger'), 'dagger');
  assert.equal(name('Hand Crossbow'), 'crossbow_hand');
  assert.equal(name('Elven Longsword'), 'longsword');
  assert.equal(name('Greataxe'), 'greataxe');
  assert.equal(name('Frying pan'), null);
  assert.equal(name('Staff of the Magi'), 'quarterstaff');
  assert.equal(name('Vorpal Longsword'), 'longsword');
  // fromCatalog wins over the name, and picks the ruleset.
  const e = M.findWeapon({ name: 'Old Faithful', fromCatalog: 'srd52:battleaxe' }, CATALOGS);
  assert.equal(e.id, 'battleaxe');
  assert.equal(e.ruleset, '2024');
  assert.equal(M.nameKey('Crossbow, hand'), M.nameKey('Hand Crossbows'));
});

test('sheet maths: melee uses STR, ranged DEX, finesse the higher', () => {
  const sword = M.weaponAttack({ name: 'Longsword', type: 'Weapon', equipped: 'main' }, OPTS);
  assert.equal(sword.ability, 'str');
  assert.equal(sword.toHit, 5);
  assert.equal(sword.toHitText, '+5');
  assert.equal(sword.damage, '1d8+3');
  assert.equal(sword.versatile, '1d10+3');
  assert.equal(sword.damageType, 'slashing');
  assert.equal(sword.source, 'catalog');

  const bow = M.weaponAttack({ name: 'Longbow', type: 'Weapon', equipped: 'main' }, OPTS);
  assert.equal(bow.ability, 'dex');
  assert.equal(bow.toHit, 4);
  assert.equal(bow.damage, '1d8+2');
  assert.equal(bow.range, '150/600');

  const rapier = M.weaponAttack({ name: 'Rapier', type: 'Weapon', equipped: 'main' }, Object.assign({}, OPTS, { scores: { str: 10, dex: 18 } }));
  assert.equal(rapier.ability, 'dex');
  assert.equal(rapier.toHit, 6);
  assert.equal(rapier.damage, '1d8+4');
  const strongRapier = M.weaponAttack({ name: 'Rapier', type: 'Weapon', equipped: 'main' }, OPTS);
  assert.equal(strongRapier.ability, 'str', 'finesse takes STR when it is higher');

  // A thrown melee weapon still uses STR.
  assert.equal(M.weaponAttack({ name: 'Javelin', type: 'Weapon', equipped: 'main' }, OPTS).ability, 'str');
});

test('sheet maths: proficiency comes from the switches, the Weapons line or the item name', () => {
  const mace = { name: 'Mace', type: 'Weapon', equipped: 'main' };
  const sword = { name: 'Longsword', type: 'Weapon', equipped: 'main' };
  const wizard = { weaponProf: 'Daggers, Darts, Slings, Quarterstaffs, Light Crossbows' };
  assert.equal(M.weaponProficient({ name: 'Dagger' }, M.findWeapon({ name: 'Dagger' }, CATALOGS), wizard), true);
  assert.equal(M.weaponProficient({ name: 'Light crossbow' }, M.findWeapon({ name: 'Light crossbow' }, CATALOGS), wizard), true);
  assert.equal(M.weaponProficient(mace, M.findWeapon(mace, CATALOGS), wizard), false);
  const a = M.weaponAttack(sword, Object.assign({}, OPTS, { cs: wizard }));
  assert.equal(a.proficient, false);
  assert.equal(a.toHit, 3, 'no proficiency bonus');
  assert.ok(a.notes.includes('not proficient'));
  assert.equal(M.weaponProficient(sword, null, { profMartial: true }), false, 'without a category, the switch cannot tell');
  assert.equal(M.weaponProficient({ name: 'Odd thing' }, null, { weaponProf: 'Simple Weapons, Martial Weapons' }), true, 'simple + martial is every weapon');
  assert.equal(M.weaponProficient(Object.assign({ proficiencyType: 'Martial' }, sword), null, { profMartial: true }), true);
  assert.equal(M.weaponProficient(mace, M.findWeapon(mace, CATALOGS), { weapons: 'simple weapons' }), true);
});

test('sheet maths: magic bonus, off hand and items without a catalog match', () => {
  const plus1 = M.weaponAttack({ name: 'Longsword +1', type: 'Weapon', equipped: 'main' }, OPTS);
  assert.equal(plus1.magic, 1);
  assert.equal(plus1.toHit, 6);
  assert.equal(plus1.damage, '1d8+4');

  const off = M.weaponAttack({ name: 'Shortsword', type: 'Weapon', equipped: 'off' }, OPTS);
  assert.equal(off.offHand, true);
  assert.equal(off.toHit, 5);
  assert.equal(off.damage, '1d6', 'no positive ability modifier off hand');
  const weakOff = M.weaponAttack({ name: 'Dagger', type: 'Weapon', equipped: 'off' }, Object.assign({}, OPTS, { scores: { str: 8, dex: 8 } }));
  assert.equal(weakOff.damage, '1d4-1', 'a negative modifier still counts');

  // Builder starter items carry their own damage text.
  const own = M.weaponAttack({ name: 'Moon blade', category: 'weapon', equipped: 'main', damage: '1d8/1d10 Slashing', proficiencyType: 'Martial' }, Object.assign({}, OPTS, { cs: { profMartial: true } }));
  assert.equal(own.source, 'item');
  assert.equal(own.damage, '1d8+3');
  assert.equal(own.versatile, '1d10+3');
  assert.equal(own.damageType, 'slashing');
  assert.equal(own.proficient, true);

  const none = M.weaponAttack({ name: 'Mystery stick', type: 'Weapon', equipped: 'main' }, OPTS);
  assert.equal(none.damage, null);
  assert.equal(none.source, null);

  assert.deepEqual(M.parseDamage('2d6 slashing'), { dice: '2d6', versatile: null, type: 'slashing' });
  assert.deepEqual(M.parseDamage('1 piercing'), { dice: '1', versatile: null, type: 'piercing' });
  assert.equal(M.parseDamage(''), null);
});

test('sheet maths: only equipped weapons, main hand first; scores include item bonuses', () => {
  const items = [
    { id: 'a', name: 'Dagger', type: 'Weapon', equipped: 'off' },
    { id: 'b', name: 'Rope', type: 'Gear', equipped: 'belt' },
    { id: 'c', name: 'Greatsword', type: 'Weapon', equipped: false },
    { id: 'd', name: 'Longsword', type: 'Weapon', equipped: 'main' },
  ];
  assert.deepEqual(M.weaponAttacks(items, OPTS).map((a) => a.id), ['d', 'a']);
  assert.deepEqual(M.effectiveScores({ str: 15 }, { str: 2, dex: -1 }), { str: 17, dex: 9, con: 10, int: 10, wis: 10, cha: 10 });
  assert.equal(M.mod(17), 3);
  assert.equal(M.mod(9), -1);
});

test('sheet maths: a critical hit doubles the damage dice, not the modifier', () => {
  assert.equal(M.critDamage('1d8+3'), '2d8+3');
  assert.equal(M.critDamage('2d6+1d4-1'), '4d6+2d4-1');
  assert.equal(M.critDamage('d6'), '2d6');
  assert.equal(M.critDamage('1+3'), '1+3');
});

/* ---------- 3.2 Spellcasting ---------- */

const SRD_RULES = require('../rules/srd5.js');
const SRD_SPELLS = require('../rules/srd5-spells.js');
const srdSpell = (name) => SRD_SPELLS.find((s) => s.name === name);

test('sheet maths: spellcasting classes from the build, or from the class text', () => {
  const build = { classes: [{ id: 'fighter', level: 3 }, { id: 'wizard', level: 2 }, { id: 'paladin', level: 1 }] };
  assert.deepEqual(M.castingClasses({}, build, SRD_RULES), [{ id: 'wizard', name: 'Wizard', level: 2, ability: 'int' }],
    'fighters do not cast; a level 1 paladin does not cast yet');
  assert.deepEqual(M.castingClasses({ characterClass: 'Cleric', level: 7 }), [{ id: 'cleric', name: 'Cleric', level: 7, ability: 'wis' }]);
  assert.deepEqual(M.castingClasses({ characterClass: 'Bard 3 / Warlock 2', level: 5 }).map((c) => c.id + c.level + c.ability), ['bard3cha', 'warlock2cha']);
  assert.deepEqual(M.castingClasses({ characterClass: 'Ranger', level: 1 }), [], 'rangers cast from level 2');
  assert.deepEqual(M.castingClasses({ characterClass: 'Dungeon Master', level: 20 }), []);
});

test('sheet maths: save DC is 8 + PB + mod, spell attack PB + mod', () => {
  const [w] = M.spellStats([{ id: 'wizard', name: 'Wizard', level: 5, ability: 'int' }], { int: 18 }, 3);
  assert.equal(w.saveDc, 15);
  assert.equal(w.attack, 7);
  assert.equal(w.attackText, '+7');
  const [b] = M.spellStats([{ id: 'bard', name: 'Bard', level: 1, ability: 'cha' }], { cha: 8 }, 2, { dc: 1, attack: 1 });
  assert.equal(b.saveDc, 10);
  assert.equal(b.attackText, '+2');
});

test('sheet maths: cantrips scale at levels 5, 11 and 17', () => {
  assert.deepEqual([1, 4, 5, 10, 11, 16, 17, 20].map(M.cantripTier), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(M.scaleDice('1d10', 3), '3d10');
  assert.equal(M.scaleDice('d8', 2), '2d8');
  const stats = M.spellStats([{ id: 'wizard', name: 'Wizard', level: 11, ability: 'int' }], { int: 16 }, 4);
  const bolt = M.cantripLine({ name: 'Fire Bolt', levelNum: 0 }, srdSpell('Fire Bolt'), stats, 11);
  assert.equal(bolt.kind, 'attack');
  assert.equal(bolt.attackText, '+7');
  assert.equal(bolt.damage, '3d10');
  assert.equal(bolt.damageType, 'fire');
  assert.equal(bolt.className, 'Wizard');

  const cleric = M.spellStats([{ id: 'cleric', name: 'Cleric', level: 5, ability: 'wis' }], { wis: 16 }, 3);
  const flame = M.cantripLine({ name: 'Sacred Flame', levelNum: 0 }, srdSpell('Sacred Flame'), cleric, 5);
  assert.equal(flame.kind, 'save');
  assert.equal(flame.save, 'dex');
  assert.equal(flame.saveDc, 14);
  assert.equal(flame.damage, '2d8');
  assert.equal(flame.attack, null);
});

test('sheet maths: Eldritch Blast adds beams; non-damage and levelled spells give no line', () => {
  const lock = M.spellStats([{ id: 'warlock', name: 'Warlock', level: 17, ability: 'cha' }], { cha: 20 }, 6);
  const eb = M.cantripLine({ name: 'Eldritch Blast', levelNum: 0 }, srdSpell('Eldritch Blast'), lock, 17);
  assert.equal(eb.beams, 4);
  assert.equal(eb.damage, '1d10');
  assert.equal(M.cantripLine({ name: 'Guidance', levelNum: 0 }, srdSpell('Guidance'), lock, 17), null);
  assert.equal(M.cantripLine({ name: 'Fireball', levelNum: 3 }, srdSpell('Fireball'), lock, 17), null);
  // A spell without SRD data uses the sheet's own damage text.
  const homebrew = M.cantripLine({ name: 'Frost Pop', levelNum: 0, damage: '1d6 Cold', desc: 'Make a ranged spell attack.' }, null, lock, 5);
  assert.equal(homebrew.damage, '2d6');
  assert.equal(homebrew.damageType, 'cold');
  assert.equal(homebrew.kind, 'attack');
});
