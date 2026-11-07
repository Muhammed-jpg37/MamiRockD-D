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

  root.Combat = {
    CONDITIONS: CONDITIONS, EXHAUSTION: EXHAUSTION, byId: (id) => BY_ID[id] || null,
    normalize: normalize, toggle: toggle, setExhaustion: setExhaustion, active: active, summary: summary,
    applyHp: applyHp,
  };
})(typeof window !== 'undefined' ? window : this);
