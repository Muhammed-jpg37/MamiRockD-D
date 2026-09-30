const fs = require('fs');

function checkFile(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const idMatches = [...content.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const counts = {};
  idMatches.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const duplicates = Object.entries(counts).filter(([id, cnt]) => cnt > 1);
  console.log(`=== ${filename} ===`);
  console.log('Duplicate IDs count:', duplicates.length);
  if (duplicates.length > 0) {
    console.log('Duplicate IDs:', duplicates);
  }
}

checkFile('bg3-inventory_13.html');
checkFile('bg3-inventory.html');
