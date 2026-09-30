const fs = require('fs');
const notesHtml = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');

const scriptMatch = notesHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
const js = scriptMatch[1];

// Find occurrences of save( and applyTheme(
const saveMatches = [...js.matchAll(/\bsave\s*\(/g)];
console.log('Occurrences of save(:', saveMatches.length);

const applyThemeMatches = [...js.matchAll(/\bapplyTheme\s*\(/g)];
console.log('Occurrences of applyTheme(:', applyThemeMatches.length);
