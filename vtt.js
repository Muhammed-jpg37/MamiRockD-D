/* ========================================================
   VIRTUAL TABLETOP (VTT)
   Map, pan/zoom, grid and tokens, synced live through Firebase
   at vtt/<ROOM_ID>. Local edits go out through onVttChange();
   remote changes come in through applyRemote().
   ======================================================== */
(function () {
  'use strict';

  const DEFAULT_BOARD = { cols: 30, rows: 20 };   // empty board when no map is loaded
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 6;
  const LONG_PRESS_MS = 500;
  const TAP_SLOP = 6;                             // px a pointer may move and still count as a tap
  const TOKEN_IMG_MAX = 256;                      // token pictures are downscaled to this
  const TOKEN_COLORS = ['#c9a227', '#a83c32', '#4a8ec4', '#5e9e63', '#9a6fc4', '#d08a3c', '#9d9d9d'];
  const ROOM_ID = 'main';
  const DRAG_SYNC_MS = 100;                       // live position updates while dragging, at most this often
  const GRID_SYNC_MS = 250;                       // grid inputs fire per keystroke; write once typing settles
  const FOG_SYNC_MS = 250;                        // a fog brush stroke is written in batches at most this often
  const MAP_MAX_EDGE = 2048;                      // uploaded maps are shrunk to this before going to Storage
  const MAP_MAX_BYTES = 8 * 1024 * 1024;          // refuse anything still bigger after compression
  const MAP_INLINE_MAX_CHARS = 1500000;           // fallback maps written into the database stay under ~1.5 MB

  // Shared table state, mirrored at vtt/<ROOM_ID>.
  const vtt = {
    map: { url: null, width: 0, height: 0 },
    // offsetX/Y: where a grid line falls on the map (px), so the grid can match one drawn into the map image.
    grid: { size: 70, visible: true, color: '#000000', opacity: 0.35, offsetX: 0, offsetY: 0 },
    tokens: {},  // [id]: { id, name, x, y, size, img, color, owner, hp, hidden } — x/y in grid cells
    fog: { enabled: false, revealed: {} }   // revealed: { "x_y": true } (Firebase keys can't hold . or /)
  };

  // Local-only view state.
  const view = { offsetX: 0, offsetY: 0, zoom: 1 };

  let root = null;
  let canvas = null;
  let ctx = null;
  let mapImg = null;
  let wantedMapUrl = null;      // map URL being loaded or shown; guards against out-of-order loads
  let selectedId = null;
  let unsubscribe = null;
  let gridSaveTimer = null;
  let storageFailed = false;    // a Storage upload failed this session; use the database fallback
  let fogMode = null;           // DM brush: null (move) | 'reveal' | 'hide'
  let fogBrush = 1;             // brush width in cells
  let fogPending = {};          // painted cells not yet written: { "x_y": true | null }
  let fogMask = null;           // 1 px per cell canvas, stretched over the board
  let fogMaskKey = '';          // what fogMask was built for, so it's rebuilt only on change
  let fogVersion = 0;           // bumped whenever revealed cells change
  let drawQueued = false;
  const imgCache = {};

  /* ---------- Styles ---------- */

  function injectStyles() {
    if (document.getElementById('vtt-styles')) return;
    const css = `
      #vtt-view-container {
        flex-direction: column;
        width: 100%;
        height: calc(100vh - 160px);
        height: calc(100dvh - 160px);
        min-height: 420px;
        margin-top: 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--bg);
        color: var(--text);
        font-family: var(--font-body);
        overflow: hidden;
        position: relative;
      }
      #vtt-view-container * { box-sizing: border-box; }
      .vtt-toolbar {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
        padding: 8px 10px;
        background: linear-gradient(180deg, var(--panel-hi), var(--panel-lo));
        border-bottom: 1px solid var(--border);
      }
      .vtt-group { display: flex; align-items: center; gap: 6px; }
      .vtt-group + .vtt-group { padding-left: 10px; border-left: 1px solid var(--border); }
      .vtt-toolbar label { font-family: var(--font-display); font-size: 11px; letter-spacing: .05em; color: var(--text-dim); display: flex; align-items: center; gap: 4px; }
      .vtt-toolbar input[type=number] { width: 58px; }
      .vtt-toolbar input[type=number].vtt-num-sm { width: 50px; }
      .vtt-toolbar input[type=number], .vtt-toolbar input[type=text], .vtt-form input[type=text] {
        background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 4px 6px; font-family: var(--font-body);
      }
      .vtt-toolbar input[type=color], .vtt-form input[type=color] { width: 28px; height: 24px; padding: 0; border: 1px solid var(--border); background: none; border-radius: 4px; }
      .vtt-zoom-label { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); min-width: 44px; text-align: right; }
      .vtt-stage { position: relative; flex: 1; min-height: 0; background: var(--surface-inset); }
      .vtt-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: grab; display: block; }
      .vtt-stage canvas.vtt-grabbing { cursor: grabbing; }
      .vtt-hint { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: var(--text-faint); font-family: var(--font-display); text-align: center; pointer-events: none; }
      .vtt-pop {
        position: absolute; z-index: 20; min-width: 160px;
        background: var(--surface-1); border: 1px solid var(--line-strong); border-radius: var(--radius);
        box-shadow: var(--shadow-2); padding: 6px; display: flex; flex-direction: column; gap: 4px;
      }
      .vtt-pop button { text-align: left; }
      .vtt-pop .vtt-pop-title { font-family: var(--font-display); font-size: 12px; color: var(--accent); padding: 2px 4px 4px; border-bottom: 1px solid var(--border); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vtt-pop .vtt-row { display: flex; gap: 4px; flex-wrap: wrap; }
      .vtt-pop .vtt-row button.active { border-color: var(--accent); color: var(--accent); }
      .vtt-form { gap: 8px; padding: 10px; min-width: 220px; }
      .vtt-form label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-dim); }
      .vtt-swatches { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
      .vtt-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
      .vtt-swatch.active { border-color: var(--text); }
      .vtt-toolbar select {
        background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 3px 4px; font-family: var(--font-body);
      }
      .vtt-toolbar .btn.vtt-on { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
      .vtt-stage canvas.vtt-painting { cursor: crosshair; }
      .vtt-dice button { min-width: 0; padding-left: 6px; padding-right: 6px; }
      .vtt-log {
        position: absolute; left: 10px; bottom: 10px; z-index: 14; width: 210px; max-height: 45%;
        display: flex; flex-direction: column;
        background: color-mix(in srgb, var(--surface-1) 92%, transparent); border: 1px solid var(--line-strong);
        border-radius: var(--radius); box-shadow: var(--shadow-2);
      }
      .vtt-log-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px 4px 10px; font-family: var(--font-display); font-size: 11px; color: var(--text-dim); border-bottom: 1px solid var(--border); }
      .vtt-log-list { overflow-y: auto; padding: 4px 0; }
      .vtt-log-row { display: grid; grid-template-columns: 1fr auto 34px; gap: 8px; align-items: baseline; padding: 2px 10px; font-size: 13px; }
      .vtt-log-row b { font-family: var(--font-mono); text-align: right; color: var(--text); }
      .vtt-log-row.vtt-log-new { background: color-mix(in srgb, var(--accent) 14%, transparent); }
      .vtt-log-who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-dim); }
      .vtt-log-row b.vtt-crit { color: var(--success); }
      .vtt-log-row b.vtt-fumble { color: var(--danger-strong); }
      .vtt-hp { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-dim); padding: 2px 0; }
      .vtt-hp .vtt-row { align-items: center; }
      .vtt-hp input { width: 56px; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 3px 5px; font-family: var(--font-mono); }
      .vtt-status {
        position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 15;
        padding: 5px 14px; border-radius: 999px; pointer-events: none;
        background: var(--surface-1); border: 1px solid var(--line-strong); box-shadow: var(--shadow-2);
        font-family: var(--font-display); font-size: 12px; color: var(--accent);
      }
      #vtt-view-container.vtt-player .vtt-dm-only { display: none !important; }
      .vtt-pop select, .vtt-form select {
        background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 4px 6px; font-family: var(--font-body);
      }
      .vtt-pop .vtt-owner { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-dim); padding: 2px 0; }
      @media (max-width: 640px) {
        #vtt-view-container { height: calc(100dvh - 120px); min-height: 360px; }
        .vtt-group + .vtt-group { padding-left: 0; border-left: none; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'vtt-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- Setup ---------- */

  window.initVtt = function () {
    if (root) { refreshRoleUi(); resizeCanvas(); return; }
    root = document.getElementById('vtt-view-container');
    if (!root) return;
    injectStyles();

    root.innerHTML = `
      <div class="vtt-toolbar">
        <div class="vtt-group vtt-dm-only">
          <button class="btn small ghost" data-act="load-map">🗺 Load Map</button>
          <button class="btn small ghost" data-act="map-url">🔗 Map URL</button>
          <input type="file" accept="image/*" data-el="map-file" hidden>
        </div>
        <div class="vtt-group vtt-dm-only">
          <label><input type="checkbox" data-el="grid-visible" checked> Grid</label>
          <label>Size <input type="number" min="10" max="400" step="0.1" data-el="grid-size"></label>
          <label title="Shift the grid so its lines sit on the map's own grid (px)">X <input type="number" step="0.5" data-el="grid-ox" class="vtt-num-sm"></label>
          <label title="Shift the grid so its lines sit on the map's own grid (px)">Y <input type="number" step="0.5" data-el="grid-oy" class="vtt-num-sm"></label>
          <input type="color" data-el="grid-color" title="Grid color">
          <button class="btn small ghost" data-act="detect-grid" title="Find the grid drawn into the map and match it">🔍 Detect</button>
        </div>
        <div class="vtt-group vtt-dm-only">
          <button class="btn small ghost" data-act="add-token">➕ Add Token</button>
          <input type="file" accept="image/*" data-el="token-file" hidden>
        </div>
        <div class="vtt-group vtt-dm-only">
          <label title="Hide unexplored areas from players"><input type="checkbox" data-el="fog-enabled"> Fog</label>
          <button class="btn small ghost" data-act="fog-reveal" title="Paint to reveal cells">☀ Reveal</button>
          <button class="btn small ghost" data-act="fog-hide" title="Paint to cover cells">🌑 Cover</button>
          <select data-el="fog-brush" title="Brush size">
            <option value="1">1×1</option><option value="3">3×3</option><option value="5">5×5</option>
          </select>
          <button class="btn small ghost" data-act="fog-reset" title="Cover the whole map again">↺</button>
        </div>
        <div class="vtt-group vtt-dice" data-el="dice">
          <span title="Roll a die; everyone sees the result">🎲</span>
          ${DICE.map((d) => '<button class="btn small ghost" data-roll="' + d + '">d' + d + '</button>').join('')}
          <button class="btn small ghost" data-act="log" title="Show or hide recent rolls">📜</button>
        </div>
        <div class="vtt-group">
          <button class="btn small ghost" data-act="zoom-out" title="Zoom out">−</button>
          <span class="vtt-zoom-label" data-el="zoom-label">100%</span>
          <button class="btn small ghost" data-act="zoom-in" title="Zoom in">+</button>
          <button class="btn small ghost" data-act="fit" title="Fit map to screen">⤢ Fit</button>
        </div>
      </div>
      <div class="vtt-stage">
        <canvas></canvas>
        <div class="vtt-status" data-el="status" style="display:none"></div>
        <div class="vtt-log" data-el="log" style="display:none">
          <div class="vtt-log-head">Recent rolls <button class="btn small ghost" data-act="log" title="Hide">✕</button></div>
          <div class="vtt-log-list" data-el="log-list"></div>
        </div>
        <div class="vtt-hint" data-el="hint"><span data-el="hint-title">Load a map to begin</span><br><small>Drag to pan · wheel or pinch to zoom</small></div>
      </div>
    `;

    canvas = root.querySelector('canvas');
    ctx = canvas.getContext('2d');

    const el = (name) => root.querySelector('[data-el="' + name + '"]');
    syncGridInputs();

    root.addEventListener('click', (e) => {
      const die = e.target.closest('[data-roll]');
      if (die) { rollDie(parseInt(die.dataset.roll, 10)); return; }
      const toggle = e.target.closest('[data-act="log"]');
      if (toggle) { logOpen = !logOpen; renderLog(); }
    });

    root.querySelector('.vtt-toolbar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'load-map') el('map-file').click();
      else if (act === 'map-url') promptMapUrl();
      else if (act === 'add-token') openAddTokenForm(btn);
      else if (act === 'zoom-in') zoomAt(canvasCenter(), 1.25);
      else if (act === 'zoom-out') zoomAt(canvasCenter(), 0.8);
      else if (act === 'fit') fitView();
      else if (act === 'fog-reveal') setFogMode(fogMode === 'reveal' ? null : 'reveal');
      else if (act === 'fog-hide') setFogMode(fogMode === 'hide' ? null : 'hide');
      else if (act === 'fog-reset') resetFog();
      else if (act === 'detect-grid') detectGridOnMap(true);
    });

    el('fog-enabled').addEventListener('change', (e) => {
      vtt.fog.enabled = e.target.checked;
      onVttChange({ fog: 'enabled' });
    });
    el('fog-brush').addEventListener('change', (e) => {
      fogBrush = parseInt(e.target.value, 10) || 1;
    });

    el('map-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) uploadMap(file);
    });

    el('grid-visible').addEventListener('change', (e) => {
      vtt.grid.visible = e.target.checked;
      onVttChange({ grid: true });
    });
    el('grid-size').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isFinite(v) || v < 10 || v > 400) return;
      vtt.grid.size = v;
      onVttChange({ grid: true });
    });
    el('grid-color').addEventListener('input', (e) => {
      vtt.grid.color = e.target.value;
      onVttChange({ grid: true });
    });
    ['ox', 'oy'].forEach((axis) => {
      el('grid-' + axis).addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (!isFinite(v)) return;
        vtt.grid[axis === 'ox' ? 'offsetX' : 'offsetY'] = v;
        onVttChange({ grid: true });
      });
    });

    bindPointerEvents();
    window.addEventListener('keydown', onKeyDown);

    new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
    refreshRoleUi();
    resizeCanvas();
    fitView();
    startSync();
  };

  /* ---------- Roles ---------- */
  // The site keeps the signed-in account in window.currentUser ({ nickname, role: 'dm' | 'player' }).
  // These checks only shape the UI: database rules can't verify roles without Firebase Auth (see Step 10).

  function myNick() {
    const u = window.currentUser;
    return u && u.nickname ? String(u.nickname).toLowerCase() : null;
  }

  function isDm() {
    const u = window.currentUser;
    return !!(u && u.role === 'dm');
  }

  // DM edits everything; a player only moves tokens they own.
  function canEdit(token) {
    if (isDm()) return true;
    const me = myNick();
    return !!(token && me && token.owner && String(token.owner).toLowerCase() === me);
  }

  // Hidden tokens, and enemies standing in fog, are invisible (and untouchable) for players.
  function isVisible(token) {
    return isDm() || (!token.hidden && !hiddenByFog(token));
  }

  // Non-DM accounts as [{ key, nickname }]; key is the lowercase nickname stored in token.owner.
  function playerAccounts() {
    let accounts = {};
    try { accounts = (typeof getStoredAccounts === 'function') ? getStoredAccounts() : {}; } catch (e) { }
    return Object.keys(accounts)
      .filter((k) => accounts[k] && accounts[k].role !== 'dm')
      .map((k) => ({ key: String(accounts[k].nickname || k).toLowerCase(), nickname: accounts[k].nickname || k }))
      .sort((a, b) => a.nickname.localeCompare(b.nickname));
  }

  function ownerName(key) {
    if (!key) return null;
    const acc = playerAccounts().find((a) => a.key === String(key).toLowerCase());
    return acc ? acc.nickname : key;
  }

  function ownerSelect(selected) {
    const sel = document.createElement('select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— DM / none —';
    sel.appendChild(none);
    const players = playerAccounts();
    if (selected && !players.some((p) => p.key === selected)) players.push({ key: selected, nickname: selected });
    players.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.key;
      o.textContent = '👤 ' + p.nickname;
      sel.appendChild(o);
    });
    sel.value = selected || '';
    return sel;
  }

  let lastRoleDm = null;
  function refreshRoleUi() {
    if (!root) return;
    const dm = isDm();
    if (dm === lastRoleDm) return;
    lastRoleDm = dm;
    root.classList.toggle('vtt-player', !dm);
    const title = root.querySelector('[data-el="hint-title"]');
    if (title) title.textContent = dm ? 'Load a map to begin' : 'Waiting for the DM to set up the table';
    if (!dm) { closePopups(); setFogMode(null); }
  }

  function syncGridInputs() {
    if (!root) return;
    const set = (name, prop, value) => {
      const input = root.querySelector('[data-el="' + name + '"]');
      if (input && document.activeElement !== input) input[prop] = value;
    };
    set('grid-visible', 'checked', vtt.grid.visible);
    set('grid-size', 'value', +vtt.grid.size.toFixed(2));
    set('grid-ox', 'value', +(Number(vtt.grid.offsetX) || 0).toFixed(1));
    set('grid-oy', 'value', +(Number(vtt.grid.offsetY) || 0).toFixed(1));
    set('grid-color', 'value', vtt.grid.color);
  }

  /* ---------- Grid detection (finds a square grid drawn into the map image) ---------- */

  const DETECT_MAX_EDGE = 1400;    // analyse a downscaled copy; plenty for 1–3 px grid lines
  const DETECT_MIN_CELL = 24;      // px in the original map; smaller repeats are usually JPEG/WebP block noise
  const DETECT_MAX_CELL = 400;

  // Runs detection on the current map and applies the result. manual: the DM pressed the button.
  function detectGridOnMap(manual) {
    if (!isDm()) return;
    if (!mapImg) { if (manual) flashStatus('Load a map first'); return; }
    setStatus('Looking for a grid…');
    const forUrl = vtt.map.url;
    // Let the status pill paint before the (short) number crunching.
    setTimeout(() => {
      readableImage(mapImg, forUrl)
        .then((img) => {
          if (vtt.map.url !== forUrl) return;   // map changed meanwhile
          const found = findGrid(img);
          if (!found) {
            flashStatus(manual ? 'No grid found in this map — set the size by hand' : 'No grid found in this map');
            return;
          }
          vtt.grid.size = found.size;
          vtt.grid.offsetX = found.offsetX;
          vtt.grid.offsetY = found.offsetY;
          syncGridInputs();
          onVttChange({ grid: true });
          flashStatus('Grid matched: ' + (+found.size.toFixed(1)) + ' px per square');
        })
        .catch(() => flashStatus("Can't analyse this image (its site blocks it) — set the size by hand"));
    }, 30);
  }

  // Pixels of maps from other sites can only be read if that site allows it (CORS).
  function readableImage(img, url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return Promise.resolve(img);
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
  }

  // Returns { size, offsetX, offsetY } in map px, or null when no clear square grid is present.
  function findGrid(img) {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const k = Math.min(1, DETECT_MAX_EDGE / Math.max(W, H));
    const w = Math.max(1, Math.round(W * k));
    const h = Math.max(1, Math.round(H * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;   // throws for cross-origin images

    const lum = new Float32Array(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];

    // Per column (vertical lines) and per row (horizontal lines):
    //  - edge energy, good for measuring the spacing;
    //  - "line" energy (pixel vs. its neighbours two px away), which peaks on a thin line's centre
    //    and so says where the lines sit without the half-pixel bias of edges.
    const col = new Float32Array(w);
    const row = new Float32Array(h);
    const colLine = new Float32Array(w);
    const rowLine = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const v = lum[i];
        if (x > 0) col[x] += Math.abs(v - lum[i - 1]);
        if (y > 0) row[y] += Math.abs(v - lum[i - w]);
        if (x > 1 && x < w - 2) colLine[x] += Math.abs(2 * v - lum[i - 2] - lum[i + 2]);
        if (y > 1 && y < h - 2) rowLine[y] += Math.abs(2 * v - lum[i - 2 * w] - lum[i + 2 * w]);
      }
    }
    const fx = highPass(col);
    const fy = highPass(row);
    const lx = highPass(colLine);
    const ly = highPass(rowLine);

    const minLag = Math.max(5, DETECT_MIN_CELL * k);
    const ax = findPeriod(fx, minLag, Math.min(fx.length / 2.2, DETECT_MAX_CELL * k));
    const ay = findPeriod(fy, minLag, Math.min(fy.length / 2.2, DETECT_MAX_CELL * k));
    if (!ax || !ay) return null;

    // A square grid repeats at the same spacing both ways; allow one axis to have locked onto a multiple.
    let p0 = null;
    for (const [m, n] of [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1]]) {
      const a = ax.lag / m;
      const b = ay.lag / n;
      if (Math.abs(a - b) <= Math.max(1.5, 0.04 * a)) { p0 = (a + b) / 2; break; }
    }
    if (!p0 || p0 < minLag) return null;

    // Fine-tune the spacing (sub-pixel) using both axes together.
    const mx = mean(fx) || 1e-6;
    const my = mean(fy) || 1e-6;
    const refine = (centre, span) => {
      let best = null;
      for (let p = centre - span; p <= centre + span; p += 0.02) {
        if (p < minLag) continue;
        const cx = combFit(fx, p, 0.25);
        const cy = combFit(fy, p, 0.25);
        // Contrast: how far the comb's teeth stand above the profile's average, per axis.
        const r = { p: p, cx: cx.score / mx, cy: cy.score / my };
        r.score = r.cx + r.cy;
        if (!best || r.score > best.score) best = r;
      }
      return best;
    };
    let best = refine(p0, 1.5);
    if (!best) return null;

    // Faint grids can lock onto every 2nd/3rd/4th line. Try the fractions, smallest first, and accept
    // one only if the extra teeth it adds (the ones between the current lines) land on real lines too.
    for (const d of [4, 3, 2]) {
      const q = best.p / d;
      if (q < minLag) continue;
      const cand = refine(q, 0.6);
      if (!cand) continue;
      const between = (c, b) => (d * c - b) / (d - 1);
      const bx = between(cand.cx, best.cx);
      const by = between(cand.cy, best.cy);
      // Random teeth score about 1 (the profile's average), so ~1.35+ means lines are there.
      if (bx >= Math.max(1.35, 0.25 * best.cx) && by >= Math.max(1.35, 0.25 * best.cy)) { best = cand; break; }
    }

    // Lines must clearly stand out from the rest of the picture on both axes.
    if (best.cx < 2.0 || best.cy < 2.0) return null;

    // Where the lines sit, from the line-centre profiles, in finer steps.
    const phx = combFit(lx, best.p, 0.1).phase;
    const phy = combFit(ly, best.p, 0.1).phase;

    // Profile index i is the downscaled pixel whose centre is at i + 0.5.
    let size = best.p / k;
    let offsetX = (phx + 0.5) / k;
    let offsetY = (phy + 0.5) / k;

    // Exported battle maps are usually a whole number of squares wide; snap to that when it's close.
    const cols = W / size;
    const rows = H / size;
    if (Math.abs(cols - Math.round(cols)) < 0.06 && Math.abs(rows - Math.round(rows)) < 0.06) {
      const snapped = W / Math.round(cols);
      if (Math.abs(snapped - size) < 0.5) size = snapped;
    }
    if (Math.abs(size - Math.round(size)) < 0.12) size = Math.round(size);
    offsetX = ((offsetX % size) + size) % size;
    offsetY = ((offsetY % size) + size) % size;
    // A line within a px or two of the map edge is a grid that starts at the edge.
    const edge = Math.max(1.5, 0.025 * size);
    if (offsetX < edge || offsetX > size - edge) offsetX = 0;
    if (offsetY < edge || offsetY > size - edge) offsetY = 0;
    return { size: size, offsetX: Math.round(offsetX * 2) / 2, offsetY: Math.round(offsetY * 2) / 2 };
  }

  function mean(f) {
    let s = 0;
    for (let i = 0; i < f.length; i++) s += f[i];
    return s / Math.max(1, f.length);
  }

  // Keeps narrow peaks (grid lines) and removes slow changes from the picture itself.
  function highPass(f) {
    const n = f.length;
    const win = 4;
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + f[i];
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - win);
      const b = Math.min(n, i + win + 1);
      out[i] = Math.max(0, f[i] - (pre[b] - pre[a]) / (b - a));
    }
    return out;
  }

  // Strongest repeat distance by autocorrelation, preferring the shortest one that explains it.
  function findPeriod(f, minLag, maxLag) {
    const n = f.length;
    minLag = Math.max(2, Math.floor(minLag));
    maxLag = Math.floor(maxLag);
    if (maxLag <= minLag + 2) return null;
    const m = mean(f);
    const c = new Float32Array(n);
    let ac0 = 0;
    for (let i = 0; i < n; i++) { c[i] = f[i] - m; ac0 += c[i] * c[i]; }
    if (ac0 <= 0) return null;
    const ac = new Float32Array(maxLag + 2);
    for (let L = 1; L <= maxLag + 1; L++) {
      let s = 0;
      for (let i = 0; i + L < n; i++) s += c[i] * c[i + L];
      ac[L] = (s / ac0) * (n / (n - L));
    }
    let bestLag = -1;
    // Real peaks only: a value that is merely still falling at the start of the range doesn't count.
    for (let L = minLag + 1; L <= maxLag; L++) {
      if (ac[L] > ac[L - 1] && ac[L] >= ac[L + 1] && (bestLag < 0 || ac[L] > ac[bestLag])) bestLag = L;
    }
    if (bestLag < 0 || ac[bestLag] < 0.08) return null;
    for (let d = 5; d >= 2; d--) {
      const L = Math.round(bestLag / d);
      if (L < minLag) continue;
      const near = Math.max(ac[L - 1] || 0, ac[L], ac[L + 1] || 0);
      if (near >= 0.6 * ac[bestLag]) { bestLag = bestLag / d; break; }
    }
    return { lag: bestLag, strength: ac[Math.round(bestLag)] };
  }

  // Average profile value on the comb phase, phase + p, phase + 2p, … for the best phase.
  function combFit(f, p, step) {
    const n = f.length;
    const at = (x) => {
      const i = Math.floor(x);
      const t = x - i;
      return i + 1 < n ? f[i] * (1 - t) + f[i + 1] * t : f[n - 1];
    };
    let best = { score: -1, phase: 0 };
    for (let phase = 0; phase < p; phase += step) {
      let s = 0;
      let cnt = 0;
      for (let x = phase; x < n - 1; x += p) { s += at(x); cnt++; }
      if (cnt >= 2 && s / cnt > best.score) best = { score: s / cnt, phase: phase };
    }
    return best;
  }

  function flashStatus(text) {
    setStatus(text);
    const shown = text;
    setTimeout(() => {
      const s = root && root.querySelector('[data-el="status"]');
      if (s && s.textContent === shown) setStatus(null);
    }, 3500);
  }

  /* ---------- Fog of war (cell based) ---------- */

  const cellKey = (x, y) => x + '_' + y;

  // Top-left corner of cell (0, 0) in map px. Normalised into (-size, 0] so cell 0 also covers the
  // partial strip at the map's top/left edge and every visible cell has a non-negative index.
  function gridOrigin() {
    const s = vtt.grid.size;
    const norm = (o) => {
      let v = (((Number(o) || 0) % s) + s) % s;
      if (v > 0.001) v -= s;
      return v;
    };
    return { ox: norm(vtt.grid.offsetX), oy: norm(vtt.grid.offsetY) };
  }

  function boardCells() {
    const b = boardSize();
    const s = vtt.grid.size;
    const { ox, oy } = gridOrigin();
    return { cols: Math.max(1, Math.ceil((b.w - ox) / s - 0.001)), rows: Math.max(1, Math.ceil((b.h - oy) / s - 0.001)) };
  }

  function isRevealed(x, y) {
    return !!vtt.fog.revealed[cellKey(x, y)];
  }

  // Players don't see unowned (enemy/NPC) tokens standing wholly in fog; party tokens always show.
  function hiddenByFog(t) {
    if (!vtt.fog.enabled || t.owner) return false;
    for (let dy = 0; dy < t.size; dy++) {
      for (let dx = 0; dx < t.size; dx++) {
        if (isRevealed(t.x + dx, t.y + dy)) return false;
      }
    }
    return true;
  }

  function setFogMode(mode) {
    fogMode = isDm() ? mode : null;
    if (!root) return;
    root.querySelector('[data-act="fog-reveal"]').classList.toggle('vtt-on', fogMode === 'reveal');
    root.querySelector('[data-act="fog-hide"]').classList.toggle('vtt-on', fogMode === 'hide');
    canvas.classList.toggle('vtt-painting', !!fogMode);
    // Painting only makes sense with fog on.
    if (fogMode && !vtt.fog.enabled) {
      vtt.fog.enabled = true;
      syncFogInputs();
      onVttChange({ fog: 'enabled' });
    }
  }

  function resetFog() {
    if (!isDm() || !confirm('Cover the whole map with fog again?')) return;
    vtt.fog.revealed = {};
    fogPending = {};
    fogVersion++;
    onVttChange({ fog: 'reset' });
  }

  function syncFogInputs() {
    if (!root) return;
    const box = root.querySelector('[data-el="fog-enabled"]');
    if (box) box.checked = vtt.fog.enabled;
  }

  // Applies the brush centred on cell (cx, cy); changes are queued in fogPending until the stroke ends.
  function paintFogAt(cx, cy, mode) {
    if (mode !== 'reveal' && mode !== 'hide') return;
    const { cols, rows } = boardCells();
    const half = Math.floor(fogBrush / 2);
    const reveal = mode === 'reveal';
    let changed = false;
    for (let y = cy - half; y <= cy + half; y++) {
      for (let x = cx - half; x <= cx + half; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const k = cellKey(x, y);
        if (!!vtt.fog.revealed[k] === reveal) continue;
        if (reveal) vtt.fog.revealed[k] = true;
        else delete vtt.fog.revealed[k];
        fogPending[k] = reveal ? true : null;
        changed = true;
      }
    }
    if (changed) { fogVersion++; requestDraw(); }
  }

  // Fills every cell between two pointer samples so fast strokes leave no gaps.
  function paintFogStroke(from, to, mode) {
    const s = vtt.grid.size;
    const { ox, oy } = gridOrigin();
    const a = screenToWorld(from);
    const b = screenToWorld(to);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (s / 2)));
    for (let i = 0; i <= steps; i++) {
      const wx = a.x + (b.x - a.x) * i / steps;
      const wy = a.y + (b.y - a.y) * i / steps;
      paintFogAt(Math.floor((wx - ox) / s), Math.floor((wy - oy) / s), mode);
    }
  }

  // Drawn after tokens so it covers them. One pixel per cell, stretched without smoothing,
  // so neighbouring fog cells join without hairline seams at any zoom.
  function drawFog(b) {
    if (!vtt.fog.enabled) return;
    const { cols, rows } = boardCells();
    const dm = isDm();
    const key = cols + 'x' + rows + '|' + dm + '|' + fogVersion;
    if (!fogMask || key !== fogMaskKey) {
      fogMask = fogMask || document.createElement('canvas');
      fogMask.width = cols;
      fogMask.height = rows;
      const mctx = fogMask.getContext('2d');
      const data = mctx.createImageData(cols, rows);
      const alpha = dm ? 140 : 255;   // DM sees through the fog, players don't
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (isRevealed(x, y)) continue;
          const i = (y * cols + x) * 4;
          data.data[i] = 6; data.data[i + 1] = 5; data.data[i + 2] = 8; data.data[i + 3] = alpha;
        }
      }
      mctx.putImageData(data, 0, 0);
      fogMaskKey = key;
    }
    const s = vtt.grid.size;
    const { ox, oy } = gridOrigin();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, b.w, b.h);   // edge cells overhang the map; keep the fog on it
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fogMask, ox, oy, cols * s, rows * s);
    ctx.restore();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;    // tab hidden
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    requestDraw();
  }

  /* ---------- Map & tokens (single entry points, so a catalog can plug in later) ---------- */

  // source: an image URL or a data URL from an uploaded file.
  function setMap(source) {
    if (source && isDm()) loadMapImage(source, true);
  }

  // isLocal: this device chose the map, so fit it and share it. Remote maps only load.
  function loadMapImage(url, isLocal) {
    wantedMapUrl = url;
    setStatus('Loading map…');
    const img = new Image();
    img.onload = () => {
      if (wantedMapUrl !== url) return;   // a newer map was picked meanwhile
      setStatus(null);
      const firstMap = !mapImg;
      mapImg = img;
      vtt.map = { url: url, width: img.naturalWidth, height: img.naturalHeight };
      if (isLocal || firstMap) fitView();
      if (isLocal) {
        onVttChange({ map: true });
        detectGridOnMap(false);   // match a grid drawn into the map, if there is one
      } else {
        requestDraw();
      }
    };
    img.onerror = () => {
      if (wantedMapUrl !== url) return;
      setStatus(null);
      if (isLocal) { wantedMapUrl = vtt.map.url; alert('Could not load that map image.'); }
      else console.warn('VTT: could not load shared map image', url.slice(0, 80));
    };
    img.src = url;
  }

  // source: { name, color, img, size } — img is an image URL or data URL (optional).
  function addToken(source) {
    if (!isDm()) return null;
    const id ='t' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const size = source.size || 1;
    const center = screenToWorld(canvasCenter());
    const cell = vtt.grid.size;
    const { ox, oy } = gridOrigin();
    const spot = freeCellNear(Math.round((center.x - ox) / cell - size / 2), Math.round((center.y - oy) / cell - size / 2));
    const token = {
      id: id,
      name: (source.name || 'Token').trim() || 'Token',
      x: spot.x,
      y: spot.y,
      size: size,
      img: source.img || null,
      color: source.color || TOKEN_COLORS[0],
      owner: source.owner ? String(source.owner).toLowerCase() : null,
      hp: null,
      hidden: !!source.hidden
    };
    vtt.tokens[id] = token;
    selectedId = id;
    onVttChange({ token: id });
    return token;
  }

  // Nearest cell (spiralling outwards) whose top-left no other token sits on, so new tokens don't stack.
  function freeCellNear(x, y) {
    const taken = new Set(Object.values(vtt.tokens).map((t) => t.x + '_' + t.y));
    for (let r = 0; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!taken.has((x + dx) + '_' + (y + dy))) return { x: x + dx, y: y + dy };
        }
      }
    }
    return { x: x, y: y };
  }

  function removeToken(id) {
    if (!isDm()) return;
    delete vtt.tokens[id];
    if (selectedId === id) selectedId = null;
    onVttChange({ token: id });
  }

  // Shrinks the picture, puts it in Firebase Storage and shares only its URL.
  // Fallback while the project has no Storage bucket: share a smaller copy inline through the
  // database instead. Once Storage works, the first branch takes over again by itself.
  function uploadMap(file) {
    if (!isDm()) return;
    setStatus('Preparing map…');
    scaleImageFile(file, MAP_MAX_EDGE)
      .then(async (c) => {
        const blob = await canvasToBlob(c, 'image/webp', 0.82);
        if (blob.size > MAP_MAX_BYTES) throw new Error('too-big');
        if (!storageFailed && typeof window.fbUploadVttMap === 'function') {
          setStatus('Uploading map…');
          try {
            return await window.fbUploadVttMap(blob);
          } catch (err) {
            // Don't make the DM wait for Storage again this session.
            storageFailed = true;
            console.warn('VTT: Storage upload failed, sharing the map through the database instead.', err);
          }
        }
        return inlineMapUrl(c);
      })
      .then((url) => {
        setStatus(null);
        setMap(url);
      })
      .catch((err) => {
        setStatus(null);
        if (err && err.message === 'too-big') alert('This map is too large even after compressing it. Try a smaller image.');
        else alert('Could not read that image.');
      });
  }

  // Data URL small enough for the database; steps down size and quality until it fits.
  function inlineMapUrl(c) {
    const attempts = [[MAP_MAX_EDGE, 0.75], [1600, 0.7], [1280, 0.65]];
    for (const [edge, q] of attempts) {
      let src = c;
      const k = Math.min(1, edge / Math.max(c.width, c.height));
      if (k < 1) {
        src = document.createElement('canvas');
        src.width = Math.round(c.width * k);
        src.height = Math.round(c.height * k);
        src.getContext('2d').drawImage(c, 0, 0, src.width, src.height);
      }
      const url = src.toDataURL('image/webp', q);
      if (url.length <= MAP_INLINE_MAX_CHARS) return url;
    }
    throw new Error('too-big');
  }

  function setStatus(text) {
    const s = root && root.querySelector('[data-el="status"]');
    if (!s) return;
    s.textContent = text || '';
    s.style.display = text ? '' : 'none';
  }

  function promptMapUrl() {
    const url = prompt('Paste an image link for the map:');
    if (url && url.trim()) setMap(url.trim());
  }

  /* ---------- Sync ---------- */

  const roomPath = (sub) => ROOM_ID + '/' + sub;

  // Every change to the shared table funnels through here.
  // change: { map: true } | { grid: true } | { token: id } (a missing token means it was deleted).
  function onVttChange(change) {
    requestDraw();
    if (!change || typeof window.fbSaveVtt !== 'function') return;
    if ((change.map || change.grid || change.fog) && !isDm()) return;
    if (change.fog === 'enabled') {
      window.fbSaveVtt(roomPath('fog'), { enabled: vtt.fog.enabled });
    } else if (change.fog === 'cells') {
      // One batched update per brush stroke; null entries close cells again.
      if (Object.keys(fogPending).length) window.fbSaveVtt(roomPath('fog/revealed'), fogPending);
      fogPending = {};
    } else if (change.fog === 'reset') {
      window.fbSaveVtt(roomPath('fog/revealed'), null);
    }
    if (change.token && !(vtt.tokens[change.token] ? canEdit(vtt.tokens[change.token]) : isDm())) return;
    if (change.map) {
      window.fbSaveVtt(roomPath('map'), { url: vtt.map.url, width: vtt.map.width, height: vtt.map.height });
    }
    if (change.grid) {
      clearTimeout(gridSaveTimer);
      gridSaveTimer = setTimeout(() => {
        gridSaveTimer = null;
        window.fbSaveVtt(roomPath('grid'), Object.assign({}, vtt.grid));
      }, GRID_SYNC_MS);
    }
    if (change.token) {
      syncHpWatchers();
      const t = vtt.tokens[change.token];
      window.fbSaveVtt(roomPath('tokens/' + change.token), t ? Object.assign({}, t) : null);
    }
  }

  function startSync(tries) {
    if (unsubscribe) return;
    if (typeof window.fbListenToVtt !== 'function') {
      // The Firebase module loads after this script; give it a moment.
      if ((tries || 0) < 20) setTimeout(() => startSync((tries || 0) + 1), 500);
      return;
    }
    unsubscribe = window.fbListenToVtt(ROOM_ID, applyRemote);
  }

  // The listener also echoes our own writes back; applying them again is harmless.
  function applyRemote(room) {
    const map = room.map || {};
    const url = map.url || null;
    if (url !== (wantedMapUrl || null)) {
      if (url) {
        loadMapImage(url, false);
      } else {
        wantedMapUrl = null;
        setStatus(null);
        mapImg = null;
        vtt.map = { url: null, width: 0, height: 0 };
      }
    }

    // While a local grid edit is waiting to be written, keep it instead of the older cloud value.
    if (room.grid && !gridSaveTimer) {
      const g = room.grid;
      if (isFinite(g.size) && g.size >= 10) vtt.grid.size = g.size;
      if (typeof g.visible === 'boolean') vtt.grid.visible = g.visible;
      if (g.color) vtt.grid.color = g.color;
      if (isFinite(g.opacity)) vtt.grid.opacity = g.opacity;
      vtt.grid.offsetX = Number(g.offsetX) || 0;
      vtt.grid.offsetY = Number(g.offsetY) || 0;
      syncGridInputs();
    }

    // Cells painted in a stroke that hasn't been sent yet stay as painted.
    const fog = room.fog || {};
    const revealed = Object.assign({}, fog.revealed || {});
    Object.keys(fogPending).forEach((k) => { if (fogPending[k]) revealed[k] = true; else delete revealed[k]; });
    vtt.fog = { enabled: !!fog.enabled, revealed: revealed };
    fogVersion++;
    syncFogInputs();

    const next = {};
    Object.keys(room.tokens || {}).forEach((id) => {
      const t = room.tokens[id] || {};
      next[id] = {
        id: id,
        name: t.name || 'Token',
        x: Number(t.x) || 0,
        y: Number(t.y) || 0,
        size: Number(t.size) || 1,
        img: t.img || null,
        color: t.color || TOKEN_COLORS[0],
        owner: t.owner || null,
        hp: (t.hp === undefined) ? null : t.hp,
        hidden: !!t.hidden
      };
    });
    vtt.tokens = next;
    syncHpWatchers();
    vtt.log = room.log || {};
    renderLog();
    if (selectedId && !next[selectedId]) selectedId = null;
    // Someone deleted the token we are holding: drop it. Otherwise our drag keeps
    // drawing at the pointer (tokenRect reads drag.px/py), so remote echoes can't yank it.
    if (drag && drag.kind === 'token' && !next[drag.id]) drag = null;
    if (root) {
      root.querySelectorAll('.vtt-pop[data-token-id]').forEach((n) => { if (!next[n.dataset.tokenId]) n.remove(); });
    }
    requestDraw();
  }

  /* ---------- HP (read from the character sheet; monsters keep their own) ---------- */

  const hpWatch = {};   // ownerKey -> { unsub, hp }

  // Keeps exactly one live HP listener per player who owns a token on the table.
  function syncHpWatchers() {
    if (typeof window.fbListenToVttHp !== 'function') return;
    const owners = new Set(Object.values(vtt.tokens).map((t) => t.owner).filter(Boolean));
    owners.forEach((key) => {
      if (hpWatch[key]) return;
      const entry = { unsub: null, hp: null };
      hpWatch[key] = entry;
      entry.unsub = window.fbListenToVttHp(key, (hp) => { entry.hp = hp; requestDraw(); });
    });
    Object.keys(hpWatch).forEach((key) => {
      if (owners.has(key)) return;
      hpWatch[key].unsub && hpWatch[key].unsub();
      delete hpWatch[key];
    });
  }

  // { current, max, temp } to show under a token, or null when this viewer shouldn't see one.
  function tokenHp(t) {
    if (t.owner) {
      const w = hpWatch[t.owner];
      return w && w.hp && Number(w.hp.max) > 0 ? w.hp : null;
    }
    // Monster HP is the DM's business only.
    if (!isDm() || !t.hp || !(Number(t.hp.max) > 0)) return null;
    return t.hp;
  }

  function drawHpBar(t, r) {
    const hp = tokenHp(t);
    if (!hp) return;
    const max = Number(hp.max);
    const cur = Math.max(0, Math.min(max, Number(hp.current) || 0));
    const temp = Math.max(0, Number(hp.temp) || 0);
    const pct = cur / max;
    // Sits just under the name label (same metrics as drawToken), readable at any zoom.
    const fs = Math.max(10, 12 / view.zoom);
    const w = r.w * 0.8;
    const h = Math.max(r.h * 0.07, 6 / view.zoom);
    const x = r.x + (r.w - w) / 2;
    const y = r.y + r.h * 0.98 + fs * 1.25 + 2 / view.zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1 / view.zoom, y - 1 / view.zoom, w + 2 / view.zoom, h + 2 / view.zoom);
    ctx.fillStyle = pct > 0.5 ? cssVar('--success', '#5e9e63') : pct > 0.25 ? cssVar('--warn', '#c9962f') : cssVar('--danger-strong', '#d9584a');
    ctx.fillRect(x, y, w * pct, h);
    if (temp > 0) {
      ctx.fillStyle = cssVar('--info', '#6f9ac4');
      ctx.fillRect(x + w * pct, y, Math.min(w * (1 - pct), w * temp / max), h);
    }
  }

  /* ---------- Dice ---------- */

  const DICE = [4, 6, 8, 10, 12, 20, 100];
  const LOG_KEEP = 20;
  vtt.log = {};        // vtt/main/log: { key: { by, die, result, at } }, keys sort by time
  let logOpen = false;
  let lastLogKey = null;

  function rollDie(sides) {
    const result = 1 + Math.floor(Math.random() * sides);
    const u = window.currentUser;
    const entry = { by: (u && u.nickname) || 'Guest', die: sides, result: result, at: Date.now() };
    // Zero-padded time first so keys sort chronologically; random tail avoids clashes.
    const key = String(entry.at).padStart(15, '0') + Math.random().toString(36).slice(2, 6);
    vtt.log[key] = entry;
    logOpen = true;
    renderLog();
    if (typeof window.fbSaveVtt !== 'function') return;
    window.fbSaveVtt(roomPath('log/' + key), entry);
    // Keep only the newest LOG_KEEP rolls in the database.
    const keys = Object.keys(vtt.log).sort();
    if (keys.length > LOG_KEEP) {
      const drop = {};
      keys.slice(0, keys.length - LOG_KEEP).forEach((k) => { drop[k] = null; delete vtt.log[k]; });
      window.fbSaveVtt(roomPath('log'), drop);
    }
  }

  function renderLog() {
    if (!root) return;
    const panel = root.querySelector('[data-el="log"]');
    const list = root.querySelector('[data-el="log-list"]');
    if (!panel || !list) return;
    const keys = Object.keys(vtt.log || {}).sort().slice(-LOG_KEEP);
    const newest = keys[keys.length - 1] || null;
    const fresh = newest && newest !== lastLogKey && lastLogKey !== null;
    lastLogKey = newest;
    if (fresh) logOpen = true;   // someone rolled: show it
    panel.style.display = logOpen && keys.length ? '' : 'none';
    list.innerHTML = '';
    keys.slice().reverse().forEach((k, i) => {
      const e = vtt.log[k] || {};
      const row = document.createElement('div');
      row.className = 'vtt-log-row' + (i === 0 ? ' vtt-log-new' : '');
      const who = document.createElement('span');
      who.className = 'vtt-log-who';
      who.textContent = e.by || '?';
      const what = document.createElement('span');
      what.textContent = 'd' + e.die;
      const res = document.createElement('b');
      res.textContent = e.result;
      if (e.die === 20 && e.result === 20) res.className = 'vtt-crit';
      if (e.die === 20 && e.result === 1) res.className = 'vtt-fumble';
      row.append(who, what, res);
      list.appendChild(row);
    });
  }

  window.vttApi = { state: vtt, view: view, setMap: setMap, addToken: addToken, removeToken: removeToken, isVisible: (t) => isVisible(t), rollDie: rollDie, findGrid: findGrid };

  /* ---------- Coordinates ---------- */

  function boardSize() {
    if (mapImg) return { w: vtt.map.width, h: vtt.map.height };
    return { w: DEFAULT_BOARD.cols * vtt.grid.size, h: DEFAULT_BOARD.rows * vtt.grid.size };
  }

  function canvasCenter() {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  function eventPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function screenToWorld(p) {
    return { x: (p.x - view.offsetX) / view.zoom, y: (p.y - view.offsetY) / view.zoom };
  }

  function zoomAt(p, factor) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
    const w = screenToWorld(p);
    view.zoom = next;
    view.offsetX = p.x - w.x * next;
    view.offsetY = p.y - w.y * next;
    requestDraw();
  }

  function fitView() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const b = boardSize();
    const pad = 24;
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
      Math.min((rect.width - pad * 2) / b.w, (rect.height - pad * 2) / b.h)));
    view.offsetX = (rect.width - b.w * view.zoom) / 2;
    view.offsetY = (rect.height - b.h * view.zoom) / 2;
    requestDraw();
  }

  /* ---------- Drawing ---------- */

  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(); });
  }

  // Layers are drawn in order: map, grid, tokens. Fog (Step 8) goes after tokens.
  function draw() {
    if (!ctx || !canvas.width) return;
    refreshRoleUi();   // cheap; catches logins and account switches
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.offsetX, dpr * view.offsetY);

    const b = boardSize();
    drawMap(b);
    if (vtt.grid.visible) drawGrid(b);
    drawTokens();
    drawFog(b);

    const hint = root.querySelector('[data-el="hint"]');
    if (hint) hint.style.display = mapImg || Object.values(vtt.tokens).some(isVisible) ? 'none' : '';
    const zl = root.querySelector('[data-el="zoom-label"]');
    if (zl) zl.textContent = Math.round(view.zoom * 100) + '%';
  }

  function drawMap(b) {
    if (mapImg) {
      ctx.imageSmoothingEnabled = view.zoom < 1;
      ctx.drawImage(mapImg, 0, 0, b.w, b.h);
    } else {
      ctx.fillStyle = cssVar('--surface-1', '#161413');
      ctx.fillRect(0, 0, b.w, b.h);
    }
  }

  function drawGrid(b) {
    const s = vtt.grid.size;
    const { ox, oy } = gridOrigin();
    ctx.save();
    ctx.globalAlpha = vtt.grid.opacity;
    ctx.strokeStyle = vtt.grid.color;
    ctx.lineWidth = 1 / view.zoom;   // stays a hairline at any zoom
    ctx.beginPath();
    for (let x = ox; x <= b.w + 0.5; x += s) { if (x >= -0.5) { ctx.moveTo(x, 0); ctx.lineTo(x, b.h); } }
    for (let y = oy; y <= b.h + 0.5; y += s) { if (y >= -0.5) { ctx.moveTo(0, y); ctx.lineTo(b.w, y); } }
    ctx.stroke();
    ctx.restore();
  }

  function tokenRect(t) {
    const s = vtt.grid.size;
    if (drag && drag.kind === 'token' && drag.id === t.id) {
      return { x: drag.px, y: drag.py, w: t.size * s, h: t.size * s };
    }
    const { ox, oy } = gridOrigin();
    return { x: ox + t.x * s, y: oy + t.y * s, w: t.size * s, h: t.size * s };
  }

  function drawTokens() {
    const list = Object.values(vtt.tokens).filter(isVisible);
    // The token being dragged is drawn last so it floats above the others.
    list.sort((a, b) => (drag && drag.id === a.id ? 1 : 0) - (drag && drag.id === b.id ? 1 : 0));
    list.forEach(drawToken);
  }

  function drawToken(t) {
    const r = tokenRect(t);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rad = r.w / 2 * 0.9;

    // Only the DM ever sees hidden tokens; they show faded with a dashed ring.
    ctx.save();
    if (t.hidden) ctx.globalAlpha = 0.45;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8 / view.zoom;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = t.color || TOKEN_COLORS[0];
    ctx.fill();
    ctx.restore();

    const img = t.img ? getImage(t.img) : null;
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 0.92, 0, Math.PI * 2);
      ctx.clip();
      const scale = Math.max((rad * 2) / img.naturalWidth, (rad * 2) / img.naturalHeight);
      const iw = img.naturalWidth * scale;
      const ih = img.naturalHeight * scale;
      ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
      ctx.restore();
    } else {
      ctx.fillStyle = readableTextColor(t.color);
      ctx.font = '600 ' + Math.round(rad * 0.8) + 'px ' + cssVar('--font-display', 'serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials(t.name), cx, cy + rad * 0.04);
    }

    // Selected tokens get a gold ring; a player's own tokens a thinner one so they can find them.
    const mine = !isDm() && canEdit(t);
    ctx.lineWidth = (t.id === selectedId ? 3 : (mine ? 2 : 1.5)) / view.zoom;
    ctx.strokeStyle = (t.id === selectedId || mine) ? cssVar('--accent-strong', '#e8cf7a') : 'rgba(0,0,0,0.6)';
    if (t.hidden) ctx.setLineDash([4 / view.zoom, 3 / view.zoom]);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Name label under the token, kept readable at any zoom.
    const fs = Math.max(10, 12 / view.zoom);
    ctx.font = fs + 'px ' + cssVar('--font-body', 'serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const ty = r.y + r.h - r.h * 0.02;
    const label = t.hidden ? '👁‍🗨 ' + t.name : t.name;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - tw / 2 - fs * 0.3, ty, tw + fs * 0.6, fs * 1.25);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, ty + fs * 0.1);
    drawHpBar(t, r);
    ctx.restore();
  }

  function getImage(url) {
    let img = imgCache[url];
    if (!img) {
      img = new Image();
      img.onload = requestDraw;
      img.src = url;
      imgCache[url] = img;
    }
    return img;
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
    return letters.toLocaleUpperCase('tr');
  }

  function readableTextColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? '#14100a' : '#fff';
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ---------- Pointer input: pan, pinch zoom, token drag, long press ---------- */

  const pointers = new Map();   // pointerId -> {x, y}
  let drag = null;              // { kind: 'pan'|'token'|'pinch', ... }
  let longPressTimer = null;

  // Topmost token under p that this user may grab; others' tokens let the pointer pan through.
  function hitToken(p) {
    const w = screenToWorld(p);
    const list = Object.values(vtt.tokens).filter((t) => isVisible(t) && canEdit(t));
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      const r = tokenRect(t);
      const dx = w.x - (r.x + r.w / 2);
      const dy = w.y - (r.y + r.h / 2);
      if (dx * dx + dy * dy <= (r.w / 2) * (r.w / 2)) return t;
    }
    return null;
  }

  function bindPointerEvents() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    // If capture is lost without a pointerup (tab switch, alert), still finish the gesture
    // so a fog stroke or token drag isn't left half done. After a normal pointerup this is a no-op.
    canvas.addEventListener('lostpointercapture', onPointerUp);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomAt(eventPoint(e), Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const t = isDm() ? hitToken(eventPoint(e)) : null;
      if (t) openTokenMenu(t, eventPoint(e));
    });
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    closePopups();
    canvas.setPointerCapture(e.pointerId);
    const p = eventPoint(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 2) {
      // Second finger: switch to pinch zoom; any token drag snaps back, a fog stroke is kept.
      cancelLongPress();
      if (drag && drag.kind === 'fog') onVttChange({ fog: 'cells' });
      const [a, b] = [...pointers.values()];
      drag = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      requestDraw();
      return;
    }
    if (pointers.size > 2) return;

    if (fogMode && isDm()) {
      // The stroke keeps the mode it started with, even if the toolbar changes mid-stroke.
      drag = { kind: 'fog', mode: fogMode, last: p };
      paintFogStroke(p, p, drag.mode);
      return;
    }

    const t = hitToken(p);
    if (t) {
      selectedId = t.id;
      const w = screenToWorld(p);
      const r0 = tokenRect(t);
      drag = { kind: 'token', id: t.id, start: p, moved: false, grabX: w.x - r0.x, grabY: w.y - r0.y, px: r0.x, py: r0.y };
      // Mouse users get the menu from right click; long press is for touch and pen.
      if (e.pointerType !== 'mouse' && isDm()) longPressTimer = setTimeout(() => {
        if (drag && drag.kind === 'token' && !drag.moved) {
          const tok = vtt.tokens[drag.id];
          drag = null;
          if (tok) openTokenMenu(tok, p);
          requestDraw();
        }
      }, LONG_PRESS_MS);
    } else {
      selectedId = null;
      drag = { kind: 'pan', start: p, last: p };
      canvas.classList.add('vtt-grabbing');
    }
    requestDraw();
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = eventPoint(e);
    pointers.set(e.pointerId, p);
    if (!drag) return;

    if (drag.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view.offsetX += mid.x - drag.mid.x;
      view.offsetY += mid.y - drag.mid.y;
      if (drag.dist > 0) zoomAt(mid, dist / drag.dist);
      drag.dist = dist;
      drag.mid = mid;
      requestDraw();
    } else if (drag.kind === 'fog') {
      paintFogStroke(drag.last, p, drag.mode);
      drag.last = p;
      // Long strokes go out in batches so players see the reveal as it happens.
      const now = Date.now();
      if (now - (drag.flushedAt || 0) > FOG_SYNC_MS) {
        drag.flushedAt = now;
        onVttChange({ fog: 'cells' });
      }
    } else if (drag.kind === 'pan') {
      view.offsetX += p.x - drag.last.x;
      view.offsetY += p.y - drag.last.y;
      drag.last = p;
      requestDraw();
    } else if (drag.kind === 'token') {
      if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < TAP_SLOP) return;
      drag.moved = true;
      cancelLongPress();
      const w = screenToWorld(p);
      drag.px = w.x - drag.grabX;
      drag.py = w.y - drag.grabY;
      sendDragPosition(false);
      requestDraw();
    }
  }

  // Shares the cell under a dragged token so others see it move; throttled unless final.
  // Grid cell nearest to where the dragged token is being held.
  function dragCell() {
    const s = vtt.grid.size;
    const { ox, oy } = gridOrigin();
    return { x: Math.round((drag.px - ox) / s), y: Math.round((drag.py - oy) / s) };
  }

  function sendDragPosition(final) {
    if (!drag || drag.kind !== 'token' || typeof window.fbSaveVtt !== 'function') return;
    if (!canEdit(vtt.tokens[drag.id])) return;
    const { x, y } = dragCell();
    const now = Date.now();
    if (!final && (now - (drag.sentAt || 0) < DRAG_SYNC_MS || (x === drag.sentX && y === drag.sentY))) return;
    drag.sentAt = now;
    drag.sentX = x;
    drag.sentY = y;
    window.fbSaveVtt(roomPath('tokens/' + drag.id), { x: x, y: y });
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    cancelLongPress();
    canvas.classList.remove('vtt-grabbing');
    if (!drag) return;

    if (drag.kind === 'fog') {
      drag = null;
      onVttChange({ fog: 'cells' });
      return;
    }

    if (drag.kind === 'token' && drag.moved) {
      const t = vtt.tokens[drag.id];
      if (t) {
        const cellPos = dragCell();
        t.x = cellPos.x;
        t.y = cellPos.y;
        sendDragPosition(true);
        drag = null;
        requestDraw();
        return;
      }
    }
    // Lifting one finger of a pinch should not turn into a pan jump.
    drag = null;
    requestDraw();
  }

  function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  function onKeyDown(e) {
    if (!root || root.style.display === 'none') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (e.key === 'Escape' && fogMode) { setFogMode(null); return; }
    if (!selectedId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeToken(selectedId);
    } else if (e.key === 'Escape') {
      selectedId = null;
      closePopups();
      requestDraw();
    }
  }

  /* ---------- Popups: token menu and add-token form ---------- */

  function closePopups() {
    if (!root) return;
    root.querySelectorAll('.vtt-pop').forEach((n) => n.remove());
  }

  function placePopup(pop, p) {
    const stage = root.querySelector('.vtt-stage');
    stage.appendChild(pop);
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    pop.style.left = Math.max(4, Math.min(p.x, sw - pop.offsetWidth - 4)) + 'px';
    pop.style.top = Math.max(4, Math.min(p.y, sh - pop.offsetHeight - 4)) + 'px';
  }

  function openTokenMenu(t, p) {
    closePopups();
    selectedId = t.id;
    const pop = document.createElement('div');
    pop.className = 'vtt-pop';
    pop.dataset.tokenId = t.id;
    // Remote updates replace token objects, so always edit the current one.
    const edit = (fn) => {
      const cur = vtt.tokens[t.id];
      if (cur) { fn(cur); onVttChange({ token: t.id }); }
      closePopups();
    };

    const title = document.createElement('div');
    title.className = 'vtt-pop-title';
    title.textContent = t.name;
    pop.appendChild(title);

    const rename = button('✏️ Rename', () => {
      const name = prompt('Token name:', t.name);
      if (name && name.trim()) edit((cur) => { cur.name = name.trim(); });
      else closePopups();
    });
    pop.appendChild(rename);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'vtt-row';
    [1, 2, 3, 4].forEach((n) => {
      const b = button(n + 'x' + n, () => edit((cur) => { cur.size = n; }));
      if (t.size === n) b.classList.add('active');
      sizeRow.appendChild(b);
    });
    pop.appendChild(sizeRow);

    pop.appendChild(hpSection(t));

    const ownerWrap = document.createElement('label');
    ownerWrap.className = 'vtt-owner';
    ownerWrap.textContent = 'Owner (can move it)';
    const owner = ownerSelect(t.owner);
    owner.onchange = () => edit((cur) => { cur.owner = owner.value || null; });
    ownerWrap.appendChild(owner);
    pop.appendChild(ownerWrap);

    pop.appendChild(button(t.hidden ? '👁 Show to players' : '🙈 Hide from players',
      () => edit((cur) => { cur.hidden = !cur.hidden; })));

    pop.appendChild(button('🗑 Delete', () => { removeToken(t.id); closePopups(); }));

    placePopup(pop, p);
    requestDraw();
  }

  // Player tokens: HP is read from the character sheet and only changed there.
  // Monster tokens: the DM keeps HP on the token itself (tokens/<id>/hp).
  function hpSection(t) {
    const wrap = document.createElement('div');
    wrap.className = 'vtt-hp';
    if (t.owner) {
      const hp = tokenHp(t);
      wrap.textContent = hp
        ? '❤️ ' + (Number(hp.current) || 0) + ' / ' + hp.max + (Number(hp.temp) > 0 ? ' (+' + hp.temp + ' temp)' : '') + ' — from ' + ownerName(t.owner) + "'s sheet"
        : '❤️ No HP on ' + ownerName(t.owner) + "'s sheet yet";
      return wrap;
    }
    const hp = t.hp || {};
    wrap.appendChild(document.createTextNode('❤️ HP (only you see this)'));
    const row = document.createElement('div');
    row.className = 'vtt-row';
    const num = (value, title) => {
      const i = document.createElement('input');
      i.type = 'number';
      i.min = '0';
      i.title = title;
      i.value = value === undefined || value === null ? '' : value;
      return i;
    };
    const cur = num(hp.current, 'Current HP');
    const max = num(hp.max, 'Max HP');
    const save = () => {
      const tok = vtt.tokens[t.id];
      if (!tok) return;
      const m = Math.max(0, parseInt(max.value, 10) || 0);
      const c = cur.value === '' ? m : Math.max(0, parseInt(cur.value, 10) || 0);
      tok.hp = m > 0 ? { current: Math.min(c, m), max: m } : null;
      if (tok.hp) cur.value = tok.hp.current;
      onVttChange({ token: t.id });
    };
    // Quick damage / healing without retyping the number.
    const bump = (d) => () => {
      if (!(parseInt(max.value, 10) > 0)) return;
      cur.value = Math.max(0, (parseInt(cur.value, 10) || 0) + d);
      save();
    };
    cur.addEventListener('change', save);
    max.addEventListener('change', save);
    row.append(button('−5', bump(-5)), button('−1', bump(-1)), cur, document.createTextNode('/'), max, button('+1', bump(1)));
    wrap.appendChild(row);
    return wrap;
  }

  function openAddTokenForm(anchorBtn) {
    closePopups();
    const pop = document.createElement('div');
    pop.className = 'vtt-pop vtt-form';
    let color = TOKEN_COLORS[Object.keys(vtt.tokens).length % TOKEN_COLORS.length];
    let img = null;

    pop.innerHTML = `
      <div class="vtt-pop-title">New Token</div>
      <label>Name <input type="text" maxlength="40" data-f="name" placeholder="e.g. Goblin"></label>
      <label>Color <div class="vtt-swatches" data-f="swatches"></div></label>
      <label>Picture (optional) <button type="button" class="btn small ghost" data-f="pick">📷 Choose image</button></label>
      <label data-f="owner-wrap">Owner (can move it)</label>
      <label style="flex-direction:row; align-items:center; gap:6px;"><input type="checkbox" data-f="hidden"> Hidden from players</label>
      <div class="vtt-row"><button type="button" class="btn small" data-f="ok">Add</button><button type="button" class="btn small ghost" data-f="cancel">Cancel</button></div>
    `;
    const f = (n) => pop.querySelector('[data-f="' + n + '"]');

    const sw = f('swatches');
    TOKEN_COLORS.forEach((c) => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'vtt-swatch' + (c === color ? ' active' : '');
      s.style.background = c;
      s.onclick = () => {
        color = c;
        sw.querySelectorAll('.vtt-swatch').forEach((x) => x.classList.toggle('active', x === s));
      };
      sw.appendChild(s);
    });
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.value = color;
    custom.title = 'Custom color';
    custom.oninput = () => {
      color = custom.value;
      sw.querySelectorAll('.vtt-swatch').forEach((x) => x.classList.remove('active'));
    };
    sw.appendChild(custom);

    const fileInput = root.querySelector('[data-el="token-file"]');
    f('pick').onclick = () => {
      fileInput.onchange = () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        downscaleImage(file, TOKEN_IMG_MAX).then((url) => {
          img = url;
          f('pick').textContent = '✅ ' + file.name.slice(0, 18);
        });
      };
      fileInput.click();
    };

    const owner = ownerSelect(null);
    f('owner-wrap').appendChild(owner);

    const submit = () => {
      addToken({ name: f('name').value, color: color, img: img, owner: owner.value || null, hidden: f('hidden').checked });
      closePopups();
    };
    f('ok').onclick = submit;
    f('cancel').onclick = closePopups;
    f('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

    const stageRect = root.querySelector('.vtt-stage').getBoundingClientRect();
    const btnRect = anchorBtn.getBoundingClientRect();
    placePopup(pop, { x: btnRect.left - stageRect.left, y: 4 });
    f('name').focus();
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small ghost';
    b.textContent = label;
    b.onclick = onClick;
    return b;
  }

  // Draws a picture file onto a canvas no larger than max x max.
  function scaleImageFile(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      im.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * k));
        c.height = Math.max(1, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        resolve(c);
      };
      im.src = url;
    });
  }

  function canvasToBlob(c, type, quality) {
    return new Promise((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), type, quality);
    });
  }

  // Small token pictures stay inline as data URLs; they are a few KB each.
  function downscaleImage(file, max) {
    return scaleImageFile(file, max).then((c) => c.toDataURL('image/webp', 0.85));
  }
})();
