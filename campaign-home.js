/* ========================================================
   CAMPAIGN SCREEN (LAYOUT_UI.md, L2)
   The Campaign section: the party with their HP, the latest
   journal notes, the way to the table, and for DMs the invite
   and the campaign tools. Everyone sees the same screen; DM-only
   parts are left out for players (and in "View as player").

   Reads: window.activeCampaign and window.Campaigns (campaign.js),
   each player's sheet (fbCharacterSheet, once per render of the
   member list) and, live, their HP and portrait (the same
   listeners the VTT uses). Writes nothing.
   ======================================================== */
(function (root) {
  'use strict';

  // character id -> { hp, portrait, stats, unsubs: [] } while the screen is open
  const watch = {};
  let box = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const myNick = () => (root.currentUser && root.currentUser.nickname ? String(root.currentUser.nickname).toLowerCase() : '');

  /* ---------- Live data per player character ---------- */

  function syncWatchers(chars) {
    const want = new Set(chars);
    chars.forEach((id) => {
      if (watch[id]) return;
      const w = { hp: null, portrait: null, stats: null, unsubs: [] };
      watch[id] = w;
      if (typeof root.fbListenToVttHp === 'function') w.unsubs.push(root.fbListenToVttHp(id, (hp) => { w.hp = hp; paintCard(id); }));
      if (typeof root.fbListenToCharacterPortrait === 'function') w.unsubs.push(root.fbListenToCharacterPortrait(id, (url) => { w.portrait = url; paintCard(id); }));
      if (typeof root.fbCharacterSheet === 'function') {
        root.fbCharacterSheet(id).then((sheet) => {
          const cs = (sheet && sheet.characterStats) || {};
          w.stats = { level: cs.level, cls: cs.characterClass, species: cs.subrace || cs.species };
          paintCard(id);
        }).catch(() => { });
      }
    });
    Object.keys(watch).forEach((id) => { if (!want.has(id)) stopOne(id); });
  }

  function stopOne(id) {
    (watch[id].unsubs || []).forEach((u) => { try { if (typeof u === 'function') u(); } catch (e) { } });
    delete watch[id];
  }

  // Leaving the Campaign section (or the campaign) stops every listener.
  function stop() { Object.keys(watch).forEach(stopOne); }

  /* ---------- Rendering ---------- */

  function hpHtml(hp) {
    const max = Number(hp && hp.max) || 0;
    if (!max) return '<div class="ch-hp ch-hp-none">HP not set</div>';
    const cur = Math.max(0, Number(hp.current) || 0);
    const temp = Math.max(0, Number(hp.temp) || 0);
    const pct = Math.min(100, Math.round((cur / max) * 100));
    const tone = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : 'ok';
    return '<div class="ch-hp" title="Hit points">' +
      '<div class="ch-hp-row"><span>HP</span><strong>' + cur + ' / ' + max + (temp ? ' <em>+' + temp + '</em>' : '') + '</strong></div>' +
      '<div class="ch-hp-bar"><div class="ch-hp-fill ' + tone + '" style="width:' + pct + '%"></div></div></div>';
  }

  function cardInner(m, w, opts) {
    const name = m.characterName || m.character;
    const pic = w && w.portrait
      ? '<img class="ch-portrait" src="' + esc(w.portrait) + '" alt="">'
      : '<div class="ch-portrait ch-initial" aria-hidden="true">' + esc(String(name || '?').slice(0, 1).toUpperCase()) + '</div>';
    const st = w && w.stats;
    const line = st ? [st.level ? 'Lvl ' + st.level : '', st.cls, st.species].filter(Boolean).join(' · ') : '…';
    let action = '';
    if (opts.canOpen) action = '<button type="button" class="btn ghost small" data-open="' + esc(m.character) + '">' + (opts.mine ? '🧙 My sheet' : '📖 Open sheet') + '</button>';
    return pic +
      '<div class="ch-body"><div class="ch-name">' + esc(name) + (opts.mine ? ' <span class="ch-you">you</span>' : '') + '</div>' +
      '<div class="ch-meta">' + esc(line) + '</div>' +
      '<div class="ch-meta ch-player">👤 ' + esc(m.nick) + '</div>' +
      hpHtml(w && w.hp) + action + '</div>';
  }

  // Repaints one card in place when its live data changes.
  function paintCard(id) {
    if (!box) return;
    const el = box.querySelector('.ch-card[data-char="' + (root.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!el || !el._member) return;
    el.innerHTML = cardInner(el._member, watch[id], el._opts);
  }

  function relTime(t) {
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    const d = Math.round(s / 86400);
    return d < 30 ? d + ' d ago' : new Date(t).toLocaleDateString();
  }

  function render(target) {
    box = target;
    if (!box) return;
    const c = root.activeCampaign;
    const C = root.Campaigns;
    if (!c || !C) {
      stop();
      box.innerHTML = '<div class="ch-empty-card"><h2>No campaign open</h2>' +
        '<p>Start your own campaign (you are its DM) or join one with an invite code.</p>' +
        '<button type="button" class="btn" data-act="picker">🏰 Pick or start a campaign</button></div>';
      return;
    }
    const viewing = C.viewingAs && C.viewingAs();
    const isDm = c.role === 'dm' && !viewing;
    const me = viewing ? viewing.nick : myNick();
    const members = (C.memberList && C.memberList()) || [];
    const players = members.filter((m) => m.role === 'player');
    const dms = members.filter((m) => m.role === 'dm');
    const withChar = players.filter((m) => m.character);
    syncWatchers(withChar.map((m) => m.character));

    const myRole = viewing ? 'Player (DM view as ' + viewing.name + ')'
      : isDm ? (c.owner === myNick() ? 'Dungeon Master · owner' : 'Dungeon Master · co-DM') : 'Player';
    const meMember = members.find((m) => m.nick === me);
    const needsChar = !isDm && meMember && meMember.role === 'player' && !meMember.character;

    /* Party */
    let party = '<section class="ch-panel" aria-labelledby="ch-party-h">' +
      '<div class="ch-panel-head"><h2 id="ch-party-h">Party <span class="ch-count">' + withChar.length + '</span></h2>' +
      (dms.length ? '<div class="ch-dms">👑 ' + dms.map((d) => esc(d.nick) + (d.nick === c.owner ? ' (owner)' : '')).join(', ') + '</div>' : '') + '</div>' +
      '<div class="ch-cards" id="ch-cards"></div>';
    if (!players.length) {
      party += '<div class="ch-empty">No players yet.' + (isDm ? ' Send them the invite link: they join with their own account and pick a character.' : '') + '</div>';
    }
    party += '</section>';

    /* Journal */
    const notes = (C.visibleNotes && C.visibleNotes()) || [];
    let journal = '<section class="ch-panel" aria-labelledby="ch-journal-h"><div class="ch-panel-head"><h2 id="ch-journal-h">Journal</h2>' +
      '<div class="ch-head-acts">' + (isDm ? '<button type="button" class="btn ghost small" data-act="note">✏ New note</button>' : '') +
      '<button type="button" class="btn ghost small" data-act="journal">📖 Open journal</button></div></div>';
    if (!notes.length) {
      journal += '<div class="ch-empty">' + (isDm ? 'No notes yet. Notes can go to everyone or only to some players.' : 'The DM has not shared any notes yet.') + '</div>';
    } else {
      journal += '<ul class="ch-notes">' + notes.slice(0, 3).map((n) => {
        const body = String(n.body || '').replace(/\s+/g, ' ').trim();
        const only = n.visibleTo && n.visibleTo !== 'all' ? ' <span class="ch-tag">only some players</span>' : '';
        return '<li><button type="button" class="ch-note" data-note="' + esc(n.id) + '"><span class="ch-note-title">' + esc(n.title || 'Untitled') + only + '</span>' +
          '<span class="ch-note-when">' + esc(relTime(n.updatedAt || n.createdAt)) + '</span>' +
          (body ? '<span class="ch-note-body">' + esc(body.length > 140 ? body.slice(0, 140) + '…' : body) + '</span>' : '') + '</button></li>';
      }).join('') + '</ul>' + (notes.length > 3 ? '<div class="ch-more">' + (notes.length - 3) + ' more in the journal</div>' : '');
    }
    journal += '</section>';

    /* Side */
    let side = '<button type="button" class="ch-table" data-act="table"><span class="ch-table-icon" aria-hidden="true">🗺</span>' +
      '<span><strong>Go to the table</strong><small>Map, tokens, initiative and dice</small></span></button>';
    side += '<section class="ch-panel ch-small"><div class="ch-kicker">Campaign</div><div class="ch-camp-name">' + esc(c.name) + '</div>' +
      '<div class="ch-meta">You are: <strong>' + esc(myRole) + '</strong></div>' +
      '<div class="ch-acts"><button type="button" class="btn ghost small" data-act="picker">🔄 Switch campaign</button></div></section>';
    if (needsChar) {
      side += '<section class="ch-panel ch-small ch-attn"><div class="ch-kicker">Your character</div>' +
        '<div class="ch-meta">Pick the character you play in ' + esc(c.name) + '.</div>' +
        '<div class="ch-acts"><button type="button" class="btn small" data-act="choose">🎭 Pick a character</button></div></section>';
    }
    if (isDm) {
      side += '<section class="ch-panel ch-small"><div class="ch-kicker">Invite players</div>' +
        '<div class="ch-code" title="Invite code">' + esc(c.inviteCode || '——') + '</div>' +
        '<div class="ch-meta">Players join with this code, or with the link.</div>' +
        '<div class="ch-acts"><button type="button" class="btn small" data-act="invite">📨 Copy invite link</button></div></section>';
      side += '<section class="ch-panel ch-small"><div class="ch-kicker">DM tools</div><div class="ch-acts ch-acts-col">' +
        '<button type="button" class="btn ghost small" data-act="manage">⚙ Manage campaign</button>' +
        '<button type="button" class="btn ghost small" data-act="homebrew">📜 Homebrew</button>' +
        '<button type="button" class="btn ghost small" data-act="items">📦 Item store</button>' +
        (withChar.length ? '<button type="button" class="btn ghost small" data-act="viewas">👁 View as player</button>' : '') +
        '</div></section>';
    }

    box.innerHTML = '<div class="ch-grid"><div class="ch-main">' + party + journal + '</div><aside class="ch-side" aria-label="Campaign actions">' + side + '</aside></div>';

    // Party cards, built as elements so a card can repaint itself (paintCard).
    const cards = box.querySelector('#ch-cards');
    withChar.forEach((m) => {
      const mine = m.nick === me;
      const opts = { mine: mine, canOpen: isDm || mine };
      const el = document.createElement('div');
      el.className = 'ch-card' + (mine ? ' ch-mine' : '');
      el.dataset.char = m.character;
      el._member = m;
      el._opts = opts;
      el.innerHTML = cardInner(m, watch[m.character], opts);
      cards.appendChild(el);
    });
    players.filter((m) => !m.character).forEach((m) => {
      const el = document.createElement('div');
      el.className = 'ch-card ch-pending';
      el.innerHTML = '<div class="ch-portrait ch-initial" aria-hidden="true">?</div><div class="ch-body"><div class="ch-name">' + esc(m.nick) + '</div><div class="ch-meta">No character yet</div></div>';
      cards.appendChild(el);
    });
  }

  /* ---------- Actions (one delegated listener) ---------- */

  function onClick(e) {
    const C = root.Campaigns;
    const c = root.activeCampaign;
    const t = e.target.closest('button');
    if (!t || !box || !box.contains(t) || !C) return;
    if (t.dataset.open) {
      const id = t.dataset.open;
      const viewing = C.viewingAs && C.viewingAs();
      if (c && c.role === 'dm' && !viewing && typeof root.dmSwitchActivePlayer === 'function') root.dmSwitchActivePlayer(id);
      if (typeof root.showSection === 'function') root.showSection('character');
      return;
    }
    if (t.dataset.note) { C.openJournal(); return; }
    const act = t.dataset.act;
    if (act === 'table') root.showSection('table');
    else if (act === 'picker') C.openPicker();
    else if (act === 'journal') C.openJournal();
    else if (act === 'note') C.openJournal('new');
    else if (act === 'choose') C.chooseCharacter && C.chooseCharacter();
    else if (act === 'invite') C.copyInvite();
    else if (act === 'manage' && c) C.openManage(c.id);
    else if (act === 'homebrew' && c && root.HomebrewEditor) root.HomebrewEditor.open(c.id, c.name);
    else if (act === 'items' && c && root.HomebrewEditor) root.HomebrewEditor.open(c.id, c.name, 'items');
    else if (act === 'viewas') C.viewAsPlayer(null);
  }
  if (typeof document !== 'undefined') document.addEventListener('click', onClick);

  root.CampaignHome = { render: render, stop: stop, hpHtml: hpHtml, relTime: relTime };
})(typeof window !== 'undefined' ? window : this);
