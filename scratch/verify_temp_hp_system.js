const fs = require('fs');

function checkTempHpSystem(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'quickAddTempHP',
    'setTempHP',
    '🛡️ +Temp',
    'hp-temp-bar-fill',
    '🛡️ +5',
    '🛡️ +10',
    '🛡️ +15',
    '🚫 Clear'
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

const ok1 = checkTempHpSystem('bg3-inventory_13.html');
const ok2 = checkTempHpSystem('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! All Temporary HP System components verified in both HTML files!');
} else {
  console.error('\nFAILED! Some components missing.');
  process.exit(1);
}
