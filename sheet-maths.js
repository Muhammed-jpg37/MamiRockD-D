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
  };
})(typeof window !== 'undefined' ? window : this);
