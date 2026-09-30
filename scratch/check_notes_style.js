const fs = require('fs');
const notes = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');
const styleMatch = notes.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const lines = styleMatch[1].split('\n');
console.log(lines.slice(0, 70).join('\n'));
