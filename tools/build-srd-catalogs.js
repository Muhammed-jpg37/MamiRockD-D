#!/usr/bin/env node
/* Builds the SRD catalogs in rules/catalog/ (monsters, equipment, magic items, conditions,
   rule sections) for both rulesets, from the 5e-bits data.

   Source: https://github.com/5e-bits/5e-srd-api — packages/5e-database/src/{2014,2024}/en/
   (dataset under the MIT licence; the game text is SRD 5.1 / SRD 5.2, CC-BY-4.0).

   Usage:
     mkdir srd && cd srd
     for y in 2014 2024; do for f in Monsters Equipment Magic-Items Conditions Rules; do
       curl -sf -o "$y-$f.json" "https://raw.githubusercontent.com/5e-bits/5e-srd-api/main/packages/5e-database/src/$y/en/5e-SRD-$f.json"
     done; done            # 2024 has no Rules file; that one 404s and is skipped
     node tools/build-srd-catalogs.js srd

   Writes rules/catalog/srd51-*.json and srd52-*.json. Each file is
   { meta: { ruleset, source, license, attribution, generatedFrom }, entries: [...] }.
   Run it again to regenerate; do not edit the output by hand.
   The site loads these files only when the Rules section is opened (rules-catalog.js). */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node tools/build-srd-catalogs.js <folder with 2014-*.json and 2024-*.json>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', 'rules', 'catalog');
fs.mkdirSync(OUT, { recursive: true });

const RULESETS = {
  2014: {
    key: 'srd51', ruleset: '2014', source: 'SRD 5.1',
    attribution: 'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'
  },
  2024: {
    key: 'srd52', ruleset: '2024', source: 'SRD 5.2',
    attribution: 'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'
  }
};
const DATASET = 'Converted from the 5e-bits dataset (https://github.com/5e-bits/5e-srd-api), MIT licence.';

const read = (year, name) => {
  const f = path.join(dir, year + '-' + name + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const idOf = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);
const paras = (d) => (Array.isArray(d) ? d : String(d || '').split('\n')).map((p) => String(p).trim()).filter(Boolean);
const signed = (n) => (n >= 0 ? '+' : '') + n;
const costText = (c) => (c && c.quantity != null ? c.quantity + ' ' + c.unit : null);
const crText = (cr) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));
const drop = (o) => { Object.keys(o).forEach((k) => { const v = o[k]; if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete o[k]; }); return o; };

function write(rs, name, entries) {
  const meta = { ruleset: rs.ruleset, source: rs.source, license: 'CC-BY-4.0', attribution: rs.attribution, generatedFrom: DATASET, count: entries.length };
  const file = path.join(OUT, rs.key + '-' + name + '.json');
  fs.writeFileSync(file, JSON.stringify({ meta: meta, entries: entries }) + '\n');
  console.log(path.relative(process.cwd(), file), entries.length, Math.round(fs.statSync(file).size / 1024) + ' KB');
}

/* ---------- Monsters ---------- */

const ABIL = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const SHORT = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };

function action(a) {
  const out = { name: a.name, desc: a.desc || '' };
  if (typeof a.attack_bonus === 'number') out.attack = a.attack_bonus;
  const dmg = (a.damage || []).filter((d) => d && d.damage_dice).map((d) => drop({ dice: String(d.damage_dice).replace(/\s+/g, ''), type: d.damage_type && d.damage_type.name }));
  if (dmg.length) out.damage = dmg;
  if (a.dc && a.dc.dc_value) out.dc = drop({ ability: a.dc.dc_type && a.dc.dc_type.name, value: a.dc.dc_value, success: a.dc.success_type });
  if (a.usage) out.usage = a.usage.type === 'per day' ? a.usage.times + '/day' : a.usage.type === 'recharge on roll' ? 'Recharge ' + a.usage.min_value + '–6' : a.usage.type;
  return out;
}

function monster(m, rs) {
  const profs = m.proficiencies || [];
  const pick = (prefix) => profs.filter((p) => p.proficiency && p.proficiency.index.startsWith(prefix))
    .map((p) => p.proficiency.name.replace(/^(Saving Throw|Skill): /, '') + ' ' + signed(p.value)).join(', ');
  const ac = (m.armor_class || [])[0] || {};
  const acNote = ac.armor ? ac.armor.map((a) => a.name).join(', ') : (ac.type && ac.type !== 'dex' ? ac.type : (ac.desc || ''));
  const senses = Object.keys(m.senses || {}).map((k) => (k === 'passive_perception' ? 'passive Perception ' + m.senses[k] : k.replace(/_/g, ' ') + ' ' + m.senses[k])).join(', ');
  const speed = Object.keys(m.speed || {}).map((k) => (k === 'walk' ? m.speed[k] : k + ' ' + m.speed[k] + (k === 'hover' ? '' : ''))).join(', ');
  const list = (a) => (a || []).map((x) => (typeof x === 'string' ? x : x.name)).join(', ');
  const abilities = {};
  ABIL.forEach((a) => { abilities[SHORT[a]] = m[a]; });
  return drop({
    id: idOf(m.index || m.name), name: m.name, ruleset: rs.ruleset,
    size: m.size, type: cap(m.type) + (m.subtype ? ' (' + m.subtype + ')' : ''), alignment: m.alignment,
    ac: ac.value, acNote: acNote,
    hp: m.hit_points, hitDice: m.hit_points_roll || m.hit_dice,
    speed: speed, abilities: abilities,
    saves: pick('saving-throw-'), skills: pick('skill-'),
    vulnerabilities: (m.damage_vulnerabilities || []).join(', '),
    resistances: (m.damage_resistances || []).join(', '),
    immunities: (m.damage_immunities || []).join(', '),
    conditionImmunities: list(m.condition_immunities),
    senses: senses, languages: m.languages,
    cr: crText(m.challenge_rating), crValue: m.challenge_rating, xp: m.xp, pb: m.proficiency_bonus,
    traits: (m.special_abilities || []).map(action),
    actions: (m.actions || []).map(action),
    bonusActions: (m.bonus_actions || []).map(action),
    reactions: (m.reactions || []).map(action),
    legendary: (m.legendary_actions || []).map(action)
  });
}

/* ---------- Equipment ---------- */

function equipment(e, rs) {
  const cats = (e.equipment_categories || []).map((c) => c.index);
  if (e.equipment_category && !cats.includes(e.equipment_category.index)) cats.unshift(e.equipment_category.index);
  const has = (c) => cats.some((x) => x === c || x.endsWith('-' + c) || x.startsWith(c));
  let kind = 'gear';
  if (e.damage || has('weapon')) kind = 'weapon';
  else if (has('shield') || /shield/i.test(e.name) && e.armor_class) kind = 'shield';
  else if (e.armor_class || has('armor')) kind = 'armor';
  else if (has('tool') || has('kits') || has('instrument')) kind = 'tool';
  else if (has('ammunition')) kind = 'ammunition';
  else if (has('mount') || has('vehicle')) kind = 'mount';
  else if (e.contents && e.contents.length) kind = 'pack';
  // The most telling category: "Martial Melee Weapons" over "Weapons", "Heavy Armor" over "Armor".
  const GENERIC = /^(weapons?|armor|adventuring gear|equipment|tools?|melee weapons|ranged weapons|simple weapons|martial weapons)$/i;
  const names = (e.equipment_categories || []).map((c) => c.name).concat(e.equipment_category ? [e.equipment_category.name] : []);
  const cat = e.category_range || (e.armor_category ? (e.armor_category === 'Shield' ? 'Shields' : e.armor_category + ' Armor') : null) || (e.gear_category && e.gear_category.name) || e.tool_category ||
    names.find((n) => !GENERIC.test(n)) || names[0];
  const range = e.range && e.range.long ? e.range.normal + '/' + e.range.long : (e.throw_range ? e.throw_range.normal + '/' + e.throw_range.long : null);
  const armorCat = e.armor_category || (cats.find((c) => /^(light|medium|heavy)-armor$/.test(c)) || '').replace('-armor', '');
  return drop({
    id: idOf(e.index || e.name), name: e.name, ruleset: rs.ruleset, kind: kind, category: cat,
    cost: costText(e.cost), weight: typeof e.weight === 'number' ? e.weight : null,
    damage: e.damage ? String(e.damage.damage_dice) + ' ' + (e.damage.damage_type ? e.damage.damage_type.name.toLowerCase() : '') : null,
    versatile: e.two_handed_damage ? e.two_handed_damage.damage_dice : null,
    properties: (e.properties || []).map((p) => p.name).filter((n) => n !== 'Monk'),
    mastery: e.mastery && e.mastery.name,
    range: range,
    weaponCategory: e.weapon_category || (cats.includes('martial-weapons') ? 'Martial' : cats.includes('simple-weapons') ? 'Simple' : null),
    armor: e.armor_class ? drop({ base: e.armor_class.base, dex: !!e.armor_class.dex_bonus, max: e.armor_class.max_bonus, category: cap(armorCat) || null }) : null,
    strMin: e.str_minimum || null,
    stealthDisadvantage: e.stealth_disadvantage || null,
    contents: (e.contents || []).map((c) => ({ name: c.item && c.item.name, qty: c.quantity })),
    desc: paras(e.desc || e.description).concat(e.special ? paras(e.special) : [])
  });
}

/* ---------- Magic items ---------- */

function magicItems(list, rs) {
  const parentOf = {};
  list.forEach((m) => (m.variants || []).forEach((v) => { parentOf[v.index] = m.name; }));
  return list.map((m) => {
    const d = paras(m.desc);
    // The first line is "Armor (medium or heavy), uncommon (requires attunement)" style.
    const head = d[0] && /^(armor|weapon|wondrous|ring|rod|staff|wand|potion|scroll|ammunition)/i.test(d[0]) ? d.shift() : null;
    let att = m.attunement;
    if (att === undefined && head) att = /requires attunement/i.test(head) ? (head.match(/\(requires attunement([^)]*)\)/i) || [])[1] || true : false;
    if (typeof att === 'string') att = att.trim() ? 'requires attunement' + att : true;
    return drop({
      id: idOf(m.index || m.name), name: m.name, ruleset: rs.ruleset, kind: 'magic',
      category: m.equipment_category && m.equipment_category.name, typeLine: head,
      rarity: m.rarity && m.rarity.name, attunement: att || null,
      variantOf: parentOf[m.index] || null, hasVariants: (m.variants || []).length ? true : null,
      desc: d
    });
  });
}

/* ---------- Conditions and rules ---------- */

const conditions = (list, rs) => list.map((c) => ({ id: idOf(c.index || c.name), name: c.name, ruleset: rs.ruleset, desc: paras(c.desc || c.description) }));

// Rule sections nest (Combat > Actions in Combat > Dodge): chapter is the top level, section the one above.
function rules(list, rs) {
  const parent = {};
  const byIndex = {};
  list.forEach((r) => { byIndex[r.index] = r; (r.children || []).forEach((ch) => { parent[ch.index] = r.index; }); });
  const top = (idx) => { let i = idx, n = 0; while (parent[i] && n++ < 10) i = parent[i]; return byIndex[i] ? byIndex[i].name : null; };
  return list.filter((r) => r.desc).map((r) => drop({
    id: idOf(r.index), name: r.name, ruleset: rs.ruleset,
    chapter: top(r.index) || r.name,
    section: parent[r.index] && parent[parent[r.index]] ? byIndex[parent[r.index]].name : null,
    desc: paras(r.desc)
  }));
}

/* ---------- Run ---------- */

[2014, 2024].forEach((year) => {
  const rs = RULESETS[year];
  const mon = read(year, 'Monsters');
  if (mon) write(rs, 'monsters', mon.map((m) => monster(m, rs)).sort((a, b) => a.name.localeCompare(b.name)));
  const eq = read(year, 'Equipment');
  if (eq) write(rs, 'items', eq.map((e) => equipment(e, rs)).sort((a, b) => a.name.localeCompare(b.name)));
  const mi = read(year, 'Magic-Items');
  if (mi) write(rs, 'magic-items', magicItems(mi, rs).sort((a, b) => a.name.localeCompare(b.name)));
  const co = read(year, 'Conditions');
  if (co) write(rs, 'conditions', conditions(co, rs));
  const ru = read(year, 'Rules');
  if (ru) write(rs, 'rules', rules(ru, rs));
});
