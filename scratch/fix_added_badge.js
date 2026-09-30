const fs = require('fs');

function updateCatalogAddBadge(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace button rendering in catalog list
  const targetStr = `(inList ? 'Remove' : '+ Add')`;
  const replacementStr = `(inList ? '✓ Added' : '+ Add')`;

  content = content.replaceAll(targetStr, replacementStr);
  fs.writeFileSync(filePath, content, 'utf8');
}

updateCatalogAddBadge('bg3-inventory_13.html');
updateCatalogAddBadge('bg3-inventory.html');
