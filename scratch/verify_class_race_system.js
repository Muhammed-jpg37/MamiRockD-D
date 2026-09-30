const fs = require('fs');

function checkClassRaceSystem(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'id="st-class"',
    'id="st-subclass"',
    'id="st-level"',
    'id="st-species"',
    'id="st-subrace"',
    'id="bg-class"',
    'id="bg-species"',
    'id="bg-level"',
    'function autoCalcProfBonusFromLevel()',
    'characterClass',
    'species'
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

const ok1 = checkClassRaceSystem('bg3-inventory_13.html');
const ok2 = checkClassRaceSystem('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! All Class & Race System components verified in both HTML files!');
} else {
  console.error('\nFAILED! Some components missing.');
  process.exit(1);
}
