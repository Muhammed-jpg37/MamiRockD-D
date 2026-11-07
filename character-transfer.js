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

  /* ---------- Fillable PDF character sheets (step 1.2) ----------
     fields: { fieldName: string | boolean } as read from the PDF's form (pdf-lib in the
     browser). Names are matched loosely (case, spaces and punctuation ignored), with the
     official WotC 2014 sheet's names first and common variants after.
     The checkbox numbers were checked against the official sheet's layout (2026-11-07):
     Check Box 11 and 18–22 are the saving throws STR…CHA, 23–40 the skills in
     alphabetical order, 12–14 death save successes and 15–17 failures. */

  const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const SAVE_BOXES = { str: 11, dex: 18, con: 19, int: 20, wis: 21, cha: 22 };
  const SKILLS = [
    ['Acrobatics', 'dex', ['acrobatics']], ['Animal Handling', 'wis', ['animal', 'animalhandling']], ['Arcana', 'int', ['arcana']],
    ['Athletics', 'str', ['athletics']], ['Deception', 'cha', ['deception']], ['History', 'int', ['history']],
    ['Insight', 'wis', ['insight']], ['Intimidation', 'cha', ['intimidation']], ['Investigation', 'int', ['investigation']],
    ['Medicine', 'wis', ['medicine']], ['Nature', 'int', ['nature']], ['Perception', 'wis', ['perception']],
    ['Performance', 'cha', ['performance']], ['Persuasion', 'cha', ['persuasion']], ['Religion', 'int', ['religion']],
    ['Sleight of Hand', 'dex', ['sleightofhand']], ['Stealth', 'dex', ['stealth']], ['Survival', 'wis', ['survival']]
  ];
  const ABILITY_NAMES = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };

  const int = (v) => { const m = String(v == null ? '' : v).replace(/[−–]/g, '-').match(/-?\d+/); return m ? Number(m[0]) : null; };
  const truthy = (v) => v === true || /^(yes|on|true|x|1)$/i.test(String(v || '').trim());

  // "Wizard 5", "Fighter 3 / Rogue 2", "Level 4 Cleric" -> { cls, level, multi }
  function parseClassLevel(text) {
    const t = String(text || '').trim();
    if (!t) return { cls: '', level: null, multi: false };
    const parts = t.split(/[\/,;&+]| and /i).map((p) => p.trim()).filter(Boolean);
    let level = 0;
    const names = [];
    parts.forEach((p) => {
      const n = int(p);
      if (n !== null) level += Math.abs(n);
      const name = p.replace(/\blevel\b|\blvl\b|\d+/gi, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (name) names.push(name);
    });
    return { cls: names[0] || '', level: level || null, multi: names.length > 1, classes: names };
  }

  function fromPdfFields(fields, opts) {
    opts = opts || {};
    const byNorm = {};
    Object.keys(fields || {}).forEach((k) => { byNorm[norm(k)] = fields[k]; });
    const used = new Set();
    const get = (...names) => {
      for (const n of names) {
        const v = byNorm[norm(n)];
        if (v !== undefined && v !== null && String(v).trim() !== '') { used.add(norm(n)); return typeof v === 'string' ? v.trim() : v; }
      }
      return '';
    };
    const box = (n) => truthy(byNorm[norm('Check Box ' + n)]);
    const warnings = [];

    const name = String(get('CharacterName', 'Character Name', 'CharacterName 2', 'Name') || '').slice(0, 40) || 'Imported character';
    const cl = parseClassLevel(get('ClassLevel', 'Class Level', 'CLASS  LEVEL', 'Class & Level', 'Class'));
    if (cl.multi) warnings.push('Multiclass "' + cl.classes.join(' / ') + '": the sheet keeps ' + cl.cls + ' as its class and ' + cl.level + ' as the total level.');
    const level = cl.level || int(get('Level')) || 1;

    const cs = {
      characterClass: cl.cls || 'Fighter', level: Math.max(1, Math.min(20, level)),
      species: get('Race', 'Species', 'RACE') || 'Human',
      armorProf: '', weaponProf: '', toolProf: '', languages: '', saveNotes: '', senseNotes: '',
      saveProfs: {}, skillProfs: {}, saveCustomBonuses: {}, skillCustomBonuses: {}
    };
    const missing = [];
    ABILITIES.forEach((a) => {
      const v = int(get(a.toUpperCase(), ABILITY_NAMES[a], a.toUpperCase() + ' Score'));
      if (v === null || v < 1 || v > 30) { missing.push(a.toUpperCase()); cs[a] = 10; } else cs[a] = v;
    });
    if (missing.length) warnings.push('No score for ' + missing.join(', ') + ' in the PDF; set to 10.');
    const pb = int(get('ProfBonus', 'Proficiency Bonus', 'Prof Bonus'));
    cs.profBonus = pb && pb > 0 ? pb : Math.ceil(cs.level / 4) + 1;
    const ac = int(get('AC', 'Armor Class', 'ArmorClass'));
    // The sheet adds DEX to its base AC when no armour is worn, so the base is the written AC minus DEX.
    if (ac) { cs.ac = ac; cs.unarmoredBaseAc = ac - Math.floor((cs.dex - 10) / 2); }
    const ini = int(get('Initiative', 'Init'));
    cs.initBonus = ini !== null ? ini : Math.floor((cs.dex - 10) / 2);
    cs.speed = int(get('Speed')) || 30;
    const mod = (a) => Math.floor((cs[a] - 10) / 2);

    // Saves: the checkbox, or a written bonus that only makes sense with proficiency.
    ABILITIES.forEach((a) => {
      const written = int(get('ST ' + ABILITY_NAMES[a].charAt(0).toUpperCase() + ABILITY_NAMES[a].slice(1), ABILITY_NAMES[a] + ' Save', a.toUpperCase() + ' Save'));
      if (box(SAVE_BOXES[a]) || (written !== null && written === mod(a) + cs.profBonus)) cs.saveProfs[a] = 1;
    });
    // Skills: checkbox = proficient; a written bonus of mod + 2×PB = expertise.
    SKILLS.forEach(([skill, ab, names], i) => {
      const written = int(get(...names, skill));
      let lvl = box(23 + i) ? 1 : 0;
      if (written !== null && written === mod(ab) + 2 * cs.profBonus) lvl = 2;
      else if (!lvl && written !== null && written === mod(ab) + cs.profBonus) lvl = 1;
      if (lvl) cs.skillProfs[skill] = lvl;
    });

    // Proficiencies and languages: one free text box on the official sheet.
    const profText = get('ProficienciesLang', 'Proficiencies & Languages', 'Other Proficiencies and Languages', 'Proficiencies');
    if (profText) {
      const grab = (re) => { const m = profText.match(re); return m ? m[1].replace(/\s+/g, ' ').trim().replace(/[.;]$/, '') : ''; };
      cs.languages = grab(/languages?\s*[:\-]\s*([^\n]+)/i);
      cs.armorProf = grab(/armou?r\s*[:\-]\s*([^\n]+)/i);
      cs.weaponProf = grab(/weapons?\s*[:\-]\s*([^\n]+)/i);
      cs.toolProf = grab(/tools?\s*[:\-]\s*([^\n]+)/i);
    }

    const hpMax = int(get('HPMax', 'HP Max', 'Hit Point Maximum', 'MaxHP'));
    const hpCur = int(get('HPCurrent', 'HP Current', 'Current Hit Points', 'CurrentHP'));
    const hp = { max: hpMax && hpMax > 0 ? hpMax : cs.level * 8, current: 0, temp: Math.max(0, int(get('HPTemp', 'Temp HP', 'Temporary Hit Points')) || 0) };
    hp.current = hpCur !== null && hpCur >= 0 ? Math.min(hpCur, hp.max) : hp.max;
    if (!hpMax) warnings.push('No hit point maximum in the PDF; set to ' + hp.max + '.');

    const currency = {
      platinum: Math.max(0, int(get('PP')) || 0), gold: Math.max(0, int(get('GP')) || 0), electrum: Math.max(0, int(get('EP')) || 0),
      silver: Math.max(0, int(get('SP')) || 0), copper: Math.max(0, int(get('CP')) || 0)
    };

    // Equipment: one line (or comma-separated entry) per item, "2 Daggers" / "Rope (50 ft) x1".
    const items = [];
    String(get('Equipment', 'Inventory') || '').split(/\n|,(?![^()]*\))/).map((l) => l.trim()).filter(Boolean).slice(0, 80).forEach((l) => {
      let qty = 1;
      let nm = l.replace(/^[-•*]\s*/, '');
      const lead = nm.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
      const tail = nm.match(/^(.+?)\s*[x×]\s*(\d+)$/i) || nm.match(/^(.+?)\s*\((\d+)\)$/);
      if (lead) { qty = Number(lead[1]); nm = lead[2]; } else if (tail) { nm = tail[1]; qty = Number(tail[2]); }
      if (nm.length > 80) nm = nm.slice(0, 80);
      items.push({ name: nm, qty: Math.max(1, Math.min(999, qty)), type: 'Misc', rarity: 'Common', weight: 0, desc: 'Imported from a PDF character sheet.' });
    });

    // Spells: every spell-name field; their level comes from the spell data when it is known.
    const spellNames = [];
    Object.keys(fields || {}).forEach((k) => {
      if (!/^spells?\s*\d+$/i.test(String(k).trim()) && !/^spellname/i.test(norm(k))) return;
      const v = String(fields[k] || '').trim();
      if (v && !spellNames.some((s) => s.toLowerCase() === v.toLowerCase())) spellNames.push(v);
    });
    const known = opts.spellIndex || {};
    const spells = spellNames.slice(0, 120).map((n) => {
      const sp = known[n.toLowerCase()];
      return sp ? { name: sp.name, ruleset: '2014', levelNum: sp.level, levelText: sp.level === 0 ? 'Cantrip' : 'Level ' + sp.level, source: 'SRD', importedFrom: 'pdf' }
        : { name: n, ruleset: '2014', levelNum: null, levelText: '', source: 'Imported', importedFrom: 'pdf' };
    });
    const unknownSpells = spells.filter((s) => s.source === 'Imported').map((s) => s.name);
    if (unknownSpells.length) warnings.push('Not in the SRD spell list, kept by name only: ' + unknownSpells.slice(0, 8).join(', ') + (unknownSpells.length > 8 ? '…' : '') + '.');

    // Long text boxes become feature cards so nothing written on the sheet is lost.
    const cards = [];
    const card = (title, text) => { if (text) cards.push({ id: 'pdf_' + cards.length + '_' + Date.now().toString(36), category: 'CLASS', title: 'Imported from PDF', name: title, source: 'PDF', desc: String(text).slice(0, 4000) }); };
    card('Features & Traits', get('Features and Traits', 'Features & Traits', 'FeaturesTraits'));
    card('More features & traits', get('Feat+Traits', 'Additional Features & Traits'));
    card('Attacks & spellcasting', get('AttacksSpellcasting', 'Attacks & Spellcasting'));
    card('Proficiencies & languages', profText);
    card('Treasure', get('Treasure'));

    const background = {
      name: get('Background'), alignment: get('Alignment'),
      personality: get('PersonalityTraits', 'Personality Traits'), ideals: get('Ideals'), bonds: get('Bonds'), flaws: get('Flaws'),
      backstory: [get('Backstory', 'Character Backstory'), get('Allies', 'Allies & Organizations') ? 'Allies & organizations: ' + get('Allies', 'Allies & Organizations') : ''].filter(Boolean).join('\n\n')
    };

    const deathSaves = { open: true, successes: [box(12), box(13), box(14)], failures: [box(15), box(16), box(17)] };
    const filled = Object.keys(byNorm).filter((k) => byNorm[k] !== '' && byNorm[k] !== false && byNorm[k] !== null).length;
    if (filled < 5) throw new Error('This PDF has no filled-in character sheet fields (a scanned or flattened PDF can not be read).');

    return {
      name: name,
      patch: { characterStats: cs, hp: hp, currency: currency, items: items, spells: spells, featureCards: cards, backgroundInfo: background, deathSaves: deathSaves, xp: int(get('XP', 'Experience Points')) || 0 },
      warnings: warnings
    };
  }

  // A full sheet: the site's empty sheet (base, from getDefaultState) with the PDF's values on top.
  function sheetFromPdf(base, read) {
    const s = clone(base || {});
    const p = read.patch;
    s.characterStats = Object.assign({}, s.characterStats || {}, p.characterStats);
    s.hp = p.hp;
    s.currency = p.currency;
    s.items = p.items.map((it, i) => Object.assign({ id: 'pdf_item_' + i + '_' + Date.now().toString(36), equipped: false }, it));
    s.deathSaves = p.deathSaves;
    s.features = Object.assign({}, s.features || {}, { items: p.featureCards, backgroundInfo: p.backgroundInfo });
    s.spellbook = Object.assign({}, s.spellbook || {}, { list: p.spells });
    delete s.spellbook.catalog;
    if (p.xp) s.xp = p.xp;
    s.importedFrom = 'pdf';
    return clean(s, read.name);
  }

  root.CharacterTransfer = {
    FORMAT: FORMAT, VERSION: VERSION, makeExport: makeExport, parseExport: parseExport, fileName: fileName, clean: clean,
    fromPdfFields: fromPdfFields, sheetFromPdf: sheetFromPdf, parseClassLevel: parseClassLevel
  };
})(typeof window !== 'undefined' ? window : this);
