/* ========================================================
   CHARACTER BUILDER (wizard UI)
   Steps: Class → Origin → Abilities → Choices → Equipment →
   Details → Review, or Quick Build (species, class, name; the
   rest filled in sensibly). Uses character-engine.js for every
   number and every rule, so the wizard never computes on its own.

   CharacterBuilder.open({
     rules,                      // RULES_SRD5, or mergeRules(SRD, campaign homebrew)
     opts: { allowManual, strict },   // campaign settings for validate()
     build,                      // optional: start from an existing build
     initialName,                // optional: prefilled character name
     editing,                    // true: changing an existing character (no equipment step)
     notice,                     // optional: [text] shown above the review
     onDone(result),             // { build, derived, equipment: { mode, picks, gold } }
     onCancel()
   })
   ======================================================== */
(function (root) {
  'use strict';

  const STEPS = [
    { id: 'class', label: 'Class' },
    { id: 'origin', label: 'Origin' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'choices', label: 'Choices' },
    { id: 'spells', label: 'Spells' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'details', label: 'Details' },
    { id: 'review', label: 'Review' }
  ];

  // Which abilities matter most per class: suggested standard array order and Quick Build.
  const PRIORITY = {
    barbarian: ['str', 'con', 'dex', 'wis', 'cha', 'int'], bard: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
    cleric: ['wis', 'con', 'str', 'dex', 'cha', 'int'], druid: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
    fighter: ['str', 'con', 'dex', 'wis', 'int', 'cha'], monk: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
    paladin: ['str', 'cha', 'con', 'wis', 'dex', 'int'], ranger: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
    rogue: ['dex', 'con', 'int', 'wis', 'cha', 'str'], sorcerer: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
    warlock: ['cha', 'con', 'dex', 'wis', 'int', 'str'], wizard: ['int', 'con', 'dex', 'wis', 'cha', 'str']
  };
  const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];
  const PORTRAIT_MAX = 256;

  // Which wizard step an engine issue belongs to.
  function stepOfIssue(issue) {
    const p = issue.path || '';
    if (p.startsWith('choices.spells')) return 'spells';
    if (/^classes\.\d+\.(subclass|hp)/.test(p) || p.startsWith('choices')) return 'choices';
    if (p.startsWith('classes') || p === 'ruleset') return 'class';
    if (p.startsWith('species') || p.startsWith('subrace') || p.startsWith('background')) return 'origin';
    if (p.startsWith('abilities')) return 'abilities';
    return 'review';
  }

  /* ---------- Tiny DOM helper ---------- */

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(children || []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }

  const signed = (n) => (n >= 0 ? '+' : '') + n;

  function injectStyles() {
    if (document.getElementById('char-builder-styles')) return;
    const style = document.createElement('style');
    style.id = 'char-builder-styles';
    style.textContent = `
      #char-builder { position: fixed; inset: 0; z-index: 99996; display: flex; align-items: flex-start; justify-content: center; padding: 20px 12px; overflow-y: auto; background: rgba(0,0,0,0.72); backdrop-filter: blur(4px); }
      #char-builder * { box-sizing: border-box; }
      .cb-card { width: 100%; max-width: 900px; background: var(--panel); color: var(--text); border: 2px solid var(--border-bright); border-radius: 12px; box-shadow: 0 0 50px rgba(0,0,0,.9); font-family: var(--font-body); display: flex; flex-direction: column; }
      .cb-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px 8px; }
      .cb-title { font-family: var(--font-display); font-size: 20px; letter-spacing: 1px; color: var(--accent-strong); }
      .cb-steps { display: flex; gap: 4px; padding: 0 14px 10px; flex-wrap: wrap; border-bottom: 1px solid var(--border); }
      .cb-step { flex: 1 1 auto; min-width: 88px; padding: 6px 8px; font-family: var(--font-display); font-size: 11px; letter-spacing: .5px; text-transform: uppercase; background: var(--surface-2); color: var(--text-dim); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; }
      .cb-step.on { color: var(--accent-strong); border-color: var(--accent); }
      .cb-step .cb-dot { margin-left: 4px; }
      .cb-step.done .cb-dot { color: var(--success); }
      .cb-step.todo .cb-dot { color: var(--warn); }
      .cb-body { padding: 16px 18px; min-height: 360px; }
      .cb-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border); }
      .cb-h { font-family: var(--font-display); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); margin: 14px 0 6px; }
      .cb-h:first-child { margin-top: 0; }
      .cb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
      .cb-opt { text-align: left; padding: 10px; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; font-family: var(--font-body); display: flex; flex-direction: column; gap: 3px; }
      .cb-opt:hover { border-color: var(--line-strong); background: var(--surface-3); }
      .cb-opt.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
      .cb-opt b { font-family: var(--font-display); color: var(--accent-strong); font-size: 14px; }
      .cb-opt small { color: var(--text-dim); font-size: 11px; }
      .cb-hb { color: var(--info); font-size: 10px; text-transform: uppercase; }
      .cb-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
      .cb-input, .cb-select { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 8px; font-family: var(--font-body); font-size: 14px; }
      .cb-input.wide { width: 100%; }
      textarea.cb-input { min-height: 90px; resize: vertical; width: 100%; }
      .cb-checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 4px 12px; }
      .cb-check { display: flex; gap: 6px; align-items: center; font-size: 14px; }
      .cb-check.dim { opacity: .5; }
      .cb-note { font-size: 12px; color: var(--text-muted); margin: 4px 0; }
      .cb-abil { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
      .cb-abil > div { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 6px; text-align: center; display: flex; flex-direction: column; gap: 4px; align-items: center; }
      .cb-abil .cb-ab { font-family: var(--font-display); font-size: 12px; color: var(--text-dim); }
      .cb-abil .cb-score { font-family: var(--font-mono); font-size: 22px; color: var(--text); }
      .cb-abil .cb-mod { font-family: var(--font-mono); font-size: 12px; color: var(--accent-strong); }
      .cb-abil .cb-plus { font-size: 11px; color: var(--success); }
      .cb-abil .cb-select, .cb-abil .cb-input { width: 100%; text-align: center; padding: 4px; }
      .cb-pm { display: flex; gap: 4px; }
      .cb-pm .btn { padding: 1px 8px; min-width: 0; }
      .cb-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
      .cb-tabs .btn.on { border-color: var(--accent); color: var(--accent-strong); }
      .cb-issues { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
      .cb-issue { font-size: 13px; padding: 6px 10px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface-2); display: flex; justify-content: space-between; gap: 8px; align-items: center; }
      .cb-issue.error { border-color: color-mix(in srgb, var(--danger) 60%, transparent); }
      .cb-issue.warning { border-color: color-mix(in srgb, var(--warn) 60%, transparent); }
      .cb-sum { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
      .cb-sum > div { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; }
      .cb-sum small { display: block; font-size: 11px; color: var(--text-dim); text-transform: uppercase; }
      .cb-sum b { font-family: var(--font-mono); font-size: 18px; }
      .cb-list { font-size: 13px; line-height: 1.6; color: var(--text); }
      .cb-portrait { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent); background: var(--surface-inset); }
      .cb-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .cb-opt:disabled { opacity: .45; cursor: not-allowed; }
      .cb-gain { color: var(--success); }
      .cb-spells { margin-bottom: 8px; }
      .cb-count { font-family: var(--font-mono); font-size: 12px; color: var(--warn); }
      .cb-count.ok { color: var(--success); }
      .cb-sublvl { font-size: 11px; color: var(--accent-2-strong); text-transform: uppercase; letter-spacing: .5px; margin: 8px 0 2px; }
      .cb-spellclass { color: var(--accent-strong); font-size: 13px; border-top: 1px solid var(--border); padding-top: 10px; }
      .cb-spellclass:first-child { border-top: 0; padding-top: 0; }
      @media (max-width: 640px) {
        .cb-abil { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .cb-two { grid-template-columns: 1fr; }
        .cb-step { min-width: 0; font-size: 10px; padding: 5px; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------- Small form helpers ---------- */

  // Checkbox list limited to `max` ticks; `disabled` ids can't be ticked (already proficient).
  function checks(options, selected, max, onChange, disabled) {
    const sel = new Set(selected || []);
    const off = new Set(disabled || []);
    return h('div', { class: 'cb-checks' }, options.map((o) => {
      const isOff = off.has(o.id) && !sel.has(o.id);
      const full = sel.size >= max && !sel.has(o.id);
      return h('label', { class: 'cb-check' + (isOff || full ? ' dim' : '') }, [
        h('input', { type: 'checkbox', checked: sel.has(o.id), disabled: isOff || full, onchange: (e) => {
          if (e.target.checked) sel.add(o.id); else sel.delete(o.id);
          onChange(Array.from(sel));
        } }), o.label + (off.has(o.id) ? ' ✓' : '')
      ]);
    }));
  }

  function select(options, value, placeholder, onChange) {
    return h('select', { class: 'cb-select', onchange: (e) => onChange(e.target.value || null) },
      [h('option', { value: '', text: placeholder })].concat(options.map((o) => h('option', { value: o.value, text: o.label, selected: o.value === value }))));
  }

  /* ---------- Spell picks (wizard step and level up) ----------
     Asks for everything engine.spellLimits() says the build has: the land (Circle of the
     Land), cantrips, spells known or the spellbook, Mystic Arcanum, Lore's extra secrets and
     the species cantrip. Only shown when the rules carry spell data (engine.attachSpells). */

  const ORD = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

  // A list of spells to tick, grouped by level, with a search box; at most `max` ticked.
  // `locked` ids are shown ticked but can't be changed (always-prepared spells).
  function spellChecks(rules, ids, selected, max, onChange, state) {
    const sel = new Set(selected || []);
    const box = h('div', { class: 'cb-spells' });
    const q = (state.q || '').toLowerCase();
    const shown = ids.filter((id) => sel.has(id) || !q || rules.spells[id].name.toLowerCase().includes(q));
    const head = h('div', { class: 'cb-row' }, [
      h('span', { class: 'cb-count' + (sel.size === max ? ' ok' : ''), text: sel.size + ' / ' + max + ' chosen' }),
      ids.length > 12 ? h('input', { class: 'cb-input', placeholder: '🔍 Search', value: state.q || '', style: 'flex:1;min-width:140px', oninput: (e) => {
        state.q = e.target.value;
        const pos = e.target.selectionStart;
        const fresh = spellChecks(rules, ids, Array.from(sel), max, onChange, state);
        box.replaceWith(fresh);
        const inp = fresh.querySelector('input.cb-input');
        if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
      } }) : null
    ]);
    box.appendChild(head);
    let lvl = -1;
    let grid = null;
    shown.forEach((id) => {
      const s = rules.spells[id];
      if (s.level !== lvl) {
        lvl = s.level;
        box.appendChild(h('div', { class: 'cb-sublvl', text: lvl === 0 ? ORD[0] : ORD[lvl] + ' level' }));
        grid = h('div', { class: 'cb-checks' });
        box.appendChild(grid);
      }
      const full = sel.size >= max && !sel.has(id);
      grid.appendChild(h('label', { class: 'cb-check' + (full ? ' dim' : ''), title: (s.desc || [])[0] || '' }, [
        h('input', { type: 'checkbox', checked: sel.has(id), disabled: full, onchange: (e) => {
          if (e.target.checked) sel.add(id); else sel.delete(id);
          onChange(Array.from(sel));
        } }),
        s.name + (s.ritual ? ' ®' : '') + (s.concentration ? ' ©' : '')
      ]));
    });
    if (!shown.length) box.appendChild(h('div', { class: 'cb-note', text: 'No spell matches.' }));
    return box;
  }

  // Renders the spell picks for every caster class (or only `onlyClass`) and the species.
  // ui: a per-dialog object that keeps search texts between renders. Returns false when there
  // is nothing to ask.
  function renderSpellPicks(body, E, rules, build, render, ui, onlyClass) {
    if (!rules.spells) return false;
    build.choices.spells = build.choices.spells || {};
    const picks = build.choices.spells;
    const names = (ids) => ids.map((id) => (rules.spells[id] || { name: id }).name).join(', ');
    let asked = false;
    E.spellLimits(build, rules).forEach((l) => {
      if (onlyClass && l.classId !== onlyClass) return;
      const p = picks[l.classId] = picks[l.classId] || {};
      const set = (k, v) => { p[k] = v; render(); };
      const key = (k) => { ui[l.classId + k] = ui[l.classId + k] || {}; return ui[l.classId + k]; };
      const sub = (t) => body.appendChild(h('div', { class: 'cb-h', text: t }));
      const facts = [];
      if (l.maxSpellLevel) facts.push('Spells up to ' + ORD[l.maxSpellLevel] + ' level');
      if (l.prepared !== null) facts.push('prepares ' + l.prepared + ' spell' + (l.prepared === 1 ? '' : 's') + ' a day' + (l.preparedFrom === 'spellbook' ? ' from the spellbook' : ' from the whole ' + l.name + ' list') + ' (in the Spells tab)');
      if (l.ritual) facts.push('ritual casting');
      body.appendChild(h('div', { class: 'cb-h cb-spellclass', text: '✨ ' + l.name + ' ' + l.level + (l.subclassName ? ' · ' + l.subclassName : '') }));
      body.appendChild(h('div', { class: 'cb-note', text: (facts.join(' · ') || 'No spells yet at this level.') + '.' }));

      if (l.lands) {
        asked = true;
        sub('Your land (Circle Spells)');
        const circle = rules.classes[l.classId].subclasses[(build.classes.find((c) => c.id === l.classId) || {}).subclass].circleSpells;
        body.appendChild(select(l.lands.map((k) => ({ value: k, label: circle[k].name })), p.land, 'Choose…', (v) => set('land', v)));
      }
      if (l.cantrips) {
        asked = true;
        sub('Cantrips: ' + l.cantrips);
        body.appendChild(spellChecks(rules, E.spellOptions(build, rules, l.classId, 'cantrips'), p.cantrips, l.cantrips, (v) => set('cantrips', v), key('c')));
      }
      if (l.known) {
        asked = true;
        sub('Spells known: ' + l.known);
        if (l.secrets) body.appendChild(h('div', { class: 'cb-note', text: 'Magical Secrets: up to ' + l.secrets + ' of these may come from any class.' }));
        if (l.replaceOnLevelUp) body.appendChild(h('div', { class: 'cb-note', text: 'When you gain a ' + l.name + ' level you may swap one of these for another.' }));
        body.appendChild(spellChecks(rules, E.spellOptions(build, rules, l.classId, 'known'), p.known, l.known, (v) => set('known', v), key('k')));
      }
      if (l.spellbook !== null) {
        asked = true;
        sub('Spellbook: ' + l.spellbook + ' spells');
        body.appendChild(h('div', { class: 'cb-note', text: 'Six 1st-level spells at level 1, then two per wizard level. Spells you copy from scrolls later go in the Spells tab.' }));
        body.appendChild(spellChecks(rules, E.spellOptions(build, rules, l.classId, 'spellbook'), p.spellbook, Math.max(l.spellbook, (p.spellbook || []).length), (v) => set('spellbook', v), key('b')));
      }
      l.arcanum.forEach((sl) => {
        asked = true;
        sub('Mystic Arcanum: one ' + ORD[sl] + '-level spell');
        p.arcanum = p.arcanum || {};
        body.appendChild(select(E.spellOptions(build, rules, l.classId, 'arcanum:' + sl).map((id) => ({ value: id, label: rules.spells[id].name })), p.arcanum[sl], 'Choose…', (v) => { p.arcanum[sl] = v; render(); }));
      });
      if (l.extraSecrets) {
        asked = true;
        sub('Additional Magical Secrets: ' + l.extraSecrets + ' (any class)');
        body.appendChild(spellChecks(rules, E.spellOptions(build, rules, l.classId, 'secrets').filter((id) => !(p.known || []).includes(id)), p.secrets, l.extraSecrets, (v) => set('secrets', v), key('s')));
      }
      if (l.alwaysPrepared.length) body.appendChild(h('div', { class: 'cb-note', text: 'Always prepared (' + l.subclassName + '): ' + names(l.alwaysPrepared) + '.' }));
      if (l.expanded.length) body.appendChild(h('div', { class: 'cb-note', text: l.subclassName + ' adds to your list: ' + names(l.expanded) + '.' }));
    });
    if (!onlyClass || onlyClass === 'species') {
      const sp = E.speciesSpells(build, rules);
      if (sp.cantrips || sp.innate.length) body.appendChild(h('div', { class: 'cb-h cb-spellclass', text: '✨ Species spells' + (sp.ability ? ' (' + sp.ability.toUpperCase() + ')' : '') }));
      if (sp.cantrips) {
        asked = true;
        picks.species = picks.species || {};
        body.appendChild(spellChecks(rules, E.spellOptions(build, rules, 'species'), picks.species.cantrips, sp.cantrips.choose, (v) => { picks.species.cantrips = v; render(); }, (ui.species = ui.species || {})));
      }
      if (sp.innate.length) body.appendChild(h('div', { class: 'cb-note', text: 'Innate: ' + sp.innate.map((x) => (rules.spells[x.spell] || { name: x.spell }).name + (x.per ? ' (once per ' + x.per + (x.castAt ? ', as level ' + x.castAt : '') + ')' : '')).join(', ') + '.' }));
    }
    return asked;
  }

  // Fills empty spell picks with the first options (Quick Build).
  function autoSpells(E, rules, build) {
    if (!rules.spells) return;
    build.choices.spells = build.choices.spells || {};
    const picks = build.choices.spells;
    E.spellLimits(build, rules).forEach((l) => {
      const p = picks[l.classId] = picks[l.classId] || {};
      if (l.lands && !p.land) p.land = l.lands[0];
      if (l.cantrips && !(p.cantrips || []).length) p.cantrips = E.spellOptions(build, rules, l.classId, 'cantrips').slice(0, l.cantrips);
      // Class-list spells first (Magical Secrets are a deliberate pick), lowest level first.
      const own = (id) => (rules.spells[id].classes || []).includes(l.classId);
      if (l.known && !(p.known || []).length) p.known = E.spellOptions(build, rules, l.classId, 'known').filter(own).slice(0, l.known);
      if (l.spellbook && !(p.spellbook || []).length) p.spellbook = E.spellOptions(build, rules, l.classId, 'spellbook').slice(0, l.spellbook);
      l.arcanum.forEach((sl) => { p.arcanum = p.arcanum || {}; if (!p.arcanum[sl]) p.arcanum[sl] = E.spellOptions(build, rules, l.classId, 'arcanum:' + sl)[0]; });
      if (l.extraSecrets && !(p.secrets || []).length) p.secrets = E.spellOptions(build, rules, l.classId, 'secrets').filter((id) => !(p.known || []).includes(id)).slice(0, l.extraSecrets);
    });
    const sp = E.speciesSpells(build, rules);
    if (sp.cantrips) {
      picks.species = picks.species || {};
      // Not a cantrip the class already gives.
      const have = new Set();
      Object.keys(picks).forEach((k) => { if (k !== 'species') (picks[k].cantrips || []).forEach((id) => have.add(id)); });
      if (!(picks.species.cantrips || []).length) picks.species.cantrips = E.spellOptions(build, rules, 'species').filter((id) => !have.has(id)).slice(0, sp.cantrips.choose);
    }
  }

  function slotText(sc) {
    const s = Object.keys(sc.slots).map((l) => l + ': ' + sc.slots[l]).join(' · ');
    return s + (sc.pact ? (s ? ' · ' : '') + 'Pact: ' + sc.pact.slots + ' × level ' + sc.pact.level : '');
  }

  /* ---------- The wizard ---------- */

  function open(config) {
    const E = root.CharacterEngine;
    const rules = config.rules || root.RULES_SRD5;
    const opts = config.opts || {};
    if (!E || !rules) throw new Error('CharacterBuilder needs character-engine.js and the rules');
    injectStyles();
    close();

    const st = {
      build: config.build ? JSON.parse(JSON.stringify(config.build)) : E.newBuild(rules),
      step: config.build ? 'review' : 'class',
      quick: false,
      hpMode: 'average',
      equipment: { mode: 'pack', picks: {}, gold: null },
      rollPool: null
    };
    const b = () => st.build;
    if (!config.build && config.initialName) b().name = String(config.initialName).slice(0, 40);
    // An existing character keeps its gear, so there is no equipment step when editing.
    // The Spells step needs spell data on the rules.
    const steps = STEPS.filter((s) => !(config.editing && s.id === 'equipment') && !(s.id === 'spells' && !rules.spells));
    b().choices = Object.assign({ skills: {}, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {}, spells: {} }, b().choices || {});
    const spellUi = {};
    b().speciesChoices = b().speciesChoices || {};
    b().backgroundChoices = b().backgroundChoices || {};
    b().details = b().details || {};

    const cls = () => (b().classes[0] && rules.classes[b().classes[0].id]) ? b().classes[0] : null;
    const clsDef = () => cls() ? rules.classes[cls().id] : null;
    const validation = () => E.validate(b(), rules, opts);

    const wrap = h('div', { id: 'char-builder' });
    const card = h('div', { class: 'cb-card', role: 'dialog', 'aria-label': 'Character builder' });
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    function stepStatus() {
      const v = validation();
      const byStep = {};
      v.issues.forEach((i) => { if (i.level === 'error') (byStep[stepOfIssue(i)] = byStep[stepOfIssue(i)] || []).push(i); });
      if (!String(b().name || '').trim()) (byStep.details = byStep.details || []).push({ message: 'Give your character a name.' });
      // Without a class these steps have nothing to show yet, so they aren't done either.
      if (!cls()) ['choices', 'spells', 'equipment'].forEach((s) => { (byStep[s] = byStep[s] || []).push({ message: 'Choose a class first.' }); });
      return { v: v, byStep: byStep };
    }

    function render() {
      const { v, byStep } = stepStatus();
      card.innerHTML = '';
      card.appendChild(h('div', { class: 'cb-head' }, [
        h('div', { class: 'cb-title', text: st.quick ? '⚡ QUICK BUILD' : '⚔ CHARACTER BUILDER' }),
        h('div', { class: 'cb-row', style: 'margin:0' }, [
          st.step !== 'review' && !st.quick ? h('button', { type: 'button', class: 'btn ghost small', text: '⚡ Quick Build', title: 'Pick species, class and name; the rest is filled in for you', onclick: () => { st.quick = true; render(); } }) : null,
          h('button', { type: 'button', class: 'btn ghost small', text: '✕', title: 'Close without saving', onclick: cancel })
        ])
      ]));
      if (!st.quick) {
        card.appendChild(h('div', { class: 'cb-steps' }, steps.map((s) => {
          const todo = s.id !== 'review' && byStep[s.id] && byStep[s.id].length;
          return h('button', { type: 'button', class: 'cb-step' + (st.step === s.id ? ' on' : '') + (s.id === 'review' ? '' : todo ? ' todo' : ' done'), onclick: () => { st.step = s.id; render(); } },
            [s.label, s.id === 'review' ? null : h('span', { class: 'cb-dot', text: todo ? '●' : '✓' })]);
        })));
      }
      const body = h('div', { class: 'cb-body' });
      card.appendChild(body);
      // e.g. what a conversion from an old sheet assumed
      if (st.step === 'review' && !st.quick && (config.notice || []).length) {
        body.appendChild(h('div', { class: 'cb-issues', style: 'margin:0 0 12px' }, config.notice.map((n) => h('div', { class: 'cb-issue warning' }, [h('span', { text: 'ℹ ' + n })]))));
      }
      (st.quick ? renderQuick : ({ class: renderClass, origin: renderOrigin, abilities: renderAbilities, choices: renderChoices, spells: renderSpells, equipment: renderEquipment, details: renderDetails, review: renderReview })[st.step])(body, v);

      const idx = steps.findIndex((s) => s.id === st.step);
      const foot = h('div', { class: 'cb-foot' });
      if (st.quick) {
        foot.append(
          h('button', { type: 'button', class: 'btn ghost small', text: '← Full builder', onclick: () => { st.quick = false; render(); } }),
          h('button', { type: 'button', class: 'btn small', text: 'Fill in & review →', disabled: !(b().species && cls() && String(b().name || '').trim()), onclick: () => { quickFill(); st.quick = false; st.step = 'review'; render(); } })
        );
      } else {
        foot.append(
          h('button', { type: 'button', class: 'btn ghost small', text: '← Back', disabled: idx === 0, onclick: () => { st.step = steps[Math.max(0, idx - 1)].id; render(); } }),
          st.step === 'review'
            ? h('button', { type: 'button', class: 'btn small', text: config.editing ? '💾 Save changes' : '✨ Create character', disabled: !(v.ok && String(b().name || '').trim()), onclick: finish })
            : h('button', { type: 'button', class: 'btn small', text: 'Next →', onclick: () => { st.step = steps[idx + 1].id; render(); } })
        );
      }
      card.appendChild(foot);
    }

    /* --- Step: Class --- */
    function renderClass(body) {
      body.appendChild(h('div', { class: 'cb-h', text: 'Choose a class' }));
      body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(rules.classes).map((id) => {
        const c = rules.classes[id];
        const cast = c.spellcasting ? (c.spellcasting.progression === 'pact' ? 'Pact magic' : c.spellcasting.progression === 'half' ? 'Half caster' : 'Spellcaster') + ' (' + c.spellcasting.ability.toUpperCase() + ')' : 'No spells';
        return h('button', { type: 'button', class: 'cb-opt' + (cls() && cls().id === id ? ' on' : ''), onclick: () => setClass(id) }, [
          h('b', { text: c.name }), h('small', { text: 'd' + c.hitDie + ' hit die · saves ' + c.saves.map((s) => s.toUpperCase()).join('/') }), h('small', { text: cast }),
          c.homebrew ? h('span', { class: 'cb-hb', text: 'homebrew' }) : null
        ]);
      })));
      if (cls()) {
        body.appendChild(h('div', { class: 'cb-h', text: 'Starting level' }));
        const sel = h('select', { class: 'cb-select', onchange: (e) => setLevel(Number(e.target.value)) },
          Array.from({ length: 20 }, (_, i) => h('option', { value: i + 1, selected: cls().level === i + 1, text: 'Level ' + (i + 1) })));
        body.appendChild(h('div', { class: 'cb-row' }, [sel, h('span', { class: 'cb-note', text: 'Most campaigns start at level 1. Higher levels ask for more choices (subclass, ability score improvements).' })]));
      }
    }

    function setClass(id) {
      const level = cls() ? cls().level : 1;
      b().classes = [{ id: id, level: level, subclass: null, hp: [] }];
      // Everything tied to the old class goes.
      Object.assign(b().choices, { skills: {}, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {}, spells: {} });
      applyHpMode();
      render();
    }

    function setLevel(level) {
      if (!cls()) return;
      cls().level = level;
      const def = clsDef();
      if (level < def.subclassLevel) { cls().subclass = null; b().choices.subclassSkills = {}; }
      // Drop choices for levels no longer reached.
      Object.keys(b().choices.asi).forEach((k) => { if (Number(k.split(':')[1]) > level) delete b().choices.asi[k]; });
      Object.keys(b().choices.fightingStyles).forEach((k) => { if (Number(k.split(':')[1]) > level) delete b().choices.fightingStyles[k]; });
      let due = 0;
      Object.keys(def.expertise || {}).forEach((l) => { if (Number(l) <= level) due += def.expertise[l]; });
      b().choices.expertise = b().choices.expertise.slice(0, due);
      applyHpMode();
      render();
    }

    /* --- Step: Origin --- */
    function renderOrigin(body) {
      body.appendChild(h('div', { class: 'cb-h', text: 'Species' }));
      body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(rules.species).map((id) => {
        const s = rules.species[id];
        const bonus = Object.keys(s.abilityBonuses || {}).map((a) => a.toUpperCase() + ' +' + s.abilityBonuses[a]).join(', ') + (s.abilityChoice ? ', +' + s.abilityChoice.amount + ' ×' + s.abilityChoice.count + ' of choice' : '');
        return h('button', { type: 'button', class: 'cb-opt' + (b().species === id ? ' on' : ''), onclick: () => { b().species = id; b().subrace = null; b().speciesChoices = {}; render(); } }, [
          h('b', { text: s.name }), h('small', { text: bonus }), h('small', { text: s.size + ' · speed ' + s.speed + ' ft' }),
          s.homebrew ? h('span', { class: 'cb-hb', text: 'homebrew' }) : null
        ]);
      })));

      const sp = b().species && rules.species[b().species];
      if (sp) {
        const sc = b().speciesChoices;
        if (sp.subraces && Object.keys(sp.subraces).length) {
          body.appendChild(h('div', { class: 'cb-h', text: sp.name + ' subrace' }));
          body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(sp.subraces).map((id) => {
            const s = sp.subraces[id];
            return h('button', { type: 'button', class: 'cb-opt' + (b().subrace === id ? ' on' : ''), onclick: () => { b().subrace = id; render(); } },
              [h('b', { text: s.name }), h('small', { text: Object.keys(s.abilityBonuses || {}).map((a) => a.toUpperCase() + ' +' + s.abilityBonuses[a]).join(', ') }), h('small', { text: (s.traits || []).join(', ') })]);
          })));
        }
        body.appendChild(h('div', { class: 'cb-note', text: 'Traits: ' + [].concat(sp.traits || []).join(', ') + (sp.senses ? ' · ' + sp.senses : '') }));
        if (sp.abilityChoice) {
          body.appendChild(h('div', { class: 'cb-h', text: '+' + sp.abilityChoice.amount + ' to ' + sp.abilityChoice.count + ' abilities' }));
          body.appendChild(checks(E.ABILITIES.filter((a) => !(sp.abilityChoice.exclude || []).includes(a)).map((a) => ({ id: a, label: rules.abilityNames[a] })), sc.abilities || [], sp.abilityChoice.count, (v) => { sc.abilities = v; render(); }));
        }
        if (sp.skillChoice) {
          body.appendChild(h('div', { class: 'cb-h', text: 'Choose ' + sp.skillChoice.choose + ' skills (' + sp.name + ')' }));
          body.appendChild(checks(skillOptions('any'), sc.skills || [], sp.skillChoice.choose, (v) => { sc.skills = v; render(); }));
        }
        if (sp.ancestry) {
          body.appendChild(h('div', { class: 'cb-h', text: 'Draconic ancestry' }));
          body.appendChild(select(Object.keys(sp.ancestry).map((k) => ({ value: k, label: sp.ancestry[k].name + ' — ' + sp.ancestry[k].damage + ', ' + sp.ancestry[k].breath })), sc.ancestry, 'Choose…', (v) => { sc.ancestry = v; render(); }));
        }
        if (sp.toolChoice) {
          body.appendChild(h('div', { class: 'cb-h', text: 'Tool proficiency' }));
          body.appendChild(select(sp.toolChoice.map((t) => ({ value: t, label: t })), sc.tool, 'Choose…', (v) => { sc.tool = v; render(); }));
        }
        const extra = (sp.extraLanguages || 0) + ((b().subrace && sp.subraces && sp.subraces[b().subrace] && sp.subraces[b().subrace].extraLanguages) || 0);
        if (extra) languageInputs(body, 'Extra language' + (extra > 1 ? 's' : '') + ' (' + sp.name + ')', sc, extra);
      }

      body.appendChild(h('div', { class: 'cb-h', text: 'Background' }));
      body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(rules.backgrounds).map((id) => {
        const bg = rules.backgrounds[id];
        return h('button', { type: 'button', class: 'cb-opt' + (b().background === id ? ' on' : ''), onclick: () => { b().background = id; b().backgroundChoices = {}; render(); } }, [
          h('b', { text: bg.name }), h('small', { text: 'Skills: ' + (bg.skills || []).map((s) => (rules.skills[s] || { name: s }).name).join(', ') }),
          bg.feature ? h('small', { text: 'Feature: ' + bg.feature }) : null, bg.homebrew ? h('span', { class: 'cb-hb', text: 'homebrew' }) : null
        ]);
      })));
      body.appendChild(h('div', { class: 'cb-note', text: 'The SRD has one background. Your DM can add more as campaign homebrew.' }));
      const bg = b().background && rules.backgrounds[b().background];
      if (bg && bg.extraLanguages) languageInputs(body, 'Languages (' + bg.name + ')', b().backgroundChoices, bg.extraLanguages);
    }

    function languageInputs(body, title, holder, count) {
      body.appendChild(h('div', { class: 'cb-h', text: title }));
      holder.languages = holder.languages || [];
      body.appendChild(h('div', { class: 'cb-row' }, Array.from({ length: count }, (_, i) => h('input', {
        class: 'cb-input', placeholder: 'e.g. Elvish', value: holder.languages[i] || '', maxlength: 30,
        oninput: (e) => { holder.languages[i] = e.target.value.trim(); holder.languages = holder.languages.filter((x, j) => j < count); }
      }))));
    }

    /* --- Step: Abilities --- */
    function renderAbilities(body) {
      const ab = b().abilities;
      const methods = [['standardArray', 'Standard array'], ['pointBuy', 'Point buy'], ['roll', 'Roll 4d6']];
      if (opts.allowManual) methods.push(['manual', 'Type them in']);
      body.appendChild(h('div', { class: 'cb-tabs' }, methods.map(([m, label]) => h('button', {
        type: 'button', class: 'btn ghost small' + (ab.method === m ? ' on' : ''), text: label,
        onclick: () => { setMethod(m); render(); }
      }))));

      const scores = E.abilityScores(b(), rules);
      const grid = h('div', { class: 'cb-abil' });
      E.ABILITIES.forEach((a) => {
        const cell = h('div', {}, [h('div', { class: 'cb-ab', text: rules.abilityNames[a] })]);
        if (ab.method === 'standardArray' || ab.method === 'roll') {
          const pool = ab.method === 'roll' ? (st.rollPool || []) : rules.abilityMethods.standardArray;
          cell.appendChild(assignSelect(a, pool));
        } else if (ab.method === 'pointBuy') {
          cell.appendChild(h('div', { class: 'cb-score', text: ab.base[a] }));
          cell.appendChild(h('div', { class: 'cb-pm' }, [
            h('button', { type: 'button', class: 'btn ghost small', text: '−', disabled: ab.base[a] <= rules.abilityMethods.pointBuy.min, onclick: () => { ab.base[a]--; render(); } }),
            h('button', { type: 'button', class: 'btn ghost small', text: '+', disabled: ab.base[a] >= rules.abilityMethods.pointBuy.max || !canAfford(a), onclick: () => { ab.base[a]++; render(); } })
          ]));
        } else {
          cell.appendChild(h('input', { class: 'cb-input', type: 'number', min: rules.abilityMethods.manual.min, max: rules.abilityMethods.manual.max, value: ab.base[a], onchange: (e) => { ab.base[a] = Number(e.target.value) || 10; render(); } }));
        }
        const bonus = scores.racial[a];
        if (bonus) cell.appendChild(h('div', { class: 'cb-plus', text: signed(bonus) + ' species' }));
        cell.appendChild(h('div', { class: 'cb-mod', text: '= ' + scores.scores[a] + ' (' + signed(E.mod(scores.scores[a])) + ')' }));
        grid.appendChild(cell);
      });
      body.appendChild(grid);

      if (ab.method === 'pointBuy') {
        const spent = E.pointBuyCost(ab.base, rules);
        body.appendChild(h('div', { class: 'cb-note', text: 'Points: ' + (spent === null ? '?' : spent) + ' / ' + rules.abilityMethods.pointBuy.budget + ' spent. Scores ' + rules.abilityMethods.pointBuy.min + '–' + rules.abilityMethods.pointBuy.max + ' before species bonuses.' }));
      }
      if (ab.method === 'roll') {
        body.appendChild(h('div', { class: 'cb-row' }, [
          h('button', { type: 'button', class: 'btn small', text: st.rollPool ? '🎲 Roll again' : '🎲 Roll 4d6 ×6', onclick: () => {
            if (st.rollPool && !confirm('Roll all six again?')) return;
            st.rollPool = E.rollAbilityScores();
            ab.rolls = st.rollPool.slice();
            E.ABILITIES.forEach((x) => { ab.base[x] = null; });
            render();
          } }),
          st.rollPool ? h('span', { class: 'cb-note', text: 'Rolled: ' + st.rollPool.join(', ') + ' — assign each value once.' }) : h('span', { class: 'cb-note', text: 'Four six-sided dice, the lowest dropped, six times.' })
        ]));
      }
      if ((ab.method === 'standardArray' || (ab.method === 'roll' && st.rollPool)) && cls()) {
        body.appendChild(h('button', { type: 'button', class: 'btn ghost small', text: '✨ Suggest for ' + clsDef().name, onclick: () => { suggestAssign(ab.method === 'roll' ? st.rollPool : rules.abilityMethods.standardArray); render(); } }));
      }
    }

    function setMethod(m) {
      const ab = b().abilities;
      ab.method = m;
      if (m === 'pointBuy') E.ABILITIES.forEach((a) => { ab.base[a] = rules.abilityMethods.pointBuy.min; });
      else if (m === 'standardArray') suggestAssign(rules.abilityMethods.standardArray);
      else if (m === 'roll') { st.rollPool = ab.rolls ? ab.rolls.slice() : null; E.ABILITIES.forEach((a) => { ab.base[a] = st.rollPool ? ab.base[a] : null; }); }
      else E.ABILITIES.forEach((a) => { if (!Number.isInteger(ab.base[a])) ab.base[a] = 10; });
    }

    function canAfford(a) {
      const next = Object.assign({}, b().abilities.base, { [a]: b().abilities.base[a] + 1 });
      const cost = E.pointBuyCost(next, rules);
      return cost !== null && cost <= rules.abilityMethods.pointBuy.budget;
    }

    // A select per ability; each pool value can be used once.
    function assignSelect(a, pool) {
      const base = b().abilities.base;
      const used = E.ABILITIES.filter((x) => x !== a && Number.isInteger(base[x])).map((x) => base[x]);
      const left = pool.slice();
      used.forEach((v) => { const i = left.indexOf(v); if (i >= 0) left.splice(i, 1); });
      const sel = h('select', { class: 'cb-select', onchange: (e) => { base[a] = e.target.value === '' ? null : Number(e.target.value); render(); } },
        [h('option', { value: '', text: '—' })].concat(Array.from(new Set(left.concat(Number.isInteger(base[a]) ? [base[a]] : []))).sort((x, y) => y - x)
          .map((v) => h('option', { value: v, text: v, selected: base[a] === v }))));
      return sel;
    }

    function suggestAssign(pool) {
      const order = PRIORITY[cls() ? cls().id : 'fighter'] || E.ABILITIES;
      const sorted = pool.slice().sort((x, y) => y - x);
      order.forEach((a, i) => { b().abilities.base[a] = sorted[i]; });
    }

    /* --- Step: Choices --- */
    function renderChoices(body) {
      const c = cls();
      if (!c) { body.appendChild(h('div', { class: 'cb-note', text: 'Choose a class first.' })); return; }
      const def = clsDef();
      const ch = b().choices;
      const fixed = fixedSkills();

      if (c.level >= def.subclassLevel) {
        body.appendChild(h('div', { class: 'cb-h', text: def.subclassTitle }));
        body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(def.subclasses || {}).map((id) => {
          const s = def.subclasses[id];
          return h('button', { type: 'button', class: 'cb-opt' + (c.subclass === id ? ' on' : ''), onclick: () => { c.subclass = id; b().choices.subclassSkills = {}; render(); } },
            [h('b', { text: s.name }), h('small', { text: Object.keys(s.features || {}).filter((l) => Number(l) <= c.level).map((l) => s.features[l].join(', ')).join(' · ') }), s.homebrew ? h('span', { class: 'cb-hb', text: 'homebrew' }) : null]);
        })));
        if (Object.keys(def.subclasses || {}).length === 1) body.appendChild(h('div', { class: 'cb-note', text: 'The SRD has one ' + def.subclassTitle.toLowerCase() + ' per class; your DM can add more as homebrew.' }));
      } else {
        body.appendChild(h('div', { class: 'cb-note', text: def.name + 's choose their ' + def.subclassTitle + ' at level ' + def.subclassLevel + '.' }));
      }

      body.appendChild(h('div', { class: 'cb-h', text: 'Choose ' + def.skills.choose + ' ' + def.name + ' skills' }));
      body.appendChild(checks(skillOptions(def.skills.from), ch.skills[c.id] || [], def.skills.choose, (v) => { ch.skills[c.id] = v; trimExpertise(); render(); }, fixed));
      if (fixed.length) body.appendChild(h('div', { class: 'cb-note', text: 'Already proficient from species/background: ' + fixed.map((s) => rules.skills[s].name).join(', ') + '.' }));

      const sub = c.subclass && def.subclasses[c.subclass];
      if (sub && sub.bonusSkills) {
        Object.keys(sub.bonusSkills).forEach((l) => {
          if (Number(l) > c.level) return;
          const taken = fixed.concat(ch.skills[c.id] || []);
          body.appendChild(h('div', { class: 'cb-h', text: sub.name + ': ' + sub.bonusSkills[l] + ' bonus skills' }));
          body.appendChild(checks(skillOptions('any'), ch.subclassSkills[c.id] || [], sub.bonusSkills[l], (v) => { ch.subclassSkills[c.id] = v; render(); }, taken));
        });
      }

      let due = 0;
      Object.keys(def.expertise || {}).forEach((l) => { if (Number(l) <= c.level) due += def.expertise[l]; });
      if (due) {
        const proficient = Array.from(new Set(fixed.concat(ch.skills[c.id] || [], ch.subclassSkills[c.id] || [])));
        body.appendChild(h('div', { class: 'cb-h', text: 'Expertise: ' + due + ' skill' + (due > 1 ? 's' : '') + ' (double proficiency)' }));
        body.appendChild(checks(proficient.map((s) => ({ id: s, label: rules.skills[s].name })), ch.expertise, due, (v) => { ch.expertise = v; render(); }));
      }

      Object.keys(def.fightingStyle || {}).forEach((l) => {
        if (Number(l) > c.level) return;
        const key = c.id + ':' + l;
        body.appendChild(h('div', { class: 'cb-h', text: 'Fighting style' }));
        body.appendChild(select(def.fightingStyle[l].map((s) => ({ value: s, label: rules.fightingStyles[s].name })), ch.fightingStyles[key], 'Choose…', (v) => { ch.fightingStyles[key] = v; render(); }));
      });
      if (sub && sub.fightingStyle) Object.keys(sub.fightingStyle).forEach((l) => {
        if (Number(l) > c.level) return;
        const key = c.id + ':' + l;
        const firstStyle = Object.values(def.fightingStyle || {})[0] || [];
        body.appendChild(h('div', { class: 'cb-h', text: sub.name + ': additional fighting style' }));
        body.appendChild(select(firstStyle.map((s) => ({ value: s, label: rules.fightingStyles[s].name })), ch.fightingStyles[key], 'Choose…', (v) => { ch.fightingStyles[key] = v; render(); }));
      });

      E.asiSlots(b(), rules).forEach((slot) => {
        const pick = ch.asi[slot.key] || {};
        body.appendChild(h('div', { class: 'cb-h', text: 'Level ' + slot.level + ': ability score improvement or feat' }));
        const kind = pick.type === 'feat' ? 'feat' : pick.abilities && Object.keys(pick.abilities).length === 2 ? 'two' : pick.abilities ? 'one' : '';
        const row = h('div', { class: 'cb-row' });
        row.appendChild(select([{ value: 'one', label: '+2 to one ability' }, { value: 'two', label: '+1 to two abilities' }, { value: 'feat', label: 'A feat' }], kind, 'Choose…', (v) => {
          ch.asi[slot.key] = v === 'feat' ? { type: 'feat', feat: null } : { type: 'asi', abilities: {} };
          ch.asi[slot.key]._kind = v;
          render();
        }));
        const k = (ch.asi[slot.key] || {})._kind || kind;
        if (k === 'one' || k === 'two') {
          const keys = Object.keys(pick.abilities || {});
          const abilOpts = E.ABILITIES.map((a) => ({ value: a, label: rules.abilityNames[a] }));
          const setAb = (i, a) => {
            const cur = Object.keys((ch.asi[slot.key] || {}).abilities || {});
            cur[i] = a;
            const abilities = {};
            if (k === 'one') { if (cur[0]) abilities[cur[0]] = 2; } else { cur.slice(0, 2).forEach((x) => { if (x) abilities[x] = 1; }); }
            ch.asi[slot.key] = { type: 'asi', abilities: abilities, _kind: k };
            render();
          };
          row.appendChild(select(abilOpts, keys[0], 'Ability…', (v) => setAb(0, v)));
          if (k === 'two') row.appendChild(select(abilOpts, keys[1], 'Ability…', (v) => setAb(1, v)));
        } else if (k === 'feat') {
          row.appendChild(select(Object.keys(rules.feats).map((f) => ({ value: f, label: rules.feats[f].name + (rules.feats[f].requires ? ' (needs ' + Object.keys(rules.feats[f].requires).map((a) => a.toUpperCase() + ' ' + rules.feats[f].requires[a]).join(', ') + ')' : '') })), pick.feat, 'Feat…', (v) => { ch.asi[slot.key] = { type: 'feat', feat: v, _kind: 'feat' }; render(); }));
        }
        body.appendChild(row);
      });

      if (c.level > 1) {
        body.appendChild(h('div', { class: 'cb-h', text: 'Hit points after level 1' }));
        body.appendChild(h('div', { class: 'cb-tabs' }, [
          h('button', { type: 'button', class: 'btn ghost small' + (st.hpMode === 'average' ? ' on' : ''), text: 'Take the average (' + E.averageHitDie(def.hitDie) + ')', onclick: () => { st.hpMode = 'average'; applyHpMode(); render(); } }),
          h('button', { type: 'button', class: 'btn ghost small' + (st.hpMode === 'roll' ? ' on' : ''), text: '🎲 Roll d' + def.hitDie + ' per level', onclick: () => { st.hpMode = 'roll'; applyHpMode(true); render(); } })
        ]));
        if (st.hpMode === 'roll') body.appendChild(h('div', { class: 'cb-note', text: 'Rolled: ' + (c.hp || []).slice(1).join(', ') }));
      }
      body.appendChild(h('div', { class: 'cb-note', text: 'Max HP: ' + E.derive(b(), rules).hp.max }));
    }

    /* --- Step: Spells --- */
    function renderSpells(body) {
      if (!cls()) { body.appendChild(h('div', { class: 'cb-note', text: 'Choose a class first.' })); return; }
      const asked = renderSpellPicks(body, E, rules, b(), render, spellUi);
      const any = E.spellLimits(b(), rules).length || E.speciesSpells(b(), rules).innate.length;
      if (!any) body.appendChild(h('div', { class: 'cb-note', text: clsDef().name + 's don\'t cast spells' + (clsDef().spellcasting ? ' yet at this level' : '') + '. Nothing to choose here.' }));
      else if (!asked) body.appendChild(h('div', { class: 'cb-note', text: 'Nothing to choose at this level.' }));
      body.appendChild(h('div', { class: 'cb-note', text: '® ritual · © concentration. Your picks go to the Spells tab when you save; spells you add there yourself stay yours.' }));
    }

    function applyHpMode(reroll) {
      const c = cls();
      if (!c) return;
      const die = rules.classes[c.id].hitDie;
      const cur = c.hp || [];
      c.hp = Array.from({ length: c.level }, (_, i) => {
        if (i === 0 || st.hpMode === 'average') return null;
        return !reroll && Number.isInteger(cur[i]) ? cur[i] : 1 + Math.floor(Math.random() * die);
      });
    }

    function fixedSkills() {
      const sp = b().species && rules.species[b().species];
      const sub = sp && b().subrace && sp.subraces ? sp.subraces[b().subrace] : null;
      const bg = b().background && rules.backgrounds[b().background];
      return Array.from(new Set([].concat((sp && sp.skills) || [], (sub && sub.skills) || [], b().speciesChoices.skills || [], (bg && bg.skills) || [])));
    }

    function trimExpertise() {
      const c = cls();
      const ok = new Set(fixedSkills().concat(b().choices.skills[c.id] || [], b().choices.subclassSkills[c.id] || []));
      b().choices.expertise = b().choices.expertise.filter((s) => ok.has(s));
    }

    function skillOptions(from) {
      const ids = from === 'any' ? Object.keys(rules.skills) : from;
      return ids.map((s) => ({ id: s, label: rules.skills[s].name + ' (' + rules.skills[s].ability.toUpperCase() + ')' }));
    }

    /* --- Step: Equipment --- */
    function renderEquipment(body) {
      const def = clsDef();
      if (!def) { body.appendChild(h('div', { class: 'cb-note', text: 'Choose a class first.' })); return; }
      const eq = st.equipment;
      const w = def.startingWealth;
      body.appendChild(h('div', { class: 'cb-tabs' }, [
        h('button', { type: 'button', class: 'btn ghost small' + (eq.mode === 'pack' ? ' on' : ''), text: 'Starting equipment', onclick: () => { eq.mode = 'pack'; render(); } }),
        h('button', { type: 'button', class: 'btn ghost small' + (eq.mode === 'gold' ? ' on' : ''), text: 'Starting gold instead (' + w.dice + 'd4' + (w.mult > 1 ? ' × ' + w.mult : '') + ' gp)', onclick: () => { eq.mode = 'gold'; render(); } })
      ]));
      if (eq.mode === 'pack') {
        (def.equipment || []).forEach((group, gi) => {
          if (group.length === 1) { body.appendChild(h('div', { class: 'cb-check', text: '• ' + group[0] })); return; }
          body.appendChild(h('div', { class: 'cb-row' }, group.map((opt, oi) => h('label', { class: 'cb-check' }, [
            h('input', { type: 'radio', name: 'cb-eq-' + gi, checked: (eq.picks[gi] || 0) === oi, onchange: () => { eq.picks[gi] = oi; } }), opt
          ]))));
        });
      } else {
        body.appendChild(h('div', { class: 'cb-row' }, [
          h('button', { type: 'button', class: 'btn small', text: eq.gold === null ? '🎲 Roll' : '🎲 Roll again', onclick: () => {
            let sum = 0;
            for (let i = 0; i < w.dice; i++) sum += 1 + Math.floor(Math.random() * 4);
            eq.gold = sum * w.mult;
            render();
          } }),
          h('span', { class: 'cb-note', text: eq.gold === null ? 'Roll to see how much gold you start with.' : eq.gold + ' gp to buy your own gear.' })
        ]));
      }
      const bg = b().background && rules.backgrounds[b().background];
      if (bg && bg.equipment) body.appendChild(h('div', { class: 'cb-note', text: 'From your background (' + bg.name + '): ' + bg.equipment + '.' }));
    }

    function equipmentSummary() {
      const def = clsDef();
      if (!def) return [];
      if (st.equipment.mode === 'gold') return [(st.equipment.gold === null ? '?' : st.equipment.gold) + ' gp (starting gold)'];
      return (def.equipment || []).map((g, i) => g[st.equipment.picks[i] || 0]);
    }

    /* --- Step: Details --- */
    function renderDetails(body) {
      const d = b().details;
      body.appendChild(h('div', { class: 'cb-two' }, [
        h('div', {}, [
          h('div', { class: 'cb-h', text: 'Name' }),
          h('input', { class: 'cb-input wide', maxlength: 40, placeholder: 'Character name', value: b().name || '', oninput: (e) => { b().name = e.target.value; refreshTabs(); } }),
          h('div', { class: 'cb-h', text: 'Alignment' }),
          select(ALIGNMENTS.map((a) => ({ value: a, label: a })), d.alignment, '—', (v) => { d.alignment = v; }),
          h('div', { class: 'cb-h', text: 'Appearance' }),
          h('div', { class: 'cb-row' }, ['age', 'height', 'weight', 'eyes', 'hair', 'skin'].map((k) => h('input', { class: 'cb-input', style: 'width:31%', placeholder: k[0].toUpperCase() + k.slice(1), maxlength: 30, value: d[k] || '', oninput: (e) => { d[k] = e.target.value; } })))
        ]),
        h('div', {}, [
          h('div', { class: 'cb-h', text: 'Portrait' }),
          h('div', { class: 'cb-row' }, [
            d.portrait ? h('img', { class: 'cb-portrait', src: d.portrait, alt: '' }) : h('div', { class: 'cb-portrait' }),
            h('div', {}, [
              h('button', { type: 'button', class: 'btn ghost small', text: d.portrait ? 'Change picture' : 'Upload picture', onclick: () => pickPortrait() }),
              d.portrait ? h('button', { type: 'button', class: 'btn ghost small', text: 'Remove', onclick: () => { d.portrait = null; render(); } }) : null,
              h('div', { class: 'cb-note', text: 'Shrunk to ' + PORTRAIT_MAX + ' px. Also used as your token on the map.' })
            ])
          ])
        ])
      ]));
      ['personality', 'ideals', 'bonds', 'flaws'].forEach((k) => {
        body.appendChild(h('div', { class: 'cb-h', text: k[0].toUpperCase() + k.slice(1) }));
        body.appendChild(h('input', { class: 'cb-input wide', maxlength: 200, value: d[k] || '', oninput: (e) => { d[k] = e.target.value; } }));
      });
      body.appendChild(h('div', { class: 'cb-h', text: 'Backstory' }));
      body.appendChild(h('textarea', { class: 'cb-input', maxlength: 5000, oninput: (e) => { d.backstory = e.target.value; } }, d.backstory || ''));
    }

    function pickPortrait() {
      const input = h('input', { type: 'file', accept: 'image/*' });
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          // Centre-crop to a square, then shrink.
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const c = document.createElement('canvas');
          c.width = c.height = Math.min(PORTRAIT_MAX, side);
          c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
          b().details.portrait = c.toDataURL('image/webp', 0.85);
          render();
        };
        img.onerror = () => { URL.revokeObjectURL(url); alert('Could not read that picture.'); };
        img.src = url;
      };
      input.click();
    }

    // Name typing doesn't re-render (it would steal focus); only the step markers and Create button.
    function refreshTabs() {
      const { v, byStep } = stepStatus();
      card.querySelectorAll('.cb-step').forEach((el, i) => {
        const s = steps[i];
        if (!s || s.id === 'review') return;
        const todo = byStep[s.id] && byStep[s.id].length;
        el.classList.toggle('todo', !!todo);
        el.classList.toggle('done', !todo);
        const dot = el.querySelector('.cb-dot');
        if (dot) dot.textContent = todo ? '●' : '✓';
      });
      void v;
    }

    /* --- Step: Review --- */
    function renderReview(body, v) {
      const d = E.derive(b(), rules);
      const cs = d.characterStats;
      const head = h('div', { class: 'cb-row' }, [
        b().details.portrait ? h('img', { class: 'cb-portrait', src: b().details.portrait, alt: '' }) : null,
        h('div', {}, [
          h('div', { class: 'cb-title', text: b().name || 'Unnamed hero' }),
          h('div', { class: 'cb-note', text: [cs.subrace || cs.species, cs.characterClass + (cs.subclass ? ' (' + cs.subclass + ')' : ''), 'level ' + d.level, (b().background && rules.backgrounds[b().background] || {}).name, b().details.alignment].filter(Boolean).join(' · ') })
        ])
      ]);
      body.appendChild(head);

      body.appendChild(h('div', { class: 'cb-h', text: 'Ability scores' }));
      body.appendChild(h('div', { class: 'cb-abil' }, E.ABILITIES.map((a) => h('div', {}, [
        h('div', { class: 'cb-ab', text: a.toUpperCase() }), h('div', { class: 'cb-score', text: d.abilities.scores[a] }), h('div', { class: 'cb-mod', text: signed(d.abilities.mods[a]) + (cs.saveProfs[a] ? ' · save' : '') })
      ]))));

      const sc = d.spellcasting;
      body.appendChild(h('div', { class: 'cb-h', text: 'At a glance' }));
      body.appendChild(h('div', { class: 'cb-sum' }, [
        ['Max HP', d.hp.max], ['AC (unarmoured)', d.acUnarmored], ['Speed', cs.speed + ' ft'], ['Proficiency', signed(d.proficiencyBonus)], ['Initiative', signed(cs.initBonus)], ['Hit dice', d.hp.hitDice]
      ].concat(sc.abilities.map((x) => ['Spell save DC', x.saveDc])).map(([k, val]) => h('div', {}, [h('small', { text: k }), h('b', { text: val })]))));

      const skills = Object.keys(cs.skillProfs).filter((s) => cs.skillProfs[s]).map((s) => rules.skills[s].name + (cs.skillCustomBonuses[s] ? ' (expertise)' : ''));
      const slots = slotText(sc);
      const KIND = { cantrip: 'cantrips', known: 'known', spellbook: 'spellbook', always: 'always prepared', arcanum: 'Mystic Arcanum', secret: 'Magical Secrets', innate: 'innate' };
      const spellGroups = {};
      (sc.spells || []).forEach((x) => {
        const k = (x.source === 'species' ? 'Species' : (rules.classes[x.source] || { name: x.source }).name) + ' ' + KIND[x.kind];
        (spellGroups[k] = spellGroups[k] || []).push((rules.spells && rules.spells[x.id] ? rules.spells[x.id].name : x.id));
      });
      [
        ['Skills', skills.join(', ') || '—'],
        ['Spell slots', slots || '—'],
        rules.spells && (sc.spells || []).length ? ['Spells', Object.keys(spellGroups).map((k) => k + ': ' + spellGroups[k].join(', ')).join(' · ')] : null,
        ['Armour', cs.armorProf || '—'], ['Weapons', cs.weaponProf || '—'], ['Tools', cs.toolProf || '—'], ['Languages', cs.languages || '—'],
        ['Features', d.features.map((f) => f.name).join(', ')],
        config.editing ? null : ['Equipment', equipmentSummary().join('; ')]
      ].filter(Boolean).forEach(([k, val]) => {
        body.appendChild(h('div', { class: 'cb-h', text: k }));
        body.appendChild(h('div', { class: 'cb-list', text: val }));
      });

      const issues = v.issues.slice();
      if (!String(b().name || '').trim()) issues.unshift({ level: 'error', message: 'Give your character a name.', path: 'details' });
      if (issues.length) {
        body.appendChild(h('div', { class: 'cb-h', text: 'Still to do' }));
        body.appendChild(h('div', { class: 'cb-issues' }, issues.map((i) => {
          const step = i.path === 'details' ? 'details' : stepOfIssue(i);
          return h('div', { class: 'cb-issue ' + i.level }, [
            h('span', { text: (i.level === 'error' ? '● ' : '⚠ ') + i.message }),
            step !== 'review' ? h('button', { type: 'button', class: 'btn ghost small', text: 'Fix', onclick: () => { st.step = step; render(); } }) : null
          ]);
        })));
      }
    }

    /* --- Quick Build --- */
    function renderQuick(body) {
      body.appendChild(h('div', { class: 'cb-note', text: 'Three choices. Ability scores, skills, background and gear are picked for you; you can change anything on the review screen.' }));
      body.appendChild(h('div', { class: 'cb-h', text: '1. Species' }));
      body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(rules.species).map((id) => h('button', {
        type: 'button', class: 'cb-opt' + (b().species === id ? ' on' : ''), onclick: () => { b().species = id; b().subrace = null; b().speciesChoices = {}; render(); }
      }, [h('b', { text: rules.species[id].name })]))));
      body.appendChild(h('div', { class: 'cb-h', text: '2. Class' }));
      body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(rules.classes).map((id) => h('button', {
        type: 'button', class: 'cb-opt' + (cls() && cls().id === id ? ' on' : ''), onclick: () => setClass(id)
      }, [h('b', { text: rules.classes[id].name }), h('small', { text: 'd' + rules.classes[id].hitDie })]))));
      body.appendChild(h('div', { class: 'cb-h', text: '3. Name' }));
      body.appendChild(h('input', { class: 'cb-input wide', maxlength: 40, placeholder: 'Character name', value: b().name || '', oninput: (e) => {
        b().name = e.target.value;
        const go = card.querySelector('.cb-foot .btn:not(.ghost)');
        if (go) go.disabled = !(b().species && cls() && b().name.trim());
      } }));
    }

    // Fills in every choice still open with a sensible default.
    function quickFill() {
      const def = clsDef();
      const c = cls();
      const order = PRIORITY[c.id] || E.ABILITIES;
      const sp = rules.species[b().species];
      if (sp.subraces && !b().subrace) b().subrace = Object.keys(sp.subraces)[0];
      const sc = b().speciesChoices;
      if (sp.abilityChoice && !(sc.abilities && sc.abilities.length)) sc.abilities = order.filter((a) => !(sp.abilityChoice.exclude || []).includes(a)).slice(0, sp.abilityChoice.count);
      if (sp.ancestry && !sc.ancestry) sc.ancestry = Object.keys(sp.ancestry)[0];
      if (sp.toolChoice && !sc.tool) sc.tool = sp.toolChoice[0];
      if (!b().background) b().background = Object.keys(rules.backgrounds)[0];
      if (sp.skillChoice && !(sc.skills && sc.skills.length)) {
        const avoid = new Set([].concat(sp.skills || [], (rules.backgrounds[b().background] || {}).skills || [], def.skills.from === 'any' ? [] : def.skills.from));
        sc.skills = Object.keys(rules.skills).filter((s) => !avoid.has(s)).slice(0, sp.skillChoice.choose);
      }
      b().abilities = { method: 'standardArray', base: {} };
      suggestAssign(rules.abilityMethods.standardArray);
      const fixed = new Set(fixedSkills());
      const from = def.skills.from === 'any' ? Object.keys(rules.skills) : def.skills.from;
      // Prefer skills that use the class's best abilities.
      const ranked = from.filter((s) => !fixed.has(s)).sort((x, y) => order.indexOf(rules.skills[x].ability) - order.indexOf(rules.skills[y].ability));
      b().choices.skills[c.id] = ranked.slice(0, def.skills.choose);
      Object.keys(def.fightingStyle || {}).forEach((l) => { if (Number(l) <= c.level) b().choices.fightingStyles[c.id + ':' + l] = def.fightingStyle[l][0]; });
      if (c.level >= def.subclassLevel && !c.subclass) c.subclass = Object.keys(def.subclasses || {})[0] || null;
      let due = 0;
      Object.keys(def.expertise || {}).forEach((l) => { if (Number(l) <= c.level) due += def.expertise[l]; });
      const prof = Array.from(new Set(Array.from(fixed).concat(b().choices.skills[c.id])));
      b().choices.expertise = prof.sort((x, y) => order.indexOf(rules.skills[x].ability) - order.indexOf(rules.skills[y].ability)).slice(0, due);
      E.asiSlots(b(), rules).forEach((slot) => { if (!b().choices.asi[slot.key]) b().choices.asi[slot.key] = { type: 'asi', abilities: { [order[0]]: 2 } }; });
      autoSpells(E, rules, b());
      applyHpMode();
    }

    /* --- Finish --- */
    function finish() {
      const v = validation();
      if (!v.ok || !String(b().name || '').trim()) { st.step = 'review'; render(); return; }
      // UI-only helpers don't belong in the saved build.
      Object.keys(b().choices.asi).forEach((k) => { delete b().choices.asi[k]._kind; });
      b().name = String(b().name).trim();
      const result = {
        build: JSON.parse(JSON.stringify(b())),
        derived: E.derive(b(), rules),
        equipment: { mode: st.equipment.mode, picks: equipmentSummary(), gold: st.equipment.gold }
      };
      close();
      if (typeof config.onDone === 'function') config.onDone(result);
    }

    function cancel() {
      if (!confirm('Close the builder? Your choices are not saved.')) return;
      close();
      if (typeof config.onCancel === 'function') config.onCancel();
    }

    if (!config.build) suggestAssign(rules.abilityMethods.standardArray);
    render();
    return { close: close };
  }

  /* ---------- Level up ---------- */
  // CharacterBuilder.levelUp({ rules, opts, build, onDone({ build, derived }), onCancel })
  // One screen: which class gains the level (or a new one), hit points, the choices the new
  // level brings, and what changes. Everything else in the build stays as it was.
  function levelUp(config) {
    const E = root.CharacterEngine;
    const rules = config.rules || root.RULES_SRD5;
    const opts = config.opts || {};
    if (!E || !rules || !config.build) throw new Error('Level up needs character-engine.js, the rules and a build');
    injectStyles();
    close();

    const base = JSON.parse(JSON.stringify(config.build));
    base.choices = Object.assign({ skills: {}, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {}, spells: {} }, base.choices || {});
    const spellUi = {};
    const before = E.derive(base, rules);
    const options = E.levelUpOptions(base, rules);
    const strict = opts.strict !== false;
    const st = { classId: null, hpMode: 'average', hpRoll: null, next: null, showMulti: false };
    const entry = () => st.next ? st.next.classes.find((c) => c.id === st.classId) : null;

    const wrap = h('div', { id: 'char-builder' });
    const card = h('div', { class: 'cb-card', role: 'dialog', 'aria-label': 'Level up' });
    card.style.maxWidth = '720px';
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    function pickClass(id) {
      st.classId = id;
      st.next = E.levelUp(base, rules, id, null);
      st.next.choices = JSON.parse(JSON.stringify(base.choices));
      if (st.hpMode === 'roll') st.hpRoll = null;
      st.hpMode = 'average';
      applyHp();
      render();
    }

    // The new level's hit die: null means the average.
    function applyHp() {
      const c = entry();
      if (c) c.hp[c.level - 1] = st.hpMode === 'roll' ? st.hpRoll : null;
    }

    function render() {
      card.innerHTML = '';
      card.appendChild(h('div', { class: 'cb-head' }, [
        h('div', { class: 'cb-title', text: '⬆ LEVEL UP' + (base.name ? ': ' + base.name : '') }),
        h('button', { type: 'button', class: 'btn ghost small', text: '✕', title: 'Close without levelling up', onclick: cancel })
      ]));
      const body = h('div', { class: 'cb-body' });
      card.appendChild(body);
      body.appendChild(h('div', { class: 'cb-note', text: 'Character level ' + before.level + ' → ' + (before.level + 1) + '. Gear, spells and notes stay as they are.' }));

      renderClassPick(body);
      let issues = [];
      let hpOk = true;
      if (st.next) {
        hpOk = renderHp(body);
        issues = renderChoices(body);
        renderGains(body);
        if (issues.length) {
          body.appendChild(h('div', { class: 'cb-h', text: 'Still to do' }));
          body.appendChild(h('div', { class: 'cb-issues' }, issues.map((i) => h('div', { class: 'cb-issue ' + i.level }, [h('span', { text: (i.level === 'error' ? '● ' : '⚠ ') + i.message })]))));
        }
      }

      const ready = !!st.next && hpOk && !issues.some((i) => i.level === 'error');
      card.appendChild(h('div', { class: 'cb-foot' }, [
        h('button', { type: 'button', class: 'btn ghost small', text: 'Cancel', onclick: cancel }),
        h('button', { type: 'button', class: 'btn small', text: '⬆ Level up', disabled: !ready, onclick: finish })
      ]));
    }

    function renderClassPick(body) {
      const mine = options.filter((o) => o.existing);
      const others = options.filter((o) => !o.existing);
      body.appendChild(h('div', { class: 'cb-h', text: 'Which class gains the level?' }));
      body.appendChild(h('div', { class: 'cb-grid' }, mine.map((o) => h('button', { type: 'button', class: 'cb-opt' + (st.classId === o.id ? ' on' : ''), onclick: () => pickClass(o.id) }, [
        h('b', { text: o.name }), h('small', { text: 'Level ' + o.level + ' → ' + (o.level + 1) })
      ]))));
      if (!others.length) return;
      const pickedNew = others.some((o) => o.id === st.classId);
      if (!st.showMulti && !pickedNew) {
        body.appendChild(h('div', { class: 'cb-row', style: 'margin-top:8px' }, [
          h('button', { type: 'button', class: 'btn ghost small', text: '➕ Multiclass into a new class…', onclick: () => { st.showMulti = true; render(); } })
        ]));
        return;
      }
      body.appendChild(h('div', { class: 'cb-h', text: 'Multiclass into' }));
      body.appendChild(h('div', { class: 'cb-grid' }, others.map((o) => {
        const blocked = !o.ok && strict;
        return h('button', { type: 'button', class: 'cb-opt' + (st.classId === o.id ? ' on' : ''), disabled: blocked, title: o.need.join(' '), onclick: () => pickClass(o.id) }, [
          h('b', { text: o.name }),
          h('small', { text: o.ok ? 'd' + rules.classes[o.id].hitDie + ' hit die' : o.need.join(' ') }),
          rules.classes[o.id].homebrew ? h('span', { class: 'cb-hb', text: 'homebrew' }) : null
        ]);
      })));
      body.appendChild(h('div', { class: 'cb-note', text: 'Multiclassing needs the ability scores of both your classes and the new one' + (strict ? '.' : ' (your DM has relaxed the rules, so it is only a warning here).') }));
    }

    // Returns false while a typed roll is missing.
    function renderHp(body) {
      const c = entry();
      const die = rules.classes[c.id].hitDie;
      const gain = E.derive(st.next, rules).hp.max - before.hp.max;
      body.appendChild(h('div', { class: 'cb-h', text: 'Hit points (d' + die + ')' }));
      const typed = h('input', { type: 'number', class: 'cb-input', min: 1, max: die, placeholder: 'Type your roll', style: 'width:130px', value: st.hpMode === 'roll' && st.hpRoll ? st.hpRoll : '', onchange: (e) => {
        const v = parseInt(e.target.value, 10);
        if (Number.isInteger(v) && v >= 1 && v <= die) { st.hpMode = 'roll'; st.hpRoll = v; } else { st.hpMode = 'average'; st.hpRoll = null; }
        applyHp();
        render();
      } });
      body.appendChild(h('div', { class: 'cb-row cb-tabs' }, [
        h('button', { type: 'button', class: 'btn ghost small' + (st.hpMode === 'average' ? ' on' : ''), text: 'Take the average (' + E.averageHitDie(die) + ')', onclick: () => { st.hpMode = 'average'; st.hpRoll = null; applyHp(); render(); } }),
        h('button', { type: 'button', class: 'btn ghost small' + (st.hpMode === 'roll' ? ' on' : ''), text: '🎲 Roll d' + die, onclick: () => { st.hpMode = 'roll'; st.hpRoll = 1 + Math.floor(Math.random() * die); applyHp(); render(); } }),
        typed
      ]));
      body.appendChild(h('div', { class: 'cb-note' }, [
        st.hpMode === 'roll' ? 'Rolled ' + st.hpRoll + '. ' : '',
        h('span', { class: 'cb-gain', text: (gain >= 0 ? '+' : '') + gain + ' max HP' }),
        ' (CON ' + signed(before.abilities.mods.con) + ' included).'
      ]));
      return st.hpMode === 'average' || Number.isInteger(st.hpRoll);
    }

    // The choices this level brings for the class that gained it. Returns the level up's new issues.
    function renderChoices(body) {
      const c = entry();
      const def = rules.classes[c.id];
      const ch = st.next.choices;
      const L = c.level;
      const idx = st.next.classes.indexOf(c);
      const issues = E.newIssues(base, st.next, rules, opts);
      const pending = (prefix) => issues.some((i) => (i.path || '') === prefix || (i.path || '').startsWith(prefix + '.'));
      const now = (lvl, path) => Number(lvl) === L || (Number(lvl) <= L && pending(path));
      const proficient = () => { const p = E.derive(st.next, rules).characterStats.skillProfs; return Object.keys(p).filter((s) => p[s]); };
      const skillOpts = (from) => (from === 'any' ? Object.keys(rules.skills) : from).map((s) => ({ id: s, label: rules.skills[s].name + ' (' + rules.skills[s].ability.toUpperCase() + ')' }));
      const head = (text) => body.appendChild(h('div', { class: 'cb-h', text: text }));
      let asked = false;

      if (def.subclassLevel && now(def.subclassLevel, 'classes.' + idx + '.subclass')) {
        asked = true;
        head(def.subclassTitle || 'Subclass');
        body.appendChild(h('div', { class: 'cb-grid' }, Object.keys(def.subclasses || {}).map((id) => {
          const s = def.subclasses[id];
          return h('button', { type: 'button', class: 'cb-opt' + (c.subclass === id ? ' on' : ''), onclick: () => { c.subclass = id; ch.subclassSkills[c.id] = []; render(); } }, [
            h('b', { text: s.name }), h('small', { text: ((s.features || {})[L] || []).join(', ') }), s.homebrew ? h('span', { class: 'cb-hb', text: 'homebrew' }) : null
          ]);
        })));
      }
      const sub = c.subclass && def.subclasses ? def.subclasses[c.subclass] : null;

      // A new class's own skill pick (Bard, Ranger, Rogue).
      const mc = def.multiclass || {};
      if (idx > 0 && mc.skills && (L === 1 || pending('choices.skills.' + c.id))) {
        asked = true;
        head(def.name + ': ' + mc.skills + ' skill' + (mc.skills > 1 ? 's' : ''));
        body.appendChild(checks(skillOpts(mc.skillsFrom === 'class' ? def.skills.from : 'any'), ch.skills[c.id] || [], mc.skills, (v) => { ch.skills[c.id] = v; render(); }, proficient().filter((s) => !(ch.skills[c.id] || []).includes(s))));
      }

      if (sub && sub.bonusSkills) Object.keys(sub.bonusSkills).forEach((l) => {
        if (!now(l, 'choices.subclassSkills.' + c.id)) return;
        asked = true;
        head(sub.name + ': ' + sub.bonusSkills[l] + ' bonus skills');
        body.appendChild(checks(skillOpts('any'), ch.subclassSkills[c.id] || [], sub.bonusSkills[l], (v) => { ch.subclassSkills[c.id] = v; render(); }, proficient().filter((s) => !(ch.subclassSkills[c.id] || []).includes(s))));
      });

      const styleSlots = Object.keys(def.fightingStyle || {}).map((l) => [l, def.fightingStyle[l], 'Fighting style']);
      if (sub && sub.fightingStyle) Object.keys(sub.fightingStyle).forEach((l) => styleSlots.push([l, Object.values(def.fightingStyle || {})[0] || Object.keys(rules.fightingStyles), sub.name + ': additional fighting style']));
      styleSlots.forEach(([l, list, title]) => {
        const key = c.id + ':' + l;
        if (!now(l, 'choices.fightingStyles.' + key)) return;
        asked = true;
        head(title);
        body.appendChild(select(list.map((s) => ({ value: s, label: rules.fightingStyles[s].name })), ch.fightingStyles[key], 'Choose…', (v) => { ch.fightingStyles[key] = v; render(); }));
      });

      if ((def.expertise || {})[L] || pending('choices.expertise')) {
        let due = 0;
        st.next.classes.forEach((x) => { const d = rules.classes[x.id]; Object.keys((d && d.expertise) || {}).forEach((l) => { if (Number(l) <= x.level) due += d.expertise[l]; }); });
        asked = true;
        head('Expertise: ' + due + ' skills in all (double proficiency)');
        body.appendChild(checks(proficient().map((s) => ({ id: s, label: rules.skills[s].name })), ch.expertise, due, (v) => { ch.expertise = v; render(); }));
      }

      if ((def.asiLevels || []).includes(L)) {
        asked = true;
        head('Ability score improvement or feat');
        body.appendChild(asiRow(c.id + ':' + L, ch));
      }

      // Spells for the class that gained the level (new picks, or swapping one known spell),
      // and species spells when they still need choosing.
      if (rules.spells && def.spellcasting) {
        const sb = h('div', {});
        if (renderSpellPicks(sb, E, rules, st.next, render, spellUi, c.id)) { asked = true; body.appendChild(sb); }
      }
      if (rules.spells && pending('choices.spells.species')) {
        asked = true;
        renderSpellPicks(body, E, rules, st.next, render, spellUi, 'species');
      }

      if (!asked) body.appendChild(h('div', { class: 'cb-note', text: 'Nothing to choose at this level: the new features are listed below.' }));
      return E.newIssues(base, st.next, rules, opts);
    }

    function asiRow(key, ch) {
      const pick = ch.asi[key] || {};
      const n = Object.keys(pick.abilities || {}).length;
      const kind = pick._kind || (pick.type === 'feat' ? 'feat' : n === 2 ? 'two' : n === 1 ? 'one' : '');
      const scores = before.abilities.scores;
      const row = h('div', { class: 'cb-row' });
      row.appendChild(select([{ value: 'one', label: '+2 to one ability' }, { value: 'two', label: '+1 to two abilities' }, { value: 'feat', label: 'A feat' }], kind, 'Choose…', (v) => {
        if (!v) delete ch.asi[key];
        else ch.asi[key] = v === 'feat' ? { type: 'feat', feat: null, _kind: v } : { type: 'asi', abilities: {}, _kind: v };
        render();
      }));
      if (kind === 'one' || kind === 'two') {
        const keys = Object.keys(pick.abilities || {});
        const abil = E.ABILITIES.map((a) => ({ value: a, label: rules.abilityNames[a] + ' (' + scores[a] + ')' }));
        const setAb = (i, a) => {
          const cur = keys.slice();
          cur[i] = a;
          const abilities = {};
          if (kind === 'one') { if (cur[0]) abilities[cur[0]] = 2; } else cur.slice(0, 2).forEach((x) => { if (x) abilities[x] = 1; });
          ch.asi[key] = { type: 'asi', abilities: abilities, _kind: kind };
          render();
        };
        row.appendChild(select(abil, keys[0], 'Ability…', (v) => setAb(0, v)));
        if (kind === 'two') row.appendChild(select(abil, keys[1], 'Ability…', (v) => setAb(1, v)));
      } else if (kind === 'feat') {
        row.appendChild(select(Object.keys(rules.feats).map((f) => ({ value: f, label: rules.feats[f].name + (rules.feats[f].requires ? ' (needs ' + Object.keys(rules.feats[f].requires).map((a) => a.toUpperCase() + ' ' + rules.feats[f].requires[a]).join(', ') + ')' : '') })), pick.feat, 'Feat…', (v) => { ch.asi[key] = { type: 'feat', feat: v, _kind: 'feat' }; render(); }));
      }
      return row;
    }

    function renderGains(body) {
      const after = E.derive(st.next, rules);
      const fkey = (f) => f.name + '|' + f.source + '|' + f.level;
      const had = new Set(before.features.map(fkey));
      const gained = after.features.filter((f) => !had.has(fkey(f)));
      body.appendChild(h('div', { class: 'cb-h', text: 'What changes' }));
      const cells = [
        ['Max HP', before.hp.max + ' → ' + after.hp.max],
        ['Proficiency', signed(before.proficiencyBonus) + (after.proficiencyBonus !== before.proficiencyBonus ? ' → ' + signed(after.proficiencyBonus) : '')],
        ['Hit dice', after.hp.hitDice]
      ];
      E.ABILITIES.forEach((a) => { if (after.abilities.scores[a] !== before.abilities.scores[a]) cells.push([a.toUpperCase(), before.abilities.scores[a] + ' → ' + after.abilities.scores[a]]); });
      body.appendChild(h('div', { class: 'cb-sum' }, cells.map(([k, v]) => h('div', {}, [h('small', { text: k }), h('b', { text: v })]))));
      const s0 = slotText(before.spellcasting), s1 = slotText(after.spellcasting);
      if (s0 !== s1) body.appendChild(h('div', { class: 'cb-list', style: 'margin-top:8px' }, [h('b', { text: 'Spell slots: ' }), (s0 || 'none') + ' → ' + s1]));
      body.appendChild(h('div', { class: 'cb-list', style: 'margin-top:6px' }, [h('b', { text: 'New features: ' }), gained.map((f) => f.name).join(', ') || '—']));
      if (after.spellcasting.abilities.length) body.appendChild(h('div', { class: 'cb-note', text: rules.spells ? 'The spells picked above go to the Spells tab. Prepared spells are chosen each day in the Spells tab.' : 'New spells known or prepared: add them in the Spells tab.' }));
    }

    function finish() {
      Object.keys(st.next.choices.asi).forEach((k) => { if (st.next.choices.asi[k]) delete st.next.choices.asi[k]._kind; });
      const result = { build: JSON.parse(JSON.stringify(st.next)), derived: E.derive(st.next, rules) };
      close();
      if (typeof config.onDone === 'function') config.onDone(result);
    }

    function cancel() {
      if (st.next && !confirm('Close without levelling up?')) return;
      close();
      if (typeof config.onCancel === 'function') config.onCancel();
    }

    // A single class with no multiclassing to consider: start on it.
    const only = options.filter((o) => o.existing);
    if (only.length === 1) pickClass(only[0].id); else render();
    return { close: close };
  }

  function close() {
    const el = document.getElementById('char-builder');
    if (el) el.remove();
  }

  root.CharacterBuilder = { open: open, levelUp: levelUp, close: close, stepOfIssue: stepOfIssue };
})(typeof window !== 'undefined' ? window : this);
