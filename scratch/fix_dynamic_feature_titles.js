const fs = require('fs');
const path = require('path');

function updateDynamicFeatureTitles(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace grouping title logic in renderFeaturesView
  const oldGroupingCode = `// Group items by Section Title
  const groups = {};
  filteredItems.forEach(function(item){
    const grpTitle = item.title || (item.category === 'CLASS' ? 'Class Features' : item.category === 'SPECIES' ? 'Species Traits' : 'Feats');
    if(!groups[grpTitle]) groups[grpTitle] = [];
    groups[grpTitle].push(item);
  });`;

  const newGroupingCode = `// Group items by Section Title dynamically matching active Class & Species
  const cs = state.characterStats || {};
  const currentClass = cs.characterClass || 'Bard';
  const currentSpecies = cs.species || 'Half-Elf';

  const groups = {};
  filteredItems.forEach(function(item){
    let grpTitle = item.title || '';
    if(item.category === 'CLASS' || grpTitle.includes('Features') || grpTitle === 'Bard Features'){
      grpTitle = currentClass.toUpperCase() + ' FEATURES';
    } else if(item.category === 'SPECIES' || grpTitle.includes('Traits') || grpTitle === 'Half-Elf Traits'){
      grpTitle = currentSpecies.toUpperCase() + ' TRAITS';
    } else if(item.category === 'FEATS' || grpTitle === 'Feats'){
      grpTitle = 'FEATS';
    }
    if(!grpTitle) grpTitle = 'FEATURES & TRAITS';
    if(!groups[grpTitle]) groups[grpTitle] = [];
    groups[grpTitle].push(item);
  });`;

  if (content.includes(oldGroupingCode)) {
    content = content.replace(oldGroupingCode, newGroupingCode);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated dynamic feature titles in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
updateDynamicFeatureTitles(path.join(dir, 'bg3-inventory_13.html'));
updateDynamicFeatureTitles(path.join(dir, 'bg3-inventory.html'));
