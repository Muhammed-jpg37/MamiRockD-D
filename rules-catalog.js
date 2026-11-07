/* ========================================================
   RULES SECTION (feature plan step 6.2): a searchable
   reference of the SRD catalogs in rules/catalog/ — rule
   sections, conditions, equipment, magic items, monsters —
   for 2014 (SRD 5.1) and 2024 (SRD 5.2).

   The JSON files are fetched only when the section is opened,
   one per tab and ruleset, and kept for the session.
   Writes nothing. The list is on the left and the entry on
   the right (stacked on phones).
   ======================================================== */
(function (root) {
  'use strict';

  const TABS = [
    { id: 'rules', label: '📖 Rules', file: 'rules', only: '2014' },
    { id: 'conditions', label: '🤕 Conditions', file: 'conditions' },
    { id: 'items', label: '🎒 Equipment', file: 'items' },
    { id: 'magic', label: '✨ Magic items', file: 'magic-items' },
    { id: 'monsters', label: '🐉 Monsters', file: 'monsters' }
  ];
  const PREFIX = { 2014: 'srd51', 2024: 'srd52' };
  const LS = 'dnd-rules-view';

  const cache = {};       // 'srd51-monsters' -> { meta, entries }
  let view = { tab: 'conditions', ruleset: '2014', q: '', filter: '', open: null };
  try { Object.assign(view, JSON.parse(localStorage.getItem(LS) || '{}'), { open: null }); } catch (e) { }
  let box = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const remember = () => { try { localStorage.setItem(LS, JSON.stringify({ tab: view.tab, ruleset: view.ruleset })); } catch (e) { } };

  function load(tab, ruleset) {
    const t = TABS.find((x) => x.id === tab);
    const key = PREFIX[ruleset] + '-' + t.file;
    if (cache[key]) return Promise.resolve(cache[key]);
    return fetch('rules/catalog/' + key + '.json').then((r) => {
      if (!r.ok) throw new Error('Could not load ' + key + ' (' + r.status + ')');
      return r.json();
    }).then((data) => { cache[key] = data; return data; });
  }

  /* ---------- Text: the small bit of Markdown the SRD data uses ---------- */

  const inline = (s) => esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>')
    .replace(/_([^_\n]+?)_/g, '<em>$1</em>');

  // Paragraphs; "- " lines become lists, "| a | b |" lines a table, "#…" lines a heading.
  function md(paras) {
    const lines = [].concat(paras || []).join('\n').split('\n');
    let html = '', list = null, table = null;
    const flush = () => {
      if (list) { html += '<ul>' + list.map((l) => '<li>' + inline(l) + '</li>').join('') + '</ul>'; list = null; }
      if (table) {
        const rows = table.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map((r) => r.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => c.trim()));
        html += '<div class="rc-table-wrap"><table class="rc-table">' + rows.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + inline(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table></div>';
        table = null;
      }
    };
    lines.forEach((raw) => {
      const l = raw.trim();
      if (!l) { flush(); return; }
      if (/^\|/.test(l)) { if (list) flush(); (table = table || []).push(l); return; }
      if (/^[-•]\s+/.test(l)) { if (table) flush(); (list = list || []).push(l.replace(/^[-•]\s+/, '')); return; }
      flush();
      const h = l.match(/^(#{1,6})\s*(.+)$/);
      if (h) html += '<h4 class="rc-h">' + inline(h[2]) + '</h4>';
      else html += '<p>' + inline(l) + '</p>';
    });
    flush();
    return html;
  }

  /* ---------- One entry ---------- */

  const mod = (n) => { const m = Math.floor((n - 10) / 2); return (m >= 0 ? '+' : '') + m; };
  const line = (label, v) => (v ? '<div class="rc-line"><strong>' + esc(label) + '</strong> ' + esc(v) + '</div>' : '');
  const block = (title, list) => (list && list.length ? '<h4 class="rc-h">' + esc(title) + '</h4>' + list.map((a) =>
    '<p><strong><em>' + esc(a.name) + (a.usage ? ' (' + esc(a.usage) + ')' : '') + '.</em></strong> ' + inline(a.desc) + '</p>').join('') : '');

  function monsterHtml(m) {
    const ab = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    return '<div class="rc-sub">' + esc([m.size, m.type, m.alignment].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="rc-stats">' +
      line('Armor Class', m.ac + (m.acNote ? ' (' + m.acNote + ')' : '')) +
      line('Hit Points', m.hp + (m.hitDice ? ' (' + m.hitDice + ')' : '')) +
      line('Speed', m.speed) + '</div>' +
      '<div class="rc-abil">' + ab.map((a) => '<div><span>' + a.toUpperCase() + '</span><b>' + m.abilities[a] + '</b><small>' + mod(m.abilities[a]) + '</small></div>').join('') + '</div>' +
      '<div class="rc-stats">' +
      line('Saving Throws', m.saves) + line('Skills', m.skills) +
      line('Damage Vulnerabilities', m.vulnerabilities) + line('Damage Resistances', m.resistances) +
      line('Damage Immunities', m.immunities) + line('Condition Immunities', m.conditionImmunities) +
      line('Senses', m.senses) + line('Languages', m.languages) +
      line('Challenge', m.cr + (m.xp != null ? ' (' + Number(m.xp).toLocaleString() + ' XP)' : '') + (m.pb ? ' · Proficiency +' + m.pb : '')) + '</div>' +
      block('Traits', m.traits) + block('Actions', m.actions) + block('Bonus Actions', m.bonusActions) +
      block('Reactions', m.reactions) + block('Legendary Actions', m.legendary);
  }

  function itemHtml(i) {
    const facts = [];
    if (i.category) facts.push(['Category', i.category]);
    if (i.cost) facts.push(['Cost', i.cost]);
    if (i.weight != null) facts.push(['Weight', i.weight + ' lb']);
    if (i.damage) facts.push(['Damage', i.damage + (i.versatile ? ' (versatile ' + i.versatile + ')' : '')]);
    if (i.range) facts.push(['Range', i.range + ' ft']);
    if (i.properties && i.properties.length) facts.push(['Properties', i.properties.join(', ')]);
    if (i.mastery) facts.push(['Mastery', i.mastery]);
    if (i.armor) facts.push(['Armor Class', (i.kind === 'shield' ? '+' : '') + i.armor.base + (i.armor.dex ? ' + Dex' + (i.armor.max ? ' (max ' + i.armor.max + ')' : '') : '')]);
    if (i.strMin) facts.push(['Strength', i.strMin]);
    if (i.stealthDisadvantage) facts.push(['Stealth', 'Disadvantage']);
    let html = '<div class="rc-stats">' + facts.map((f) => line(f[0], String(f[1]))).join('') + '</div>';
    if (i.contents && i.contents.length) html += '<h4 class="rc-h">Contents</h4><ul>' + i.contents.map((c) => '<li>' + esc((c.qty > 1 ? c.qty + ' × ' : '') + c.name) + '</li>').join('') + '</ul>';
    return html + md(i.desc);
  }

  function magicHtml(m) {
    const att = m.attunement === true ? 'requires attunement' : (m.attunement || '');
    return '<div class="rc-sub">' + esc([m.typeLine || m.category, m.rarity, att].filter(Boolean).join(' · ')) + '</div>' +
      (m.variantOf ? '<div class="rc-line">A version of <strong>' + esc(m.variantOf) + '</strong>.</div>' : '') + md(m.desc);
  }

  /* ---------- Catalog item -> campaign item store / sheet item ---------- */

  const plain = (s) => String(s || '').replace(/\*\*\*|\*\*|\*|_/g, '');
  const ICONS = { weapon: '⚔️', armor: '🥋', shield: '🛡️', ammunition: '🏹', tool: '🔧', pack: '🎒', mount: '🐴', gear: '🎒' };

  // Where a magic item is worn, from its name (the SRD data has no slot).
  function slotFromName(n) {
    if (/\b(ring)\b/i.test(n)) return 'ring1';
    if (/\b(cloak|cape|mantle|robe)\b/i.test(n)) return 'cloak';
    if (/\b(boots|slippers)\b/i.test(n)) return 'boots';
    if (/\b(gloves|gauntlets|bracers)\b/i.test(n)) return 'hands';
    if (/\b(helm|hat|circlet|headband|crown|cap)\b/i.test(n)) return 'head';
    if (/\b(amulet|necklace|periapt|medallion|brooch|scarab)\b/i.test(n)) return 'neck';
    if (/\bbelt\b/i.test(n)) return 'belt';
    return '';
  }

  // The shape of an item in the campaign's item store (homebrew editor, Items tab);
  // HomebrewEditor.itemForSheet turns it into a sheet item.
  function toStoreDef(tab, e) {
    const facts = [];
    let def = { name: e.name, rarity: 'Common', icon: ICONS[e.kind] || '🎁', type: 'Misc', source: e.ruleset === '2024' ? 'SRD 5.2' : 'SRD 5.1' };
    if (tab === 'items') {
      if (e.kind === 'weapon') {
        Object.assign(def, { type: 'Weapon', slot: 'main', proficiencyType: e.weaponCategory === 'Martial' ? 'Martial' : 'Simple' });
        if (e.damage) facts.push('Damage ' + e.damage + (e.versatile ? ' (versatile ' + e.versatile + ')' : ''));
        if (e.range) facts.push('Range ' + e.range + ' ft');
        if (e.properties && e.properties.length) facts.push(e.properties.join(', '));
        if (e.mastery) facts.push('Mastery: ' + e.mastery);
      } else if (e.kind === 'armor' && e.armor) {
        Object.assign(def, { type: 'Armor', slot: 'chest', acBonus: e.armor.base, armorCategory: e.armor.category || (e.armor.dex ? (e.armor.max ? 'Medium' : 'Light') : 'Heavy') });
        facts.push('AC ' + e.armor.base + (e.armor.dex ? ' + Dex' + (e.armor.max ? ' (max ' + e.armor.max + ')' : '') : ''));
        if (e.strMin) facts.push('Strength ' + e.strMin);
        if (e.stealthDisadvantage) facts.push('Stealth disadvantage');
      } else if (e.kind === 'shield') {
        Object.assign(def, { type: 'Shield', slot: 'off', acBonus: (e.armor && e.armor.base) || 2 });
        facts.push('+' + def.acBonus + ' AC');
      } else if (e.kind === 'ammunition') def.type = 'Ammunition';
      if (typeof e.weight === 'number') def.weight = e.weight;
      if (e.cost) facts.push('Cost ' + e.cost);
      if (e.contents && e.contents.length) facts.push('Contains: ' + e.contents.map((c) => (c.qty > 1 ? c.qty + ' × ' : '') + c.name).join(', '));
    } else {
      const cat = String(e.category || '') + ' ' + String(e.typeLine || '');
      def.rarity = e.rarity && e.rarity !== 'Varies' ? e.rarity : 'Uncommon';
      def.attunementRequired = !!e.attunement;
      if (/\bring\b/i.test(cat)) { def.type = 'Ring'; def.icon = '💍'; }
      else if (/potion/i.test(cat)) { def.type = 'Consumable'; def.icon = '🧪'; }
      else if (/scroll/i.test(cat)) { def.type = 'Consumable'; def.icon = '📜'; }
      else if (/weapon/i.test(cat)) { def.type = 'Weapon'; def.icon = '⚔️'; def.slot = 'main'; }
      else if (/armor/i.test(cat)) { def.type = /shield/i.test(e.name) ? 'Shield' : 'Armor'; def.icon = '🛡️'; def.slot = def.type === 'Shield' ? 'off' : 'chest'; }
      else if (/\b(wand|rod|staff)\b/i.test(cat)) { def.type = 'Wondrous Item'; def.icon = '🪄'; def.slot = 'main'; }
      else { def.type = 'Wondrous Item'; def.icon = '✨'; }
      if (def.type === 'Wondrous Item' || def.type === 'Ring') def.slot = def.slot || slotFromName(e.name);
      if (e.typeLine) facts.push(e.typeLine);
    }
    if (!def.slot) delete def.slot;
    def.desc = facts.concat((e.desc || []).map(plain)).join('\n').slice(0, 3000);
    return def;
  }

  function canAddToSheet() {
    return !!(root.currentUser && typeof root.addItemToOpenSheet === 'function' && !(document.body && document.body.classList.contains('dm-no-sheet')));
  }
  function canAddToStore() {
    const c = root.activeCampaign;
    const C = root.Campaigns;
    return !!(c && c.role === 'dm' && C && typeof C.saveHomebrew === 'function' && !(C.viewingAs && C.viewingAs()));
  }

  function addButtons(tab) {
    if (tab !== 'items' && tab !== 'magic') return '';
    const nameEl = document.getElementById('strip-name');
    const who = nameEl && nameEl.textContent ? nameEl.textContent : 'the open sheet';
    let html = '';
    if (canAddToSheet()) html += '<button type="button" class="btn small" data-rc="add-sheet" title="Adds it to the sheet open in the Character section">➕ Add to ' + esc(who) + '</button>';
    if (canAddToStore()) html += '<button type="button" class="btn ghost small" data-rc="add-store" title="Adds it to the campaign item store, for 🎁 Gift Loot">📦 Add to item store</button>';
    return html ? '<div class="rc-adds">' + html + '<span class="rc-add-msg" role="status"></span></div>' : '';
  }

  function addCurrent(where) {
    const data = current();
    const e = data && data.entries.find((x) => x.id === view.open);
    const msg = box && box.querySelector('.rc-add-msg');
    const say = (t, bad) => { if (msg) { msg.textContent = t; msg.classList.toggle('rc-bad', !!bad); } };
    if (!e) return;
    const def = toStoreDef(view.tab, e);
    if (where === 'sheet') {
      if (!canAddToSheet() || !root.HomebrewEditor) return say('Open a character sheet first.', true);
      const item = root.HomebrewEditor.itemForSheet(def, 1);
      item.fromCatalog = (view.ruleset === '2024' ? 'srd52:' : 'srd51:') + e.id;
      root.addItemToOpenSheet(item);
      say('Added to ' + ((document.getElementById('strip-name') || {}).textContent || 'the sheet') + '.');
    } else {
      if (!canAddToStore()) return say('Only the campaign\'s DMs can add to its item store.', true);
      const c = root.activeCampaign;
      const have = ((root.Campaigns.homebrew && root.Campaigns.homebrew()) || {}).items || {};
      if (Object.values(have).some((d) => d && d.name === def.name)) return say('"' + def.name + '" is already in the item store.', true);
      let id = String(e.id).slice(0, 36);
      if (have[id]) id = id.slice(0, 32) + '_' + Date.now().toString(36).slice(-3);
      root.Campaigns.saveHomebrew(c.id, 'items', id, def).then(() => say('Added to the item store of ' + c.name + '.'), (err) => say(err.message || String(err), true));
    }
  }

  function entryHtml(tab, e) {
    let body = '';
    if (tab === 'monsters') body = monsterHtml(e);
    else if (tab === 'items') body = itemHtml(e);
    else if (tab === 'magic') body = magicHtml(e);
    else body = (e.section ? '<div class="rc-sub">' + esc(e.chapter + ' › ' + e.section) + '</div>' : e.chapter && e.chapter !== e.name ? '<div class="rc-sub">' + esc(e.chapter) + '</div>' : '') + md(e.desc);
    return '<button type="button" class="btn ghost small rc-back" data-rc="back">← List</button><h3 class="rc-title">' + esc(e.name) + '</h3>' + addButtons(tab) + body;
  }

  /* ---------- Lists and filters ---------- */

  const CR_BANDS = [['', 'Any CR'], ['0-1', 'CR 0–1'], ['2-4', 'CR 2–4'], ['5-10', 'CR 5–10'], ['11-16', 'CR 11–16'], ['17-30', 'CR 17+']];
  const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Varies'];

  function filterOptions(tab, entries) {
    if (tab === 'monsters') return CR_BANDS;
    if (tab === 'items') return [['', 'All equipment']].concat([...new Set(entries.map((e) => e.kind))].sort().map((k) => [k, k.charAt(0).toUpperCase() + k.slice(1)]));
    if (tab === 'magic') return [['', 'Any rarity']].concat(RARITIES.filter((r) => entries.some((e) => e.rarity === r)).map((r) => [r, r]));
    if (tab === 'rules') return [['', 'All chapters']].concat([...new Set(entries.map((e) => e.chapter))].map((c) => [c, c]));
    return null;
  }

  function matches(tab, e, q, f) {
    if (f) {
      if (tab === 'monsters') { const [a, b] = f.split('-').map(Number); if (!(e.crValue >= a && e.crValue <= b)) return false; }
      if (tab === 'items' && e.kind !== f) return false;
      if (tab === 'magic' && e.rarity !== f) return false;
      if (tab === 'rules' && e.chapter !== f) return false;
    }
    if (!q) return true;
    if (e.name.toLowerCase().includes(q)) return true;
    // Rules and conditions are short enough to search their text too.
    if ((tab === 'rules' || tab === 'conditions') && (e.desc || []).join(' ').toLowerCase().includes(q)) return true;
    if (tab === 'monsters' && String(e.type).toLowerCase().includes(q)) return true;
    return false;
  }

  function meta(tab, e) {
    if (tab === 'monsters') return 'CR ' + e.cr + ' · ' + e.type;
    if (tab === 'items') return [e.category, e.cost].filter(Boolean).join(' · ');
    if (tab === 'magic') return [e.rarity, e.attunement ? 'attunement' : ''].filter(Boolean).join(' · ');
    if (tab === 'rules') return e.section || e.chapter;
    return '';
  }

  /* ---------- Render ---------- */

  function render(target) {
    box = target || box;
    if (!box) return;
    const tab = TABS.find((t) => t.id === view.tab) || TABS[1];
    if (tab.only && tab.only !== view.ruleset) view.ruleset = tab.only;
    box.innerHTML = '<div class="rc-head">' +
      '<div class="rc-tabs" role="tablist" aria-label="Catalog">' + TABS.map((t) => '<button type="button" role="tab" aria-selected="' + (t.id === tab.id) + '" class="nav-tab-btn' + (t.id === tab.id ? ' active' : '') + '" data-rc-tab="' + t.id + '">' + t.label + '</button>').join('') + '</div>' +
      '<div class="rc-ruleset" role="group" aria-label="Rules version">' + ['2014', '2024'].map((r) => '<button type="button" class="btn ghost small' + (r === view.ruleset ? ' rc-on' : '') + '" data-rc-ruleset="' + r + '"' + (tab.only && tab.only !== r ? ' disabled title="The SRD 5.2 data has no rule sections"' : '') + '>' + r + '</button>').join('') + '</div></div>' +
      '<div class="rc-body' + (view.open ? ' rc-reading' : '') + '"><div class="rc-list-col">' +
      '<div class="rc-filters"><input type="search" class="rc-search" placeholder="Search ' + esc(tab.label.replace(/^\S+\s/, '').toLowerCase()) + '…" value="' + esc(view.q) + '" aria-label="Search">' +
      '<select class="rc-filter" aria-label="Filter" hidden></select></div>' +
      '<div class="rc-count"></div><ul class="rc-list" role="listbox"><li class="rc-loading">Loading…</li></ul></div>' +
      '<article class="rc-entry"><div class="rc-empty">Pick an entry from the list.</div></article></div>' +
      '<div class="rc-attrib"></div>';
    load(tab.id, view.ruleset).then((data) => {
      if (!box || view.tab !== tab.id) return;
      const sel = box.querySelector('.rc-filter');
      const opts = filterOptions(tab.id, data.entries);
      if (opts) {
        sel.hidden = false;
        sel.innerHTML = opts.map((o) => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>').join('');
        if (opts.some((o) => o[0] === view.filter)) sel.value = view.filter; else view.filter = '';
      }
      box.querySelector('.rc-attrib').textContent = data.meta.attribution;
      paintList(data);
      if (view.open) openEntry(view.open, data);
    }).catch((err) => { if (box) box.querySelector('.rc-list').innerHTML = '<li class="rc-loading">' + esc(err.message) + '</li>'; });
  }

  function current() { return cache[PREFIX[view.ruleset] + '-' + TABS.find((t) => t.id === view.tab).file]; }

  function paintList(data) {
    data = data || current();
    if (!box || !data) return;
    const q = view.q.trim().toLowerCase();
    const hits = data.entries.filter((e) => matches(view.tab, e, q, view.filter));
    box.querySelector('.rc-count').textContent = hits.length + ' of ' + data.entries.length;
    const ul = box.querySelector('.rc-list');
    ul.innerHTML = hits.length ? hits.slice(0, 400).map((e) => '<li><button type="button" role="option" class="rc-item' + (e.id === view.open ? ' rc-on' : '') + '" data-rc-id="' + esc(e.id) + '"><span class="rc-name">' + esc(e.name) + '</span><span class="rc-meta">' + esc(meta(view.tab, e)) + '</span></button></li>').join('')
      : '<li class="rc-loading">Nothing matches.</li>';
  }

  function openEntry(id, data) {
    data = data || current();
    const e = data && data.entries.find((x) => x.id === id);
    if (!e || !box) return;
    view.open = id;
    box.querySelector('.rc-body').classList.add('rc-reading');
    box.querySelector('.rc-entry').innerHTML = entryHtml(view.tab, e);
    box.querySelectorAll('.rc-item').forEach((b) => b.classList.toggle('rc-on', b.dataset.rcId === id));
    box.querySelector('.rc-entry').scrollTop = 0;
  }

  /* ---------- Events (delegated) ---------- */

  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!box || !box.contains(e.target)) return;
      const t = e.target.closest('[data-rc-tab],[data-rc-ruleset],[data-rc-id],[data-rc]');
      if (!t || t.disabled) return;
      if (t.dataset.rcTab) { view.tab = t.dataset.rcTab; view.q = ''; view.filter = ''; view.open = null; remember(); render(); }
      else if (t.dataset.rcRuleset) { view.ruleset = t.dataset.rcRuleset; view.open = null; remember(); render(); }
      else if (t.dataset.rcId) openEntry(t.dataset.rcId);
      else if (t.dataset.rc === 'add-sheet') addCurrent('sheet');
      else if (t.dataset.rc === 'add-store') addCurrent('store');
      else if (t.dataset.rc === 'back') { view.open = null; box.querySelector('.rc-body').classList.remove('rc-reading'); paintList(); }
    });
    document.addEventListener('input', (e) => {
      if (!box || !e.target.classList || !e.target.classList.contains('rc-search') || !box.contains(e.target)) return;
      view.q = e.target.value; paintList();
    });
    document.addEventListener('change', (e) => {
      if (!box || !e.target.classList || !e.target.classList.contains('rc-filter') || !box.contains(e.target)) return;
      view.filter = e.target.value; paintList();
    });
  }

  root.RulesCatalog = { render: render, load: load, md: md, matches: matches, toStoreDef: toStoreDef, slotFromName: slotFromName, TABS: TABS };
})(typeof window !== 'undefined' ? window : this);
