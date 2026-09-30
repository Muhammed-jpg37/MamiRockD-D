const fs = require('fs');
const inv = fs.readFileSync('bg3-inventory.html', 'utf8');

const frameStart = inv.indexOf('<div class="frame">');
// find where frame closes
let openDivs = 0;
let pos = frameStart;
while (pos < inv.length) {
  const nextOpen = inv.indexOf('<div', pos);
  const nextClose = inv.indexOf('</div>', pos);
  if (nextClose === -1) break;
  if (nextOpen !== -1 && nextOpen < nextClose) {
    openDivs++;
    pos = nextOpen + 4;
  } else {
    openDivs--;
    if (openDivs === 0) {
      console.log('Frame closes at index:', nextClose);
      console.log('Context around frame close:\n', inv.slice(nextClose - 100, nextClose + 100));
      break;
    }
    pos = nextClose + 6;
  }
}
