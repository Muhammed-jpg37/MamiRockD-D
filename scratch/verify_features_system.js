const fs = require('fs');

function checkFeaturesSystem(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const checks = [
    'id="tab-btn-features"',
    'id="features-view-container"',
    'id="feature-edit-overlay"',
    'id="background-edit-overlay"',
    'function renderFeaturesView()',
    'function filterFeaturesTab(tab)',
    'function openAddFeatureModal()',
    'function editFeatureItem(id)',
    'function deleteFeatureItem(id)',
    'function saveFeatureItem()',
    'function openEditBackgroundModal()',
    'function saveBackgroundInfo()'
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

const ok1 = checkFeaturesSystem('bg3-inventory_13.html');
const ok2 = checkFeaturesSystem('bg3-inventory.html');

if (ok1 && ok2) {
  console.log('\nSUCCESS! All Features & Traits System components verified in both HTML files!');
} else {
  console.error('\nFAILED! Some components missing.');
  process.exit(1);
}
