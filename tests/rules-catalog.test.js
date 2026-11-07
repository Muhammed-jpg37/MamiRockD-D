// Run with: npm test   (node --test tests/)
// The Rules section (rules-catalog.js): its small Markdown renderer and its search.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// In Node the section puts itself on module.exports; in the browser runner, on window.
const mod = require('../rules-catalog.js');
const RC = (mod && mod.RulesCatalog) || globalThis.RulesCatalog;

test('rules section: bold, italics, lists and paragraphs', () => {
  const html = RC.md(['**Can\'t See.** You *can\'t* see.', '- one', '- two', 'After.']);
  assert.match(html, /<p><strong>Can&#39;t See\.<\/strong> You <em>can&#39;t<\/em> see\.<\/p>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<p>After\.<\/p>$/);
});

test('rules section: Markdown tables become tables, and text is escaped', () => {
  const html = RC.md(['| Pace | Distance |', '|---|---|', '| Fast | 4 miles |', '<script>x</script>']);
  assert.match(html, /<table class="rc-table"><tr><th>Pace<\/th><th>Distance<\/th><\/tr><tr><td>Fast<\/td><td>4 miles<\/td><\/tr><\/table>/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('rules section: search by name, by text for rules, and by filters', () => {
  const goblin = { name: 'Goblin', type: 'Humanoid (goblinoid)', crValue: 0.25 };
  const dragon = { name: 'Adult Red Dragon', type: 'Dragon', crValue: 17 };
  assert.ok(RC.matches('monsters', goblin, 'gob', ''));
  assert.ok(RC.matches('monsters', goblin, 'humanoid', ''));
  assert.ok(RC.matches('monsters', goblin, '', '0-1'));
  assert.ok(!RC.matches('monsters', dragon, '', '0-1'));
  assert.ok(RC.matches('monsters', dragon, '', '17-30'));
  const rule = { name: 'Cover', chapter: 'Combat', desc: ['Walls, trees and creatures can provide cover.'] };
  assert.ok(RC.matches('rules', rule, 'trees', ''));
  assert.ok(!RC.matches('items', { name: 'Rope', desc: ['trees'] }, 'trees', ''));
  assert.ok(RC.matches('items', { name: 'Rope', kind: 'gear' }, '', 'gear'));
  assert.ok(!RC.matches('items', { name: 'Longsword', kind: 'weapon' }, '', 'gear'));
  assert.ok(RC.matches('magic', { name: 'Bag of Holding', rarity: 'Uncommon' }, '', 'Uncommon'));
});
