const fs = require('fs');

function checkExternals(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  console.log('=== ' + filename + ' ===');
  const scripts = [...content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  const links = [...content.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)].map(m => m[1]);
  const imports = [...content.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/gi)].map(m => m[1]);
  console.log('Scripts:', scripts);
  console.log('Links:', links);
  console.log('Imports:', imports);
}

checkExternals('bg3-inventory.html');
checkExternals('MamiRocksPeakD&DNotSitesi.html');
