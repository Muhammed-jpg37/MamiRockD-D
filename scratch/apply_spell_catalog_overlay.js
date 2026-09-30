const fs = require('fs');
const path = require('path');

function upgradeSpellSystemLayout(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add spell-catalog-overlay HTML if not already added
  if (!content.includes('id="spell-catalog-overlay"')) {
    const catalogOverlayHtml = `
<!-- SPELL CATALOG OVERLAY MODAL -->
<div class="overlay" id="spell-catalog-overlay">
  <div class="modal" style="max-width:960px; width:95vw; height:90vh; display:flex; flex-direction:column;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border);">
      <div>
        <div class="panel-title" style="font-size:20px; margin:0;">📜 D&D 5e Spell Catalog</div>
        <div class="spell-status" id="spell-catalog-modal-status" style="margin-top:2px;">Loading catalog...</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn ghost small" onclick="refreshSpellCatalog()">🔄 Reload</button>
        <button class="btn small" onclick="closeSpellCatalogModal()">✕ Close Catalog</button>
      </div>
    </div>

    <!-- Filter Bar inside Modal -->
    <div class="spellbook-filter-bar" style="margin-bottom:12px; gap:6px;">
      <input type="text" id="spell-search-input" placeholder="🔍 Search catalog by name, description, damage, or tags..." oninput="updateSpellSearch(this.value)">
      <select id="spell-class-filter" onchange="updateSpellClassFilter(this.value)">
        <option value="">All Classes</option>
        <option value="Bard">Bard</option>
        <option value="Cleric">Cleric</option>
        <option value="Druid">Druid</option>
        <option value="Paladin">Paladin</option>
        <option value="Ranger">Ranger</option>
        <option value="Sorcerer">Sorcerer</option>
        <option value="Warlock">Warlock</option>
        <option value="Wizard">Wizard</option>
        <option value="Artificer">Artificer</option>
      </select>
      <select id="spell-level-filter" onchange="updateSpellLevelFilter(this.value)">
        <option value="">All Levels</option>
        <option value="0">Cantrips</option>
        <option value="1">Level 1</option>
        <option value="2">Level 2</option>
        <option value="3">Level 3</option>
        <option value="4">Level 4</option>
        <option value="5">Level 5</option>
        <option value="6">Level 6</option>
        <option value="7">Level 7</option>
        <option value="8">Level 8</option>
        <option value="9">Level 9</option>
      </select>
      <select id="spell-school-filter" onchange="updateSpellSchoolFilter(this.value)">
        <option value="">All Schools</option>
        <option value="Abjuration">Abjuration</option>
        <option value="Conjuration">Conjuration</option>
        <option value="Divination">Divination</option>
        <option value="Enchantment">Enchantment</option>
        <option value="Evocation">Evocation</option>
        <option value="Illusion">Illusion</option>
        <option value="Necromancy">Necromancy</option>
        <option value="Transmutation">Transmutation</option>
      </select>
      <select id="spell-sort-by" onchange="updateSpellSortBy(this.value)">
        <option value="level-asc">Sort: Level (Asc)</option>
        <option value="level-desc">Sort: Level (Desc)</option>
        <option value="name">Sort: Name (A-Z)</option>
        <option value="class">Sort: Class (A-Z)</option>
        <option value="school">Sort: School</option>
      </select>
      <button class="btn ghost small" onclick="clearSpellFilters()">🧹 Clear</button>
    </div>

    <!-- Catalog List Container -->
    <div id="spell-catalog-error"></div>
    <div class="spell-catalog" id="spell-catalog-list" style="flex:1; overflow-y:auto; padding-right:6px;"></div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:8px; border-top:1px solid var(--border);">
      <div class="spell-status" id="spell-catalog-footer-count">0 spells matched</div>
      <button class="btn small" onclick="closeSpellCatalogModal()">← Back to My Spells</button>
    </div>
  </div>
</div>
`;
    // Insert before closing body
    content = content.replace('</body>', catalogOverlayHtml + '\n</body>');
  }

  // 2. Update renderSpellbookMenu to render ONLY My Spells in normal view, with button to open Catalog
  const oldMenuHtmlSnippet = `<div class="spellbook-body">' +
        '<div class="spellbook-section-title">' +
          '<div class="panel-title">Spell Catalog</div>' +
          '<div class="spell-status" id="spell-catalog-status">Loading...</div>' +
        '</div>' +
        '<div id="spell-catalog-error"></div>' +
        '<div class="spell-catalog" id="spell-catalog-list"></div>' +
        '<div class="spellbook-section-title" style="margin-top:16px;">' +
          '<div class="panel-title">My Spell List</div>' +
          '<div class="spell-status" id="spell-list-status">0 saved</div>' +
        '</div>' +
        '<div class="spell-list" id="spell-list"></div>' +
      '</div>';`;

  const newMenuHtmlSnippet = `<div class="spellbook-body">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin:16px 0 12px; flex-wrap:wrap; gap:10px;">' +
          '<div>' +
            '<div class="panel-title" style="font-size:18px; margin:0;">📖 My Spell List (Prepared & Learned)</div>' +
            '<div class="spell-status" id="spell-list-status" style="margin-top:2px;">0 saved</div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; align-items:center;">' +
            '<input type="text" id="my-spells-search" placeholder="🔍 Search my spells..." oninput="updateMySpellsSearch(this.value)" style="padding:6px 12px; font-size:12px; max-width:200px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text);">' +
            '<button class="btn small" onclick="openSpellCatalogModal()" style="font-size:12px; font-weight:bold; background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000; box-shadow:0 0 8px rgba(234,179,8,0.3);">📜 + Browse & Add Spells (Full Catalog)</button>' +
            '<button class="btn ghost small" onclick="openMaxSpellsModal()">⚙️ Max Limits</button>' +
          '</div>' +
        '</div>' +
        '<div class="spell-list" id="spell-list"></div>' +
      '</div>';`;

  if (content.includes(oldMenuHtmlSnippet)) {
    content = content.replace(oldMenuHtmlSnippet, newMenuHtmlSnippet);
  }

  // Also replace filter bar from renderSpellbookMenu since filter bar now belongs inside the catalog modal
  const oldFilterBarSnippet = `'<div class="spellbook-filter-bar">' +
        '<input type="text" id="spell-search-input" placeholder="🔍 Search spells by name, description, damage, or tags..." value="' + escapeHtml(state.spellbook.query||'') + '" oninput="updateSpellSearch(this.value)">' +
        '<select id="spell-class-filter" onchange="updateSpellClassFilter(this.value)">' +
        '<option value="">All Classes</option>' +
        '<option value="Bard">Bard</option>' +
        '<option value="Cleric">Cleric</option>' +
        '<option value="Druid">Druid</option>' +
        '<option value="Paladin">Paladin</option>' +
        '<option value="Ranger">Ranger</option>' +
        '<option value="Sorcerer">Sorcerer</option>' +
        '<option value="Warlock">Warlock</option>' +
        '<option value="Wizard">Wizard</option>' +
        '<option value="Artificer">Artificer</option>' +
        '</select>' +
        '<select id="spell-level-filter" onchange="updateSpellLevelFilter(this.value)">' +
        '<option value="">All Levels</option>' +
        '<option value="0">Cantrips</option>' +
        '<option value="1">Level 1</option>' +
        '<option value="2">Level 2</option>' +
        '<option value="3">Level 3</option>' +
        '<option value="4">Level 4</option>' +
        '<option value="5">Level 5</option>' +
        '<option value="6">Level 6</option>' +
        '<option value="7">Level 7</option>' +
        '<option value="8">Level 8</option>' +
        '<option value="9">Level 9</option>' +
        '</select>' +
        '<select id="spell-school-filter" onchange="updateSpellSchoolFilter(this.value)">' +
        '<option value="">All Schools</option>' +
        '<option value="Abjuration">Abjuration</option>' +
        '<option value="Conjuration">Conjuration</option>' +
        '<option value="Divination">Divination</option>' +
        '<option value="Enchantment">Enchantment</option>' +
        '<option value="Evocation">Evocation</option>' +
        '<option value="Illusion">Illusion</option>' +
        '<option value="Necromancy">Necromancy</option>' +
        '<option value="Transmutation">Transmutation</option>' +
        '</select>' +
        '<select id="spell-sort-by" onchange="updateSpellSortBy(this.value)">' +
        '<option value="level-asc">Sort: Level (Asc)</option>' +
        '<option value="level-desc">Sort: Level (Desc)</option>' +
        '<option value="name">Sort: Name (A-Z)</option>' +
        '<option value="class">Sort: Class (A-Z)</option>' +
        '<option value="school">Sort: School</option>' +
        '</select>' +
        '<button class="btn ghost small" onclick="clearSpellFilters()">🧹 Clear Filters</button>' +
        '<button class="btn ghost small" onclick="openMaxSpellsModal()">⚙️ Max Spells Limits</button>' +
        '<button class="btn ghost small" onclick="refreshSpellCatalog()">Reload Catalog</button>' +
      '</div>' +`;

  if (content.includes(oldFilterBarSnippet)) {
    content = content.replace(oldFilterBarSnippet, '');
  }

  // 3. Add JS helper functions openSpellCatalogModal, closeSpellCatalogModal, updateMySpellsSearch
  if (!content.includes('function openSpellCatalogModal()')) {
    const spellModalHelpers = `
let mySpellsFilterQuery = '';

function updateMySpellsSearch(val){
  mySpellsFilterQuery = (val || '').toLowerCase().trim();
  renderSpellbookContents();
}

function openSpellCatalogModal(){
  const overlay = document.getElementById('spell-catalog-overlay');
  if(overlay) overlay.classList.add('open');
  renderSpellbookContents();
}

function closeSpellCatalogModal(){
  const overlay = document.getElementById('spell-catalog-overlay');
  if(overlay) overlay.classList.remove('open');
}
`;
    content = content.replace('function renderSpellbookContents(){', spellModalHelpers + '\nfunction renderSpellbookContents(){');
  }

  // 4. Update renderSpellbookContents to handle mySpellsFilterQuery and empty state with button
  if (!content.includes('mySpellsFilterQuery')) {
    content = content.replace(
      'const list = sb.list || [];',
      `let list = sb.list || [];
  if(typeof mySpellsFilterQuery === 'string' && mySpellsFilterQuery){
    list = list.filter(function(spell){
      return spell.name.toLowerCase().includes(mySpellsFilterQuery) ||
        (spell.desc && spell.desc.toLowerCase().includes(mySpellsFilterQuery)) ||
        (spell.levelText && spell.levelText.toLowerCase().includes(mySpellsFilterQuery));
    });
  }`
    );
  }

  // 5. Update catalog status boxes in modal
  content = content.replace(
    `if(statusBox) statusBox.textContent = sb.loading ? 'Loading...' : catalog.length.toLocaleString() + ' shown' + filterNotice;`,
    `if(statusBox) statusBox.textContent = sb.loading ? 'Loading...' : catalog.length.toLocaleString() + ' shown' + filterNotice;
  const modalStatus = document.getElementById('spell-catalog-modal-status');
  if(modalStatus) modalStatus.textContent = sb.loading ? 'Loading...' : catalog.length.toLocaleString() + ' spells shown' + filterNotice;
  const footerCount = document.getElementById('spell-catalog-footer-count');
  if(footerCount) footerCount.textContent = (sb.catalog || []).length.toLocaleString() + ' total catalog spells · ' + catalog.length.toLocaleString() + ' filtered';`
  );

  // 6. Update empty state in My Spell List to show a nice card with button
  const oldEmptyListMsg = `'<div class="spell-empty">No spells added yet. Select spells from the catalog above.</div>'`;
  const newEmptyListMsg = `'<div class="spell-empty" style="padding:32px 20px; text-align:center; background:rgba(0,0,0,0.25); border:1px dashed var(--border-bright); border-radius:8px;">' +
      '<div style="font-size:36px; margin-bottom:8px;">✨</div>' +
      '<div style="font-size:16px; font-weight:bold; color:var(--gold-bright); font-family:\'Cinzel\',serif;">Your Spellbook is Empty</div>' +
      '<div style="font-size:13px; color:var(--text-muted); max-width:480px; margin:8px auto 16px; line-height:1.4;">Browse over 1,200 D&D 5e spells from all classes, levels, and schools to add to your character\\'s prepared list.</div>' +
      '<button class="btn" onclick="openSpellCatalogModal()" style="font-size:13px; font-weight:bold; padding:8px 18px; background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000;">📜 + Browse & Add Spells (Full Catalog)</button>' +
    '</div>'`;

  if (content.includes(oldEmptyListMsg)) {
    content = content.replace(oldEmptyListMsg, newEmptyListMsg);
  }

  // 7. Make catalog item buttons show + Add in primary gold or ✓ Added in green
  const oldCatalogBtn = `'<button class="btn ghost small" onclick="toggleSpellFromCatalog(\'' + escapedName + '\')">' + (inList ? 'Remove' : '+ Add') + '</button>'`;
  const newCatalogBtn = `(inList ? '<button class="btn small" style="background:rgba(34,197,94,0.2); border:1px solid #22c55e; color:#4ade80; font-weight:bold;" onclick="toggleSpellFromCatalog(\'' + escapedName + '\')">✓ Added</button>' : '<button class="btn small" style="background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000; font-weight:bold;" onclick="toggleSpellFromCatalog(\'' + escapedName + '\')">+ Add</button>')`;

  if (content.includes(oldCatalogBtn)) {
    content = content.replace(oldCatalogBtn, newCatalogBtn);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully upgraded Spell System layout in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
upgradeSpellSystemLayout(path.join(dir, 'bg3-inventory_13.html'));
upgradeSpellSystemLayout(path.join(dir, 'bg3-inventory.html'));
