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

  /* ---------- D&D Beyond character JSON (step 1.3) ----------
     The file a player saves from D&D Beyond's character service for their own character
     (character-service.dndbeyond.com/character/v5/character/<id>; the character must be
     public). It is not an official API and its shape has changed before, so every field is
     read defensively and anything missing becomes a note. The field names below are the
     ones community tools use (data.stats, classes[].definition, modifiers.*, inventory[]…);
     NOT yet checked against a real file. Returns the same { name, patch, warnings } as
     fromPdfFields, so sheetFromPdf builds the sheet. */

  const DDB_ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const DDB_ALIGN = { 1: 'Lawful Good', 2: 'Neutral Good', 3: 'Chaotic Good', 4: 'Lawful Neutral', 5: 'Neutral', 6: 'Chaotic Neutral', 7: 'Lawful Evil', 8: 'Neutral Evil', 9: 'Chaotic Evil' };
  const stripHtml = (s) => String(s || '').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
  const arr = (x) => (Array.isArray(x) ? x : []);
  const SKILL_KEYS = {};
  SKILLS.forEach(([skill]) => { SKILL_KEYS[skill.toLowerCase().replace(/\s+/g, '-')] = skill; });

  function fromDdbJson(obj, opts) {
    opts = opts || {};
    const d = obj && (obj.data || obj.character || obj);
    if (!d || !Array.isArray(d.stats) || !Array.isArray(d.classes)) throw new Error('That is not a D&D Beyond character file (no stats or classes in it).');
    const warnings = [];
    const name = String(d.name || 'Imported character').slice(0, 40);

    const mods = [];
    Object.keys(d.modifiers || {}).forEach((k) => arr(d.modifiers[k]).forEach((m) => { if (m && typeof m === 'object') mods.push(m); }));
    const modsOf = (type, sub) => mods.filter((m) => m.type === type && (sub instanceof RegExp ? sub.test(m.subType || '') : m.subType === sub));

    // Classes: the starting class first; the sheet has one class line.
    const classes = arr(d.classes).slice().sort((a, b) => (b.isStartingClass ? 1 : 0) - (a.isStartingClass ? 1 : 0));
    const level = Math.max(1, Math.min(20, classes.reduce((n, c) => n + (Number(c.level) || 0), 0) || 1));
    const clsName = (c) => (c && c.definition && c.definition.name) || '';
    if (classes.length > 1) warnings.push('Multiclass "' + classes.map((c) => clsName(c) + ' ' + c.level).join(' / ') + '": the sheet keeps ' + clsName(classes[0]) + ' as its class and ' + level + ' as the total level.');
    const sub = classes[0] && classes[0].subclassDefinition && classes[0].subclassDefinition.name;

    const race = d.race || {};
    const cs = {
      characterClass: clsName(classes[0]) || 'Fighter', subclass: sub || '', level: level,
      species: race.baseName || race.fullName || 'Human', subrace: race.subRaceShortName || (race.fullName && race.baseName && race.fullName !== race.baseName ? race.fullName : ''),
      armorProf: '', weaponProf: '', toolProf: '', languages: '', saveNotes: '', senseNotes: '',
      saveProfs: {}, skillProfs: {}, saveCustomBonuses: {}, skillCustomBonuses: {}
    };

    // Scores: base + bonuses from species, feats, ASIs… unless the player set an override.
    DDB_ABIL.forEach((a, i) => {
      const id = i + 1;
      const pick = (list) => { const s = arr(list).find((x) => x && x.id === id); return s && s.value != null ? Number(s.value) : null; };
      const base = pick(d.stats);
      const override = pick(d.overrideStats);
      const bonus = (pick(d.bonusStats) || 0) + modsOf('bonus', ABILITY_NAMES[a] + '-score').reduce((n, m) => n + (Number(m.value) || 0), 0);
      cs[a] = override || Math.max(1, Math.min(30, (base || 10) + bonus));
    });
    cs.profBonus = Math.ceil(level / 4) + 1;
    const mod = (a) => Math.floor((cs[a] - 10) / 2);

    DDB_ABIL.forEach((a) => { if (modsOf('proficiency', ABILITY_NAMES[a] + '-saving-throws').length) cs.saveProfs[a] = 1; });
    Object.keys(SKILL_KEYS).forEach((k) => {
      if (modsOf('expertise', k).length) cs.skillProfs[SKILL_KEYS[k]] = 2;
      else if (modsOf('proficiency', k).length) cs.skillProfs[SKILL_KEYS[k]] = 1;
    });

    // Proficiencies by kind, from the modifiers' readable names.
    const profNames = mods.filter((m) => m.type === 'proficiency' && m.friendlySubtypeName && !/saving throws|^(acrobatics|animal|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight|stealth|survival)/i.test(m.friendlySubtypeName)).map((m) => m.friendlySubtypeName);
    const uniq = (a) => Array.from(new Set(a));
    cs.armorProf = uniq(profNames.filter((n) => /armor|shield/i.test(n))).join(', ');
    cs.toolProf = uniq(profNames.filter((n) => /tools?|kit|supplies|instrument|set\b|utensils|vehicles?/i.test(n))).join(', ');
    cs.weaponProf = uniq(profNames.filter((n) => !/armor|shield|tools?|kit|supplies|instrument|set\b|utensils|vehicles?/i.test(n))).join(', ');
    cs.languages = uniq(mods.filter((m) => m.type === 'language').map((m) => m.friendlySubtypeName).filter(Boolean)).join(', ');

    const walk = race.weightSpeeds && race.weightSpeeds.normal && race.weightSpeeds.normal.walk;
    cs.speed = Number(walk) || 30;
    cs.initBonus = mod('dex');

    // HP: D&D Beyond stores the rolled/average part; CON is added per level.
    const baseHp = Number(d.baseHitPoints) || 0;
    const maxHp = Number(d.overrideHitPoints) || Math.max(1, baseHp + (Number(d.bonusHitPoints) || 0) + mod('con') * level);
    if (!baseHp && !d.overrideHitPoints) warnings.push('No hit points in the file; set to ' + maxHp + '.');
    const hp = { max: maxHp, current: Math.max(0, maxHp - (Number(d.removedHitPoints) || 0)), temp: Math.max(0, Number(d.temporaryHitPoints) || 0) };

    const cur = d.currencies || {};
    const currency = { platinum: Number(cur.pp) || 0, gold: Number(cur.gp) || 0, electrum: Number(cur.ep) || 0, silver: Number(cur.sp) || 0, copper: Number(cur.cp) || 0 };

    // Inventory: armour keeps its AC and category, so the sheet works out AC itself.
    const usedSlots = {};
    const items = arr(d.inventory).slice(0, 200).map((inv, i) => {
      const def = (inv && inv.definition) || {};
      if (!def.name) return null;
      const ft = String(def.filterType || def.type || '');
      const armorType = Number(def.armorTypeId);
      let type = 'Misc', slot = null, armorCategory = null, ac = 0, prof = null;
      if (/weapon/i.test(ft)) { type = 'Weapon'; slot = 'main'; prof = /martial/i.test(def.type || '') || def.categoryId === 2 ? 'Martial' : 'Simple'; }
      else if (/armor/i.test(ft) && armorType === 4) { type = 'Shield'; slot = 'off'; armorCategory = 'Bonus'; ac = Number(def.armorClass) || 2; }
      else if (/armor/i.test(ft)) { type = 'Armor'; slot = 'chest'; armorCategory = armorType === 1 ? 'Light' : armorType === 3 ? 'Heavy' : 'Medium'; ac = Number(def.armorClass) || 0; }
      else if (/potion|scroll/i.test(ft)) type = 'Consumable';
      else if (/ring/i.test(ft)) { type = 'Ring'; slot = 'ring1'; }
      else if (/wondrous/i.test(ft)) type = 'Wondrous Item';
      else if (/ammunition/i.test(ft) || /ammunition/i.test(def.type || '')) type = 'Ammunition';
      let equipped = !!inv.equipped && !!slot;
      if (equipped) { if (usedSlots[slot]) equipped = false; else usedSlots[slot] = true; }
      const rarity = /^(common|uncommon|rare|very rare|legendary|artifact)$/i.test(def.rarity || '') ? def.rarity.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Common';
      return {
        id: 'ddb_item_' + i + '_' + Date.now().toString(36), name: String(def.name).slice(0, 80),
        icon: type === 'Weapon' ? '⚔️' : type === 'Armor' ? '🥋' : type === 'Shield' ? '🛡️' : type === 'Consumable' ? '🧪' : type === 'Ring' ? '💍' : '🎒',
        type: type, armorCategory: armorCategory, rarity: rarity, slot: slot, weight: Number(def.weight) || 0,
        qty: Math.max(1, Math.min(999, Number(inv.quantity) || 1)), desc: stripHtml(def.description || def.snippet).slice(0, 3000),
        attunementRequired: !!def.canAttune, proficiencyType: prof, buffs: [], debuffs: [],
        statBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ac: ac, init: 0, speed: 0 }, skillBonuses: {}, equipped: equipped
      };
    }).filter(Boolean);
    // No armour on: the sheet's unarmoured AC is 10 (+ DEX it adds itself).
    cs.unarmoredBaseAc = 10;
    cs.ac = 10 + mod('dex');

    // Spells from classes, species, feats and items.
    const spellDefs = [];
    arr(d.classSpells).forEach((cl) => arr(cl && cl.spells).forEach((s) => spellDefs.push(s)));
    Object.keys(d.spells || {}).forEach((k) => arr(d.spells[k]).forEach((s) => spellDefs.push(s)));
    const known = opts.spellIndex || {};
    const seen = new Set();
    const spells = [];
    spellDefs.forEach((s) => {
      const def = (s && s.definition) || {};
      if (!def.name || seen.has(def.name.toLowerCase())) return;
      seen.add(def.name.toLowerCase());
      const sp = known[def.name.toLowerCase()];
      const lvl = sp ? sp.level : (def.level != null ? Number(def.level) : null);
      spells.push({ name: sp ? sp.name : def.name, ruleset: '2014', levelNum: lvl, levelText: lvl === 0 ? 'Cantrip' : lvl ? 'Level ' + lvl : '', source: sp ? 'SRD' : 'Imported', importedFrom: 'ddb', prepared: !!(s.prepared || s.alwaysPrepared) });
    });
    const unknownSpells = spells.filter((s) => s.source === 'Imported').map((s) => s.name);
    if (unknownSpells.length) warnings.push('Not in the SRD spell list, kept by name only: ' + unknownSpells.slice(0, 8).join(', ') + (unknownSpells.length > 8 ? '…' : '') + '.');

    // Features as names (D&D Beyond's texts are book text; only names are kept).
    // D&D Beyond also lists the headings of a species' or class's description as entries
    // ("Hit Points", "Age", "Languages"…); those are not features and are left out.
    const HEADINGS = new Set(['hit points', 'proficiencies', 'equipment', 'age', 'size', 'speed', 'languages', 'ability score increase', 'alignment', 'creature type']);
    const cards = [];
    const addCard = (category, title, nm, source) => { if (nm && !HEADINGS.has(String(nm).trim().toLowerCase())) cards.push({ id: 'ddb_' + cards.length + '_' + Date.now().toString(36), category: category, title: title, name: String(nm).slice(0, 80), source: source, desc: '' }); };
    classes.forEach((c) => arr(c.classFeatures).forEach((f) => {
      const def = (f && f.definition) || {};
      if (def.name && (def.requiredLevel == null || def.requiredLevel <= c.level)) addCard('CLASS', clsName(c) + ' Features', def.name, 'Level ' + (def.requiredLevel || 1));
    }));
    arr(race.racialTraits).forEach((t) => addCard('SPECIES', (race.fullName || cs.species) + ' Traits', t && t.definition && t.definition.name, race.fullName || cs.species));
    arr(d.feats).forEach((f) => addCard('FEATS', 'Feats', f && f.definition && f.definition.name, 'Feat'));

    const traits = d.traits || {};
    const notes = d.notes || {};
    const bg = (d.background && d.background.definition) || (d.background && d.background.customBackground) || {};
    const background = {
      name: bg.name || '', alignment: DDB_ALIGN[d.alignmentId] || '',
      personality: stripHtml(traits.personalityTraits), ideals: stripHtml(traits.ideals), bonds: stripHtml(traits.bonds), flaws: stripHtml(traits.flaws),
      backstory: [stripHtml(notes.backstory), notes.allies ? 'Allies: ' + stripHtml(notes.allies) : '', notes.organizations ? 'Organizations: ' + stripHtml(notes.organizations) : ''].filter(Boolean).join('\n\n')
    };
    const dsv = d.deathSaves || {};
    const deathSaves = { open: true, successes: [0, 1, 2].map((i) => i < (Number(dsv.successCount) || 0)), failures: [0, 1, 2].map((i) => i < (Number(dsv.failCount) || 0)) };
    if (d.decorations && d.decorations.avatarUrl) warnings.push('The D&D Beyond portrait is a web link and was not copied; add a picture with 🖼 in My characters.');

    return {
      name: name,
      patch: { characterStats: cs, hp: hp, currency: currency, items: items, spells: spells, featureCards: cards, backgroundInfo: background, deathSaves: deathSaves, xp: Number(d.currentXp) || 0 },
      warnings: warnings
    };
  }

  // Which reader a .json file needs: the site's own file, or D&D Beyond's.
  function detectJson(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return 'invalid'; }
    if (data && data.format === FORMAT) return 'site';
    const d = data && (data.data || data.character || data);
    if (d && Array.isArray(d.stats) && Array.isArray(d.classes)) return 'ddb';
    return 'unknown';
  }

  root.CharacterTransfer = {
    FORMAT: FORMAT, VERSION: VERSION, makeExport: makeExport, parseExport: parseExport, fileName: fileName, clean: clean,
    fromPdfFields: fromPdfFields, sheetFromPdf: sheetFromPdf, parseClassLevel: parseClassLevel,
    fromDdbJson: fromDdbJson, detectJson: detectJson, stripHtml: stripHtml
  };
})(typeof window !== 'undefined' ? window : this);
