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

  /* ---------- Hooks ---------- */

  // Called by loginUser(); also below, for a session restored before this file loaded.
  function onLogin() {
    migrateIfNeeded();
  }

  window.Campaigns = {
    FIRST_CAMPAIGN_ID: FIRST_CAMPAIGN_ID,
    newInviteCode: newInviteCode,
    buildMigration: buildMigration,
    previewMigration: previewMigration,
    migrateIfNeeded: migrateIfNeeded,
    onLogin: onLogin
  };

  if (window.currentUser) onLogin();
})();
