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

/* ---------- The table's roll log (vtt.js writes these) ---------- */

// The proposed database rules (firebase-rules/database.rules.json) for one log entry.
const RULES = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'firebase-rules', 'database.rules.json'), 'utf8'));
const roomRules = (() => {
  const vtt = RULES.rules.vtt;
  return vtt[Object.keys(vtt).find((k) => k.charAt(0) === '$')];   // vtt/$campaign
})();
const allowed = (node) => Object.keys(node.$entry).filter((k) => k.charAt(0) !== '.' && k !== '$other');

test('dice log: a roll becomes { by, expr, total, text, crit, fumble, label?, at }', () => {
  const r = Dice.roll('1d20+3', { rng: seq(20) });
  const e = Dice.logEntry(r, { by: 'Ayla', label: 'Thorin: Perception', at: 1234 });
  assert.deepEqual(e, { by: 'Ayla', expr: '1d20 + 3', total: 23, text: '1d20 (20) + 3 = 23', crit: true, fumble: false, at: 1234, label: 'Thorin: Perception' });
  const plain = Dice.logEntry(Dice.roll('2d6', { rng: seq(1, 1) }), {});
  assert.equal(plain.by, 'Guest');
  assert.equal('label' in plain, false);
  assert.ok(plain.at > 0);
  // Long names and labels are cut to what the database rules accept.
  const long = Dice.logEntry(r, { by: 'x'.repeat(80), label: 'y'.repeat(80) });
  assert.equal(long.by.length, 40);
  assert.equal(long.label.length, 60);
  // Every field is one the proposed rules allow, and the required ones are there.
  Object.keys(e).forEach((k) => assert.ok(allowed(roomRules.log).includes(k), 'log rule lacks ' + k));
  Object.keys(e).forEach((k) => assert.ok(allowed(roomRules.logHidden).includes(k), 'logHidden rule lacks ' + k));
  ['by', 'expr', 'total', 'text', 'at'].forEach((k) => assert.ok(roomRules.log.$entry['.validate'].includes("'" + k + "'")));
});

test('dice log: a hidden DM roll leaves only a placeholder in the shared log', () => {
  const e = Dice.logEntry(Dice.roll('1d20', { rng: seq(7) }), { by: 'DM', label: 'Stealth', at: 99 });
  const s = Dice.secretEntry(e);
  assert.deepEqual(s, { by: 'DM', hidden: true, at: 99 });
  Object.keys(s).forEach((k) => assert.ok(allowed(roomRules.log).includes(k), 'log rule lacks ' + k));
  assert.ok(roomRules.log.$entry['.validate'].includes("['by', 'hidden', 'at']"));
  // Players see that something was rolled, not what.
  const player = Dice.logView(s);
  assert.equal(player.what, 'rolled in secret');
  assert.equal(player.total, '?');
  assert.equal(player.detail, '');
  assert.equal(player.secret, false);
  // DMs pass the logHidden entry and see it all.
  const dm = Dice.logView(s, e);
  assert.equal(dm.what, 'Stealth');
  assert.equal(dm.total, 7);
  assert.equal(dm.detail, '1d20 (7) = 7');
  assert.equal(dm.hidden, true);
  assert.equal(dm.secret, true);
});

test('dice log: old { die, result } entries and new ones read the same way', () => {
  const old = Dice.logView({ by: 'Bo', die: 20, result: 20, at: 1 });
  assert.equal(old.what, 'd20');
  assert.equal(old.total, 20);
  assert.equal(old.crit, true);
  assert.equal(old.detail, '');
  assert.equal(Dice.logView({ by: 'Bo', die: 20, result: 1, at: 1 }).fumble, true);
  assert.equal(Dice.logView({ by: 'Bo', die: 6, result: 1, at: 1 }).fumble, false);
  const fresh = Dice.logView(Dice.logEntry(Dice.roll('2d20kl1+1', { rng: seq(1, 15) }), { by: 'Bo' }));
  assert.equal(fresh.what, '2d20kl1 + 1');
  assert.equal(fresh.total, 2);
  assert.equal(fresh.fumble, true);
  assert.equal(Dice.logView(undefined).who, '?');
});

/* ---------- Death saves ---------- */

test('dice: death saves fill the boxes by the SRD rules', () => {
  const empty = { successes: [false, false, false], failures: [false, false, false] };
  let out = Dice.deathSave({ total: 12 }, empty);
  assert.deepEqual(out.successes, [true, false, false]);
  assert.deepEqual(empty.successes, [false, false, false], 'the boxes passed in are not changed');
  assert.equal(out.note, 'success');
  out = Dice.deathSave({ total: 10 }, empty);
  assert.deepEqual(out.successes, [true, false, false], '10 is a success');
  out = Dice.deathSave({ total: 9 }, empty);
  assert.deepEqual(out.failures, [true, false, false]);
  out = Dice.deathSave({ total: 1, fumble: true }, { successes: [true, false, false], failures: [true, false, false] });
  assert.deepEqual(out.failures, [true, true, true]);
  assert.equal(out.dead, true);
  assert.match(out.note, /two failures.*dies/);
  out = Dice.deathSave({ total: 20, crit: true }, { successes: [true, false, false], failures: [true, true, false] });
  assert.equal(out.revived, true);
  assert.deepEqual(out.successes, [false, false, false]);
  assert.deepEqual(out.failures, [false, false, false]);
  out = Dice.deathSave({ total: 15 }, { successes: [true, true, false], failures: [true, false, false] });
  assert.equal(out.stable, true);
  assert.match(out.note, /stable/);
  // Missing or short boxes are filled in.
  assert.deepEqual(Dice.deathSave({ total: 3 }, {}).failures, [true, false, false]);
});
