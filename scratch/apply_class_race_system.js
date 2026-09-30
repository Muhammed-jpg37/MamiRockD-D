const fs = require('fs');
const path = require('path');

function addClassAndRaceSystem(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add Class & Species inputs to stats-settings-overlay modal if not present
  if (!content.includes('id="st-class"')) {
    const classRaceFormHtml = `<div style="font-family:Cinzel,serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin-bottom:6px;">Character Class & Species</div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr; gap:8px;">
          <div class="form-row">
            <label>Class</label>
            <select id="st-class">
              <option value="Bard">Bard</option>
              <option value="Barbarian">Barbarian</option>
              <option value="Cleric">Cleric</option>
              <option value="Druid">Druid</option>
              <option value="Fighter">Fighter</option>
              <option value="Monk">Monk</option>
              <option value="Paladin">Paladin</option>
              <option value="Ranger">Ranger</option>
              <option value="Rogue">Rogue</option>
              <option value="Sorcerer">Sorcerer</option>
              <option value="Warlock">Warlock</option>
              <option value="Wizard">Wizard</option>
              <option value="Artificer">Artificer</option>
              <option value="Custom">Custom...</option>
            </select>
          </div>
          <div class="form-row">
            <label>Subclass / Custom Class</label>
            <input type="text" id="st-subclass" placeholder="College of Lore, Evocation...">
          </div>
          <div class="form-row">
            <label>Level (1-20)</label>
            <input type="number" id="st-level" min="1" max="20" value="5" onchange="autoCalcProfBonusFromLevel()">
          </div>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:8px; margin:6px 0 12px;">
          <div class="form-row">
            <label>Race / Species</label>
            <select id="st-species">
              <option value="Half-Elf">Half-Elf</option>
              <option value="Human">Human</option>
              <option value="Elf">Elf</option>
              <option value="Dwarf">Dwarf</option>
              <option value="Halfling">Halfling</option>
              <option value="Gnome">Gnome</option>
              <option value="Tiefling">Tiefling</option>
              <option value="Dragonborn">Dragonborn</option>
              <option value="Half-Orc">Half-Orc</option>
              <option value="Githyanki">Githyanki</option>
              <option value="Drow">Drow</option>
              <option value="Aasimar">Aasimar</option>
              <option value="Genasi">Genasi</option>
              <option value="Custom">Custom...</option>
            </select>
          </div>
          <div class="form-row">
            <label>Subrace / Lineage</label>
            <input type="text" id="st-subrace" placeholder="High Half-Elf, Wood Elf, Gold Dwarf...">
          </div>
        </div>
        <div style="font-family:Cinzel,serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin-bottom:6px;">Ability Scores</div>`;

    // Try matching both variations
    if (content.includes('font-family:Cinzel,serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin-bottom:6px;">Ability Scores</div>')) {
      content = content.replace('font-family:Cinzel,serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin-bottom:6px;">Ability Scores</div>', classRaceFormHtml);
    } else if (content.includes("font-family:'Cinzel',serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin-bottom:6px;\">Ability Scores</div>")) {
      content = content.replace("font-family:'Cinzel',serif; font-size:12px; font-weight:700; color:var(--gold-bright); margin-bottom:6px;\">Ability Scores</div>", classRaceFormHtml);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated Class & Race form in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
addClassAndRaceSystem(path.join(dir, 'bg3-inventory_13.html'));
addClassAndRaceSystem(path.join(dir, 'bg3-inventory.html'));
