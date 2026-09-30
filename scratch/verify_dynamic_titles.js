const fs = require('fs');

function testDynamicTitles(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'currentClass.toUpperCase() + \' FEATURES\'',
    'currentSpecies.toUpperCase() + \' TRAITS\'',
    'function renderFeaturesView()'
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

const ok1 = testDynamicTitles('bg3-inventory_13.html');
const ok2 = testDynamicTitles('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! Dynamic feature section titles verified in both HTML files!');
} else {
  console.error('\nFAILED! Some checks failed.');
  process.exit(1);
}
