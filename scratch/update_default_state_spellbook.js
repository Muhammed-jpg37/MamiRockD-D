const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'index', 'index.html')
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  const target = `        spellbook: {
          open: true, query: '', classFilter: '', levelFilter: '', schoolFilter: '', sortBy: 'level-asc',
          catalogLoaded: false, loading: false, error: '', catalog: [], list: [],
          maxPerLevel: { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
        },`;
  const replacement = `        spellbook: {
          open: true, query: '', classFilter: '', levelFilter: '', schoolFilter: '', sortBy: 'level-asc',
          catalogLoaded: (Array.isArray(window.GLOBAL_SPELL_CATALOG) && window.GLOBAL_SPELL_CATALOG.length > 0),
          loading: false, error: '',
          catalog: (Array.isArray(window.GLOBAL_SPELL_CATALOG) ? window.GLOBAL_SPELL_CATALOG : []),
          list: [],
          maxPerLevel: { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
        },`;
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated getDefaultState in', f);
  }
});
