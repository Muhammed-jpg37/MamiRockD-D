// Run with: npm test   (node --test tests/)
// The Campaign screen's small helpers (campaign-home.js): the HP bar of a party card and note times.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// In Node the screen puts itself on module.exports; in the browser runner, on window.
const mod = require('../campaign-home.js');
const CH = (mod && mod.CampaignHome) || globalThis.CampaignHome;

test('campaign screen: HP bar shows current / max, temp HP and a colour by how hurt', () => {
  const ok = CH.hpHtml({ current: 44, max: 52 });
  assert.match(ok, /44 \/ 52/);
  assert.match(ok, /ch-hp-fill ok/);
  assert.match(ok, /width:85%/);
  const low = CH.hpHtml({ current: 9, max: 38, temp: 5 });
  assert.match(low, /9 \/ 38 <em>\+5<\/em>/);
  assert.match(low, /ch-hp-fill low/);
  assert.match(CH.hpHtml({ current: 19, max: 38 }), /ch-hp-fill mid/);
});

test('campaign screen: no max HP means "not set", and HP never goes below 0', () => {
  assert.match(CH.hpHtml(null), /HP not set/);
  assert.match(CH.hpHtml({ current: 5, max: 0 }), /HP not set/);
  assert.match(CH.hpHtml({ current: -4, max: 10 }), /0 \/ 10/);
});

test('campaign screen: note times read as "x ago"', () => {
  const now = Date.now();
  assert.equal(CH.relTime(now - 30 * 1000), 'just now');
  assert.equal(CH.relTime(now - 10 * 60 * 1000), '10 min ago');
  assert.equal(CH.relTime(now - 3 * 3600 * 1000), '3 h ago');
  assert.equal(CH.relTime(now - 2 * 86400 * 1000), '2 d ago');
  assert.equal(CH.relTime(0), '');
});
