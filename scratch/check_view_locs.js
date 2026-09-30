const fs = require('fs');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const bodyOpen = inv.indexOf('<body>');
const scriptOpen = inv.indexOf('<script>');
const html = inv.slice(bodyOpen, scriptOpen);

console.log('Location of view containers:');
console.log('inventory-view-container:', html.indexOf('id="inventory-view-container"'));
console.log('spellbook-view-container:', html.indexOf('id="spellbook-view-container"'));
console.log('features-view-container:', html.indexOf('id="features-view-container"'));
console.log('Last closing div tags in html:');
console.log(html.slice(html.lastIndexOf('</div>') - 200));
