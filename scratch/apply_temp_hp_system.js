const fs = require('fs');
const path = require('path');

function enhanceTempHpSystem(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add CSS for temp hp button & bar
  if (!content.includes('.hp-btn.temp')) {
    const tempCss = `
.hp-btn.temp {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid #38bdf8;
}
.hp-btn.temp:hover {
  background: #0284c7;
  color: #ffffff;
}
.hp-temp-bar-fill {
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background: linear-gradient(90deg, #38bdf8, #0284c7);
  opacity: 0.85;
  transition: width 0.3s ease;
  pointer-events: none;
}
`;
    content = content.replace('</head>', tempCss + '\n</head>');
  }

  // 2. Update #hp-pill HTML to include 🛡️ +Temp button & temp bar layer
  if (!content.includes('quickAddTempHP')) {
    const oldPillContent = `<button type="button" class="hp-btn dmg" title="Take Damage" onclick="quickDamageHP(event)">− Dmg</button>
            <button type="button" class="hp-btn heal" title="Heal HP" onclick="quickHealHP(event)">+ Heal</button>`;
    
    const newPillContent = `<button type="button" class="hp-btn dmg" title="Take Damage" onclick="quickDamageHP(event)">− Dmg</button>
            <button type="button" class="hp-btn heal" title="Heal HP" onclick="quickHealHP(event)">+ Heal</button>
            <button type="button" class="hp-btn temp" title="Add Temp HP (Shield)" onclick="quickAddTempHP(event)">🛡️ +Temp</button>`;

    content = content.replace(oldPillContent, newPillContent);

    // Update HP bar background to contain both current HP fill and temp HP fill
    const oldHpBarBg = `<div class="hp-bar-bg" style="width:100%; height:5px; background:rgba(0,0,0,0.5); border-radius:3px; margin-top:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
          <div class="hp-bar-fill" id="hp-bar-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #22c55e, #16a34a); transition:width 0.3s ease, background 0.3s ease;"></div>
        </div>`;

    const newHpBarBg = `<div class="hp-bar-bg" style="width:100%; height:6px; background:rgba(0,0,0,0.5); border-radius:3px; margin-top:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); position:relative;">
          <div class="hp-bar-fill" id="hp-bar-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #22c55e, #16a34a); transition:width 0.3s ease, background 0.3s ease;"></div>
          <div class="hp-temp-bar-fill" id="hp-temp-bar-fill" style="width:0%; display:none;"></div>
        </div>`;

    content = content.replace(oldHpBarBg, newHpBarBg);
  }

  // 3. Add Quick Temp HP buttons inside the HP Modal Overlay
  if (!content.includes('setTempHP(')) {
    const oldModalQuickBlock = `<div style="font-size:11px; font-weight:bold; color:var(--gold-bright); text-transform:uppercase; margin-bottom:6px;">Quick Damage / Heal</div>`;

    const newModalQuickBlock = `<div style="font-size:11px; font-weight:bold; color:var(--gold-bright); text-transform:uppercase; margin-bottom:6px;">Quick Damage / Heal</div>`;

    const oldTempRow = `<div class="form-row" style="text-align:left; margin-bottom:16px;">
      <label>Temporary HP (Temp HP)</label>
      <input type="number" id="hp-input-temp" min="0" max="999" placeholder="0" onchange="updateHpFromInputs()">
    </div>`;

    const newTempRow = `<div class="form-row" style="text-align:left; margin-bottom:6px;">
      <label>Temporary HP (Temp HP)</label>
      <input type="number" id="hp-input-temp" min="0" max="999" placeholder="0" onchange="updateHpFromInputs()">
    </div>
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; margin-bottom:14px;">
      <button class="btn small" style="background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; font-size:11px;" onclick="setTempHP(5)">🛡️ +5</button>
      <button class="btn small" style="background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; font-size:11px;" onclick="setTempHP(10)">🛡️ +10</button>
      <button class="btn small" style="background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; font-size:11px;" onclick="setTempHP(15)">🛡️ +15</button>
      <button class="btn ghost small" style="color:var(--text-muted); font-size:11px;" onclick="setTempHP(0)">🚫 Clear</button>
    </div>
    <div style="font-size:10px; color:var(--text-muted); text-align:left; margin-bottom:14px; font-style:italic;">Note: Per D&D 5e rules, Temp HP takes damage first and does not stack.</div>`;

    content = content.replace(oldTempRow, newTempRow);
  }

  // 4. Update JS logic to support quickAddTempHP, setTempHP, and visual temp health bar fill
  if (!content.includes('function quickAddTempHP(')) {
    const tempJsLogic = `
function quickAddTempHP(e){
  if(e) e.stopPropagation();
  const currentTemp = (state.hp && state.hp.temp) ? state.hp.temp : 0;
  const val = prompt('Enter Temporary HP (Temp HP) amount:', currentTemp > 0 ? currentTemp : '5');
  if(val === null) return;
  const tempVal = parseInt(val, 10);
  if(!isNaN(tempVal) && tempVal >= 0){
    setTempHP(tempVal);
  }
}

function setTempHP(amount){
  if(!state.hp) state.hp = { current: 45, max: 45, temp: 0 };
  state.hp.temp = Math.max(0, parseInt(amount, 10) || 0);
  save();
  renderHpTracker();
  syncHpModalInputs();
}
`;

    content = content.replace('function renderHpTracker(){', tempJsLogic + '\nfunction renderHpTracker(){');

    // Update renderHpTracker to display the temp health bar fill overlay!
    const oldTempRenderCode = `if(tempLabel){
    if(hp.temp > 0){
      tempLabel.textContent = '+' + hp.temp + ' Temp';
      tempLabel.style.display = 'inline';
    } else {
      tempLabel.style.display = 'none';
    }
  }`;

    const newTempRenderCode = `if(tempLabel){
    if(hp.temp > 0){
      tempLabel.innerHTML = '🛡️ +' + hp.temp + ' Temp';
      tempLabel.style.display = 'inline-block';
      tempLabel.style.color = '#38bdf8';
      tempLabel.style.background = 'rgba(56,189,248,0.15)';
      tempLabel.style.border = '1px solid #38bdf8';
      tempLabel.style.padding = '1px 5px';
      tempLabel.style.borderRadius = '4px';
    } else {
      tempLabel.style.display = 'none';
    }
  }

  const tempFillEl = document.getElementById('hp-temp-bar-fill');
  if(tempFillEl){
    if(hp.temp > 0 && hp.max > 0){
      const tempPct = Math.min(100, (hp.temp / hp.max) * 100);
      const curPct = Math.min(100, Math.max(0, (hp.current / hp.max) * 100));
      tempFillEl.style.display = 'block';
      tempFillEl.style.left = curPct + '%';
      tempFillEl.style.width = Math.min(100 - curPct, tempPct) + '%';
    } else {
      tempFillEl.style.display = 'none';
    }
  }`;

    content = content.replace(oldTempRenderCode, newTempRenderCode);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated Temporary HP system in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
enhanceTempHpSystem(path.join(dir, 'bg3-inventory_13.html'));
enhanceTempHpSystem(path.join(dir, 'bg3-inventory.html'));
