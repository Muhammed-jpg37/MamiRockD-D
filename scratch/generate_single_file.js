const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const invPath = path.join(rootDir, 'bg3-inventory.html');
const notesPath = path.join(rootDir, 'MamiRocksPeakD&DNotSitesi.html');

let invHtml = fs.readFileSync(invPath, 'utf8');
const notesHtml = fs.readFileSync(notesPath, 'utf8');

// 1. Extract Notes CSS
const notesCssMatch = notesHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
let notesCss = notesCssMatch ? notesCssMatch[1] : '';

// Replace the root/body reset in notesCss
notesCss = notesCss.replace(
  /\*,\s*\*::before,\s*\*::after\s*\{[\s\S]*?body\s*\{[\s\S]*?height:\s*100vh;\s*\}/i,
  `#notes-view-container, .modal-bg, .lightbox, .toast, .bg-panel {
  --bg: #1a1714;
  --bg2: #221f1b;
  --bg3: #2c2822;
  --bg4: #38332c;
  --surface: #2a2520;
  --border: rgba(255, 255, 255, 0.08);
  --border2: rgba(255, 255, 255, 0.14);
  --text: #e8e0d4;
  --text2: #a89880;
  --text3: #6b5e50;
  --accent: #c84b31;
  --accent2: #e06040;
  --gold: #c09050;
  --radius: 8px;
  --radius-lg: 12px;
  --theme-bg: var(--bg);
  --theme-bg2: var(--bg2);
  --theme-bg3: var(--bg3);
  --theme-bg4: var(--bg4);
  --theme-surface: var(--surface);
}

#notes-view-container {
  display: none;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - 120px);
  min-height: 650px;
  position: relative;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  margin-top: 10px;
}

#notes-view-container.fullscreen-notes {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  margin: 0 !important;
  z-index: 2000 !important;
  border-radius: 0 !important;
  border: none !important;
}

#notes-view-container *,
#notes-view-container *::before,
#notes-view-container *::after {
  box-sizing: border-box;
}

#notes-view-container #bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: background-color .3s;
}`
);

// 2. Extract Notes Body Markup
const notesBodyOpen = notesHtml.indexOf('<body');
const notesBodyStart = notesHtml.indexOf('>', notesBodyOpen) + 1;
const notesScriptOpen = notesHtml.indexOf('<script', notesBodyStart);
let notesBodyMarkup = notesHtml.slice(notesBodyStart, notesScriptOpen).trim();

// Wrap notes markup in #notes-view-container
// Also add the fullscreen button to titlebar
notesBodyMarkup = notesBodyMarkup.replace(
  /<button class="tbarbtn" onclick="goToCharacterScreen\(\)"[\s\S]*?<\/button>/i,
  `<button class="tbarbtn" onclick="switchMainTab('inventory')"
      style="font-weight:bold; color:var(--gold); border-color:var(--gold); margin-right:8px;"
      title="Return to Character Inventory & Spells Screen">🎒 Character Screen</button>
    <button class="tbarbtn" onclick="toggleNotesFullscreen()" id="notes-fs-btn"
      style="color:var(--gold); border-color:var(--border2); margin-right:8px;"
      title="Toggle Fullscreen Notes Workspace">⛶ Fullscreen</button>`
);

const notesContainerHtml = `
    <!-- D&D CAMPAIGN NOTES WORKSPACE -->
    <div id="notes-view-container">
${notesBodyMarkup}
    </div>
`;

// 3. Extract Notes JS
const notesScriptMatch = notesHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
let notesJs = notesScriptMatch ? notesScriptMatch[1] : '';

// Rename save to saveNotes
notesJs = notesJs.replace(/\bsave\s*\(/g, 'saveNotes(');

// Update applyNotesTheme
notesJs = notesJs.replace(/function\s+applyTheme\s*\(\)/g, 'function applyNotesTheme()');
notesJs = notesJs.replace(/\bapplyTheme\s*\(/g, 'applyNotesTheme(');
notesJs = notesJs.replace(
  /function applyNotesTheme\(\)\s*\{[\s\S]*?\n    \}/,
  `function applyNotesTheme() {
      const root = document.getElementById('notes-view-container') || document.documentElement;
      root.style.setProperty('--bg', BG.color);
      root.style.setProperty('--bg2', BG.bg2);
      root.style.setProperty('--bg3', BG.bg3);
      root.style.setProperty('--bg4', BG.bg4);
      root.style.setProperty('--surface', BG.surface);
    }`
);

// Update goToCharacterScreen
notesJs = notesJs.replace(
  /function goToCharacterScreen\(\)\s*\{[\s\S]*?\n    \}/,
  `function goToCharacterScreen() {
      switchMainTab('inventory');
    }`
);

// Add toggleNotesFullscreen
const toggleFullscreenFn = `
    function toggleNotesFullscreen() {
      const c = document.getElementById('notes-view-container');
      const btn = document.getElementById('notes-fs-btn');
      if (!c) return;
      const isFs = c.classList.toggle('fullscreen-notes');
      if (btn) btn.textContent = isFs ? '⛶ Exit Fullscreen' : '⛶ Fullscreen';
      if (typeof currentView !== 'undefined' && currentView === 'draw') {
        setTimeout(() => { if (typeof setupCanvas === 'function') setupCanvas(); if (typeof loadCanvas === 'function') loadCanvas(); }, 50);
      }
    }
`;

// Guard initialization of notes app
notesJs = notesJs.replace(
  /buildDrawControls\(\);[\s\S]*?render\(\);[\s\S]*?applyBg\(\);/,
  `let notesInitialized = false;
    function initNotesOnce() {
      if (notesInitialized) return;
      notesInitialized = true;
      buildDrawControls();
      render();
      applyBg();
    }
    window.addEventListener('DOMContentLoaded', () => {
      initNotesOnce();
    });`
);

// 4. Update bg3-inventory HTML:
// Update title
invHtml = invHtml.replace(
  /<title>.*?<\/title>/i,
  '<title>⚔ MAMİ ROCK D&D - Character Sheet, Inventory, Spells & Campaign Notes</title>'
);

// Add Notes CSS into the existing <style> tag
invHtml = invHtml.replace(
  '</style>',
  `\n/* ========================================================\n   D&D CAMPAIGN NOTES WORKSPACE STYLES\n   ======================================================== */\n${notesCss}\n</style>`
);

// Update tab buttons to handle switchMainTab('notes')
invHtml = invHtml.replace(
  /<button class="nav-tab-btn" id="tab-btn-notes"[\s\S]*?<\/button>/i,
  '<button class="nav-tab-btn" id="tab-btn-notes" onclick="switchMainTab(\'notes\')">📓 D&D Notes</button>'
);

// Insert #notes-view-container inside .frame right after #features-view-container
const featuresEndIdx = invHtml.indexOf('</div>\n\n    </div>\n\n  </div>\n\n  <!-- Add/Edit Item Modal -->');
if (featuresEndIdx !== -1) {
  // Let's find exact end of features container
  console.log('Found features end pattern 1');
}

// More reliable: insert right after id="features-view-container" closing div
const featIdx = invHtml.indexOf('id="features-view-container"');
if (featIdx === -1) {
  throw new Error('features-view-container not found!');
}
const featDivStart = invHtml.lastIndexOf('<div', featIdx);

// Find the closing </div> of features-view-container
let openCount = 0;
let pos = featDivStart;
let featCloseIdx = -1;
while (pos < invHtml.length) {
  const nextOpen = invHtml.indexOf('<div', pos);
  const nextClose = invHtml.indexOf('</div>', pos);
  if (nextClose === -1) break;
  if (nextOpen !== -1 && nextOpen < nextClose) {
    openCount++;
    pos = nextOpen + 4;
  } else {
    openCount--;
    if (openCount === 0) {
      featCloseIdx = nextClose + 6;
      break;
    }
    pos = nextClose + 6;
  }
}

if (featCloseIdx === -1) {
  throw new Error('Could not find closing tag for features-view-container');
}

invHtml = invHtml.slice(0, featCloseIdx) + '\n' + notesContainerHtml + invHtml.slice(featCloseIdx);

// 5. Update switchMainTab in inventory JS
const oldSwitchMainTabRegex = /function switchMainTab\(tabName\) \{[\s\S]*?\n    \}/;
const newSwitchMainTab = `function switchMainTab(tabName) {
      if (!tabName) tabName = 'inventory';
      state.activeTab = tabName;
      const invView = document.getElementById('inventory-view-container');
      const spellView = document.getElementById('spellbook-view-container');
      const featuresView = document.getElementById('features-view-container');
      const notesView = document.getElementById('notes-view-container');
      const btnInv = document.getElementById('tab-btn-inventory');
      const btnSpell = document.getElementById('tab-btn-spells');
      const btnFeatures = document.getElementById('tab-btn-features');
      const btnNotes = document.getElementById('tab-btn-notes');

      if (invView) invView.style.display = (tabName === 'inventory') ? 'grid' : 'none';
      if (spellView) spellView.style.display = (tabName === 'spells') ? 'block' : 'none';
      if (featuresView) featuresView.style.display = (tabName === 'features') ? 'block' : 'none';
      if (notesView) notesView.style.display = (tabName === 'notes') ? 'flex' : 'none';

      if (btnInv) btnInv.classList.toggle('active', tabName === 'inventory');
      if (btnSpell) btnSpell.classList.toggle('active', tabName === 'spells');
      if (btnFeatures) btnFeatures.classList.toggle('active', tabName === 'features');
      if (btnNotes) btnNotes.classList.toggle('active', tabName === 'notes');

      if (tabName === 'spells') {
        state.spellbook.open = true;
        renderSpellbookMenu();
      } else if (tabName === 'features') {
        renderFeaturesView();
      } else if (tabName === 'notes') {
        if (typeof initNotesOnce === 'function') initNotesOnce();
        if (typeof render === 'function') render();
        if (typeof applyBg === 'function') applyBg();
      }
      save();
    }`;

invHtml = invHtml.replace(oldSwitchMainTabRegex, newSwitchMainTab);

// 6. Append Notes JS into <script> block
invHtml = invHtml.replace(
  '</script>\n  <script id="spell-catalog-data"',
  `\n/* ========================================================\n   D&D CAMPAIGN NOTES WORKSPACE SCRIPTS\n   ======================================================== */\n${toggleFullscreenFn}\n${notesJs}\n  </script>\n  <script id="spell-catalog-data"`
);

// 7. Write the unified standalone single files!
const outputSinglePath = path.join(rootDir, 'MamiRockD&D.html');
const outputIndexPath = path.join(rootDir, 'index.html');

fs.writeFileSync(outputSinglePath, invHtml, 'utf8');
fs.writeFileSync(outputIndexPath, invHtml, 'utf8');

console.log('Successfully generated:');
console.log(' - ' + outputSinglePath + ' (' + (fs.statSync(outputSinglePath).size / 1024).toFixed(1) + ' KB)');
console.log(' - ' + outputIndexPath + ' (' + (fs.statSync(outputIndexPath).size / 1024).toFixed(1) + ' KB)');
