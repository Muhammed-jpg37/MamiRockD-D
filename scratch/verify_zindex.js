const fs = require('fs');

function checkOverlayZIndex(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    '#spell-detail-overlay',
    'z-index: 1000 !important;',
    '#spell-catalog-overlay',
    'z-index: 500 !important;'
  ];

  console.log(`=== Checking ${filePath} ===`);
  let allOk = true;
  checks.forEach(chk => {
    const found = content.includes(chk);
    console.log(`- "${chk}": ${found ? 'OK' : 'MISSING'}`);
    if (!found) allOk = false;
  });
  return allOk;
}

const ok1 = checkOverlayZIndex('bg3-inventory_13.html');
const ok2 = checkOverlayZIndex('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! Overlay z-index hierarchy verified in both HTML files!');
} else {
  console.error('\nFAILED! Some z-index rules missing.');
  process.exit(1);
}
