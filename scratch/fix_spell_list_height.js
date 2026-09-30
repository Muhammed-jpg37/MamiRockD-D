const fs = require('fs');
const path = require('path');

function updateSpellListHeightCSS(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace legacy short height CSS rules
  const targetBlock = `.spell-catalog {
  max-height: 130px !important;
  overflow-y: auto !important;
}
.spell-list {
  max-height: 90px !important;
  overflow-y: auto !important;
}`;

  const replacementBlock = `/* --- EXPANDED SPELL LIST HEIGHT --- */
.spell-catalog {
  max-height: calc(80vh - 160px) !important;
  min-height: 400px !important;
  overflow-y: auto !important;
}
.spell-list {
  max-height: calc(80vh - 180px) !important;
  min-height: 480px !important;
  overflow-y: auto !important;
  padding: 6px !important;
}
.spell-list-item {
  padding: 10px 14px !important;
  margin-bottom: 6px !important;
}
.spell-list-item .spell-name {
  font-size: 14px !important;
  font-weight: 700 !important;
}`;

  if (content.includes(targetBlock)) {
    content = content.replace(targetBlock, replacementBlock);
  } else {
    // If exact block formatting differs slightly, replace matching lines
    content = content.replace(/\.spell-catalog\s*\{\s*max-height:\s*130px[^}]+\}/g, '');
    content = content.replace(/\.spell-list\s*\{\s*max-height:\s*90px[^}]+\}/g, replacementBlock);
  }

  // Also clean up any earlier .spell-list { max-height: 150px !important; } or 300px
  content = content.replace(/\.spell-list\s*\{\s*max-height:\s*150px\s*!important;\s*overflow-y:\s*auto\s*!important;\s*\}/g, '');
  content = content.replace(/\.spell-list\s*\{\s*max-height:\s*300px\s*!important;\s*overflow-y:\s*auto;\s*\}/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated spell list height CSS in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
updateSpellListHeightCSS(path.join(dir, 'bg3-inventory_13.html'));
updateSpellListHeightCSS(path.join(dir, 'bg3-inventory.html'));
