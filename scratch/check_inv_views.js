const fs = require('fs');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const bodyOpen = inv.indexOf('<body');
const scriptOpen = inv.indexOf('<script>');
console.log('Body start to script start:');
const html = inv.slice(bodyOpen, scriptOpen);
console.log('HTML length in inv:', html.length);

// Extract top-level elements inside body
const containerMatches = [...html.matchAll(/id=["']([a-zA-Z0-9_\-]+view[a-zA-Z0-9_\-]*)["']/gi)].map(m => m[1]);
console.log('View containers in inv:', containerMatches);
