const fs = require('fs');
const notes = fs.readFileSync('MamiRocksPeakD&DNotSitesi.html', 'utf8');
const style = notes.match(/<style[^>]*>([\s\S]*?)<\/style>/i)[1];

['lightbox', 'modal', 'bg-panel', 'toast'].forEach(term => {
  const regex = new RegExp('[^}]*?' + term + '[^}]*?\\{[^}]*?\\}', 'gi');
  const matches = style.match(regex);
  console.log('=== Matches for ' + term + ' ===');
  if (matches) {
    matches.forEach(m => console.log(m.trim()));
  }
});
