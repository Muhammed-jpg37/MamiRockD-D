/* ========================================================
   SAVED SPELLS: refresh from the catalog
   A spell on a sheet (state.spellbook.list) is a copy of the
   catalog entry made when the player added it. Older copies
   hold the old catalog's made-up stats. refresh() brings each
   saved spell's details up to date from the current catalog
   (spell-catalog.js) and leaves the rest alone:

   - a spell with no catalog entry in its own ruleset (custom,
     renamed, or from a book the catalog dropped): untouched;
   - a "name-only" (non-SRD) catalog entry: untouched, since the
     catalog has nothing better than the sheet;
   - otherwise the catalog wins for level, school, classes,
     damage and text, even when the catalog field is empty
     (an empty field there means "not in the rules", not
     "unknown"). The saved name stays as the player saw it, and
     a saved book is kept when the catalog lists it.

   No DOM here: runs in the browser (window.SavedSpells) and in
   Node for the tests (tests/saved-spells.test.js).
   ======================================================== */
(function (root) {
  'use strict';

  const BOOKS_2024 = ['SRD52', 'XPHB', 'FRHoF', 'EFA'];

  // A spell saved before it had a ruleset is placed by its book (PHB → 2014, XPHB → 2024).
  function rulesetOf(spell) {
    if (spell && (spell.ruleset === '2014' || spell.ruleset === '2024')) return spell.ruleset;
    return (spell && BOOKS_2024.includes(spell.source)) ? '2024' : '2014';
  }

  function sameList(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(function (x, i) { return x === b[i]; });
  }

  // The fields a saved spell takes from its catalog entry.
  function freshFields(saved, cat) {
    const books = Array.isArray(cat.books) && cat.books.length ? cat.books : (cat.source ? [cat.source] : []);
    return {
      ruleset: cat.ruleset === '2024' ? '2024' : '2014',
      levelNum: cat.levelNum,
      levelText: cat.levelText || (cat.levelNum === 0 ? 'Cantrip' : 'Level ' + cat.levelNum),
      source: saved.source && books.includes(saved.source) ? saved.source : (cat.source || saved.source || ''),
      school: cat.school || '',
      schoolName: cat.schoolName || '',
      classes: Array.isArray(cat.classes) ? cat.classes.slice() : [],
      damage: cat.damage || '',
      desc: cat.desc || cat.quickEffect || ''
    };
  }

  /* list: the saved spells (changed in place).
     find(name, ruleset): the catalog entry with that name or alias in exactly
     that ruleset, or null.
     Returns how many saved spells changed. */
  function refresh(list, find) {
    if (!Array.isArray(list) || typeof find !== 'function') return 0;
    let changed = 0;
    list.forEach(function (saved) {
      if (!saved || typeof saved !== 'object' || !saved.name) return;
      const cat = find(saved.name, rulesetOf(saved));
      if (!cat || cat.detail === 'name-only' || typeof cat.levelNum !== 'number') return;
      const fresh = freshFields(saved, cat);
      let touched = false;
      Object.keys(fresh).forEach(function (k) {
        const v = fresh[k];
        const same = Array.isArray(v) ? sameList(saved[k], v) : saved[k] === v;
        if (!same) { saved[k] = v; touched = true; }
      });
      if (touched) changed++;
    });
    return changed;
  }

  const api = { refresh: refresh, rulesetOf: rulesetOf };
  root.SavedSpells = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
