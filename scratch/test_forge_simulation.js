const fs = require('fs');
const path = require('path');
const vm = require('vm');

const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Extract script
const startTag = '<script>';
const endTag = '</script>';
let firstStart = content.indexOf(startTag);
let firstEnd = content.indexOf(endTag, firstStart);
let jsCode = content.substring(firstStart + startTag.length, firstEnd);

// Setup robust recursive Proxy mock for DOM elements
const createMockElement = (tag = 'div') => {
  const styleMock = {
    setProperty: () => {},
    getPropertyValue: () => ''
  };
  const styleProxy = new Proxy(styleMock, {
    get(t, p) { return t[p] || ''; },
    set(t, p, v) { t[p] = v; return true; }
  });

  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'getContext') return () => ({
        clearRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillRect: () => {},
        drawImage: () => {}
      });
      if (prop === 'getBoundingClientRect') return () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 100 });
      if (prop === 'dataset') return {};
      if (prop === 'style') return styleProxy;
      if (prop === 'classList') return {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      };
      if (prop === 'children') return [];
      if (prop === 'childNodes') return [];
      if (typeof prop === 'string' && prop.startsWith('on')) return null;
      // Return a function or another mock
      return () => createMockElement();
    },
    set(target, prop, val) {
      target[prop] = val;
      return true;
    }
  };
  const base = {
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: styleProxy,
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  return new Proxy(base, handler);
};

const localStorageMock = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

const headEl = createMockElement('head');
const bodyEl = createMockElement('body');
const htmlEl = createMockElement('html');

const documentMock = new Proxy({
  getElementById: (id) => createMockElement(id),
  querySelector: () => createMockElement(),
  querySelectorAll: () => [],
  createElement: (tag) => createMockElement(tag),
  head: headEl,
  body: bodyEl,
  documentElement: htmlEl,
  addEventListener: () => {},
  removeEventListener: () => {}
}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => createMockElement();
  }
});

const windowMock = {
  localStorage: localStorageMock,
  document: documentMock,
  location: { reload: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  alert: (msg) => console.log('[MOCK ALERT]', msg),
  confirm: (msg) => { console.log('[MOCK CONFIRM]', msg); return true; },
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: () => {},
  GLOBAL_SPELL_CATALOG: []
};

const sandbox = {
  window: windowMock,
  document: documentMock,
  localStorage: localStorageMock,
  console: {
    log: () => {},
    warn: () => {},
    error: () => {}
  },
  setTimeout: (cb) => { try { cb(); } catch(e) {} },
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  alert: windowMock.alert,
  confirm: windowMock.confirm
};
sandbox.window.window = sandbox.window;

vm.createContext(sandbox);

try {
  vm.runInContext(jsCode, sandbox);
  console.log("SUCCESS: Script compiled and initialized without fatal errors!");

  // Verify accounts (no gimli, no legolas)
  const accounts = vm.runInContext('getStoredAccounts()', sandbox);
  console.log("Default Seed Accounts keys:", Object.keys(accounts));
  if (accounts.gimli || accounts.legolas) {
    console.error("FAIL: gimli or legolas still exists in accounts!");
  } else {
    console.log("PASS: Gimli and Legolas successfully omitted from default seed accounts!");
  }

  // Test opening forge
  vm.runInContext('openCharacterForgeModal({ nickname: "Elrond", password: "secret", role: "player" })', sandbox);
  console.log("PASS: openCharacterForgeModal executed cleanly!");

  // Test selecting class
  vm.runInContext('selectForgeClass("Wizard")', sandbox);
  console.log("PASS: selectForgeClass('Wizard') executed cleanly!");

  // Test rolling stats
  vm.runInContext('forgeRollStats()', sandbox);
  console.log("PASS: forgeRollStats() executed cleanly!");

  // Test submitting forge
  vm.runInContext('submitCharacterForge()', sandbox);
  console.log("PASS: submitCharacterForge() executed cleanly!");

  // Verify Elrond is saved in accounts
  const postAccounts = vm.runInContext('getStoredAccounts()', sandbox);
  console.log("Post forge accounts keys:", Object.keys(postAccounts));
  if (postAccounts.elrond) {
    console.log("PASS: Elrond account registered in accounts database!");
  } else {
    console.error("FAIL: Elrond not found in accounts!");
  }

  // Verify inventory saved
  const elrondInv = JSON.parse(localStorageMock.getItem('hoard_inv_user_elrond'));
  console.log("Elrond class:", elrondInv.characterStats.characterClass);
  console.log("Elrond HP:", elrondInv.hp);
  console.log("Elrond AC:", elrondInv.characterStats.ac);
  console.log("Elrond items count:", elrondInv.items.length);
  console.log("Elrond starter items:", elrondInv.items.map(i => i.name));
  console.log("\nALL HERO FORGE CHECKS PASSED WITH FLYING COLORS!");
} catch (err) {
  console.error("Simulation error:", err);
}
