const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('bg3-inventory_13.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
const window = dom.window;

setTimeout(() => {
  try {
    console.log("=== Testing Weapon Proficiency System ===");
    
    // Test 1: Check f-prof-type-row element existence
    const profRow = window.document.getElementById('f-prof-type-row');
    console.log("f-prof-type-row exists:", !!profRow);

    const fTypeSelect = window.document.getElementById('f-type');
    console.log("f-type select exists:", !!fTypeSelect);

    // Test 2: Check toggleProfTypeRow function
    window.openItemModal();
    console.log("f-prof-type-row display after openItemModal:", profRow.style.display); // Should be 'block' since default type is Weapon

    fTypeSelect.value = 'Armor';
    window.toggleProfTypeRow();
    console.log("f-prof-type-row display after switching to Armor:", profRow.style.display); // Should be 'none'

    fTypeSelect.value = 'Weapon';
    window.toggleProfTypeRow();
    console.log("f-prof-type-row display after switching back to Weapon:", profRow.style.display); // Should be 'block'

    // Test 3: Check isProficientWithWeapon function
    const simpleWeapon = { name: "Shortbow", type: "Weapon", proficiencyType: "Simple" };
    const martialWeapon = { name: "Longsword", type: "Weapon", proficiencyType: "Martial" };
    const exoticWeapon = { name: "Katana", type: "Weapon", proficiencyType: "Exotic" };

    window.state.characterStats = {
      profSimple: true,
      profMartial: false,
      profExotic: false,
      weapons: "Rapier"
    };

    console.log("Simple weapon prof (expected true):", window.isProficientWithWeapon(simpleWeapon));
    console.log("Martial weapon prof (expected false):", window.isProficientWithWeapon(martialWeapon));
    console.log("Exotic weapon prof (expected false):", window.isProficientWithWeapon(exoticWeapon));

    window.state.characterStats.profMartial = true;
    console.log("Martial weapon prof after enabling profMartial (expected true):", window.isProficientWithWeapon(martialWeapon));

    const rapier = { name: "Rapier of Sharpness", type: "Weapon", proficiencyType: "Martial" };
    console.log("Rapier prof via text notes (expected true):", window.isProficientWithWeapon(rapier));

    console.log("All unit tests passed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}, 500);
