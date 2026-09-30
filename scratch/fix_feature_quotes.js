const fs = require('fs');

function fixFeatureQuotes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace invalid quote escaping in JS script block for features
  content = content.replaceAll(
    `onclick="toggleFeatureUse('' + f.id + '', ' + u + ')"`,
    `onclick="toggleFeatureUse('\\'' + f.id + '\\'', ' + u + ')"`
  );
  content = content.replaceAll(
    `onclick="editFeatureItem('' + f.id + '')"`,
    `onclick="editFeatureItem('\\'' + f.id + '\\'')" `
  );
  content = content.replaceAll(
    `onclick="deleteFeatureItem('' + f.id + '')"`,
    `onclick="deleteFeatureItem('\\'' + f.id + '\\'')" `
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

fixFeatureQuotes('bg3-inventory_13.html');
fixFeatureQuotes('bg3-inventory.html');
