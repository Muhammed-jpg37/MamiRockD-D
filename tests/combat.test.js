// Run with: npm test   (node --test tests/)
// Combat (combat.js): conditions, damage and healing, monsters, encounters (feature plan section 4).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mod = require('../combat.js');
const C = (mod && mod.Combat) || globalThis.Combat;

test('combat: the 15 SRD conditions match the conditions catalog', () => {
  const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'catalog', 'srd51-conditions.json'), 'utf8')).entries;
  assert.deepEqual(C.CONDITIONS.map((c) => c.id).sort(), cat.map((e) => e.id).sort());
  assert.equal(C.EXHAUSTION.length, 7);
});

test('combat: toggling conditions and exhaustion levels', () => {
  let c = C.toggle({}, 'poisoned');
  c = C.toggle(c, 'prone');
  assert.deepEqual(c, { poisoned: true, prone: true });
  c = C.toggle(c, 'poisoned');
  assert.deepEqual(c, { prone: true });
  c = C.setExhaustion(c, 2);
  assert.deepEqual(C.active(c).map((x) => x.label), ['Prone', 'Exhaustion 2']);
  assert.equal(C.active(c)[1].effect, 'Speed halved');
  assert.equal(C.summary(c), 'Prone, Exhaustion 2');
  assert.deepEqual(C.setExhaustion(c, 0), { prone: true });
  assert.equal(C.setExhaustion({}, 9).exhaustion, 6);
  assert.deepEqual(C.normalize({ prone: true, flying: true, exhaustion: 'x', blinded: false }), { prone: true }, 'unknown and off entries go');
  assert.deepEqual(C.toggle(null, 'nonsense'), {});
});

test('combat: damage takes temporary HP first; healing stops at max', () => {
  assert.deepEqual(C.applyHp({ current: 20, max: 30, temp: 5 }, -8), { current: 17, max: 30, temp: 0 });
  assert.deepEqual(C.applyHp({ current: 20, max: 30, temp: 5 }, -3), { current: 20, max: 30, temp: 2 });
  assert.deepEqual(C.applyHp({ current: 4, max: 30 }, -10), { current: 0, max: 30 }, 'not below 0');
  assert.deepEqual(C.applyHp({ current: 25, max: 30, temp: 2 }, 10), { current: 30, max: 30, temp: 2 }, 'healing leaves temp HP alone');
  assert.deepEqual(C.applyHp({ max: 12 }, -5), { current: 7, max: 12 }, 'missing current means full');
});

/* ---------- 4.3 Monsters ---------- */

const MONSTERS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'catalog', 'srd51-monsters.json'), 'utf8')).entries;
const monster = (id) => MONSTERS.find((m) => m.id === id);

test('combat: a monster from the catalog becomes a token', () => {
  const t = C.monsterToken(monster('goblin'), ['Goblin 1', 'Orc 1']);
  assert.deepEqual(t, { name: 'Goblin 2', size: 1, hp: { current: 7, max: 7 }, ac: 15, monsterId: 'srd51:goblin', initBonus: 2 });
  const dragon = MONSTERS.find((m) => m.size === 'Huge');
  assert.equal(C.monsterToken(dragon, []).size, 3);
  assert.equal(C.nextName('Ogre', []), 'Ogre 1');
  assert.deepEqual(C.abilityLine(monster('goblin')).map((a) => a.key + a.mod), ['str-1', 'dex+2', 'con+0', 'int+0', 'wis-1', 'cha-1']);
});

test('combat: stat block actions give attack, damage and DC rolls', () => {
  const [scimitar] = monster('goblin').actions;
  assert.deepEqual(C.actionRolls(scimitar), { attack: '1d20+4', damage: [{ expr: '1d6+2', type: 'slashing' }], dc: null });
  const withDc = MONSTERS.flatMap((m) => m.actions || []).find((a) => a.dc);
  assert.match(C.actionRolls(withDc).dc, /^DC \d+ [A-Z]{3}$/);
  assert.equal(C.actionRolls({ name: 'Multiattack', desc: 'Two attacks.' }).attack, null);
  // Every catalog action's damage reads as a dice expression.
  const Dice = require('../dice.js').Dice || globalThis.Dice;
  MONSTERS.forEach((m) => (m.actions || []).forEach((a) => C.actionRolls(a).damage.forEach((d) => assert.ok(Dice.isValid(d.expr), m.id + ' ' + a.name + ' ' + d.expr))));
});
