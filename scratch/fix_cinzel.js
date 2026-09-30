const fs = require('fs');

function fixCinzelQuote(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace("font-family:'Cinzel',serif;", "font-family:Cinzel,serif;");
  fs.writeFileSync(filePath, content, 'utf8');
}

fixCinzelQuote('bg3-inventory_13.html');
fixCinzelQuote('bg3-inventory.html');
