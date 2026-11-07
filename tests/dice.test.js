// Run with: npm test   (node --test tests/)
// The dice engine (dice.js): expressions, keep/drop, advantage, totals, and the text of a roll.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// In Node the engine puts itself on module.exports; in the browser runner, on window.
const mod = require('../dice.js');
const Dice = (mod && mod.Dice) || globalThis.Dice;

// A fixed random source: hands out the given values in order.
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('dice: plain expressions add up, with numbers and minus signs', () => {
  assert.equal(Dice.roll('1d20+5', { rng: seq(12) }).total, 17);
  assert.equal(Dice.roll('2d6 + 3', { rng: seq(4, 6) }).total, 13);
  assert.equal(Dice.roll('d8-1', { rng: seq(1) }).total, 0);
  assert.equal(Dice.roll('-2+1d4', { rng: seq(3) }).total, 1);
  assert.equal(Dice.roll('1d8+1d6+2', { rng: seq(5, 3) }).total, 10);
  assert.equal(Dice.roll('D%', { rng: seq(73) }).total, 73);
  assert.equal(Dice.roll('7').total, 7);
  assert.equal(Dice.roll('2d6+3', { rng: seq(4, 6) }).expr, '2d6 + 3');
});

test('dice: keep and drop', () => {
  const r = Dice.roll('4d6kh3', { rng: seq(2, 6, 1, 5) });
  assert.equal(r.total, 13);
  assert.deepEqual(r.parts[0].kept, [true, true, false, true]);
  assert.equal(Dice.roll('4d6dl1', { rng: seq(2, 6, 1, 5) }).total, 13);
  assert.equal(Dice.roll('2d20kl1', { rng: seq(15, 3) }).total, 3);
  assert.equal(Dice.roll('2d20k1', { rng: seq(15, 3) }).total, 15);
  assert.equal(Dice.roll('3d6dh1', { rng: seq(6, 1, 4) }).total, 5);
  assert.equal(Dice.roll('2d6kh1', { rng: seq(4, 4) }).total, 4, 'ties keep one of them');
});

test('dice: advantage and disadvantage turn the first d20 into two', () => {
  const adv = Dice.roll('1d20+3', { mode: 'adv', rng: seq(8, 17) });
  assert.equal(adv.expr, '2d20kh1 + 3');
  assert.equal(adv.total, 20);
  const dis = Dice.roll('1d20+3', { mode: 'dis', rng: seq(8, 17) });
  assert.equal(dis.total, 11);
  assert.equal(Dice.roll('2d6', { mode: 'adv', rng: seq(1, 2) }).expr, '2d6', 'no d20, nothing changes');
});

test('dice: natural 20 and 1 are flagged on the kept d20', () => {
  assert.equal(Dice.roll('1d20+2', { rng: seq(20) }).crit, true);
  assert.equal(Dice.roll('1d20+2', { rng: seq(1) }).fumble, true);
  assert.equal(Dice.roll('1d20', { mode: 'adv', rng: seq(1, 20) }).crit, true);
  assert.equal(Dice.roll('1d20', { mode: 'dis', rng: seq(1, 20) }).fumble, true);
  assert.equal(Dice.roll('2d20', { rng: seq(20, 20) }).crit, false, 'two kept d20s is not a d20 roll');
});

test('dice: the text shows each die, the dropped ones struck through', () => {
  const r = Dice.roll('2d20kh1+5', { rng: seq(4, 17) });
  assert.equal(r.text, '2d20kh1 (4̶, 17) + 5 = 22');
  assert.equal(Dice.roll('1d6-1', { rng: seq(3) }).text, '1d6 (3) - 1 = 2');
});

test('dice: bad expressions are refused with a message', () => {
  assert.throws(() => Dice.roll(''), /Type a roll/);
  assert.throws(() => Dice.roll('1d20+x'), /Could not read/);
  assert.throws(() => Dice.roll('fireball'), /Could not read/);
  assert.throws(() => Dice.roll('1d20 5'), /Could not read/);
  assert.throws(() => Dice.roll('1000d6'), /between 1 and 100 dice/);
  assert.throws(() => Dice.roll('1d1'), /between 2 and 1000 sides/);
  assert.throws(() => Dice.roll('2d6kh3'), /Keep or drop between 1 and 2/);
  assert.throws(() => Dice.roll('1d4+'.repeat(30) + '1'), /too long|too many/);
  assert.equal(Dice.isValid('3d8+2'), true);
  assert.equal(Dice.isValid('3d8+'), false);
});

test('dice: d20 helper and the real random source stay in range', () => {
  assert.equal(Dice.d20(3), '1d20+3');
  assert.equal(Dice.d20(-1), '1d20-1');
  assert.equal(Dice.d20(0), '1d20');
  for (let i = 0; i < 2000; i++) {
    const v = Dice.roll('1d6').total;
    assert.ok(v >= 1 && v <= 6, 'got ' + v);
  }
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(Dice.roll('1d20').total);
  assert.equal(seen.size, 20, 'every face of a d20 comes up');
});
