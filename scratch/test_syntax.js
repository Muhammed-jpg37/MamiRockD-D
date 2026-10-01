const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

// Find regular script tags (not type="module" or type="application/json")
const regex = /<script(?:\s+id="[^"]*")?>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = regex.exec(html)) !== null) {
  count++;
  const code = match[1];
  try {
    new vm.Script(code);
    console.log(`Script block #${count}: Syntax VALID! (length: ${code.length})`);
  } catch (err) {
    console.error(`Script block #${count}: SYNTAX ERROR:`, err.message);
    if (err.stack) console.error(err.stack);
  }
}
