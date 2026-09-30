const fs = require('fs');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const bodyOpen = inv.indexOf('<body>');
const lines = inv.slice(bodyOpen, bodyOpen + 5000).split('\n');
console.log(lines.slice(0, 50).join('\n'));
