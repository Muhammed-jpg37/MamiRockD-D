const fs = require('fs');
const vm = require('vm');

const content = fs.readFileSync('index.html', 'utf8');

// Extract all <script> contents (excluding application/json)
const scriptMatches = [...content.matchAll(/<script(?![^>]*type=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/gi)];

console.log('Found executable script tags:', scriptMatches.length);

scriptMatches.forEach((m, idx) => {
  const code = m[1];
  console.log(`Checking script #${idx + 1} (length ${code.length})...`);
  try {
    new vm.Script(code);
    console.log(`Script #${idx + 1} syntax: OK`);
  } catch (err) {
    console.error(`Script #${idx + 1} syntax ERROR:`, err.message);
  }
});
