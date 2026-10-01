const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'index', 'index.html')
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add script tag to head if not present
  if (!content.includes('<script src="spell-catalog.js"')) {
    const headTarget = `    rel="stylesheet">\n  <style>`;
    const headReplacement = `    rel="stylesheet">\n  <script src="spell-catalog.js" defer></script>\n  <style>`;
    if (content.includes(headTarget)) {
      content = content.replace(headTarget, headReplacement);
      console.log('Added spell-catalog.js script tag to head of:', filePath);
    }
  }

  // 2. Enhance openSpellCatalogModal to auto-retry load if empty
  const oldOpenModal = `    function openSpellCatalogModal() {
      const overlay = document.getElementById('spell-catalog-overlay');
      if (overlay) overlay.classList.add('open');
      renderSpellbookContents();
    }`;

  const newOpenModal = `    function openSpellCatalogModal() {
      const overlay = document.getElementById('spell-catalog-overlay');
      if (overlay) overlay.classList.add('open');
      if (!state.spellbook.catalogLoaded || !state.spellbook.catalog || state.spellbook.catalog.length === 0) {
        refreshSpellCatalog();
      }
      renderSpellbookContents();
    }`;

  if (content.includes(oldOpenModal)) {
    content = content.replace(oldOpenModal, newOpenModal);
    console.log('Updated openSpellCatalogModal in:', filePath);
  }

  // 3. Robust multi-fallback refreshSpellCatalog
  const oldRefreshBlock = `    async function refreshSpellCatalog() {
      if (state.spellbook.loading) return;
      state.spellbook.loading = true;
      state.spellbook.error = '';
      renderSpellbookMenu();
      try {
        let rawCatalog = null;
        if (Array.isArray(window.SPELL_CATALOG) && window.SPELL_CATALOG.length > 0) {
          rawCatalog = window.SPELL_CATALOG;
        } else {
          const tag = document.getElementById('spell-catalog-data');
          if (tag && tag.textContent.trim()) {
            try {
              let text = tag.textContent.trim();
              if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
              rawCatalog = JSON.parse(text);
            } catch (e) { }
          }
        }

        if (!rawCatalog) {
          try {
            const localResponse = await fetch('spell-catalog.json', { cache: 'no-store' });
            if (localResponse.ok) {
              let text = await localResponse.text();
              if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
              rawCatalog = JSON.parse(text);
            }
          } catch (e) { }
        }`;

  const newRefreshBlock = `    async function refreshSpellCatalog() {
      if (state.spellbook.loading) return;
      state.spellbook.loading = true;
      state.spellbook.error = '';
      renderSpellbookMenu();
      try {
        let rawCatalog = null;
        if (Array.isArray(window.SPELL_CATALOG) && window.SPELL_CATALOG.length > 0) {
          rawCatalog = window.SPELL_CATALOG;
        } else {
          const tag = document.getElementById('spell-catalog-data');
          if (tag && tag.textContent.trim()) {
            try {
              let text = tag.textContent.trim();
              if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
              rawCatalog = JSON.parse(text);
            } catch (e) { }
          }
        }

        if (!rawCatalog) {
          const fetchCandidates = [
            'spell-catalog.json',
            '/spell-catalog.json',
            './spell-catalog.json',
            '../spell-catalog.json',
            'index/spell-catalog.json'
          ];
          for (const url of fetchCandidates) {
            try {
              const res = await fetch(url, { cache: 'no-store' });
              if (res.ok) {
                let text = await res.text();
                if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                text = text.trim();
                if (text.startsWith('[') || text.startsWith('{')) {
                  const parsed = JSON.parse(text);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    rawCatalog = parsed;
                    break;
                  }
                }
              }
            } catch (e) { }
          }
        }

        if (!rawCatalog && (!Array.isArray(window.SPELL_CATALOG) || window.SPELL_CATALOG.length === 0)) {
          const scriptCandidates = ['spell-catalog.js', '/spell-catalog.js', './spell-catalog.js', '../spell-catalog.js', 'index/spell-catalog.js'];
          for (const sUrl of scriptCandidates) {
            if (Array.isArray(window.SPELL_CATALOG) && window.SPELL_CATALOG.length > 0) {
              rawCatalog = window.SPELL_CATALOG;
              break;
            }
            await new Promise((resolve) => {
              const s = document.createElement('script');
              s.src = sUrl;
              s.onload = () => {
                if (Array.isArray(window.SPELL_CATALOG) && window.SPELL_CATALOG.length > 0) {
                  rawCatalog = window.SPELL_CATALOG;
                }
                resolve();
              };
              s.onerror = () => resolve();
              document.head.appendChild(s);
            });
            if (rawCatalog) break;
          }
        }

        if (!rawCatalog && Array.isArray(window.SPELL_CATALOG) && window.SPELL_CATALOG.length > 0) {
          rawCatalog = window.SPELL_CATALOG;
        }`;

  if (content.includes(oldRefreshBlock)) {
    content = content.replace(oldRefreshBlock, newRefreshBlock);
    console.log('Updated refreshSpellCatalog in:', filePath);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Done updating index.html and index/index.html');
