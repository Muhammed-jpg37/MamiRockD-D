const fs = require('fs');
const path = require('path');

function fixBackgroundModalSync(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const oldOpenModal = `function openEditBackgroundModal(){
  initDefaultFeatures();
  const bg = state.features.backgroundInfo || {};
  const cs = state.characterStats || {};
  if(document.getElementById('bg-class')) document.getElementById('bg-class').value = cs.characterClass || 'Bard';
  if(document.getElementById('bg-species')) document.getElementById('bg-species').value = cs.species || 'Half-Elf';
  if(document.getElementById('bg-level')) document.getElementById('bg-level').value = cs.level || 5;
  document.getElementById('bg-name').value = bg.name || '';
  document.getElementById('bg-feature').value = bg.featureName || '';
  document.getElementById('bg-alignment').value = bg.alignment || '';
  document.getElementById('bg-ideals').value = bg.ideals || '';
  document.getElementById('bg-bonds').value = bg.bonds || '';
  document.getElementById('bg-flaws').value = bg.flaws || '';

  const overlay = document.getElementById('background-edit-overlay');
  if(overlay) overlay.classList.add('open');
}`;

  const newOpenModal = `function openEditBackgroundModal(){
  initDefaultFeatures();
  const bg = state.features.backgroundInfo || {};
  const cs = state.characterStats || {};

  const elClass = document.getElementById('bg-class');
  if(elClass) elClass.value = cs.characterClass || 'Bard';

  const elSpecies = document.getElementById('bg-species');
  if(elSpecies) elSpecies.value = cs.species || 'Half-Elf';

  const elLevel = document.getElementById('bg-level');
  if(elLevel) elLevel.value = cs.level || 5;

  document.getElementById('bg-name').value = bg.name || '';
  document.getElementById('bg-feature').value = bg.featureName || '';
  document.getElementById('bg-alignment').value = bg.alignment || '';
  document.getElementById('bg-ideals').value = bg.ideals || '';
  document.getElementById('bg-bonds').value = bg.bonds || '';
  document.getElementById('bg-flaws').value = bg.flaws || '';

  const overlay = document.getElementById('background-edit-overlay');
  if(overlay) overlay.classList.add('open');
}`;

  const oldSaveFunc = `function saveBackgroundInfo(){
  initDefaultFeatures();
  state.features.backgroundInfo = {
    name: document.getElementById('bg-name').value.trim(),
    featureName: document.getElementById('bg-feature').value.trim(),
    alignment: document.getElementById('bg-alignment').value.trim(),
    ideals: document.getElementById('bg-ideals').value.trim(),
    bonds: document.getElementById('bg-bonds').value.trim(),
    flaws: document.getElementById('bg-flaws').value.trim()
  };
  save();
  closeBackgroundModal();
  renderFeaturesView();
}`;

  const newSaveFunc = `function saveBackgroundInfo(){
  initDefaultFeatures();
  if(!state.characterStats) state.characterStats = {};
  const cs = state.characterStats;

  const elClass = document.getElementById('bg-class');
  if(elClass) cs.characterClass = elClass.value.trim() || 'Bard';

  const elSpecies = document.getElementById('bg-species');
  if(elSpecies) cs.species = elSpecies.value.trim() || 'Half-Elf';

  const elLevel = document.getElementById('bg-level');
  if(elLevel){
    const lvl = parseInt(elLevel.value, 10) || 5;
    cs.level = lvl;
    cs.profBonus = Math.floor((lvl - 1) / 4) + 2;
  }

  state.features.backgroundInfo = {
    name: document.getElementById('bg-name').value.trim(),
    featureName: document.getElementById('bg-feature').value.trim(),
    alignment: document.getElementById('bg-alignment').value.trim(),
    ideals: document.getElementById('bg-ideals').value.trim(),
    bonds: document.getElementById('bg-bonds').value.trim(),
    flaws: document.getElementById('bg-flaws').value.trim()
  };

  save();
  closeBackgroundModal();
  renderCharacterStats();
  renderFeaturesView();
}`;

  if (content.includes('function saveBackgroundInfo(){')) {
    const startIdx = content.indexOf('function saveBackgroundInfo(){');
    const endIdx = content.indexOf('renderFeaturesView();\n}', startIdx);
    if (endIdx !== -1) {
      const fullEndIdx = endIdx + 'renderFeaturesView();\n}'.length;
      content = content.substring(0, startIdx) + newSaveFunc + content.substring(fullEndIdx);
    }
  }

  if (content.includes('function openEditBackgroundModal(){')) {
    const startIdx = content.indexOf('function openEditBackgroundModal(){');
    const endIdx = content.indexOf('overlay.classList.add(\'open\');\n}', startIdx);
    if (endIdx !== -1) {
      const fullEndIdx = endIdx + 'overlay.classList.add(\'open\');\n}'.length;
      content = content.substring(0, startIdx) + newOpenModal + content.substring(fullEndIdx);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated saveBackgroundInfo and openEditBackgroundModal in ${filePath}`);
}

const dir = 'c:\\Users\\muham\\OneDrive\\Masaüstü\\A\\DND\\BG3 Inventory Sistem';
fixBackgroundModalSync(path.join(dir, 'bg3-inventory_13.html'));
fixBackgroundModalSync(path.join(dir, 'bg3-inventory.html'));
