const fs = require('fs');
const path = require('path');

const rootFile = path.join(__dirname, '..', 'index.html');
const subFile = path.join(__dirname, '..', 'index', 'index.html');

console.log('Reading index.html...');
let content = fs.readFileSync(rootFile, 'utf8');

// 1. CSS Insertion before </style> (around line 3844)
const cssMarker = '</style>';
const authCss = `
    /* ========================================================
       AUTH LOGIN & REGISTRATION SCREEN + DM ROLE STYLES
       ======================================================== */
    #auth-portal-screen {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: radial-gradient(ellipse at center, rgba(32, 22, 14, 0.96) 0%, rgba(10, 7, 5, 0.98) 75%, #050302 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(10px);
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    #auth-portal-screen.auth-hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      background: var(--panel);
      border: 2px solid var(--border-bright);
      border-radius: 12px;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(201, 162, 39, 0.25), inset 0 0 30px rgba(0,0,0,0.7);
      padding: 32px 36px;
      position: relative;
      color: var(--text);
      font-family: 'Spectral', serif;
    }
    .auth-card::before {
      content: '';
      position: absolute;
      inset: 4px;
      border: 1px solid rgba(201, 162, 39, 0.3);
      border-radius: 8px;
      pointer-events: none;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 24px;
      position: relative;
    }
    .auth-emblem {
      font-size: 38px;
      margin-bottom: 6px;
      filter: drop-shadow(0 0 10px rgba(201, 162, 39, 0.5));
      animation: authGlow 3s ease-in-out infinite alternate;
    }
    @keyframes authGlow {
      from { transform: scale(1); filter: drop-shadow(0 0 8px rgba(201, 162, 39, 0.4)); }
      to { transform: scale(1.05); filter: drop-shadow(0 0 16px rgba(232, 207, 122, 0.8)); }
    }
    .auth-title {
      font-family: 'Cinzel', serif;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      color: var(--gold-bright);
      text-shadow: 0 2px 4px rgba(0,0,0,0.8);
      margin: 0;
    }
    .auth-subtitle {
      font-size: 13px;
      color: var(--text-dim);
      font-style: italic;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }
    .auth-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
      gap: 8px;
    }
    .auth-tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-dim);
      font-family: 'Cinzel', serif;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 1px;
    }
    .auth-tab-btn.active {
      color: var(--gold-bright);
      border-bottom-color: var(--gold);
      background: rgba(201, 162, 39, 0.08);
      border-radius: 4px 4px 0 0;
    }
    .auth-form-group {
      margin-bottom: 16px;
    }
    .auth-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .auth-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .auth-input-icon {
      position: absolute;
      left: 12px;
      font-size: 16px;
      color: var(--text-faint);
      pointer-events: none;
    }
    .auth-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px 10px 38px;
      font-family: 'Spectral', serif;
      font-size: 15px;
      color: var(--text);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .auth-input:focus {
      border-color: var(--gold);
      box-shadow: 0 0 8px rgba(201, 162, 39, 0.4);
    }
    .auth-pw-toggle {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
    }
    .auth-pw-toggle:hover {
      color: var(--gold-bright);
    }
    .auth-role-select {
      display: flex;
      gap: 10px;
      margin-top: 4px;
    }
    .auth-role-card {
      flex: 1;
      border: 1px solid var(--border);
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      padding: 10px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }
    .auth-role-card.selected {
      border-color: var(--gold);
      background: rgba(201, 162, 39, 0.15);
      box-shadow: 0 0 8px rgba(201, 162, 39, 0.3);
    }
    .auth-role-card .role-title {
      font-family: 'Cinzel', serif;
      font-size: 12px;
      font-weight: 700;
      color: var(--gold-bright);
      margin-bottom: 3px;
    }
    .auth-role-card .role-desc {
      font-size: 10px;
      color: var(--text-dim);
      line-height: 1.2;
    }
    .auth-btn-submit {
      width: 100%;
      background: linear-gradient(135deg, #a8811f 0%, #d8b038 50%, #997217 100%);
      color: #100b08;
      border: 1px solid #e8cf7a;
      border-radius: 6px;
      padding: 12px;
      font-family: 'Cinzel', serif;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1.5px;
      cursor: pointer;
      margin-top: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      transition: all 0.2s ease;
    }
    .auth-btn-submit:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(201, 162, 39, 0.4);
    }
    .auth-btn-submit:active {
      transform: translateY(1px);
    }
    .auth-msg {
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      text-align: center;
      display: none;
    }
    .auth-msg.error {
      display: block;
      background: rgba(168, 60, 50, 0.25);
      border: 1px solid var(--danger);
      color: var(--danger-bright);
    }
    .auth-msg.success {
      display: block;
      background: rgba(74, 143, 79, 0.25);
      border: 1px solid var(--success);
      color: #4ade80;
    }
    .auth-quick-demo {
      margin-top: 20px;
      border-top: 1px dashed var(--border);
      padding-top: 14px;
      text-align: center;
    }
    .auth-quick-demo-title {
      font-size: 11px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .auth-demo-pills {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .auth-demo-pill {
      background: rgba(0,0,0,0.5);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--gold-bright);
      cursor: pointer;
      transition: all 0.15s;
    }
    .auth-demo-pill:hover {
      border-color: var(--gold);
      background: rgba(201, 162, 39, 0.15);
      transform: translateY(-1px);
    }

    /* Top Bar User Badge */
    .auth-user-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 3px 8px 3px 12px;
    }
    .auth-user-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text);
    }
    .auth-user-badge strong {
      color: var(--gold-bright);
      font-family: 'Cinzel', serif;
    }
    .auth-user-role-tag {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
    }
    .auth-user-role-tag.dm {
      background: rgba(201, 162, 39, 0.25);
      border: 1px solid var(--gold);
      color: var(--gold-bright);
    }
    .auth-user-role-tag.player {
      background: rgba(59, 142, 196, 0.25);
      border: 1px solid var(--rare);
      color: #7dd3fc;
    }

    /* DM Control Bar */
    .dm-control-bar {
      background: linear-gradient(90deg, rgba(46, 35, 24, 0.95), rgba(28, 21, 15, 0.95));
      border: 1px solid var(--gold);
      border-radius: 8px;
      padding: 8px 16px;
      margin: 10px 0 16px 0;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5), inset 0 0 15px rgba(201,162,39,0.15);
    }
    .dm-control-badge {
      font-family: 'Cinzel', serif;
      font-size: 12px;
      font-weight: 900;
      color: var(--gold-bright);
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: 1px;
    }
    .dm-control-label {
      font-size: 12px;
      color: var(--text-dim);
    }
    .dm-player-dropdown {
      background: #150f0a;
      border: 1px solid var(--border-bright);
      color: var(--gold-bright);
      font-family: 'Spectral', serif;
      font-size: 13px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 5px;
      outline: none;
      cursor: pointer;
    }
    .dm-player-dropdown:focus {
      border-color: var(--gold);
      box-shadow: 0 0 6px rgba(201, 162, 39, 0.4);
    }
    .dm-status-tag {
      font-size: 11px;
      color: var(--text-dim);
      background: rgba(0,0,0,0.4);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .dm-inspecting-banner {
      background: linear-gradient(90deg, rgba(201, 162, 39, 0.2), rgba(30, 20, 10, 0.4));
      border: 1px solid var(--gold);
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      font-size: 12px;
      color: var(--gold-bright);
      box-shadow: 0 0 10px rgba(201,162,39,0.2);
    }
    .dm-inspecting-banner strong {
      color: #fff;
    }
`;

if (!content.includes('auth-portal-screen')) {
  content = content.replace('  </style>', authCss + '\n  </style>');
  console.log('Added CSS.');
}

// 2. Auth HTML Overlay insertion (right before <div class="frame">)
const authModalHtml = `  <!-- D&D AUTHENTICATION / LOGIN OVERLAY -->
  <div id="auth-portal-screen">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-emblem">⚔️</div>
        <h2 class="auth-title">MAMİ ROCK D&amp;D</h2>
        <div class="auth-subtitle">Adventurer's Vault &amp; Hoard Ledger</div>
      </div>

      <div class="auth-tabs">
        <button type="button" class="auth-tab-btn active" id="auth-tab-login" onclick="switchAuthTab('login')">🔑 Sign In</button>
        <button type="button" class="auth-tab-btn" id="auth-tab-register" onclick="switchAuthTab('register')">📜 Create Account</button>
      </div>

      <form id="auth-form" onsubmit="handleAuthSubmit(event)">
        <div class="auth-form-group">
          <label class="auth-label" for="auth-nickname">Nickname</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">👤</span>
            <input type="text" id="auth-nickname" class="auth-input" placeholder="Enter character or DM nickname" autocomplete="username" required>
          </div>
        </div>

        <div class="auth-form-group">
          <label class="auth-label" for="auth-password">Password</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">🔒</span>
            <input type="password" id="auth-password" class="auth-input" placeholder="Enter password" autocomplete="current-password" required>
            <button type="button" class="auth-pw-toggle" onclick="toggleAuthPasswordVisibility()" title="Show/Hide Password">👁️</button>
          </div>
        </div>

        <!-- Role Selector (Visible only on Register Tab) -->
        <div class="auth-form-group" id="auth-role-group" style="display: none;">
          <label class="auth-label">Choose Role</label>
          <div class="auth-role-select">
            <div class="auth-role-card selected" id="role-card-player" onclick="selectAuthRole('player')">
              <div class="role-title">🛡️ Player</div>
              <div class="role-desc">Individual personal inventory &amp; spells</div>
            </div>
            <div class="auth-role-card" id="role-card-dm" onclick="selectAuthRole('dm')">
              <div class="role-title">👑 Dungeon Master</div>
              <div class="role-desc">Full master access over all players' inventories</div>
            </div>
          </div>
          <input type="hidden" id="auth-role" value="player">
        </div>

        <button type="submit" class="auth-btn-submit" id="auth-submit-btn">⚔ ENTER REALM</button>
        <div id="auth-msg-box" class="auth-msg"></div>
      </form>

      <div class="auth-quick-demo">
        <div class="auth-quick-demo-title">⚡ Quick Test Accounts (Password: 123)</div>
        <div class="auth-demo-pills">
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('DM', '123')">👑 DM (Master)</button>
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('Gimli', '123')">🛡️ Gimli (Player)</button>
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('Legolas', '123')">🛡️ Legolas (Player)</button>
        </div>
      </div>
    </div>
  </div>

  <!-- DM CREATE PLAYER MODAL -->
  <div class="overlay" id="dm-create-player-overlay">
    <div class="modal" style="max-width: 420px;">
      <div class="modal-header">
        <div class="modal-title">👑 Create New Player Account</div>
        <button class="btn-close" onclick="closeDmCreatePlayerModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 14px;">Create an individual account and inventory for a player at your table.</div>
        <div class="field" style="margin-bottom: 12px;">
          <label>Player Nickname</label>
          <input type="text" id="dm-new-player-nickname" placeholder="e.g. Aragorn">
        </div>
        <div class="field" style="margin-bottom: 12px;">
          <label>Password</label>
          <input type="text" id="dm-new-player-password" value="123" placeholder="Password">
        </div>
        <div class="field" style="margin-bottom: 12px;">
          <label>Character Class &amp; Level</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="dm-new-player-class" placeholder="e.g. Ranger" style="flex:2;">
            <input type="number" id="dm-new-player-level" value="5" min="1" max="20" style="flex:1;">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost small" onclick="closeDmCreatePlayerModal()">Cancel</button>
        <button class="btn small" onclick="dmSubmitCreatePlayer()">✨ Create Player Account</button>
      </div>
    </div>
  </div>

  <!-- DM QUICK GIFT LOOT MODAL -->
  <div class="overlay" id="dm-gift-loot-overlay">
    <div class="modal" style="max-width: 440px;">
      <div class="modal-header">
        <div class="modal-title">🎁 Gift Loot to Player</div>
        <button class="btn-close" onclick="closeDmGiftLootModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 14px;" id="dm-gift-target-desc">Give an item or coins directly to the active player's inventory.</div>
        <div class="field" style="margin-bottom: 12px;">
          <label>Item Name</label>
          <input type="text" id="dm-gift-item-name" placeholder="e.g. Potion of Greater Healing">
        </div>
        <div style="display:flex; gap:10px; margin-bottom: 12px;">
          <div class="field" style="flex:1;">
            <label>Quantity</label>
            <input type="number" id="dm-gift-item-qty" value="1" min="1">
          </div>
          <div class="field" style="flex:1;">
            <label>Rarity</label>
            <select id="dm-gift-item-rarity">
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare" selected>Rare</option>
              <option value="veryrare">Very Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-bottom: 12px;">
          <label>Also Gift Gold Coins (gp)</label>
          <input type="number" id="dm-gift-coins" value="0" min="0" placeholder="0 gp">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost small" onclick="closeDmGiftLootModal()">Cancel</button>
        <button class="btn small" onclick="dmSubmitGiftLoot()">🎁 Deliver Loot</button>
      </div>
    </div>
  </div>
`;

if (!content.includes('id="auth-portal-screen"')) {
  content = content.replace('<body>\n  <div class="frame">', '<body>\n' + authModalHtml + '\n  <div class="frame">');
  console.log('Added Auth overlay markup.');
}

// 3. User bar in header-stats
const headerUserBar = `        <!-- USER SESSION BADGE -->
        <div class="auth-user-bar" id="auth-user-bar">
          <div class="auth-user-badge" id="auth-user-info">
            <span id="auth-user-icon">👤</span>
            <strong id="auth-user-name">Adventurer</strong>
            <span id="auth-user-role" class="auth-user-role-tag player">Player</span>
          </div>
          <button type="button" class="btn ghost small" style="padding:3px 8px; font-size:11px;" onclick="logoutCurrentUser()" title="Log out / Switch User">🚪 Exit</button>
        </div>
`;

if (!content.includes('id="auth-user-bar"')) {
  content = content.replace('<div class="header-stats">', '<div class="header-stats">\n' + headerUserBar);
  console.log('Added header user bar.');
}

// 4. DM Control Bar placed right before <div class="layout" id="inventory-view-container">
const dmControlBar = `    <!-- DM CONTROL BAR (Visible only to Dungeon Master) -->
    <div id="dm-control-bar" class="dm-control-bar" style="display: none;">
      <div class="dm-control-badge">👑 DUNGEON MASTER PANEL</div>
      <div class="dm-control-label">Viewing Inventory:</div>
      <select id="dm-player-dropdown" class="dm-player-dropdown" onchange="dmSwitchActivePlayer(this.value)">
        <!-- Populated dynamically -->
      </select>
      <div id="dm-status-tag" class="dm-status-tag">Inspecting: Self</div>
      <button type="button" class="btn small" style="font-size:11px; padding:4px 10px;" onclick="openDmGiftLootModal()">🎁 Gift Loot</button>
      <button type="button" class="btn ghost small" style="font-size:11px; padding:4px 10px;" onclick="openDmCreatePlayerModal()">+ New Player</button>
    </div>
`;

if (!content.includes('id="dm-control-bar"')) {
  content = content.replace('<div class="layout" id="inventory-view-container">', dmControlBar + '    <div class="layout" id="inventory-view-container">');
  console.log('Added DM control bar markup.');
}

// 5. DM inspecting banner inside Col 3 (above inventory grid)
const dmInspectingBanner = `        <!-- DM INSPECTION NOTIFICATION BANNER -->
        <div id="dm-inspecting-notice" class="dm-inspecting-banner" style="display: none;">
          <span>👑 <strong>DM OVERRIDE:</strong> Currently inspecting &amp; editing <span id="dm-inspecting-target-name">Player</span>'s inventory. All changes save live!</span>
          <button type="button" class="btn ghost small" style="margin-left:auto; padding:2px 8px; font-size:11px;" onclick="dmSwitchActivePlayer('__dm__')">↩ Return to My Vault</button>
        </div>
`;

if (!content.includes('id="dm-inspecting-notice"')) {
  content = content.replace('<div class="panel inventory-column">\n        <div class="panel-title">Inventory</div>', '<div class="panel inventory-column">\n        <div class="panel-title">Inventory</div>\n' + dmInspectingBanner);
  console.log('Added DM inspecting banner markup.');
}

fs.writeFileSync(rootFile, content, 'utf8');
fs.writeFileSync(subFile, content, 'utf8');
console.log('Saved preliminary markup updates.');
