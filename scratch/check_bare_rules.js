const fs = require('fs');

const notes = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const notesCss = notes.match(/<style[^>]*>([\s\S]*?)<\/style>/i)[1];

// Find all CSS selector groups in notesCss
const ruleMatches = [...notesCss.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim());

console.log('Total CSS selector groups in notes:', ruleMatches.length);

// Check if any match bare tags like h1, button, input without prefix
const bareTagRules = ruleMatches.filter(r => {
  return /^(h1|h2|h3|p|button|input|textarea|select|table|th|td)\b/.test(r);
});

console.log('Bare tag rules in notesCss:', bareTagRules);
