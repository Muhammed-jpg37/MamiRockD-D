// Run with: npm test   (node --test tests/)
// Checks how spells saved on a sheet are refreshed from the catalog (spell-saved.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { refresh, rulesetOf } = require('../spell-saved.js');

let text = fs.readFileSync(path.join(__dirname, '..', 'spell-catalog.json'), 'utf8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const CATALOG = JSON.parse(text);

// The same lookup the site builds (index.html, buildGlobalCatalog): name or alias, per ruleset.
const MAP = new Map();
const key = (name, rs) => rs + '|' + String(name).trim().toLowerCase();
CATALOG.forEach((s) => {
  const rs = rulesetOf(s);
  if (!MAP.has(key(s.name, rs))) MAP.set(key(s.name, rs), s);
  (s.aliases || []).forEach((a) => { if (!MAP.has(key(a, rs))) MAP.set(key(a, rs), s); });
});
const find = (name, rs) => MAP.get(key(name, rs)) || null;
const cat = (name, rs) => CATALOG.find((s) => s.name === name && s.ruleset === rs);

test('an old Fireball copy gets the SRD 5.1 details, its name and book stay', () => {
  const saved = { name: 'Fireball', levelNum: 3, levelText: 'Level 3', source: 'PHB', school: 'V', schoolName: 'Evocation',
    classes: ['Sorcerer', 'Wizard', 'Warlock'], damage: '8d6 Fire', desc: 'old text' };
  const list = [saved];
  assert.equal(refresh(list, find), 1);
  const c = cat('Fireball', '2014');
  assert.equal(saved.ruleset, '2014');
  assert.equal(saved.source, 'PHB', 'PHB is one of the books the SRD entry lists');
  assert.deepEqual(saved.classes, c.classes);
  assert.equal(saved.desc, c.desc);
  assert.equal(saved.damage, c.damage);
  assert.equal(saved.name, 'Fireball');
});

test('the 2024 copy of a spell is refreshed from the 2024 entry, not the 2014 one', () => {
  const saved = { name: 'Fireball', ruleset: '2024', levelNum: 3, source: 'XPHB', desc: '' };
  refresh([saved], find);
  assert.equal(saved.desc, cat('Fireball', '2024').desc);
  assert.equal(saved.source, cat('Fireball', '2024').books.includes('XPHB') ? 'XPHB' : 'SRD52');
});

test('a ruleset is filled in from the book for spells saved before rulesets', () => {
  const saved = { name: 'Fireball', source: 'XPHB' };
  refresh([saved], find);
  assert.equal(saved.ruleset, '2024');
});

test('made-up damage goes when the catalog has none', () => {
  const noDamage = CATALOG.find((s) => s.license === 'srd51' && !s.damage);
  const saved = { name: noDamage.name, ruleset: '2014', damage: '2d6 Force', classes: ['Wizard'] };
  refresh([saved], find);
  assert.equal(saved.damage, '');
  assert.deepEqual(saved.classes, noDamage.classes);
});

test('a spell saved under an old book name finds its SRD entry, and keeps that name', () => {
  const aliased = CATALOG.find((s) => s.license === 'srd51' && s.aliases && s.aliases.length);
  assert.ok(aliased, 'the catalog has renamed SRD spells');
  const saved = { name: aliased.aliases[0], ruleset: '2014', desc: '' };
  assert.equal(refresh([saved], find), 1);
  assert.equal(saved.name, aliased.aliases[0]);
  assert.equal(saved.desc, aliased.desc);
});

test('name-only (non-SRD) spells, unknown spells and broken entries are left alone', () => {
  const nameOnly = CATALOG.find((s) => s.detail === 'name-only');
  const a = { name: nameOnly.name, ruleset: nameOnly.ruleset, damage: '1d8', classes: ['Wizard'], desc: 'mine', levelNum: 9 };
  const b = { name: 'My Homebrew Bolt', ruleset: '2014', damage: '3d10', desc: 'custom' };
  const before = JSON.stringify([a, b]);
  const list = [a, b, null, { desc: 'no name' }];
  assert.equal(refresh(list, find), 0);
  assert.equal(JSON.stringify([a, b]), before);
});

test('a spell is never matched across rulesets', () => {
  const only2024 = CATALOG.find((s) => s.ruleset === '2024' && s.license === 'srd52' && !find(s.name, '2014'));
  assert.ok(only2024, 'some spells exist only in the 2024 rules');
  const saved = { name: only2024.name, ruleset: '2014', desc: 'kept' };
  assert.equal(refresh([saved], find), 0);
  assert.equal(saved.desc, 'kept');
});

test('refreshing twice changes nothing the second time', () => {
  const list = CATALOG.filter((s) => s.license !== 'none').slice(0, 40).map((s) => ({ name: s.name, ruleset: s.ruleset, desc: 'x' }));
  assert.equal(refresh(list, find), 40);
  assert.equal(refresh(list, find), 0);
});

test('bad input does nothing', () => {
  assert.equal(refresh(null, find), 0);
  assert.equal(refresh([{ name: 'Fireball' }], null), 0);
});
