/* ========================================================
   CAMPAIGNS
   An account can own several characters and belong to several
   campaigns, with a role (dm / player) per campaign.

   Firebase layout:
     campaigns/<campId>                 { name, owner, createdAt, inviteCode }
     campaigns/<campId>/members/<nick>  { role: 'dm' | 'player', character: <charId> | null, joinedAt }
     invites/<code>                     <campId>
     characters/<charId>                { name, owner: <nick>, createdAt }
     users/<nick>/campaigns/<campId>    true
     inventories/<charId>               the character sheet (unchanged format)

   Characters from before campaigns keep their nickname as their id, so
   inventories/<nick> already is their sheet and nothing has to be copied.
   The first campaign's id is 'main', which is where the VTT table lives.
   ======================================================== */
(function () {
  'use strict';

  const FIRST_CAMPAIGN_ID = 'main';
  const FIRST_CAMPAIGN_NAME = 'MamiRock';
  const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
  const INVITE_LENGTH = 6;
  const SKIP_KEY = 'dnd-campaign-migration-skipped';

  function newInviteCode() {
    const bytes = new Uint32Array(INVITE_LENGTH);
    crypto.getRandomValues(bytes);
    let code = '';
    for (let i = 0; i < INVITE_LENGTH; i++) code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
    return code;
  }

  // Waits for the Firebase module (it loads after this file).
  function firebaseReady(timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 10000);
    return new Promise((resolve, reject) => {
      (function check() {
        if (typeof window.fbCampaignUpdate === 'function' && typeof window.fbAccountDirectory === 'function') return resolve();
        if (Date.now() > deadline) return reject(new Error('Firebase not available'));
        setTimeout(check, 200);
      })();
    });
  }

  /* ---------- Migration: today's single table becomes the first campaign ---------- */

  // Pure: works out what to write from the account directory. Nothing is deleted or overwritten.
  // accounts: { key: { nickname, role, createdAt } }  (no passwords)
  function buildMigration(accounts, now) {
    now = now || Date.now();
    const keys = Object.keys(accounts || {}).sort();
    const dms = keys.filter((k) => accounts[k].role === 'dm');
    if (!dms.length) return null;

    // Owner: the 'dm' account if there is one, else the oldest DM account.
    const owner = dms.includes('dm') ? 'dm' : dms.slice().sort((a, b) => (accounts[a].createdAt || 0) - (accounts[b].createdAt || 0))[0];
    const inviteCode = newInviteCode();
    const members = {};
    const patch = {};

    keys.forEach((k) => {
      const acc = accounts[k];
      const isDm = acc.role === 'dm';
      // DM accounts hold the DM's vault, not a player character.
      members[k] = { role: isDm ? 'dm' : 'player', character: isDm ? null : k, joinedAt: now };
      if (!isDm) patch['characters/' + k] = { name: acc.nickname, owner: k, createdAt: acc.createdAt || now };
      patch['users/' + k + '/campaigns/' + FIRST_CAMPAIGN_ID] = true;
    });

    patch['campaigns/' + FIRST_CAMPAIGN_ID] = { name: FIRST_CAMPAIGN_NAME, owner: owner, createdAt: now, inviteCode: inviteCode, members: members };
    patch['invites/' + inviteCode] = FIRST_CAMPAIGN_ID;

    return {
      patch: patch,
      summary: {
        campaign: FIRST_CAMPAIGN_NAME,
        owner: owner,
        inviteCode: inviteCode,
        dms: dms,
        players: keys.filter((k) => accounts[k].role !== 'dm'),
        writes: Object.keys(patch).length
      }
    };
  }

  // Works out the migration without writing anything. Resolves with { needed, summary }.
  function previewMigration() {
    return firebaseReady().then(() => window.fbCampaignGet('campaigns/' + FIRST_CAMPAIGN_ID)).then((existing) => {
      if (existing) return { needed: false, summary: null };
      return window.fbAccountDirectory().then((accounts) => {
        const plan = buildMigration(accounts);
        return { needed: !!plan, summary: plan ? plan.summary : null, plan: plan };
      });
    });
  }

  let migrating = false;

  // Runs once, for a DM, after asking. Only adds records.
  function migrateIfNeeded() {
    const u = window.currentUser;
    if (migrating || !u || u.role !== 'dm') return Promise.resolve(false);
    try { if (sessionStorage.getItem(SKIP_KEY)) return Promise.resolve(false); } catch (e) { }
    migrating = true;
    return previewMigration()
      .then((res) => {
        if (!res.needed) return false;
        const s = res.summary;
        const ok = confirm(
          'Set up campaigns?\n\n' +
          'Everything on this site so far becomes the first campaign, "' + s.campaign + '".\n' +
          '• DM: ' + s.dms.join(', ') + ' (owner: ' + s.owner + ')\n' +
          '• Players: ' + s.players.length + '\n\n' +
          'Nothing is deleted or moved; ' + s.writes + ' new records are added.'
        );
        if (!ok) {
          try { sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) { }
          return false;
        }
        // Someone else may have finished it while the dialog was open.
        return window.fbCampaignGet('campaigns/' + FIRST_CAMPAIGN_ID).then((existing) => {
          if (existing) return false;
          return window.fbCampaignUpdate(res.plan.patch).then(() => {
            console.log('✅ Campaigns set up: "' + s.campaign + '", invite code ' + s.inviteCode);
            return true;
          });
        });
      })
      .catch((err) => {
        console.warn('Campaign set-up skipped:', err);
        return false;
      })
      .finally(() => { migrating = false; });
  }

  /* ---------- Active campaign ---------- */

  const ACTIVE_KEY_PREFIX = 'dnd-active-campaign:';   // + nickname, in localStorage
  const PENDING_JOIN_KEY = 'dnd-pending-join';        // invite code from a ?join= link, in sessionStorage
  let active = null;          // { id, name, owner, inviteCode, role, character, memberCount }
  let applyingRole = false;   // true while we re-run loginUser() with the campaign role

  // An invite link (?join=CODE) is remembered until the visitor has logged in.
  (function captureJoinLink() {
    try {
      const params = new URLSearchParams(location.search);
      const code = params.get('join');
      if (!code) return;
      sessionStorage.setItem(PENDING_JOIN_KEY, normaliseCode(code));
      params.delete('join');
      const rest = params.toString();
      history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    } catch (e) { }
  })();

  function normaliseCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function myKey() {
    const u = window.currentUser;
    return u && u.nickname ? String(u.nickname).toLowerCase() : null;
  }

  function inviteLink(code) {
    return location.origin + location.pathname + '?join=' + code;
  }

  // The character an account brings when it joins. Until accounts can hold several characters
  // (step 3), that is the account's own character, if it has one.
  function defaultCharacterFor(nick) {
    return window.fbCampaignGet('characters/' + nick).then((c) => (c ? nick : null));
  }

  /* ---------- Characters (an account can have several) ---------- */

  // [{ id, name }] for this account. Characters from before campaigns have the nickname as id and
  // aren't in users/<nick>/characters yet; they're added to it the first time they're seen.
  function loadMyCharacters(nick) {
    return Promise.all([
      window.fbCampaignGet('users/' + nick + '/characters'),
      window.fbCampaignGet('characters/' + nick)
    ]).then(([index, legacy]) => {
      const ids = Object.keys(index || {});
      if (legacy && legacy.owner === nick && !ids.includes(nick)) {
        ids.unshift(nick);
        window.fbCampaignUpdate({ ['users/' + nick + '/characters/' + nick]: true }).catch(() => {});
      }
      return Promise.all(ids.map((id) => (id === nick && legacy ? Promise.resolve(legacy) : window.fbCampaignGet('characters/' + id))
        .then((c) => (c && c.owner === nick ? { id: id, name: c.name || id } : null))));
    }).then((list) => list.filter(Boolean));
  }

  // Opens the character forge for a new character of this account; resolves with its id once
  // the sheet is saved. Nothing is written if the forge is closed without finishing.
  function createCharacter(name) {
    const nick = myKey();
    name = String(name || '').trim().slice(0, 40);
    if (!nick) return Promise.reject(new Error('Log in first'));
    if (!name) return Promise.reject(new Error('Give the character a name'));
    if (typeof window.openCharacterForgeModal !== 'function') return Promise.reject(new Error('Character forge not available'));
    const id = 'ch' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return new Promise((resolve, reject) => {
      closePicker();   // the forge opens underneath the picker otherwise
      window.openCharacterForgeModal({
        nickname: name,
        characterId: id,
        onDone: () => {
          const patch = {};
          patch['characters/' + id] = { name: name, owner: nick, createdAt: Date.now() };
          patch['users/' + nick + '/characters/' + id] = true;
          window.fbCampaignUpdate(patch).then(() => resolve(id), reject);
        }
      });
    });
  }

  // Sets which of this account's characters it plays in a campaign.
  function setCampaignCharacter(campId, charId) {
    const nick = myKey();
    if (!nick) return Promise.reject(new Error('Log in first'));
    return window.fbCampaignUpdate({ ['campaigns/' + campId + '/members/' + nick + '/character']: charId }).then(() => {
      if (active && active.id === campId) {
        active.character = charId;
        window.activeCampaign = Object.assign({}, active);
        showActiveCharacter();
        renderChip();
        window.dispatchEvent(new CustomEvent('campaignchange', { detail: window.activeCampaign }));
      }
    });
  }

  // Puts the active campaign's character on screen. DMs keep their own vault.
  function showActiveCharacter() {
    if (!active || active.role !== 'player' || !active.character) return;
    if (typeof window.switchActiveCharacter === 'function') window.switchActiveCharacter(active.character);
  }

  // The campaigns this account belongs to, with its role and character in each.
  function loadMyCampaigns(nick) {
    return window.fbCampaignGet('users/' + nick + '/campaigns').then((index) => {
      const ids = Object.keys(index || {});
      return Promise.all(ids.map((id) => window.fbCampaignGet('campaigns/' + id).then((c) => {
        const me = c && c.members && c.members[nick];
        if (!me) return null;   // deleted, or this account was removed from it
        const entry = {
          id: id,
          name: c.name || 'Campaign',
          owner: c.owner,
          inviteCode: c.inviteCode,
          role: me.role === 'dm' ? 'dm' : 'player',
          character: me.character || null,
          characterName: null,
          memberCount: Object.keys(c.members).length
        };
        if (!entry.character) return entry;
        return window.fbCampaignGet('characters/' + entry.character).then((ch) => {
          entry.characterName = (ch && ch.name) || entry.character;
          return entry;
        });
      })));
    }).then((list) => list.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)));
  }

  // Makes c the active campaign and switches the session to this account's role in it.
  function activate(c) {
    const nick = myKey();
    if (!nick) return;
    active = c;
    window.activeCampaign = Object.assign({}, c);
    try { localStorage.setItem(ACTIVE_KEY_PREFIX + nick, c.id); } catch (e) { }

    // The rest of the site reads currentUser.role (DM bar, VTT rights...): give it the campaign role.
    const u = window.currentUser;
    if (u && u.role !== c.role && typeof loginUser === 'function') {
      applyingRole = true;
      try { loginUser(Object.assign({}, u, { role: c.role })); }
      finally { applyingRole = false; }
    }
    closePicker();
    renderChip();
    if (c.character && c.characterName) charNames[c.character] = c.characterName;
    watchMembers(c.id);
    window.dispatchEvent(new CustomEvent('campaignchange', { detail: window.activeCampaign }));

    // A player needs a character in the campaign: show it, or ask which one to bring.
    if (c.role === 'player' && !c.character) openCharacterChooser(c, 'Pick the character you play in ' + c.name + '.');
    else showActiveCharacter();
  }

  // After login: a pending invite first, else the remembered campaign, else the only one, else ask.
  function chooseCampaign() {
    const nick = myKey();
    if (!nick) return Promise.resolve();
    let pending = null;
    try { pending = sessionStorage.getItem(PENDING_JOIN_KEY); } catch (e) { }
    if (pending) {
      try { sessionStorage.removeItem(PENDING_JOIN_KEY); } catch (e) { }
      return openPicker().then(() => joinCampaign(pending));
    }
    return loadMyCampaigns(nick).then((list) => {
      let remembered = null;
      try { remembered = localStorage.getItem(ACTIVE_KEY_PREFIX + nick); } catch (e) { }
      const pick = list.find((c) => c.id === remembered) || (list.length === 1 ? list[0] : null);
      if (pick) activate(pick);
      else openPicker(list);
    });
  }

  function createCampaign(name) {
    const nick = myKey();
    name = String(name || '').trim().slice(0, 60);
    if (!nick) return Promise.reject(new Error('Log in first'));
    if (!name) return Promise.reject(new Error('Give the campaign a name'));
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = Date.now();
    return freeInviteCode().then((code) => {
      const patch = {};
      patch['campaigns/' + id] = { name: name, owner: nick, createdAt: now, inviteCode: code, members: { [nick]: { role: 'dm', joinedAt: now } } };
      patch['invites/' + code] = id;
      patch['users/' + nick + '/campaigns/' + id] = true;
      return window.fbCampaignUpdate(patch).then(() => {
        activate({ id: id, name: name, owner: nick, inviteCode: code, role: 'dm', character: null, memberCount: 1 });
      });
    });
  }

  // A code no other campaign uses (6 characters from 31 makes clashes rare; check anyway).
  function freeInviteCode(tries) {
    const code = newInviteCode();
    return window.fbCampaignGet('invites/' + code).then((taken) => {
      if (!taken) return code;
      if ((tries || 0) > 5) throw new Error('Could not make an invite code, try again');
      return freeInviteCode((tries || 0) + 1);
    });
  }

  function joinCampaign(rawCode) {
    const nick = myKey();
    const code = normaliseCode(rawCode);
    if (!nick) return Promise.reject(new Error('Log in first'));
    if (code.length !== INVITE_LENGTH) {
      showPickerMessage('Invite codes are ' + INVITE_LENGTH + ' letters/digits.', true);
      return Promise.resolve();
    }
    showPickerMessage('Looking up ' + code + '…');
    return window.fbCampaignGet('invites/' + code).then((id) => {
      if (!id) throw new Error('No campaign uses the code ' + code + ' (it may have been renewed).');
      return window.fbCampaignGet('campaigns/' + id).then((c) => {
        if (!c) throw new Error('That campaign no longer exists.');
        if (c.inviteCode !== code) throw new Error('That invite code has been replaced. Ask your DM for the new one.');
        const existing = c.members && c.members[nick];
        const summary = { id: id, name: c.name || 'Campaign', owner: c.owner, inviteCode: c.inviteCode, memberCount: Object.keys(c.members || {}).length };
        if (existing) {
          activate(Object.assign(summary, { role: existing.role === 'dm' ? 'dm' : 'player', character: existing.character || null }));
          return;
        }
        return defaultCharacterFor(nick).then((character) => {
          const patch = {};
          patch['campaigns/' + id + '/members/' + nick] = { role: 'player', character: character, joinedAt: Date.now() };
          patch['users/' + nick + '/campaigns/' + id] = true;
          return window.fbCampaignUpdate(patch).then(() => {
            activate(Object.assign(summary, { role: 'player', character: character, memberCount: summary.memberCount + 1 }));
          });
        });
      });
    }).catch((err) => showPickerMessage(err.message || String(err), true));
  }

  /* ---------- Members of the active campaign (live) ---------- */

  let members = {};          // nick -> { role, character, joinedAt }
  const charNames = {};      // character id -> display name
  let membersUnsub = null;

  function watchMembers(campId) {
    if (membersUnsub) membersUnsub();
    membersUnsub = null;
    members = {};
    if (!campId || typeof window.fbCampaignListen !== 'function') return;
    membersUnsub = window.fbCampaignListen('campaigns/' + campId + '/members', (m) => {
      members = m || {};
      const missing = Object.values(members).map((x) => x && x.character).filter((id) => id && !charNames[id]);
      Promise.all(missing.map((id) => window.fbCampaignGet('characters/' + id).then((c) => { charNames[id] = (c && c.name) || id; })))
        .catch(() => {})
        .then(() => window.dispatchEvent(new CustomEvent('campaignmembers', { detail: memberList() })));
    });
  }

  // [{ nick, role, character, characterName }] sorted by character (or nick).
  function memberList() {
    return Object.keys(members).map((nick) => {
      const m = members[nick] || {};
      return { nick: nick, role: m.role === 'dm' ? 'dm' : 'player', character: m.character || null, characterName: m.character ? (charNames[m.character] || m.character) : null };
    }).sort((a, b) => (a.characterName || a.nick).localeCompare(b.characterName || b.nick));
  }

  // The character a member plays in the active campaign (an inventory key), or null.
  function characterOf(nick) {
    const m = members[String(nick || '').toLowerCase()];
    return (m && m.character) || null;
  }

  function characterName(id) {
    return id ? (charNames[id] || id) : null;
  }

  /* ---------- Picker screen ---------- */

  function injectStyles() {
    if (document.getElementById('campaign-styles')) return;
    const style = document.createElement('style');
    style.id = 'campaign-styles';
    style.textContent = `
      #campaign-picker {
        position: fixed; inset: 0; z-index: 99998; display: flex; align-items: center; justify-content: center; padding: 20px;
        background: radial-gradient(ellipse at center, var(--surface-2) 0%, var(--bg) 75%, var(--surface-inset) 100%);
        overflow-y: auto;
      }
      #campaign-picker .auth-card { max-width: 520px; }
      .camp-close { position: absolute; top: 12px; right: 12px; }
      .camp-list { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 18px; }
      .camp-row { display: flex; align-items: center; gap: 8px; }
      .camp-enter {
        flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; cursor: pointer;
        padding: 10px 12px; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius);
        font-family: var(--font-body);
      }
      .camp-enter:hover { border-color: var(--accent); background: var(--surface-3); }
      .camp-enter.camp-current { border-color: var(--accent); }
      .camp-name { font-family: var(--font-display); font-size: 15px; color: var(--accent-strong); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .camp-meta { font-size: 12px; color: var(--text-dim); }
      .camp-empty { padding: 14px; text-align: center; color: var(--text-muted); font-size: 13px; border: 1px dashed var(--border); border-radius: var(--radius); }
      .camp-section { font-family: var(--font-display); font-size: 12px; letter-spacing: 1px; color: var(--text-dim); margin: 0 0 6px; text-transform: uppercase; }
      .camp-form { display: flex; gap: 8px; margin-bottom: 14px; }
      .camp-form .auth-input { flex: 1; min-width: 0; padding-left: 12px; }
      .camp-form .btn { white-space: nowrap; }
      .camp-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; }
      .camp-chip { padding: 3px 8px; font-size: 11px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function closePicker() {
    const p = document.getElementById('campaign-picker');
    if (p) p.remove();
  }

  function showPickerMessage(text, isError) {
    const box = document.querySelector('#campaign-picker .auth-msg');
    if (!box) return;
    box.textContent = text || '';
    box.className = 'auth-msg' + (text ? (isError ? ' error' : ' success') : '');
  }

  // list: campaigns to show; loaded here when not given.
  function openPicker(list) {
    const nick = myKey();
    if (!nick) return Promise.resolve();
    injectStyles();
    return (list ? Promise.resolve(list) : loadMyCampaigns(nick)).then((camps) => {
      closePicker();
      const wrap = el('div');
      wrap.id = 'campaign-picker';
      const card = el('div', 'auth-card');
      wrap.appendChild(card);

      if (active) {
        const x = el('button', 'btn ghost small camp-close', '✕');
        x.type = 'button';
        x.title = 'Back to ' + active.name;
        x.onclick = closePicker;
        card.appendChild(x);
      }

      const head = el('div', 'auth-header');
      head.appendChild(el('div', 'auth-emblem', '🏰'));
      head.appendChild(el('h2', 'auth-title', 'CAMPAIGNS'));
      head.appendChild(el('div', 'auth-subtitle', 'Signed in as ' + window.currentUser.nickname));
      card.appendChild(head);

      card.appendChild(el('div', 'camp-section', 'Your campaigns'));
      const listBox = el('div', 'camp-list');
      if (!camps.length) listBox.appendChild(el('div', 'camp-empty', "You're not in a campaign yet. Create one, or join with your DM's invite code."));
      camps.forEach((c) => {
        const row = el('div', 'camp-row');
        const enter = el('button', 'camp-enter' + (active && active.id === c.id ? ' camp-current' : ''));
        enter.type = 'button';
        enter.appendChild(el('span', 'camp-name', c.name));
        const who = c.role === 'dm' ? (c.owner === nick ? '👑 DM (owner)' : '👑 Co-DM') : '👤 Player' + (c.character ? ' · ' + (c.characterName || c.character) : ' · no character yet');
        enter.appendChild(el('span', 'camp-meta', who + ' · ' + c.memberCount + ' member' + (c.memberCount === 1 ? '' : 's')));
        enter.onclick = () => activate(c);
        row.appendChild(enter);
        if (c.role === 'player') {
          const pickChar = el('button', 'btn ghost small', '🎭');
          pickChar.type = 'button';
          pickChar.title = 'Change the character you play here';
          pickChar.onclick = () => openCharacterChooser(c);
          row.appendChild(pickChar);
        }
        if (c.role === 'dm' && c.inviteCode) {
          const share = el('button', 'btn ghost small', '🔗 ' + c.inviteCode);
          share.type = 'button';
          share.title = 'Copy the invite link';
          share.onclick = () => copyText(inviteLink(c.inviteCode)).then(
            () => showPickerMessage('Invite link copied: ' + inviteLink(c.inviteCode)),
            () => showPickerMessage('Invite link: ' + inviteLink(c.inviteCode)));
          row.appendChild(share);
        }
        listBox.appendChild(row);
      });
      card.appendChild(listBox);

      card.appendChild(el('div', 'camp-section', 'Join with an invite code'));
      card.appendChild(form('e.g. CP5NCN', 'Join', (v) => joinCampaign(v), INVITE_LENGTH + 2));

      card.appendChild(el('div', 'camp-section', 'Start a new campaign (you are its DM)'));
      card.appendChild(form('Campaign name', 'Create', (v) => {
        showPickerMessage('Creating…');
        return createCampaign(v).catch((err) => showPickerMessage(err.message || String(err), true));
      }, 60));

      card.appendChild(el('div', 'auth-msg'));

      const foot = el('div', 'camp-foot');
      const out = el('button', 'btn ghost small', '🚪 Log out');
      out.type = 'button';
      out.onclick = () => { closePicker(); if (typeof logoutCurrentUser === 'function') logoutCurrentUser(); };
      foot.appendChild(out);
      card.appendChild(foot);

      document.body.appendChild(wrap);
    });
  }

  // Character choice for one campaign: one of this account's characters, or a new one via the forge.
  function openCharacterChooser(c, intro) {
    const nick = myKey();
    if (!nick) return Promise.resolve();
    injectStyles();
    return loadMyCharacters(nick).then((chars) => {
      closePicker();
      const wrap = el('div');
      wrap.id = 'campaign-picker';
      const card = el('div', 'auth-card');
      wrap.appendChild(card);

      if (c.character || (active && active.id !== c.id)) {
        const back = el('button', 'btn ghost small camp-close', '← Back');
        back.type = 'button';
        back.onclick = () => openPicker();
        card.appendChild(back);
      }

      const head = el('div', 'auth-header');
      head.appendChild(el('div', 'auth-emblem', '🎭'));
      head.appendChild(el('h2', 'auth-title', 'CHARACTER'));
      head.appendChild(el('div', 'auth-subtitle', intro || 'Who do you play in ' + c.name + '?'));
      card.appendChild(head);

      card.appendChild(el('div', 'camp-section', 'Your characters'));
      const listBox = el('div', 'camp-list');
      if (!chars.length) listBox.appendChild(el('div', 'camp-empty', 'No characters yet — forge one below.'));
      chars.forEach((ch) => {
        const b = el('button', 'camp-enter' + (c.character === ch.id ? ' camp-current' : ''));
        b.type = 'button';
        b.appendChild(el('span', 'camp-name', ch.name));
        b.appendChild(el('span', 'camp-meta', c.character === ch.id ? 'Playing in ' + c.name : 'Play this character in ' + c.name));
        b.onclick = () => {
          showPickerMessage('Saving…');
          setCampaignCharacter(c.id, ch.id)
            .then(() => {
              const updated = Object.assign({}, c, { character: ch.id, characterName: ch.name });
              if (active && active.id === c.id) closePicker();
              else activate(updated);
            })
            .catch((err) => showPickerMessage(err.message || String(err), true));
        };
        listBox.appendChild(b);
      });
      card.appendChild(listBox);

      card.appendChild(el('div', 'camp-section', 'Forge a new character'));
      card.appendChild(form('Character name', 'Forge', (name) => {
        createCharacter(name)
          .then((id) => setCampaignCharacter(c.id, id).then(() => {
            const updated = Object.assign({}, c, { character: id, characterName: name });
            if (active && active.id === c.id) showActiveCharacter();
            else activate(updated);
          }))
          .catch((err) => { openCharacterChooser(c).then(() => showPickerMessage(err.message || String(err), true)); });
      }, 40));

      card.appendChild(el('div', 'auth-msg'));
      document.body.appendChild(wrap);
    });
  }

  function form(placeholder, label, onSubmit, maxLength) {
    const f = el('form', 'camp-form');
    const input = el('input', 'auth-input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = maxLength;
    const btn = el('button', 'btn small', label);
    btn.type = 'submit';
    f.append(input, btn);
    f.onsubmit = (e) => {
      e.preventDefault();
      if (input.value.trim()) onSubmit(input.value.trim());
    };
    return f;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('no clipboard'));
  }

  // "🏰 Campaign name" next to the user badge; opens the picker.
  function renderChip() {
    let chip = document.getElementById('campaign-chip');
    const bar = document.getElementById('auth-user-bar');
    if (!bar) return;
    if (!active || !window.currentUser) { if (chip) chip.remove(); return; }
    injectStyles();
    if (!chip) {
      chip = el('button', 'btn ghost small camp-chip');
      chip.id = 'campaign-chip';
      chip.type = 'button';
      chip.onclick = () => openPicker();
      bar.insertBefore(chip, bar.firstChild);
    }
    chip.textContent = '🏰 ' + active.name;
    chip.title = 'Campaign: ' + active.name + ' — click to switch';
  }

  /* ---------- Hooks ---------- */

  // Called at the end of loginUser(); also below, for a session restored before this file loaded.
  function onLogin() {
    if (applyingRole) return;   // our own re-login with the campaign role
    active = null;
    window.activeCampaign = null;
    migrateIfNeeded()
      .then(() => firebaseReady())
      .then(() => chooseCampaign())
      .catch((err) => console.warn('Campaign selection failed:', err));
  }

  function onLogout() {
    active = null;
    window.activeCampaign = null;
    watchMembers(null);
    window.dispatchEvent(new CustomEvent('campaignchange', { detail: null }));
    closePicker();
    renderChip();
  }

  window.Campaigns = {
    FIRST_CAMPAIGN_ID: FIRST_CAMPAIGN_ID,
    newInviteCode: newInviteCode,
    buildMigration: buildMigration,
    previewMigration: previewMigration,
    migrateIfNeeded: migrateIfNeeded,
    loadMyCampaigns: loadMyCampaigns,
    loadMyCharacters: loadMyCharacters,
    createCharacter: createCharacter,
    setCampaignCharacter: setCampaignCharacter,
    createCampaign: createCampaign,
    joinCampaign: joinCampaign,
    openPicker: openPicker,
    active: () => active,
    memberList: memberList,
    characterOf: characterOf,
    characterName: characterName,
    onLogin: onLogin,
    onLogout: onLogout
  };

  if (window.currentUser) onLogin();
})();
