const fs = require('fs');
const path = require('path');

function fixOrphanHtml(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Look for the stats-settings-overlay section
  const overlayTag = 'id="stats-settings-overlay"';
  const overlayPos = content.indexOf(overlayTag);
  
  if (overlayPos === -1) {
    console.log(`No stats-settings-overlay found in ${filePath}`);
    return;
  }
  
  // Look for the duplicate orphan block after the overlay modal's closing </div> </div> </div>
  const duplicateMarker = '<div class="form-grid" style="margin-top:10px;">';
  const dupPos = content.indexOf(duplicateMarker, overlayPos);
  
  if (dupPos !== -1) {
    console.log(`Found orphan block at index ${dupPos} in ${filePath}`);
    const beforeOrphan = content.substring(0, dupPos).trimEnd();
    content = beforeOrphan + '\n\n</body>\n</html>\n';
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned orphan block in ${filePath}`);
  } else {
    console.log(`No orphan block found in ${filePath}`);
  }
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
fixOrphanHtml(path.join(dir, 'bg3-inventory_13.html'));
fixOrphanHtml(path.join(dir, 'bg3-inventory.html'));
