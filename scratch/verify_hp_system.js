const fs = require('fs');

function checkHpSystem(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'id="hp-pill"',
    'id="hp-modal-overlay"',
    'function renderHpTracker()',
    'function applyHpChange(amount)',
    'function quickDamageHP',
    'function quickHealHP',
    'function quickEditCurrentHP',
    'function quickEditMaxHP',
    'function fullHealHP()',
    'function openHpQuickModal'
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

const ok1 = checkHpSystem('bg3-inventory_13.html');
const ok2 = checkHpSystem('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! All HP Tracking System components verified in both HTML files!');
} else {
  console.error('\nFAILED! Some components missing.');
  process.exit(1);
}
