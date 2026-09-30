const fs = require('fs');

function fixAllCinzelInScript(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace("font-family:'Cinzel',serif;", "font-family:Cinzel,serif;");
  content = content.replace("font-family:'Cinzel', serif;", "font-family:Cinzel, serif;");
  fs.writeFileSync(filePath, content, 'utf8');
}

fixAllCinzelInScript('bg3-inventory_13.html');
fixAllCinzelInScript('bg3-inventory.html');
