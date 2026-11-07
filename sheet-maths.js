/* ========================================================
   SHEET MATHS (feature plan section 3): numbers the
   character sheet works out from its own data. No DOM; runs
   in the browser (window.SheetMaths) and in Node (tests).

   3.1 Weapons: attack bonus and damage for each equipped
   weapon, from the SRD equipment catalog
   (rules/catalog/srd5*-items.json) when the item came from it
   or its name matches, else from the item's own `damage`.
   ======================================================== */
(function (root) {
  'use strict';

  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
  const signed = (n) => (n >= 0 ? '+' : '') + n;

  /* ---------- Finding a weapon in the catalog ---------- */

  // "Longsword +1", "+2 Dagger", "Crossbow, hand", "Hand Crossbows" -> one comparable key.
  function nameKey(name) {
    let s = String(name || '').toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/\+\s*\d+/g, ' ')
      .replace(/[^a-z, ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    // "crossbow, hand" -> "hand crossbow"
    const comma = s.match(/^([a-z ]+),\s*([a-z ]+)$/);
    if (comma) s = comma[2].trim() + ' ' + comma[1].trim();
    // Plural to singular: "longswords" -> "longsword", "greataxes" -> "greataxe" (not "-ss").
    return s.replace(/,/g, '').replace(/([^s])s$/, '$1').trim();
  }

  // A magic weapon's bonus from its name: "Longsword +1" / "+2 Dagger" -> 1 / 2.
  function magicBonus(item) {
    if (item && Number(item.attackBonus)) return Number(item.attackBonus);
    const m = String((item && item.name) || '').match(/\+\s*([1-3])\b/);
    return m ? Number(m[1]) : 0;
  }

  // catalogs: { '2014': entries[], '2024': entries[] } (either may be missing).
  // Returns the catalog entry for a sheet item, or null.
  function findWeapon(item, catalogs) {
    if (!item) return null;
    catalogs = catalogs || {};
    const weapons = (rs) => (catalogs[rs] || []).filter((e) => e && e.kind === 'weapon');
    const from = String(item.fromCatalog || '');
    const m = from.match(/^(srd51|srd52):(.+)$/);
    if (m) {
      const hit = weapons(m[1] === 'srd52' ? '2024' : '2014').find((e) => e.id === m[2]);
      if (hit) return hit;
    }
    const key = nameKey(item.name);
    if (!key) return null;
    for (const rs of ['2014', '2024']) {
      const list = weapons(rs);
      const hit = list.find((e) => nameKey(e.name) === key) ||
        // "Elven longsword": the last words name the weapon.
        list.find((e) => key.endsWith(' ' + nameKey(e.name)));
      if (hit) return hit;
    }
    // Magic staffs ("Staff of the Magi", "Staff of Power") are wielded as quarterstaffs (SRD 5.1).
    if (/^staff\b/.test(key)) return findWeapon({ name: 'Quarterstaff' }, catalogs);
    return null;
  }

  const isWeaponItem = (item) => !!item && (item.type === 'Weapon' || item.category === 'weapon');

  /* ---------- Proficiency ---------- */

  // cs: the sheet's characterStats. Looks at the Simple / Martial switches, the "Weapons"
  // proficiency line ("Simple Weapons, Hand Crossbows, Longswords") and the old notes field.
  function weaponProficient(item, entry, cs) {
    cs = cs || {};
    const cat = (entry && entry.weaponCategory) || item.proficiencyType || null;
    if (item.proficiencyType === 'None') return true;
    if (cat === 'Simple' && cs.profSimple) return true;
    if (cat === 'Martial' && cs.profMartial) return true;
    if (cat === 'Exotic' && cs.profExotic) return true;
    const text = [cs.weaponProf, cs.weapons].filter(Boolean).join(',').toLowerCase();
    if (!text) return false;
    const parts = text.split(/[,;\n]|\band\b/).map((p) => p.trim()).filter(Boolean);
    const covers = (c) => parts.some((p) => p === c || p === c + ' weapons' || p === c + ' weapon');
    if (cat && covers(cat.toLowerCase())) return true;
    // Simple and martial together are every weapon, whatever its category.
    if (/\ball weapons\b/.test(text) || ((cs.profSimple || covers('simple')) && (cs.profMartial || covers('martial')))) return true;
    const names = [nameKey(item.name)];
    if (entry) names.push(nameKey(entry.name));
    return parts.some((p) => names.includes(nameKey(p)));
  }

  /* ---------- Attacks ---------- */

  function parseDamage(text) {
    const m = String(text || '').trim().match(/^(\d+(?:d\d+)?)(?:\s*\/\s*(\d+d\d+))?\s*([a-z]+)?/i);
    if (!m) return null;
    return { dice: m[1], versatile: m[2] || null, type: m[3] ? m[3].toLowerCase() : '' };
  }

  const withMod = (dice, n) => (n ? dice + (n > 0 ? '+' : '') + n : dice);

  // One attack line for a weapon item.
  // opts: { scores: { str, dex, ... } (with item bonuses), prof: number, cs, catalogs }
  // -> { id, name, slot, ability, toHit, toHitText, damage, versatile, damageType, range,
  //      properties, proficient, magic, offHand, source: 'catalog' | 'item' | null, notes[] }
  function weaponAttack(item, opts) {
    opts = opts || {};
    const scores = opts.scores || {};
    const prof = Number(opts.prof) || 0;
    const entry = findWeapon(item, opts.catalogs);
    const props = ((entry && entry.properties) || item.properties || []).map((p) => String(p));
    const has = (p) => props.some((x) => x.toLowerCase() === p);
    const category = String((entry && entry.category) || '');
    const ranged = /ranged/i.test(category);
    const str = mod(scores.str), dex = mod(scores.dex);
    let ability = ranged ? 'dex' : 'str';
    if (has('finesse')) ability = dex > str ? 'dex' : 'str';
    const abilityMod = ability === 'dex' ? dex : str;
    const proficient = weaponProficient(item, entry, opts.cs);
    const magic = magicBonus(item);
    const toHit = abilityMod + (proficient ? prof : 0) + magic;
    const notes = [];

    let dmg = null;
    let source = null;
    if (entry && entry.damage) { dmg = parseDamage(entry.damage); if (dmg && entry.versatile) dmg.versatile = entry.versatile; source = 'catalog'; }
    else if (item.damage) { dmg = parseDamage(item.damage); source = dmg ? 'item' : null; }
    if (dmg && !dmg.type && item.damageType) dmg.type = String(item.damageType).toLowerCase();

    // Two-weapon fighting (SRD 5.1): the off-hand light weapon adds no positive ability modifier.
    const offHand = item.equipped === 'off' || item.slot === 'off';
    let damageMod = abilityMod + magic;
    if (offHand) {
      damageMod = Math.min(abilityMod, 0) + magic;
      notes.push('off-hand: no ability modifier to damage');
    }
    if (!proficient) notes.push('not proficient');
    if (has('heavy')) notes.push('heavy');
    if (has('loading')) notes.push('loading');

    return {
      id: item.id || null,
      name: item.name || (entry && entry.name) || 'Weapon',
      slot: item.equipped || null,
      ability: ability,
      toHit: toHit,
      toHitText: signed(toHit),
      damage: dmg ? withMod(dmg.dice, damageMod) : null,
      versatile: dmg && dmg.versatile ? withMod(dmg.versatile, damageMod) : null,
      damageType: dmg ? dmg.type : '',
      range: (entry && entry.range) || item.range || null,
      ranged: ranged,
      reach: has('reach'),
      properties: props,
      proficient: proficient,
      magic: magic,
      offHand: offHand,
      source: source,
      notes: notes,
    };
  }

  // Every equipped weapon on the sheet, in the order main hand, off hand, the rest.
  function weaponAttacks(items, opts) {
    const order = { main: 0, off: 1 };
    return (items || [])
      .filter((it) => isWeaponItem(it) && it.equipped)
      .sort((a, b) => (order[a.equipped] === undefined ? 2 : order[a.equipped]) - (order[b.equipped] === undefined ? 2 : order[b.equipped]))
      .map((it) => weaponAttack(it, opts));
  }

  /* ---------- 3.2 Spellcasting: save DC, spell attack, cantrips ---------- */

  // Spellcasting ability by class name, for sheets without a builder build (SRD 5.1 classes,
  // plus the artificer, which old sheets may name).
  const CASTER_ABILITY = { bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int', artificer: 'int' };
  // Half casters (2014) cast from level 2.
  const FIRST_CASTING_LEVEL = { paladin: 2, ranger: 2 };

  // The sheet's spellcasting classes: [{ id, name, level, ability }].
  // From the builder's build when there is one (rules: RULES_SRD5 with homebrew merged),
  // else from the class text ("Wizard", "Fighter 3 / Wizard 2") and the sheet's level.
  function castingClasses(cs, build, rules) {
    cs = cs || {};
    const out = [];
    if (build && Array.isArray(build.classes) && build.classes.length && rules && rules.classes) {
      build.classes.forEach((c) => {
        const def = c && rules.classes[c.id];
        const sc = def && def.spellcasting;
        const level = Number(c.level) || 0;
        if (!sc || !sc.ability || level < (FIRST_CASTING_LEVEL[c.id] || 1)) return;
        out.push({ id: c.id, name: def.name, level: level, ability: sc.ability });
      });
      return out;
    }
    const text = String(cs.characterClass || '');
    const parts = text.split('/').map((p) => p.trim()).filter(Boolean);
    parts.forEach((p) => {
      const m = p.match(/^(.*?)\s*(\d+)?$/);
      const name = (m ? m[1] : p).trim();
      const id = name.toLowerCase();
      const level = m && m[2] ? Number(m[2]) : (parts.length === 1 ? Number(cs.level) || 1 : 0);
      const ability = CASTER_ABILITY[id];
      if (!ability || level < (FIRST_CASTING_LEVEL[id] || 1)) return;
      out.push({ id: id, name: name, level: level, ability: ability });
    });
    return out;
  }

  // Save DC = 8 + PB + mod, spell attack = PB + mod, per class.
  // bonus: { dc, attack } from items (e.g. a +1 wand), added to every class.
  function spellStats(classes, scores, prof, bonus) {
    bonus = bonus || {};
    return (classes || []).map((c) => {
      const m = mod((scores || {})[c.ability]);
      const attack = (Number(prof) || 0) + m + (Number(bonus.attack) || 0);
      return Object.assign({}, c, { saveDc: 8 + (Number(prof) || 0) + m + (Number(bonus.dc) || 0), attack: attack, attackText: signed(attack) });
    });
  }

  // Cantrip damage grows at character levels 5, 11 and 17: "1d10" -> "2d10" at 5th.
  function cantripTier(level) {
    const L = Number(level) || 1;
    return 1 + (L >= 5 ? 1 : 0) + (L >= 11 ? 1 : 0) + (L >= 17 ? 1 : 0);
  }
  function scaleDice(dice, times) {
    return String(dice).replace(/^(\d*)d(\d+)$/i, (m, n, s) => ((Number(n) || 1) * times) + 'd' + s);
  }

  const ABILITY_NAMES = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };

  // One cantrip line for a spell from the sheet's list.
  // srd: the matching entry of rules/srd5-spells.js (attack, save, damageType, desc), or null.
  // stats: spellStats() result; level: character level.
  // -> null for a cantrip that deals no damage, else
  //    { name, kind: 'attack' | 'save' | 'damage', attack, attackText, save, saveDc, damage, damageType,
  //      beams, className, range }
  function cantripLine(spell, srd, stats, level) {
    if (!spell || Number(spell.levelNum !== undefined ? spell.levelNum : spell.level) !== 0) return null;
    const desc = srd ? [].concat(srd.desc || []).join(' ') : String(spell.desc || '');
    let dice = null, type = '';
    const m = desc.match(/(\d+d\d+)\s+([a-z]+)\s+damage/i);
    if (m) { dice = m[1]; type = m[2].toLowerCase(); }
    if (!dice && spell.damage) {
      const d = String(spell.damage).match(/^(\d+d\d+)\s*([a-z]+)?/i);
      if (d) { dice = d[1]; type = (d[2] || '').toLowerCase(); }
    }
    if (!dice) return null;
    if (srd && srd.damageType) type = String(srd.damageType).toLowerCase();
    // Which class casts it: the first caster whose list has it, else the first caster.
    const classes = (srd && srd.classes) || (spell.classes || []).map((c) => String(c).toLowerCase());
    const st = (stats || []).find((s) => classes.includes(s.id)) || (stats || [])[0] || null;
    const tier = cantripTier(level);
    // Eldritch Blast makes more beams instead of bigger dice.
    const beams = /more than one beam/i.test(desc) ? tier : 1;
    let save = srd && srd.save ? srd.save : null;
    if (!save) {
      const s = desc.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i);
      if (s) save = ABILITY_NAMES[s[1].toLowerCase()];
    }
    const attack = (srd && srd.attack) || (/spell attack/i.test(desc) ? (/melee spell attack/i.test(desc) ? 'melee' : 'ranged') : null);
    return {
      name: spell.name,
      kind: attack ? 'attack' : save ? 'save' : 'damage',
      attackType: attack,
      attack: attack && st ? st.attack : null,
      attackText: attack && st ? st.attackText : null,
      save: save,
      saveDc: save && st ? st.saveDc : null,
      damage: beams > 1 ? dice : scaleDice(dice, tier),
      damageType: type,
      beams: beams,
      className: st ? st.name : null,
      range: (srd && srd.range) || spell.range || null,
    };
  }

  // A critical hit rolls the damage dice twice (SRD 5.1): "1d8+3" -> "2d8+3", "2d6+1d4-1" -> "4d6+2d4-1".
  function critDamage(expr) {
    return String(expr || '').replace(/(\d*)d(\d+)/gi, (m, n, sides) => (2 * (Number(n) || 1)) + 'd' + sides);
  }

  // The sheet's ability scores with item bonuses added: cs = characterStats, totals = item bonus totals.
  function effectiveScores(cs, totals) {
    const out = {};
    ABILITIES.forEach((k) => { out[k] = Number(cs && cs[k] !== undefined ? cs[k] : 10) + (Number(totals && totals[k]) || 0); });
    return out;
  }

  root.SheetMaths = {
    mod: mod, nameKey: nameKey, magicBonus: magicBonus, findWeapon: findWeapon, isWeaponItem: isWeaponItem,
    weaponProficient: weaponProficient, parseDamage: parseDamage, weaponAttack: weaponAttack, weaponAttacks: weaponAttacks,
    effectiveScores: effectiveScores, critDamage: critDamage,
    CASTER_ABILITY: CASTER_ABILITY, castingClasses: castingClasses, spellStats: spellStats,
    cantripTier: cantripTier, scaleDice: scaleDice, cantripLine: cantripLine,
  };
})(typeof window !== 'undefined' ? window : this);
