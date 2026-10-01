const fs = require('fs');
const path = require('path');

const rootFile = path.join(__dirname, '..', 'index.html');
const subFile = path.join(__dirname, '..', 'index', 'index.html');

let content = fs.readFileSync(rootFile, 'utf8');

// 1. Ensure currentUser and activeInventoryUser are exposed on window
const oldStateDec = `    let currentUser = null;           // Logged in account: { nickname, role, ... }
    let activeInventoryUser = null;    // Nickname of inventory being inspected / modified
    let isSyncingFromCloud = false;    // Prevents feedback loops during Firebase updates`;

const newStateDec = `    let currentUser = null;           // Logged in account: { nickname, role, ... }
    let activeInventoryUser = null;    // Nickname of inventory being inspected / modified
    let isSyncingFromCloud = false;    // Prevents feedback loops during Firebase updates

    // Ensure window properties stay 100% synchronized for Firebase module
    Object.defineProperty(window, 'activeInventoryUser', {
      get() { return activeInventoryUser; },
      set(val) { activeInventoryUser = val; },
      configurable: true
    });
    Object.defineProperty(window, 'currentUser', {
      get() { return currentUser; },
      set(val) { currentUser = val; },
      configurable: true
    });
    Object.defineProperty(window, 'isSyncingFromCloud', {
      get() { return isSyncingFromCloud; },
      set(val) { isSyncingFromCloud = val; },
      configurable: true
    });`;

if (content.includes(oldStateDec)) {
  content = content.replace(oldStateDec, newStateDec);
  console.log('Made activeInventoryUser and currentUser reactive on window.');
}

// 2. Ensure applyCloudInventory updates state and handles array/item normalization
const oldApplyCloud = `    window.applyCloudInventory = function(targetNickname, cloudState) {
      if (!cloudState) return;
      state = Object.assign(getDefaultState(targetNickname), cloudState);
      const localKey = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        localStorage.setItem(localKey, JSON.stringify(state));
      } catch (e) { }
      normalizeState();
      renderAll();
    };`;

const newApplyCloud = `    window.applyCloudInventory = function(targetNickname, cloudState) {
      if (!cloudState) return;
      const base = getDefaultState(targetNickname);
      // Firebase sometimes converts arrays with gaps to objects or empty values; ensure items is a proper array
      let incomingItems = cloudState.items;
      if (incomingItems && typeof incomingItems === 'object' && !Array.isArray(incomingItems)) {
        incomingItems = Object.values(incomingItems).filter(Boolean);
      }
      state = Object.assign(base, cloudState);
      if (incomingItems && Array.isArray(incomingItems)) {
        state.items = incomingItems;
      }
      activeInventoryUser = targetNickname;
      const localKey = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        localStorage.setItem(localKey, JSON.stringify(state));
      } catch (e) { }
      normalizeState();
      renderAll();
      console.log('✅ Applied cloud inventory for:', targetNickname, 'Items count:', (state.items || []).length);
    };`;

if (content.includes(oldApplyCloud)) {
  content = content.replace(oldApplyCloud, newApplyCloud);
  console.log('Updated applyCloudInventory with array sanitization.');
}

// 3. Update handleAuthSubmit to check Firebase cloud accounts if local lookup fails
const oldAuthFail = `        const acc = accounts[key];
        if (!acc) {
          if (msgBox) {
            msgBox.textContent = 'Adventurer "' + nickname + '" not found. Check spelling or create an account!';
            msgBox.className = 'auth-msg error';
          }
          return;
        }`;

const newAuthFail = `        let acc = accounts[key];
        if (!acc) {
          // Attempt async check from Firebase cloud accounts before rejecting
          if (typeof window.fbCheckAccountOnline === 'function') {
            if (msgBox) { msgBox.textContent = 'Checking cloud vault...'; msgBox.className = 'auth-msg'; }
            window.fbCheckAccountOnline(nickname, password, (foundAcc, err) => {
              if (foundAcc) {
                saveStoredAccount(foundAcc);
                loginUser(foundAcc);
              } else {
                if (msgBox) {
                  msgBox.textContent = err || ('Adventurer "' + nickname + '" not found. Check spelling or create an account!');
                  msgBox.className = 'auth-msg error';
                }
              }
            });
            return;
          }
          if (msgBox) {
            msgBox.textContent = 'Adventurer "' + nickname + '" not found. Check spelling or create an account!';
            msgBox.className = 'auth-msg error';
          }
          return;
        }`;

if (content.includes(oldAuthFail)) {
  content = content.replace(oldAuthFail, newAuthFail);
  console.log('Updated handleAuthSubmit with cloud account fallback.');
}

// 4. Update Firebase module at the bottom of the page
const fbModuleStart = '  <!-- FIREBASE SETUP & REAL-TIME INVENTORY SYNC -->';
const fbModuleEnd = '  </script>\n</body>';

const newFbModule = `  <!-- FIREBASE SETUP & REAL-TIME INVENTORY SYNC -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
    import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js";
    import { getDatabase, ref, set, get, onValue, push, off, update } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

    // Verified Firebase Realtime Database European configuration
    const firebaseConfig = {
      apiKey: "AIzaSyACV3sk-oG_kFLcrsNXwFnLmHIYisMP6j0",
      authDomain: "mamirockd-d37.firebaseapp.com",
      databaseURL: "https://mamirockd-d37-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "mamirockd-d37",
      storageBucket: "mamirockd-d37.firebasestorage.app",
      messagingSenderId: "655783304075",
      appId: "1:655783304075:web:ed082166a76e4221caed8e",
      measurementId: "G-DK8Z13YSGB"
    };

    let app = null;
    let db = null;
    try {
      app = initializeApp(firebaseConfig);
      db = getDatabase(app);
      window.firebaseApp = app;
      window.firebaseDb = db;
      console.log("⚡ Firebase connected live to:", firebaseConfig.databaseURL);
      updateSyncBadge('online', '🟢 Firebase Live');
    } catch (e) {
      console.warn("Firebase initialization error:", e);
      updateSyncBadge('offline', '⚠️ Offline Mode');
    }

    // Deep cleaner: Strips 'undefined' properties so Firebase RTDB never rejects writes
    function cleanData(val) {
      if (val === undefined) return null;
      return JSON.parse(JSON.stringify(val, (k, v) => (v === undefined ? null : v)));
    }

    function updateSyncBadge(status, text) {
      const badge = document.getElementById('cloud-sync-badge');
      const label = document.getElementById('cloud-sync-text');
      if (!badge || !label) return;
      badge.className = 'cloud-sync-badge ' + (status === 'syncing' ? 'syncing' : (status === 'offline' ? 'offline' : ''));
      label.textContent = text || (status === 'syncing' ? '🔄 Syncing...' : (status === 'offline' ? '⚠️ Offline' : '🟢 Firebase Live'));
    }
    window.updateSyncBadge = updateSyncBadge;

    /* ========================================================
       1. ACCOUNTS SYNCHRONIZATION (CROSS-DEVICE LOGIN)
       ======================================================== */
    window.fbSaveAccount = function(acc) {
      if (!db || !acc || !acc.nickname) return;
      const key = acc.nickname.toLowerCase();
      updateSyncBadge('syncing', '🔄 Saving Account...');
      set(ref(db, 'accounts/' + key), cleanData({
        nickname: acc.nickname,
        password: acc.password,
        role: acc.role || 'player',
        createdAt: acc.createdAt || Date.now()
      })).then(() => {
        updateSyncBadge('online', '🟢 Firebase Live');
      }).catch(err => {
        console.warn("Firebase account save error:", err);
      });
    };

    // Online cloud account check for login across different devices (e.g. PC to Phone)
    window.fbCheckAccountOnline = function(nickname, password, callback) {
      if (!db || !nickname) {
        callback(null, 'Database unreachable.');
        return;
      }
      const key = nickname.toLowerCase();
      get(ref(db, 'accounts/' + key)).then((snapshot) => {
        const acc = snapshot.val();
        if (!acc) {
          callback(null, 'Adventurer "' + nickname + '" not found in cloud.');
          return;
        }
        if (acc.password !== password) {
          callback(null, 'Incorrect password!');
          return;
        }
        callback(acc, null);
      }).catch((err) => {
        callback(null, 'Network error checking cloud account.');
      });
    };

    if (db) {
      // Sync cloud accounts into local storage on startup
      get(ref(db, 'accounts')).then((snapshot) => {
        const cloudAccs = snapshot.val();
        let localAccs = {};
        try {
          const raw = localStorage.getItem('dnd_accounts_v1');
          if (raw) localAccs = JSON.parse(raw);
        } catch (e) { }

        if (cloudAccs && typeof cloudAccs === 'object') {
          let merged = { ...localAccs, ...cloudAccs };
          localStorage.setItem('dnd_accounts_v1', JSON.stringify(merged));
          if (window.currentUser && window.currentUser.role === 'dm' && typeof window.populateDmPlayerDropdown === 'function') {
            window.populateDmPlayerDropdown();
          }
        }
      });

      // Also check inventories in cloud to auto-register any player accounts that exist
      get(ref(db, 'inventories')).then((snap) => {
        const invs = snap.val();
        if (invs && typeof invs === 'object') {
          let localAccs = {};
          try {
            const raw = localStorage.getItem('dnd_accounts_v1');
            if (raw) localAccs = JSON.parse(raw);
          } catch(e) {}
          let changed = false;
          Object.keys(invs).forEach(k => {
            if (!localAccs[k]) {
              localAccs[k] = { nickname: k, password: '123', role: 'player', createdAt: Date.now() };
              window.fbSaveAccount(localAccs[k]);
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem('dnd_accounts_v1', JSON.stringify(localAccs));
            if (window.currentUser && window.currentUser.role === 'dm' && typeof window.populateDmPlayerDropdown === 'function') {
              window.populateDmPlayerDropdown();
            }
          }
        }
      });

      // Realtime listener for newly registered accounts
      onValue(ref(db, 'accounts'), (snapshot) => {
        const data = snapshot.val();
        if (data && typeof data === 'object') {
          let localAccounts = {};
          try {
            const raw = localStorage.getItem('dnd_accounts_v1');
            if (raw) localAccounts = JSON.parse(raw);
          } catch(e) {}

          let changed = false;
          Object.keys(data).forEach(k => {
            const cloudAcc = data[k];
            if (cloudAcc && cloudAcc.nickname && !localAccounts[k]) {
              localAccounts[k] = cloudAcc;
              changed = true;
            }
          });

          if (changed) {
            localStorage.setItem('dnd_accounts_v1', JSON.stringify(localAccounts));
            if (window.currentUser && window.currentUser.role === 'dm' && typeof window.populateDmPlayerDropdown === 'function') {
              window.populateDmPlayerDropdown();
            }
          }
        }
      });
    }

    /* ========================================================
       2. REALTIME INVENTORY & ITEMS SYNC (PC <-> PHONE)
       ======================================================== */
    let invDebounceTimer = null;
    window.fbSaveInventory = function(targetNickname, invState, immediate = false) {
      if (!db || !targetNickname || !invState) return;
      const key = targetNickname.toLowerCase();
      updateSyncBadge('syncing', '🔄 Syncing to Cloud...');

      const doSave = () => {
        const payload = cleanData(invState);
        set(ref(db, 'inventories/' + key), payload)
          .then(() => {
            updateSyncBadge('online', '🟢 Firebase Live');
          })
          .catch((err) => {
            console.warn("Firebase inventory save error:", err);
            updateSyncBadge('offline', '⚠️ Sync Warning');
          });
      };

      if (immediate) {
        clearTimeout(invDebounceTimer);
        doSave();
      } else {
        clearTimeout(invDebounceTimer);
        invDebounceTimer = setTimeout(doSave, 250);
      }
    };

    window.fbSaveInventoryInstant = function(targetNickname, invState) {
      window.fbSaveInventory(targetNickname, invState, true);
    };

    let currentActiveInventoryListener = null;
    let currentListenerPath = null;

    window.fbListenToInventory = function(targetNickname) {
      if (!db || !targetNickname) return;
      const pathKey = 'inventories/' + targetNickname.toLowerCase();

      if (currentListenerPath === pathKey) return; // already active

      if (currentActiveInventoryListener && currentListenerPath) {
        off(ref(db, currentListenerPath));
        currentActiveInventoryListener = null;
        currentListenerPath = null;
      }

      currentListenerPath = pathKey;
      const targetRef = ref(db, pathKey);
      currentActiveInventoryListener = targetRef;

      // 1. Immediately fetch existing inventory from cloud on hook (critical for phone on login!)
      get(targetRef).then((snapshot) => {
        if (snapshot.exists()) {
          const cloudState = snapshot.val();
          console.log("📥 Downloaded initial inventory from Firebase for:", targetNickname, cloudState);
          if (typeof window.applyCloudInventory === 'function') {
            window.applyCloudInventory(targetNickname, cloudState);
          }
        } else {
          // If not in cloud yet, seed local state to cloud
          const currentLocal = window.getState ? window.getState() : window.state;
          if (currentLocal) {
            console.log("Seeding inventory to Firebase cloud for:", targetNickname);
            window.fbSaveInventoryInstant(targetNickname, currentLocal);
          }
        }
      });

      // 2. Realtime listener: whenever ANY item is added or modified, update live!
      onValue(targetRef, (snapshot) => {
        const cloudState = snapshot.val();
        if (!cloudState) return;

        // Verify active target
        const currentActive = window.activeInventoryUser;
        if (!currentActive || currentActive.toLowerCase() !== targetNickname.toLowerCase()) return;

        // If local is currently writing, don't echo back
        if (window.isSyncingFromCloud) return;

        const currentLocal = window.getState ? window.getState() : window.state;
        const localStr = JSON.stringify(cleanData(currentLocal));
        const cloudStr = JSON.stringify(cleanData(cloudState));

        if (localStr !== cloudStr) {
          console.log("⚡ Real-time inventory update received from Firebase for:", targetNickname);
          window.isSyncingFromCloud = true;
          try {
            if (typeof window.applyCloudInventory === 'function') {
              window.applyCloudInventory(targetNickname, cloudState);
            }
            updateSyncBadge('online', '⚡ Live Cloud Updated');
            setTimeout(() => updateSyncBadge('online', '🟢 Firebase Live'), 2000);
          } catch(err) {
            console.warn("Error applying cloud inventory update:", err);
          }
          window.isSyncingFromCloud = false;
        }
      });
    };

    /* ========================================================
       3. CAMPAIGN NOTES SYNCHRONIZATION
       ======================================================== */
    let notesDebounceTimer = null;
    window.fbSaveNotes = function(notesState) {
      if (!db || !notesState) return;
      updateSyncBadge('syncing', '🔄 Saving Notes...');
      clearTimeout(notesDebounceTimer);
      notesDebounceTimer = setTimeout(() => {
        const payload = cleanData(notesState);
        set(ref(db, 'campaign_notes/workspace'), payload)
          .then(() => {
            updateSyncBadge('online', '🟢 Firebase Live');
          })
          .catch((err) => {
            console.warn("Firebase save notes error:", err);
            updateSyncBadge('offline', '⚠️ Sync Warning');
          });
      }, 400);
    };

    if (db) {
      const notesRef = ref(db, 'campaign_notes/workspace');

      get(notesRef).then((snapshot) => {
        if (!snapshot.exists() && window.S && window.S.notes && window.S.notes.length > 0) {
          set(notesRef, cleanData(window.S));
        }
      });

      onValue(notesRef, (snapshot) => {
        const cloudNotes = snapshot.val();
        if (cloudNotes && typeof cloudNotes === 'object' && cloudNotes.cats && cloudNotes.notes) {
          const localStr = JSON.stringify(cleanData(window.S));
          const cloudStr = JSON.stringify(cloudNotes);
          if (localStr !== cloudStr) {
            window.S = cloudNotes;
            try {
              localStorage.setItem('dnd-notes-v2', JSON.stringify(cloudNotes));
            } catch (e) { }
            if (typeof window.render === 'function') window.render();
            if (typeof window.renderCats === 'function') window.renderCats();
            if (typeof window.renderNotesList === 'function') window.renderNotesList();
            updateSyncBadge('online', '⚡ Notes Live Updated');
            setTimeout(() => updateSyncBadge('online', '🟢 Firebase Live'), 2000);
          }
        }
      });
    }

    /* ========================================================
       4. CAMPAIGN BACKGROUND & THEME SYNCHRONIZATION
       ======================================================== */
    window.fbSaveBackground = function(bgState) {
      if (!db || !bgState) return;
      const payload = cleanData(bgState);
      set(ref(db, 'campaign_background/meta'), payload).catch(err => console.warn("Firebase bg save error:", err));
    };

    if (db) {
      const bgRef = ref(db, 'campaign_background/meta');
      onValue(bgRef, (snapshot) => {
        const cloudBg = snapshot.val();
        if (cloudBg && typeof cloudBg === 'object' && window.BG) {
          if (JSON.stringify(cloudBg) !== JSON.stringify(cleanData(window.BG))) {
            window.BG = Object.assign(window.BG, cloudBg);
            if (typeof window.applyBg === 'function') window.applyBg();
          }
        }
      });
    }

    // Hook active user listener immediately upon boot
    const bootTarget = window.activeInventoryUser || (window.currentUser ? window.currentUser.nickname : null);
    if (bootTarget) {
      console.log("Hooking initial Firebase listener for:", bootTarget);
      window.fbListenToInventory(bootTarget);
    }
  </script>
</body>`;

const startIdx = content.indexOf(fbModuleStart);
const endIdx = content.indexOf(fbModuleEnd);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + newFbModule + content.slice(endIdx + fbModuleEnd.length);
  console.log('Firebase module replaced.');
}

fs.writeFileSync(rootFile, content, 'utf8');
fs.writeFileSync(subFile, content, 'utf8');
console.log('Successfully updated both files with cross-device sync fix!');
