const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log("=== 1. Check for Gimli and Legolas mentions in UI & seeds ===");
const gimliButtonRegex = /demo-btn.*gimli/i;
const legolasButtonRegex = /demo-btn.*legolas/i;
console.log("Gimli demo button in UI:", gimliButtonRegex.test(content));
console.log("Legolas demo button in UI:", legolasButtonRegex.test(content));

// Check getStoredAccounts
const getStoredAccountsMatch = content.match(/function getStoredAccounts\(\)[\s\S]*?return accounts;\s*\}/);
if (getStoredAccountsMatch) {
  console.log("In getStoredAccounts: contains gimli?", getStoredAccountsMatch[0].includes('gimli'));
  console.log("In getStoredAccounts: contains legolas?", getStoredAccountsMatch[0].includes('legolas'));
  console.log("In getStoredAccounts: contains cleanup delete?", getStoredAccountsMatch[0].includes('delete accounts.gimli'));
} else {
  console.log("Could not find getStoredAccounts!");
}

console.log("\n=== 2. Check Character Forge HTML Overlay ===");
console.log("Has character-forge-overlay:", content.includes('id="character-forge-overlay"'));
console.log("Has forge-class-card:", content.includes('forge-class-card'));
console.log("Has forge-species-select:", content.includes('id="forge-species-select"'));
console.log("Has forge-roll-stats:", content.includes('id="forge-roll-stats"'));
console.log("Has forge-standard-array:", content.includes('id="forge-standard-array"'));
console.log("Has forge-skills-container:", content.includes('id="forge-skills-container"'));
console.log("Has forge-submit-btn:", content.includes('id="forge-submit-btn"'));
console.log("Has forge-cancel-btn:", content.includes('id="forge-cancel-btn"'));

console.log("\n=== 3. Check Character Forge JavaScript Logic ===");
console.log("Has FORGE_CLASSES definition:", content.includes('const FORGE_CLASSES = {'));
console.log("Has FORGE_SKILLS definition:", content.includes('const FORGE_SKILLS = ['));
console.log("Has openCharacterForgeModal:", content.includes('window.openCharacterForgeModal = openCharacterForgeModal;'));
console.log("Has closeCharacterForgeModal:", content.includes('window.closeCharacterForgeModal = closeCharacterForgeModal;'));
console.log("Has applyCharacterForge:", content.includes('window.applyCharacterForge = applyCharacterForge;'));

console.log("\n=== 4. Check Registration Hook ===");
const regHook = content.includes('openCharacterForgeModal(true)');
console.log("handleAuthSubmit calls openCharacterForgeModal(true):", regHook);

console.log("\n=== 5. Check Identity Re-Forge Button ===");
console.log("Has re-forge button in character identity:", content.includes('id="btn-open-character-forge"'));

console.log("\n=== 6. Check Classes Covered in FORGE_CLASSES ===");
const classes = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer'];
classes.forEach(c => {
  const found = content.includes(`name: '${c}'`);
  console.log(`Class ${c}:`, found ? "YES" : "MISSING");
});

console.log("\n=== All checks completed successfully ===");
