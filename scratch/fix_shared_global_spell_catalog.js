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

  // 1. Add window.GLOBAL_SPELL_CATALOG initialization and sync helper
  const globalCatalogHelper = `
    /* ========================================================
       GLOBAL D&D 5E SPELL CATALOG SYSTEM
       Shared across all players, DMs, and character sheets
       ======================================================== */
    window.GLOBAL_SPELL_CATALOG = window.GLOBAL_SPELL_CATALOG || [];
    window.GLOBAL_SPELL_MAP = window.GLOBAL_SPELL_MAP || new Map();

    function syncSpellCatalogToState() {
      if (state && state.spellbook) {
        if (Array.isArray(window.GLOBAL_SPELL_CATALOG) && window.GLOBAL_SPELL_CATALOG.length > 0) {
          state.spellbook.catalog = window.GLOBAL_SPELL_CATALOG;
          state.spellbook.catalogLoaded = true;
          state.spellbook.loading = false;
          state.spellbook.error = '';
        } else if (Array.isArray(window.SPELL_CATALOG) && window.SPELL_CATALOG.length > 0) {
          buildGlobalCatalog(window.SPELL_CATALOG);
        } else if (!state.spellbook.loading) {
          refreshSpellCatalog();
        }
      }
    }
    window.syncSpellCatalogToState = syncSpellCatalogToState;
`;

  if (!content.includes('window.GLOBAL_SPELL_CATALOG = window.GLOBAL_SPELL_CATALOG')) {
    const stateAnchor = '    let state = getDefaultState(\'Default\');';
    content = content.replace(stateAnchor, globalCatalogHelper + '\n' + stateAnchor);
    console.log('Added GLOBAL_SPELL_CATALOG helper to:', filePath);
  }

  // 2. Update applyCloudInventory to always keep global spell catalog attached
  const oldApplyCloud = `      state = Object.assign(base, cloudState);
      if (incomingItems && Array.isArray(incomingItems)) {
        state.items = incomingItems;
      }
      activeInventoryUser = targetNickname;
      const localKey = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        localStorage.setItem(localKey, JSON.stringify(state));
      } catch (e) { }
      normalizeState();
      renderAll();`;

  const newApplyCloud = `      state = Object.assign(base, cloudState);
      if (incomingItems && Array.isArray(incomingItems)) {
        state.items = incomingItems;
      }
      activeInventoryUser = targetNickname;
      // Always attach global spell catalog so switching characters never blanks spells
      syncSpellCatalogToState();
      const localKey = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        const persistState = Object.assign({}, state);
        if (persistState.spellbook) {
          persistState.spellbook = Object.assign({}, persistState.spellbook);
          delete persistState.spellbook.catalog;
        }
        localStorage.setItem(localKey, JSON.stringify(persistState));
      } catch (e) { }
      normalizeState();
      renderAll();`;

  if (content.includes(oldApplyCloud)) {
    content = content.replace(oldApplyCloud, newApplyCloud);
    console.log('Updated applyCloudInventory in:', filePath);
  }

  // 3. Update load(targetNickname) to attach global catalog
  const oldLoadAnchor = `      activeInventoryUser = targetNickname;
      const key = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      const raw = localStorage.getItem(key);`;

  const newLoadAnchor = `      activeInventoryUser = targetNickname;
      const key = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      const raw = localStorage.getItem(key);`;

  const oldLoadEnd = `        state.deathSaves.failures.push(false);
      }
    }

    function save() {`;

  const newLoadEnd = `        state.deathSaves.failures.push(false);
      }
      // Always connect global spell catalog to active user's state
      syncSpellCatalogToState();
    }

    function save() {`;

  if (content.includes(oldLoadEnd)) {
    content = content.replace(oldLoadEnd, newLoadEnd);
    console.log('Updated load() to call syncSpellCatalogToState in:', filePath);
  }

  // 4. Update save() to omit catalog (saving 1.2MB overhead per character)
  const oldSave = `    function save() {
      const targetNickname = activeInventoryUser || (currentUser ? currentUser.nickname : 'DM');
      const key = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn("Local storage save error:", err);
      }

      // Sync to Firebase Realtime Database if available and not currently processing cloud update
      if (typeof window.fbSaveInventory === 'function' && !isSyncingFromCloud) {
        window.fbSaveInventory(targetNickname, state);
      }
    }`;

  const newSave = `    function save() {
      const targetNickname = activeInventoryUser || (currentUser ? currentUser.nickname : 'DM');
      const key = STORAGE_INV_PREFIX + targetNickname.toLowerCase();
      
      // Omit static 1.2MB catalog from per-player database/storage records
      const persistState = Object.assign({}, state);
      if (persistState.spellbook) {
        persistState.spellbook = Object.assign({}, persistState.spellbook);
        delete persistState.spellbook.catalog;
      }

      try {
        localStorage.setItem(key, JSON.stringify(persistState));
      } catch (err) {
        console.warn("Local storage save error:", err);
      }

      // Sync to Firebase Realtime Database if available and not currently processing cloud update
      if (typeof window.fbSaveInventory === 'function' && !isSyncingFromCloud) {
        window.fbSaveInventory(targetNickname, persistState);
      }
    }`;

  if (content.includes(oldSave)) {
    content = content.replace(oldSave, newSave);
    console.log('Updated save() to omit catalog in:', filePath);
  }

  // 5. Update dmSwitchActivePlayer to ensure catalog syncs
  const oldDmSwitch = `      // Switch live Firebase listener to this player's inventory
      if (typeof window.fbListenToInventory === 'function') {
        window.fbListenToInventory(target);
      }`;

  const newDmSwitch = `      // Always ensure global spell catalog is attached to target player's state
      syncSpellCatalogToState();

      // Switch live Firebase listener to this player's inventory
      if (typeof window.fbListenToInventory === 'function') {
        window.fbListenToInventory(target);
      }`;

  if (content.includes(oldDmSwitch)) {
    content = content.replace(oldDmSwitch, newDmSwitch);
    console.log('Updated dmSwitchActivePlayer in:', filePath);
  }

  // 6. Update loginUser to attach catalog
  const oldLoginEnd = `      // Hook Firebase live listener if available
      if (typeof window.fbListenToInventory === 'function') {
        window.fbListenToInventory(account.nickname);
      }`;

  const newLoginEnd = `      // Always ensure global spell catalog is attached to logged in player
      syncSpellCatalogToState();

      // Hook Firebase live listener if available
      if (typeof window.fbListenToInventory === 'function') {
        window.fbListenToInventory(account.nickname);
      }`;

  if (content.includes(oldLoginEnd)) {
    content = content.replace(oldLoginEnd, newLoginEnd);
    console.log('Updated loginUser in:', filePath);
  }

  // 7. Update renderSpellbookContents to safely fallback to GLOBAL_SPELL_CATALOG
  const oldRenderSpellbookStart = `    function renderSpellbookContents() {
      const sb = state.spellbook;
      const query = (sb.query || '').trim().toLowerCase();
      const classFilter = sb.classFilter || '';
      const levelFilter = sb.levelFilter !== undefined ? String(sb.levelFilter) : '';
      const schoolFilter = sb.schoolFilter || '';
      const sortBy = sb.sortBy || 'level-asc';
      const maxLimits = sb.maxPerLevel || { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 };

      let catalog = (sb.catalog || []).slice();`;

  const newRenderSpellbookStart = `    function renderSpellbookContents() {
      const sb = state.spellbook;
      const query = (sb.query || '').trim().toLowerCase();
      const classFilter = sb.classFilter || '';
      const levelFilter = sb.levelFilter !== undefined ? String(sb.levelFilter) : '';
      const schoolFilter = sb.schoolFilter || '';
      const sortBy = sb.sortBy || 'level-asc';
      const maxLimits = sb.maxPerLevel || { 0: 3, 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 };

      // Ensure active player's state is linked to global spell catalog
      if ((!sb.catalog || sb.catalog.length === 0) && window.GLOBAL_SPELL_CATALOG && window.GLOBAL_SPELL_CATALOG.length > 0) {
        sb.catalog = window.GLOBAL_SPELL_CATALOG;
        sb.catalogLoaded = true;
        sb.loading = false;
        sb.error = '';
      }

      let catalog = (sb.catalog && sb.catalog.length > 0) ? sb.catalog.slice() : ((window.GLOBAL_SPELL_CATALOG || []).slice());`;

  if (content.includes(oldRenderSpellbookStart)) {
    content = content.replace(oldRenderSpellbookStart, newRenderSpellbookStart);
    console.log('Updated renderSpellbookContents in:', filePath);
  }

  // 8. Update toggleSpellFromCatalog to find from catalog or GLOBAL_SPELL_CATALOG
  const oldToggleCatalog = `      const catalogSpell = state.spellbook.catalog.find(function (spell) { return spell.name === name; });`;
  const newToggleCatalog = `      const catalogList = (state.spellbook && state.spellbook.catalog && state.spellbook.catalog.length > 0)
        ? state.spellbook.catalog
        : (window.GLOBAL_SPELL_CATALOG || []);
      const catalogSpell = catalogList.find(function (spell) { return spell.name === name; });`;

  if (content.includes(oldToggleCatalog)) {
    content = content.replace(oldToggleCatalog, newToggleCatalog);
    console.log('Updated toggleSpellFromCatalog in:', filePath);
  }

  // 9. Update openSpellDetailModal
  const oldDetailModal = `    function openSpellDetailModal(spellName) {
      const catalog = state.spellbook.catalog || [];`;
  const newDetailModal = `    function openSpellDetailModal(spellName) {
      const catalog = (state.spellbook && state.spellbook.catalog && state.spellbook.catalog.length > 0)
        ? state.spellbook.catalog
        : (window.GLOBAL_SPELL_CATALOG || []);`;

  if (content.includes(oldDetailModal)) {
    content = content.replace(oldDetailModal, newDetailModal);
    console.log('Updated openSpellDetailModal in:', filePath);
  }

  // 10. Update buildGlobalCatalog and refreshSpellCatalog
  const oldBuildCatalogMarker = `        if (rawCatalog && Array.isArray(rawCatalog)) {
          const SCHOOL_MAP = {`;

  const newBuildCatalogImplementation = `        if (rawCatalog && Array.isArray(rawCatalog)) {
          buildGlobalCatalog(rawCatalog);
          save();
          renderSpellbookMenu();
        } else {
          throw new Error('Spell catalog could not be loaded.');
        }
      } catch (error) {
        console.error(error);
        state.spellbook.error = 'Could not load spell catalog.';
      } finally {
        state.spellbook.loading = false;
        renderSpellbookMenu();
      }
    }

    function buildGlobalCatalog(rawCatalog) {
      if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) return [];
      const SCHOOL_MAP = {`;

  // Check if buildGlobalCatalog is already defined
  if (!content.includes('function buildGlobalCatalog(')) {
    // Find the end of the refreshSpellCatalog block
    const catalogEndMarker = `          save();
          renderSpellbookMenu();
        } else {
          throw new Error('Spell catalog could not be loaded.');
        }
      } catch (error) {
        console.error(error);
        state.spellbook.error = 'Could not load spell catalog.';
      } finally {
        state.spellbook.loading = false;
        renderSpellbookMenu();
      }
    }`;

    // Replace the block from `if (rawCatalog && Array.isArray(rawCatalog)) {` to the end
    const fullOldBlock = `        if (rawCatalog && Array.isArray(rawCatalog)) {
          const SCHOOL_MAP = {
            'A': 'Abjuration',
            'C': 'Conjuration',
            'D': 'Divination',
            'E': 'Enchantment',
            'I': 'Illusion',
            'N': 'Necromancy',
            'T': 'Transmutation',
            'V': 'Evocation'
          };
          const mapByName = new Map();
          const merged = [];
          rawCatalog.forEach(function (spell) {
            const name = String(spell?.name || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            const schoolName = (spell.schoolName && spell.schoolName !== 'Universal') ? spell.schoolName : (SCHOOL_MAP[spell.school] || spell.schoolName || 'Universal');
            const bestDesc = (spell.quickEffect && spell.quickEffect.length > 25 && !spell.quickEffect.includes('magical spell effect')) ? spell.quickEffect : ((spell.desc && spell.desc.length > 25 && !spell.desc.includes('magical spell effect')) ? spell.desc : '');
            if (!mapByName.has(key)) {
              const spellCopy = {
                name: spell.name,
                levelNum: spell.levelNum !== undefined ? spell.levelNum : (spell.levelText === 'Cantrip' ? 0 : (parseInt((spell.levelText || '').replace(/\\D/g, ''), 10) || 0)),
                levelText: spell.levelText || 'Spell',
                source: spell.source || 'PHB',
                school: spell.school || '',
                schoolName: schoolName,
                classes: Array.isArray(spell.classes) ? [...spell.classes] : [],
                castingTime: spell.castingTime || '1 action',
                range: spell.range || '60 feet',
                components: spell.components || 'V, S',
                duration: spell.duration || 'Instantaneous',
                quickEffect: bestDesc,
                desc: bestDesc,
                higherLevels: spell.higherLevels || '',
                tags: Array.isArray(spell.tags) ? [...spell.tags] : [],
                damage: spell.damage || ''
              };
              mapByName.set(key, spellCopy);
              merged.push(spellCopy);
            } else {
              const existing = mapByName.get(key);
              if (Array.isArray(spell.classes)) {
                spell.classes.forEach(function (c) { if (!existing.classes.includes(c)) existing.classes.push(c); });
              }
              if (Array.isArray(spell.tags)) {
                spell.tags.forEach(function (t) { if (!existing.tags.includes(t)) existing.tags.push(t); });
              }
              if (!existing.damage && spell.damage) existing.damage = spell.damage;
              if ((!existing.desc || existing.desc.length < 25 || existing.desc.includes('magical spell effect')) && bestDesc && bestDesc.length > 25 && !bestDesc.includes('magical spell effect')) {
                existing.desc = bestDesc;
                existing.quickEffect = bestDesc;
              }
              if (schoolName && schoolName !== 'Universal') existing.schoolName = schoolName;
            }
          });
          merged.sort(function (a, b) { return (a.levelNum - b.levelNum) || String(a.name || '').localeCompare(String(b.name || '')); });

          state.spellbook.catalog = merged;
          state.spellbook.catalogLoaded = true;

          if (Array.isArray(state.spellbook.list)) {
            state.spellbook.list.forEach(function (s) {
              const cat = mapByName.get(s.name.toLowerCase());
              if (cat) {
                s.damage = cat.damage || s.damage || '';
                s.desc = cat.desc || s.desc || '';
                s.classes = cat.classes || s.classes || [];
                s.schoolName = cat.schoolName || s.schoolName || '';
              }
            });
          }

          save();
          renderSpellbookMenu();
        } else {
          throw new Error('Spell catalog could not be loaded.');
        }
      } catch (error) {
        console.error(error);
        state.spellbook.error = 'Could not load spell catalog.';
      } finally {
        state.spellbook.loading = false;
        renderSpellbookMenu();
      }
    }`;

    const newFullBlock = `        if (rawCatalog && Array.isArray(rawCatalog)) {
          buildGlobalCatalog(rawCatalog);
          renderSpellbookMenu();
        } else {
          throw new Error('Spell catalog could not be loaded.');
        }
      } catch (error) {
        console.error(error);
        state.spellbook.error = 'Could not load spell catalog.';
      } finally {
        state.spellbook.loading = false;
        renderSpellbookMenu();
      }
    }

    function buildGlobalCatalog(rawCatalog) {
      if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) return [];
      const SCHOOL_MAP = {
        'A': 'Abjuration',
        'C': 'Conjuration',
        'D': 'Divination',
        'E': 'Enchantment',
        'I': 'Illusion',
        'N': 'Necromancy',
        'T': 'Transmutation',
        'V': 'Evocation'
      };
      const mapByName = new Map();
      const merged = [];
      rawCatalog.forEach(function (spell) {
        const name = String(spell?.name || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const schoolName = (spell.schoolName && spell.schoolName !== 'Universal') ? spell.schoolName : (SCHOOL_MAP[spell.school] || spell.schoolName || 'Universal');
        const bestDesc = (spell.quickEffect && spell.quickEffect.length > 25 && !spell.quickEffect.includes('magical spell effect')) ? spell.quickEffect : ((spell.desc && spell.desc.length > 25 && !spell.desc.includes('magical spell effect')) ? spell.desc : '');
        if (!mapByName.has(key)) {
          const spellCopy = {
            name: spell.name,
            levelNum: spell.levelNum !== undefined ? spell.levelNum : (spell.levelText === 'Cantrip' ? 0 : (parseInt((spell.levelText || '').replace(/\\D/g, ''), 10) || 0)),
            levelText: spell.levelText || 'Spell',
            source: spell.source || 'PHB',
            school: spell.school || '',
            schoolName: schoolName,
            classes: Array.isArray(spell.classes) ? [...spell.classes] : [],
            castingTime: spell.castingTime || '1 action',
            range: spell.range || '60 feet',
            components: spell.components || 'V, S',
            duration: spell.duration || 'Instantaneous',
            quickEffect: bestDesc,
            desc: bestDesc,
            higherLevels: spell.higherLevels || '',
            tags: Array.isArray(spell.tags) ? [...spell.tags] : [],
            damage: spell.damage || ''
          };
          mapByName.set(key, spellCopy);
          merged.push(spellCopy);
        } else {
          const existing = mapByName.get(key);
          if (Array.isArray(spell.classes)) {
            spell.classes.forEach(function (c) { if (!existing.classes.includes(c)) existing.classes.push(c); });
          }
          if (Array.isArray(spell.tags)) {
            spell.tags.forEach(function (t) { if (!existing.tags.includes(t)) existing.tags.push(t); });
          }
          if (!existing.damage && spell.damage) existing.damage = spell.damage;
          if ((!existing.desc || existing.desc.length < 25 || existing.desc.includes('magical spell effect')) && bestDesc && bestDesc.length > 25 && !bestDesc.includes('magical spell effect')) {
            existing.desc = bestDesc;
            existing.quickEffect = bestDesc;
          }
          if (schoolName && schoolName !== 'Universal') existing.schoolName = schoolName;
        }
      });
      merged.sort(function (a, b) { return (a.levelNum - b.levelNum) || String(a.name || '').localeCompare(String(b.name || '')); });

      window.GLOBAL_SPELL_CATALOG = merged;
      window.GLOBAL_SPELL_MAP = mapByName;

      if (state && state.spellbook) {
        state.spellbook.catalog = merged;
        state.spellbook.catalogLoaded = true;
        state.spellbook.loading = false;
        state.spellbook.error = '';

        if (Array.isArray(state.spellbook.list)) {
          state.spellbook.list.forEach(function (s) {
            const cat = mapByName.get(s.name.toLowerCase());
            if (cat) {
              s.damage = cat.damage || s.damage || '';
              s.desc = cat.desc || s.desc || '';
              s.classes = cat.classes || s.classes || [];
              s.schoolName = cat.schoolName || s.schoolName || '';
            }
          });
        }
      }
      return merged;
    }`;

    if (content.includes(fullOldBlock)) {
      content = content.replace(fullOldBlock, newFullBlock);
      console.log('Extracted buildGlobalCatalog in:', filePath);
    }
  }

  // 11. Ensure cleanData in Firebase module strips catalog if present
  const oldFbSaveInv = `      const doSave = () => {
        const payload = cleanData(invState);`;
  const newFbSaveInv = `      const doSave = () => {
        let payload = cleanData(invState);
        if (payload && payload.spellbook && payload.spellbook.catalog) {
          delete payload.spellbook.catalog;
        }`;

  if (content.includes(oldFbSaveInv)) {
    content = content.replace(oldFbSaveInv, newFbSaveInv);
    console.log('Updated fbSaveInventory in Firebase module in:', filePath);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Completed global spell catalog sharing patch!');
