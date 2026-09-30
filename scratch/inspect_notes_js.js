const fs = require('fs');
const notesHtml = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');

const scriptMatch = notesHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
const js = scriptMatch[1];

// Find all functions
const fns = [...js.matchAll(/function\s+([a-zA-Z0-9_$]+)\s*\(/g)].map(m => m[1]);
console.log('Total functions in notes:', fns.length);
console.log('Functions:', fns);

// Find all top-level let/const/var
const topLevelVars = [...js.matchAll(/(?:let|const|var)\s+([a-zA-Z0-9_$]+)\s*=/g)].map(m => m[1]);
console.log('Top level vars in notes:', [...new Set(topLevelVars)]);
