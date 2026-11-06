/* ========================================================
   HOMEBREW EDITOR (campaign DMs)
   The SRD only has one subclass per class, nine species, one
   background and one feat. A DM adds the rest for their campaign
   here; the character builder merges it in (mergeRules) for
   everyone in that campaign. Also: how strict the builder is.

   Stored at campaigns/<id>/homebrew (see campaign.js) in the
   same shape as rules/srd5.js, so the engine needs nothing new.
   Write content in your own words; don't paste text from books.
   ======================================================== */
(function (root) {
  'use strict';

  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  // Form layout per content type. Field types: text, number, select, abilities (six numbers),
  // skills (checkboxes), list (comma separated), levels ("3: A, B" per line), textarea.
  const KINDS = {
    species: {
      label: 'Species', single: 'species', nested: null,
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium'], value: 'Medium' },
        { key: 'speed', label: 'Speed (ft)', type: 'number', value: 30 },
        { key: 'abilityBonuses', label: 'Ability bonuses', type: 'abilities' },
        { key: 'choiceCount', label: '+ abilities of the player\'s choice (how many)', type: 'number' },
        { key: 'choiceAmount', label: '…by how much each', type: 'number' },
        { key: 'skills', label: 'Skill proficiencies', type: 'skills' },
        { key: 'skillChoose', label: 'Skills of the player\'s choice (how many)', type: 'number' },
        { key: 'senses', label: 'Senses (e.g. Darkvision 60 ft)', type: 'text' },
        { key: 'languages', label: 'Languages', type: 'list' },
        { key: 'extraLanguages', label: 'Extra languages of choice', type: 'number' },
        { key: 'traits', label: 'Traits (names)', type: 'list' },
        { key: 'hpPerLevel', label: 'Extra HP per level', type: 'number' },
        { key: 'weapons', label: 'Weapon proficiencies', type: 'text' },
        { key: 'armor', label: 'Armour proficiencies', type: 'text' },
        { key: 'tools', label: 'Tool proficiencies', type: 'text' },
        { key: 'resistances', label: 'Resistances', type: 'text' }
      ]
    },
    subraces: {
      label: 'Subraces', single: 'subrace', nested: 'species',
      fields: [
        { key: 'parent', label: 'Of species', type: 'parent', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'abilityBonuses', label: 'Ability bonuses (on top of the species)', type: 'abilities' },
        { key: 'skills', label: 'Skill proficiencies', type: 'skills' },
        { key: 'traits', label: 'Traits (names)', type: 'list' },
        { key: 'hpPerLevel', label: 'Extra HP per level', type: 'number' },
        { key: 'speed', label: 'Speed (ft, if different)', type: 'number' },
        { key: 'weapons', label: 'Weapon proficiencies', type: 'text' },
        { key: 'senses', label: 'Senses', type: 'text' }
      ]
    },
    backgrounds: {
      label: 'Backgrounds', single: 'background', nested: null,
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'skills', label: 'Skill proficiencies (usually two)', type: 'skills' },
        { key: 'extraLanguages', label: 'Languages of choice', type: 'number' },
        { key: 'tools', label: 'Tool proficiencies', type: 'text' },
        { key: 'feature', label: 'Feature name', type: 'text' },
        { key: 'equipment', label: 'Equipment (write "… 10 gp" for starting coins)', type: 'textarea' }
      ]
    },
    feats: {
      label: 'Feats', single: 'feat', nested: null,
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'requires', label: 'Prerequisite: minimum scores', type: 'abilities' },
        { key: 'abilityBonuses', label: 'Ability increases it gives', type: 'abilities' },
        { key: 'repeatable', label: 'Can be taken more than once', type: 'checkbox' },
        { key: 'desc', label: 'What it does (your own words)', type: 'textarea' }
      ]
    },
    subclasses: {
      label: 'Subclasses', single: 'subclass', nested: 'classes',
      fields: [
        { key: 'parent', label: 'Of class', type: 'parent', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'features', label: 'Features by level, one level per line: "3: Bladesong, Training in War"', type: 'levels' },
        { key: 'armor', label: 'Extra armour proficiencies', type: 'text' },
        { key: 'weapons', label: 'Extra weapon proficiencies', type: 'text' },
        { key: 'tools', label: 'Extra tool proficiencies', type: 'text' },
        { key: 'hpPerLevel', label: 'Extra HP per class level', type: 'number' },
        { key: 'unarmoredBase', label: 'Unarmoured AC base (e.g. 13 → 13 + DEX)', type: 'number' }
      ]
    }
  };

  const h = (tag, attrs, children) => {
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
    [].concat(children || []).forEach((c) => { if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  };

  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);

  function injectStyles() {
    if (document.getElementById('homebrew-styles')) return;
    const s = document.createElement('style');
    s.id = 'homebrew-styles';
    s.textContent = `
      #homebrew-editor { position: fixed; inset: 0; z-index: 99996; display: flex; align-items: flex-start; justify-content: center; padding: 20px 12px; overflow-y: auto; background: rgba(0,0,0,.72); backdrop-filter: blur(4px); }
      #homebrew-editor * { box-sizing: border-box; }
      .hb-card { width: 100%; max-width: 860px; background: var(--panel); color: var(--text); border: 2px solid var(--border-bright); border-radius: 12px; box-shadow: 0 0 50px rgba(0,0,0,.9); font-family: var(--font-body); }
      .hb-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 18px 8px; }
      .hb-title { font-family: var(--font-display); font-size: 20px; letter-spacing: 1px; color: var(--accent-strong); }
      .hb-tabs { display: flex; gap: 4px; flex-wrap: wrap; padding: 0 14px 10px; border-bottom: 1px solid var(--border); }
      .hb-tabs .btn.on { border-color: var(--accent); color: var(--accent-strong); }
      .hb-body { padding: 16px 18px; }
      .hb-note { font-size: 12px; color: var(--text-muted); margin: 4px 0 10px; }
      .hb-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
      .hb-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
      .hb-item .hb-name { flex: 1; min-width: 0; }
      .hb-item b { font-family: var(--font-display); color: var(--accent-strong); }
      .hb-item small { display: block; color: var(--text-dim); font-size: 11px; }
      .hb-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
      .hb-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-dim); }
      .hb-field.wide { grid-column: 1 / -1; }
      .hb-in { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 8px; font-family: var(--font-body); font-size: 14px; width: 100%; }
      textarea.hb-in { min-height: 80px; resize: vertical; }
      .hb-abil { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
      .hb-abil label { display: flex; flex-direction: column; align-items: center; font-size: 11px; text-transform: uppercase; }
      .hb-abil input { text-align: center; padding: 4px; }
      .hb-skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 2px 10px; color: var(--text); font-size: 13px; }
      .hb-acts { display: flex; gap: 8px; margin-top: 12px; }
      .hb-msg { font-size: 13px; margin-top: 8px; }
      .hb-msg.error { color: var(--danger-strong); }
      .hb-msg.ok { color: var(--success); }
      .hb-set { display: flex; gap: 10px; align-items: flex-start; padding: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; font-size: 14px; }
      .hb-set small { display: block; color: var(--text-dim); font-size: 12px; }
      @media (max-width: 640px) { .hb-form { grid-template-columns: 1fr; } .hb-abil { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    `;
    document.head.appendChild(s);
  }

  function close() {
    const el = document.getElementById('homebrew-editor');
    if (el) el.remove();
  }

  /* ---------- Form value <-> rules entry ---------- */

  // Turns the form's values into an entry in the rules' own shape, dropping empty fields.
  function toDef(kind, v) {
    const def = {};
    const num = (x) => (x === '' || x === null || x === undefined || isNaN(Number(x)) ? null : Number(x));
    KINDS[kind].fields.forEach((f) => {
      const val = v[f.key];
      if (f.key === 'parent' || f.key === 'choiceCount' || f.key === 'choiceAmount' || f.key === 'skillChoose') return;
      if (f.type === 'number') { const n = num(val); if (n) def[f.key] = n; }
      else if (f.type === 'abilities') {
        const o = {};
        ABILITIES.forEach((a) => { const n = num((val || {})[a]); if (n) o[a] = n; });
        if (Object.keys(o).length) def[f.key] = o;
      } else if (f.type === 'skills' || f.type === 'list') { if (val && val.length) def[f.key] = val; }
      else if (f.type === 'levels') { if (val && Object.keys(val).length) def[f.key] = val; }
      else if (f.type === 'checkbox') { if (val) def[f.key] = true; }
      else if (val !== undefined && String(val).trim()) def[f.key] = String(val).trim();
    });
    if (kind === 'species') {
      if (!def.size) def.size = 'Medium';
      if (!def.speed) def.speed = 30;
      if (num(v.choiceCount)) def.abilityChoice = { count: num(v.choiceCount), amount: num(v.choiceAmount) || 1 };
      if (num(v.skillChoose)) def.skillChoice = { choose: num(v.skillChoose), from: 'any' };
      if (!def.languages) def.languages = ['Common'];
    }
    return def;
  }

  function fromDef(kind, def, parent) {
    const v = Object.assign({}, def || {});
    if (parent) v.parent = parent;
    if (kind === 'species' && def) {
      if (def.abilityChoice) { v.choiceCount = def.abilityChoice.count; v.choiceAmount = def.abilityChoice.amount; }
      if (def.skillChoice) v.skillChoose = def.skillChoice.choose;
    }
    return v;
  }

  // "3: A, B" lines <-> { 3: ['A', 'B'] }
  const levelsToText = (o) => Object.keys(o || {}).filter((k) => o[k] && o[k].length).map((k) => k + ': ' + [].concat(o[k]).join(', ')).join('\n');
  function textToLevels(t) {
    const out = {};
    String(t || '').split('\n').forEach((line) => {
      const m = line.match(/^\s*(\d{1,2})\s*[:\-]\s*(.+)$/);
      if (!m) return;
      const lvl = Math.max(1, Math.min(20, Number(m[1])));
      out[lvl] = (out[lvl] || []).concat(m[2].split(',').map((s) => s.trim()).filter(Boolean));
    });
    return out;
  }

  /* ---------- The editor ---------- */

  function open(campId, campName) {
    const E = root.CharacterEngine;
    const SRD = root.RULES_SRD5;
    if (!E || !SRD || !root.Campaigns) return;
    injectStyles();
    close();
    let tab = 'species';
    let editing = null;     // { kind, id, parent } or { kind, id: null } for a new one
    let data = {};
    let settings = { allowManual: false, strict: true };

    const wrap = h('div', { id: 'homebrew-editor' });
    const card = h('div', { class: 'hb-card', role: 'dialog', 'aria-label': 'Homebrew editor' });
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    function load() {
      return Promise.all([
        window.fbCampaignGet('campaigns/' + campId + '/homebrew'),
        window.fbCampaignGet('campaigns/' + campId + '/settings/builder')
      ]).then(([hb, st]) => {
        data = hb || {};
        settings = { allowManual: !!(st && st.allowManual), strict: !(st && st.strict === false) };
        render();
      });
    }

    const merged = () => E.mergeRules(SRD, data);

    function render(msg, isError) {
      card.innerHTML = '';
      card.appendChild(h('div', { class: 'hb-head' }, [
        h('div', { class: 'hb-title', text: '📜 HOMEBREW · ' + (campName || '') }),
        h('div', {}, [
          h('button', { type: 'button', class: 'btn ghost small', text: '← Campaign', onclick: () => { close(); root.Campaigns.openManage(campId); } }),
          h('button', { type: 'button', class: 'btn ghost small', text: '✕', onclick: close })
        ])
      ]));
      card.appendChild(h('div', { class: 'hb-tabs' }, Object.keys(KINDS).concat(['settings']).map((k) => h('button', {
        type: 'button', class: 'btn ghost small' + (tab === k ? ' on' : ''), text: k === 'settings' ? '⚙ Builder settings' : KINDS[k].label,
        onclick: () => { tab = k; editing = null; render(); }
      }))));
      const body = h('div', { class: 'hb-body' });
      card.appendChild(body);
      if (tab === 'settings') renderSettings(body);
      else if (editing) renderForm(body);
      else renderList(body);
      if (msg) body.appendChild(h('div', { class: 'hb-msg ' + (isError ? 'error' : 'ok'), text: msg }));
    }

    function entries(kind) {
      const out = [];
      if (KINDS[kind].nested) {
        Object.keys(data[kind] || {}).forEach((parent) => Object.keys(data[kind][parent] || {}).forEach((id) => out.push({ id: id, parent: parent, def: data[kind][parent][id] })));
      } else {
        Object.keys(data[kind] || {}).forEach((id) => out.push({ id: id, parent: null, def: data[kind][id] }));
      }
      return out.sort((a, b) => String(a.def.name).localeCompare(String(b.def.name)));
    }

    function parentName(kind, parent) {
      const group = KINDS[kind].nested === 'species' ? merged().species : SRD.classes;
      return group[parent] ? group[parent].name : parent;
    }

    function renderList(body) {
      const kind = tab;
      body.appendChild(h('div', { class: 'hb-note', text: 'Everyone in this campaign can pick these in the character builder. Write the rules in your own words rather than copying a book.' }));
      body.appendChild(h('button', { type: 'button', class: 'btn small', text: '＋ New ' + KINDS[kind].single, onclick: () => { editing = { kind: kind, id: null, parent: null }; render(); } }));
      const list = entries(kind);
      const box = h('div', { class: 'hb-list' });
      if (!list.length) box.appendChild(h('div', { class: 'hb-note', text: 'None yet.' }));
      list.forEach((e) => {
        box.appendChild(h('div', { class: 'hb-item' }, [
          h('div', { class: 'hb-name' }, [h('b', { text: e.def.name || e.id }), h('small', { text: summary(kind, e) })]),
          h('button', { type: 'button', class: 'btn ghost small', text: '✏️ Edit', onclick: () => { editing = { kind: kind, id: e.id, parent: e.parent }; render(); } }),
          h('button', { type: 'button', class: 'btn ghost small', text: '🗑', title: 'Delete', onclick: () => {
            if (!confirm('Delete "' + (e.def.name || e.id) + '"? Characters already built with it keep their sheet, but can no longer be edited with it.')) return;
            root.Campaigns.saveHomebrew(campId, kind, e.id, null, e.parent).then(load).catch((err) => render(err.message, true));
          } })
        ]));
      });
      body.appendChild(box);
    }

    function summary(kind, e) {
      const d = e.def;
      const ab = (o) => Object.keys(o || {}).map((a) => a.toUpperCase() + ' +' + o[a]).join(', ');
      if (kind === 'species') return [ab(d.abilityBonuses), d.size, (d.speed || 30) + ' ft'].filter(Boolean).join(' · ');
      if (kind === 'subraces') return 'Subrace of ' + parentName(kind, e.parent) + (d.abilityBonuses ? ' · ' + ab(d.abilityBonuses) : '');
      if (kind === 'backgrounds') return (d.skills || []).map((s) => (SRD.skills[s] || { name: s }).name).join(', ');
      if (kind === 'feats') return d.requires ? 'Needs ' + Object.keys(d.requires).map((a) => a.toUpperCase() + ' ' + d.requires[a]).join(', ') : 'No prerequisite';
      if (kind === 'subclasses') return parentName(kind, e.parent) + ' · features at level ' + Object.keys(d.features || {}).join(', ');
      return '';
    }

    function renderForm(body) {
      const kind = editing.kind;
      const existing = editing.id ? (KINDS[kind].nested ? ((data[kind] || {})[editing.parent] || {})[editing.id] : (data[kind] || {})[editing.id]) : null;
      const v = fromDef(kind, existing, editing.parent);
      KINDS[kind].fields.forEach((f) => { if (v[f.key] === undefined && f.value !== undefined) v[f.key] = f.value; });

      body.appendChild(h('div', { class: 'hb-note', text: (editing.id ? 'Editing ' : 'New ') + KINDS[kind].single + '.' }));
      const form = h('form', { class: 'hb-form' });
      KINDS[kind].fields.forEach((f) => form.appendChild(field(f, v, kind)));
      const msg = h('div', { class: 'hb-msg hb-field wide' });
      form.appendChild(h('div', { class: 'hb-acts hb-field wide' }, [
        h('button', { type: 'submit', class: 'btn small', text: '💾 Save' }),
        h('button', { type: 'button', class: 'btn ghost small', text: 'Cancel', onclick: () => { editing = null; render(); } })
      ]));
      form.appendChild(msg);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fail = (text) => { msg.textContent = text; msg.className = 'hb-msg hb-field wide error'; };
        if (!String(v.name || '').trim()) return fail('Give it a name.');
        if (KINDS[kind].nested && !v.parent) return fail('Choose the ' + (KINDS[kind].nested === 'species' ? 'species' : 'class') + ' it belongs to.');
        const def = toDef(kind, v);
        def.name = String(v.name).trim();
        // A new entry gets an id from its name; one that would replace an SRD entry gets a suffix.
        let id = editing.id;
        if (!id) {
          id = slug(def.name) || ('hb_' + Date.now().toString(36));
          const srdGroup = kind === 'subraces' ? ((SRD.species[v.parent] || {}).subraces || {}) : kind === 'subclasses' ? ((SRD.classes[v.parent] || {}).subclasses || {}) : (SRD[kind] || {});
          const own = KINDS[kind].nested ? ((data[kind] || {})[v.parent] || {}) : (data[kind] || {});
          if (srdGroup[id] || own[id]) id = id.slice(0, 32) + '_' + Date.now().toString(36).slice(-3);
        }
        // Check it with the engine: a level 1 character using it must be possible.
        const trial = E.mergeRules(SRD, mergeEntry(kind, id, def, v.parent));
        if (kind === 'subclasses' && !trial.classes[v.parent].subclasses[id]) return fail('Something went wrong adding that subclass.');
        // Moving a nested entry to another parent: remove it from the old one.
        const moves = editing.id && KINDS[kind].nested && editing.parent && editing.parent !== v.parent;
        const save = () => root.Campaigns.saveHomebrew(campId, kind, id, def, v.parent || null);
        (moves ? root.Campaigns.saveHomebrew(campId, kind, editing.id, null, editing.parent).then(save) : save())
          .then(() => { editing = null; return load(); })
          .then(() => render('Saved "' + def.name + '".'))
          .catch((err) => fail(err.message || String(err)));
      });
      body.appendChild(form);
    }

    // The homebrew with one entry changed, for a trial merge.
    function mergeEntry(kind, id, def, parent) {
      const copy = JSON.parse(JSON.stringify(data || {}));
      if (KINDS[kind].nested) { copy[kind] = copy[kind] || {}; copy[kind][parent] = copy[kind][parent] || {}; copy[kind][parent][id] = def; }
      else { copy[kind] = copy[kind] || {}; copy[kind][id] = def; }
      return copy;
    }

    function field(f, v, kind) {
      const wide = ['skills', 'abilities', 'textarea', 'levels', 'list'].includes(f.type);
      const wrapEl = h('label', { class: 'hb-field' + (wide ? ' wide' : '') }, [f.label + (f.required ? ' *' : '')]);
      if (f.type === 'text' || f.type === 'number') {
        wrapEl.appendChild(h('input', { class: 'hb-in', type: f.type, value: v[f.key] === undefined ? '' : v[f.key], maxlength: 120, oninput: (e) => { v[f.key] = e.target.value; } }));
      } else if (f.type === 'textarea') {
        const t = h('textarea', { class: 'hb-in', maxlength: 3000, oninput: (e) => { v[f.key] = e.target.value; } });
        t.value = v[f.key] || '';
        wrapEl.appendChild(t);
      } else if (f.type === 'select') {
        wrapEl.appendChild(h('select', { class: 'hb-in', onchange: (e) => { v[f.key] = e.target.value; } }, f.options.map((o) => h('option', { value: o, text: o, selected: v[f.key] === o }))));
      } else if (f.type === 'parent') {
        const group = KINDS[kind].nested === 'species' ? merged().species : SRD.classes;
        wrapEl.appendChild(h('select', { class: 'hb-in', onchange: (e) => { v.parent = e.target.value || null; } },
          [h('option', { value: '', text: 'Choose…' })].concat(Object.keys(group).map((id) => h('option', { value: id, text: group[id].name + (group[id].homebrew ? ' (homebrew)' : ''), selected: v.parent === id })))));
      } else if (f.type === 'abilities') {
        v[f.key] = Object.assign({}, v[f.key] || {});
        wrapEl.appendChild(h('div', { class: 'hb-abil' }, ABILITIES.map((a) => h('label', {}, [a, h('input', { class: 'hb-in', type: 'number', value: v[f.key][a] || '', oninput: (e) => { v[f.key][a] = e.target.value; } })]))));
      } else if (f.type === 'skills') {
        const sel = new Set(v[f.key] || []);
        wrapEl.appendChild(h('div', { class: 'hb-skills' }, Object.keys(SRD.skills).map((s) => h('label', {}, [
          h('input', { type: 'checkbox', checked: sel.has(s), onchange: (e) => { if (e.target.checked) sel.add(s); else sel.delete(s); v[f.key] = Array.from(sel); } }), ' ' + SRD.skills[s].name
        ]))));
      } else if (f.type === 'list') {
        wrapEl.appendChild(h('input', { class: 'hb-in', value: (v[f.key] || []).join(', '), placeholder: 'Comma separated', oninput: (e) => { v[f.key] = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); } }));
      } else if (f.type === 'levels') {
        const t = h('textarea', { class: 'hb-in', placeholder: '3: First feature, Second feature\n6: Next feature', oninput: (e) => { v[f.key] = textToLevels(e.target.value); } });
        t.value = levelsToText(v[f.key]);
        wrapEl.appendChild(t);
      } else if (f.type === 'checkbox') {
        wrapEl.appendChild(h('input', { type: 'checkbox', checked: !!v[f.key], onchange: (e) => { v[f.key] = e.target.checked; } }));
      }
      return wrapEl;
    }

    function renderSettings(body) {
      const s = Object.assign({}, settings);
      body.appendChild(h('div', { class: 'hb-note', text: 'How the character builder treats players in this campaign.' }));
      const opt = (key, title, text, invert) => h('label', { class: 'hb-set' }, [
        h('input', { type: 'checkbox', checked: invert ? !s[key] : !!s[key], onchange: (e) => { s[key] = invert ? !e.target.checked : e.target.checked; } }),
        h('div', {}, [h('b', { text: title }), h('small', { text: text })])
      ]);
      body.appendChild(opt('allowManual', 'Players may type in ability scores', 'Adds a fourth method next to standard array, point buy and rolling.'));
      body.appendChild(opt('strict', 'Allow rule breaks (show them as warnings)', 'Off by default: characters must follow the rules (point buy budget, skill lists, prerequisites…). Missing choices are always required.', true));
      body.appendChild(h('div', { class: 'hb-acts' }, [h('button', { type: 'button', class: 'btn small', text: '💾 Save settings', onclick: () => {
        root.Campaigns.saveBuilderSettings(campId, s).then(() => { settings = s; render('Settings saved.'); }, (err) => render(err.message || String(err), true));
      } })]));
    }

    card.appendChild(h('div', { class: 'hb-body', text: 'Loading…' }));
    load().catch((err) => render('Could not load: ' + (err.message || err), true));
  }

  root.HomebrewEditor = { open: open, close: close, toDef: toDef, textToLevels: textToLevels };
})(typeof window !== 'undefined' ? window : this);
