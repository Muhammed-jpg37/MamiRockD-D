const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'DND_Inventory_Shareable');
const cssDir = path.join(targetDir, 'css');
const jsDir = path.join(targetDir, 'js');

if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
if (!fs.existsSync(cssDir)) fs.mkdirSync(cssDir, { recursive: true });
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });

// Copy spell-catalog.json
const jsonSource = path.join(__dirname, '..', 'spell-catalog.json');
const jsonDest = path.join(targetDir, 'spell-catalog.json');
if (fs.existsSync(jsonSource)) {
  fs.copyFileSync(jsonSource, jsonDest);
  console.log('Copied spell-catalog.json');
}

// 1. Process bg3-inventory_13.html into index.html, css/styles.css, js/app.js
let invHtml = fs.readFileSync(path.join(__dirname, '..', 'bg3-inventory_13.html'), 'utf8');

// Extract CSS style tag
const cssMatch = invHtml.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/i);
let invCss = cssMatch ? cssMatch[1] : '';

// Extract JS script tag
const jsMatch = invHtml.match(/<script>([\s\S]*?)<\/script>/i);
let invJs = jsMatch ? jsMatch[1] : '';

// Clean up personal hardcoded references in HTML
let cleanInvHtml = invHtml
  .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/i, '<link rel="stylesheet" href="css/styles.css">')
  .replace(/<script>[\s\S]*?<\/script>/i, '<script src="js/app.js"></script>')
  .replace(/<h1>⚔ MAMİ ROCK ENVANTER<\/h1>/i, '<h1>⚔ D&D 5E INVENTORY & CHARACTER SHEET</h1>')
  .replace(/Party Loot \| LVL 5 BARD · HALF-ELF/g, 'Party Inventory Ledger')
  .replace(/MamiRocksPeakD&amp;DNotSitesi\.html/g, 'dnd-notes.html')
  .replace(/MamiRocksPeakD&DNotSitesi\.html/g, 'dnd-notes.html');

// Remove inline catalog tag if present at bottom
cleanInvHtml = cleanInvHtml.replace(/<script id="spell-catalog-data"[\s\S]*?<\/script>/gi, '');

// Clean up default state in invJs to be a fresh clean starting template
invJs = invJs.replace(/<h1>⚔ MAMİ ROCK ENVANTER<\/h1>/g, '<h1>⚔ D&D 5E INVENTORY & CHARACTER SHEET</h1>');
invJs = invJs.replace(/MamiRocksPeakD&amp;DNotSitesi\.html/g, 'dnd-notes.html');
invJs = invJs.replace(/MamiRocksPeakD&DNotSitesi\.html/g, 'dnd-notes.html');

// Reset default state object to fresh blank template
const defaultStateReplacement = `let state = {
  STORAGE_KEY: 'dnd_character_sheet_v1',
  campaign: 'Party Inventory Ledger',
  characterName: 'Hero',
  characterClass: 'Bard',
  characterRace: 'Human',
  characterLevel: 1,
  background: 'Entertainer',
  backgroundFeature: 'By Popular Demand',
  alignment: 'Neutral Good',
  ideals: 'I bring joy and harmony wherever I travel.',
  bonds: 'My instrument is my most prized possession.',
  flaws: 'I can rarely resist a good tavern tale.',
  currency: { platinum: 0, gold: 15, electrum: 0, silver: 0, copper: 0 },
  capacity: 150,
  hp: { current: 10, max: 10, temp: 0 },
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saveProfs: { str: false, dex: true, con: false, int: false, wis: false, cha: true },
  skillProfs: { acrobatics: true, performance: true, persuasion: true },
  proficienciesText: 'Simple weapons, Hand crossbows, Longswords, Rapiers, Shortswords, Light armor',
  weaponProfs: { simple: true, martial: false, exotic: false },
  items: [],
  selectedId: null,
  deathSaves: { open: true, successes: [false, false, false], failures: [false, false, false] },
  attunements: { open: true, slots: [null, null, null] },
  spellSlots: {
    max: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    used: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
  },
  spellbook: {
    open: true, query: '', classFilter: '', levelFilter: '', schoolFilter: '', sortBy: 'level-asc',
    catalogLoaded: false, loading: false, error: '', catalog: [], list: [],
    maxPerLevel: { 0: 2, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
  },
  features: [
    {
      id: 'f1',
      name: 'Bardic Inspiration',
      source: 'PHB, pg. 53',
      uses: 3,
      maxUses: 3,
      resetType: 'Long Rest',
      desc: 'Use a Bonus Action to inspire one creature within 60 feet.'
    }
  ],
  activeTab: 'inventory',
  theme: { customBg: '#121110', customAccent: '#eab308' }
};`;

invJs = invJs.replace(/let state = \{[\s\S]*?\n\};/, defaultStateReplacement);

// 2. Process MamiRocksPeakD&DNotSitesi.html into dnd-notes.html, css/notes.css, js/notes.js
let notesHtml = fs.readFileSync(path.join(__dirname, '..', 'MamiRocksPeakD&DNotSitesi.html'), 'utf8');

const notesCssMatch = notesHtml.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/i);
let notesCss = notesCssMatch ? notesCssMatch[1] : '';

const notesJsMatch = notesHtml.match(/<script>([\s\S]*?)<\/script>/i);
let notesJs = notesJsMatch ? notesJsMatch[1] : '';

let cleanNotesHtml = notesHtml
  .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/i, '<link rel="stylesheet" href="css/notes.css">')
  .replace(/<script>[\s\S]*?<\/script>/i, '<script src="js/notes.js"></script>')
  .replace(/bg3-inventory_13\.html/g, 'index.html')
  .replace(/bg3-inventory\.html/g, 'index.html');

notesJs = notesJs
  .replace(/bg3-inventory_13\.html/g, 'index.html')
  .replace(/bg3-inventory\.html/g, 'index.html');

// Reset notes default data to template
const defaultNotesStateReplacement = `let S = {
  cats: [
    { id: 1, name: 'Session Notes', color: '#c84b31', parentId: null, order: 0, open: true },
    { id: 2, name: 'NPCs', color: '#2c7873', parentId: null, order: 1, open: true },
    { id: 3, name: 'Locations', color: '#6e4a8b', parentId: null, order: 2, open: true },
    { id: 4, name: 'Quests', color: '#2a6080', parentId: null, order: 3, open: true },
    { id: 5, name: 'Party', color: '#c09050', parentId: null, order: 4, open: true },
    { id: 6, name: 'Allies', color: '#4a7c59', parentId: 2, order: 0, open: true },
    { id: 7, name: 'Enemies', color: '#c84b31', parentId: 2, order: 1, open: true }
  ],
  notes: [],
  activeCatId: 1,
  activeNoteId: null,
  nextCatId: 8,
  nextNoteId: 1
};`;

notesJs = notesJs.replace(/let S = \{[\s\S]*?\n\};/, defaultNotesStateReplacement);

// Write output files
fs.writeFileSync(path.join(targetDir, 'index.html'), cleanInvHtml, 'utf8');
fs.writeFileSync(path.join(cssDir, 'styles.css'), invCss, 'utf8');
fs.writeFileSync(path.join(jsDir, 'app.js'), invJs, 'utf8');

fs.writeFileSync(path.join(targetDir, 'dnd-notes.html'), cleanNotesHtml, 'utf8');
fs.writeFileSync(path.join(cssDir, 'notes.css'), notesCss, 'utf8');
fs.writeFileSync(path.join(jsDir, 'notes.js'), notesJs, 'utf8');

// Write README.md
const readmeContent = `# D&D 5e Character Sheet, Inventory & Campaign Notes System

Welcome to the D&D 5e Character Sheet & Campaign Notes suite!

## 🚀 Quick Start
1. Open \`index.html\` in any modern web browser (Chrome, Firefox, Edge, Safari).
2. Create, customize, and manage your character stats, inventory items, equipment, hit points, and spell list!
3. Click **📓 D&D Notes** in the top navigation bar to open your Campaign Notes workspace (\`dnd-notes.html\`).

## 📁 File Structure
- \`index.html\` — Main Character Sheet, Inventory & Spell System interface
- \`dnd-notes.html\` — Full-featured D&D Campaign Notes workspace with category trees, drawing canvas, and sheets
- \`spell-catalog.json\` — Complete D&D 5e Spell Database containing 1,250+ spells with full details, damage, and filters
- \`css/\` — Stylesheets for UI layout and styling
- \`js/\` — Modular JavaScript application logic

## ✨ Features
- **Character Sheet & Stats**: Customizable stats, saving throws, skills, proficiencies, class & race editing.
- **BG3-Style Inventory**: Item slots (Head, Neck, Cloak, Chest, Hands, Ring, Main Hand, Off Hand, Boots), carry capacity, item rarities, active item effects & attunements.
- **1,250+ Spell Catalog**: Prepared spell list management, spell slot tracker, level/class/school filters, and instant spell lookup.
- **HP & Temp HP Tracker**: Quick damage, healing, and temporary HP shielding with live visual bar.
- **Features & Traits**: Class features, species traits, feats, and background & alignment manager.
- **Campaign Notes**: Session notes, NPC tracking, location maps, quest logs, export/import JSON backups, and background customization.
`;

fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');
console.log('Shareable package generated successfully in DND_Inventory_Shareable!');
