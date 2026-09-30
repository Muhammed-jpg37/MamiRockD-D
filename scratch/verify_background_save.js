const fs = require('fs');

function checkBackgroundSave(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'cs.characterClass = elClass.value.trim()',
    'cs.species = elSpecies.value.trim()',
    'cs.level = lvl',
    'renderCharacterStats()'
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

const ok1 = checkBackgroundSave('bg3-inventory_13.html');
const ok2 = checkBackgroundSave('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! Background & Class/Race save synchronization verified in both HTML files!');
} else {
  console.error('\nFAILED! Some components missing.');
  process.exit(1);
}
