const fs = require('fs');

function checkSpellSystem(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'id="spell-catalog-overlay"',
    'openSpellCatalogModal()',
    'closeSpellCatalogModal()',
    'updateMySpellsSearch',
    'id="my-spells-search"',
    '📜 + Browse & Add Spells',
    '📖 My Spell List',
    '✓ Added',
    '+ Add'
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

const ok1 = checkSpellSystem('bg3-inventory_13.html');
const ok2 = checkSpellSystem('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! All spell system components verified in both HTML files!');
} else {
  console.error('\nFAILED! Some components missing.');
  process.exit(1);
}
