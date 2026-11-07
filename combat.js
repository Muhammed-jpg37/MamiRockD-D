/* ========================================================
   COMBAT (feature plan section 4): conditions, damage and
   healing, monsters on the table, encounter difficulty.
   No DOM; runs in the browser (window.Combat) and in Node.

   Conditions are kept as { blinded: true, ..., exhaustion: 2 }
   on a sheet (state.conditions, inventories/<id>/conditions)
   or on a token (vtt/<campaign>/tokens/<id>/conditions).
   Their rules text comes from rules/catalog/srd51-conditions.json.
   ======================================================== */
(function (root) {
  'use strict';

  /* ---------- 4.1 Conditions (SRD 5.1) ---------- */

  const CONDITIONS = [
    { id: 'blinded', name: 'Blinded', icon: '🕶️' },
    { id: 'charmed', name: 'Charmed', icon: '💞' },
    { id: 'deafened', name: 'Deafened', icon: '🔇' },
    { id: 'frightened', name: 'Frightened', icon: '😱' },
    { id: 'grappled', name: 'Grappled', icon: '🤼' },
    { id: 'incapacitated', name: 'Incapacitated', icon: '💫' },
    { id: 'invisible', name: 'Invisible', icon: '👻' },
    { id: 'paralyzed', name: 'Paralyzed', icon: '⚡' },
    { id: 'petrified', name: 'Petrified', icon: '🗿' },
    { id: 'poisoned', name: 'Poisoned', icon: '🤢' },
    { id: 'prone', name: 'Prone', icon: '🛌' },
    { id: 'restrained', name: 'Restrained', icon: '⛓️' },
    { id: 'stunned', name: 'Stunned', icon: '😵' },
    { id: 'unconscious', name: 'Unconscious', icon: '💤' },
    { id: 'exhaustion', name: 'Exhaustion', icon: '😩' },
  ];
  const BY_ID = {};
  CONDITIONS.forEach((c) => { BY_ID[c.id] = c; });

  // SRD 5.1 exhaustion levels (each includes the ones before it).
  const EXHAUSTION = [
    '',
    'Disadvantage on ability checks',
    'Speed halved',
    'Disadvantage on attack rolls and saving throws',
    'Hit point maximum halved',
    'Speed reduced to 0',
    'Death',
  ];

  // Only known conditions; true for the plain ones, 1..6 for exhaustion (0 drops it).
  function normalize(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => {
      if (!BY_ID[k]) return;
      if (k === 'exhaustion') {
        const n = Math.max(0, Math.min(6, Math.floor(Number(obj[k]) || 0)));
        if (n) out.exhaustion = n;
      } else if (obj[k]) out[k] = true;
    });
    return out;
  }

  function toggle(obj, id) {
    const out = normalize(obj);
    if (!BY_ID[id] || id === 'exhaustion') return out;
    if (out[id]) delete out[id]; else out[id] = true;
    return out;
  }

  function setExhaustion(obj, level) {
    const out = normalize(obj);
    const n = Math.max(0, Math.min(6, Math.floor(Number(level) || 0)));
    if (n) out.exhaustion = n; else delete out.exhaustion;
    return out;
  }

  // The active conditions in the SRD's order: [{ id, name, icon, level?, label }].
  function active(obj) {
    const c = normalize(obj);
    return CONDITIONS.filter((x) => c[x.id]).map((x) => {
      const e = Object.assign({}, x);
      if (x.id === 'exhaustion') { e.level = c.exhaustion; e.label = 'Exhaustion ' + c.exhaustion; e.effect = EXHAUSTION[c.exhaustion]; }
      else e.label = x.name;
      return e;
    });
  }

  // Short line for a tooltip: "Poisoned, Prone, Exhaustion 2".
  function summary(obj) {
    return active(obj).map((c) => c.label).join(', ');
  }

  /* ---------- 4.2 Damage and healing ---------- */

  // hp: { current, max, temp }. amount > 0 heals, < 0 damages. Damage takes temporary HP first;
  // healing never goes above max and does not restore temporary HP. Returns a new object.
  function applyHp(hp, amount) {
    const h = hp || {};
    const max = Math.max(0, Number(h.max) || 0);
    let cur = Math.max(0, Number(h.current !== undefined ? h.current : max) || 0);
    let temp = Math.max(0, Number(h.temp) || 0);
    const n = Math.round(Number(amount) || 0);
    if (n < 0) {
      let dmg = -n;
      const fromTemp = Math.min(temp, dmg);
      temp -= fromTemp;
      dmg -= fromTemp;
      cur = Math.max(0, cur - dmg);
    } else if (n > 0) {
      cur = max ? Math.min(max, cur + n) : cur + n;
    }
    const out = { current: cur, max: max };
    if (temp || h.temp !== undefined) out.temp = temp;
    return out;
  }

  /* ---------- 4.3 Monsters on the table ---------- */

  const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
  const signed = (n) => (n >= 0 ? '+' : '') + n;
  const SIZE_CELLS = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 };

  // "Goblin" with "Goblin 1", "Goblin 2" on the map -> "Goblin 3".
  function nextName(base, existing) {
    const used = new Set((existing || []).map((n) => String(n)));
    for (let i = 1; i < 1000; i++) if (!used.has(base + ' ' + i)) return base + ' ' + i;
    return base;
  }

  // What a monster token carries, from a catalog entry (rules/catalog/srd5*-monsters.json).
  // -> { name, size, hp: { current, max }, ac, monsterId: 'srd51:goblin', initBonus }
  function monsterToken(entry, existingNames) {
    const prefix = entry.ruleset === '2024' ? 'srd52' : 'srd51';
    const hp = Math.max(1, Number(entry.hp) || 1);
    return {
      name: nextName(entry.name, existingNames),
      size: SIZE_CELLS[String(entry.size || '').toLowerCase()] || 1,
      hp: { current: hp, max: hp },
      ac: Number(entry.ac) || 10,
      monsterId: prefix + ':' + entry.id,
      initBonus: mod(entry.abilities && entry.abilities.dex),
    };
  }

  // The rolls of one stat block action: { attack: '1d20+4' | null, damage: [{ expr, type }], dc: 'DC 13 Dexterity' | null }.
  function actionRolls(action) {
    const a = action || {};
    const n = Number(a.attack);
    const attack = a.attack !== undefined && a.attack !== null && isFinite(n) ? '1d20' + (n ? signed(n) : '') : null;
    const damage = (a.damage || []).filter((d) => d && d.dice).map((d) => ({ expr: String(d.dice).replace(/\s+/g, ''), type: String(d.type || '').toLowerCase() }));
    let dc = null;
    if (a.dc && (a.dc.value || a.dc.dc)) dc = 'DC ' + (a.dc.value || a.dc.dc) + (a.dc.ability || a.dc.type ? ' ' + (a.dc.ability || a.dc.type) : '');
    else { const m = String(a.desc || '').match(/DC (\d+) (\w+)/); if (m) dc = 'DC ' + m[1] + ' ' + m[2]; }
    return { attack: attack, damage: damage, dc: dc };
  }

  // Ability line of a stat block: [{ key: 'str', score: 8, mod: '-1' }, ...].
  function abilityLine(entry) {
    const ab = (entry && entry.abilities) || {};
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => ({ key: k, score: Number(ab[k]) || 10, mod: signed(mod(ab[k])) }));
  }

  /* ---------- 4.4 Encounter difficulty (2014 XP budget) ----------
     The 2014 rules' numbers for building encounters (XP thresholds per character level and the
     multiplier for the number of monsters); only the numbers are used here, no book text. */

  // [easy, medium, hard, deadly] per character level 1..20.
  const XP_THRESHOLDS = [null,
    [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
    [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800],
    [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400],
    [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
  ];
  const MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
  const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Deadly'];

  // "3, 3, 4, 2" or [3, 3, 4, 2] -> [3, 3, 4, 2] (levels 1..20 only).
  function partyLevels(input) {
    const list = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
    return list.map((x) => Math.floor(Number(x))).filter((n) => n >= 1 && n <= 20);
  }

  // Multiplier for the number of monsters, moved one step for small (< 3) or large (6+) parties.
  function multiplier(monsters, partySize) {
    const n = Math.max(0, Math.floor(Number(monsters) || 0));
    if (!n) return 1;
    let i = n === 1 ? 1 : n === 2 ? 2 : n <= 6 ? 3 : n <= 10 ? 4 : n <= 14 ? 5 : 6;
    if (partySize > 0 && partySize < 3) i += 1;
    else if (partySize >= 6) i -= 1;
    return MULTIPLIERS[Math.max(0, Math.min(MULTIPLIERS.length - 1, i))];
  }

  // lines: [{ xp, count }] (xp per monster). levels: party levels.
  // -> { monsters, xp (total), multiplier, adjusted, thresholds: { easy, medium, hard, deadly }, difficulty, perPlayer }
  function encounter(lines, levels) {
    const party = partyLevels(levels);
    let monsters = 0, xp = 0;
    (lines || []).forEach((l) => {
      const c = Math.max(0, Math.floor(Number(l.count) || 0));
      monsters += c;
      xp += c * (Number(l.xp) || 0);
    });
    const m = multiplier(monsters, party.length);
    const adjusted = Math.round(xp * m);
    const t = [0, 0, 0, 0];
    party.forEach((lv) => XP_THRESHOLDS[lv].forEach((v, i) => { t[i] += v; }));
    let difficulty = party.length ? 'Trivial' : '—';
    if (party.length) DIFFICULTIES.forEach((d, i) => { if (adjusted >= t[i]) difficulty = d; });
    if (!monsters) difficulty = '—';
    return {
      monsters: monsters, xp: xp, multiplier: m, adjusted: adjusted,
      thresholds: { easy: t[0], medium: t[1], hard: t[2], deadly: t[3] },
      difficulty: difficulty,
      perPlayer: party.length ? Math.floor(xp / party.length) : 0,
    };
  }

  root.Combat = {
    CONDITIONS: CONDITIONS, EXHAUSTION: EXHAUSTION, byId: (id) => BY_ID[id] || null,
    normalize: normalize, toggle: toggle, setExhaustion: setExhaustion, active: active, summary: summary,
    applyHp: applyHp,
    nextName: nextName, monsterToken: monsterToken, actionRolls: actionRolls, abilityLine: abilityLine, SIZE_CELLS: SIZE_CELLS,
    XP_THRESHOLDS: XP_THRESHOLDS, partyLevels: partyLevels, multiplier: multiplier, encounter: encounter,
  };
})(typeof window !== 'undefined' ? window : this);
