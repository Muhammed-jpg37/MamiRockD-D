/* ========================================================
   DICE (feature plan step 2): one engine for every roll on
   the site — the table's dice bar, and later the sheet's
   click-to-roll and monster stat blocks.

   Expressions: terms joined by + or -, each one of
     NdX        2d6, d20, d% (= d100)
     NdXkhK     keep the highest K (k = kh): 4d6kh3, 2d20kh1
     NdXklK     keep the lowest K: 2d20kl1
     NdXdlK     drop the lowest K (dh: drop the highest)
     N          a number: +5, -1
   Spaces do not matter; upper case is fine.
   Advantage / disadvantage turn the first single d20 into
   2d20kh1 / 2d20kl1.

   No DOM; the random source can be swapped for tests.
   ======================================================== */
(function (root) {
  'use strict';

  const LIMITS = { dicePerTerm: 100, sides: 1000, terms: 20, length: 120 };

  // An unbiased integer in 1..sides from the browser's (or Node's) crypto when there is one.
  function cryptoRoll(sides) {
    const c = (typeof root !== 'undefined' && root.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (c && typeof c.getRandomValues === 'function') {
      const max = Math.floor(0xffffffff / sides) * sides;
      const buf = new Uint32Array(1);
      do { c.getRandomValues(buf); } while (buf[0] >= max);
      return (buf[0] % sides) + 1;
    }
    return 1 + Math.floor(Math.random() * sides);
  }

  /* ---------- Parsing ---------- */

  // Returns [{ sign, kind: 'dice', count, sides, keep: { mode: 'kh'|'kl'|'dh'|'dl', n } | null } | { sign, kind: 'num', value }]
  function parse(expr) {
    const raw = String(expr == null ? '' : expr);
    // "1d20 5" must not become "1d205": a space between two numbers is an error, not nothing.
    if (/[\d%]\s+\d/.test(raw)) throw new Error('Could not read "' + raw + '": put + or - between the parts, like 1d20+5.');
    const src = raw.toLowerCase().replace(/\s+/g, '').replace(/d%/g, 'd100');
    if (!src) throw new Error('Type a roll, like 1d20+5.');
    if (src.length > LIMITS.length) throw new Error('That roll is too long.');
    const terms = [];
    const re = /([+-]?)(?:(\d*)d(\d+)(?:(kh|kl|dh|dl|k)(\d+))?|(\d+))/y;
    let i = 0;
    while (i < src.length) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m || m[0] === '' || (terms.length && !m[1])) throw new Error('Could not read "' + expr + '" near "' + src.slice(i, i + 8) + '". Use rolls like 1d20+5, 2d6+3 or 4d6kh3.');
      const sign = m[1] === '-' ? -1 : 1;
      if (m[3] !== undefined) {
        const count = m[2] === '' ? 1 : Number(m[2]);
        const sides = Number(m[3]);
        if (count < 1 || count > LIMITS.dicePerTerm) throw new Error('Roll between 1 and ' + LIMITS.dicePerTerm + ' dice at a time.');
        if (sides < 2 || sides > LIMITS.sides) throw new Error('Dice need between 2 and ' + LIMITS.sides + ' sides.');
        let keep = null;
        if (m[4]) {
          const n = Number(m[5]);
          const mode = m[4] === 'k' ? 'kh' : m[4];
          if (n < 1 || n > count) throw new Error('Keep or drop between 1 and ' + count + ' of ' + count + 'd' + sides + '.');
          keep = { mode: mode, n: n };
        }
        terms.push({ sign: sign, kind: 'dice', count: count, sides: sides, keep: keep });
      } else {
        terms.push({ sign: sign, kind: 'num', value: Number(m[6]) });
      }
      if (terms.length > LIMITS.terms) throw new Error('That roll has too many parts.');
      i = re.lastIndex;
    }
    return terms;
  }

  function termText(t) {
    if (t.kind === 'num') return String(t.value);
    return t.count + 'd' + t.sides + (t.keep ? t.keep.mode + t.keep.n : '');
  }
  const exprText = (terms) => terms.map((t, i) => (i === 0 ? (t.sign < 0 ? '-' : '') : (t.sign < 0 ? ' - ' : ' + ')) + termText(t)).join('');

  // Advantage / disadvantage: the first plain d20 (1d20) becomes 2d20kh1 / 2d20kl1.
  function applyMode(terms, mode) {
    if (mode !== 'adv' && mode !== 'dis') return terms;
    const t = terms.find((x) => x.kind === 'dice' && x.sides === 20 && x.count === 1 && !x.keep);
    if (!t) return terms;
    t.count = 2;
    t.keep = { mode: mode === 'adv' ? 'kh' : 'kl', n: 1 };
    return terms;
  }

  /* ---------- Rolling ---------- */

  // roll('1d20+5', { mode: 'adv', rng }) -> { expr, total, parts, text, crit, fumble }
  function roll(expr, opts) {
    opts = opts || {};
    const rng = typeof opts.rng === 'function' ? opts.rng : cryptoRoll;
    const terms = applyMode(parse(expr), opts.mode);
    let total = 0;
    const parts = terms.map((t) => {
      if (t.kind === 'num') { total += t.sign * t.value; return { sign: t.sign, kind: 'num', value: t.value }; }
      const rolls = [];
      for (let k = 0; k < t.count; k++) rolls.push(rng(t.sides));
      const kept = rolls.map(() => true);
      if (t.keep) {
        // Which dice stay: sort indexes by value, mark the ones that are dropped.
        const order = rolls.map((v, idx) => idx).sort((a, b) => rolls[a] - rolls[b] || a - b);
        const n = t.keep.n;
        let dropped = [];
        if (t.keep.mode === 'kh') dropped = order.slice(0, rolls.length - n);
        else if (t.keep.mode === 'kl') dropped = order.slice(n);
        else if (t.keep.mode === 'dl') dropped = order.slice(0, n);
        else if (t.keep.mode === 'dh') dropped = order.slice(rolls.length - n);
        dropped.forEach((idx) => { kept[idx] = false; });
      }
      const sum = rolls.reduce((s, v, idx) => s + (kept[idx] ? v : 0), 0);
      total += t.sign * sum;
      return { sign: t.sign, kind: 'dice', count: t.count, sides: t.sides, keep: t.keep, rolls: rolls, kept: kept, sum: sum };
    });
    // A natural 20 or 1 counts when the roll's d20 term ends in one kept die.
    const d20 = parts.find((p) => p.kind === 'dice' && p.sides === 20 && p.kept.filter(Boolean).length === 1);
    const nat = d20 ? d20.rolls[d20.kept.indexOf(true)] : null;
    return { expr: exprText(terms), total: total, parts: parts, text: describe(parts, total), crit: nat === 20, fumble: nat === 1 };
  }

  // "2d20kh1 (17, 4̶) + 5 = 22": dropped dice are shown struck through with a combining stroke.
  function describe(parts, total) {
    const strike = (s) => String(s).split('').map((ch) => ch + '̶').join('');
    const body = parts.map((p, i) => {
      const sign = i === 0 ? (p.sign < 0 ? '-' : '') : (p.sign < 0 ? ' - ' : ' + ');
      if (p.kind === 'num') return sign + p.value;
      const dice = p.rolls.map((v, idx) => (p.kept[idx] ? String(v) : strike(v))).join(', ');
      return sign + p.count + 'd' + p.sides + (p.keep ? p.keep.mode + p.keep.n : '') + ' (' + dice + ')';
    }).join('');
    return body + ' = ' + total;
  }

  // "+5" style bonus for building expressions from the sheet: bonusExpr(3) -> "1d20+3".
  function d20(bonus) {
    const b = Number(bonus) || 0;
    return '1d20' + (b > 0 ? '+' + b : b < 0 ? String(b) : '');
  }

  function isValid(expr) { try { parse(expr); return true; } catch (e) { return false; } }

  /* ---------- The table's roll log (vtt/<campaign>/log, vtt.js) ---------- */

  // The entry a roll writes: { by, expr, total, text, crit, fumble, label?, at }.
  // r: a roll() result; opts: { by, label, at }. Text lengths match the proposed database rules.
  function logEntry(r, opts) {
    opts = opts || {};
    const entry = {
      by: String(opts.by || 'Guest').slice(0, 40),
      expr: String(r.expr).slice(0, 200), total: r.total, text: String(r.text).slice(0, 400),
      crit: !!r.crit, fumble: !!r.fumble, at: Number(opts.at) || Date.now(),
    };
    if (opts.label) entry.label = String(opts.label).slice(0, 60);
    return entry;
  }

  // A hidden DM roll: the full entry goes to vtt/<campaign>/logHidden, the shared log gets this.
  function secretEntry(entry) {
    return { by: entry.by, hidden: true, at: entry.at };
  }

  // How one log row reads, for every shape in the log:
  //   new entries; entries from before this engine ({ by, die, result, at });
  //   hidden placeholders, shown in full only when `secret` (the logHidden entry) is passed.
  // -> { who, what, total, detail, crit, fumble, hidden, secret }
  function logView(e, secret) {
    e = e || {};
    if (e.hidden) {
      if (!secret) return { who: e.by || '?', what: 'rolled in secret', total: '?', detail: '', crit: false, fumble: false, hidden: true, secret: false };
      const v = logView(secret);
      return Object.assign(v, { hidden: true, secret: true });
    }
    if (e.expr === undefined) {
      const nat = Number(e.die) === 20;
      return { who: e.by || '?', what: 'd' + e.die, total: e.result, detail: '', crit: nat && e.result === 20, fumble: nat && e.result === 1, hidden: false, secret: false };
    }
    return { who: e.by || '?', what: e.label || e.expr || '', total: e.total, detail: e.text || '', crit: !!e.crit, fumble: !!e.fumble, hidden: false, secret: false };
  }

  /* ---------- Death saves (SRD 5.1) ---------- */

  // A death save roll against the sheet's boxes: 10 or more is a success, a natural 1 two
  // failures, a natural 20 clears the boxes and brings the character back with 1 HP.
  // entry: { total, crit, fumble }; ds: { successes: [bool×3], failures: [bool×3] }.
  // -> { successes, failures, revived, stable, dead, note } (new arrays; ds is not changed)
  function deathSave(entry, ds) {
    const successes = (ds && ds.successes ? ds.successes : []).slice(0, 3).map(Boolean);
    const failures = (ds && ds.failures ? ds.failures : []).slice(0, 3).map(Boolean);
    while (successes.length < 3) successes.push(false);
    while (failures.length < 3) failures.push(false);
    const mark = (list, n) => { for (let i = 0; i < list.length && n > 0; i++) if (!list[i]) { list[i] = true; n--; } };
    if (entry.crit) {
      return { successes: [false, false, false], failures: [false, false, false], revived: true, stable: false, dead: false, note: 'natural 20, back up with 1 HP' };
    }
    let note;
    if (entry.fumble) { mark(failures, 2); note = 'natural 1, two failures'; }
    else if (entry.total >= 10) { mark(successes, 1); note = 'success'; }
    else { mark(failures, 1); note = 'failure'; }
    const dead = failures.every(Boolean);
    const stable = !dead && successes.every(Boolean);
    if (dead) note += '. Three failures: the character dies';
    else if (stable) note += '. Three successes: stable';
    return { successes: successes, failures: failures, revived: false, stable: stable, dead: dead, note: note };
  }

  root.Dice = {
    parse: parse, roll: roll, describe: describe, d20: d20, isValid: isValid, applyMode: applyMode, exprText: exprText, LIMITS: LIMITS,
    logEntry: logEntry, secretEntry: secretEntry, logView: logView, deathSave: deathSave,
  };
})(typeof window !== 'undefined' ? window : this);
