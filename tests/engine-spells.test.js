// Run with: npm test   (node --test tests/)
// Spells in the rules (subclass and species spells) and in the engine
// (attachSpells, spellLimits, speciesSpells, spellOptions, validate, derive, mergeRules).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../character-engine.js');
const SRD_BASE = require('../rules/srd5.js');
const SPELLS = require('../rules/srd5-spells.js');

// Never change the shared rules object: other test files use it without spells.
const fresh = () => JSON.parse(JSON.stringify(SRD_BASE));
const RULES = E.attachSpells(fresh(), SPELLS);
const BY_ID = {};
SPELLS.forEach((s) => { BY_ID[s.id] = s; });

const ARRAY = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
function build(classes, over) {
  return Object.assign(E.newBuild(RULES), {
    name: 'Test', species: 'human', background: 'acolyte', classes: classes,
    abilities: { method: 'standardArray', base: Object.assign({}, ARRAY) }
  }, over || {});
}
const cls = (id, level, subclass) => ({ id: id, level: level, subclass: subclass || null, hp: [] });
const spellIssues = (b, rules) => E.validate(b, rules || RULES).issues.filter((i) => (i.path || '').startsWith('choices.spells'));
const codes = (b, rules) => spellIssues(b, rules).map((i) => i.code);
const limits = (b, id) => E.spellLimits(b, RULES).find((l) => l.classId === id);

/* ---------- Subclass and species spell data (rules/srd5.js) ---------- */

test('subclass and species spell ids all exist in the SRD spell data', () => {
  const ids = [];
  Object.values(RULES.classes).forEach((c) => Object.values(c.subclasses || {}).forEach((s) => {
    Object.values(s.alwaysPrepared || {}).forEach((l) => ids.push.apply(ids, l));
    Object.values(s.expandedSpells || {}).forEach((l) => ids.push.apply(ids, l));
    Object.values(s.circleSpells || {}).forEach((land) => Object.values(land.spells).forEach((l) => ids.push.apply(ids, l)));
  }));
  Object.values(RULES.species).forEach((sp) => [sp].concat(Object.values(sp.subraces || {})).forEach((s) => {
    ((s.spells || {}).innate || []).forEach((x) => ids.push(x.spell));
  }));
  assert.ok(ids.length >= 70);
  ids.forEach((id) => assert.ok(BY_ID[id], 'unknown spell id ' + id));
});

test('Domain, Oath and Circle spells arrive at the class level whose slots cast them', () => {
  const check = (table, classId) => Object.keys(table).forEach((lvl) => {
    const max = E.classMaxSpellLevel(RULES.classes[classId], Number(lvl), RULES);
    table[lvl].forEach((id) => assert.equal(BY_ID[id].level, max, classId + ' ' + lvl + ': ' + id));
  });
  check(RULES.classes.cleric.subclasses.life.alwaysPrepared, 'cleric');
  check(RULES.classes.paladin.subclasses.devotion.alwaysPrepared, 'paladin');
  const lands = RULES.classes.druid.subclasses.land.circleSpells;
  assert.deepEqual(Object.keys(lands).sort(), ['arctic', 'coast', 'desert', 'forest', 'grassland', 'mountain', 'swamp', 'underdark']);
  Object.values(lands).forEach((land) => check(land.spells, 'druid'));
});

test('the Fiend list is keyed by spell level', () => {
  const ex = RULES.classes.warlock.subclasses.fiend.expandedSpells;
  Object.keys(ex).forEach((sl) => ex[sl].forEach((id) => assert.equal(BY_ID[id].level, Number(sl), id)));
});

test('High Elf and Tiefling spells', () => {
  assert.deepEqual(RULES.species.elf.subraces.high.spells, { ability: 'int', cantrips: { choose: 1, from: 'wizard' } });
  const t = RULES.species.tiefling.spells;
  assert.equal(t.ability, 'cha');
  assert.deepEqual(t.innate.map((x) => [x.level, x.spell]), [[1, 'thaumaturgy'], [3, 'hellish_rebuke'], [5, 'darkness']]);
});

/* ---------- Engine: numbers ---------- */

test('attachSpells keys the data by id and leaves the base rules alone', () => {
  assert.equal(Object.keys(RULES.spells).length, 319);
  assert.equal(SRD_BASE.spells, undefined);
  assert.equal(RULES.spells.fireball.level, 3);
});

test('highest spell level: full, half and pact casters, per class', () => {
  const max = (id, lvl) => E.classMaxSpellLevel(RULES.classes[id], lvl, RULES);
  assert.deepEqual([1, 3, 5, 9, 17].map((l) => max('wizard', l)), [1, 2, 3, 5, 9]);
  assert.deepEqual([1, 2, 5, 9, 17].map((l) => max('paladin', l)), [0, 1, 2, 3, 5]);
  assert.deepEqual([1, 3, 5, 9, 11].map((l) => max('warlock', l)), [1, 2, 3, 5, 5]);
  assert.equal(max('fighter', 20), 0);
});

test('wizard 5: cantrips, spellbook and spells prepared', () => {
  const l = limits(build([cls('wizard', 5, 'evocation')]), 'wizard');
  // INT 15 + 1 (human) = 16, +3; prepared = 3 + 5
  assert.deepEqual([l.maxSpellLevel, l.cantrips, l.spellbook, l.prepared, l.known], [3, 4, 14, 8, null]);
  assert.equal(l.preparedFrom, 'spellbook');
  assert.equal(l.ritual, 'spellbook');
});

test('paladin 1 prepares nothing yet; paladin 6 Devotion gets its Oath spells', () => {
  const p1 = limits(build([cls('paladin', 1)]), 'paladin');
  assert.equal(p1.prepared, 0);
  const p6 = limits(build([cls('paladin', 6, 'devotion')], { abilities: { method: 'standardArray', base: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 } } }), 'paladin');
  assert.equal(p6.prepared, 2 + 3);   // CHA 15 (+2) + half of 6
  assert.deepEqual(p6.alwaysPrepared, ['protection_from_evil_and_good', 'sanctuary', 'lesser_restoration', 'zone_of_truth']);
});

test('multiclass paladin 6 / warlock 11: each class uses its own level', () => {
  const b = build([cls('paladin', 6, 'devotion'), cls('warlock', 11, 'fiend')], { abilities: { method: 'standardArray', base: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 } } });
  const d = E.derive(b, RULES).spellcasting;
  const w = d.classes.find((c) => c.classId === 'warlock');
  const p = d.classes.find((c) => c.classId === 'paladin');
  assert.deepEqual([p.maxSpellLevel, w.maxSpellLevel, w.known, w.cantrips], [2, 5, 11, 4]);
  assert.deepEqual(w.arcanum, [6]);
  assert.equal(d.casterLevel, 3);   // the warlock's pact slots are separate
  assert.deepEqual(d.pact, { slots: 3, level: 5 });
});

test('Lore bard 10: Magical Secrets inside spells known, Additional Magical Secrets on top', () => {
  const l = limits(build([cls('bard', 10, 'lore')]), 'bard');
  assert.deepEqual([l.known, l.secrets, l.extraSecrets, l.cantrips, l.maxSpellLevel], [14, 2, 2, 4, 5]);
});

test('Circle of the Land: a bonus cantrip, and the land picks the circle spells', () => {
  const b = build([cls('druid', 3, 'land')]);
  let l = limits(b, 'druid');
  assert.equal(l.cantrips, 2 + 1);
  assert.deepEqual(l.alwaysPrepared, []);
  b.choices.spells = { druid: { land: 'forest' } };
  l = limits(b, 'druid');
  assert.deepEqual(l.alwaysPrepared, ['barkskin', 'spider_climb']);
});

test('species spells: High Elf cantrip choice, Tiefling spells by character level', () => {
  assert.deepEqual(E.speciesSpells(build([cls('fighter', 1)], { species: 'elf', subrace: 'high' }), RULES).cantrips, { choose: 1, from: 'wizard' });
  const tf = (lvl) => E.speciesSpells(build([cls('fighter', lvl)], { species: 'tiefling' }), RULES).innate.map((x) => x.spell);
  assert.deepEqual(tf(1), ['thaumaturgy']);
  assert.deepEqual(tf(4), ['thaumaturgy', 'hellish_rebuke']);
  assert.deepEqual(tf(5), ['thaumaturgy', 'hellish_rebuke', 'darkness']);
});

/* ---------- Engine: options ---------- */

test('options: class list, levels the class can cast, expanded list, any class for secrets', () => {
  const sorc = build([cls('sorcerer', 3, 'draconic')]);
  const known = E.spellOptions(sorc, RULES, 'sorcerer', 'known');
  assert.ok(known.length > 20);
  known.forEach((id) => {
    assert.ok(RULES.spells[id].classes.includes('sorcerer'), id);
    assert.ok(RULES.spells[id].level >= 1 && RULES.spells[id].level <= 2, id);
  });
  E.spellOptions(sorc, RULES, 'sorcerer', 'cantrips').forEach((id) => assert.equal(RULES.spells[id].level, 0));

  const wl = build([cls('warlock', 5, 'fiend')]);
  assert.ok(E.spellOptions(wl, RULES, 'warlock', 'known').includes('fireball'), 'the Fiend adds Fireball');
  assert.ok(!E.spellOptions(build([cls('warlock', 5)]), RULES, 'warlock', 'known').includes('fireball'));

  const bard = build([cls('bard', 10, 'lore')]);
  assert.ok(E.spellOptions(bard, RULES, 'bard', 'known').includes('fireball'), 'Magical Secrets: any class');
  assert.ok(!E.spellOptions(build([cls('bard', 9)]), RULES, 'bard', 'known').includes('fireball'));

  const arc = E.spellOptions(build([cls('warlock', 11, 'fiend')]), RULES, 'warlock', 'arcanum:6');
  assert.ok(arc.length && arc.every((id) => RULES.spells[id].level === 6));
  assert.ok(E.spellOptions(build([cls('fighter', 1)], { species: 'elf', subrace: 'high' }), RULES, 'species').every((id) => RULES.spells[id].level === 0 && RULES.spells[id].classes.includes('wizard')));
});

/* ---------- Engine: validate ---------- */

const first = (b, id, kind, n, filter) => E.spellOptions(b, RULES, id, kind).filter(filter || (() => true)).slice(0, n);

test('without spell data, spell picks are not asked for', () => {
  const b = build([cls('wizard', 5, 'evocation')]);
  assert.deepEqual(codes(b, fresh()), []);
  assert.ok(codes(b).includes('spells-missing'));
});

test('missing picks are pending choices; a complete wizard 5 has no spell issues', () => {
  const b = build([cls('wizard', 5, 'evocation')]);
  const pend = E.pendingChoices(b, RULES).filter((i) => i.path.startsWith('choices.spells')).map((i) => i.path);
  assert.deepEqual(pend.sort(), ['choices.spells.wizard.cantrips', 'choices.spells.wizard.spellbook']);
  b.choices.spells = { wizard: { cantrips: first(b, 'wizard', 'cantrips', 4), spellbook: first(b, 'wizard', 'spellbook', 14) } };
  assert.deepEqual(spellIssues(b), []);
});

test('the spellbook may hold more than the minimum; cantrips and spells known may not', () => {
  const b = build([cls('wizard', 1)]);
  b.choices.spells = { wizard: { cantrips: first(b, 'wizard', 'cantrips', 4), spellbook: first(b, 'wizard', 'spellbook', 9) } };
  assert.deepEqual(codes(b), ['spells-count']);
  const s = build([cls('sorcerer', 1, 'draconic')]);
  s.choices.spells = { sorcerer: { cantrips: first(s, 'sorcerer', 'cantrips', 4), known: first(s, 'sorcerer', 'known', 3) } };
  assert.deepEqual(codes(s), ['spells-count']);
});

test('wrong list, too high a level, unknown and duplicate spells are errors', () => {
  const s = build([cls('sorcerer', 1, 'draconic')]);
  const cantrips = first(s, 'sorcerer', 'cantrips', 4);
  const notSorc = Object.values(RULES.spells).find((x) => x.level === 1 && !x.classes.includes('sorcerer')).id;
  s.choices.spells = { sorcerer: { cantrips: cantrips, known: [notSorc, 'fireball'] } };
  assert.deepEqual(codes(s).sort(), ['spell-not-allowed', 'spell-not-allowed']);
  s.choices.spells.sorcerer.known = ['no_such_spell', 'magic_missile'];
  assert.deepEqual(codes(s), ['spell-unknown']);
  s.choices.spells.sorcerer.known = ['magic_missile', 'magic_missile'];
  assert.deepEqual(codes(s), ['spell-duplicate']);
  s.choices.spells.sorcerer.cantrips = cantrips.slice(0, 3).concat(['magic_missile']);
  s.choices.spells.sorcerer.known = ['magic_missile', 'shield'];
  assert.ok(codes(s).includes('spell-not-allowed'), 'a 1st-level spell is not a cantrip');
});

test('unlocked campaigns turn rule breaks into warnings, missing picks stay errors', () => {
  const s = build([cls('sorcerer', 1, 'draconic')]);
  s.choices.spells = { sorcerer: { cantrips: first(s, 'sorcerer', 'cantrips', 4), known: ['fireball'] } };
  const issues = E.validate(s, RULES, { strict: false }).issues.filter((i) => i.path.startsWith('choices.spells'));
  assert.deepEqual(issues.map((i) => [i.code, i.level]).sort(), [['spell-not-allowed', 'warning'], ['spells-missing', 'error']]);
});

test('Magical Secrets: two off-list spells pass at bard 10, a third does not', () => {
  const b = build([cls('bard', 10, 'lore')]);
  const bardOnly = first(b, 'bard', 'known', 12, (id) => RULES.spells[id].classes.includes('bard'));
  const offList = first(b, 'bard', 'known', 5, (id) => !RULES.spells[id].classes.includes('bard'));
  b.choices.spells = { bard: { cantrips: first(b, 'bard', 'cantrips', 4), known: bardOnly.concat(offList.slice(0, 2)), secrets: offList.slice(2, 4) } };
  assert.deepEqual(spellIssues(b), []);
  b.choices.spells.bard.known = bardOnly.slice(0, 11).concat(offList.slice(0, 3));
  b.choices.spells.bard.secrets = offList.slice(3, 5);
  assert.deepEqual(codes(b), ['spell-not-allowed']);
  b.choices.spells.bard.known = bardOnly.concat(offList.slice(0, 2));
  b.choices.spells.bard.secrets = [offList[0], offList[2]];
  assert.deepEqual(codes(b), ['spell-not-allowed'], 'a Lore secret can not repeat a spell known');
});

test('Mystic Arcanum: one spell of exactly that level from the warlock list', () => {
  const b = build([cls('warlock', 11, 'fiend')], { abilities: { method: 'standardArray', base: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 } } });
  b.choices.spells = { warlock: { cantrips: first(b, 'warlock', 'cantrips', 4), known: first(b, 'warlock', 'known', 11) } };
  assert.deepEqual(E.pendingChoices(b, RULES).filter((i) => i.path.startsWith('choices.spells')).map((i) => i.path), ['choices.spells.warlock.arcanum.6']);
  b.choices.spells.warlock.arcanum = { 6: 'fireball' };
  assert.deepEqual(codes(b), ['spell-not-allowed']);
  b.choices.spells.warlock.arcanum = { 6: first(b, 'warlock', 'arcanum:6', 1)[0] };
  assert.deepEqual(spellIssues(b), []);
});

test('Circle of the Land asks for a land; High Elf asks for a wizard cantrip', () => {
  const b = build([cls('druid', 2, 'land')], { species: 'elf', subrace: 'high' });
  const pend = () => E.pendingChoices(b, RULES).filter((i) => i.path.startsWith('choices.spells')).map((i) => i.path).sort();
  assert.deepEqual(pend(), ['choices.spells.druid.cantrips', 'choices.spells.druid.land', 'choices.spells.species.cantrips']);
  b.choices.spells = { druid: { land: 'atlantis' } };
  assert.ok(codes(b).includes('spells-land'));
  b.choices.spells = { druid: { land: 'swamp', cantrips: first(b, 'druid', 'cantrips', 3) }, species: { cantrips: ['fire_bolt'] } };
  assert.deepEqual(spellIssues(b), []);
  b.choices.spells.species.cantrips = ['guidance'];   // a druid cantrip, not a wizard one
  assert.deepEqual(codes(b), ['spell-not-allowed']);
});

test('levelling up asks for the new picks only', () => {
  const b = build([cls('sorcerer', 3, 'draconic')]);
  b.choices.spells = { sorcerer: { cantrips: first(b, 'sorcerer', 'cantrips', 4), known: first(b, 'sorcerer', 'known', 4) } };
  assert.deepEqual(spellIssues(b), []);
  const next = E.levelUp(b, RULES, 'sorcerer', null);
  next.choices.asi['sorcerer:4'] = { type: 'asi', abilities: { cha: 2 } };
  assert.deepEqual(E.newIssues(b, next, RULES).map((i) => i.path).sort(), ['choices.spells.sorcerer.cantrips', 'choices.spells.sorcerer.known']);
});

/* ---------- Engine: derive ---------- */

test('derive lists every spell with its source and kind', () => {
  const b = build([cls('cleric', 3, 'life')], { species: 'tiefling' });
  b.choices.spells = { cleric: { cantrips: ['guidance', 'light', 'sacred_flame'] } };
  const spells = E.derive(b, RULES).spellcasting.spells;
  const of = (kind) => spells.filter((x) => x.kind === kind).map((x) => x.source + ':' + x.id);
  assert.deepEqual(of('cantrip'), ['cleric:guidance', 'cleric:light', 'cleric:sacred_flame']);
  assert.deepEqual(of('always'), ['cleric:bless', 'cleric:cure_wounds', 'cleric:lesser_restoration', 'cleric:spiritual_weapon']);
  assert.deepEqual(of('innate'), ['species:thaumaturgy', 'species:hellish_rebuke']);
});

/* ---------- Homebrew spells (mergeRules) ---------- */

const HB = { spells: {
  ember_lash: { name: 'Ember Lash', level: 2, school: 'Evocation', classes: ['sorcerer', 'wizard'], components: ['V', 'S'], desc: ['A whip of embers.'], source: 'HB', license: 'homebrew' },
  fireball: { name: 'Not Fireball', level: 1, classes: ['cleric'] }
} };

test('homebrew spells join the spell data, never replacing an SRD spell', () => {
  const r = E.mergeRules(RULES, HB);
  assert.equal(r.spells.ember_lash.homebrew, true);
  assert.equal(r.spells.ember_lash.id, 'ember_lash');
  assert.equal(r.spells.fireball.name, 'Fireball');
  assert.equal(RULES.spells.ember_lash, undefined, 'the base rules are not changed');
  const s = build([cls('sorcerer', 3, 'draconic')]);
  assert.ok(E.spellOptions(s, r, 'sorcerer', 'known').includes('ember_lash'));
  assert.ok(!E.spellOptions(build([cls('cleric', 3, 'life')]), r, 'cleric', 'known').includes('ember_lash'));
});

test('homebrew spells alone never switch spell picks on', () => {
  const r = E.mergeRules(fresh(), HB);
  assert.equal(r.spells, undefined);
  assert.deepEqual(codes(build([cls('wizard', 1)]), r), []);
});
