const fs = require('fs');

const spellCatalogCode = fs.readFileSync('spell-catalog.js', 'utf8');
const fakeWindow = {};
eval(spellCatalogCode.replace('window.SPELL_CATALOG', 'fakeWindow.SPELL_CATALOG'));

console.log('Raw spells loaded in SPELL_CATALOG:', fakeWindow.SPELL_CATALOG.length);

if (fakeWindow.SPELL_CATALOG.length > 1000) {
  console.log('✅ Spell catalog successfully verified with >1000 spells!');
} else {
  console.error('❌ Failed: unexpected spell count');
}
