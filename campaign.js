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
  // Before campaigns the role lived on the account, so this one check still reads
  // accounts/<nick>.role (currentUser.role is the campaign role, and there is none yet here).
  function migrateIfNeeded() {
    const u = window.currentUser;
    let acc = null;
    try { acc = u && typeof getStoredAccounts === 'function' ? getStoredAccounts()[String(u.nickname).toLowerCase()] : null; } catch (e) { }
    if (migrating || !u || !acc || acc.role !== 'dm') return Promise.resolve(false);
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
    return loadMyCharacters(nick).then((mine) => {
      if (mine.length >= MAX_CHARACTERS) throw new Error('You have ' + MAX_CHARACTERS + ' characters, the most an account can have. Delete one in 🎭 My characters first.');
    }).then(() => new Promise((resolve, reject) => {
      closePicker();   // the forge opens underneath the picker otherwise
      window.openCharacterForgeModal({
        nickname: name,
        characterId: id,
        onDone: (doneId, info) => {
          // The builder may rename the character; its name wins.
          const finalName = (info && info.name) || name;
          charNames[id] = finalName;
          const patch = {};
          patch['characters/' + id] = { name: finalName, owner: nick, createdAt: Date.now() };
          patch['users/' + nick + '/characters/' + id] = true;
          window.fbCampaignUpdate(patch).then(() => resolve(id), reject);
        }
      });
    }));
  }

  /* ---------- "My characters": list, rename, copy, delete ---------- */

  const MAX_CHARACTERS = 10;   // per account, like D&D Beyond's character slots

  // Everything shown on the list: name, a summary from the sheet, the portrait, and the campaigns it's in.
  function loadCharacterCards(nick) {
    return Promise.all([loadMyCharacters(nick), loadMyCampaigns(nick)]).then(([chars, camps]) =>
      Promise.all(chars.map((ch) => (typeof window.fbCharacterSheet === 'function' ? window.fbCharacterSheet(ch.id) : Promise.resolve(null)).then((sheet) => {
        const cs = (sheet && sheet.characterStats) || {};
        const build = sheet && sheet.build;
        return {
          id: ch.id,
          name: ch.name,
          legacy: ch.id === nick,          // the account's own first character, used at login
          builder: !!build,
          portrait: (build && build.details && build.details.portrait) || (sheet && sheet.portrait) || null,
          summary: [cs.level ? 'Lvl ' + cs.level : '', cs.characterClass || '', cs.subrace || cs.species || ''].filter(Boolean).join(' · '),
          campaigns: camps.filter((c) => c.character === ch.id).map((c) => c.name)
        };
      }))));
  }

  function renameCharacter(id, name) {
    const nick = myKey();
    name = String(name || '').trim().slice(0, 40);
    if (!nick) return Promise.reject(new Error('Log in first'));
    if (!name) return Promise.reject(new Error('Give the character a name'));
    return window.fbCampaignGet('characters/' + id).then((c) => {
      if (!c || c.owner !== nick) throw new Error('That is not your character');
      charNames[id] = name;
      return Promise.all([
        window.fbCampaignUpdate({ ['characters/' + id + '/name']: name }),
        typeof window.fbRenameCharacterSheet === 'function' ? window.fbRenameCharacterSheet(id, name) : null
      ]);
    });
  }

  // A full copy (sheet, gear, spells) under a new id; handy for a variant or a backup before levelling.
  function copyCharacter(id) {
    const nick = myKey();
    if (!nick) return Promise.reject(new Error('Log in first'));
    return Promise.all([loadMyCharacters(nick), window.fbCampaignGet('characters/' + id), window.fbCharacterSheet(id)]).then(([mine, c, sheet]) => {
      if (!c || c.owner !== nick) throw new Error('That is not your character');
      if (mine.length >= MAX_CHARACTERS) throw new Error('You have ' + MAX_CHARACTERS + ' characters, the most an account can have. Delete one first.');
      const newId = 'ch' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const name = (c.name + ' (copy)').slice(0, 40);
      const changes = { campaign: name + "'s Vault" };
      if (sheet && sheet.build) changes.build = Object.assign({}, sheet.build, { name: name });
      return window.fbCopyCharacterSheet(id, newId, changes).then(() => window.fbCampaignUpdate({
        ['characters/' + newId]: { name: name, owner: nick, createdAt: Date.now() },
        ['users/' + nick + '/characters/' + newId]: true
      })).then(() => newId);
    });
  }

  /* ---------- Character files: export one, import one (character-transfer.js) ---------- */

  // Downloads the character as a .mamirock.json file (sheet, gear, spells, notes on the sheet).
  function exportCharacter(id) {
    const nick = myKey();
    const T = window.CharacterTransfer;
    if (!nick || !T) return Promise.reject(new Error('Log in first'));
    return Promise.all([window.fbCampaignGet('characters/' + id), window.fbCharacterSheet(id)]).then(([c, sheet]) => {
      if (!c || c.owner !== nick) throw new Error('That is not your character');
      const data = T.makeExport(sheet, c.name);
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = T.fileName(c.name);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return c.name;
    });
  }

  // Asks for a file and makes a new character of this account from it. Resolves with
  // { id, name, warnings }, or null when no file was picked.
  function importCharacterFile() {
    const nick = myKey();
    const T = window.CharacterTransfer;
    if (!nick || !T) return Promise.reject(new Error('Log in first'));
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) { resolve(null); return; }
        file.text().then((text) => importCharacterText(text)).then(resolve, reject);
      };
      input.click();
    });
  }

  function importCharacterText(text) {
    const nick = myKey();
    const T = window.CharacterTransfer;
    if (!nick || !T) return Promise.reject(new Error('Log in first'));
    if (typeof text === 'string' && text.length > 5000000) return Promise.reject(new Error('That file is too large to be a character (over 5 MB).'));
    // A D&D Beyond character file goes through the same path as a PDF: read, then put on an empty sheet.
    if (T.detectJson(text) === 'ddb') {
      const spellIndex = {};
      (window.SPELLS_SRD5 || []).forEach((s) => { spellIndex[s.name.toLowerCase()] = s; });
      let read;
      try { read = T.fromDdbJson(JSON.parse(text), { spellIndex: spellIndex }); } catch (e) { return Promise.reject(e); }
      const base = typeof window.getDefaultState === 'function' ? window.getDefaultState(read.name) : {};
      const fromDdb = T.sheetFromPdf(base, read);
      fromDdb.sheet.importedFrom = 'ddb';
      fromDdb.warnings = read.warnings.concat(fromDdb.warnings || []);
      return saveImportedCharacter(fromDdb).then((r) => Object.assign(r, { source: 'ddb' }));
    }
    let parsed;
    try { parsed = T.parseExport(text); } catch (e) { return Promise.reject(e); }
    return saveImportedCharacter(parsed);
  }

  // pdf-lib (reads PDF form fields) is loaded only when someone imports a PDF.
  let pdfLibLoading = null;
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (pdfLibLoading) return pdfLibLoading;
    pdfLibLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
      s.onload = () => (window.PDFLib ? resolve(window.PDFLib) : reject(new Error('The PDF reader did not load.')));
      s.onerror = () => { pdfLibLoading = null; reject(new Error('Could not load the PDF reader (are you online?).')); };
      document.head.appendChild(s);
    });
    return pdfLibLoading;
  }

  // Every form field of a PDF as { name: text | checked }.
  function readPdfFields(bytes) {
    return loadPdfLib().then((PDFLib) => PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })).then((doc) => {
      const out = {};
      let form;
      try { form = doc.getForm(); } catch (e) { return out; }
      form.getFields().forEach((f) => {
        const kind = f.constructor && f.constructor.name;
        try {
          if (typeof f.isChecked === 'function') out[f.getName()] = f.isChecked();
          else if (typeof f.getText === 'function') out[f.getName()] = f.getText() || '';
          else if (typeof f.getSelected === 'function') out[f.getName()] = [].concat(f.getSelected() || []).join(', ');
        } catch (e) { /* a broken field is skipped */ }
        return kind;
      });
      return out;
    }).catch((err) => { throw /encrypt/i.test(String(err && err.message)) ? new Error('That PDF is password-protected.') : err; });
  }

  // Asks for a filled-in PDF character sheet and makes a new character from its fields.
  // Resolves with { id, name, warnings }, or null when no file was picked.
  function importCharacterPdf() {
    const nick = myKey();
    const T = window.CharacterTransfer;
    if (!nick || !T) return Promise.reject(new Error('Log in first'));
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,application/pdf';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) { resolve(null); return; }
        if (file.size > 15 * 1024 * 1024) { reject(new Error('That PDF is too large (over 15 MB).')); return; }
        file.arrayBuffer().then(readPdfFields).then((fields) => importCharacterFields(fields)).then(resolve, reject);
      };
      input.click();
    });
  }

  function importCharacterFields(fields) {
    const T = window.CharacterTransfer;
    const spellIndex = {};
    (window.SPELLS_SRD5 || []).forEach((s) => { spellIndex[s.name.toLowerCase()] = s; });
    let read;
    try { read = T.fromPdfFields(fields, { spellIndex: spellIndex }); } catch (e) { return Promise.reject(e); }
    const base = typeof window.getDefaultState === 'function' ? window.getDefaultState(read.name) : {};
    const parsed = T.sheetFromPdf(base, read);
    parsed.warnings = read.warnings.concat(parsed.warnings || []);
    return saveImportedCharacter(parsed);
  }

  // Stores an imported character ({ name, sheet, warnings }) as a new character of this account.
  function saveImportedCharacter(parsed) {
    const nick = myKey();
    return loadMyCharacters(nick).then((mine) => {
      if (mine.length >= MAX_CHARACTERS) throw new Error('You have ' + MAX_CHARACTERS + ' characters, the most an account can have. Delete one first.');
      if (typeof window.fbWriteCharacterSheet !== 'function') throw new Error('Not connected yet');
      const id = 'ch' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return window.fbWriteCharacterSheet(id, parsed.sheet).then(() => window.fbCampaignUpdate({
        ['characters/' + id]: { name: parsed.name, owner: nick, createdAt: Date.now() },
        ['users/' + nick + '/characters/' + id]: true
      })).then(() => {
        charNames[id] = parsed.name;
        return { id: id, name: parsed.name, warnings: parsed.warnings || [] };
      });
    });
  }

  // Refuses while a campaign still uses the character, and for the account's own first character.
  function deleteCharacter(id) {
    const nick = myKey();
    if (!nick) return Promise.reject(new Error('Log in first'));
    if (id === nick) return Promise.reject(new Error("This is your account's own character (it opens when you log in), so it can't be deleted."));
    return Promise.all([window.fbCampaignGet('characters/' + id), loadMyCampaigns(nick)]).then(([c, camps]) => {
      if (!c || c.owner !== nick) throw new Error('That is not your character');
      const usedIn = camps.filter((x) => x.character === id).map((x) => x.name);
      if (usedIn.length) throw new Error('Pick another character in ' + usedIn.join(', ') + ' first (🎭 next to the campaign).');
      return window.fbCampaignUpdate({ ['characters/' + id]: null, ['users/' + nick + '/characters/' + id]: null })
        .then(() => window.fbDeleteCharacterSheet(id))
        .then(() => {
          delete charNames[id];
          try { localStorage.removeItem('hoard_inv_user_' + id.toLowerCase()); } catch (e) { }
        });
    });
  }

  // Lets the owner pick a picture; it is centre-cropped to a 256px square and becomes the VTT token too.
  function pickCharacterPortrait(id) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const c = document.createElement('canvas');
          c.width = c.height = Math.min(256, side);
          c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
          resolve(setCharacterPortrait(id, c.toDataURL('image/webp', 0.85)));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that picture')); };
        img.src = url;
      };
      input.click();
    });
  }

  function setCharacterPortrait(id, dataUrl) {
    const nick = myKey();
    if (!nick) return Promise.reject(new Error('Log in first'));
    if (typeof window.fbSetCharacterPortrait !== 'function') return Promise.reject(new Error('Not connected yet'));
    return window.fbCampaignGet('characters/' + id).then((c) => {
      if (!c || c.owner !== nick) throw new Error('That is not your character');
      return window.fbSetCharacterPortrait(id, dataUrl);
    });
  }

  function openCharacters(message, isError) {
    const nick = myKey();
    if (!nick) return Promise.resolve();
    injectStyles();
    return loadCharacterCards(nick).then((cards) => {
      closePicker();
      const wrap = el('div');
      wrap.id = 'campaign-picker';
      const card = el('div', 'auth-card');
      wrap.appendChild(card);

      const back = el('button', 'btn ghost small camp-close', '← Back');
      back.type = 'button';
      back.onclick = () => openPicker();
      card.appendChild(back);

      const head = el('div', 'auth-header');
      head.appendChild(el('div', 'auth-emblem', '🎭'));
      head.appendChild(el('h2', 'auth-title', 'MY CHARACTERS'));
      head.appendChild(el('div', 'auth-subtitle', cards.length + ' / ' + MAX_CHARACTERS + ' characters'));
      card.appendChild(head);

      const msgBox = el('div', 'auth-msg');
      const say = (text, err) => { msgBox.textContent = text || ''; msgBox.className = 'auth-msg' + (text ? (err ? ' error' : ' success') : ''); };
      const fail = (err) => say(err.message || String(err), true);
      const list = el('div', 'camp-list');
      if (!cards.length) list.appendChild(el('div', 'camp-empty', 'No characters yet.'));
      cards.forEach((ch) => {
        const row = el('div', 'camp-member');
        const pic = ch.portrait ? Object.assign(el('img', 'char-thumb'), { src: ch.portrait, alt: '' }) : el('div', 'char-thumb', (ch.name || '?').slice(0, 1).toUpperCase());
        const who = el('div', 'camp-member-who');
        who.appendChild(el('span', 'camp-name', ch.name));
        who.appendChild(el('span', 'camp-meta', (ch.summary || 'No sheet yet') + (ch.campaigns.length ? ' · in ' + ch.campaigns.join(', ') : '')));
        const acts = el('div', 'camp-member-acts');
        const act = (label, title, fn) => { const b = el('button', 'btn ghost small', label); b.type = 'button'; b.title = title; b.onclick = fn; acts.appendChild(b); };
        act('✏️', 'Rename', () => {
          // Inline rename (prompt() isn't available everywhere).
          who.innerHTML = '';
          const f = form('New name', 'Save', (v) => renameCharacter(ch.id, v).then(() => openCharacters('Renamed to "' + v.trim() + '".'), fail), 40);
          f.querySelector('input').value = ch.name;
          who.appendChild(f);
          f.querySelector('input').focus();
        });
        act('🖼', ch.portrait ? 'Change portrait (also the map token)' : 'Add a portrait (also the map token)', () => pickCharacterPortrait(ch.id).then(() => openCharacters('Portrait saved for "' + ch.name + '".'), fail));
        if (ch.portrait) act('🚫', 'Remove portrait', () => setCharacterPortrait(ch.id, null).then(() => openCharacters('Portrait removed.'), fail));
        act('📄', 'Make a copy', () => copyCharacter(ch.id).then(() => openCharacters('Copied "' + ch.name + '".'), fail));
        act('⬇', 'Download as a file (to keep a backup or move it to another account)', () => exportCharacter(ch.id).then((n) => say('Downloaded "' + n + '".'), fail));
        act('🗑', ch.legacy ? "Your account's own character can't be deleted" : 'Delete', () => {
          if (ch.legacy) { say("This is your account's own character (it opens when you log in), so it can't be deleted.", true); return; }
          if (!confirm('Delete "' + ch.name + '" and its sheet, gear and spells? This can not be undone.')) return;
          deleteCharacter(ch.id).then(() => openCharacters('Deleted "' + ch.name + '".'), fail);
        });
        row.append(pic, who, acts);
        list.appendChild(row);
      });
      card.appendChild(list);

      if (cards.length < MAX_CHARACTERS) {
        card.appendChild(el('div', 'camp-section', 'New character'));
        card.appendChild(form('Character name', 'Create', (name) => {
          createCharacter(name).then(() => openCharacters('Created "' + name + '".'), (err) => openCharacters(err.message || String(err), true));
        }, 40));
        card.appendChild(el('div', 'camp-section', 'Import a character'));
        const imp = el('button', 'btn ghost small', '⬆ From a file…');
        imp.type = 'button';
        imp.title = 'A .mamirock.json file downloaded with ⬇, or a D&D Beyond character JSON file';
        imp.onclick = () => importCharacterFile().then((r) => {
          if (!r) return;
          openCharacters('Imported "' + r.name + '"' + (r.source === 'ddb' ? ' from D&D Beyond. To check it in the character builder, open it and press ⚔ Forge.' : '.') + (r.warnings.length ? ' Notes: ' + r.warnings.join(' ') : ''));
        }, fail);
        card.appendChild(imp);
        // How to get the D&D Beyond file: the player saves their own (public) character's JSON.
        const help = el('details', 'camp-help');
        help.appendChild(el('summary', '', 'From D&D Beyond?'));
        help.appendChild(el('div', 'camp-meta', 'On D&D Beyond, make the character public (Edit → Home → Character Privacy: Public). Then open character-service.dndbeyond.com/character/v5/character/ followed by the number at the end of your character\'s address, save the page as a .json file, and import it here with "From a file…". This is not an official D&D Beyond feature and may stop working.'));
        const impPdf = el('button', 'btn ghost small', '📄 From a PDF character sheet…');
        impPdf.type = 'button';
        impPdf.title = 'A filled-in, fillable PDF sheet (the official 5e sheet and similar). Scanned PDFs can not be read.';
        impPdf.onclick = () => { say('Reading the PDF…'); importCharacterPdf().then((r) => {
          if (!r) { say(''); return; }
          openCharacters('Imported "' + r.name + '" from the PDF. To check it in the character builder, open it and press ⚔ Forge (it offers to convert it).' + (r.warnings.length ? ' Notes: ' + r.warnings.join(' ') : ''));
        }, fail); };
        card.appendChild(impPdf);
        card.appendChild(help);
      }
      card.appendChild(msgBox);
      if (message) say(message, isError);
      document.body.appendChild(wrap);
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
    // Switching campaigns (or a role change) ends "view as player".
    viewingAs = null;
    window.dmViewingAs = null;
    renderViewAsBanner();
    active = c;
    window.activeCampaign = Object.assign({}, c);
    try { localStorage.setItem(ACTIVE_KEY_PREFIX + nick, c.id); } catch (e) { }

    // The rest of the site reads currentUser.role (DM bar, VTT rights...): give it the campaign role.
    const u = window.currentUser;
    if (u && u.role !== c.role && typeof loginUser === 'function') {
      applyingRole = true;
      try { loginUser(u, c.role); }
      finally { applyingRole = false; }
    }
    closePicker();
    renderChip();
    if (c.character && c.characterName) charNames[c.character] = c.characterName;
    watchMembers(c.id);
    watchNotes(c.id);
    watchCampaignRules(c.id);
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

  /* ---------- Managing a campaign (its DMs) ---------- */
  // These only shape the UI: without Firebase Auth the database can't check who is a DM.

  function renewInvite(campId) {
    return window.fbCampaignGet('campaigns/' + campId + '/inviteCode').then((old) =>
      freeInviteCode().then((code) => {
        const patch = {};
        if (old) patch['invites/' + old] = null;
        patch['invites/' + code] = campId;
        patch['campaigns/' + campId + '/inviteCode'] = code;
        return window.fbCampaignUpdate(patch).then(() => {
          if (active && active.id === campId) { active.inviteCode = code; window.activeCampaign = Object.assign({}, active); }
          return code;
        });
      }));
  }

  function renameCampaign(campId, name) {
    name = String(name || '').trim().slice(0, 60);
    if (!name) return Promise.reject(new Error('Give the campaign a name'));
    return window.fbCampaignUpdate({ ['campaigns/' + campId + '/name']: name }).then(() => {
      if (active && active.id === campId) { active.name = name; window.activeCampaign = Object.assign({}, active); renderChip(); }
    });
  }

  function setMemberRole(campId, nick, role) {
    return window.fbCampaignUpdate({ ['campaigns/' + campId + '/members/' + nick + '/role']: role === 'dm' ? 'dm' : 'player' });
  }

  // The owner hands the campaign to one of its co-DMs and stays on as a co-DM.
  // Only a co-DM can receive it, so the new owner already has the DM's rights and knows the table.
  function transferOwnership(campId, toNick) {
    const nick = myKey();
    return window.fbCampaignGet('campaigns/' + campId).then((c) => {
      if (!c || c.owner !== nick) throw new Error('Only the owner can hand over the campaign.');
      const to = c.members && c.members[toNick];
      if (!to || to.role !== 'dm') throw new Error('Make ' + toNick + ' a co-DM first; only a co-DM can become the owner.');
      const patch = {};
      patch['campaigns/' + campId + '/owner'] = toNick;
      patch['campaigns/' + campId + '/members/' + nick + '/role'] = 'dm';
      return window.fbCampaignUpdate(patch).then(() => {
        if (active && active.id === campId) { active.owner = toNick; window.activeCampaign = Object.assign({}, active); }
      });
    });
  }

  // Removing someone also renews the invite code, so the old link can't bring them back.
  function removeMember(campId, nick, opts) {
    const patch = {};
    patch['campaigns/' + campId + '/members/' + nick] = null;
    patch['users/' + nick + '/campaigns/' + campId] = null;
    return window.fbCampaignUpdate(patch).then(() => (opts && opts.keepCode ? null : renewInvite(campId)));
  }

  // Deletes the campaign, its invite and its VTT table. Characters and their sheets are kept.
  function deleteCampaign(campId) {
    return window.fbCampaignGet('campaigns/' + campId).then((c) => {
      if (!c) return;
      const patch = {};
      patch['campaigns/' + campId] = null;
      if (c.inviteCode) patch['invites/' + c.inviteCode] = null;
      Object.keys(c.members || {}).forEach((nick) => { patch['users/' + nick + '/campaigns/' + campId] = null; });
      return window.fbCampaignUpdate(patch).then(() => {
        if (typeof window.fbSaveVtt === 'function') return window.fbSaveVtt(campId, null);
      });
    });
  }

  // Players join only with the invite code or link (DMs no longer make accounts for them).
  // Reads the current code, since a DM may have made a new one since this campaign was opened.
  function copyInvite() {
    const say = (text) => (typeof window.toast === 'function' ? window.toast(text, 6000) : alert(text));
    if (!active || active.role !== 'dm') { say('Open one of your campaigns first.'); return Promise.resolve(); }
    return window.fbCampaignGet('campaigns/' + active.id + '/inviteCode').then((code) => {
      code = code || active.inviteCode;
      if (!code) { say('This campaign has no invite code. Make one in ⚙ Manage.'); return; }
      active.inviteCode = code;
      const link = inviteLink(code);
      return copyText(link).then(
        () => say('📨 Invite link copied. Code: ' + code),
        () => say('📨 Invite code: ' + code + ' · link: ' + link));
    }).catch((err) => say('Could not read the invite code: ' + (err.message || err)));
  }

  function openManage(campId) {
    const nick = myKey();
    if (!nick) return Promise.resolve();
    injectStyles();
    return window.fbCampaignGet('campaigns/' + campId).then((c) => {
      if (!c) { showPickerMessage('That campaign no longer exists.', true); return; }
      const me = c.members && c.members[nick];
      if (!me || me.role !== 'dm') { showPickerMessage('Only the campaign\'s DMs can manage it.', true); return; }
      const isOwner = c.owner === nick;
      const nicks = Object.keys(c.members || {});
      return Promise.all(nicks.map((n) => {
        const ch = c.members[n].character;
        return ch ? window.fbCampaignGet('characters/' + ch).then((r) => [n, (r && r.name) || ch]) : Promise.resolve([n, null]);
      })).then((pairs) => {
        const names = Object.fromEntries(pairs);
        closePicker();
        const wrap = el('div');
        wrap.id = 'campaign-picker';
        const card = el('div', 'auth-card');
        wrap.appendChild(card);

        const back = el('button', 'btn ghost small camp-close', '← Back');
        back.type = 'button';
        back.onclick = () => openPicker();
        card.appendChild(back);

        const head = el('div', 'auth-header');
        head.appendChild(el('div', 'auth-emblem', '⚙️'));
        head.appendChild(el('h2', 'auth-title', 'MANAGE'));
        head.appendChild(el('div', 'auth-subtitle', c.name + (isOwner ? ' · you own it' : ' · you are a co-DM')));
        card.appendChild(head);

        const reopen = (msg, isError) => openManage(campId).then(() => { if (msg) showPickerMessage(msg, isError); });
        const fail = (err) => showPickerMessage(err.message || String(err), true);

        card.appendChild(el('div', 'camp-section', 'Name'));
        const nameForm = form('Campaign name', 'Rename', (v) => renameCampaign(campId, v).then(() => reopen('Renamed.'), fail), 60);
        nameForm.querySelector('input').value = c.name || '';
        card.appendChild(nameForm);

        card.appendChild(el('div', 'camp-section', 'Invite'));
        const inv = el('div', 'camp-row camp-block');
        const codeBox = el('div', 'camp-code', c.inviteCode || '—');
        const copy = el('button', 'btn small', '🔗 Copy link');
        copy.type = 'button';
        copy.onclick = () => copyText(inviteLink(c.inviteCode)).then(
          () => showPickerMessage('Invite link copied: ' + inviteLink(c.inviteCode)),
          () => showPickerMessage('Invite link: ' + inviteLink(c.inviteCode)));
        const renew = el('button', 'btn ghost small', '↻ New code');
        renew.type = 'button';
        renew.title = 'Make a new code; the old code and link stop working';
        renew.onclick = () => renewInvite(campId).then((code) => reopen('New code ' + code + '. The old one no longer works.'), fail);
        inv.append(codeBox, copy, renew);
        card.appendChild(inv);

        if (window.HomebrewEditor) {
          card.appendChild(el('div', 'camp-section', 'Character rules'));
          const hb = el('button', 'btn small camp-block', '📜 Homebrew & builder settings');
          hb.type = 'button';
          hb.title = 'Your own species, backgrounds, feats and subclasses; how strict the character builder is';
          hb.onclick = () => { closePicker(); window.HomebrewEditor.open(campId, c.name); };
          card.appendChild(hb);
        }

        card.appendChild(el('div', 'camp-section', 'Members (' + nicks.length + ')'));
        const list = el('div', 'camp-list');
        nicks.sort((a, b) => {
          const ra = a === c.owner ? 0 : c.members[a].role === 'dm' ? 1 : 2;
          const rb = b === c.owner ? 0 : c.members[b].role === 'dm' ? 1 : 2;
          return ra - rb || (names[a] || a).localeCompare(names[b] || b);
        }).forEach((n) => {
          const m = c.members[n];
          const row = el('div', 'camp-member');
          const who = el('div', 'camp-member-who');
          who.appendChild(el('span', 'camp-name', names[n] || n));
          const roleTxt = n === c.owner ? '👑 Owner' : m.role === 'dm' ? '👑 Co-DM' : '👤 Player';
          who.appendChild(el('span', 'camp-meta', roleTxt + ' · ' + n + (m.role !== 'dm' && !m.character ? ' · no character yet' : '')));
          row.appendChild(who);
          const acts = el('div', 'camp-member-acts');
          const act = (label, title, fn) => {
            const b = el('button', 'btn ghost small', label);
            b.type = 'button';
            b.title = title;
            b.onclick = fn;
            acts.appendChild(b);
          };
          if (n !== c.owner) {
            if (isOwner && m.role !== 'dm') act('⬆ Co-DM', 'Make ' + n + ' a co-DM', () => setMemberRole(campId, n, 'dm').then(() => reopen(n + ' is now a co-DM.'), fail));
            if (isOwner && m.role === 'dm') act('⬇ Player', 'Make ' + n + ' a player again', () => setMemberRole(campId, n, 'player').then(() => reopen(n + ' is a player again.'), fail));
            if (isOwner && m.role === 'dm') act('👑 Make owner', 'Hand "' + c.name + '" over to ' + n + '; you stay on as a co-DM', () => {
              const typed = prompt('Hand "' + c.name + '" over to ' + (names[n] || n) + ' (' + n + ')?\n' +
                'They can then delete the campaign, change roles and remove you. You stay on as a co-DM.\n\n' +
                'Type the campaign\'s name to confirm:');
              if (typed === null) return;
              if (typed.trim() !== c.name) { fail(new Error('The name did not match. Nothing changed.')); return; }
              transferOwnership(campId, n).then(() => reopen((names[n] || n) + ' now owns "' + c.name + '". You are a co-DM.'), fail);
            });
            if (n === nick) {
              act('Leave', 'Leave this campaign', () => {
                if (!confirm('Leave "' + c.name + '"?')) return;
                removeMember(campId, n, { keepCode: true }).then(() => openPicker(), fail);
              });
            } else if (isOwner || m.role !== 'dm') {
              act('Remove', 'Remove ' + n + ' from the campaign', () => {
                if (!confirm('Remove ' + (names[n] || n) + ' (' + n + ') from "' + c.name + '"?\nThe invite code is renewed so the old link stops working.')) return;
                removeMember(campId, n).then((code) => reopen('Removed ' + n + '. New invite code: ' + code + '.'), fail);
              });
            }
          }
          row.appendChild(acts);
          list.appendChild(row);
        });
        card.appendChild(list);

        if (isOwner) {
          card.appendChild(el('div', 'camp-section', 'Danger zone'));
          const del = el('button', 'btn ghost small camp-danger', '🗑 Delete campaign');
          del.type = 'button';
          del.onclick = () => {
            const typed = prompt('This deletes "' + c.name + '", its members list, invite and VTT table for everyone. Characters are kept.\n\nType the campaign name to confirm:');
            if (typed === null) return;
            if (typed.trim() !== String(c.name).trim()) { showPickerMessage('The name did not match; nothing was deleted.', true); return; }
            deleteCampaign(campId).then(() => {
              if (active && active.id === campId) leaveActive();
              openPicker().then(() => showPickerMessage('Deleted "' + c.name + '".'));
            }, fail);
          };
          card.appendChild(del);
        }

        card.appendChild(el('div', 'auth-msg'));
        document.body.appendChild(wrap);
      });
    });
  }

  // The active campaign is gone for this account (left, removed or deleted).
  function leaveActive() {
    const nick = myKey();
    active = null;
    window.activeCampaign = null;
    try { if (nick) localStorage.removeItem(ACTIVE_KEY_PREFIX + nick); } catch (e) { }
    watchMembers(null);
    watchNotes(null);
    watchCampaignRules(null);
    closeJournal();
    renderChip();
    window.dispatchEvent(new CustomEvent('campaignchange', { detail: null }));
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
      if (active && active.id === campId) {
        const me = members[myKey()];
        if (!me) {
          // Removed by a DM, left in another tab, or the campaign was deleted.
          const name = active.name;
          leaveActive();
          openPicker().then(() => showPickerMessage('You are no longer in "' + name + '".', true));
          return;
        }
        const role = me.role === 'dm' ? 'dm' : 'player';
        if (role !== active.role) {
          // Promoted to co-DM or made a player again: switch the session over.
          activate(Object.assign({}, active, { role: role, character: me.character || null }));
          return;
        }
      }
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

  /* ---------- Campaign rules: homebrew content and builder settings ---------- */
  // campaigns/<id>/homebrew: { species, backgrounds, feats, spells, subraces: { <speciesId>: {...} }, subclasses: { <classId>: {...} } }
  //   (the shape CharacterEngine.mergeRules() takes; spells in the shape of rules/srd5-spells.js)
  // campaigns/<id>/settings/builder: { allowManual, strict }

  const HOMEBREW_GROUPS = ['species', 'backgrounds', 'feats', 'spells', 'items'];
  const HOMEBREW_NESTED = ['subraces', 'subclasses'];
  let homebrew = {};
  let builderSettings = {};
  let rulesUnsubs = [];

  function watchCampaignRules(campId) {
    rulesUnsubs.forEach((u) => u && u());
    rulesUnsubs = [];
    homebrew = {};
    builderSettings = {};
    if (!campId || typeof window.fbCampaignListen !== 'function') return;
    const announce = () => window.dispatchEvent(new CustomEvent('campaignrules', { detail: { homebrew: getHomebrew(), settings: getBuilderSettings() } }));
    rulesUnsubs.push(window.fbCampaignListen('campaigns/' + campId + '/homebrew', (v) => { homebrew = v || {}; announce(); }));
    rulesUnsubs.push(window.fbCampaignListen('campaigns/' + campId + '/settings/builder', (v) => { builderSettings = v || {}; announce(); }));
  }

  function getHomebrew() { return JSON.parse(JSON.stringify(homebrew || {})); }

  // Defaults: rules enforced, ability scores can't be typed in.
  function getBuilderSettings() {
    return { allowManual: !!builderSettings.allowManual, strict: builderSettings.strict !== false };
  }

  // group: 'species' | 'backgrounds' | 'feats' | 'spells' | 'subraces' | 'subclasses'; parent: species / class id for nested groups.
  // def null deletes the entry.
  function saveHomebrew(campId, group, id, def, parent) {
    if (!HOMEBREW_GROUPS.includes(group) && !HOMEBREW_NESTED.includes(group)) return Promise.reject(new Error('Unknown homebrew group'));
    if (!/^[a-z0-9_]{1,40}$/.test(id)) return Promise.reject(new Error('Bad id'));
    const path = 'campaigns/' + campId + '/homebrew/' + group + '/' + (HOMEBREW_NESTED.includes(group) ? parent + '/' : '') + id;
    return window.fbCampaignUpdate({ [path]: def });
  }

  function saveBuilderSettings(campId, settings) {
    return window.fbCampaignUpdate({ ['campaigns/' + campId + '/settings/builder']: { allowManual: !!settings.allowManual, strict: settings.strict !== false } });
  }

  /* ---------- Campaign journal (DMs write, players read) ---------- */
  // campaigns/<id>/notes/<noteId>: { title, body, visibleTo: 'all' | { nick: true }, by, createdAt, updatedAt }
  // "Only for" hides a note in the app; without Firebase Auth the database itself stays readable.

  let notes = {};
  let notesUnsub = null;
  let journalEditing = null;   // note id being edited, 'new', or null

  function watchNotes(campId) {
    if (notesUnsub) notesUnsub();
    notesUnsub = null;
    notes = {};
    renderJournalButton();
    if (!campId || typeof window.fbCampaignListen !== 'function') return;
    notesUnsub = window.fbCampaignListen('campaigns/' + campId + '/notes', (n) => {
      notes = n || {};
      renderJournalButton();
      // Keep an open journal current, but never under the DM's typing.
      if (document.getElementById('campaign-journal') && !journalEditing) openJournal();
      window.dispatchEvent(new CustomEvent('campaignnotes'));   // the Campaign screen lists the latest
    });
  }

  function noteVisible(n) {
    if (!n) return false;
    if (active && active.role === 'dm' && !viewingAs) return true;
    if (n.visibleTo === 'all' || !n.visibleTo) return true;
    return !!n.visibleTo[viewingAs ? viewingAs.nick : myKey()];
  }

  // Newest first.
  function visibleNotes() {
    return Object.keys(notes).map((id) => Object.assign({ id: id }, notes[id]))
      .filter(noteVisible)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  const seenKey = () => 'dnd-journal-seen:' + (active ? active.id : '') + ':' + (myKey() || '');

  function hasUnread() {
    let seen = 0;
    try { seen = Number(localStorage.getItem(seenKey())) || 0; } catch (e) { }
    return visibleNotes().some((n) => (n.updatedAt || 0) > seen && n.by !== myKey());
  }

  function markJournalSeen() {
    const newest = visibleNotes().reduce((m, n) => Math.max(m, n.updatedAt || 0), 0);
    try { localStorage.setItem(seenKey(), String(Math.max(newest, Date.now()))); } catch (e) { }
    renderJournalButton();
  }

  function saveNote(id, data) {
    if (!active || active.role !== 'dm') return Promise.reject(new Error('Only DMs write campaign notes'));
    const now = Date.now();
    const noteId = id || ('n' + now.toString(36) + Math.random().toString(36).slice(2, 5));
    const prev = notes[noteId] || {};
    const record = {
      title: String(data.title || '').trim().slice(0, 120) || 'Untitled',
      body: String(data.body || '').slice(0, 20000),
      visibleTo: data.visibleTo === 'all' || !data.visibleTo || !Object.keys(data.visibleTo).length ? 'all' : data.visibleTo,
      by: prev.by || myKey(),
      createdAt: prev.createdAt || now,
      updatedAt: now
    };
    return window.fbCampaignUpdate({ ['campaigns/' + active.id + '/notes/' + noteId]: record }).then(() => noteId);
  }

  function deleteNote(id) {
    if (!active || active.role !== 'dm') return Promise.reject(new Error('Only DMs delete campaign notes'));
    return window.fbCampaignUpdate({ ['campaigns/' + active.id + '/notes/' + id]: null });
  }

  function closeJournal() {
    journalEditing = null;
    const j = document.getElementById('campaign-journal');
    if (j) j.remove();
  }

  function fmtDate(t) {
    try { return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }

  function visibilityLabel(n) {
    if (n.visibleTo === 'all' || !n.visibleTo) return '👁 Everyone';
    const who = Object.keys(n.visibleTo).map((nick) => {
      const c = characterOf(nick);
      return (c && characterName(c)) || nick;
    });
    return '🔒 Only ' + who.join(', ');
  }

  function openJournal(editId) {
    if (!active) return;
    injectStyles();
    journalEditing = editId || null;
    const isDmView = active.role === 'dm' && !viewingAs;
    const prevScroll = (document.querySelector('#campaign-journal .journal-list') || {}).scrollTop || 0;
    const openIds = new Set([...document.querySelectorAll('#campaign-journal .journal-note.open')].map((n) => n.dataset.id));
    const existing = document.getElementById('campaign-journal');
    if (existing) existing.remove();

    const wrap = el('div');
    wrap.id = 'campaign-journal';
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap && !journalEditing) closeJournal(); });
    const card = el('div', 'auth-card journal-card');
    wrap.appendChild(card);

    const x = el('button', 'btn ghost small camp-close', '✕');
    x.type = 'button';
    x.onclick = closeJournal;
    card.appendChild(x);

    const head = el('div', 'auth-header');
    head.appendChild(el('div', 'auth-emblem', '📖'));
    head.appendChild(el('h2', 'auth-title', 'JOURNAL'));
    head.appendChild(el('div', 'auth-subtitle', active.name + (isDmView ? ' · you write, players read' : ' · shared by your DM')));
    card.appendChild(head);

    if (journalEditing) {
      card.appendChild(noteEditor(journalEditing === 'new' ? null : journalEditing));
    } else {
      if (isDmView) {
        const add = el('button', 'btn small', '＋ New note');
        add.type = 'button';
        add.onclick = () => openJournal('new');
        card.appendChild(add);
      }
      const list = el('div', 'journal-list');
      const items = visibleNotes();
      if (!items.length) list.appendChild(el('div', 'camp-empty', isDmView ? 'No notes yet. Write session recaps, handouts or secrets for one player.' : 'Your DM has not shared any notes yet.'));
      items.forEach((n) => {
        const box = el('div', 'journal-note' + (openIds.has(n.id) || items.length === 1 ? ' open' : ''));
        box.dataset.id = n.id;
        const top = el('button', 'journal-top');
        top.type = 'button';
        top.appendChild(el('span', 'camp-name', n.title));
        top.appendChild(el('span', 'camp-meta', fmtDate(n.updatedAt) + (isDmView ? ' · ' + visibilityLabel(n) : (n.visibleTo === 'all' || !n.visibleTo ? '' : ' · 🔒 just for you'))));
        top.onclick = () => box.classList.toggle('open');
        box.appendChild(top);
        const body = el('div', 'journal-body', n.body || '');
        box.appendChild(body);
        if (isDmView) {
          const acts = el('div', 'journal-acts');
          const ed = el('button', 'btn ghost small', '✏️ Edit');
          ed.type = 'button';
          ed.onclick = () => openJournal(n.id);
          const del = el('button', 'btn ghost small camp-danger', '🗑 Delete');
          del.type = 'button';
          del.onclick = () => { if (confirm('Delete "' + n.title + '"?')) deleteNote(n.id).catch((err) => alert(err.message || String(err))); };
          acts.append(ed, del);
          box.appendChild(acts);
        }
        list.appendChild(box);
      });
      card.appendChild(list);
      setTimeout(() => { list.scrollTop = prevScroll; }, 0);
      markJournalSeen();
    }
    document.body.appendChild(wrap);
  }

  function noteEditor(id) {
    const n = id ? notes[id] || {} : {};
    const f = el('form', 'journal-editor');
    const title = el('input', 'auth-input');
    title.type = 'text';
    title.maxLength = 120;
    title.placeholder = 'Title, e.g. Session 4 recap';
    title.value = n.title || '';
    const body = el('textarea', 'auth-input journal-text');
    body.placeholder = 'What happened, a handout, a secret…';
    body.value = n.body || '';

    // Visibility: everyone, or only the ticked players.
    const vis = el('div', 'journal-vis');
    vis.appendChild(el('div', 'camp-section', 'Who can read it'));
    const players = memberList().filter((m) => m.role === 'player');
    const picked = n.visibleTo && n.visibleTo !== 'all' ? n.visibleTo : {};
    const boxes = players.map((m) => {
      const lab = el('label', 'journal-who');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.value = m.nick;
      cb.checked = !!picked[m.nick];
      lab.append(cb, document.createTextNode(' ' + (m.characterName ? m.characterName + ' (' + m.nick + ')' : m.nick)));
      vis.appendChild(lab);
      return cb;
    });
    vis.appendChild(el('div', 'camp-meta', 'Tick nobody to share with everyone. Hidden notes are hidden in the app only: without Firebase Auth the database can still be read directly.'));

    const acts = el('div', 'journal-acts');
    const save = el('button', 'btn small', id ? 'Save' : 'Share');
    save.type = 'submit';
    const cancel = el('button', 'btn ghost small', 'Cancel');
    cancel.type = 'button';
    cancel.onclick = () => openJournal();
    acts.append(save, cancel);

    f.append(title, body, vis, acts, el('div', 'auth-msg'));
    f.onsubmit = (e) => {
      e.preventDefault();
      const ticked = boxes.filter((b) => b.checked).map((b) => b.value);
      const visibleTo = ticked.length ? Object.fromEntries(ticked.map((k) => [k, true])) : 'all';
      save.disabled = true;
      saveNote(id, { title: title.value, body: body.value, visibleTo: visibleTo })
        .then(() => openJournal())
        .catch((err) => {
          save.disabled = false;
          const m = f.querySelector('.auth-msg');
          m.textContent = err.message || String(err);
          m.className = 'auth-msg error';
        });
    };
    setTimeout(() => title.focus(), 0);
    return f;
  }

  // "📖" next to the campaign chip, with a dot when there's something new.
  function renderJournalButton() {
    let btn = document.getElementById('campaign-journal-btn');
    const chip = document.getElementById('campaign-chip');
    if (!active || !chip) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = el('button', 'btn ghost small camp-chip journal-btn');
      btn.id = 'campaign-journal-btn';
      btn.type = 'button';
      btn.onclick = () => openJournal();
      chip.after(btn);
    }
    const unread = hasUnread();
    btn.textContent = '📖' + (unread ? ' •' : '');
    btn.classList.toggle('journal-unread', unread);
    btn.title = unread ? 'Campaign journal — new notes' : 'Campaign journal';
  }

  /* ---------- Picker screen ---------- */

  function injectStyles() {
    if (document.getElementById('campaign-styles')) return;
    const style = document.createElement('style');
    style.id = 'campaign-styles';
    style.textContent = `
      .view-as-banner { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 99990; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: calc(100% - 24px); padding: 8px 12px; background: var(--panel); color: var(--text); border: 2px solid var(--accent); border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.6); font-size: 13px; }
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
      .camp-block { margin-bottom: 14px; }
      #campaign-journal {
        position: fixed; inset: 0; z-index: 99997; display: flex; align-items: flex-start; justify-content: center;
        padding: 30px 16px; overflow-y: auto; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
      }
      #campaign-journal .journal-card { max-width: 720px; }
      .journal-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; max-height: 60vh; overflow-y: auto; }
      .journal-note { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
      .journal-top { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; background: none; border: none; color: var(--text); cursor: pointer; text-align: left; font-family: var(--font-body); }
      .journal-body { display: none; padding: 0 12px 10px; white-space: pre-wrap; font-size: 14px; line-height: 1.5; color: var(--text); }
      .journal-note.open .journal-body { display: block; }
      .journal-acts { display: none; gap: 6px; padding: 0 12px 10px; }
      .journal-note.open .journal-acts, .journal-editor .journal-acts { display: flex; }
      .journal-editor { display: flex; flex-direction: column; gap: 10px; }
      .journal-editor .auth-input { padding-left: 12px; }
      .journal-text { min-height: 200px; resize: vertical; font-family: var(--font-body); line-height: 1.5; }
      .journal-vis { display: flex; flex-direction: column; gap: 4px; }
      .journal-who { font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 6px; }
      .journal-btn.journal-unread { border-color: var(--accent); color: var(--accent-strong); }
      .camp-code { flex: 1; font-family: var(--font-mono); font-size: 20px; letter-spacing: 4px; color: var(--accent-strong); padding: 6px 10px; background: var(--surface-inset); border: 1px solid var(--border); border-radius: var(--radius); text-align: center; }
      .camp-member { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
      .camp-member-who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .camp-member-acts { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
      .camp-member-acts .btn { padding: 2px 6px; }
      .camp-danger { color: var(--danger-strong); border-color: color-mix(in srgb, var(--danger) 60%, transparent); }
      .char-thumb { width: 40px; height: 40px; flex: none; border-radius: 50%; object-fit: cover; border: 1px solid var(--accent); background: var(--surface-inset); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); color: var(--accent-strong); }
      .camp-member-who .camp-form { margin: 0; }
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
        if (c.role === 'dm') {
          const manage = el('button', 'btn ghost small', '⚙');
          manage.type = 'button';
          manage.title = 'Manage: name, invite code, members';
          manage.onclick = () => openManage(c.id);
          row.appendChild(manage);
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
      const mine = el('button', 'btn ghost small', '🎭 My characters');
      mine.type = 'button';
      mine.onclick = () => openCharacters();
      foot.appendChild(mine);
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
    renderJournalButton();
  }

  /* ---------- View as player (DMs) ---------- */
  // A DM sees the campaign the way one of its players does: player rights everywhere
  // (DM bar, VTT, journal), on that player's sheet. Only this screen changes; the DM's
  // membership stays 'dm'. viewingAs: { nick, character, name } or null.
  let viewingAs = null;

  function viewAsPlayer(characterId) {
    const u = window.currentUser;
    if (!active || active.role !== 'dm' || !u || typeof loginUser !== 'function') return false;
    // Through window.Campaigns, like the rest of the page, so a test can stand in a member list.
    const list = window.Campaigns.memberList();
    const m = list.find((x) => x.role === 'player' && x.character && x.character === characterId) ||
      list.find((x) => x.role === 'player' && x.character);
    if (!m) { alert('No player in ' + active.name + ' has a character yet. Share the invite code first.'); return false; }
    viewingAs = { nick: m.nick, character: m.character, name: m.characterName || m.character };
    window.dmViewingAs = viewingAs;
    applyingRole = true;
    try { loginUser(u, 'player'); } finally { applyingRole = false; }
    if (typeof window.switchActiveCharacter === 'function') window.switchActiveCharacter(m.character, true);
    renderViewAsBanner();
    renderJournalButton();
    window.dispatchEvent(new CustomEvent('campaignchange', { detail: window.activeCampaign }));
    return true;
  }

  function stopViewingAs() {
    if (!viewingAs) return;
    const back = viewingAs.character;
    viewingAs = null;
    window.dmViewingAs = null;
    renderViewAsBanner();
    const u = window.currentUser;
    if (active && active.role === 'dm' && u && typeof loginUser === 'function') {
      applyingRole = true;
      try { loginUser(u, 'dm'); } finally { applyingRole = false; }
      // Back on the sheet that was being viewed, now with the DM's rights.
      if (typeof window.dmSwitchActivePlayer === 'function') window.dmSwitchActivePlayer(back, true);
    }
    renderJournalButton();
    window.dispatchEvent(new CustomEvent('campaignchange', { detail: window.activeCampaign }));
  }

  function renderViewAsBanner() {
    let b = document.getElementById('view-as-banner');
    if (!viewingAs) { if (b) b.remove(); return; }
    if (!b) {
      b = el('div', 'view-as-banner');
      b.id = 'view-as-banner';
      b.setAttribute('role', 'status');
      document.body.appendChild(b);
    }
    b.innerHTML = '';
    b.appendChild(el('span', '', '👁 Viewing ' + active.name + ' as ' + viewingAs.name + ' (' + viewingAs.nick + '), with player rights'));
    const btn = el('button', 'btn small', '👑 Back to DM view');
    btn.type = 'button';
    btn.onclick = stopViewingAs;
    b.appendChild(btn);
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
    viewingAs = null;
    window.dmViewingAs = null;
    renderViewAsBanner();
    active = null;
    window.activeCampaign = null;
    watchMembers(null);
    watchNotes(null);
    watchCampaignRules(null);
    closeJournal();
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
    openCharacters: openCharacters,
    renameCharacter: renameCharacter,
    copyCharacter: copyCharacter,
    exportCharacter: exportCharacter,
    importCharacterFile: importCharacterFile,
    importCharacterText: importCharacterText,
    importCharacterPdf: importCharacterPdf,
    importCharacterFields: importCharacterFields,
    readPdfFields: readPdfFields,
    saveImportedCharacter: saveImportedCharacter,
    deleteCharacter: deleteCharacter,
    MAX_CHARACTERS: MAX_CHARACTERS,
    createCharacter: createCharacter,
    setCampaignCharacter: setCampaignCharacter,
    createCampaign: createCampaign,
    joinCampaign: joinCampaign,
    openPicker: openPicker,
    active: () => active,
    homebrew: getHomebrew,
    builderSettings: getBuilderSettings,
    saveHomebrew: saveHomebrew,
    saveBuilderSettings: saveBuilderSettings,
    openManage: openManage,
    openJournal: openJournal,
    saveNote: saveNote,
    deleteNote: deleteNote,
    visibleNotes: visibleNotes,
    renewInvite: renewInvite,
    renameCampaign: renameCampaign,
    setMemberRole: setMemberRole,
    transferOwnership: transferOwnership,
    removeMember: removeMember,
    deleteCampaign: deleteCampaign,
    copyInvite: copyInvite,
    chooseCharacter: () => (active ? openCharacterChooser(active, 'Pick the character you play in ' + active.name + '.') : Promise.resolve()),
    viewAsPlayer: viewAsPlayer,
    stopViewingAs: stopViewingAs,
    viewingAs: () => (viewingAs ? Object.assign({}, viewingAs) : null),
    memberList: memberList,
    characterOf: characterOf,
    characterName: characterName,
    onLogin: onLogin,
    onLogout: onLogout
  };

  if (window.currentUser) onLogin();
})();
