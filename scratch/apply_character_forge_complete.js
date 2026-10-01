const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'index', 'index.html')
];

// Read assets
const buildForgeScript = fs.readFileSync(path.join(__dirname, 'build_character_forge.js'), 'utf8');

// The CSS to inject into <style>
const cssToInject = `
  /* ========================================================
     CHARACTER FORGE / GENERATION WIZARD STYLES
     ======================================================== */
  #character-forge-overlay {
    z-index: 100000;
  }
  .forge-modal {
    max-width: 960px !important;
    width: 95vw !important;
    max-height: 92vh !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 0 !important;
    background: radial-gradient(ellipse at top, #261910 0%, #120c08 70%) !important;
    border: 2px solid var(--border-bright) !important;
    box-shadow: 0 0 50px rgba(0,0,0,0.9), 0 0 35px rgba(201,162,39,0.25) !important;
    border-radius: 12px !important;
    overflow: hidden !important;
  }
  .forge-header {
    padding: 16px 22px;
    background: linear-gradient(180deg, rgba(40,25,15,0.95), rgba(25,16,10,0.9));
    border-bottom: 2px solid var(--border-bright);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .forge-title {
    font-family: 'Cinzel', serif;
    font-size: 20px;
    font-weight: 900;
    color: var(--gold-bright);
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-shadow: 0 0 10px rgba(201,162,39,0.4);
  }
  .forge-subtitle {
    font-size: 12px;
    color: var(--text-dim);
    margin-top: 2px;
  }
  .forge-body {
    padding: 20px 24px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .forge-section {
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .forge-section-title {
    font-family: 'Cinzel', serif;
    font-size: 14px;
    font-weight: 700;
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .forge-class-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }
  .forge-class-card {
    background: rgba(30,20,12,0.6);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }
  .forge-class-card:hover {
    border-color: var(--gold);
    background: rgba(50,30,16,0.8);
    transform: translateY(-2px);
  }
  .forge-class-card.selected {
    border-color: var(--gold-bright);
    background: linear-gradient(180deg, rgba(201,162,39,0.25), rgba(40,25,15,0.7));
    box-shadow: 0 0 12px rgba(201,162,39,0.35);
  }
  .forge-class-icon {
    font-size: 26px;
    margin-bottom: 4px;
  }
  .forge-class-name {
    font-family: 'Cinzel', serif;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }
  .forge-class-hitdie {
    font-size: 11px;
    color: var(--gold);
    margin-top: 2px;
  }
  .forge-stats-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }
  @media (max-width: 768px) {
    .forge-stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .forge-stat-card {
    background: rgba(20,14,10,0.8);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 6px;
    text-align: center;
    position: relative;
  }
  .forge-stat-label {
    font-family: 'Cinzel', serif;
    font-size: 12px;
    font-weight: 700;
    color: var(--gold-bright);
    text-transform: uppercase;
  }
  .forge-stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 4px 0;
  }
  .forge-stat-mod {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 12px;
    display: inline-block;
    background: rgba(74,143,79,0.25);
    color: #4ade80;
    border: 1px solid rgba(74,143,79,0.5);
  }
  .forge-stat-mod.neg {
    background: rgba(168,60,50,0.25);
    color: #f87171;
    border-color: rgba(168,60,50,0.5);
  }
  .forge-stat-controls {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
  }
  .forge-stat-btn {
    background: rgba(0,0,0,0.5);
    border: 1px solid var(--border);
    color: var(--text);
    width: 24px;
    height: 24px;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .forge-stat-btn:hover {
    background: var(--border-bright);
    color: #fff;
  }
  .forge-skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }
  .forge-skill-item {
    background: rgba(25,18,12,0.5);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;
  }
  .forge-skill-item:hover {
    background: rgba(40,28,18,0.8);
    border-color: var(--gold);
  }
  .forge-skill-item.active {
    background: rgba(201,162,39,0.2);
    border-color: var(--gold-bright);
    color: #fff;
    font-weight: 600;
  }
  .forge-summary-bar {
    background: linear-gradient(180deg, rgba(30,20,14,0.9), rgba(18,12,8,0.95));
    border-top: 2px solid var(--border-bright);
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .forge-summary-badges {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .forge-badge {
    background: rgba(0,0,0,0.5);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .forge-badge strong {
    color: var(--gold-bright);
  }
`;

// HTML for Character Forge Modal
const forgeModalHtml = `
  <!-- CHARACTER FORGE (HERO CREATION WIZARD) -->
  <div class="overlay" id="character-forge-overlay">
    <div class="modal forge-modal">
      <div class="forge-header">
        <div>
          <div class="forge-title">⚔ HERO FORGE: CHARACTER CREATION</div>
          <div class="forge-subtitle" id="forge-hero-name-subtitle">Crafting hero for adventurer...</div>
        </div>
        <button class="btn-close" onclick="closeCharacterForgeModal()">✕</button>
      </div>

      <div class="forge-body">
        <!-- 1. CHOOSE CLASS -->
        <div class="forge-section">
          <div class="forge-section-title">
            <span>1. Choose Class</span>
            <span id="forge-class-selected-label" style="color:var(--gold-bright); font-size:12px;">Fighter</span>
          </div>
          <div class="forge-class-grid" id="forge-class-grid"></div>
          <div id="forge-class-description" style="font-size:12px; color:var(--text-dim); margin-top:10px; font-style:italic;"></div>
        </div>

        <!-- 2. SPECIES & LEVEL -->
        <div class="forge-section" style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <div class="forge-section-title">2. Choose Species / Race</div>
            <select id="forge-species-select" onchange="onForgeSpeciesChange(this.value)" style="width:100%; padding:10px; border-radius:6px; background:rgba(0,0,0,0.6); border:1px solid var(--border); color:#fff; font-size:14px; font-family:'Cinzel',serif;">
              <option value="Human">Human (Versatile · 30 ft)</option>
              <option value="Elf">Elf (Keen Senses · Elvish · 30 ft)</option>
              <option value="Dwarf">Dwarf (Dwarven Resilience · 25 ft)</option>
              <option value="Halfling">Halfling (Lucky &amp; Brave · 25 ft)</option>
              <option value="Dragonborn">Dragonborn (Draconic Breath · 30 ft)</option>
              <option value="Gnome">Gnome (Gnome Cunning · 25 ft)</option>
              <option value="Half-Elf">Half-Elf (Fey Ancestry · 30 ft)</option>
              <option value="Half-Orc">Half-Orc (Relentless Endurance · 30 ft)</option>
              <option value="Tiefling">Tiefling (Hellish Resistance · 30 ft)</option>
            </select>
          </div>
          <div style="width:140px;">
            <div class="forge-section-title">Starting Level</div>
            <select id="forge-level-select" onchange="onForgeLevelChange(this.value)" style="width:100%; padding:10px; border-radius:6px; background:rgba(0,0,0,0.6); border:1px solid var(--border); color:#fff; font-size:14px; font-family:'Cinzel',serif;">
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5" selected>Level 5</option>
              <option value="6">Level 6</option>
              <option value="7">Level 7</option>
              <option value="8">Level 8</option>
              <option value="9">Level 9</option>
              <option value="10">Level 10</option>
              <option value="11">Level 11</option>
              <option value="12">Level 12</option>
              <option value="13">Level 13</option>
              <option value="14">Level 14</option>
              <option value="15">Level 15</option>
              <option value="16">Level 16</option>
              <option value="17">Level 17</option>
              <option value="18">Level 18</option>
              <option value="19">Level 19</option>
              <option value="20">Level 20</option>
            </select>
          </div>
        </div>

        <!-- 3. ABILITY SCORES (STATS) -->
        <div class="forge-section">
          <div class="forge-section-title">
            <span>3. Ability Scores (Stats)</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn ghost small" onclick="forgeRollStats()">🎲 Roll 4d6 (Drop Lowest)</button>
              <button type="button" class="btn ghost small" onclick="forgeResetClassStats()">📐 Standard Array</button>
            </div>
          </div>
          <div class="forge-stats-grid" id="forge-stats-grid"></div>
        </div>

        <!-- 4. SKILL PROFICIENCIES -->
        <div class="forge-section">
          <div class="forge-section-title">
            <span>4. Skill Proficiencies</span>
            <span id="forge-skills-count-badge" style="font-size:12px; color:var(--text-dim);">0 Selected</span>
          </div>
          <div class="forge-skills-grid" id="forge-skills-grid"></div>
        </div>

        <!-- 5. STARTER GEAR PREVIEW -->
        <div class="forge-section">
          <div class="forge-section-title">5. Class Starter Equipment Pack</div>
          <div id="forge-starter-gear-list" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>
      </div>

      <div class="forge-summary-bar">
        <div class="forge-summary-badges">
          <div class="forge-badge">❤️ Max HP: <strong id="forge-summary-hp">12</strong></div>
          <div class="forge-badge">🛡️ AC: <strong id="forge-summary-ac">16</strong></div>
          <div class="forge-badge">🦶 Speed: <strong id="forge-summary-speed">30 ft</strong></div>
          <div class="forge-badge">⭐ Prof Bonus: <strong id="forge-summary-prof">+2</strong></div>
        </div>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn ghost" onclick="closeCharacterForgeModal()">Cancel</button>
          <button type="button" class="btn" onclick="submitCharacterForge()" style="font-family:'Cinzel',serif; font-size:14px; font-weight:bold; background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000; box-shadow:0 0 15px rgba(234,179,8,0.4); padding:10px 22px;">✨ FORGE HERO &amp; ENTER REALM</button>
        </div>
      </div>
    </div>
  </div>
`;

// JavaScript for Character Forge Logic
const forgeJsLogic = `
    /* ========================================================
       CHARACTER FORGE / GENERATION WIZARD ENGINE
       ======================================================== */
    const DND_CLASSES = {
      Barbarian: {
        icon: '🪓', hitDie: 12, primary: 'STR, CON',
        desc: 'A fierce warrior of primitive background who can enter a battle rage.',
        saves: ['str', 'con'],
        defaultStats: { str: 15, dex: 14, con: 14, int: 8, wis: 12, cha: 10 },
        defaultSkills: ['athletics', 'perception', 'survival', 'intimidation'],
        armorProf: 'Light Armor, Medium Armor, Shields',
        weaponProf: 'Simple Weapons, Martial Weapons',
        starterItems: [
          { name: 'Greataxe', category: 'weapon', rarity: 'common', qty: 1, weight: 7, value: 30, equipped: 'main', damage: '1d12 Slashing', damageType: 'Slashing', proficiencyType: 'Martial' },
          { name: 'Handaxe', category: 'weapon', rarity: 'common', qty: 2, weight: 2, value: 5, damage: '1d6 Slashing', damageType: 'Slashing', proficiencyType: 'Simple' },
          { name: "Explorer's Pack", category: 'gear', rarity: 'common', qty: 1, weight: 10, value: 10, desc: 'Includes backpack, bedroll, mess kit, tinderbox, torches, rations, waterskin.' },
          { name: 'Javelin', category: 'weapon', rarity: 'common', qty: 4, weight: 2, value: 2, damage: '1d6 Piercing', damageType: 'Simple' }
        ]
      },
      Bard: {
        icon: '🎵', hitDie: 8, primary: 'CHA, DEX',
        desc: 'An inspiring magician whose power echoes the music of creation.',
        saves: ['dex', 'cha'],
        defaultStats: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
        defaultSkills: ['performance', 'persuasion', 'deception', 'insight'],
        armorProf: 'Light Armor',
        weaponProf: 'Simple Weapons, Hand Crossbows, Longswords, Rapiers, Shortswords',
        starterItems: [
          { name: 'Rapier', category: 'weapon', rarity: 'common', qty: 1, weight: 2, value: 25, equipped: 'main', damage: '1d8 Piercing', damageType: 'Piercing', proficiencyType: 'Martial' },
          { name: 'Leather Armor', category: 'armor', rarity: 'common', qty: 1, weight: 10, value: 10, equipped: 'chest', baseAc: 11, armorType: 'Light' },
          { name: 'Dagger', category: 'weapon', rarity: 'common', qty: 1, weight: 1, value: 2, damage: '1d4 Piercing', damageType: 'Simple' },
          { name: 'Lute', category: 'gear', rarity: 'common', qty: 1, weight: 2, value: 35, desc: 'Musical instrument for spellcasting focus.' },
          { name: "Entertainer's Pack", category: 'gear', rarity: 'common', qty: 1, weight: 8, value: 40 }
        ]
      },
      Cleric: {
        icon: '☀️', hitDie: 8, primary: 'WIS, CON/STR',
        desc: 'A priestly champion who wields divine magic in service of a higher power.',
        saves: ['wis', 'cha'],
        defaultStats: { str: 14, dex: 10, con: 14, int: 10, wis: 15, cha: 12 },
        defaultSkills: ['religion', 'insight', 'medicine', 'history'],
        armorProf: 'Light Armor, Medium Armor, Shields',
        weaponProf: 'Simple Weapons',
        starterItems: [
          { name: 'Mace', category: 'weapon', rarity: 'common', qty: 1, weight: 4, value: 5, equipped: 'main', damage: '1d6 Bludgeoning', damageType: 'Bludgeoning', proficiencyType: 'Simple' },
          { name: 'Scale Mail', category: 'armor', rarity: 'common', qty: 1, weight: 45, value: 50, equipped: 'chest', baseAc: 14, armorType: 'Medium' },
          { name: 'Shield', category: 'shield', rarity: 'common', qty: 1, weight: 6, value: 10, equipped: 'off', acBonus: 2 },
          { name: 'Holy Symbol', category: 'wondrous', rarity: 'common', qty: 1, weight: 1, value: 5, desc: 'Divine spellcasting focus.' },
          { name: "Priest's Pack", category: 'gear', rarity: 'common', qty: 1, weight: 10, value: 19 }
        ]
      },
      Druid: {
        icon: '🌿', hitDie: 8, primary: 'WIS, CON',
        desc: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
        saves: ['int', 'wis'],
        defaultStats: { str: 10, dex: 14, con: 14, int: 12, wis: 15, cha: 8 },
        defaultSkills: ['nature', 'perception', 'animalHandling', 'survival'],
        armorProf: 'Light Armor, Medium Armor (non-metal), Shields',
        weaponProf: 'Clubs, Daggers, Darts, Javelins, Maces, Quarterstaffs, Scimitars, Sickles, Slings, Spears',
        starterItems: [
          { name: 'Wooden Shield', category: 'shield', rarity: 'common', qty: 1, weight: 6, value: 10, equipped: 'off', acBonus: 2 },
          { name: 'Scimitar', category: 'weapon', rarity: 'common', qty: 1, weight: 3, value: 25, equipped: 'main', damage: '1d6 Slashing', damageType: 'Slashing', proficiencyType: 'Martial' },
          { name: 'Leather Armor', category: 'armor', rarity: 'common', qty: 1, weight: 10, value: 10, equipped: 'chest', baseAc: 11, armorType: 'Light' },
          { name: 'Druidic Focus (Mistletoe)', category: 'gear', rarity: 'common', qty: 1, weight: 0.5, value: 1 }
        ]
      },
      Fighter: {
        icon: '⚔️', hitDie: 10, primary: 'STR or DEX, CON',
        desc: 'A master of martial combat, skilled with a variety of weapons and armor.',
        saves: ['str', 'con'],
        defaultStats: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
        defaultSkills: ['athletics', 'acrobatics', 'perception', 'survival'],
        armorProf: 'All Armor, Shields',
        weaponProf: 'Simple Weapons, Martial Weapons',
        starterItems: [
          { name: 'Chain Mail', category: 'armor', rarity: 'common', qty: 1, weight: 55, value: 75, equipped: 'chest', baseAc: 16, armorType: 'Heavy' },
          { name: 'Longsword', category: 'weapon', rarity: 'common', qty: 1, weight: 3, value: 15, equipped: 'main', damage: '1d8/1d10 Slashing', damageType: 'Slashing', proficiencyType: 'Martial' },
          { name: 'Shield', category: 'shield', rarity: 'common', qty: 1, weight: 6, value: 10, equipped: 'off', acBonus: 2 },
          { name: 'Light Crossbow', category: 'weapon', rarity: 'common', qty: 1, weight: 5, value: 25, damage: '1d8 Piercing', damageType: 'Simple' },
          { name: 'Crossbow Bolts', category: 'gear', rarity: 'common', qty: 20, weight: 1.5, value: 1 }
        ]
      },
      Monk: {
        icon: '🥋', hitDie: 8, primary: 'DEX, WIS',
        desc: 'A master of martial arts, harnessing spiritual perfection and unarmored combat.',
        saves: ['str', 'dex'],
        defaultStats: { str: 10, dex: 15, con: 14, int: 10, wis: 14, cha: 8 },
        defaultSkills: ['acrobatics', 'athletics', 'insight', 'stealth'],
        armorProf: 'None',
        weaponProf: 'Simple Weapons, Shortswords',
        starterItems: [
          { name: 'Shortsword', category: 'weapon', rarity: 'common', qty: 1, weight: 2, value: 10, equipped: 'main', damage: '1d6 Piercing', damageType: 'Martial' },
          { name: 'Dart', category: 'weapon', rarity: 'common', qty: 10, weight: 0.25, value: 0.5, damage: '1d4 Piercing', damageType: 'Simple' },
          { name: "Dungeoneer's Pack", category: 'gear', rarity: 'common', qty: 1, weight: 12, value: 12 }
        ]
      },
      Paladin: {
        icon: '🛡️', hitDie: 10, primary: 'STR, CHA',
        desc: 'A holy warrior bound to a sacred oath, smiting foes with divine energy.',
        saves: ['wis', 'cha'],
        defaultStats: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 14 },
        defaultSkills: ['athletics', 'insight', 'intimidation', 'persuasion'],
        armorProf: 'All Armor, Shields',
        weaponProf: 'Simple Weapons, Martial Weapons',
        starterItems: [
          { name: 'Chain Mail', category: 'armor', rarity: 'common', qty: 1, weight: 55, value: 75, equipped: 'chest', baseAc: 16, armorType: 'Heavy' },
          { name: 'Longsword', category: 'weapon', rarity: 'common', qty: 1, weight: 3, value: 15, equipped: 'main', damage: '1d8/1d10 Slashing', damageType: 'Martial' },
          { name: 'Shield', category: 'shield', rarity: 'common', qty: 1, weight: 6, value: 10, equipped: 'off', acBonus: 2 },
          { name: 'Holy Symbol (Amulet)', category: 'wondrous', rarity: 'common', qty: 1, weight: 1, value: 5 }
        ]
      },
      Ranger: {
        icon: '🏹', hitDie: 10, primary: 'DEX, WIS',
        desc: 'A warrior of wilderness survival, lethal archery, and nature-attuned tracking.',
        saves: ['str', 'dex'],
        defaultStats: { str: 12, dex: 15, con: 14, int: 10, wis: 14, cha: 8 },
        defaultSkills: ['perception', 'stealth', 'survival', 'nature'],
        armorProf: 'Light Armor, Medium Armor, Shields',
        weaponProf: 'Simple Weapons, Martial Weapons',
        starterItems: [
          { name: 'Scale Mail', category: 'armor', rarity: 'common', qty: 1, weight: 45, value: 50, equipped: 'chest', baseAc: 14, armorType: 'Medium' },
          { name: 'Longbow', category: 'weapon', rarity: 'common', qty: 1, weight: 2, value: 50, equipped: 'main', damage: '1d8 Piercing', damageType: 'Martial' },
          { name: 'Quiver of Arrows', category: 'gear', rarity: 'common', qty: 20, weight: 1, value: 1 },
          { name: 'Shortsword', category: 'weapon', rarity: 'common', qty: 2, weight: 2, value: 10, damage: '1d6 Piercing', damageType: 'Martial' }
        ]
      },
      Rogue: {
        icon: '🗡️', hitDie: 8, primary: 'DEX, INT/CHA',
        desc: 'A scoundrel who uses stealth and sneak attack trickery to eliminate targets.',
        saves: ['dex', 'int'],
        defaultStats: { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 },
        defaultSkills: ['stealth', 'sleightOfHand', 'acrobatics', 'perception'],
        armorProf: 'Light Armor',
        weaponProf: 'Simple Weapons, Hand Crossbows, Longswords, Rapiers, Shortswords',
        starterItems: [
          { name: 'Rapier', category: 'weapon', rarity: 'common', qty: 1, weight: 2, value: 25, equipped: 'main', damage: '1d8 Piercing', damageType: 'Martial' },
          { name: 'Shortbow', category: 'weapon', rarity: 'common', qty: 1, weight: 2, value: 25, damage: '1d6 Piercing', damageType: 'Simple' },
          { name: 'Arrows', category: 'gear', rarity: 'common', qty: 20, weight: 1, value: 1 },
          { name: 'Leather Armor', category: 'armor', rarity: 'common', qty: 1, weight: 10, value: 10, equipped: 'chest', baseAc: 11, armorType: 'Light' },
          { name: "Thieves' Tools", category: 'gear', rarity: 'common', qty: 1, weight: 1, value: 25, desc: 'Lockpicks and trap disarm kit.' },
          { name: 'Dagger', category: 'weapon', rarity: 'common', qty: 2, weight: 1, value: 2, damage: '1d4 Piercing', damageType: 'Simple' }
        ]
      },
      Sorcerer: {
        icon: '⚡', hitDie: 6, primary: 'CHA, CON',
        desc: 'A spellcaster who channels inherent raw magic directly from their bloodline.',
        saves: ['con', 'cha'],
        defaultStats: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 },
        defaultSkills: ['arcana', 'deception', 'insight', 'persuasion'],
        armorProf: 'None',
        weaponProf: 'Daggers, Darts, Slings, Quarterstaffs, Light Crossbows',
        starterItems: [
          { name: 'Light Crossbow', category: 'weapon', rarity: 'common', qty: 1, weight: 5, value: 25, equipped: 'main', damage: '1d8 Piercing', damageType: 'Simple' },
          { name: 'Crossbow Bolts', category: 'gear', rarity: 'common', qty: 20, weight: 1.5, value: 1 },
          { name: 'Arcane Focus (Orb)', category: 'gear', rarity: 'common', qty: 1, weight: 3, value: 20 },
          { name: 'Dagger', category: 'weapon', rarity: 'common', qty: 2, weight: 1, value: 2, damage: '1d4 Piercing', damageType: 'Simple' }
        ]
      },
      Warlock: {
        icon: '👁️', hitDie: 8, primary: 'CHA, CON',
        desc: 'A wielder of magic derived from a sacred pact with an otherworldly patron.',
        saves: ['wis', 'cha'],
        defaultStats: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 15 },
        defaultSkills: ['arcana', 'deception', 'intimidation', 'religion'],
        armorProf: 'Light Armor',
        weaponProf: 'Simple Weapons',
        starterItems: [
          { name: 'Leather Armor', category: 'armor', rarity: 'common', qty: 1, weight: 10, value: 10, equipped: 'chest', baseAc: 11, armorType: 'Light' },
          { name: 'Light Crossbow', category: 'weapon', rarity: 'common', qty: 1, weight: 5, value: 25, equipped: 'main', damage: '1d8 Piercing', damageType: 'Simple' },
          { name: 'Crossbow Bolts', category: 'gear', rarity: 'common', qty: 20, weight: 1.5, value: 1 },
          { name: 'Arcane Focus (Wand)', category: 'gear', rarity: 'common', qty: 1, weight: 1, value: 10 },
          { name: 'Dagger', category: 'weapon', rarity: 'common', qty: 2, weight: 1, value: 2, damage: '1d4 Piercing', damageType: 'Simple' }
        ]
      },
      Wizard: {
        icon: '📖', hitDie: 6, primary: 'INT, CON/DEX',
        desc: 'A scholarly master of magic capable of bending reality through learned spells.',
        saves: ['int', 'wis'],
        defaultStats: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 },
        defaultSkills: ['arcana', 'history', 'investigation', 'insight'],
        armorProf: 'None',
        weaponProf: 'Daggers, Darts, Slings, Quarterstaffs, Light Crossbows',
        starterItems: [
          { name: 'Spellbook', category: 'book', rarity: 'common', qty: 1, weight: 3, value: 50, desc: 'Essential arcane tome containing recorded spells.' },
          { name: 'Quarterstaff', category: 'weapon', rarity: 'common', qty: 1, weight: 4, value: 0.2, equipped: 'main', damage: '1d6/1d8 Bludgeoning', damageType: 'Simple' },
          { name: 'Arcane Focus (Crystal)', category: 'gear', rarity: 'common', qty: 1, weight: 1, value: 10 },
          { name: "Scholar's Pack", category: 'gear', rarity: 'common', qty: 1, weight: 10, value: 40 }
        ]
      },
      Artificer: {
        icon: '🔧', hitDie: 8, primary: 'INT, CON',
        desc: 'Inventors who weave magic into mundane objects to craft extraordinary devices.',
        saves: ['con', 'int'],
        defaultStats: { str: 10, dex: 14, con: 14, int: 15, wis: 12, cha: 8 },
        defaultSkills: ['arcana', 'history', 'investigation', 'sleightOfHand'],
        armorProf: 'Light Armor, Medium Armor, Shields',
        weaponProf: 'Simple Weapons',
        starterItems: [
          { name: 'Scale Mail', category: 'armor', rarity: 'common', qty: 1, weight: 45, value: 50, equipped: 'chest', baseAc: 14, armorType: 'Medium' },
          { name: 'Light Crossbow', category: 'weapon', rarity: 'common', qty: 1, weight: 5, value: 25, equipped: 'main', damage: '1d8 Piercing', damageType: 'Simple' },
          { name: 'Crossbow Bolts', category: 'gear', rarity: 'common', qty: 20, weight: 1.5, value: 1 },
          { name: "Thieves' Tools", category: 'gear', rarity: 'common', qty: 1, weight: 1, value: 25 }
        ]
      }
    };

    const DND_SPECIES = {
      Human: { speed: 30, languages: 'Common, One Choice' },
      Elf: { speed: 30, languages: 'Common, Elvish' },
      Dwarf: { speed: 25, languages: 'Common, Dwarvish' },
      Halfling: { speed: 25, languages: 'Common, Halfling' },
      Dragonborn: { speed: 30, languages: 'Common, Draconic' },
      Gnome: { speed: 25, languages: 'Common, Gnomish' },
      'Half-Elf': { speed: 30, languages: 'Common, Elvish' },
      'Half-Orc': { speed: 30, languages: 'Common, Orc' },
      Tiefling: { speed: 30, languages: 'Common, Infernal' }
    };

    const DND_ALL_SKILLS = [
      { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
      { key: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
      { key: 'arcana', label: 'Arcana', ability: 'int' },
      { key: 'athletics', label: 'Athletics', ability: 'str' },
      { key: 'deception', label: 'Deception', ability: 'cha' },
      { key: 'history', label: 'History', ability: 'int' },
      { key: 'insight', label: 'Insight', ability: 'wis' },
      { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
      { key: 'investigation', label: 'Investigation', ability: 'int' },
      { key: 'medicine', label: 'Medicine', ability: 'wis' },
      { key: 'nature', label: 'Nature', ability: 'int' },
      { key: 'perception', label: 'Perception', ability: 'wis' },
      { key: 'performance', label: 'Performance', ability: 'cha' },
      { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
      { key: 'religion', label: 'Religion', ability: 'int' },
      { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
      { key: 'stealth', label: 'Stealth', ability: 'dex' },
      { key: 'survival', label: 'Survival', ability: 'wis' }
    ];

    let forgeNickname = '';
    let forgePassword = '123';
    let forgeRole = 'player';
    let forgeIsDmCreation = false;
    let forgeIsEditMode = false;
    let forgeSelectedClass = 'Fighter';
    let forgeSelectedSpecies = 'Human';
    let forgeSelectedLevel = 5;
    let forgeStats = { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };
    let forgeSkills = new Set(['athletics', 'acrobatics', 'perception', 'survival']);

    function openCharacterForgeModal(options = {}) {
      forgeNickname = options.nickname || (activeInventoryUser || (currentUser ? currentUser.nickname : 'Adventurer'));
      forgePassword = options.password || '123';
      forgeRole = options.role || 'player';
      forgeIsDmCreation = !!options.isDmCreation;
      forgeIsEditMode = !!options.isEditMode;

      if (forgeIsEditMode && state && state.characterStats) {
        const cs = state.characterStats;
        forgeSelectedClass = cs.characterClass || 'Fighter';
        forgeSelectedSpecies = cs.species || 'Human';
        forgeSelectedLevel = cs.level || 5;
        forgeStats = {
          str: cs.str || 15, dex: cs.dex || 14, con: cs.con || 14,
          int: cs.int || 10, wis: cs.wis || 12, cha: cs.cha || 8
        };
        forgeSkills = new Set();
        if (cs.skillProfs) {
          Object.keys(cs.skillProfs).forEach(k => { if (cs.skillProfs[k]) forgeSkills.add(k); });
        }
      } else {
        forgeSelectedClass = options.defaultClass || 'Fighter';
        forgeSelectedSpecies = options.defaultSpecies || 'Human';
        forgeSelectedLevel = options.defaultLevel || 5;
        const cDef = DND_CLASSES[forgeSelectedClass] || DND_CLASSES.Fighter;
        forgeStats = { ...cDef.defaultStats };
        forgeSkills = new Set(cDef.defaultSkills);
      }

      const subTitle = document.getElementById('forge-hero-name-subtitle');
      if (subTitle) {
        subTitle.textContent = (forgeIsEditMode ? 'Re-Forging hero for: ' : 'Forging new character sheet for: ') + forgeNickname;
      }

      const speciesSel = document.getElementById('forge-species-select');
      if (speciesSel) speciesSel.value = forgeSelectedSpecies;

      const lvlSel = document.getElementById('forge-level-select');
      if (lvlSel) lvlSel.value = String(forgeSelectedLevel);

      renderForgeClassGrid();
      renderForgeStatsGrid();
      renderForgeSkillsGrid();
      updateForgeSummary();

      const overlay = document.getElementById('character-forge-overlay');
      if (overlay) overlay.classList.add('open');
    }

    function closeCharacterForgeModal() {
      const overlay = document.getElementById('character-forge-overlay');
      if (overlay) overlay.classList.remove('open');
    }

    function renderForgeClassGrid() {
      const grid = document.getElementById('forge-class-grid');
      if (!grid) return;
      grid.innerHTML = Object.keys(DND_CLASSES).map(className => {
        const c = DND_CLASSES[className];
        const isSel = (className === forgeSelectedClass);
        return '<div class="forge-class-card ' + (isSel ? 'selected' : '') + '" onclick="selectForgeClass(\\'' + className + '\\')">' +
          '<div class="forge-class-icon">' + c.icon + '</div>' +
          '<div class="forge-class-name">' + className + '</div>' +
          '<div class="forge-class-hitdie">d' + c.hitDie + ' Hit Die</div>' +
          '</div>';
      }).join('');

      const label = document.getElementById('forge-class-selected-label');
      if (label) label.textContent = forgeSelectedClass;

      const desc = document.getElementById('forge-class-description');
      const cDef = DND_CLASSES[forgeSelectedClass];
      if (desc && cDef) {
        desc.textContent = cDef.desc + ' · Primary Ability: ' + cDef.primary + ' · Saving Throws: ' + cDef.saves.map(s => s.toUpperCase()).join(', ');
      }

      const gearBox = document.getElementById('forge-starter-gear-list');
      if (gearBox && cDef) {
        gearBox.innerHTML = cDef.starterItems.map(item => {
          return '<span class="forge-badge">📦 <strong>' + escapeHtml(item.name) + '</strong> (' + (item.damage || (item.baseAc ? ('AC ' + item.baseAc) : (item.acBonus ? ('+' + item.acBonus + ' AC') : item.category))) + ')</span>';
        }).join('');
      }
    }

    function selectForgeClass(className) {
      if (!DND_CLASSES[className]) return;
      forgeSelectedClass = className;
      const cDef = DND_CLASSES[className];
      forgeStats = { ...cDef.defaultStats };
      forgeSkills = new Set(cDef.defaultSkills);

      renderForgeClassGrid();
      renderForgeStatsGrid();
      renderForgeSkillsGrid();
      updateForgeSummary();
    }

    function onForgeSpeciesChange(speciesName) {
      forgeSelectedSpecies = speciesName;
      updateForgeSummary();
    }

    function onForgeLevelChange(lvl) {
      forgeSelectedLevel = parseInt(lvl, 10) || 1;
      updateForgeSummary();
    }

    function renderForgeStatsGrid() {
      const grid = document.getElementById('forge-stats-grid');
      if (!grid) return;
      const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      grid.innerHTML = keys.map(k => {
        const val = forgeStats[k] || 10;
        const mod = Math.floor((val - 10) / 2);
        const modStr = (mod >= 0 ? '+' : '') + mod;
        const isNeg = mod < 0;
        return '<div class="forge-stat-card">' +
          '<div class="forge-stat-label">' + k.toUpperCase() + '</div>' +
          '<div class="forge-stat-value" id="forge-val-' + k + '">' + val + '</div>' +
          '<div class="forge-stat-mod ' + (isNeg ? 'neg' : '') + '" id="forge-mod-' + k + '">' + modStr + '</div>' +
          '<div class="forge-stat-controls">' +
          '<button type="button" class="forge-stat-btn" onclick="changeForgeStat(\\'' + k + '\\', -1)">−</button>' +
          '<button type="button" class="forge-stat-btn" onclick="changeForgeStat(\\'' + k + '\\', 1)">+</button>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    function changeForgeStat(statKey, delta) {
      if (!forgeStats[statKey] && forgeStats[statKey] !== 0) forgeStats[statKey] = 10;
      forgeStats[statKey] = Math.max(3, Math.min(20, forgeStats[statKey] + delta));
      renderForgeStatsGrid();
      updateForgeSummary();
    }

    function forgeRollStats() {
      // Roll 4d6 drop lowest for all 6 stats
      const rollStat = () => {
        const rolls = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
        rolls.sort((a, b) => a - b);
        return rolls[1] + rolls[2] + rolls[3];
      };
      const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      keys.forEach(k => {
        forgeStats[k] = rollStat();
      });
      renderForgeStatsGrid();
      updateForgeSummary();
      toast('🎲 Rolled 4d6 (drop lowest) for all stats!', 2500);
    }

    function forgeResetClassStats() {
      const cDef = DND_CLASSES[forgeSelectedClass] || DND_CLASSES.Fighter;
      forgeStats = { ...cDef.defaultStats };
      renderForgeStatsGrid();
      updateForgeSummary();
      toast('📐 Reset to ' + forgeSelectedClass + ' Standard Array!', 2000);
    }

    function renderForgeSkillsGrid() {
      const grid = document.getElementById('forge-skills-grid');
      if (!grid) return;
      grid.innerHTML = DND_ALL_SKILLS.map(sk => {
        const isChecked = forgeSkills.has(sk.key);
        return '<div class="forge-skill-item ' + (isChecked ? 'active' : '') + '" onclick="toggleForgeSkill(\\'' + sk.key + '\\')">' +
          '<input type="checkbox" ' + (isChecked ? 'checked' : '') + ' style="pointer-events:none;">' +
          '<span>' + sk.label + ' <small style="color:var(--text-dim);">(' + sk.ability.toUpperCase() + ')</small></span>' +
          '</div>';
      }).join('');

      const countBadge = document.getElementById('forge-skills-count-badge');
      if (countBadge) {
        countBadge.textContent = forgeSkills.size + ' Skills Selected';
      }
    }

    function toggleForgeSkill(skillKey) {
      if (forgeSkills.has(skillKey)) {
        forgeSkills.delete(skillKey);
      } else {
        forgeSkills.add(skillKey);
      }
      renderForgeSkillsGrid();
    }

    function updateForgeSummary() {
      const cDef = DND_CLASSES[forgeSelectedClass] || DND_CLASSES.Fighter;
      const spDef = DND_SPECIES[forgeSelectedSpecies] || DND_SPECIES.Human;
      const lvl = forgeSelectedLevel;

      const conMod = Math.floor(((forgeStats.con || 10) - 10) / 2);
      const dexMod = Math.floor(((forgeStats.dex || 10) - 10) / 2);

      // HP Calculation
      const basePerLvl = Math.floor(cDef.hitDie / 2) + 1;
      const maxHp = Math.max(6, (cDef.hitDie + conMod) + (lvl - 1) * Math.max(1, (basePerLvl + conMod)));

      // AC Calculation
      let ac = 10 + dexMod;
      const equippedArmor = cDef.starterItems.find(i => i.category === 'armor');
      const equippedShield = cDef.starterItems.find(i => i.category === 'shield');
      if (equippedArmor && equippedArmor.baseAc) {
        if (equippedArmor.armorType === 'Heavy') ac = equippedArmor.baseAc;
        else if (equippedArmor.armorType === 'Medium') ac = equippedArmor.baseAc + Math.min(2, Math.max(0, dexMod));
        else ac = equippedArmor.baseAc + dexMod;
      } else if (forgeSelectedClass === 'Barbarian') {
        ac = 10 + dexMod + conMod;
      } else if (forgeSelectedClass === 'Monk') {
        const wisMod = Math.floor(((forgeStats.wis || 10) - 10) / 2);
        ac = 10 + dexMod + wisMod;
      }
      if (equippedShield && equippedShield.acBonus) ac += equippedShield.acBonus;

      const profBonus = Math.floor((lvl - 1) / 4) + 2;

      const hpEl = document.getElementById('forge-summary-hp');
      const acEl = document.getElementById('forge-summary-ac');
      const speedEl = document.getElementById('forge-summary-speed');
      const profEl = document.getElementById('forge-summary-prof');

      if (hpEl) hpEl.textContent = maxHp;
      if (acEl) acEl.textContent = ac;
      if (speedEl) speedEl.textContent = (spDef.speed || 30) + ' ft';
      if (profEl) profEl.textContent = '+' + profBonus;
    }

    function submitCharacterForge() {
      const nickname = forgeNickname;
      const password = forgePassword || '123';
      const charClass = forgeSelectedClass;
      const species = forgeSelectedSpecies;
      const level = forgeSelectedLevel;
      const cDef = DND_CLASSES[charClass] || DND_CLASSES.Fighter;
      const spDef = DND_SPECIES[species] || DND_SPECIES.Human;

      const stats = { ...forgeStats };
      const conMod = Math.floor((stats.con - 10) / 2);
      const dexMod = Math.floor((stats.dex - 10) / 2);
      const profBonus = Math.floor((level - 1) / 4) + 2;

      const basePerLvl = Math.floor(cDef.hitDie / 2) + 1;
      const maxHp = Math.max(6, (cDef.hitDie + conMod) + (level - 1) * Math.max(1, (basePerLvl + conMod)));

      let calculatedAc = 10 + dexMod;
      const starterItems = cDef.starterItems.map((item, idx) => ({
        ...item,
        id: 'starter_' + Date.now().toString(36) + '_' + idx
      }));

      const equippedArmor = starterItems.find(i => i.category === 'armor');
      const equippedShield = starterItems.find(i => i.category === 'shield');
      if (equippedArmor && equippedArmor.baseAc) {
        if (equippedArmor.armorType === 'Heavy') calculatedAc = equippedArmor.baseAc;
        else if (equippedArmor.armorType === 'Medium') calculatedAc = equippedArmor.baseAc + Math.min(2, Math.max(0, dexMod));
        else calculatedAc = equippedArmor.baseAc + dexMod;
      } else if (charClass === 'Barbarian') {
        calculatedAc = 10 + dexMod + conMod;
      } else if (charClass === 'Monk') {
        const wisMod = Math.floor((stats.wis - 10) / 2);
        calculatedAc = 10 + dexMod + wisMod;
      }
      if (equippedShield && equippedShield.acBonus) calculatedAc += equippedShield.acBonus;

      const saveProfs = {};
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => {
        saveProfs[k] = cDef.saves.includes(k);
      });

      const skillProfs = {};
      DND_ALL_SKILLS.forEach(sk => {
        skillProfs[sk.key] = forgeSkills.has(sk.key);
      });

      const characterStats = {
        str: stats.str, dex: stats.dex, con: stats.con, int: stats.int, wis: stats.wis, cha: stats.cha,
        profBonus: profBonus,
        speed: spDef.speed || 30,
        initBonus: dexMod,
        ac: calculatedAc,
        characterClass: charClass,
        species: species,
        level: level,
        armorProf: cDef.armorProf,
        weaponProf: cDef.weaponProf,
        toolProf: (charClass === 'Rogue' || charClass === 'Artificer') ? "Thieves' Tools" : '',
        languages: spDef.languages || 'Common',
        saveNotes: '',
        senseNotes: (species === 'Elf' || species === 'Dwarf' || species === 'Gnome' || species === 'Half-Elf' || species === 'Tiefling') ? 'Darkvision 60 ft' : '',
        saveProfs: saveProfs,
        skillProfs: skillProfs,
        saveCustomBonuses: {},
        skillCustomBonuses: {}
      };

      const SPELLCASTER_SLOTS = {
        1: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        2: { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        3: { 1: 4, 2: 2, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        4: { 1: 4, 2: 3, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        5: { 1: 4, 2: 3, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
      };
      const isCaster = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer', 'Paladin', 'Ranger'].includes(charClass);
      const spellSlotsMax = (isCaster && SPELLCASTER_SLOTS[Math.min(5, level)]) ? SPELLCASTER_SLOTS[Math.min(5, level)] : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

      const base = getDefaultState(nickname);
      const newPlayerState = Object.assign({}, base, {
        campaign: nickname + "'s Vault",
        characterStats: characterStats,
        hp: { current: maxHp, max: maxHp, temp: 0 },
        items: starterItems,
        currency: { platinum: 0, gold: 50, electrum: 0, silver: 20, copper: 50 },
        spellSlots: {
          max: spellSlotsMax,
          used: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
        },
        spellbook: {
          open: true,
          query: '',
          classFilter: charClass,
          levelFilter: '',
          schoolFilter: '',
          sortBy: 'level-asc',
          catalogLoaded: (Array.isArray(window.GLOBAL_SPELL_CATALOG) && window.GLOBAL_SPELL_CATALOG.length > 0),
          loading: false,
          error: '',
          catalog: (Array.isArray(window.GLOBAL_SPELL_CATALOG) ? window.GLOBAL_SPELL_CATALOG : []),
          list: [],
          maxPerLevel: { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
        }
      });

      // Save account credentials if newly registering
      if (!forgeIsEditMode) {
        const newAccount = {
          nickname: nickname,
          password: password,
          role: forgeRole || 'player',
          createdAt: Date.now()
        };
        saveStoredAccount(newAccount);
      }

      // Persist state to local and cloud
      const persistState = Object.assign({}, newPlayerState);
      if (persistState.spellbook) {
        persistState.spellbook = Object.assign({}, persistState.spellbook);
        delete persistState.spellbook.catalog;
      }
      const key = STORAGE_INV_PREFIX + nickname.toLowerCase();
      try {
        localStorage.setItem(key, JSON.stringify(persistState));
      } catch(e) {}

      if (typeof window.fbSaveInventory === 'function') {
        window.fbSaveInventory(nickname, persistState);
      }

      closeCharacterForgeModal();

      if (forgeIsDmCreation) {
        populateDmPlayerDropdown();
        if (confirm('Player "' + nickname + '" forged! Switch to inspect their sheet now?')) {
          dmSwitchActivePlayer(nickname);
        }
      } else {
        const accounts = getStoredAccounts();
        const acc = accounts[nickname.toLowerCase()] || { nickname: nickname, role: forgeRole || 'player' };
        loginUser(acc);
        toast('⚔ Hero Forged! Welcome, ' + nickname + ' the ' + species + ' ' + charClass + '!', 4000);
      }
    }
    window.openCharacterForgeModal = openCharacterForgeModal;
    window.closeCharacterForgeModal = closeCharacterForgeModal;
    window.selectForgeClass = selectForgeClass;
    window.onForgeSpeciesChange = onForgeSpeciesChange;
    window.onForgeLevelChange = onForgeLevelChange;
    window.changeForgeStat = changeForgeStat;
    window.forgeRollStats = forgeRollStats;
    window.forgeResetClassStats = forgeResetClassStats;
    window.toggleForgeSkill = toggleForgeSkill;
    window.submitCharacterForge = submitCharacterForge;
`;

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove Gimli and Legolas buttons from Auth screen
  const oldDemoPills = `        <div class="auth-demo-pills">
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('DM', '123')">👑 DM (Master)</button>
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('Gimli', '123')">🛡️ Gimli (Player)</button>
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('Legolas', '123')">🛡️ Legolas (Player)</button>
        </div>`;

  const newDemoPills = `        <div class="auth-demo-pills">
          <button type="button" class="auth-demo-pill" onclick="quickFillAuth('DM', '123')">👑 DM (Master Vault Demo)</button>
        </div>`;

  if (content.includes(oldDemoPills)) {
    content = content.replace(oldDemoPills, newDemoPills);
    console.log('Removed Gimli & Legolas demo pills from:', filePath);
  }

  // 2. Remove Gimli & Legolas default seeds from getStoredAccounts()
  const oldAccountsSeed = `      // Seed default accounts if empty
      if (!accounts || Object.keys(accounts).length === 0) {
        accounts = {
          "dm": { nickname: "DM", password: "123", role: "dm", createdAt: 1700000000000 },
          "gimli": { nickname: "Gimli", password: "123", role: "player", createdAt: 1700000001000 },
          "legolas": { nickname: "Legolas", password: "123", role: "player", createdAt: 1700000002000 }
        };
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
        // Pre-save default states so their inventories are populated immediately
        ['dm', 'gimli', 'legolas'].forEach(nick => {
          const k = STORAGE_INV_PREFIX + nick;
          if (!localStorage.getItem(k)) {
            localStorage.setItem(k, JSON.stringify(getDefaultState(nick)));
          }
        });
      }`;

  const newAccountsSeed = `      // Seed default accounts if empty (only DM by default; players are forged)
      if (!accounts || Object.keys(accounts).length === 0) {
        accounts = {
          "dm": { nickname: "DM", password: "123", role: "dm", createdAt: 1700000000000 }
        };
        localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
        const k = STORAGE_INV_PREFIX + 'dm';
        if (!localStorage.getItem(k)) {
          localStorage.setItem(k, JSON.stringify(getDefaultState('dm')));
        }
      } else {
        // Clean up legacy demo accounts if present
        if (accounts['gimli'] && accounts['gimli'].createdAt === 1700000001000) delete accounts['gimli'];
        if (accounts['legolas'] && accounts['legolas'].createdAt === 1700000002000) delete accounts['legolas'];
      }`;

  if (content.includes(oldAccountsSeed)) {
    content = content.replace(oldAccountsSeed, newAccountsSeed);
    console.log('Removed Gimli & Legolas seed accounts in:', filePath);
  }

  // 3. Remove Gimli and Legolas branches in getDefaultState
  const oldGimliLegolasBranch = `      if (cleanName.toLowerCase() === 'gimli') {
        defaultStats.characterClass = 'Fighter';
        defaultStats.species = 'Dwarf';
        defaultStats.subrace = 'Mountain Dwarf';
        defaultStats.subclass = 'Champion';
        defaultStats.str = 18; defaultStats.con = 16; defaultStats.dex = 12; defaultStats.int = 10; defaultStats.wis = 12; defaultStats.cha = 8;
        defaultStats.ac = 16;
        defaultCurrency.gold = 145;
        defaultItems = [
          { id: 'g_item_1', name: 'Dwarven Greataxe +1', category: 'weapon', rarity: 'rare', qty: 1, weight: 7, value: 500, equipped: 'main', desc: 'A masterwork double-bladed greataxe forged in Mithral Hall. Grants +1 to attack and damage rolls.', damage: '1d12+5 Slashing', damageType: 'Slashing', proficiencyType: 'Martial' },
          { id: 'g_item_2', name: 'Dwarven Plate Armor', category: 'armor', rarity: 'veryrare', qty: 1, weight: 65, value: 1500, equipped: 'chest', desc: 'Heavy dwarven plate adorned with mountain runes.', baseAc: 18, armorType: 'Heavy' },
          { id: 'g_item_3', name: 'Ring of Protection', category: 'ring', rarity: 'rare', qty: 1, weight: 0.1, value: 800, equipped: 'ring1', attunementRequired: true, desc: 'You gain a +1 bonus to AC and saving throws while wearing this ring.' },
          { id: 'g_item_4', name: 'Potion of Greater Healing', category: 'potion', rarity: 'uncommon', qty: 3, weight: 1.5, value: 150, desc: 'A creature that drinks this potion regains 4d4 + 4 hit points.' }
        ];
      } else if (cleanName.toLowerCase() === 'legolas') {
        defaultStats.characterClass = 'Ranger';
        defaultStats.species = 'Elf';
        defaultStats.subrace = 'Wood Elf';
        defaultStats.subclass = 'Hunter';
        defaultStats.str = 12; defaultStats.con = 14; defaultStats.dex = 18; defaultStats.int = 12; defaultStats.wis = 16; defaultStats.cha = 10;
        defaultStats.ac = 15;
        defaultCurrency.gold = 95;
        defaultItems = [
          { id: 'l_item_1', name: 'Longbow of the Woodland', category: 'weapon', rarity: 'veryrare', qty: 1, weight: 2, value: 1200, equipped: 'main', desc: 'Carved from Lothlórien mallorn wood. Whispers like wind when drawn.', damage: '1d8+5 Piercing', damageType: 'Piercing', proficiencyType: 'Martial' },
          { id: 'l_item_2', name: 'Elven Studded Leather', category: 'armor', rarity: 'rare', qty: 1, weight: 13, value: 500, equipped: 'chest', desc: 'Supple elven leather armor affording silent movement.', baseAc: 12, armorType: 'Light' },
          { id: 'l_item_3', name: 'Cloak of Elvenkind', category: 'cloak', rarity: 'uncommon', qty: 1, weight: 1, value: 400, equipped: 'cloak', attunementRequired: true, desc: 'While wearing this cloak with its hood up, Wisdom (Perception) checks made to see you have disadvantage.' },
          { id: 'l_item_4', name: 'Quiver of Arrows', category: 'gear', rarity: 'common', qty: 60, weight: 3, value: 3, desc: 'Standard sharp bodkin arrows.' }
        ];
      } else if (cleanName.toLowerCase() === 'dm') {`;

  const newGimliLegolasBranch = `      if (cleanName.toLowerCase() === 'dm') {`;

  if (content.includes(oldGimliLegolasBranch)) {
    content = content.replace(oldGimliLegolasBranch, newGimliLegolasBranch);
    console.log('Removed Gimli & Legolas specific branches from getDefaultState in:', filePath);
  }

  // 4. Update handleAuthSubmit to launch Character Forge on new player registration
  const oldRegisterBlock = `      if (isRegister) {
        if (accounts[key]) {
          if (msgBox) {
            msgBox.textContent = 'Nickname already taken! Please choose another or sign in.';
            msgBox.className = 'auth-msg error';
          }
          return;
        }
        const newAccount = {
          nickname: nickname,
          password: password,
          role: role,
          createdAt: Date.now()
        };
        saveStoredAccount(newAccount);
        if (msgBox) {
          msgBox.textContent = 'Account forged! Entering realm...';
          msgBox.className = 'auth-msg success';
        }
        setTimeout(() => {
          loginUser(newAccount);
        }, 300);
      }`;

  const newRegisterBlock = `      if (isRegister) {
        if (accounts[key]) {
          if (msgBox) {
            msgBox.textContent = 'Nickname already taken! Please choose another or sign in.';
            msgBox.className = 'auth-msg error';
          }
          return;
        }
        if (role === 'player') {
          // Launch Character Generation Wizard
          openCharacterForgeModal({
            nickname: nickname,
            password: password,
            role: 'player'
          });
          return;
        }
        const newAccount = {
          nickname: nickname,
          password: password,
          role: role,
          createdAt: Date.now()
        };
        saveStoredAccount(newAccount);
        if (msgBox) {
          msgBox.textContent = 'Dungeon Master account forged! Entering realm...';
          msgBox.className = 'auth-msg success';
        }
        setTimeout(() => {
          loginUser(newAccount);
        }, 300);
      }`;

  if (content.includes(oldRegisterBlock)) {
    content = content.replace(oldRegisterBlock, newRegisterBlock);
    console.log('Updated handleAuthSubmit with Character Forge in:', filePath);
  }

  // 5. Update auth register tab button label
  const oldAuthTabSwitch = `      if (tab === 'register') {
        if (btnLogin) btnLogin.classList.remove('active');
        if (btnReg) btnReg.classList.add('active');
        if (roleGroup) roleGroup.style.display = 'block';
        if (submitBtn) submitBtn.textContent = '⚔ CREATE ACCOUNT & ENTER';
      } else {
        if (btnLogin) btnLogin.classList.add('active');
        if (btnReg) btnReg.classList.remove('active');
        if (roleGroup) roleGroup.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '⚔ ENTER REALM';
      }`;

  const newAuthTabSwitch = `      if (tab === 'register') {
        if (btnLogin) btnLogin.classList.remove('active');
        if (btnReg) btnReg.classList.add('active');
        if (roleGroup) roleGroup.style.display = 'block';
        if (submitBtn) submitBtn.textContent = '⚔ FORGE CHARACTER & ENTER';
      } else {
        if (btnLogin) btnLogin.classList.add('active');
        if (btnReg) btnReg.classList.remove('active');
        if (roleGroup) roleGroup.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '⚔ ENTER REALM';
      }`;

  if (content.includes(oldAuthTabSwitch)) {
    content = content.replace(oldAuthTabSwitch, newAuthTabSwitch);
    console.log('Updated switchAuthTab button text in:', filePath);
  }

  // 6. Add "Re-Forge Character" button in left panel Character Identity badge
  const oldIdentityBadge = `          <div style="font-size:11px; color:var(--text-dim);">\${escapeHtml(cs.species)}\${cs.subrace ? ' (' + escapeHtml(cs.subrace) + ')' : ''}</div>
        </div>
        <button class="btn ghost small" style="padding:2px 8px; font-size:11px;" onclick="event.stopPropagation(); openCharacterStatsModal();">⚙️ Edit</button>
      </div>\`;`;

  const newIdentityBadge = `          <div style="font-size:11px; color:var(--text-dim);">\${escapeHtml(cs.species)}\${cs.subrace ? ' (' + escapeHtml(cs.subrace) + ')' : ''}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn ghost small" style="padding:2px 8px; font-size:11px;" onclick="event.stopPropagation(); openCharacterStatsModal();" title="Quick edit identity">⚙️ Edit</button>
          <button class="btn small" style="padding:2px 8px; font-size:11px; background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000; font-weight:bold;" onclick="event.stopPropagation(); openCharacterForgeModal({ isEditMode: true });" title="Re-forge Class, Stats & Proficiencies">⚔ Forge</button>
        </div>
      </div>\`;`;

  if (content.includes(oldIdentityBadge)) {
    content = content.replace(oldIdentityBadge, newIdentityBadge);
    console.log('Added Re-Forge button to character identity badge in:', filePath);
  }

  // 7. Add Character Forge Modal HTML before closing body or after dm-create-player-overlay
  if (!content.includes('id="character-forge-overlay"')) {
    const dmCreateMarker = '  <!-- DM CREATE PLAYER MODAL -->';
    if (content.includes(dmCreateMarker)) {
      content = content.replace(dmCreateMarker, forgeModalHtml + '\n' + dmCreateMarker);
      console.log('Added Character Forge Modal HTML to:', filePath);
    }
  }

  // 8. Add Character Forge CSS into <style>
  if (!content.includes('.forge-modal')) {
    const styleEndMarker = '</style>';
    content = content.replace(styleEndMarker, cssToInject + '\n' + styleEndMarker);
    console.log('Added Character Forge CSS to:', filePath);
  }

  // 9. Add Character Forge JS into main script
  if (!content.includes('function openCharacterForgeModal(')) {
    const scriptAnchor = '    /* ========================================================\n       ACCOUNT AUTHENTICATION & DM INVENTORY SWITCHER LOGIC';
    content = content.replace(scriptAnchor, forgeJsLogic + '\n' + scriptAnchor);
    console.log('Added Character Forge JavaScript logic to:', filePath);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Done applying Character Forge and removing Gimli/Legolas!');
