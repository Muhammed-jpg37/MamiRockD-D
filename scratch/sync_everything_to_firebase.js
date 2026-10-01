const fs = require('fs');
const path = require('path');

const rootFile = path.join(__dirname, '..', 'index.html');
const subFile = path.join(__dirname, '..', 'index', 'index.html');

let content = fs.readFileSync(rootFile, 'utf8');

// 1. Add CSS for Cloud Sync Badge if not present
const syncBadgeCss = `
    /* Firebase Cloud Realtime Sync Indicator */
    .cloud-sync-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #4ade80;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(74, 222, 128, 0.3);
      border-radius: 14px;
      padding: 3px 10px;
      letter-spacing: 0.5px;
      cursor: default;
      transition: all 0.3s ease;
      user-select: none;
    }
    .cloud-sync-badge .sync-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
      display: inline-block;
      animation: syncPulse 2.5s infinite ease-in-out;
    }
    @keyframes syncPulse {
      0% { opacity: 0.6; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.15); box-shadow: 0 0 10px #4ade80; }
      100% { opacity: 0.6; transform: scale(0.9); }
    }
    .cloud-sync-badge.syncing {
      color: #facc15;
      background: rgba(250, 204, 21, 0.15);
      border-color: rgba(250, 204, 21, 0.4);
    }
    .cloud-sync-badge.syncing .sync-dot {
      background: #eab308;
      box-shadow: 0 0 8px #facc15;
      animation: spin 0.8s linear infinite;
    }
    .cloud-sync-badge.offline {
      color: #f87171;
      background: rgba(248, 113, 113, 0.15);
      border-color: rgba(248, 113, 113, 0.4);
    }
    .cloud-sync-badge.offline .sync-dot {
      background: #ef4444;
      box-shadow: none;
      animation: none;
    }
`;

if (!content.includes('.cloud-sync-badge')) {
  content = content.replace('  </style>', syncBadgeCss + '\n  </style>');
  console.log('Added cloud sync badge CSS.');
}

// 2. Add Cloud Sync Badge in Header
const syncBadgeMarkup = `          <!-- REALTIME FIREBASE STATUS BADGE -->
          <div class="cloud-sync-badge" id="cloud-sync-badge" title="Firebase Realtime Database: Connected & Live">
            <span class="sync-dot"></span>
            <span id="cloud-sync-text">🟢 Firebase Live</span>
          </div>
`;

if (!content.includes('id="cloud-sync-badge"')) {
  content = content.replace('<div class="auth-user-bar"', syncBadgeMarkup + '        <div class="auth-user-bar"');
  console.log('Added cloud sync badge markup in header.');
}

// 3. Update saveNotes() to call window.fbSaveNotes
const oldSaveNotes = `function saveNotes() { try { localStorage.setItem('dnd-notes-v2', JSON.stringify(S)); } catch (e) { toast('Storage full — export to save!', 3000); } }`;
const newSaveNotes = `function saveNotes() {
      try {
        localStorage.setItem('dnd-notes-v2', JSON.stringify(S));
      } catch (e) {
        toast('Storage full — export to save!', 3000);
      }
      if (typeof window.fbSaveNotes === 'function') {
        window.fbSaveNotes(S);
      }
    }`;

if (content.includes(oldSaveNotes)) {
  content = content.replace(oldSaveNotes, newSaveNotes);
  console.log('Updated saveNotes() with Firebase hook.');
}

// 4. Update applyBg() to save background to Firebase
const oldBgSave = `        localStorage.setItem('dnd-bg-meta', JSON.stringify(toSave));
        if (BG.image) localStorage.setItem('dnd-bg-img', BG.image);
        else localStorage.removeItem('dnd-bg-img');`;

const newBgSave = `        localStorage.setItem('dnd-bg-meta', JSON.stringify(toSave));
        if (BG.image) localStorage.setItem('dnd-bg-img', BG.image);
        else localStorage.removeItem('dnd-bg-img');
        if (typeof window.fbSaveBackground === 'function') {
          window.fbSaveBackground(toSave);
        }`;

if (content.includes(oldBgSave) && !content.includes('fbSaveBackground')) {
  content = content.replace(oldBgSave, newBgSave);
  console.log('Updated applyBg() with Firebase hook.');
}

// 5. Replace Firebase Module with Comprehensive Full-Sync System
const oldFirebaseBlockStart = '  <!-- FIREBASE SETUP & REAL-TIME INVENTORY SYNC -->';
const oldFirebaseBlockEnd = '  </script>\n</body>';

const newFirebaseModule = `  <!-- FIREBASE SETUP & REAL-TIME INVENTORY SYNC -->
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
       2. INVENTORIES & STATS & TRAITS SYNCHRONIZATION
       ======================================================== */
    let invDebounceTimer = null;
    window.fbSaveInventory = function(targetNickname, invState) {
      if (!db || !targetNickname || !invState) return;
      const key = targetNickname.toLowerCase();
      updateSyncBadge('syncing', '🔄 Syncing Sheet...');

      clearTimeout(invDebounceTimer);
      invDebounceTimer = setTimeout(() => {
        const payload = cleanData(invState);
        set(ref(db, 'inventories/' + key), payload)
          .then(() => {
            updateSyncBadge('online', '🟢 Firebase Live');
          })
          .catch((err) => {
            console.warn("Firebase inventory save error:", err);
            updateSyncBadge('offline', '⚠️ Sync Warning');
          });
      }, 300);
    };

    let currentActiveInventoryListener = null;
    let currentListenerPath = null;

    window.fbListenToInventory = function(targetNickname) {
      if (!db || !targetNickname) return;
      const pathKey = 'inventories/' + targetNickname.toLowerCase();
      if (currentListenerPath === pathKey) return;

      if (currentActiveInventoryListener) {
        off(currentActiveInventoryListener);
        currentActiveInventoryListener = null;
      }

      currentListenerPath = pathKey;
      const targetRef = ref(db, pathKey);
      currentActiveInventoryListener = targetRef;

      // Seed cloud from local if cloud is empty
      get(targetRef).then((snapshot) => {
        if (!snapshot.exists() && window.state && window.activeInventoryUser && window.activeInventoryUser.toLowerCase() === targetNickname.toLowerCase()) {
          console.log("Seeding inventory to Firebase cloud for:", targetNickname);
          window.fbSaveInventory(targetNickname, window.state);
        }
      });

      onValue(targetRef, (snapshot) => {
        const cloudState = snapshot.val();
        if (cloudState && window.activeInventoryUser && window.activeInventoryUser.toLowerCase() === targetNickname.toLowerCase()) {
          // Compare to prevent feedback loops
          const localStr = JSON.stringify(cleanData(window.state));
          const cloudStr = JSON.stringify(cloudState);
          if (localStr !== cloudStr) {
            window.isSyncingFromCloud = true;
            try {
              window.state = Object.assign(window.getDefaultState(targetNickname), cloudState);
              const localKey = 'hoard_inv_user_' + targetNickname.toLowerCase();
              localStorage.setItem(localKey, JSON.stringify(window.state));
              if (typeof window.normalizeState === 'function') window.normalizeState();
              if (typeof window.renderAll === 'function') window.renderAll();
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
       3. CAMPAIGN NOTES SYNCHRONIZATION (WORKSPACE & DRAWINGS)
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

      // Seed local notes to Firebase if cloud is empty
      get(notesRef).then((snapshot) => {
        if (!snapshot.exists() && window.S && window.S.notes && window.S.notes.length > 0) {
          console.log("Seeding campaign notes to Firebase cloud...");
          set(notesRef, cleanData(window.S));
        }
      });

      // Realtime listener for shared campaign notes
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

    /* ========================================================
       5. PARTY SHARED LOOT (LEGACY & EXTENSION)
       ======================================================== */
    const partyLootRef = db ? ref(db, 'inventory/party_loot') : null;
    window.inventoryRef = partyLootRef;

    window.addLoot = function (itemName) {
      if (!itemName || !partyLootRef) return;
      const newItemRef = push(partyLootRef);
      set(newItemRef, { name: itemName, addedAt: Date.now() })
        .then(() => {
          console.log("Firebase: loot added successfully ->", itemName);
        })
        .catch((err) => {
          console.error("Firebase write error:", err);
        });
    };

    if (partyLootRef) {
      onValue(partyLootRef, (snapshot) => {
        const data = snapshot.val();
        const displayDiv = document.getElementById('inventory-display');
        if (!displayDiv) return;
        if (!data) {
          displayDiv.innerHTML = "<p style='color:var(--text-muted); margin:0;'>Inventory is empty.</p>";
          return;
        }
        let html = "<ul style='margin:0; padding-left:20px;'>";
        for (const itemId in data) {
          const item = data[itemId];
          const name = typeof item === 'string' ? item : (item && item.name ? item.name : 'Item');
          html += \`<li style='margin-bottom:4px;'>\${name}</li>\`;
        }
        html += "</ul>";
        displayDiv.innerHTML = html;
      });
    }

    // Hook active user listener immediately upon boot
    if (window.activeInventoryUser) {
      window.fbListenToInventory(window.activeInventoryUser);
    }
  </script>
</body>`;

const startIdx = content.indexOf(oldFirebaseBlockStart);
const endIdx = content.indexOf(oldFirebaseBlockEnd);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + newFirebaseModule + content.slice(endIdx + oldFirebaseBlockEnd.length);
  fs.writeFileSync(rootFile, content, 'utf8');
  fs.writeFileSync(subFile, content, 'utf8');
  console.log('Firebase comprehensive realtime sync installed in index.html & index/index.html!');
} else {
  console.error('Could not locate old Firebase block boundaries.');
}
