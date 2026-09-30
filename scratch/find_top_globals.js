const fs = require('fs');

const inv = fs.readFileSync('bg3-inventory.html', 'utf8');
const notes = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');

const invJs = inv.match(/<script>([\s\S]*?)<\/script>/i)[1];
const notesJs = notes.match(/<script>([\s\S]*?)<\/script>/i)[1];

function extractDeclaredGlobals(js) {
  const lines = js.split('\n');
  const vars = new Set();
  const fns = new Set();
  for (const line of lines) {
    // top level only: no leading space or very little indent
    if (/^[ \t]{0,4}(?:let|const|var)\s+([a-zA-Z0-9_$]+)/.test(line)) {
      const match = line.match(/^[ \t]{0,4}(?:let|const|var)\s+([a-zA-Z0-9_$]+)/);
      vars.add(match[1]);
    }
    if (/^[ \t]{0,4}function\s+([a-zA-Z0-9_$]+)/.test(line)) {
      const match = line.match(/^[ \t]{0,4}function\s+([a-zA-Z0-9_$]+)/);
      fns.add(match[1]);
    }
  }
  return { vars: [...vars], fns: [...fns] };
}

const invDecl = extractDeclaredGlobals(invJs);
const notesDecl = extractDeclaredGlobals(notesJs);

console.log('Inv declared globals:', invDecl);
console.log('Notes declared globals:', notesDecl);

const overlapFns = invDecl.fns.filter(f => notesDecl.fns.includes(f));
const overlapVars = invDecl.vars.filter(v => notesDecl.vars.includes(v));

console.log('Overlapping fns:', overlapFns);
console.log('Overlapping vars:', overlapVars);
