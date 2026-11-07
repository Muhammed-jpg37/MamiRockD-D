/* ========================================================
   AMBIENCE (feature plan 8.1): the DM's background sound on
   the table, the same for everyone in the campaign.

   vtt/<campaign>/audio = { url, title, playing, at, offset, volume }
     url      a link to an audio file, or a short uploaded file
              as a data: URL (no Firebase Storage yet)
     playing  true while it plays; at = when it started (ms),
     offset   where in the track it started (s); paused: where
              it stopped
     volume   0..1, set by the DM (each listener can also mute)
   No DOM; runs in the browser (window.Ambience) and in Node.
   ======================================================== */
(function (root) {
  'use strict';

  const MAX_UPLOAD = 1.5 * 1024 * 1024;   // bytes of an uploaded file (it is stored in the database)

  // A safe audio state, or null when there is nothing to play.
  function normalize(a) {
    if (!a || typeof a !== 'object') return null;
    const url = String(a.url || '');
    if (!/^https?:\/\//i.test(url) && !/^data:audio\//i.test(url)) return null;
    const vol = Number(a.volume);
    return {
      url: url,
      title: String(a.title || '').slice(0, 80),
      playing: !!a.playing,
      at: Number(a.at) || 0,
      offset: Math.max(0, Number(a.offset) || 0),
      volume: isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.6,
    };
  }

  // Where the track should be now (seconds): offset, plus the time since it started while playing,
  // wrapped by the track's duration (it loops) when the duration is known.
  function position(a, now, duration) {
    const s = normalize(a);
    if (!s) return 0;
    let p = s.offset + (s.playing && s.at ? Math.max(0, (Number(now) - s.at) / 1000) : 0);
    const d = Number(duration);
    if (isFinite(d) && d > 0) p = p % d;
    return p;
  }

  // The state after play / pause, worked out from what was playing.
  function play(a, now) {
    const s = normalize(a);
    if (!s) return null;
    return Object.assign({}, s, { playing: true, at: Number(now) });
  }
  function pause(a, now, duration) {
    const s = normalize(a);
    if (!s) return null;
    return Object.assign({}, s, { playing: false, offset: position(s, now, duration), at: 0 });
  }

  // A title from a link or file name: "https://x/forest-night.mp3?x=1" -> "forest-night".
  function titleFrom(name) {
    const base = String(name || '').split(/[?#]/)[0].split('/').pop() || '';
    return decodeURIComponent(base).replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 80) || 'Ambience';
  }

  root.Ambience = { MAX_UPLOAD: MAX_UPLOAD, normalize: normalize, position: position, play: play, pause: pause, titleFrom: titleFrom };
})(typeof window !== 'undefined' ? window : this);
