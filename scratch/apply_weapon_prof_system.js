const fs = require('fs');
const path = require('path');

function updateWeaponProficiencySystem(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add f-prof-type-row to Add/Edit Item overlay modal if not already present
  if (!content.includes('id="f-prof-type-row"')) {
    const targetTypeSelect = `<select id="f-type">`;
    const replacementTypeSelect = `<select id="f-type" onchange="toggleProfTypeRow()">`;
    content = content.replace(targetTypeSelect, replacementTypeSelect);

    const targetTypeRowEnd = `</select>\n      </div>`;
    const profTypeRowHtml = `</select>
      </div>
      <div class="form-row" id="f-prof-type-row" style="display:none;">
        <label>Weapon Proficiency Category</label>
        <select id="f-prof-type">
          <option value="Simple">Simple Weapon</option>
          <option value="Martial">Martial Weapon</option>
          <option value="Exotic">Exotic Weapon</option>
          <option value="None">None / Specific</option>
        </select>
      </div>`;
    content = content.replace(targetTypeRowEnd, profTypeRowHtml);
  }

  // 2. Add toggleProfTypeRow and isProficientWithWeapon functions
  if (!content.includes('function toggleProfTypeRow()')) {
    const toggleFunc = `
function toggleProfTypeRow(){
  const typeVal = document.getElementById('f-type') ? document.getElementById('f-type').value : '';
  const row = document.getElementById('f-prof-type-row');
  if(row) row.style.display = (typeVal === 'Weapon') ? 'block' : 'none';
}
function isProficientWithWeapon(item){
  if(!item || item.type !== 'Weapon') return true;
  const cs = state.characterStats || {};
  const pType = item.proficiencyType || 'Simple';
  if(pType === 'None') return true;
  if(cs.profSimple && pType === 'Simple') return true;
  if(cs.profMartial && pType === 'Martial') return true;
  if(cs.profExotic && pType === 'Exotic') return true;
  const notes = (cs.weapons || '').toLowerCase();
  if(notes.includes(pType.toLowerCase())) return true;
  if(item.name && notes.includes(item.name.toLowerCase())) return true;
  return false;
}
`;
    content = content.replace('function openItemModal(){', toggleFunc + '\nfunction openItemModal(){');
  }

  // 3. Update openItemModal
  if (!content.includes(`document.getElementById('f-prof-type').value = 'Simple';`)) {
    content = content.replace(
      `document.getElementById('f-type').value = 'Weapon';`,
      `document.getElementById('f-type').value = 'Weapon';\n  if(document.getElementById('f-prof-type')) document.getElementById('f-prof-type').value = 'Simple';\n  toggleProfTypeRow();`
    );
  }

  // 4. Update editItem
  if (!content.includes(`document.getElementById('f-prof-type').value = item.proficiencyType`)) {
    content = content.replace(
      `document.getElementById('f-type').value = item.type;`,
      `document.getElementById('f-type').value = item.type;\n  if(document.getElementById('f-prof-type')) document.getElementById('f-prof-type').value = item.proficiencyType || 'Simple';\n  toggleProfTypeRow();`
    );
  }

  // 5. Update saveItem
  if (!content.includes(`proficiencyType: (document.getElementById('f-type')`)) {
    content = content.replace(
      `attunementRequired,`,
      `attunementRequired,\n    proficiencyType: (document.getElementById('f-type').value==='Weapon') ? (document.getElementById('f-prof-type') ? document.getElementById('f-prof-type').value : 'Simple') : null,`
    );
  }

  // 6. Update stats-settings-overlay
  if (!content.includes('id="st-wp-simple"')) {
    const oldWeaponsRow = `<div class="form-row">\n          <label>Weapon Proficiencies</label>\n          <input type="text" id="st-weapons" placeholder="Simple Weapons, Martial Weapons...">\n        </div>`;
    const newWeaponsBlock = `<div style="font-family:'Cinzel',serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin:12px 0 6px;">Weapon Proficiencies</div>
        <div style="display:flex; gap:12px; background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; border:1px solid var(--border); margin-bottom:8px;">
          <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;"><input type="checkbox" id="st-wp-simple"> Simple Weapons</label>
          <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;"><input type="checkbox" id="st-wp-martial"> Martial Weapons</label>
          <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;"><input type="checkbox" id="st-wp-exotic"> Exotic Weapons</label>
        </div>
        <div class="form-row">
          <label>Specific Weapons / Notes</label>
          <input type="text" id="st-weapons" placeholder="Longsword, Hand Crossbow, Rapier...">
        </div>`;
    content = content.replace(oldWeaponsRow, newWeaponsBlock);
  }

  // 7. Update openCharacterStatsModal & saveCharacterStatsSettings
  if (!content.includes(`document.getElementById('st-wp-simple').checked`)) {
    content = content.replace(
      `document.getElementById('st-weapons').value = cs.weapons || '';`,
      `document.getElementById('st-weapons').value = cs.weapons || '';\n  if(document.getElementById('st-wp-simple')) document.getElementById('st-wp-simple').checked = !!cs.profSimple;\n  if(document.getElementById('st-wp-martial')) document.getElementById('st-wp-martial').checked = !!cs.profMartial;\n  if(document.getElementById('st-wp-exotic')) document.getElementById('st-wp-exotic').checked = !!cs.profExotic;`
    );

    content = content.replace(
      `cs.weapons = getVal('st-weapons');`,
      `cs.weapons = getVal('st-weapons');\n  cs.profSimple = document.getElementById('st-wp-simple') ? document.getElementById('st-wp-simple').checked : false;\n  cs.profMartial = document.getElementById('st-wp-martial') ? document.getElementById('st-wp-martial').checked : false;\n  cs.profExotic = document.getElementById('st-wp-exotic') ? document.getElementById('st-wp-exotic').checked : false;`
    );
  }

  // 8. Update renderDetail to include proficiency badge under detail-meta
  if (!content.includes('profBadge')) {
    const metaTarget = `'<div class="detail-meta"><span class="rarity-tag" data-r="' + item.rarity + '" style="color:' + rarityColor(item.rarity) + '">' + item.rarity + '</span> · ' + item.type + (item.slot? ' · '+SLOT_LABELS[item.slot]:'') + '</div>' +`;
    
    const metaReplacement = metaTarget + `
      (item.type === 'Weapon' ? (
        isProficientWithWeapon(item)
          ? '<div style="margin-top:6px; display:inline-flex; align-items:center; gap:4px; background:rgba(34,197,94,0.15); border:1px solid #22c55e; color:#4ade80; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">✨ Proficient (+' + (state.characterStats ? (state.characterStats.prof || 2) : 2) + ' Atk) [' + (item.proficiencyType || 'Simple') + ']</div>'
          : '<div style="margin-top:6px; display:inline-flex; align-items:center; gap:4px; background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#f87171; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold;">⚠️ Not Proficient [' + (item.proficiencyType || 'Simple') + ']</div>'
      ) : '') +`;

    content = content.replace(metaTarget, metaReplacement);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath} with Weapon Proficiency System`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
updateWeaponProficiencySystem(path.join(dir, 'bg3-inventory_13.html'));
updateWeaponProficiencySystem(path.join(dir, 'bg3-inventory.html'));
