const fs = require('fs');

const content = fs.readFileSync('bg3-inventory_13.html', 'utf8');

// Simple validation that all necessary functions and elements are defined in HTML
const checks = [
  'id="f-prof-type-row"',
  'id="f-prof-type"',
  'function toggleProfTypeRow()',
  'function isProficientWithWeapon(item)',
  'id="st-wp-simple"',
  'id="st-wp-martial"',
  'id="st-wp-exotic"',
  'profSimple',
  'profMartial',
  'profExotic',
  '✨ Proficient',
  '⚠️ Not Proficient'
];

let allPassed = true;
checks.forEach(chk => {
  const exists = content.includes(chk);
  console.log(`Checking "${chk}": ${exists ? 'OK' : 'MISSING'}`);
  if (!exists) allPassed = false;
});

if (allPassed) {
  console.log('\nAll Weapon Proficiency System components verified successfully in bg3-inventory_13.html!');
} else {
  console.log('\nSome components are missing!');
  process.exit(1);
}
