const fs = require('fs');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');
const notes = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');

const invState = inv.match(/let state = \{[\s\S]*?\n    \};/);
const notesState = notes.match(/let S = \{[\s\S]*?\n    \};/);

console.log('Inv default state snippet:\n', invState ? invState[0].slice(0, 300) : 'not found');
console.log('Notes default state snippet:\n', notesState ? notesState[0].slice(0, 300) : 'not found');
