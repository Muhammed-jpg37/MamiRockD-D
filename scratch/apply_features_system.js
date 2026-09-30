const fs = require('fs');
const path = require('path');

function addFeaturesAndTraitsSystem(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add 📜 Features & Traits Tab Button to Header if not present
  if (!content.includes('id="tab-btn-features"')) {
    const oldTabs = `<button class="nav-tab-btn" id="tab-btn-spells" onclick="switchMainTab('spells')">✨ Spell System</button>`;
    const newTabs = `<button class="nav-tab-btn" id="tab-btn-spells" onclick="switchMainTab('spells')">✨ Spell System</button>
        <button class="nav-tab-btn" id="tab-btn-features" onclick="switchMainTab('features')">📜 Features & Traits</button>`;
    content = content.replace(oldTabs, newTabs);
  }

  // 2. Add #features-view-container HTML after #spellbook-view-container
  if (!content.includes('id="features-view-container"')) {
    const featuresContainerHtml = `
  <!-- FEATURES & TRAITS VIEW CONTAINER -->
  <div class="panel features-view-container" id="features-view-container" style="display:none; margin-top:16px; padding:20px;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border);">
      <div>
        <div class="panel-title" style="font-size:22px; margin:0;">📜 Class Features, Species Traits & Feats</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Manage class abilities, racial traits, feats, background & alignment details</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn small" onclick="openAddFeatureModal()">+ Add Feature / Trait</button>
        <button class="btn ghost small" onclick="openEditBackgroundModal()">⚙️ Background & Alignment</button>
      </div>
    </div>

    <!-- D&D Beyond Style Sub-Tabs -->
    <div style="display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap;" id="features-subtabs">
      <button class="btn small" id="ftab-ALL" onclick="filterFeaturesTab('ALL')">ALL</button>
      <button class="btn ghost small" id="ftab-CLASS" onclick="filterFeaturesTab('CLASS')">CLASS FEATURES</button>
      <button class="btn ghost small" id="ftab-SPECIES" onclick="filterFeaturesTab('SPECIES')">SPECIES TRAITS</button>
      <button class="btn ghost small" id="ftab-FEATS" onclick="filterFeaturesTab('FEATS')">FEATS</button>
      <button class="btn ghost small" id="ftab-BG" onclick="filterFeaturesTab('BG')">BACKGROUND & ALIGNMENT</button>
    </div>

    <!-- Features Content List -->
    <div id="features-list-content" style="display:flex; flex-direction:column; gap:16px;"></div>
  </div>
`;

    // Insert after spellbook-view-container closing div
    const targetContainerEnd = `</div>\n\n<!-- Add/Edit Item Modal -->`;
    content = content.replace(targetContainerEnd, featuresContainerHtml + '\n' + targetContainerEnd);
  }

  // 3. Add Feature Edit Overlay & Background Edit Overlay Modals
  if (!content.includes('id="feature-edit-overlay"')) {
    const overlaysHtml = `
<!-- FEATURE ADD/EDIT MODAL OVERLAY -->
<div class="overlay" id="feature-edit-overlay">
  <div class="modal" style="max-width:520px;">
    <h2 id="feature-modal-title">Add Class Feature / Trait</h2>
    <input type="hidden" id="fe-id">
    <div class="form-row">
      <label>Category</label>
      <select id="fe-category">
        <option value="CLASS">Class Feature</option>
        <option value="SPECIES">Species Trait</option>
        <option value="FEATS">Feat</option>
      </select>
    </div>
    <div class="form-row">
      <label>Feature Title / Section Name</label>
      <input type="text" id="fe-title" placeholder="Bard Features, Half-Elf Traits, Feats...">
    </div>
    <div class="form-row">
      <label>Feature / Trait Name</label>
      <input type="text" id="fe-name" placeholder="Bardic Inspiration, Darkvision, War Caster...">
    </div>
    <div class="form-row">
      <label>Source Reference (optional)</label>
      <input type="text" id="fe-source" placeholder="PHB, pg. 53">
    </div>
    <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:8px;">
      <div class="form-row">
        <label>Max Uses (0 if passive)</label>
        <input type="number" id="fe-max-uses" min="0" max="99" value="0">
      </div>
      <div class="form-row">
        <label>Reset Condition</label>
        <select id="fe-reset-type">
          <option value="Long Rest">Long Rest</option>
          <option value="Short Rest">Short Rest</option>
          <option value="Special">Special / Other</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Description & Rules</label>
      <textarea id="fe-desc" rows="4" style="width:100%; background:var(--void); border:1px solid var(--border); color:var(--text); padding:8px; border-radius:6px; font-family:inherit; resize:vertical;"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
      <button class="btn ghost small" onclick="closeFeatureEditModal()">Cancel</button>
      <button class="btn small" onclick="saveFeatureItem()">Save Feature</button>
    </div>
  </div>
</div>

<!-- BACKGROUND & ALIGNMENT EDIT MODAL -->
<div class="overlay" id="background-edit-overlay">
  <div class="modal" style="max-width:540px;">
    <h2>⚙️ Background, Alignment & Personality</h2>
    <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:8px;">
      <div class="form-row">
        <label>Background</label>
        <input type="text" id="bg-name" placeholder="Entertainer, Folk Hero, Criminal...">
      </div>
      <div class="form-row">
        <label>Background Feature Name</label>
        <input type="text" id="bg-feature" placeholder="By Popular Demand, Rustic Hospitality...">
      </div>
    </div>
    <div class="form-row">
      <label>Alignment</label>
      <input type="text" id="bg-alignment" placeholder="Chaotic Good, Neutral Good, True Neutral...">
    </div>
    <div class="form-row">
      <label>Ideals</label>
      <textarea id="bg-ideals" rows="2" style="width:100%; background:var(--void); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; resize:vertical;"></textarea>
    </div>
    <div class="form-row">
      <label>Bonds</label>
      <textarea id="bg-bonds" rows="2" style="width:100%; background:var(--void); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; resize:vertical;"></textarea>
    </div>
    <div class="form-row">
      <label>Flaws</label>
      <textarea id="bg-flaws" rows="2" style="width:100%; background:var(--void); border:1px solid var(--border); color:var(--text); padding:6px; border-radius:6px; resize:vertical;"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
      <button class="btn ghost small" onclick="closeBackgroundModal()">Cancel</button>
      <button class="btn small" onclick="saveBackgroundInfo()">Save Background</button>
    </div>
  </div>
</div>
`;
    content = content.replace('</body>', overlaysHtml + '\n</body>');
  }

  // 4. Update switchMainTab JS logic to handle 'features'
  if (!content.includes(`const btnFeatures = document.getElementById('tab-btn-features');`)) {
    const oldSwitchMainTab = `function switchMainTab(tabName){
  if(!tabName) tabName = 'inventory';
  state.activeTab = tabName;
  const invView = document.getElementById('inventory-view-container');
  const spellView = document.getElementById('spellbook-view-container');
  const btnInv = document.getElementById('tab-btn-inventory');
  const btnSpell = document.getElementById('tab-btn-spells');

  if(tabName === 'spells'){
    if(invView) invView.style.display = 'none';
    if(spellView) spellView.style.display = 'block';
    if(btnInv) btnInv.classList.remove('active');
    if(btnSpell) btnSpell.classList.add('active');
    state.spellbook.open = true;
    renderSpellbookMenu();
  } else {
    if(invView) invView.style.display = 'grid';
    if(spellView) spellView.style.display = 'none';
    if(btnInv) btnInv.classList.add('active');
    if(btnSpell) btnSpell.classList.remove('active');
  }
  save();
}`;

    const newSwitchMainTab = `function switchMainTab(tabName){
  if(!tabName) tabName = 'inventory';
  state.activeTab = tabName;
  const invView = document.getElementById('inventory-view-container');
  const spellView = document.getElementById('spellbook-view-container');
  const featuresView = document.getElementById('features-view-container');
  const btnInv = document.getElementById('tab-btn-inventory');
  const btnSpell = document.getElementById('tab-btn-spells');
  const btnFeatures = document.getElementById('tab-btn-features');

  if(invView) invView.style.display = (tabName === 'inventory') ? 'grid' : 'none';
  if(spellView) spellView.style.display = (tabName === 'spells') ? 'block' : 'none';
  if(featuresView) featuresView.style.display = (tabName === 'features') ? 'block' : 'none';

  if(btnInv) btnInv.classList.toggle('active', tabName === 'inventory');
  if(btnSpell) btnSpell.classList.toggle('active', tabName === 'spells');
  if(btnFeatures) btnFeatures.classList.toggle('active', tabName === 'features');

  if(tabName === 'spells'){
    state.spellbook.open = true;
    renderSpellbookMenu();
  } else if(tabName === 'features'){
    renderFeaturesView();
  }
  save();
}`;

    content = content.replace(oldSwitchMainTab, newSwitchMainTab);
  }

  // 5. Add Features JS rendering & management logic
  if (!content.includes('function renderFeaturesView()')) {
    const featuresJsLogic = `
// --- FEATURES, TRAITS & FEATS LOGIC ---
let activeFeaturesTab = 'ALL';

function filterFeaturesTab(tab){
  activeFeaturesTab = tab;
  ['ALL', 'CLASS', 'SPECIES', 'FEATS', 'BG'].forEach(function(t){
    const btn = document.getElementById('ftab-' + t);
    if(btn){
      btn.className = (t === tab) ? 'btn small' : 'btn ghost small';
    }
  });
  renderFeaturesView();
}

function initDefaultFeatures(){
  if(!state.features) state.features = {};
  if(!state.features.items || !state.features.items.length){
    state.features.items = [
      { id: 'f1', category: 'CLASS', title: 'Bard Features', name: 'Hit Points', source: 'PHB, pg. 52', desc: 'Hit Dice: 1d8 per Bard level.' },
      { id: 'f2', category: 'CLASS', title: 'Bard Features', name: 'Proficiencies', source: 'PHB, pg. 52', desc: 'Armor: Light Armor\\nWeapons: Simple Weapons, Hand Crossbows, Longswords, Rapiers, Shortswords\\nTools: Three musical instruments of your choice.' },
      { id: 'f3', category: 'CLASS', title: 'Bard Features', name: 'Spellcasting', source: 'PHB, pg. 52', desc: 'You can cast known bard spells using CHA as your spellcasting modifier (Spell DC 12, Spell Attack +4) and known bard spells as rituals if they have the ritual tag. You can use a musical instrument as a spellcasting focus.' },
      { id: 'f4', category: 'CLASS', title: 'Bard Features', name: 'Bardic Inspiration', source: 'PHB, pg. 53', desc: 'As a bonus action, a creature (other than you) within 60 ft. that can hear you gains an inspiration die (1d6). For 10 minutes, the creature can add it to one ability check, attack roll, or saving throw.', maxUses: 2, usedUses: 0, resetType: 'Long Rest' },
      { id: 'f5', category: 'CLASS', title: 'Bard Features', name: 'Jack of All Trades', source: 'PHB, pg. 54', desc: 'You can add half your proficiency bonus, rounded down (+1), to any ability check you make that doesn\\'t already include it.' },
      { id: 'f6', category: 'CLASS', title: 'Bard Features', name: 'Song of Rest', source: 'PHB, pg. 54', desc: 'You can use soothing music or oration to help revitalize your wounded allies during a short rest. Regain an extra +1d6 HP.' },
      { id: 'f7', category: 'SPECIES', title: 'Half-Elf Traits', name: 'Darkvision', source: 'PHB, pg. 39', desc: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet as if it were bright light, and in darkness as if dim light.' },
      { id: 'f8', category: 'SPECIES', title: 'Half-Elf Traits', name: 'Fey Ancestry', source: 'PHB, pg. 39', desc: 'You have advantage on saving throws against being charmed, and magic can\\'t put you to sleep.' },
      { id: 'f9', category: 'FEATS', title: 'Feats', name: 'War Caster', source: 'PHB, pg. 170', desc: 'You have advantage on CON saving throws to maintain concentration on a spell when taking damage; perform somatic components even with weapons equipped; cast spells as opportunity attacks.' }
    ];
  }
  if(!state.features.backgroundInfo){
    state.features.backgroundInfo = {
      name: 'Entertainer',
      featureName: 'By Popular Demand',
      alignment: 'Chaotic Good',
      ideals: 'Art & Expression: Beauty and song uplift the realm.',
      bonds: 'My instrument is my most treasured possession.',
      flaws: 'I can\\'t resist a good story or scandal.'
    };
  }
}

function renderFeaturesView(){
  initDefaultFeatures();
  const container = document.getElementById('features-list-content');
  if(!container) return;

  const items = state.features.items || [];
  const bg = state.features.backgroundInfo || {};

  let html = '';

  // Render Background & Alignment section if tab is ALL or BG
  if(activeFeaturesTab === 'ALL' || activeFeaturesTab === 'BG'){
    html += '<div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-bright); border-radius:8px; padding:16px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
          '<div style="font-family:Cinzel,serif; font-size:16px; font-weight:700; color:var(--gold-bright);">📜 Background & Alignment</div>' +
          '<button class="btn ghost small" onclick="openEditBackgroundModal()">⚙️ Edit</button>' +
        '</div>' +
        '<div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">' +
          '<div><b>Background:</b> ' + escapeHtml(bg.name || 'Entertainer') + (bg.featureName ? ' (' + escapeHtml(bg.featureName) + ')' : '') + '</div>' +
          '<div><b>Alignment:</b> <span style="color:var(--gold-bright); font-weight:bold;">' + escapeHtml(bg.alignment || 'Chaotic Good') + '</span></div>' +
        '</div>' +
        (bg.ideals ? '<div style="font-size:12px; margin-top:8px; color:var(--text-dim);"><b>Ideals:</b> ' + escapeHtml(bg.ideals) + '</div>' : '') +
        (bg.bonds ? '<div style="font-size:12px; margin-top:4px; color:var(--text-dim);"><b>Bonds:</b> ' + escapeHtml(bg.bonds) + '</div>' : '') +
        (bg.flaws ? '<div style="font-size:12px; margin-top:4px; color:var(--text-dim);"><b>Flaws:</b> ' + escapeHtml(bg.flaws) + '</div>' : '') +
      '</div>';
  }

  // Filter items based on active tab
  let filteredItems = items;
  if(activeFeaturesTab !== 'ALL' && activeFeaturesTab !== 'BG'){
    filteredItems = items.filter(function(i){ return i.category === activeFeaturesTab; });
  }

  // Group items by Section Title
  const groups = {};
  filteredItems.forEach(function(item){
    const grpTitle = item.title || (item.category === 'CLASS' ? 'Class Features' : item.category === 'SPECIES' ? 'Species Traits' : 'Feats');
    if(!groups[grpTitle]) groups[grpTitle] = [];
    groups[grpTitle].push(item);
  });

  Object.keys(groups).forEach(function(groupTitle){
    html += '<div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:16px;">' +
        '<div style="font-family:Cinzel,serif; font-size:18px; font-weight:700; color:#ef4444; border-bottom:1px solid rgba(239,68,68,0.3); padding-bottom:6px; margin-bottom:12px;">' + escapeHtml(groupTitle) + '</div>' +
        '<div style="display:flex; flex-direction:column; gap:14px;">';

    groups[groupTitle].forEach(function(f){
      let pipsHtml = '';
      if(f.maxUses > 0){
        let pips = '';
        for(let u = 0; u < f.maxUses; u++){
          const isUsed = u < (f.usedUses || 0);
          pips += '<button type="button" class="slot-pip' + (isUsed ? ' used' : '') + '" style="width:16px; height:16px; font-size:10px;" onclick="toggleFeatureUse(\'' + f.id + '\', ' + u + ')">' + (isUsed ? '✕' : '■') + '</button>';
        }
        pipsHtml = '<div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; border:1px solid var(--border); margin-top:6px; font-size:11px;">' +
            '<span style="font-weight:bold;">' + escapeHtml(f.name) + ': ' + (f.maxUses - (f.usedUses || 0)) + '/' + f.maxUses + ' Uses</span> ' +
            '<div style="display:flex; gap:3px;">' + pips + '</div>' +
            '<span style="color:var(--text-muted);">/ ' + escapeHtml(f.resetType || 'Long Rest') + '</span>' +
          '</div>';
      }

      const descFormatted = escapeHtml(f.desc || '').replace(/\\n/g, '<br>');

      html += '<div style="border-left:3px solid var(--gold-bright); padding-left:10px; position:relative;">' +
          '<div style="display:flex; justify-content:space-between; align-items:baseline;">' +
            '<div style="font-weight:bold; font-size:14px; color:var(--text);">' + escapeHtml(f.name) + (f.source ? ' <span style="font-weight:normal; font-size:11px; color:var(--text-muted); font-style:italic;">· ' + escapeHtml(f.source) + '</span>' : '') + '</div>' +
            '<div style="display:flex; gap:4px;">' +
              '<button class="btn ghost small" style="padding:1px 6px; font-size:11px;" onclick="editFeatureItem(\'' + f.id + '\')">Edit</button>' +
              '<button class="btn danger small" style="padding:1px 6px; font-size:11px;" onclick="deleteFeatureItem(\'' + f.id + '\')">✕</button>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--text-dim); margin-top:4px; line-height:1.4;">' + descFormatted + '</div>' +
          pipsHtml +
        '</div>';
    });

    html += '</div></div>';
  });

  if(!filteredItems.length && activeFeaturesTab !== 'BG'){
    html += '<div class="spell-empty">No features found in this category. Click "+ Add Feature / Trait" above to create one.</div>';
  }

  container.innerHTML = html;
}

function toggleFeatureUse(id, index){
  initDefaultFeatures();
  const f = (state.features.items || []).find(function(i){ return i.id === id; });
  if(!f) return;
  const currentUsed = f.usedUses || 0;
  if(index < currentUsed){
    f.usedUses = Math.max(0, currentUsed - 1);
  } else {
    f.usedUses = Math.min(f.maxUses, currentUsed + 1);
  }
  save();
  renderFeaturesView();
}

function openAddFeatureModal(){
  document.getElementById('feature-modal-title').textContent = 'Add Feature / Trait';
  document.getElementById('fe-id').value = '';
  document.getElementById('fe-category').value = activeFeaturesTab !== 'ALL' && activeFeaturesTab !== 'BG' ? activeFeaturesTab : 'CLASS';
  document.getElementById('fe-title').value = 'Class Features';
  document.getElementById('fe-name').value = '';
  document.getElementById('fe-source').value = 'PHB, pg. 52';
  document.getElementById('fe-max-uses').value = 0;
  document.getElementById('fe-reset-type').value = 'Long Rest';
  document.getElementById('fe-desc').value = '';

  const overlay = document.getElementById('feature-edit-overlay');
  if(overlay) overlay.classList.add('open');
}

function editFeatureItem(id){
  initDefaultFeatures();
  const f = (state.features.items || []).find(function(i){ return i.id === id; });
  if(!f) return;
  document.getElementById('feature-modal-title').textContent = 'Edit Feature / Trait';
  document.getElementById('fe-id').value = f.id;
  document.getElementById('fe-category').value = f.category || 'CLASS';
  document.getElementById('fe-title').value = f.title || '';
  document.getElementById('fe-name').value = f.name || '';
  document.getElementById('fe-source').value = f.source || '';
  document.getElementById('fe-max-uses').value = f.maxUses || 0;
  document.getElementById('fe-reset-type').value = f.resetType || 'Long Rest';
  document.getElementById('fe-desc').value = f.desc || '';

  const overlay = document.getElementById('feature-edit-overlay');
  if(overlay) overlay.classList.add('open');
}

function closeFeatureEditModal(){
  const overlay = document.getElementById('feature-edit-overlay');
  if(overlay) overlay.classList.remove('open');
}

function saveFeatureItem(){
  initDefaultFeatures();
  const name = document.getElementById('fe-name').value.trim();
  if(!name){ alert('Please enter a feature name.'); return; }
  const id = document.getElementById('fe-id').value;

  const data = {
    category: document.getElementById('fe-category').value,
    title: document.getElementById('fe-title').value.trim() || 'Custom Features',
    name: name,
    source: document.getElementById('fe-source').value.trim(),
    maxUses: parseInt(document.getElementById('fe-max-uses').value, 10) || 0,
    resetType: document.getElementById('fe-reset-type').value,
    desc: document.getElementById('fe-desc').value.trim()
  };

  if(id){
    const item = (state.features.items || []).find(function(i){ return i.id === id; });
    if(item){
      Object.assign(item, data);
    }
  } else {
    data.id = 'f_' + Date.now();
    data.usedUses = 0;
    state.features.items = state.features.items || [];
    state.features.items.push(data);
  }

  save();
  closeFeatureEditModal();
  renderFeaturesView();
}

function deleteFeatureItem(id){
  if(!confirm('Delete this feature?')) return;
  initDefaultFeatures();
  state.features.items = (state.features.items || []).filter(function(i){ return i.id !== id; });
  save();
  renderFeaturesView();
}

function openEditBackgroundModal(){
  initDefaultFeatures();
  const bg = state.features.backgroundInfo || {};
  document.getElementById('bg-name').value = bg.name || '';
  document.getElementById('bg-feature').value = bg.featureName || '';
  document.getElementById('bg-alignment').value = bg.alignment || '';
  document.getElementById('bg-ideals').value = bg.ideals || '';
  document.getElementById('bg-bonds').value = bg.bonds || '';
  document.getElementById('bg-flaws').value = bg.flaws || '';

  const overlay = document.getElementById('background-edit-overlay');
  if(overlay) overlay.classList.add('open');
}

function closeBackgroundModal(){
  const overlay = document.getElementById('background-edit-overlay');
  if(overlay) overlay.classList.remove('open');
}

function saveBackgroundInfo(){
  initDefaultFeatures();
  state.features.backgroundInfo = {
    name: document.getElementById('bg-name').value.trim(),
    featureName: document.getElementById('bg-feature').value.trim(),
    alignment: document.getElementById('bg-alignment').value.trim(),
    ideals: document.getElementById('bg-ideals').value.trim(),
    bonds: document.getElementById('bg-bonds').value.trim(),
    flaws: document.getElementById('bg-flaws').value.trim()
  };
  save();
  closeBackgroundModal();
  renderFeaturesView();
}
`;
    // Insert before renderAll
    content = content.replace('function renderAll(){', featuresJsLogic + '\nfunction renderAll(){');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully added Features & Traits system to ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
addFeaturesAndTraitsSystem(path.join(dir, 'bg3-inventory_13.html'));
addFeaturesAndTraitsSystem(path.join(dir, 'bg3-inventory.html'));
