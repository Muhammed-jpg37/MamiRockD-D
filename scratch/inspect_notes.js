const fs = require('fs');
const content = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');

const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);

console.log('Style length:', styleMatch ? styleMatch[1].length : 0);
console.log('Body length:', bodyMatch ? bodyMatch[1].length : 0);
console.log('Script length:', scriptMatch ? scriptMatch[1].length : 0);

// Check if any IDs or classes collide with bg3-inventory
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const idRegex = /id=["']([^"']+)["']/g;
const notesIds = new Set([...content.matchAll(idRegex)].map(m => m[1]));
const invIds = new Set([...inv.matchAll(idRegex)].map(m => m[1]));

const collidingIds = [...notesIds].filter(id => invIds.has(id));
console.log('Colliding IDs:', collidingIds);
