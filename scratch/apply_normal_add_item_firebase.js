const fs = require('fs');
const path = require('path');

const rootFile = path.join(__dirname, '..', 'index.html');
const subFile = path.join(__dirname, '..', 'index', 'index.html');

let content = fs.readFileSync(rootFile, 'utf8');

// 1. REMOVE the legacy Real-Time Firebase Loot Feed HTML block
const feedRegex = /\s*<!-- REALTIME FIREBASE INVENTORY DISPLAY -->[\s\S]*?<\/div>\s*<\/div>\s*(?=\s*<!-- COL 4)/i;

if (feedRegex.test(content)) {
  content = content.replace(feedRegex, '\n      </div>\n\n');
  console.log('Removed legacy Real-Time Firebase Loot Feed box.');
} else {
  // Alternative match if structure differs slightly
  const altFeedStart = '<!-- REALTIME FIREBASE INVENTORY DISPLAY -->';
  const sIdx = content.indexOf(altFeedStart);
  if (sIdx !== -1) {
    const eIdx = content.indexOf('<!-- COL 4', sIdx);
    if (eIdx !== -1) {
      // Find the last </div> before <!-- COL 4
      const chunk = content.slice(sIdx, eIdx);
      const lastDiv = chunk.lastIndexOf('</div>');
      content = content.slice(0, sIdx) + content.slice(eIdx);
      console.log('Removed legacy Firebase loot feed box (alternative match).');
    }
  }
}

// 2. Add window.applyCloudInventory, window.getState, window.applyCloudNotes to main script
const stateAnchor = `let state = getDefaultState('Default');`;
const stateHelpers = `let state = getDefaultState('Default');
    window.getState = function() { return state; };
    window.applyCloudInventory = function(targetNickname, cloudState) {
      if (!cloudState) return;
      state = Object.assign(getDefaultState(targetNickname), cloudState);
      const localKey = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        localStorage.setItem(localKey, JSON.stringify(state));
      } catch (e) { }
      normalizeState();
      renderAll();
    };`;

if (content.includes(stateAnchor) && !content.includes('window.applyCloudInventory')) {
  content = content.replace(stateAnchor, stateHelpers);
  console.log('Added window.getState and window.applyCloudInventory.');
}

// 3. In saveItem(), ensure immediate cloud sync and visual notification
const oldSaveItemEnd = `      save();
      closeItemModal();
      renderAll();
    }`;

const newSaveItemEnd = `      save();
      if (typeof window.fbSaveInventoryInstant === 'function') {
        window.fbSaveInventoryInstant(activeInventoryUser || (currentUser ? currentUser.nickname : 'DM'), state);
      }
      closeItemModal();
      renderAll();
      if (typeof toast === 'function') {
        toast('✨ Item "' + data.name + '" added to ' + (activeInventoryUser || 'inventory') + ' and synced to cloud!', 3000);
      }
    }`;

if (content.includes(oldSaveItemEnd)) {
  content = content.replace(oldSaveItemEnd, newSaveItemEnd);
  console.log('Updated saveItem() for instant Firebase push and toast.');
}

// 4. Update the Firebase Module at the bottom of the page
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
       1. ACCOUNTS SYNCHRONIZATION (TWO-WAY LIVE SYNC)
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
        updateSyncBadge('offline', '⚠️ Sync Warning');
      });
    };

    if (db) {
      // Auto-seed initial local accounts to Firebase if cloud has none
      get(ref(db, 'accounts')).then((snapshot) => {
        const cloudAccs = snapshot.val();
        let localAccs = {};
        try {
          const raw = localStorage.getItem('dnd_accounts_v1');
          if (raw) localAccs = JSON.parse(raw);
        } catch (e) { }

        if (!cloudAccs || Object.keys(cloudAccs).length === 0) {
          if (Object.keys(localAccs).length > 0) {
            console.log("Seeding local accounts to Firebase cloud...", localAccs);
            set(ref(db, 'accounts'), cleanData(localAccs));
          }
        } else {
          // Merge cloud accounts into local storage
          let merged = { ...localAccs, ...cloudAccs };
          localStorage.setItem('dnd_accounts_v1', JSON.stringify(merged));
          if (window.currentUser && window.currentUser.role === 'dm' && typeof window.populateDmPlayerDropdown === 'function') {
            window.populateDmPlayerDropdown();
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
       2. NORMAL INVENTORIES & ITEMS SYNCHRONIZATION
       When an item is added, it is sent to db and owner sees it
       ======================================================== */
    let invDebounceTimer = null;
    window.fbSaveInventory = function(targetNickname, invState, immediate = false) {
      if (!db || !targetNickname || !invState) return;
      const key = targetNickname.toLowerCase();
      updateSyncBadge('syncing', '🔄 Syncing Items...');

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

      if (currentListenerPath === pathKey) return; // already listening

      if (currentActiveInventoryListener && currentListenerPath) {
        off(ref(db, currentListenerPath));
        currentActiveInventoryListener = null;
        currentListenerPath = null;
      }

      currentListenerPath = pathKey;
      const targetRef = ref(db, pathKey);
      currentActiveInventoryListener = targetRef;

      // Seed cloud from local if cloud is empty
      get(targetRef).then((snapshot) => {
        if (!snapshot.exists()) {
          const currentLocal = window.getState ? window.getState() : window.state;
          if (currentLocal && window.activeInventoryUser && window.activeInventoryUser.toLowerCase() === targetNickname.toLowerCase()) {
            console.log("Seeding inventory to Firebase cloud for:", targetNickname);
            window.fbSaveInventoryInstant(targetNickname, currentLocal);
          }
        }
      });

      // Real-time listener: when any item is added or edited in this inventory, update view immediately!
      onValue(targetRef, (snapshot) => {
        const cloudState = snapshot.val();
        if (cloudState && window.activeInventoryUser && window.activeInventoryUser.toLowerCase() === targetNickname.toLowerCase()) {
          const currentLocal = window.getState ? window.getState() : window.state;
          const localStr = JSON.stringify(cleanData(currentLocal));
          const cloudStr = JSON.stringify(cleanData(cloudState));

          if (localStr !== cloudStr) {
            console.log("⚡ Real-time inventory sync received from Firebase for:", targetNickname);
            window.isSyncingFromCloud = true;
            try {
              if (typeof window.applyCloudInventory === 'function') {
                window.applyCloudInventory(targetNickname, cloudState);
              } else {
                window.state = Object.assign(window.getDefaultState(targetNickname), cloudState);
                const localKey = 'hoard_inv_user_' + targetNickname.toLowerCase();
                localStorage.setItem(localKey, JSON.stringify(window.state));
                if (typeof window.normalizeState === 'function') window.normalizeState();
                if (typeof window.renderAll === 'function') window.renderAll();
              }
              updateSyncBadge('online', '⚡ Live Cloud Updated');
              setTimeout(() => updateSyncBadge('online', '🟢 Firebase Live'), 2000);
            } catch(err) {
              console.warn("Error applying cloud inventory update:", err);
            }
            window.isSyncingFromCloud = false;
          }
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
          console.log("Seeding campaign notes to Firebase cloud...");
          set(notesRef, cleanData(window.S));
        }
      });

      onValue(notesRef, (snapshot) => {
        const cloudNotes = snapshot.val();
        if (cloudNotes && typeof cloudNotes === 'object' && cloudNotes.cats && cloudNotes.notes) {
          const localStr = JSON.stringify(cleanData(window.S));
          const cloudStr = JSON.stringify(cloudNotes);
          if (localStr !== cloudStr) {
            console.log("Receiving real-time campaign notes update from Firebase cloud");
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
    if (window.activeInventoryUser) {
      window.fbListenToInventory(window.activeInventoryUser);
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
console.log('Successfully updated index.html and index/index.html!');
