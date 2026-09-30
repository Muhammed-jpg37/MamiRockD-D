const fs = require('fs');

function fixAllCinzel(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replaceAll("font-family:'Cinzel',serif;", "font-family:Cinzel,serif;");
  content = content.replaceAll("font-family:'Cinzel', serif;", "font-family:Cinzel, serif;");
  fs.writeFileSync(filePath, content, 'utf8');
}

fixAllCinzel('bg3-inventory_13.html');
fixAllCinzel('bg3-inventory.html');
