const fs = require('fs');
const path = require('path');

const rootFile = path.join(__dirname, '..', 'index.html');
const subFile = path.join(__dirname, '..', 'index', 'index.html');

let content = fs.readFileSync(rootFile, 'utf8');

// 1. Replace the top of <script> where const STORAGE_KEY was defined
const oldScriptHead = `  <script>
    const STORAGE_KEY = 'hoard_inventory_v1';
    let state = {
      campaign: 'Party Loot',
      currency: { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 },
      capacity: 150,
      items: [],
      selectedId: null,
      deathSaves: { open: true, successes: [false, false, false], failures: [false, false, false] },
      attunements: { open: true, slots: [null, null, null] },
      spellSlots: {
        max: { 1: 4, 2: 3, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        used: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
      },
      spellbook: {
        open: true, query: '', classFilter: '', levelFilter: '', schoolFilter: '', sortBy: 'level-asc',
        catalogLoaded: false, loading: false, error: '', catalog: [], list: [],
        maxPerLevel: { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
      },
      theme: { preset: 'leather', customBg: '#100b08', customAccent: '#c9a227' }
    };`;

const newScriptHead = `  <script>
    /* ========================================================
       AUTHENTICATION, INDIVIDUAL INVENTORIES & DM ROLE STATE
       ======================================================== */
    const STORAGE_ACCOUNTS_KEY = 'dnd_accounts_v1';
    const STORAGE_SESSION_KEY = 'dnd_current_user_session';
    const STORAGE_INV_PREFIX = 'hoard_inv_user_';
    const LEGACY_STORAGE_KEY = 'hoard_inventory_v1';

    let currentUser = null;           // Logged in account: { nickname, role, ... }
    let activeInventoryUser = null;    // Nickname of inventory being inspected / modified
    let isSyncingFromCloud = false;    // Prevents feedback loops during Firebase updates

    function getDefaultState(characterName) {
      const isDm = (currentUser && currentUser.role === 'dm' && (!characterName || characterName === currentUser.nickname));
      const cleanName = characterName || (currentUser ? currentUser.nickname : 'Adventurer');

      let defaultItems = [];
      let defaultStats = {
        str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10,
        profBonus: 2, speed: 30, initBonus: 2, ac: 12,
        characterClass: 'Fighter', species: 'Human', level: 5,
        armorProf: 'All Armor, Shields',
        weaponProf: 'Simple Weapons, Martial Weapons',
        toolProf: '',
        languages: 'Common',
        saveNotes: '', senseNotes: '',
        saveProfs: {}, skillProfs: {}, saveCustomBonuses: {}, skillCustomBonuses: {}
      };
      let defaultCurrency = { platinum: 0, gold: 50, electrum: 0, silver: 20, copper: 50 };

      if (cleanName.toLowerCase() === 'gimli') {
        defaultStats.characterClass = 'Fighter';
        defaultStats.species = 'Dwarf';
        defaultStats.subrace = 'Mountain Dwarf';
        defaultStats.subclass = 'Champion';
        defaultStats.str = 18; defaultStats.con = 16; defaultStats.dex = 12; defaultStats.int = 10; defaultStats.wis = 12; defaultStats.cha = 8;
        defaultStats.ac = 16;
        defaultCurrency.gold = 145;
        defaultItems = [
          { id: 'g_item_1', name: 'Dwarven Greataxe +1', category: 'weapon', rarity: 'rare', qty: 1, weight: 7, value: 500, equipped: 'main', desc: 'A masterwork double-bladed greataxe forged in Mithral Hall. Grants +1 to attack and damage rolls.', damage: '1d12+5 Slashing', damageType: 'Slashing', proficiencyType: 'Martial' },
          { id: 'g_item_2', name: 'Dwarven Plate Armor', category: 'armor', rarity: 'veryrare', qty: 1, weight: 65, value: 1500, equipped: 'chest', desc: 'Heavy dwarven plate adorned with mountain runes.', baseAc: 18, armorType: 'Heavy' },
          { id: 'g_item_3', name: 'Ring of Protection', category: 'ring', rarity: 'rare', qty: 1, weight: 0.1, value: 800, equipped: 'ring1', attunementRequired: true, desc: 'You gain a +1 bonus to AC and saving throws while wearing this ring.' },
          { id: 'g_item_4', name: 'Potion of Greater Healing', category: 'potion', rarity: 'uncommon', qty: 3, weight: 1.5, value: 150, desc: 'A creature that drinks this potion regains 4d4 + 4 hit points.' }
        ];
      } else if (cleanName.toLowerCase() === 'legolas') {
        defaultStats.characterClass = 'Ranger';
        defaultStats.species = 'Elf';
        defaultStats.subrace = 'Wood Elf';
        defaultStats.subclass = 'Hunter';
        defaultStats.str = 12; defaultStats.con = 14; defaultStats.dex = 18; defaultStats.int = 12; defaultStats.wis = 16; defaultStats.cha = 10;
        defaultStats.ac = 15;
        defaultCurrency.gold = 95;
        defaultItems = [
          { id: 'l_item_1', name: 'Longbow of the Woodland', category: 'weapon', rarity: 'veryrare', qty: 1, weight: 2, value: 1200, equipped: 'main', desc: 'Carved from Lothlórien mallorn wood. Whispers like wind when drawn.', damage: '1d8+5 Piercing', damageType: 'Piercing', proficiencyType: 'Martial' },
          { id: 'l_item_2', name: 'Elven Studded Leather', category: 'armor', rarity: 'rare', qty: 1, weight: 13, value: 500, equipped: 'chest', desc: 'Supple elven leather armor affording silent movement.', baseAc: 12, armorType: 'Light' },
          { id: 'l_item_3', name: 'Cloak of Elvenkind', category: 'cloak', rarity: 'uncommon', qty: 1, weight: 1, value: 400, equipped: 'cloak', attunementRequired: true, desc: 'While wearing this cloak with its hood up, Wisdom (Perception) checks made to see you have disadvantage.' },
          { id: 'l_item_4', name: 'Quiver of Arrows', category: 'gear', rarity: 'common', qty: 60, weight: 3, value: 3, desc: 'Standard sharp bodkin arrows.' }
        ];
      } else if (cleanName.toLowerCase() === 'dm') {
        defaultStats.characterClass = 'Dungeon Master';
        defaultStats.species = 'Omnipotent';
        defaultStats.level = 20;
        defaultStats.ac = 25;
        defaultCurrency = { platinum: 100, gold: 5000, electrum: 500, silver: 2000, copper: 5000 };
        defaultItems = [
          { id: 'dm_item_1', name: 'Staff of the Magi', category: 'weapon', rarity: 'artifact', qty: 1, weight: 5, value: 50000, equipped: 'main', attunementRequired: true, desc: 'An artifact of incredible wizardry and planar energy.' },
          { id: 'dm_item_2', name: 'Deck of Many Things', category: 'wondrous', rarity: 'legendary', qty: 1, weight: 0.5, value: 20000, desc: 'A fateful deck of enchanted cards.' },
          { id: 'dm_item_3', name: 'Vorpal Longsword', category: 'weapon', rarity: 'legendary', qty: 1, weight: 3, value: 15000, desc: 'Snicker-snack! Decapitates foes on a natural 20.' }
        ];
      }

      return {
        campaign: isDm ? '👑 DM Master Vault' : cleanName + "'s Vault",
        currency: defaultCurrency,
        capacity: 150,
        items: defaultItems,
        selectedId: null,
        deathSaves: { open: true, successes: [false, false, false], failures: [false, false, false] },
        attunements: { open: true, slots: [null, null, null] },
        characterStats: defaultStats,
        hp: { current: 45, max: 45, temp: 0 },
        spellSlots: {
          max: { 1: 4, 2: 3, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
          used: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
        },
        spellbook: {
          open: true, query: '', classFilter: '', levelFilter: '', schoolFilter: '', sortBy: 'level-asc',
          catalogLoaded: false, loading: false, error: '', catalog: [], list: [],
          maxPerLevel: { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
        },
        theme: { preset: 'leather', customBg: '#100b08', customAccent: '#c9a227' }
      };
    }

    let state = getDefaultState('Default');`;

content = content.replace(oldScriptHead, newScriptHead);

// 2. Replace load() and save() functions
const oldLoadSave = `    function load() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { state = Object.assign(state, JSON.parse(raw)); } catch (e) { }
      }
      state.deathSaves = Object.assign({ open: true, successes: [false, false, false], failures: [false, false, false] }, state.deathSaves || {});
      state.deathSaves.successes = Array.isArray(state.deathSaves.successes) ? state.deathSaves.successes.slice(0, 3).map(Boolean) : [false, false, false];
      while (state.deathSaves.successes.length < 3) state.deathSaves.successes.push(false);
      state.deathSaves.failures = Array.isArray(state.deathSaves.failures) ? state.deathSaves.failures.slice(0, 3).map(Boolean) : [false, false, false];
      while (state.deathSaves.failures.length < 3) state.deathSaves.failures.push(false);
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }`;

const newLoadSave = `    /* ========================================================
       LOAD & SAVE - INDIVIDUAL PER-ACCOUNT INVENTORIES
       ======================================================== */
    function load(targetNickname) {
      if (!targetNickname) {
        targetNickname = activeInventoryUser || (currentUser ? currentUser.nickname : 'DM');
      }
      activeInventoryUser = targetNickname;
      const key = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      const raw = localStorage.getItem(key);

      if (raw) {
        try {
          state = Object.assign(getDefaultState(targetNickname), JSON.parse(raw));
        } catch (e) {
          console.error("Error parsing saved inventory for", targetNickname, e);
          state = getDefaultState(targetNickname);
        }
      } else {
        // If no user inventory exists yet, check if there is a legacy hoard inventory to migrate
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw && (targetNickname.toLowerCase() === 'dm' || targetNickname.toLowerCase() === 'admin')) {
          try {
            state = Object.assign(getDefaultState(targetNickname), JSON.parse(legacyRaw));
          } catch (e) {
            state = getDefaultState(targetNickname);
          }
        } else {
          state = getDefaultState(targetNickname);
        }
        localStorage.setItem(key, JSON.stringify(state));
      }

      state.deathSaves = Object.assign({ open: true, successes: [false, false, false], failures: [false, false, false] }, state.deathSaves || {});
      state.deathSaves.successes = Array.isArray(state.deathSaves.successes) ? state.deathSaves.successes.slice(0, 3).map(Boolean) : [false, false, false];
      while (state.deathSaves.successes.length < 3) state.deathSaves.successes.push(false);
      state.deathSaves.failures = Array.isArray(state.deathSaves.failures) ? state.deathSaves.failures.slice(0, 3).map(Boolean) : [false, false, false];
      while (state.deathSaves.failures.length < 3) state.deathSaves.failures.push(false);
    }

    function save() {
      const targetNickname = activeInventoryUser || (currentUser ? currentUser.nickname : 'DM');
      const key = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn("Local storage save error:", err);
      }

      // Sync to Firebase Realtime Database if available and not currently processing cloud update
      if (typeof window.fbSaveInventory === 'function' && !isSyncingFromCloud) {
        window.fbSaveInventory(targetNickname, state);
      }
    }`;

content = content.replace(oldLoadSave, newLoadSave);

// 3. Add Account & Authentication Functions + DM controller functions
const authControllerFunctions = `
    /* ========================================================
       ACCOUNT AUTHENTICATION & DM INVENTORY SWITCHER LOGIC
       ======================================================== */
    function getStoredAccounts() {
      let accounts = {};
      try {
        const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
        if (raw) accounts = JSON.parse(raw);
      } catch (e) { }

      // Seed default accounts if empty
      if (!accounts || Object.keys(accounts).length === 0) {
        accounts = {
          "dm": { nickname: "DM", password: "123", role: "dm", createdAt: 1700000000000 },
          "gimli": { nickname: "Gimli", password: "123", role: "player", createdAt: 1700000001000 },
          "legolas": { nickname: "Legolas", password: "123", role: "player", createdAt: 1700000002000 }
        };
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
        // Pre-save default states so their inventories are populated immediately
        ['dm', 'gimli', 'legolas'].forEach(nick => {
          const k = STORAGE_INV_PREFIX + nick;
          if (!localStorage.getItem(k)) {
            localStorage.setItem(k, JSON.stringify(getDefaultState(nick)));
          }
        });
      }
      return accounts;
    }

    function saveStoredAccount(acc) {
      const accounts = getStoredAccounts();
      const lower = acc.nickname.toLowerCase();
      accounts[lower] = acc;
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
      if (typeof window.fbSaveAccount === 'function') {
        window.fbSaveAccount(acc);
      }
    }

    function switchAuthTab(tab) {
      const btnLogin = document.getElementById('auth-tab-login');
      const btnReg = document.getElementById('auth-tab-register');
      const roleGroup = document.getElementById('auth-role-group');
      const submitBtn = document.getElementById('auth-submit-btn');
      const msgBox = document.getElementById('auth-msg-box');
      if (msgBox) { msgBox.textContent = ''; msgBox.className = 'auth-msg'; }

      if (tab === 'register') {
        if (btnLogin) btnLogin.classList.remove('active');
        if (btnReg) btnReg.classList.add('active');
        if (roleGroup) roleGroup.style.display = 'block';
        if (submitBtn) submitBtn.textContent = '✨ FORGE ACCOUNT & ENTER';
      } else {
        if (btnLogin) btnLogin.classList.add('active');
        if (btnReg) btnReg.classList.remove('active');
        if (roleGroup) roleGroup.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '⚔ ENTER REALM';
      }
    }

    function selectAuthRole(role) {
      const cardPlayer = document.getElementById('role-card-player');
      const cardDm = document.getElementById('role-card-dm');
      const roleInput = document.getElementById('auth-role');
      if (roleInput) roleInput.value = role;

      if (role === 'dm') {
        if (cardPlayer) cardPlayer.classList.remove('selected');
        if (cardDm) cardDm.classList.add('selected');
      } else {
        if (cardPlayer) cardPlayer.classList.add('selected');
        if (cardDm) cardDm.classList.remove('selected');
      }
    }

    function toggleAuthPasswordVisibility() {
      const pwInput = document.getElementById('auth-password');
      if (!pwInput) return;
      pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    }

    function quickFillAuth(nick, pw) {
      const nInput = document.getElementById('auth-nickname');
      const pInput = document.getElementById('auth-password');
      if (nInput) nInput.value = nick;
      if (pInput) pInput.value = pw;
      switchAuthTab('login');
      handleAuthSubmit(new Event('submit'));
    }

    function handleAuthSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      const nInput = document.getElementById('auth-nickname');
      const pInput = document.getElementById('auth-password');
      const msgBox = document.getElementById('auth-msg-box');
      const roleInput = document.getElementById('auth-role');

      const nickname = (nInput ? nInput.value : '').trim();
      const password = (pInput ? pInput.value : '').trim();
      const isRegister = document.getElementById('auth-tab-register')?.classList.contains('active');
      const role = (roleInput ? roleInput.value : 'player') || 'player';

      if (!nickname || !password) {
        if (msgBox) {
          msgBox.textContent = 'Please enter both nickname and password.';
          msgBox.className = 'auth-msg error';
        }
        return;
      }

      const accounts = getStoredAccounts();
      const key = nickname.toLowerCase();

      if (isRegister) {
        if (accounts[key]) {
          if (msgBox) {
            msgBox.textContent = 'Nickname already taken! Please choose another or sign in.';
            msgBox.className = 'auth-msg error';
          }
          return;
        }
        const newAccount = {
          nickname: nickname,
          password: password,
          role: role,
          createdAt: Date.now()
        };
        saveStoredAccount(newAccount);
        if (msgBox) {
          msgBox.textContent = 'Account forged! Entering realm...';
          msgBox.className = 'auth-msg success';
        }
        setTimeout(() => {
          loginUser(newAccount);
        }, 300);
      } else {
        const acc = accounts[key];
        if (!acc) {
          if (msgBox) {
            msgBox.textContent = 'Adventurer "' + nickname + '" not found. Check spelling or create an account!';
            msgBox.className = 'auth-msg error';
          }
          return;
        }
        if (acc.password !== password) {
          if (msgBox) {
            msgBox.textContent = 'Incorrect password! The arcane seal remains unbroken.';
            msgBox.className = 'auth-msg error';
          }
          return;
        }
        if (msgBox) {
          msgBox.textContent = 'Welcome back, ' + acc.nickname + '!';
          msgBox.className = 'auth-msg success';
        }
        setTimeout(() => {
          loginUser(acc);
        }, 200);
      }
    }

    function loginUser(account) {
      currentUser = account;
      activeInventoryUser = account.nickname;
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({
          nickname: account.nickname,
          role: account.role
        }));
      } catch (e) { }

      // Hide Auth Screen
      const authScreen = document.getElementById('auth-portal-screen');
      if (authScreen) authScreen.classList.add('auth-hidden');

      // Update Header User Badge
      const nameEl = document.getElementById('auth-user-name');
      const roleEl = document.getElementById('auth-user-role');
      const iconEl = document.getElementById('auth-user-icon');
      if (nameEl) nameEl.textContent = account.nickname;
      if (roleEl) {
        roleEl.textContent = account.role === 'dm' ? 'Dungeon Master' : 'Player';
        roleEl.className = 'auth-user-role-tag ' + (account.role === 'dm' ? 'dm' : 'player');
      }
      if (iconEl) iconEl.textContent = account.role === 'dm' ? '👑' : '👤';

      // Setup DM Panel or regular view
      const dmBar = document.getElementById('dm-control-bar');
      const dmBanner = document.getElementById('dm-inspecting-notice');
      if (account.role === 'dm') {
        if (dmBar) dmBar.style.display = 'flex';
        populateDmPlayerDropdown();
        if (dmBanner) dmBanner.style.display = 'none';
      } else {
        if (dmBar) dmBar.style.display = 'none';
        if (dmBanner) dmBanner.style.display = 'none';
      }

      // Load this user's individual inventory
      load(account.nickname);
      normalizeState();
      applyTheme();
      renderAll();

      // Hook Firebase live listener if available
      if (typeof window.fbListenToInventory === 'function') {
        window.fbListenToInventory(account.nickname);
      }
    }

    function logoutCurrentUser() {
      save();
      try { localStorage.removeItem(STORAGE_SESSION_KEY); } catch (e) { }
      currentUser = null;
      activeInventoryUser = null;

      const authScreen = document.getElementById('auth-portal-screen');
      if (authScreen) authScreen.classList.remove('auth-hidden');
      const pwInput = document.getElementById('auth-password');
      if (pwInput) pwInput.value = '';
      const msgBox = document.getElementById('auth-msg-box');
      if (msgBox) { msgBox.textContent = ''; msgBox.className = 'auth-msg'; }
    }

    /* ========================================================
       DM CONTROLLER: INSPECT & EDIT OTHER PLAYERS' INVENTORIES
       ======================================================== */
    function populateDmPlayerDropdown() {
      const select = document.getElementById('dm-player-dropdown');
      if (!select) return;

      const accounts = getStoredAccounts();
      const currentVal = activeInventoryUser || (currentUser ? currentUser.nickname : '__dm__');

      let html = '<option value="__dm__">👑 My DM Master Vault</option>';
      Object.keys(accounts).sort().forEach(key => {
        const acc = accounts[key];
        if (acc.role !== 'dm') {
          html += '<option value="' + escapeHtml(acc.nickname) + '">👤 Player: ' + escapeHtml(acc.nickname) + '</option>';
        }
      });
      select.innerHTML = html;

      // Restore active selection
      if (activeInventoryUser && activeInventoryUser.toLowerCase() !== currentUser.nickname.toLowerCase()) {
        select.value = activeInventoryUser;
      } else {
        select.value = '__dm__';
      }
    }

    function dmSwitchActivePlayer(targetName) {
      if (!currentUser || currentUser.role !== 'dm') return;

      // Save changes to current inventory before switching!
      save();

      const target = (!targetName || targetName === '__dm__') ? currentUser.nickname : targetName;
      activeInventoryUser = target;

      load(target);
      normalizeState();
      applyTheme();
      renderAll();

      const isInspectingOther = (target.toLowerCase() !== currentUser.nickname.toLowerCase());
      const banner = document.getElementById('dm-inspecting-notice');
      const bannerTarget = document.getElementById('dm-inspecting-target-name');
      const statusTag = document.getElementById('dm-status-tag');
      const select = document.getElementById('dm-player-dropdown');

      if (banner) banner.style.display = isInspectingOther ? 'flex' : 'none';
      if (bannerTarget) bannerTarget.textContent = target;
      if (statusTag) statusTag.textContent = isInspectingOther ? ('Inspecting: ' + target) : 'Viewing: Master Vault';
      if (select) select.value = isInspectingOther ? target : '__dm__';

      // Switch live Firebase listener to this player's inventory
      if (typeof window.fbListenToInventory === 'function') {
        window.fbListenToInventory(target);
      }
    }

    function openDmCreatePlayerModal() {
      const ov = document.getElementById('dm-create-player-overlay');
      if (ov) ov.classList.add('open');
      const nickInput = document.getElementById('dm-new-player-nickname');
      if (nickInput) { nickInput.value = ''; nickInput.focus(); }
    }

    function closeDmCreatePlayerModal() {
      const ov = document.getElementById('dm-create-player-overlay');
      if (ov) ov.classList.remove('open');
    }

    function dmSubmitCreatePlayer() {
      const nickInput = document.getElementById('dm-new-player-nickname');
      const passInput = document.getElementById('dm-new-player-password');
      const classInput = document.getElementById('dm-new-player-class');
      const lvlInput = document.getElementById('dm-new-player-level');

      const nickname = (nickInput ? nickInput.value : '').trim();
      const password = (passInput ? passInput.value : '123').trim() || '123';
      const charClass = (classInput ? classInput.value : 'Fighter').trim() || 'Fighter';
      const level = parseInt(lvlInput ? lvlInput.value : '5', 10) || 5;

      if (!nickname) {
        alert('Please enter a nickname for the player.');
        return;
      }

      const accounts = getStoredAccounts();
      if (accounts[nickname.toLowerCase()]) {
        alert('An account with this nickname already exists!');
        return;
      }

      const newAccount = {
        nickname: nickname,
        password: password,
        role: 'player',
        createdAt: Date.now()
      };
      saveStoredAccount(newAccount);

      // Create initial state for this player
      const pState = getDefaultState(nickname);
      pState.characterStats.characterClass = charClass;
      pState.characterStats.level = level;
      localStorage.setItem(STORAGE_INV_PREFIX + nickname.toLowerCase(), JSON.stringify(pState));

      if (typeof window.fbSaveInventory === 'function') {
        window.fbSaveInventory(nickname, pState);
      }

      populateDmPlayerDropdown();
      closeDmCreatePlayerModal();

      if (confirm('Player "' + nickname + '" created! Do you want to switch to their inventory now?')) {
        dmSwitchActivePlayer(nickname);
      }
    }

    function openDmGiftLootModal() {
      const ov = document.getElementById('dm-gift-loot-overlay');
      const desc = document.getElementById('dm-gift-target-desc');
      const target = activeInventoryUser || (currentUser ? currentUser.nickname : 'Player');
      if (desc) desc.textContent = 'Deliver loot or coins directly into ' + target + "\\'s inventory.";
      if (ov) ov.classList.add('open');
      const nameInput = document.getElementById('dm-gift-item-name');
      if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    }

    function closeDmGiftLootModal() {
      const ov = document.getElementById('dm-gift-loot-overlay');
      if (ov) ov.classList.remove('open');
    }

    function dmSubmitGiftLoot() {
      const nameInput = document.getElementById('dm-gift-item-name');
      const qtyInput = document.getElementById('dm-gift-item-qty');
      const raritySelect = document.getElementById('dm-gift-item-rarity');
      const coinsInput = document.getElementById('dm-gift-coins');

      const itemName = (nameInput ? nameInput.value : '').trim();
      const qty = parseInt(qtyInput ? qtyInput.value : '1', 10) || 1;
      const rarity = (raritySelect ? raritySelect.value : 'rare') || 'rare';
      const coins = parseInt(coinsInput ? coinsInput.value : '0', 10) || 0;

      if (!itemName && coins <= 0) {
        alert('Please enter an item name or a gold amount to gift.');
        return;
      }

      state.items = state.items || [];
      if (itemName) {
        state.items.push({
          id: 'gift_' + uid(),
          name: itemName,
          category: 'wondrous',
          rarity: rarity,
          qty: qty,
          weight: 1,
          value: 100,
          desc: 'Gifted by the Dungeon Master.'
        });
      }

      if (coins > 0) {
        state.currency = state.currency || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
        state.currency.gold = (Number(state.currency.gold) || 0) + coins;
      }

      save();
      renderAll();
      closeDmGiftLootModal();

      const target = activeInventoryUser || 'Player';
      alert('✨ Loot delivered to ' + target + ' successfully!');
    }
`;

// Insert authControllerFunctions right after normalizeState() or before renderAll()
const renderAllMarker = '    function renderAll() {';
content = content.replace(renderAllMarker, authControllerFunctions + '\n    function renderAll() {');

// 4. Update Startup code around line 8920
const oldStartup = `    try {
      load();
      normalizeState();
      applyTheme();
      renderAll();
      refreshSpellCatalog();
    } catch (err) {
      console.error("Startup error:", err);
    }`;

const newStartup = `    try {
      // Check for saved session
      let session = null;
      try {
        const rawSession = localStorage.getItem(STORAGE_SESSION_KEY);
        if (rawSession) session = JSON.parse(rawSession);
      } catch (e) { }

      const allAccounts = getStoredAccounts();

      if (session && session.nickname && allAccounts[session.nickname.toLowerCase()]) {
        const acc = allAccounts[session.nickname.toLowerCase()];
        loginUser(acc);
      } else {
        // Show login modal
        const authScreen = document.getElementById('auth-portal-screen');
        if (authScreen) authScreen.classList.remove('auth-hidden');
        // Initial fallback render
        load('DM');
        normalizeState();
        applyTheme();
        renderAll();
      }
      refreshSpellCatalog();
    } catch (err) {
      console.error("Startup error:", err);
    }`;

content = content.replace(oldStartup, newStartup);

fs.writeFileSync(rootFile, content, 'utf8');
fs.writeFileSync(subFile, content, 'utf8');
console.log('Successfully inserted Account, Auth, and DM logic into both HTML files.');
