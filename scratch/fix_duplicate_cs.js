const fs = require('fs');

function fixDuplicateCs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const oldCode = `  // Group items by Section Title dynamically matching active Class & Species
  const cs = state.characterStats || {};
  const currentClass = cs.characterClass || 'Bard';
  const currentSpecies = cs.species || 'Half-Elf';`;

  const newCode = `  // Group items by Section Title dynamically matching active Class & Species
  const currentClass = (cs && cs.characterClass) ? cs.characterClass : 'Bard';
  const currentSpecies = (cs && cs.species) ? cs.species : 'Half-Elf';`;

  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf8');
}

fixDuplicateCs('bg3-inventory_13.html');
fixDuplicateCs('bg3-inventory.html');
