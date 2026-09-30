const fs = require('fs');
const path = require('path');

const invHtml = fs.readFileSync(path.join(__dirname, '..', 'bg3-inventory.html'), 'utf8');
const notesHtml = fs.readFileSync(path.join(__dirname, '..', 'MamiRocksPeakD&DNotSitesi.html'), 'utf8');

// 1. Extract Notes CSS
const notesCssMatch = notesHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
let notesCss = notesCssMatch ? notesCssMatch[1] : '';

// 2. Extract Notes Body HTML (excluding script)
const notesBodyOpen = notesHtml.indexOf('<body');
const notesBodyStart = notesHtml.indexOf('>', notesBodyOpen) + 1;
const notesScriptOpen = notesHtml.indexOf('<script', notesBodyStart);
let notesBodyMarkup = notesHtml.slice(notesBodyStart, notesScriptOpen).trim();

// 3. Extract Notes JS
const notesScriptMatch = notesHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
let notesJs = notesScriptMatch ? notesScriptMatch[1] : '';

// Modify notesJs:
// Rename save() to saveNotes()
// Replace occurrences of \bsave\s*\( with saveNotes(
notesJs = notesJs.replace(/\bsave\s*\(/g, 'saveNotes(');
// Rename function saveNotes to function saveNotes
// Replace applyTheme() with applyNotesTheme()
notesJs = notesJs.replace(/function\s+applyTheme\s*\(\)/g, 'function applyNotesTheme()');
notesJs = notesJs.replace(/\bapplyTheme\s*\(/g, 'applyNotesTheme(');

// Update applyNotesTheme implementation to target #notes-view-container
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

// Update goToCharacterScreen to call switchMainTab('inventory')
notesJs = notesJs.replace(
  /function goToCharacterScreen\(\)\s*\{[\s\S]*?\n    \}/,
  `function goToCharacterScreen() {
      switchMainTab('inventory');
    }`
);

// Add initNotesOnce guard so buildDrawControls is only called once
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
    // Also init on window load
    window.addEventListener('DOMContentLoaded', () => {
      initNotesOnce();
    });`
);

console.log('Processed notes JS successfully.');
