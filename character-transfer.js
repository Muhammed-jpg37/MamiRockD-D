/* ========================================================
   CHARACTER TRANSFER (feature plan step 1): one character as
   a file, and the readers that turn files from elsewhere into
   a character. No DOM and no database here, so Node tests can
   load it; campaign.js does the downloading and saving.

   Site file format (version 1):
     { format: 'mamirock-character', version: 1, exportedAt,
       name, sheet }   // sheet = inventories/<id> as stored
   ======================================================== */
(function (root) {
  'use strict';

  const FORMAT = 'mamirock-character';
  const VERSION = 1;
  const MAX_BYTES = 1500000;      // a sheet with a portrait is well under this
  const MAX_PORTRAIT = 200000;    // same limit as fbSetCharacterPortrait

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // What goes into the file: the sheet without the shared spell catalog (it is rebuilt on load).
  function makeExport(sheet, name) {
    if (!sheet || typeof sheet !== 'object') throw new Error('That character has no sheet yet.');
    const s = clone(sheet);
    if (s.spellbook) delete s.spellbook.catalog;
    return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), name: String(name || (s.build && s.build.name) || 'Character').slice(0, 40), sheet: s };
  }

  function fileName(name) {
    return (String(name || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character') + '.mamirock.json';
  }

  // Reads a site file back. Returns { name, sheet, warnings } or throws with a message for the player.
  function parseExport(text) {
    if (typeof text !== 'string') throw new Error('That file could not be read.');
    if (text.length > MAX_BYTES) throw new Error('That file is too large to be a character (over 1.5 MB).');
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('That is not a character file (it is not JSON).'); }
    if (!data || data.format !== FORMAT) throw new Error('That JSON is not a MamiRock character file.');
    if (Number(data.version) > VERSION) throw new Error('That file comes from a newer version of the site.');
    const sheet = data.sheet;
    if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) throw new Error('The file has no character sheet in it.');
    if (!sheet.characterStats || typeof sheet.characterStats !== 'object') throw new Error('The sheet in the file has no stats.');
    return clean(sheet, data.name);
  }

  // Only plain data of the expected kinds is kept; the sheet gets its new name.
  function clean(sheet, name) {
    const warnings = [];
    const s = clone(sheet);
    const nm = String(name || (s.build && s.build.name) || 'Imported character').trim().slice(0, 40) || 'Imported character';
    if (s.spellbook) delete s.spellbook.catalog;
    if (!Array.isArray(s.items)) s.items = [];
    s.items = s.items.filter((i) => i && typeof i === 'object' && typeof i.name === 'string');
    const portraitOk = (p) => typeof p === 'string' && p.startsWith('data:image/') && p.length <= MAX_PORTRAIT;
    if (s.portrait && !portraitOk(s.portrait)) { delete s.portrait; warnings.push('The portrait was left out (not a picture, or too large).'); }
    if (s.build && s.build.details && s.build.details.portrait && !portraitOk(s.build.details.portrait)) {
      delete s.build.details.portrait;
      warnings.push('The portrait was left out (not a picture, or too large).');
    }
    if (s.build) s.build.name = nm;
    s.campaign = nm + "'s Vault";
    delete s.activeTab;   // opens on Overview like any sheet
    return { name: nm, sheet: s, warnings: Array.from(new Set(warnings)) };
  }

  root.CharacterTransfer = { FORMAT: FORMAT, VERSION: VERSION, makeExport: makeExport, parseExport: parseExport, fileName: fileName, clean: clean };
})(typeof window !== 'undefined' ? window : this);
