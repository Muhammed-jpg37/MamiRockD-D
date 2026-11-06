// Run with: npm test   (node --test tests/)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../character-engine.js');
const SRD = require('../rules/srd5.js');

const ARRAY = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

// A complete, legal level-1 character to vary in each test.
function build(over) {
  const b = E.newBuild(SRD);
  Object.assign(b, {
    name: 'Test',
    species: 'human',
    background: 'acolyte',
    classes: [{ id: 'fighter', level: 1, subclass: null, hp: [] }],
    abilities: { method: 'standardArray', base: Object.assign({}, ARRAY) },
    speciesChoices: {},
    choices: { skills: { fighter: ['athletics', 'perception'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: { 'fighter:1': 'defense' } }
  }, over || {});
  return b;
}
const errors = (b, opts) => E.validate(b, SRD, opts).issues.filter((i) => i.level === 'error').map((i) => i.code);

test('proficiency bonus by level', () => {
  assert.deepEqual([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(E.proficiencyBonus), [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
});

test('a complete level 1 human fighter is valid', () => {
  const v = E.validate(build(), SRD);
  assert.equal(v.ok, true, JSON.stringify(v.issues));
  assert.equal(v.complete, true);
});

test('missing choices are reported as pending', () => {
  const b = E.newBuild(SRD);
  const codes = E.pendingChoices(b, SRD).map((i) => i.code);
  assert.ok(codes.includes('species-missing'));
  assert.ok(codes.includes('background-missing'));
  assert.ok(codes.includes('class-missing'));
});

test('human gets +1 to every ability', () => {
  const d = E.derive(build(), SRD);
  assert.deepEqual(d.abilities.scores, { str: 16, dex: 15, con: 14, int: 13, wis: 11, cha: 9 });
});

test('hill dwarf: +2 CON, +1 WIS, +1 HP per level, speed 25, darkvision', () => {
  const b = build({ species: 'dwarf', subrace: 'hill', speciesChoices: { tool: "Smith's tools" }, classes: [{ id: 'fighter', level: 5, subclass: 'champion', hp: [] }],
    choices: { skills: { fighter: ['athletics', 'perception'] }, subclassSkills: {}, expertise: [], asi: { 'fighter:4': { type: 'asi', abilities: { str: 2 } } }, fightingStyles: { 'fighter:1': 'defense' } } });
  const d = E.derive(b, SRD);
  assert.equal(d.abilities.scores.con, 15);
  assert.equal(d.abilities.scores.wis, 11);
  assert.equal(d.abilities.scores.str, 17);
  // CON 15 => +2. Level 1: 10 + 2; levels 2-5: (6 + 2) x 4; dwarven toughness +5
  assert.equal(d.hp.max, 12 + 32 + 5);
  assert.equal(d.characterStats.speed, 25);
  assert.equal(d.characterStats.senseNotes, 'Darkvision 60 ft');
  assert.equal(E.validate(b, SRD).ok, true, JSON.stringify(E.validate(b, SRD).issues));
});

test('half-elf: +2 CHA and +1 to two chosen abilities (not CHA), two extra skills', () => {
  const b = build({ species: 'halfElf', speciesChoices: { abilities: ['str', 'con'], skills: ['stealth', 'deception'] } });
  const d = E.derive(b, SRD);
  assert.equal(d.abilities.scores.cha, 10);
  assert.equal(d.abilities.scores.str, 16);
  assert.equal(d.abilities.scores.con, 14);
  assert.equal(d.characterStats.skillProfs.stealth, true);
  assert.equal(E.validate(b, SRD).ok, true);
  assert.ok(errors(build({ species: 'halfElf', speciesChoices: { abilities: ['cha', 'con'], skills: ['stealth', 'deception'] } })).includes('species-abilities'));
});

test('point buy: 27 points is fine, 28 is not, 16 is out of range', () => {
  const ok = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };          // 9+9+9 = 27
  assert.equal(E.pointBuyCost(ok, SRD), 27);
  assert.equal(E.validate(build({ abilities: { method: 'pointBuy', base: ok } }), SRD).ok, true);
  const over = { str: 15, dex: 15, con: 15, int: 9, wis: 8, cha: 8 };       // 28
  assert.ok(errors(build({ abilities: { method: 'pointBuy', base: over } })).includes('abilities-pointbuy'));
  assert.equal(E.pointBuyCost({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, SRD), null);
  const under = E.validate(build({ abilities: { method: 'pointBuy', base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } } }), SRD);
  assert.equal(under.ok, true);
  assert.ok(under.issues.some((i) => i.code === 'abilities-pointbuy-left' && i.level === 'warning'));
});

test('standard array must be used as given', () => {
  assert.ok(errors(build({ abilities: { method: 'standardArray', base: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 } } })).includes('abilities-array'));
});

test('manual ability scores only when the campaign allows it', () => {
  const b = build({ abilities: { method: 'manual', base: { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 } } });
  assert.ok(errors(b).includes('abilities-manual'));
  assert.equal(E.validate(b, SRD, { allowManual: true }).ok, true);
});

test('an unassigned ability score (null) is missing, not 0', () => {
  const b = build({ abilities: { method: 'roll', base: { str: 14, dex: 12, con: null, int: 10, wis: 10, cha: 8 } } });
  assert.ok(E.pendingChoices(b, SRD).some((i) => i.code === 'abilities-missing'));
});

test('a half-made ASI choice (feat with no feat picked) is still pending', () => {
  const b = build({ classes: [{ id: 'fighter', level: 4, subclass: 'champion' }],
    choices: { skills: { fighter: ['athletics', 'perception'] }, subclassSkills: {}, expertise: [], asi: { 'fighter:4': { type: 'feat', feat: null } }, fightingStyles: { 'fighter:1': 'defense' } } });
  const codes = E.validate(b, SRD).issues.map((i) => i.code);
  assert.ok(codes.includes('asi-missing'));
  assert.ok(!codes.includes('feat-unknown'));
});

test('rolling: 4d6 drop lowest stays in 3..18', () => {
  let i = 0;
  const seq = [0.99, 0.0, 0.5, 0.5];     // 6, 1, 4, 4 -> drop 1 -> 14
  const rolls = E.rollAbilityScores(() => seq[(i++) % 4]);
  assert.deepEqual(rolls, [14, 14, 14, 14, 14, 14]);
  for (const v of E.rollAbilityScores()) assert.ok(v >= 3 && v <= 18);
});

test('hit points: max at level 1, then average or the roll, never below 1 per level', () => {
  // Wizard, CON 14 after human +1 (base 13): +2
  const wiz = (level, hp) => build({ classes: [{ id: 'wizard', level: level, subclass: level >= 2 ? 'evocation' : null, hp: hp || [] }], choices: { skills: { wizard: ['arcana', 'history'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  assert.equal(E.derive(wiz(1), SRD).hp.max, 8);                       // 6 + 2
  assert.equal(E.derive(wiz(3), SRD).hp.max, 8 + 2 * (4 + 2));         // average 4
  assert.equal(E.derive(wiz(3, [null, 1, 6]), SRD).hp.max, 8 + 3 + 8); // rolled 1 and 6
  // CON 3 (manual): each level still gives at least 1
  const weak = build({ abilities: { method: 'manual', base: { str: 10, dex: 10, con: 2, int: 10, wis: 10, cha: 10 } }, classes: [{ id: 'wizard', level: 3, subclass: 'evocation', hp: [null, 1, 1] }], choices: { skills: { wizard: ['arcana', 'history'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  assert.equal(E.derive(weak, SRD).hp.max, 2 + 1 + 1);  // human CON 3 => -4: 6-4=2, then max(1, 1-4) twice
});

test('draconic sorcerer: +1 HP per sorcerer level and AC 13 + DEX unarmoured', () => {
  const b = build({ classes: [{ id: 'sorcerer', level: 3, subclass: 'draconic', hp: [] }], choices: { skills: { sorcerer: ['arcana', 'insight'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  const d = E.derive(b, SRD);
  assert.equal(d.hp.max, (6 + 2) + 2 * (4 + 2) + 3);
  assert.equal(d.acUnarmored, 13 + 2);   // DEX 15 => +2
});

test('unarmoured defense: barbarian adds CON, monk adds WIS', () => {
  const barb = build({ classes: [{ id: 'barbarian', level: 1, subclass: null, hp: [] }], choices: { skills: { barbarian: ['athletics', 'survival'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  assert.equal(E.derive(barb, SRD).acUnarmored, 10 + 2 + 2);
  const monk = build({ abilities: { method: 'standardArray', base: { str: 8, dex: 15, con: 13, int: 10, wis: 14, cha: 12 } }, classes: [{ id: 'monk', level: 1, subclass: null, hp: [] }], choices: { skills: { monk: ['acrobatics', 'stealth'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  assert.equal(E.derive(monk, SRD).acUnarmored, 10 + 3 + 2);
});

test('spell slots: full, half and pact casters, single class and multiclass', () => {
  const slots = (classes) => E.derive(build({ classes: classes }), SRD).spellcasting;
  assert.deepEqual(slots([{ id: 'wizard', level: 5 }]).slots, { 1: 4, 2: 3, 3: 2 });
  assert.deepEqual(slots([{ id: 'paladin', level: 1 }]).slots, {});
  assert.deepEqual(slots([{ id: 'paladin', level: 2 }]).slots, { 1: 2 });
  assert.deepEqual(slots([{ id: 'paladin', level: 5 }]).slots, { 1: 4, 2: 2 });
  assert.deepEqual(slots([{ id: 'paladin', level: 20 }]).slots, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 });
  assert.deepEqual(slots([{ id: 'ranger', level: 3 }]).slots, { 1: 3 });
  assert.deepEqual(slots([{ id: 'fighter', level: 5 }, { id: 'paladin', level: 3 }]).slots, { 1: 3 });           // only one caster: own table
  assert.deepEqual(slots([{ id: 'wizard', level: 3 }, { id: 'cleric', level: 2 }]).slots, { 1: 4, 2: 3, 3: 2 }); // caster level 5
  assert.deepEqual(slots([{ id: 'paladin', level: 2 }, { id: 'sorcerer', level: 3 }]).slots, { 1: 4, 2: 3 });    // 1 + 3 = 4
  const wl = slots([{ id: 'warlock', level: 5 }]);
  assert.deepEqual(wl.slots, {});
  assert.deepEqual(wl.pact, { slots: 2, level: 3 });
  const mix = slots([{ id: 'warlock', level: 2 }, { id: 'wizard', level: 3 }]);
  assert.deepEqual(mix.slots, { 1: 4, 2: 2 });
  assert.deepEqual(mix.pact, { slots: 2, level: 1 });
});

test('spell save DC and attack use the class ability', () => {
  const b = build({ abilities: { method: 'standardArray', base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } }, classes: [{ id: 'wizard', level: 1 }], choices: { skills: { wizard: ['arcana', 'history'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  const w = E.derive(b, SRD).spellcasting.abilities[0];
  assert.equal(w.saveDc, 8 + 2 + 3);   // INT 16 after human +1
  assert.equal(w.attack, 2 + 3);
});

test('multiclass: saves stay from the first class; prerequisites are checked', () => {
  const b = build({ classes: [{ id: 'fighter', level: 3, subclass: 'champion' }, { id: 'wizard', level: 1 }],
    abilities: { method: 'standardArray', base: { str: 15, dex: 12, con: 14, int: 13, wis: 10, cha: 8 } },
    choices: { skills: { fighter: ['athletics', 'perception'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: { 'fighter:1': 'defense' } } });
  const d = E.derive(b, SRD);
  assert.equal(d.characterStats.saveProfs.str, true);
  assert.equal(d.characterStats.saveProfs.int, false);
  assert.equal(d.characterStats.characterClass, 'Fighter 3 / Wizard 1');
  assert.equal(d.level, 4);
  assert.equal(E.validate(b, SRD).ok, true, JSON.stringify(E.validate(b, SRD).issues));
  const low = build({ classes: [{ id: 'fighter', level: 1 }, { id: 'wizard', level: 1 }], abilities: { method: 'standardArray', base: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 } } });
  assert.ok(errors(low).includes('multiclass-requires'));
});

test('skills: count, allowed list and no double proficiency', () => {
  assert.ok(errors(build({ choices: { skills: { fighter: ['athletics'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: { 'fighter:1': 'defense' } } })).includes('skills-missing'));
  assert.ok(errors(build({ choices: { skills: { fighter: ['athletics', 'arcana'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: { 'fighter:1': 'defense' } } })).includes('skills-not-allowed'));
  // Acolyte already gives Insight
  assert.ok(errors(build({ choices: { skills: { fighter: ['athletics', 'insight'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: { 'fighter:1': 'defense' } } })).includes('skills-duplicate'));
});

test('rogue expertise doubles proficiency in the sheet', () => {
  const b = build({ classes: [{ id: 'rogue', level: 1 }], choices: { skills: { rogue: ['stealth', 'perception', 'acrobatics', 'deception'] }, subclassSkills: {}, expertise: ['stealth', 'perception'], asi: {}, fightingStyles: {} } });
  const d = E.derive(b, SRD);
  assert.equal(d.characterStats.skillCustomBonuses.stealth, 2);
  assert.equal(E.validate(b, SRD).ok, true, JSON.stringify(E.validate(b, SRD).issues));
  const missing = build({ classes: [{ id: 'rogue', level: 1 }], choices: { skills: { rogue: ['stealth', 'perception', 'acrobatics', 'deception'] }, subclassSkills: {}, expertise: ['stealth'], asi: {}, fightingStyles: {} } });
  assert.ok(E.pendingChoices(missing, SRD).some((i) => i.code === 'expertise-missing'));
});

test('subclass needed at its level, not before', () => {
  const b3 = build({ classes: [{ id: 'fighter', level: 3 }] });
  assert.ok(E.pendingChoices(b3, SRD).some((i) => i.code === 'subclass-missing'));
  assert.ok(errors(build({ classes: [{ id: 'fighter', level: 2, subclass: 'champion' }] })).includes('subclass-early'));
  const cleric = build({ classes: [{ id: 'cleric', level: 1 }], choices: { skills: { cleric: ['history', 'medicine'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  assert.ok(E.pendingChoices(cleric, SRD).some((i) => i.code === 'subclass-missing'));
  cleric.classes[0].subclass = 'life';
  assert.ok(E.derive(cleric, SRD).characterStats.armorProf.includes('Heavy Armor'));
});

test('ability score improvements: shape, cap at 20, feats and their prerequisites', () => {
  const at4 = (pick, base) => build({ abilities: { method: 'manual', base: base || { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }, classes: [{ id: 'fighter', level: 4, subclass: 'champion' }],
    choices: { skills: { fighter: ['athletics', 'perception'] }, subclassSkills: {}, expertise: [], asi: pick === undefined ? {} : { 'fighter:4': pick }, fightingStyles: { 'fighter:1': 'defense' } } });
  const opts = { allowManual: true };
  assert.ok(E.pendingChoices(at4(), SRD, opts).some((i) => i.code === 'asi-missing'));
  assert.ok(errors(at4({ type: 'asi', abilities: { str: 1 } }), opts).includes('asi-shape'));
  assert.ok(errors(at4({ type: 'asi', abilities: { str: 2 } }), opts).includes('asi-cap'));          // human STR 19 + 2
  assert.equal(E.derive(at4({ type: 'asi', abilities: { str: 1, con: 1 } }), SRD).abilities.scores.str, 20);
  assert.equal(E.validate(at4({ type: 'feat', feat: 'grappler' }), SRD, opts).ok, true);
  const weak = at4({ type: 'feat', feat: 'grappler' }, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  assert.ok(errors(weak, opts).includes('feat-requires'));
  assert.ok(E.derive(at4({ type: 'feat', feat: 'grappler' }), SRD).features.some((f) => f.name === 'Feat: Grappler'));
});

test('fighting styles: required, from the class list, no repeats', () => {
  assert.ok(E.pendingChoices(build({ choices: { skills: { fighter: ['athletics', 'perception'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } }), SRD).some((i) => i.code === 'style-missing'));
  const pal = build({ classes: [{ id: 'paladin', level: 2 }], choices: { skills: { paladin: ['athletics', 'medicine'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: { 'paladin:2': 'archery' } } });
  assert.ok(errors(pal).includes('style-not-allowed'));
});

test('strict off turns rule breaks into warnings, but missing choices stay errors', () => {
  const b = build({ abilities: { method: 'standardArray', base: { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 } } });
  const v = E.validate(b, SRD, { strict: false });
  assert.equal(v.ok, true);
  assert.ok(v.issues.some((i) => i.code === 'abilities-array' && i.level === 'warning'));
  const missing = E.validate(E.newBuild(SRD), SRD, { strict: false });
  assert.equal(missing.ok, false);
});

test('level up adds a level and keeps everything else', () => {
  const b = build();
  const b2 = E.levelUp(b, SRD, 'fighter', 7);
  assert.equal(b.classes[0].level, 1);            // original untouched
  assert.equal(b2.classes[0].level, 2);
  assert.deepEqual(b2.classes[0].hp, [null, 7]);
  assert.equal(E.derive(b2, SRD).hp.max, (10 + 2) + (7 + 2));
  const b3 = E.levelUp(b2, SRD, 'wizard', null);
  assert.equal(b3.classes.length, 2);
  assert.equal(E.totalLevel(b3, SRD), 3);
  let max = build({ classes: [{ id: 'fighter', level: 20 }] });
  assert.throws(() => E.levelUp(max, SRD, 'fighter'), /level 20/);
});

test('level up options: existing classes, and new ones only with the multiclass prerequisites', () => {
  // Human fighter from the standard array: STR 16, DEX 15, CON 14, INT 13, WIS 11, CHA 9.
  const opts = E.levelUpOptions(build(), SRD);
  const by = Object.fromEntries(opts.map((o) => [o.id, o]));
  assert.equal(by.fighter.existing, true);
  assert.equal(by.fighter.level, 1);
  assert.equal(by.fighter.ok, true);
  assert.equal(by.wizard.ok, true);                 // INT 13
  assert.equal(by.rogue.ok, true);                  // DEX 13
  assert.equal(by.cleric.ok, false);                // WIS 11
  assert.match(by.cleric.need.join(' '), /WIS 13/);
  assert.equal(by.monk.ok, false);                  // needs DEX 13 and WIS 13
  assert.deepEqual(E.levelUpOptions(build({ classes: [{ id: 'fighter', level: 20 }] }), SRD), []);
});

test('level up asks only for what the new level brings', () => {
  const codes = (prev, next) => E.newIssues(prev, next, SRD).map((i) => i.code);
  const lvl = (n) => build({ classes: [{ id: 'fighter', level: n, subclass: n >= 3 ? 'champion' : null, hp: [] }], choices: Object.assign(build().choices, n >= 4 ? { asi: { 'fighter:4': { type: 'asi', abilities: { str: 2 } } } } : {}) });
  assert.deepEqual(codes(lvl(1), E.levelUp(lvl(1), SRD, 'fighter', null)), []);
  assert.deepEqual(codes(lvl(2), E.levelUp(lvl(2), SRD, 'fighter', null)), ['subclass-missing']);
  assert.deepEqual(codes(lvl(3), E.levelUp(lvl(3), SRD, 'fighter', null)), ['asi-missing']);
  // Multiclassing into rogue: one rogue skill and two expertise picks.
  const rogue = codes(lvl(1), E.levelUp(lvl(1), SRD, 'rogue', null));
  assert.ok(rogue.includes('skills-missing'), rogue.join());
  assert.ok(rogue.includes('expertise-missing'), rogue.join());
  // Cleric without WIS 13 breaks the rules.
  assert.ok(codes(lvl(1), E.levelUp(lvl(1), SRD, 'cleric', null)).includes('multiclass-requires'));
});

test('sheet output has the fields the existing character sheet reads', () => {
  const cs = E.derive(build(), SRD).characterStats;
  const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'profBonus', 'speed', 'initBonus', 'ac', 'characterClass', 'species', 'level',
    'armorProf', 'weaponProf', 'toolProf', 'languages', 'saveNotes', 'senseNotes', 'saveProfs', 'skillProfs', 'saveCustomBonuses', 'skillCustomBonuses'];
  keys.forEach((k) => assert.ok(k in cs, 'missing ' + k));
  assert.equal(Object.keys(cs.skillProfs).length, 18);
  assert.ok('sleightOfHand' in cs.skillProfs);
});

test('features list: class, subclass, species and background', () => {
  const b = build({ classes: [{ id: 'fighter', level: 3, subclass: 'champion' }] });
  const names = E.derive(b, SRD).features.map((f) => f.name);
  ['Second Wind', 'Action Surge (one use)', 'Improved Critical', 'Shelter of the Faithful', 'Fighting Style: Defense'].forEach((n) => assert.ok(names.includes(n), n));
  // Grouped under the class's name like the other class features
  assert.equal(E.derive(b, SRD).features.find((f) => f.name === 'Fighting Style: Defense').source, 'Fighter');
});

test('homebrew: a DM-made species and subclass work like SRD ones', () => {
  const rules = E.mergeRules(SRD, {
    species: { tabaxi: { name: 'Tabaxi', size: 'Medium', speed: 30, abilityBonuses: { dex: 2, cha: 1 }, skills: ['perception', 'stealth'], languages: ['Common'] } },
    subclasses: { wizard: { bladesong: { name: 'Bladesinging (homebrew)', features: { 2: ['Bladesong'] } } } }
  });
  assert.equal(SRD.species.tabaxi, undefined);    // the SRD itself is untouched
  const b = build({ species: 'tabaxi', classes: [{ id: 'wizard', level: 2, subclass: 'bladesong' }], choices: { skills: { wizard: ['arcana', 'history'] }, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} } });
  const v = E.validate(b, rules);
  assert.equal(v.ok, true, JSON.stringify(v.issues));
  const d = E.derive(b, rules);
  assert.equal(d.abilities.scores.dex, 16);
  assert.ok(d.features.some((f) => f.name === 'Bladesong'));
  assert.equal(rules.species.tabaxi.homebrew, true);
});

// A sheet as the old forge wrote it: final scores with no racial bonus split out.
function oldSheet(over) {
  const skillProfs = {};
  ['athletics', 'acrobatics', 'perception', 'survival'].forEach((s) => { skillProfs[s] = true; });
  return Object.assign({ str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8, characterClass: 'Fighter', species: 'Human', level: 5, skillProfs: skillProfs, skillCustomBonuses: {} }, over || {});
}

test('converting an old sheet keeps its ability scores and level', () => {
  const r = E.buildFromSheet(oldSheet(), SRD, { name: 'Old Hero' });
  assert.equal(r.ok, true);
  assert.equal(r.build.name, 'Old Hero');
  assert.deepEqual(r.build.classes, [{ id: 'fighter', level: 5, subclass: null, hp: [] }]);
  const d = E.derive(r.build, SRD);
  assert.deepEqual(d.abilities.scores, { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 });
  assert.equal(d.level, 5);
  // Human +1 everywhere and the level 4 ASI (assumed +2 STR) come off the base.
  assert.deepEqual(r.build.abilities.base, { str: 12, dex: 13, con: 13, int: 9, wis: 11, cha: 7 });
  assert.deepEqual(r.build.choices.asi, { 'fighter:4': { type: 'asi', abilities: { str: 2 } } });
  assert.deepEqual(r.build.choices.skills.fighter, ['acrobatics', 'athletics']);
  assert.ok(r.notes.some((n) => /Perception, Survival/.test(n)));          // extra skills are reported
  const pending = E.pendingChoices(r.build, SRD).map((i) => i.code);
  assert.ok(pending.includes('background-missing'));
  assert.ok(pending.includes('subclass-missing'));
  assert.ok(pending.includes('style-missing'));
});

test('converting: subraces by name, the only subrace assumed, species choices picked', () => {
  const dwarf = E.buildFromSheet(oldSheet({ species: 'Dwarf', level: 1 }), SRD);
  assert.equal(dwarf.build.subrace, 'hill');
  assert.equal(E.derive(dwarf.build, SRD).abilities.scores.wis, 12);
  const elf = E.buildFromSheet(oldSheet({ species: 'Elf', subrace: 'High', level: 1 }), SRD);
  assert.equal(elf.build.subrace, 'high');
  const halfElf = E.buildFromSheet(oldSheet({ species: 'Half-Elf', level: 1 }), SRD);
  assert.deepEqual(halfElf.build.speciesChoices.abilities, ['str', 'dex']);   // two highest, not CHA
  assert.equal(E.derive(halfElf.build, SRD).abilities.scores.cha, 8);
});

test('converting: expertise from the sheet bonus; unknown classes are refused', () => {
  const rogue = E.buildFromSheet(oldSheet({ characterClass: 'Rogue', level: 1, skillProfs: { stealth: true, acrobatics: true, deception: true, insight: true }, skillCustomBonuses: { stealth: 2 } }), SRD);
  assert.deepEqual(rogue.build.choices.expertise, ['stealth']);
  const art = E.buildFromSheet(oldSheet({ characterClass: 'Artificer' }), SRD);
  assert.equal(art.ok, false);
  assert.match(art.reason, /Artificer/);
});
