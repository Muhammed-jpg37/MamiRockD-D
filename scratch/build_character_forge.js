const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'index', 'index.html')
];

// CSS for Character Forge
const forgeCss = `
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
              <option value="Halfling">Halfling (Lucky & Brave · 25 ft)</option>
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
          <button type="button" class="btn" onclick="submitCharacterForge()" style="font-family:'Cinzel',serif; font-size:14px; font-weight:bold; background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000; box-shadow:0 0 15px rgba(234,179,8,0.4); padding:10px 22px;">✨ FORGE HERO & ENTER REALM</button>
        </div>
      </div>
    </div>
  </div>
`;

console.log('Character Forge assets ready.');
