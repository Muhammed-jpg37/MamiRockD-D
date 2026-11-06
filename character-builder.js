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
      @media (max-width: 640px) {
        .cb-abil { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .cb-two { grid-template-columns: 1fr; }
        .cb-step { min-width: 0; font-size: 10px; padding: 5px; }
      }
    `;
    document.head.appendChild(style);
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
    b().choices = Object.assign({ skills: {}, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} }, b().choices || {});
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
      if (!cls()) ['choices', 'equipment'].forEach((s) => { (byStep[s] = byStep[s] || []).push({ message: 'Choose a class first.' }); });
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
        card.appendChild(h('div', { class: 'cb-steps' }, STEPS.map((s) => {
          const todo = s.id !== 'review' && byStep[s.id] && byStep[s.id].length;
          return h('button', { type: 'button', class: 'cb-step' + (st.step === s.id ? ' on' : '') + (s.id === 'review' ? '' : todo ? ' todo' : ' done'), onclick: () => { st.step = s.id; render(); } },
            [s.label, s.id === 'review' ? null : h('span', { class: 'cb-dot', text: todo ? '●' : '✓' })]);
        })));
      }
      const body = h('div', { class: 'cb-body' });
      card.appendChild(body);
      (st.quick ? renderQuick : ({ class: renderClass, origin: renderOrigin, abilities: renderAbilities, choices: renderChoices, equipment: renderEquipment, details: renderDetails, review: renderReview })[st.step])(body, v);

      const idx = STEPS.findIndex((s) => s.id === st.step);
      const foot = h('div', { class: 'cb-foot' });
      if (st.quick) {
        foot.append(
          h('button', { type: 'button', class: 'btn ghost small', text: '← Full builder', onclick: () => { st.quick = false; render(); } }),
          h('button', { type: 'button', class: 'btn small', text: 'Fill in & review →', disabled: !(b().species && cls() && String(b().name || '').trim()), onclick: () => { quickFill(); st.quick = false; st.step = 'review'; render(); } })
        );
      } else {
        foot.append(
          h('button', { type: 'button', class: 'btn ghost small', text: '← Back', disabled: idx === 0, onclick: () => { st.step = STEPS[Math.max(0, idx - 1)].id; render(); } }),
          st.step === 'review'
            ? h('button', { type: 'button', class: 'btn small', text: '✨ Create character', disabled: !(v.ok && String(b().name || '').trim()), onclick: finish })
            : h('button', { type: 'button', class: 'btn small', text: 'Next →', onclick: () => { st.step = STEPS[idx + 1].id; render(); } })
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
      Object.assign(b().choices, { skills: {}, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} });
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
        const s = STEPS[i];
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
      const slots = Object.keys(sc.slots).map((l) => l + ': ' + sc.slots[l]).join(' · ') + (sc.pact ? (Object.keys(sc.slots).length ? ' · ' : '') + 'Pact: ' + sc.pact.slots + ' × level ' + sc.pact.level : '');
      [
        ['Skills', skills.join(', ') || '—'],
        ['Spell slots', slots || '—'],
        ['Armour', cs.armorProf || '—'], ['Weapons', cs.weaponProf || '—'], ['Tools', cs.toolProf || '—'], ['Languages', cs.languages || '—'],
        ['Features', d.features.map((f) => f.name).join(', ')],
        ['Equipment', equipmentSummary().join('; ')]
      ].forEach(([k, val]) => {
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
      applyHpMode();
    }

    /* --- Small form helpers --- */
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

  function close() {
    const el = document.getElementById('char-builder');
    if (el) el.remove();
  }

  root.CharacterBuilder = { open: open, close: close, stepOfIssue: stepOfIssue };
})(typeof window !== 'undefined' ? window : this);
