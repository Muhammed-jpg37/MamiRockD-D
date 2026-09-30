const fs = require('fs');
const notesHtml = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');

const m = notesHtml.match(/function switchView[\s\S]*?function setupCanvas[\s\S]*?\n    \}/);
console.log(m ? m[0] : 'not found');
