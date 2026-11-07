// Run with: npm test   (node --test tests/)
// The DM's ambience player state (ambience.js, feature plan 8.1).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mod = require('../ambience.js');
const A = (mod && mod.Ambience) || globalThis.Ambience;

test('ambience: only audio links and audio data URLs are played', () => {
  assert.equal(A.normalize({ url: 'javascript:alert(1)' }), null);
  assert.equal(A.normalize({ url: 'data:text/html,hi' }), null);
  assert.equal(A.normalize(null), null);
  const s = A.normalize({ url: 'https://example.org/rain.mp3', volume: 3, offset: -4, title: 'x'.repeat(100) });
  assert.deepEqual([s.volume, s.offset, s.title.length, s.playing], [1, 0, 80, false]);
  assert.equal(A.normalize({ url: 'data:audio/mpeg;base64,AAAA' }).url.slice(0, 10), 'data:audio');
  assert.equal(A.normalize({ url: 'https://x/a.ogg' }).volume, 0.6, 'default volume');
});

test('ambience: everyone works out the same position, looping', () => {
  const s = A.play({ url: 'https://x/a.mp3', offset: 10 }, 1000);
  assert.equal(A.position(s, 31000), 40, '10 s in, then 30 s of playing');
  assert.equal(A.position(s, 31000, 25), 15, 'a 25 s track loops');
  const p = A.pause(s, 6000);
  assert.deepEqual([p.playing, p.offset, p.at], [false, 15, 0]);
  assert.equal(A.position(p, 999999), 15, 'paused: stays where it stopped');
  assert.equal(A.play(p, 7000).offset, 15, 'plays on from there');
});

test('ambience: titles from links and file names', () => {
  assert.equal(A.titleFrom('https://cdn.example.org/sounds/forest%20night.mp3?v=2'), 'forest night');
  assert.equal(A.titleFrom('Tavern Crowd.ogg'), 'Tavern Crowd');
  assert.equal(A.titleFrom(''), 'Ambience');
});
