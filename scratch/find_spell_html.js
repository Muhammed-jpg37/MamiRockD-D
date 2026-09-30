const fs = require('fs');

const content = fs.readFileSync('bg3-inventory_13.html', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.toLowerCase().includes('spell') && (l.includes('<section') || l.includes('<div class="panel') || l.includes('id='))) {
    console.log(`Line ${i+1}: ${l.substring(0, 120)}`);
  }
});
