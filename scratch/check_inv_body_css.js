const fs = require('fs');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const m = inv.match(/body\s*\{[^}]+\}/g);
console.log(m);
