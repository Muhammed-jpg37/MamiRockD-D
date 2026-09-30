const fs = require('fs');
try {
  const inv = fs.readFileSync('bg3-inventory.html', 'utf8');
  const m = inv.match(/<script id="spell-catalog-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    const data = JSON.parse(m[1].trim());
    console.log('Spells count in bg3-inventory.html:', data.length);
  } else {
    console.log('Not found in bg3-inventory.html');
  }
} catch (err) {
  console.error(err);
}
