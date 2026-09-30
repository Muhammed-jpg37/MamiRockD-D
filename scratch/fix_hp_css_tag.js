const fs = require('fs');
const path = require('path');

function fixHpCssTag(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Look for the raw CSS text sitting between </style> and <head> or </head>
  const unescapedMarker = '/* --- HP TRACKER WIDGET STYLES --- */';
  if (content.includes(unescapedMarker)) {
    // Replace unescaped marker block with wrapped <style> block
    content = content.replace(
      '</style>\n  <script src="spell-catalog.js"></script>\n\n/* --- HP TRACKER WIDGET STYLES --- */',
      '/* --- HP TRACKER WIDGET STYLES --- */'
    );

    // Now insert it cleanly inside the main <style> block before </style>
    if (!content.includes('.hp-pill {')) {
      const hpCss = `
/* --- HP TRACKER WIDGET STYLES --- */
.hp-pill {
  min-width: 180px;
  background: var(--panel-2);
  border: 1px solid var(--border-bright);
  border-radius: 8px;
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  user-select: none;
  transition: border-color 0.2s ease;
}
.hp-pill:hover {
  border-color: var(--gold-bright);
}
.hp-btn {
  border: none;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.hp-btn.dmg {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid #ef4444;
}
.hp-btn.dmg:hover {
  background: #ef4444;
  color: #ffffff;
}
.hp-btn.heal {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid #22c55e;
}
.hp-btn.heal:hover {
  background: #22c55e;
  color: #ffffff;
}
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
      content = content.replace('</style>', hpCss + '\n</style>');
    }
  }

  // Also verify no orphaned CSS sitting outside <style>
  const orphanPos = content.indexOf('/* --- HP TRACKER WIDGET STYLES --- */');
  const styleEndPos = content.indexOf('</style>');
  
  if (orphanPos > styleEndPos) {
    // If it's still after </style>, wrap it in <style>...</style>
    const styleCloseIdx = content.indexOf('</style>', orphanPos);
    if (styleCloseIdx === -1) {
      // Find the end of this block
      const pointerEventsIdx = content.indexOf('pointer-events: none;\n}', orphanPos);
      if (pointerEventsIdx !== -1) {
        const blockEnd = pointerEventsIdx + 'pointer-events: none;\n}'.length;
        const cssBlock = content.substring(orphanPos, blockEnd);
        content = content.substring(0, orphanPos) + '<style>\n' + cssBlock + '\n</style>\n' + content.substring(blockEnd);
      }
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned up HP CSS tags in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
fixHpCssTag(path.join(dir, 'bg3-inventory_13.html'));
fixHpCssTag(path.join(dir, 'bg3-inventory.html'));
