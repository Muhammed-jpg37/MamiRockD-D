const fs = require('fs');
const path = require('path');

function fixSpellDetailZIndex(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const zIndexCss = `
/* --- OVERLAY Z-INDEX LAYER HIERARCHY --- */
#spell-catalog-overlay {
  z-index: 500 !important;
}
#max-spells-overlay,
#slot-settings-overlay,
#feature-edit-overlay,
#background-edit-overlay,
#hp-modal-overlay {
  z-index: 900 !important;
}
#spell-detail-overlay {
  z-index: 1000 !important;
}
`;

  if (!content.includes('#spell-detail-overlay {')) {
    content = content.replace('</style>', zIndexCss + '\n</style>');
  } else if (!content.includes('z-index: 1000 !important;')) {
    content = content.replace('</style>', zIndexCss + '\n</style>');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated z-index overlay hierarchy in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
fixSpellDetailZIndex(path.join(dir, 'bg3-inventory_13.html'));
fixSpellDetailZIndex(path.join(dir, 'bg3-inventory.html'));
