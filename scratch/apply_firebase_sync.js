const fs = require('fs');
const path = require('path');

const rootFile = path.join(__dirname, '..', 'index.html');
const subFile = path.join(__dirname, '..', 'index', 'index.html');

let content = fs.readFileSync(rootFile, 'utf8');

const oldFirebaseBlockStart = '  <!-- FIREBASE SETUP & REAL-TIME INVENTORY SYNC -->';
const oldFirebaseBlockEnd = '  </script>\n</body>';

const newFirebaseScript = `  <!-- FIREBASE SETUP & REAL-TIME INVENTORY SYNC -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
    import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js";
    import { getDatabase, ref, set, get, onValue, push, off } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

    // Your web app's Firebase configuration with verified European West1 RTDB region URL
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
      console.log("Firebase connected successfully to:", firebaseConfig.databaseURL);
    } catch (e) {
      console.warn("Firebase initialization warning:", e);
    }

    // Party loot legacy ref
    const inventoryRef = db ? ref(db, 'inventory/party_loot') : null;
    window.inventoryRef = inventoryRef;

    window.addLoot = function (itemName) {
      if (!itemName || !inventoryRef) return;
      const newItemRef = push(inventoryRef);
      set(newItemRef, { name: itemName, addedAt: Date.now() })
        .then(() => {
          console.log("Firebase: loot added successfully ->", itemName);
        })
        .catch((err) => {
          console.error("Firebase write error:", err);
        });
    };

    if (inventoryRef) {
      onValue(inventoryRef, (snapshot) => {
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
      }, (error) => {
        console.error("Firebase Realtime Database error:", error);
      });
    }

    /* ========================================================
       FIREBASE ACCOUNT SYNC & REALTIME PER-PLAYER INVENTORY SYNC
       ======================================================== */
    // 1. Sync Account to Firebase
    window.fbSaveAccount = function(acc) {
      if (!db || !acc || !acc.nickname) return;
      const key = acc.nickname.toLowerCase();
      const accountRef = ref(db, 'accounts/' + key);
      set(accountRef, {
        nickname: acc.nickname,
        password: acc.password,
        role: acc.role || 'player',
        createdAt: acc.createdAt || Date.now()
      }).catch(err => console.warn("Firebase save account error:", err));
    };

    // 2. Sync Inventory to Firebase
    window.fbSaveInventory = function(targetNickname, invState) {
      if (!db || !targetNickname || !invState) return;
      const key = targetNickname.toLowerCase();
      const invRef = ref(db, 'inventories/' + key);
      set(invRef, invState).catch(err => console.warn("Firebase save inventory error:", err));
    };

    // 3. Listen to cloud accounts and auto-discover new players for the DM
    if (db) {
      const accountsRef = ref(db, 'accounts');
      onValue(accountsRef, (snapshot) => {
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

    // 4. Live listener for currently active player's inventory
    let currentActiveInventoryListener = null;
    let currentListenerPath = null;

    window.fbListenToInventory = function(targetNickname) {
      if (!db || !targetNickname) return;
      const pathKey = 'inventories/' + targetNickname.toLowerCase();
      if (currentListenerPath === pathKey) return; // already listening

      if (currentActiveInventoryListener) {
        off(currentActiveInventoryListener);
        currentActiveInventoryListener = null;
      }

      currentListenerPath = pathKey;
      const targetRef = ref(db, pathKey);
      currentActiveInventoryListener = targetRef;

      onValue(targetRef, (snapshot) => {
        const cloudState = snapshot.val();
        if (cloudState && window.activeInventoryUser && window.activeInventoryUser.toLowerCase() === targetNickname.toLowerCase()) {
          // If we received an update from cloud, update local state if newer
          window.isSyncingFromCloud = true;
          try {
            window.state = Object.assign(window.getDefaultState(targetNickname), cloudState);
            const localKey = 'hoard_inv_user_' + targetNickname.toLowerCase();
            localStorage.setItem(localKey, JSON.stringify(window.state));
            if (typeof window.normalizeState === 'function') window.normalizeState();
            if (typeof window.renderAll === 'function') window.renderAll();
          } catch(err) {
            console.warn("Error applying cloud inventory update:", err);
          }
          window.isSyncingFromCloud = false;
        }
      });
    };

    // If an inventory is already loaded before Firebase finishes importing, hook listener now
    if (window.activeInventoryUser) {
      window.fbListenToInventory(window.activeInventoryUser);
    }
  </script>
</body>`;

const startIdx = content.indexOf(oldFirebaseBlockStart);
const endIdx = content.indexOf(oldFirebaseBlockEnd);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + newFirebaseScript + content.slice(endIdx + oldFirebaseBlockEnd.length);
  fs.writeFileSync(rootFile, content, 'utf8');
  fs.writeFileSync(subFile, content, 'utf8');
  console.log('Firebase block successfully updated in both files!');
} else {
  console.error('Could not locate old Firebase block delimiters:', startIdx, endIdx);
}
