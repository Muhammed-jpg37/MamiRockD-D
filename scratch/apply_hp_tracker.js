const fs = require('fs');
const path = require('path');

function addHpTrackingSystem(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add CSS for HP Tracker Widget if not present
  if (!content.includes('.hp-pill')) {
    const hpCss = `
/* --- HP TRACKER WIDGET STYLES --- */
.hp-pill {
  min-width: 180px;
  background: var(--panel-2);
  border: 1px solid var(--border-bright);
  border-radius: 8px;
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  user-select: none;
  transition: border-color 0.2s ease;
}
.hp-pill:hover {
  border-color: var(--gold-bright);
}
.hp-btn {
  border: none;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.hp-btn.dmg {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid #ef4444;
}
.hp-btn.dmg:hover {
  background: #ef4444;
  color: #ffffff;
}
.hp-btn.heal {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid #22c55e;
}
.hp-btn.heal:hover {
  background: #22c55e;
  color: #ffffff;
}
`;
    content = content.replace('</head>', hpCss + '\n</head>');
  }

  // 2. Insert HP Pill into Header right before Coins stat pill
  if (!content.includes('id="hp-pill"')) {
    const targetHeaderStats = `<div class="header-stats">`;
    const hpPillHtml = `<div class="header-stats">
      <!-- HP TRACKER WIDGET -->
      <div class="stat-pill hp-pill" id="hp-pill" title="Click to open HP Management Modal" onclick="openHpQuickModal(event)">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:2px;">
          <span>❤️ Hit Points</span>
          <span id="hp-temp-label" style="color:var(--gold-bright); font-size:10px; display:none;">+0 Temp</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div style="font-family:'Cinzel',serif; font-size:15px; font-weight:700; color:#fff;" id="hp-display">
            <span id="hp-cur-val" style="color:#4ade80; cursor:pointer;" title="Click to edit current HP" onclick="quickEditCurrentHP(event)">45</span>
            <span style="font-size:12px; color:var(--text-muted);">/</span>
            <span id="hp-max-val" style="color:var(--gold-bright); cursor:pointer;" title="Click to edit max HP" onclick="quickEditMaxHP(event)">45</span>
          </div>
          <div style="display:flex; gap:3px;" onclick="event.stopPropagation();">
            <button type="button" class="hp-btn dmg" title="Take Damage" onclick="quickDamageHP(event)">− Dmg</button>
            <button type="button" class="hp-btn heal" title="Heal HP" onclick="quickHealHP(event)">+ Heal</button>
          </div>
        </div>
        <div class="hp-bar-bg" style="width:100%; height:5px; background:rgba(0,0,0,0.5); border-radius:3px; margin-top:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
          <div class="hp-bar-fill" id="hp-bar-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #22c55e, #16a34a); transition:width 0.3s ease, background 0.3s ease;"></div>
        </div>
      </div>`;
    content = content.replace(targetHeaderStats, hpPillHtml);
  }

  // 3. Insert HP Modal Overlay
  if (!content.includes('id="hp-modal-overlay"')) {
    const hpModalHtml = `
<!-- HP MANAGEMENT OVERLAY MODAL -->
<div class="overlay" id="hp-modal-overlay">
  <div class="modal" style="max-width:400px; text-align:center;">
    <div class="panel-title" style="font-size:20px; margin-bottom:4px;">❤️ Hit Points Tracker</div>
    <div style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Manage Current HP, Max HP & Temporary HP</div>

    <!-- Health Display Box -->
    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-bright); border-radius:8px; padding:16px; margin-bottom:14px;">
      <div style="font-size:32px; font-weight:900; font-family:Cinzel,serif; color:#4ade80;" id="modal-hp-text">45 / 45</div>
      <div id="modal-temp-hp-text" style="font-size:13px; color:var(--gold-bright); margin-top:4px; display:none;">🛡️ +0 Temporary HP</div>
      <div style="width:100%; height:10px; background:rgba(0,0,0,0.5); border-radius:5px; margin-top:10px; overflow:hidden; border:1px solid var(--border);">
        <div id="modal-hp-bar-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #22c55e, #16a34a); transition:width 0.3s;"></div>
      </div>
    </div>

    <!-- Quick Action Buttons -->
    <div style="font-size:11px; font-weight:bold; color:var(--gold-bright); text-transform:uppercase; margin-bottom:6px;">Quick Damage / Heal</div>
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:14px;">
      <button class="btn danger small" onclick="applyHpChange(-1)">−1 HP</button>
      <button class="btn danger small" onclick="applyHpChange(-5)">−5 HP</button>
      <button class="btn danger small" onclick="applyHpChange(-10)">−10 HP</button>
      <button class="btn small" style="background:rgba(34,197,94,0.2); border:1px solid #22c55e; color:#4ade80;" onclick="applyHpChange(1)">+1 HP</button>
      <button class="btn small" style="background:rgba(34,197,94,0.2); border:1px solid #22c55e; color:#4ade80;" onclick="applyHpChange(5)">+5 HP</button>
      <button class="btn small" style="background:rgba(34,197,94,0.2); border:1px solid #22c55e; color:#4ade80;" onclick="applyHpChange(10)">+10 HP</button>
    </div>

    <!-- Custom Inputs & Temp HP -->
    <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:8px; text-align:left; margin-bottom:10px;">
      <div class="form-row">
        <label>Current HP</label>
        <input type="number" id="hp-input-current" min="0" max="999" onchange="updateHpFromInputs()">
      </div>
      <div class="form-row">
        <label>Max HP</label>
        <input type="number" id="hp-input-max" min="1" max="999" onchange="updateHpFromInputs()">
      </div>
    </div>
    <div class="form-row" style="text-align:left; margin-bottom:16px;">
      <label>Temporary HP (Temp HP)</label>
      <input type="number" id="hp-input-temp" min="0" max="999" placeholder="0" onchange="updateHpFromInputs()">
    </div>

    <div style="display:flex; justify-content:space-between; gap:8px;">
      <button class="btn ghost small" onclick="fullHealHP()">💖 Full Heal</button>
      <button class="btn small" onclick="closeHpModal()">Done</button>
    </div>
  </div>
</div>
`;
    content = content.replace('</body>', hpModalHtml + '\n</body>');
  }

  // 4. Add JS logic for HP Tracker
  if (!content.includes('function renderHpTracker()')) {
    const hpJsLogic = `
// --- HP TRACKER SYSTEM LOGIC ---
function renderHpTracker(){
  if(!state.hp) state.hp = { current: 45, max: 45, temp: 0 };
  const hp = state.hp;
  if(hp.current === undefined) hp.current = 45;
  if(hp.max === undefined) hp.max = 45;
  if(hp.temp === undefined) hp.temp = 0;

  const curEl = document.getElementById('hp-cur-val');
  const maxEl = document.getElementById('hp-max-val');
  const tempLabel = document.getElementById('hp-temp-label');
  const fillEl = document.getElementById('hp-bar-fill');

  if(curEl) curEl.textContent = hp.current;
  if(maxEl) maxEl.textContent = hp.max;

  if(tempLabel){
    if(hp.temp > 0){
      tempLabel.textContent = '+' + hp.temp + ' Temp';
      tempLabel.style.display = 'inline';
    } else {
      tempLabel.style.display = 'none';
    }
  }

  const pct = Math.min(100, Math.max(0, (hp.current / hp.max) * 100));
  if(fillEl){
    fillEl.style.width = pct + '%';
    if(pct > 75){
      fillEl.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
    } else if(pct > 40){
      fillEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    } else if(pct > 0){
      fillEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    } else {
      fillEl.style.background = '#7f1d1d';
    }
  }

  // Also update modal if open
  const modalText = document.getElementById('modal-hp-text');
  if(modalText) modalText.textContent = hp.current + ' / ' + hp.max;
  const modalTemp = document.getElementById('modal-temp-hp-text');
  if(modalTemp){
    modalTemp.style.display = hp.temp > 0 ? 'block' : 'none';
    modalTemp.textContent = '🛡️ +' + hp.temp + ' Temporary HP';
  }
  const modalFill = document.getElementById('modal-hp-bar-fill');
  if(modalFill){
    modalFill.style.width = pct + '%';
    if(pct > 75) modalFill.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
    else if(pct > 40) modalFill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    else modalFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
  }
}

function applyHpChange(amount){
  if(!state.hp) state.hp = { current: 45, max: 45, temp: 0 };
  const hp = state.hp;
  if(amount < 0){
    let damage = Math.abs(amount);
    if(hp.temp > 0){
      if(hp.temp >= damage){
        hp.temp -= damage;
        damage = 0;
      } else {
        damage -= hp.temp;
        hp.temp = 0;
      }
    }
    if(damage > 0){
      hp.current = Math.max(0, hp.current - damage);
    }
  } else if(amount > 0){
    hp.current = Math.min(hp.max, hp.current + amount);
  }
  save();
  renderHpTracker();
  syncHpModalInputs();
}

function quickDamageHP(e){
  if(e) e.stopPropagation();
  const val = prompt('Enter damage amount:', '5');
  if(val === null) return;
  const dmg = parseInt(val, 10);
  if(!isNaN(dmg) && dmg > 0){
    applyHpChange(-dmg);
  }
}

function quickHealHP(e){
  if(e) e.stopPropagation();
  const val = prompt('Enter heal amount:', '5');
  if(val === null) return;
  const heal = parseInt(val, 10);
  if(!isNaN(heal) && heal > 0){
    applyHpChange(heal);
  }
}

function quickEditCurrentHP(e){
  if(e) e.stopPropagation();
  const val = prompt('Enter Current HP:', state.hp ? state.hp.current : 45);
  if(val === null) return;
  const num = parseInt(val, 10);
  if(!isNaN(num)){
    state.hp.current = Math.max(0, num);
    save();
    renderHpTracker();
  }
}

function quickEditMaxHP(e){
  if(e) e.stopPropagation();
  const val = prompt('Enter Max HP:', state.hp ? state.hp.max : 45);
  if(val === null) return;
  const num = parseInt(val, 10);
  if(!isNaN(num) && num > 0){
    state.hp.max = num;
    if(state.hp.current > num) state.hp.current = num;
    save();
    renderHpTracker();
  }
}

function fullHealHP(){
  if(!state.hp) state.hp = { current: 45, max: 45, temp: 0 };
  state.hp.current = state.hp.max;
  state.hp.temp = 0;
  save();
  renderHpTracker();
  syncHpModalInputs();
}

function openHpQuickModal(e){
  if(e) e.stopPropagation();
  syncHpModalInputs();
  const overlay = document.getElementById('hp-modal-overlay');
  if(overlay) overlay.classList.add('open');
}

function closeHpModal(){
  const overlay = document.getElementById('hp-modal-overlay');
  if(overlay) overlay.classList.remove('open');
}

function syncHpModalInputs(){
  if(!state.hp) state.hp = { current: 45, max: 45, temp: 0 };
  const inpCur = document.getElementById('hp-input-current');
  const inpMax = document.getElementById('hp-input-max');
  const inpTemp = document.getElementById('hp-input-temp');
  if(inpCur) inpCur.value = state.hp.current;
  if(inpMax) inpMax.value = state.hp.max;
  if(inpTemp) inpTemp.value = state.hp.temp || 0;
}

function updateHpFromInputs(){
  if(!state.hp) state.hp = { current: 45, max: 45, temp: 0 };
  const inpCur = document.getElementById('hp-input-current');
  const inpMax = document.getElementById('hp-input-max');
  const inpTemp = document.getElementById('hp-input-temp');

  if(inpMax) state.hp.max = Math.max(1, parseInt(inpMax.value, 10) || 1);
  if(inpCur) state.hp.current = Math.max(0, parseInt(inpCur.value, 10) || 0);
  if(inpTemp) state.hp.temp = Math.max(0, parseInt(inpTemp.value, 10) || 0);

  save();
  renderHpTracker();
}
`;
    // Insert before renderAll
    content = content.replace('function renderAll(){', hpJsLogic + '\nfunction renderAll(){');
  }

  // 5. Hook renderHpTracker into renderAll
  if (!content.includes('renderHpTracker();')) {
    content = content.replace('function renderAll(){\n', 'function renderAll(){\n  renderHpTracker();\n');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully added HP Tracking System to ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
addHpTrackingSystem(path.join(dir, 'bg3-inventory_13.html'));
addHpTrackingSystem(path.join(dir, 'bg3-inventory.html'));
