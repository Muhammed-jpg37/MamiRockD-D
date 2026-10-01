const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'index', 'index.html')
];

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update DM modal footer
  const oldFooter = `      <div class="modal-footer">
        <button class="btn ghost small" onclick="closeDmCreatePlayerModal()">Cancel</button>
        <button class="btn small" onclick="dmSubmitCreatePlayer()">✨ Create Player Account</button>
      </div>`;

  const newFooter = `      <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
        <button class="btn ghost small" onclick="closeDmCreatePlayerModal()">Cancel</button>
        <div style="display:flex; gap:8px;">
          <button class="btn small" style="background:linear-gradient(180deg, var(--gold-bright), #8a641d); color:#000; font-weight:bold;" onclick="dmOpenHeroForgeForPlayer()">⚔ Hero Forge</button>
          <button class="btn small" onclick="dmSubmitCreatePlayer()">✨ Quick Create</button>
        </div>
      </div>`;

  if (content.includes(oldFooter)) {
    content = content.replace(oldFooter, newFooter);
    console.log('Updated DM modal footer in:', filePath);
  }

  // 2. Add dmOpenHeroForgeForPlayer function if not present
  if (!content.includes('function dmOpenHeroForgeForPlayer')) {
    const target = '    function dmSubmitCreatePlayer() {';
    const insertCode = `    function dmOpenHeroForgeForPlayer() {
      const nickInput = document.getElementById('dm-new-player-nickname');
      const passInput = document.getElementById('dm-new-player-password');
      const classInput = document.getElementById('dm-new-player-class');
      const lvlInput = document.getElementById('dm-new-player-level');

      const nickname = (nickInput ? nickInput.value : '').trim();
      const password = (passInput ? passInput.value : '123').trim() || '123';
      const charClass = (classInput ? classInput.value : 'Fighter').trim() || 'Fighter';
      const level = parseInt(lvlInput ? lvlInput.value : '5', 10) || 5;

      if (!nickname) {
        alert('Please enter a nickname for the player.');
        return;
      }
      const accounts = getStoredAccounts();
      if (accounts[nickname.toLowerCase()]) {
        alert('An account with this nickname already exists!');
        return;
      }
      closeDmCreatePlayerModal();
      openCharacterForgeModal({
        nickname: nickname,
        password: password,
        role: 'player',
        isDmCreation: true,
        initialClass: charClass,
        initialLevel: level
      });
    }
    window.dmOpenHeroForgeForPlayer = dmOpenHeroForgeForPlayer;

`;
    content = content.replace(target, insertCode + target);
    console.log('Added dmOpenHeroForgeForPlayer in:', filePath);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Done!');
