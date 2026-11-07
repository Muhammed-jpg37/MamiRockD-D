# Handoff: MamiRock D&D site

State on 2026-11-07 (afternoon), for the next working session. **Start with "Resume here"** just below; the rest of this file is reference.

## Resume here

**Where work stopped:** feature plan section **4 (combat)**, on branch `savas` (cut from `sayfa-hesaplari`; `zar` and `sayfa-hesaplari` are done and pushed). Step 4.1 (conditions) is done. `savas` is **not pushed** (the user pushes it themselves).

**Do next: step 4.2.** On 2026-11-07 the user said to do all of section 4 (4.1–4.4) without asking, one commit per step, and that they push themselves; after 4.4, stop and report (sections 5, 7, 8 and Help wait for their word).

**How every step is executed** (agreed with the user; also in their Claude memory):
1. Each plan section gets its **own new branch**, cut from the previous section's branch (`kataloglar` → `karakter-aktarma` → `zar` → next…). Name it in the repo's Turkish kebab-case style (e.g. `sayfa-hesaplari`, `savas`, `harita`, `pdf-yazdirma`, `ses`, `yardim`).
2. Inside a section, do **one numbered step**, then: run `npm test` (Node) **and** `tests/browser-runner.html` (add new test files to its `FILES` list), check the page in the browser (desktop and 375 px phone width, no horizontal scroll), update this file's step list, and **commit** (message ends with the Co-Authored-By line). Then report in Turkish and **wait for the user's go** before the next step, unless they say "sormadan … bitir".
3. Testing on the live database: stub every write first (`window.save`, `fbSaveInventory`, `fbSaveInventoryInstant`, `fbSaveVtt`, `fbCampaignUpdate`, `fbWriteCharacterSheet`), reload the page afterwards. Never create real accounts.
4. **Push** a section's branch only when the user asks (they usually ask at the end of a section). **Do not merge into `main`** until the whole plan is done: then one merge of everything (the chain is linear, so `main` fast-forwards), on the user's word.
5. Downloads (e.g. sample files) only with the user's permission. Put them in the scratchpad, never in the repo.
6. Write commit messages and this file in English; talk to the user in Turkish.

### Remaining plan, one line per step

**2. Dice** (branch `zar`): done and pushed (see "Step 2, dice" below).

**3. Sheet maths** (branch `sayfa-hesaplari`, cut from `zar`)
- 3.1 Done (see "Step 3, sheet maths" below).
- 3.2 Done (see "Step 3, sheet maths" below).
- 3.3 Done (see "Step 3, sheet maths" below).
- 3.4 Done (see "Step 3, sheet maths" below).
- 3.5 Done (see "Step 3, sheet maths" below).
- 3.6 Done (see "Step 3, sheet maths" below).
- 3.7 Done (see "Step 3, sheet maths" below). Push `sayfa-hesaplari` when the user asks.

**4. Combat** (new branch, e.g. `savas`)
- 4.1 Conditions: the 15 SRD conditions (+ exhaustion levels) on tokens (small icons) and as a list on the sheet; DM sets them from the token menu, the player from the sheet; text from `rules/catalog/srd5*-conditions.json`.
- 4.2 Damage and healing from the token menu ("− X HP / + X HP"); on a player token it writes the character sheet's HP (`inventories/<id>/hp`), on an NPC the token's own HP.
- 4.3 Monsters on the map: "Add monster" in the VTT opens the Monsters catalog; the token gets HP, AC and an initiative roll from the stat block; the stat block opens from the token and its attacks click-to-roll (`attack`, `damage` fields are already in the catalog).
- 4.4 Encounter builder: pick monsters, see the 2014 XP-budget difficulty (Easy…Deadly) for the party's levels; "Place on map" drops them as tokens.

**5. Map** (new branch, e.g. `harita`)
- 5.1 Several scenes per campaign: `vtt/<campaign>/scenes/<id>` with a DM scene list; "Show to players" switches everyone; migrate the existing single map into the first scene.
- 5.2 Freehand drawing on the map (pen, line, rectangle, circle, erase) and a DM-only layer (drawings and tokens hidden from players).
- 5.3 Automatic fog: when a player token moves, fog opens around it within its vision radius; radius per token (token menu, default set by the DM, darkvision from the sheet), brush shape round with an adjustable size; manual reveal/cover stays.
- 5.4 Walls: the DM draws wall lines; automatic fog does not open behind walls (simple line-of-sight on the grid, no lighting).
- 5.5 Handouts: the DM shows an image or a journal note to all or some players as a pop-up.

**7. PDF and printing** (new branch, e.g. `pdf-yazdirma`)
- 7.1 Print CSS for the Character section (Overview, Inventory, Spells, Features on paper), "🖨 Print / Save as PDF" in the account menu.
- 7.2 Fill the official 2014 fillable sheet with pdf-lib from the character (the reverse of `fromPdfFields`; field names are listed in `character-transfer.js`) and download it.

**8. Sound** (new branch, e.g. `ses`)
- 8.1 A DM ambience player on the Table: a link or an uploaded short file, play/pause/volume synced to everyone in the campaign (`vtt/<campaign>/audio`). Other sites' extensions are not worth emulating (decided 2026-11-07).

**Last: Help** (new branch, e.g. `yardim`)
- A "❓ Help" / "How to use" page reachable from the account menu: sections (Campaign, Character, Table, Rules, Notes), roles per campaign, invites, homebrew and the item store, importing characters, dice expressions, and whatever the plan added.

**Then:** on the user's word, merge everything into `main` (fast-forward from the last branch), push `main`.


**Also read `DIFFERENCES.md`** (Turkish): how the whole site, not just the character builder, compares with D&D Beyond (and its Maps VTT), Roll20, Foundry VTT and Owlbear Rodeo, including differences in how things work (accounts, permissions, data and syncing, dice). It ends with proposed work beyond the builder plan: E (table: dice expressions and hidden rolls, conditions, applying damage, SRD monsters and an encounter builder, several scenes, map drawing and a DM layer, walls and vision, handouts), F (saving sheets field by field instead of whole-object `set()`, campaign backup, undo, copying homebrew and maps between campaigns), G (a searchable SRD rules tab, SRD items), H (= phase D here). Each claim there is marked "(arandı)" (searched that day, sources listed) or "(genel bilgi)" (general knowledge, not re-checked); re-check before building on one. Ask the user which phase to start; the builder plan (A–D) was the default until they choose.

## Where things stand

| Branch | State |
|---|---|
| `main` | `1421cb4` (pushed): everything up to the role model and the new layout. `kampanya-sistemi`, `karakter-olusturucu`, `arayuz-duzeni` and `kampanya-rolleri` are all contained in it (fast-forwarded 2026-11-07). The feature-plan branches below are **not** in `main` yet. |
| `vtt-ozelligi` | VTT work, merged into `main`. Pushed. |
| `kampanya-sistemi` | Campaign system. Contained in `main`. |
| `arayuz-duzeni` | Holds `LAYOUT_UI.md` (the role and layout plan). Contained in `main`. |
| `sayfa-hesaplari` | Cut from `zar` for feature plan step 3 (sheet maths). Done and pushed. |
| `savas` | Cut from `sayfa-hesaplari` for feature plan step 4 (combat). **Current branch**. Not pushed. |
| `zar` | Cut from `karakter-aktarma` for feature plan step 2 (dice). Done and pushed. |
| `karakter-aktarma` | Cut from `kataloglar` for feature plan step 1 (character import). Done and pushed. |
| `kataloglar` | Cut from `main` on 2026-11-07 for feature plan step 6 (catalogs). Done and pushed. Not merged: everything goes into `main` in one merge when the whole plan is done. |
| `kampanya-rolleri` | Cut from `arayuz-duzeni`. Everything in `LAYOUT_UI.md` is done, one commit per step: the role model (R1–R6) and the new layout (L1–L6, plus Notes as its own section). Pushed, and on 2026-11-07 fast-forwarded into `main` (`main` = `1421cb4`, pushed). Read `LAYOUT_UI.md` for what changed where. |
| `karakter-olusturucu` | Character builder and the spell plan. Contained in `main`. |

Branch chain of the feature plan: `main` → `kataloglar` (step 6) → `karakter-aktarma` (step 1) → `zar` (step 2) → `sayfa-hesaplari` (step 3) → `savas` (step 4). `git log --oneline main..savas` lists everything not yet in `main`.

## Run and test

```bash
npm start
```
Serves on http://localhost:3000.

```bash
npm test
```
Runs all tests (`node --test "tests/*.test.js"`): 156 tests. On 2026-11-07 they passed with Node (v24) and in `tests/browser-runner.html`.

Node v24 and git are installed on the 2026-11-07 machine (`/c/Program Files/nodejs/node`). In the Claude desktop app the site runs through `.claude/launch.json` ("start" = `npm run start`, port 3000) in the browser pane. Python is not installed; use Node for scripts. In bash, avoid `node -e` with text containing a single quote (write a script file instead).

## Character builder: how it fits together

The builder follows D&D 5e **2014** rules (SRD 5.1 only, CC-BY-4.0 attribution is in `rules/srd5.js`).

- **`rules/srd5.js`**: rules data → `window.RULES_SRD5`. Contents:
  - 12 classes with one subclass each
  - 9 species
  - 1 background (Acolyte) and 1 feat (Grappler)
  - spell slot tables and ability score methods
- **`character-engine.js`**: no DOM; runs in the browser and in Node → `window.CharacterEngine`.
  - A character is stored as its choices in `state.build`.
  - `derive(build, rules)` produces the sheet's `characterStats` format.
  - `validate` and `pendingChoices` take `{allowManual, strict}`.
  - Level up: `levelUp`, `levelUpOptions` (multiclass prerequisites) and `newIssues` (what a new level asks for).
  - Old sheets: `buildFromSheet` guesses a build from an old-forge sheet.
  - Homebrew: `mergeRules`.
- **`character-builder.js`**: UI.
  - `CharacterBuilder.open({rules, opts, build, editing, notice, onDone})` opens the 7-step wizard plus Quick Build.
  - `CharacterBuilder.levelUp({rules, opts, build, onDone})` opens the one-screen level up.
- **`homebrew-editor.js`**: per-campaign species, subraces, backgrounds, feats and subclasses, plus builder settings (`campaigns/<id>/homebrew`, `campaigns/<id>/settings/builder`).
- **`campaign.js`**:
  - "🎭 My characters": rename, copy, delete, and set or remove the portrait.
- **`index.html`** hook-up, in the "CHARACTER BUILDER HOOK-UP" block:
  - `openCharacterForgeModal` decides between builder and old forge: old sheets get a conversion offer, otherwise `openLegacyForgeModal`.
  - Other functions: `openLevelUp`, `convertToBuilder`, `sheetFromBuild`, `applyRebuiltCharacter`.
  - Saving keeps gear, spells, AC, notes and the player's own feature cards.
- **VTT** (`vtt.js`):
  - A token with no image shows its owner's character portrait (`tokenImage`).
  - The DM's "👥 Party" button adds a token for each player who has a character.

## Known gaps

- The ⚔ Forge edit screen only shows choices for the **first** class. Multiclass choices are made in the level-up dialog.
- A character built with campaign homebrew can only be re-edited inside that campaign.
- Builder features and species traits have SRD 5.1 text and limited uses (feature plan 3.4); the background feature (Shelter of the Faithful) and the feat (Grappler) are still names only (no 5e-bits source file for them yet).
- Weapon attacks and damage are on Overview's Actions box (feature plan 3.1); spell attack and save DC per class and cantrip damage too (3.2); AC follows the armour and class features (3.3).
- Click-to-roll from the sheet covers checks, saves, skills, initiative and death saves (feature plan 2.4); attacks wait for 3.1.
- Prepared spells are marked and counted in the Spells tab (feature plan 3.5). Spell picks in the builder are 2014 (SRD 5.1) only; 2024 spells exist only in the Spells tab catalog (C1).
- Existing builder-made characters must complete their spell picks before an edit or level up can be saved (seeded from their Spells tab where possible).
- Tool, instrument and language picks are free text; "any simple weapon"-type equipment becomes a placeholder item (B5).
- No print / PDF / JSON export, no homebrew sharing between campaigns, no homebrew class form, no companion stat blocks (C2–C4).
- Licence switch postponed (spell plan step 13); SRD warlock 6th-level list may be missing Arcane Gate; `npm test`, phones and real players not tried (D).
- Conversion drops skill proficiencies it cannot explain, and assumes ASIs were +2 to the highest score. The review screen lists both before anything saves.
- Old sheets with non-SRD classes (for example Artificer) or multiclass text cannot be converted.

## Next steps

`CHARACTERS.md` is written. Work now follows the 14-step **spell plan**:

1. SRD 5.1 data (`rules/srd5-spells.js`, 319 spells): done.
2. SRD 5.2 data (`rules/srd52-spells.js`, 339 spells): done.
3. Tagging (ruleset, source, license): done.
4. Duplicates merged, one entry per spell per ruleset: done.
5. Non-SRD spells (278) kept as name-only: done.
6. Spells tab reads the new data, ruleset and book filters: done.
7. Saved spells refreshed from the catalog (`spell-saved.js`): done.
8. Class rules in `rules/srd5.js` (on each class's `spellcasting`: `cantrips`, `known`, `prepared`, `replaceOnLevelUp`, `ritual`, `spellbook`, `mysticArcanum`, `magicalSecrets`; Lore's `additionalMagicalSecrets`): done. Data only; the engine starts using it in step 10.
9. Subclass and race spells in `rules/srd5.js`: Life `alwaysPrepared`, Devotion `alwaysPrepared`, Land `bonusCantrips` + `circleSpells` (8 lands), Fiend `expandedSpells`, High Elf and Tiefling `spells` (the old unused `cantrip: 'wizard'` is replaced): done. Data only; no tests yet (the user wants tests at the end, step 14).
10. Engine (`character-engine.js`): done. `attachSpells(rules, SPELLS_SRD5)` puts the spell data on the rules; only then does `validate` check and ask for spell picks (`build.choices.spells`, shape in the file's header), so the builder is unchanged until step 11 attaches it. New: `spellLimits`, `speciesSpells`, `spellOptions`, `classMaxSpellLevel`; `derive().spellcasting` now also has `classes`, `species` and `spells` (every spell the build has, with its source and kind). Prepared spells are a daily choice, so only their number is worked out. No tests yet (step 14).
11. Builder UI: done. `index.html` loads `rules/srd5-spells.js`; `builderRules()` attaches it once. The wizard has a Spells step (after Choices), level up asks for the class's spell picks, Quick Build fills them (`autoSpells`). On save, `syncBuildSpellsToSheet` copies the build's spells into the Spells tab marked `fromBuild` (replaced on every rebuild; the player's own entries stay). `seedSpellPicks` starts the picks of an older character from its Spells tab (2014 entries only) so editing or levelling up doesn't ask for everything again. Checked in the browser without logging in (saves stubbed); not tried by a real player yet.
12. Homebrew spells: done. The homebrew editor has a Spells tab (stored at `campaigns/<id>/homebrew/spells/<id>` in the `rules/srd5-spells.js` shape, `source: 'HB'`, `license: 'homebrew'`; names can't repeat an SRD or another homebrew spell). `mergeRules` adds them to `rules.spells` (only when SRD spell data is attached; never replacing an SRD spell), so the builder offers them. The Spells tab adds the active campaign's homebrew spells to its catalog (book "Campaign homebrew") on the `campaignrules` event. `firebase-rules/database.rules.json` has a `homebrew/spells` rule (still not deployed). Checked in the browser with the campaign reads and writes stubbed.
13. Licence switch: a setting that hides `license: none` spells. **Postponed** (2026-11-06): the user said the site stays among friends for now, so everything stays visible. Do it before the site goes public: a site-wide setting (suggested default off), hiding non-SRD spells from the catalog, search and book filter; spells already saved on sheets kept by name; and a visible CC-BY attribution for the SRD.
14. Tests and docs: done. `tests/engine-spells.test.js` (25 tests: subclass/species spell data, spell limits, options, validation, level up, derive, homebrew spells); 93 tests in all pass in `tests/browser-runner.html`; `npm test` not yet run (no Node here). `CHARACTERS.md` has a "Büyüler" section and the new files, paths and tests.

The spell plan is finished except step 13 (postponed).

## Feature plan (agreed 2026-11-07)

Every new piece of work goes on its own new branch. Order: **6** catalogs → **1** character import (site JSON, fillable PDF fields, a D&D Beyond JSON file the player downloads) → **2** dice (`NdX+M`, advantage, hidden DM rolls, click-to-roll from the sheet) → **3** sheet maths (attacks, AC from armour, feature text and uses, prepared spells, a DM "grant a level" the player then takes) → **4** combat (conditions, damage from the token, monster stat blocks, encounter builder) → **5** map (several scenes, drawing and a DM layer, fog that opens around player tokens with a set radius, walls, handouts) → **7** PDF (print CSS, filling the official sheet) → **8** sound (a simple ambience player; other sites' extensions are not worth emulating). A "How to use" / Help section comes last, after all of these.

Step 6 so far (branch `kataloglar`):
1. Data: done. `tools/build-srd-catalogs.js` turns the 5e-bits data (2014 and 2024) into `rules/catalog/*.json`: monsters, equipment, magic items, conditions, and the SRD 5.1 rule sections (the 2024 data has none). Licence and attribution in `rules/catalog/LICENSE.md` and in each file's `meta`. Tests: `tests/catalogs.test.js`.
2. Rules section: done. **📚 Rules** is a fifth section in the top bar (`rules-catalog.js`, `#rules-view-container`). Tabs: Rules (2014 only), Conditions, Equipment, Magic items, Monsters; a 2014 / 2024 switch; search (names, and the text of rules and conditions) and a filter per tab (chapter, kind, rarity, CR band); the entry on the right (on phones the list and the entry take turns, with ← List). Files load on first use and stay for the session; the last tab and ruleset are remembered in the browser. The CC-BY attribution of the loaded file shows under it. Tests: `tests/rules-catalog.test.js`.
3. Adding from the catalog: done. Equipment and magic item entries in Rules have **➕ Add to <sheet>** (the sheet open in the Character section; hidden for a DM with no player sheets) and, for DMs, **📦 Add to item store**. `RulesCatalog.toStoreDef` turns a catalog entry into the item store shape (weapons: Simple/Martial, slot main; armour: base AC, Light/Medium/Heavy, slot chest; shields +2, slot off; magic items: rarity, attunement, a slot guessed from the name), and `HomebrewEditor.itemForSheet` into a sheet item, so armour from the catalog sets AC the way the sheet already computes it. The homebrew Items form gained "Armour category" and "Weapon category". Sheet items remember `fromCatalog` (e.g. `srd51:longsword`).

Step 6 is done (branch `kataloglar`, pushed).

Step 1, character import (branch `karakter-aktarma`, cut from `kataloglar`):
1. Site files: done. `character-transfer.js` (no DOM; tested) writes and reads `{ format: "mamirock-character", version: 1, name, sheet }`. In 🎭 My characters each character has **⬇** (download `<name>.mamirock.json`, without the shared spell catalog) and the list has **⬆ From a file…**, which makes a new character of the account (`Campaigns.importCharacterText` / `saveImportedCharacter`, `fbWriteCharacterSheet`). Imports keep only items with a name and portraits that are `data:image/` under 200 KB, and take the file's name. Tests: `tests/character-transfer.test.js`.
2. Fillable PDF sheets: done. 🎭 My characters has **📄 From a PDF character sheet…**. `campaign.js` loads pdf-lib 1.17.1 from cdnjs only then (`readPdfFields`), `CharacterTransfer.fromPdfFields` maps the fields and `sheetFromPdf` puts them on the site's empty sheet (`getDefaultState`), saved as a new character (`importCharacterFields`).
   - Field names were taken from the official WotC 2014 fillable sheet (downloaded 2026-11-07 from media.wizards.com for this; not kept in the repo). Checkbox numbers were checked against the page layout: Check Box 11 and 18–22 = saves STR…CHA, 23–40 = skills A–Z, 12–14 / 15–17 = death saves. Names are matched loosely, with common variants ("Character Name", "Class & Level", "Strength", "HP Max"…).
   - Read: name, class and level (multiclass: first class, total level, with a note), species, background, alignment, scores, PB, AC (base = AC − DEX so the sheet doesn't add DEX twice), initiative, speed, HP, saves, skills (a written bonus of mod + 2×PB = expertise), languages and armour/weapon/tool lines, coins, equipment lines with counts, spell names (levels from the SRD data; others kept by name), death saves, personality/ideals/bonds/flaws/backstory; long text boxes become "Imported from PDF" feature cards.
   - The imported character is a plain sheet. Opening it and pressing ⚔ Forge offers the existing conversion to the character builder, whose review screen shows what was guessed (checked in a test with `buildFromSheet`). Non-SRD classes stay plain sheets.
   - Not tried: a real D&D Beyond PDF (no sample yet; its field names may differ), scanned or flattened PDFs (refused with a message), password-protected PDFs.
3. D&D Beyond JSON: done, **not yet checked with a real file**. "⬆ From a file…" now also takes a D&D Beyond character JSON (`CharacterTransfer.detectJson` tells it from a site file; `fromDdbJson` reads it into the same shape as the PDF reader, `sheetFromPdf` builds the sheet). A "From D&D Beyond?" note under the buttons tells the player how to save their own public character's JSON from character-service.dndbeyond.com/character/v5/character/<id>.
   - Read: name, classes (starting class first; multiclass note), subclass, species/subrace, speed, scores (base + bonus/override stats + "<ability>-score" bonus modifiers), PB from level, save and skill proficiencies and expertise, armour/weapon/tool proficiencies and languages, HP (base + CON × level, minus damage taken, temp), coins, inventory (armour with AC and category, shields, weapons Simple/Martial, potions, rings, wondrous items; one equipped item per slot), spells from classes, species, feats and items (prepared kept), class features up to the class level, species traits and feats as names only (D&D Beyond's texts are book text), background, alignment, personality and notes, death saves, XP. The portrait is a web link and is not copied.
   - The field names are the ones community tools use; D&D Beyond's JSON is not an official API and has changed before. Tests use `tests/fixtures/ddb-character.json`, a made-up file in that shape. **When a real file is available, compare it with the fixture first.**

Step 1 is done (branch `karakter-aktarma`, pushed). A real D&D Beyond JSON (a Warlock 3) was imported by the user on 2026-11-07 and read correctly (class, subclass, species, scores, proficiencies, 18 items, 6 SRD spells); it was deleted afterwards at their request. One flaw seen: D&D Beyond's heading entries ("Hit Points", "Proficiencies", "Equipment", "Age", "Size", "Speed", "Languages", "Ability Score Increase") came through as feature cards; fixed in feature plan 3.7. A real D&D Beyond PDF has not been tried.

Step 2, dice (branch `zar`, cut from `karakter-aktarma`):
1. Engine: done. `dice.js` (`window.Dice`, no DOM): `NdX`, `d%`, numbers, `+`/`-`, keep/drop (`kh`, `k`, `kl`, `dh`, `dl`), advantage/disadvantage on the first single d20, natural 20/1 flags, a text with every die (dropped ones struck through), limits (100 dice, 1000 sides, 20 parts, 120 characters) and messages for bad input. Random numbers come from `crypto.getRandomValues` without modulo bias. Tests: `tests/dice.test.js`.
2. Table dice bar: done. `index.html` loads `dice.js` before `vtt.js`. The d4–d100 quick buttons roll `1dX` through `Dice.roll`; next to them an expression box (Enter rolls; a bad expression turns the box red and shows the message; the last 10 good ones are offered back through a `<datalist>`, kept in localStorage `vtt-dice-history`) and an **Adv / Norm / Dis** switch (remembered in localStorage `vtt-dice-mode`; a d20 quick button honours it too). In `vtt.js`: `roll(expr, { label, mode })` builds the log entry `{ by, expr, total, text, crit, fumble, label?, at }` and `postRoll(entry)` writes it (same key scheme and 20-entry trim as before); both `roll` and `rollDie` are on `window.vttApi`. The log shows the label (or the expression), the total, and under it the per-die text; old `{ by, die, result, at }` entries still show as before. `firebase-rules/database.rules.json` (still a proposal) accepts either shape. On phones the dice group wraps onto a second line instead of scrolling sideways. Checked in the browser with writes stubbed (desktop and 375 px, no horizontal scroll); 128 tests pass in Node and in the browser runner.
3. Hidden DM rolls: done. A **🙈 Hidden** toggle (DMs only, `vtt-dm-only`; not remembered, and switched off when the role becomes player) in the dice bar. A hidden roll writes the full entry to `vtt/<room>/logHidden/<key>` and `{ by, hidden: true, at }` under the same key in `log`; DMs see the full entry marked 🙈, players see "rolled in secret ?". `roll(expr, { hidden })` overrides the toggle; a player's `hidden` is ignored. The 20-entry trim drops a hidden entry with its placeholder. Turning it on shows "hidden in the app only", and the button's tooltip explains it: without Firebase Auth `logHidden` still reaches every browser (the whole `vtt/<room>` is one listener). `firebase-rules/database.rules.json` (proposal) has `logHidden` and the placeholder shape. Checked in the browser with writes stubbed, as DM and (role switched in memory) as a player, desktop and 375 px.
4. Click-to-roll on the sheet: done. `vtt.js` exports `window.VTT = { roll, postRoll, getRollMode, setRollMode }`, usable before the Table section was ever opened (rolls go to `vtt/<active campaign>/log`; with no campaign they only show locally). In `index.html` ("CLICK-TO-ROLL" block after `resetDeathSaves`): `sheetRoll(label, bonus, opts)` rolls `Dice.d20(bonus)` labelled "<character name>: <label>" (the strip's name), honours the shared Adv / Norm / Dis mode and the DM's 🙈 toggle, and shows a toast with the per-die text. Small 🎲 buttons (`.roll-btn`): top-right of each ability card (check), next to each save's number, and a fifth column in the skills list; the existing click-to-edit on those numbers is unchanged. The character strip has a **🎲 Roll init** pill and an **Adv / Norm / Dis** switch (`stripDiceModeHtml`; both switches stay in step through the `dicemode` window event). The death-save panel has **🎲 Roll death save** (`rollDeathSave`): 10+ success, natural 1 = two failures, natural 20 = saves reset and HP to 1 (SRD 5.1); three of either is announced in the toast. Attacks come with 3.1. Checked in the browser with writes stubbed (desktop and 375 px, no horizontal scroll); the DM account had no sheet in that campaign, so the sheet was made visible in memory only.
5. Tests and docs: done. The log-entry and death-save logic moved out of `vtt.js` / `index.html` into `dice.js` so Node can test it: `Dice.logEntry(r, { by, label, at })`, `Dice.secretEntry(entry)`, `Dice.logView(entry, secret?)` (how a row reads, for new, old and hidden entries) and `Dice.deathSave(entry, boxes)`. `tests/dice.test.js` gained 4 tests (entry shape checked against the proposed database rules for `log` and `logHidden`, hidden placeholders, old entries, death saves): 132 tests pass in Node and in the browser runner. `VTT.md` has a "Zar" section, the new log schema and a test row.

Section 2 is done (branch `zar`, pushed 2026-11-07).

Step 3, sheet maths (branch `sayfa-hesaplari`, cut from `zar`):
1. Weapon attacks: done. New `sheet-maths.js` (`window.SheetMaths`, no DOM; loaded in `index.html` after `dice.js`). `weaponAttacks(items, { scores, prof, cs, catalogs })` gives one line per equipped weapon (main hand, off hand, then the rest): ability (STR; DEX for ranged; finesse takes the higher), to-hit (ability mod + PB if proficient + magic bonus from "+N" in the name or `attackBonus`), damage and versatile damage (die + mod), damage type, range/reach, notes. Damage comes from the SRD equipment catalog (`findWeapon`: `fromCatalog` id, else the name: plurals, "Crossbow, hand" = "Hand crossbow", "Elven longsword" ends in "longsword", "Staff of …" is a quarterstaff), else from the item's own `damage` text (builder starter items, "1d8/1d10 Slashing"). Proficiency (`weaponProficient`): the Simple/Martial switches, the "Weapons" line (`weaponProf`) or old `weapons` notes, by category or by weapon name; Simple + Martial together cover any weapon. Off-hand weapons add no positive ability modifier to damage (two-weapon fighting). On Overview, an **⚔️ Actions** box under the Prof/Speed/Init/AC pills: name, a short line (melee / thrown / range, type, ability, notes), **🎲 +to-hit**, damage and "2h" versatile buttons; they roll through `sheetRoll` (which now takes `opts.expr`) into the table log. After a natural 20 on an attack, that weapon's next damage roll doubles its dice (`critDamage`) and is labelled "critical". The catalogs load once through `RulesCatalog.load('items', '2014' | '2024')`; until then items with their own damage text still show. Tests: `tests/sheet-maths.test.js` (6). 138 tests pass in Node and in the browser runner. Checked in the browser with writes stubbed and test weapons added in memory (desktop and 375 px); the DM account has no sheet in that campaign, so the sheet was made visible in memory.
2. Spellcasting: done. `SheetMaths.castingClasses(cs, build, rules)` finds the spellcasting classes: from the builder build (`state.build.classes` with each class's `spellcasting.ability` in `RULES_SRD5`; paladins and rangers from level 2), else from the class text ("Wizard", "Bard 3 / Warlock 2") with a built-in ability table (`CASTER_ABILITY`, SRD classes plus artificer). `spellStats` gives save DC (8 + PB + mod) and spell attack (PB + mod) per class from the sheet's current scores (item bonuses included). `cantripLine(spell, srdEntry, stats, level)` gives each damaging cantrip on the sheet's spell list: attack or save (from the SRD data's `attack` / `save`, else the text), damage dice scaled at character levels 5 / 11 / 17 (`cantripTier`, `scaleDice`; Eldritch Blast adds beams instead), damage type, range and the class whose DC/attack it uses; spells without SRD data use their own damage text. In `index.html`: `computeSheetActions` builds weapons + cantrips; `spellcastingRowsHtml` draws a "✨ Spellcasting" part (per class: DC and 🎲 spell attack; per cantrip: 🎲 attack or "DC n ABL", and the damage button) at the end of Overview's Actions box and in a new card above the spell slots in the Spells tab (`#spellcasting-card`, refreshed by `renderSpellSlots`). Cantrip attacks share the weapons' crit handling. Tests: 4 more in `tests/sheet-maths.test.js` (142 in all, Node and browser runner). Checked in the browser with writes stubbed and a Wizard 5 set up in memory (narrow pane ~340 px and 1280 px).
3. Armour class: done. `SheetMaths.acFeatures(cs, build, rules, featureNames)` finds what changes AC: Unarmored Defense (barbarian +CON, monk +WIS and only without a shield, from `unarmoredDefense` in the rules), Draconic Resilience (`unarmoredBase: 13` on the draconic subclass) and the Defense fighting style (`build.choices.fightingStyles`, or a feature card named "Fighting Style: Defense"); plain sheets are read from the class / subclass text. `SheetMaths.armorClass(o)` works the AC out: armour base and DEX by category (or the existing DEX switch), else the best unarmoured formula (the player's own base or a feature), plus shield, magic, custom bonus and +1 Defense in armour; it returns the parts and a `source`. `calculateCharacterAC` in `index.html` now calls it (same return fields as before, plus `abilityBonus`, `defenseBonus`, `source`; a small fallback while the deferred script loads), and the AC pill's tooltip lists the parts. **Bug fixed on the way:** a builder sheet stores `cs.ac` as a total that already has DEX in it, and the sheet used it as the unarmoured base and added DEX again; with a build, `cs.ac` is no longer a base (only `unarmoredBaseAc`, set by hand, is). Plain sheets keep reading their base from `cs.ac` as before. Also `getEquippedItemBonuses` now sees the builder's starter gear (`category: 'armor' | 'shield'`, `baseAc`, `armorType`, `acBonus`), which it missed before. Tests: 3 more in `tests/sheet-maths.test.js` (145 in all). Checked in the browser with writes stubbed: the DM sheet's AC is unchanged (27); barbarian 15 / with shield 17, monk 15 / with shield 14, fighter with Defense in chain mail 17 (desktop and 375 px).
4. Feature text and limited uses: done. New `tools/build-srd5-features.js` turns the 5e-bits SRD 5.1 `5e-SRD-Features.json` and `5e-SRD-Traits.json` (downloaded with the user's permission on 2026-11-07 to the scratchpad, not kept in the repo; usage in the tool's header) into `rules/srd5-features.js` (`window.FEATURES_SRD5`, ~154 KB, CC-BY attribution in its header; loaded in `index.html` after `rules/srd5-spells.js`). It holds each class's feature text and the species trait text, with shorter alias keys ("Action Surge (1 use)" is also "action surge", "Spellcasting: Bard" also "spellcasting"), and `lookup(name, classId)` tries the builder's names ("Action Surge (two uses)", "Destroy Undead (CR 2)", "Draconic Ancestry: Red (…)", "Wild Shape Improvement", "Cantrip" = High Elf Cantrip). Every builder feature and species trait finds its text (tested). Limited uses are written by hand in the tool's `USES` table from the SRD class tables: Rage, Bardic Inspiration (CHA mod, short rest from bard 5), Channel Divinity (cleric 1/2/3, paladin 1), Wild Shape, Natural Recovery, Second Wind, Action Surge, Indomitable, Ki, Wholeness of Body, Divine Sense, Lay on Hands (a pool, written into the text, not pips), Cleansing Touch, Holy Nimbus, Stroke of Luck, Font of Magic (sorcery points), Dark One's Own Luck, Hurl Through Hell, Mystic Arcanum, Arcane Recovery, Breath Weapon, Relentless Endurance; `usesFor(name, classId, { classLevel, mods })`. In `index.html`: `featuresFromDerived(d, build)` gives builder cards their text, `maxUses` and `resetType` (`srdFeatureExtras`, `featureContext`); `refreshBuildFeatures()` fills cards saved before this (only empty text and missing uses, never the player's own cards or text; memory only, saved with the next normal save, like `refreshSavedSpells`, and run at the same place). **Correction:** the handoff said the rest buttons already reset feature uses; nothing did. The Features tab now has **☕ Short Rest** (features that reset on a short rest) and **🌙 Long Rest** (every feature and the spell slots) (`restFeatures`), and the Spells tab's Long Rest also brings features back. The Features header's buttons now wrap (they overflowed at phone width). Tests: `tests/srd5-features.test.js` (3; in the browser runner's list). 148 tests pass in Node and the browser runner. Checked in the browser with writes stubbed and a barbarian 6 with old empty cards set up in memory (Rage 4 / long rest, Breath Weapon 1 / short rest; ~340 px and 1280 px).
5. Prepared spells: done. `SheetMaths.castingClasses` now tells which classes prepare (`prepares: { divisor, from }`: from the rules' `spellcasting.prepared`, or a built-in table for plain sheets: cleric, druid, paladin (level / 2), wizard (from the spellbook)). `SheetMaths.preparedPlan(list, classes, scores)` sorts the saved spells: cantrips; always prepared (`buildKind: 'always'`, locked, not counted); ready (known / Magical Secrets / Mystic Arcanum / innate spells, or a spell only a known-spells class of this character has: no preparing); preparable (by `buildClass`, `buildKind: 'spellbook'` for the wizard, or the spell's class list; a spell with no class list on a one-preparer sheet counts as theirs); other. Limit per class = ability mod + class level / divisor (at least 1), from current scores. In the Spells tab: a "📿 <Class> prepared: n / limit" line under the list title, and on each card ☐ Prepare / ✅ Prepared (`toggleSpellPrepared`, saved as `prepared: true` on the spell; refused with a message at the limit, the button disabled) or 🔒 Always prepared; unprepared spells' names are dimmed. Builder spells now also record `buildClass` (the engine's `source`), and a rebuild keeps their `prepared` marks (`syncBuildSpellsToSheet`). On phones the card's buttons go under the text (`.spell-list-item` wraps under 640 px; it overflowed a little even before). Tests: 3 more in `tests/sheet-maths.test.js` (151 in all, Node and browser runner). Checked in the browser with writes stubbed and a Cleric 5 (Life) set up in memory: Bless locked, Fireball not preparable, limit 3 with WIS 6 and refused at the limit (375 px, ~340 px and 1280 px). A syntax slip in one edit stopped the main script once; caught in the browser and fixed before committing (all inline scripts parse).
6. DM grants a level: done. In the DM panel, **⬆ Grant a level** (`dmGrantLevel`; disabled on the DM's own vault) asks to confirm and sets `state.pendingLevelUp = { levels, by, at }` on the player's sheet (`SheetMaths.grantLevel`; granting again adds a level, up to 20), saved with the sheet like any DM edit. A banner above the character strip (`#level-up-banner`, `renderLevelUpBanner`, called from `renderAll`): the player sees "🎉 <DM> granted you a level!" with **⬆ Level up** (the usual `openLevelUp`; plain sheets get its conversion offer) and, on sheets without the builder, **✔ Done by hand**; the DM looking at that sheet sees "You granted a level" with **Take back**. Saving a level-up takes one granted level (`SheetMaths.takeLevel`, inside `openLevelUp`'s `onDone`, so it is saved with the new level). Which banner: `SheetMaths.levelUpBanner(pending, { isDm, ownSheet })`. **Note:** like Gift Loot, the DM's grant saves the whole player sheet (`fbSaveInventory` is a whole-object write), so a player editing their sheet at the same moment can lose one side's change; plan F (saving field by field) would fix that. Test: 1 more in `tests/sheet-maths.test.js` (152 in all). Checked in the browser with writes stubbed: as DM on a made-up player key (button enabled, two grants = 2 levels, DM banner), then as that player (banner, Done by hand twice clears it); ~340 px and 1280 px. The level-up screen's save path itself was not run in the browser (it needs a builder character).
7. D&D Beyond import headings: done. `fromDdbJson` (`character-transfer.js`) leaves out entries named Hit Points, Proficiencies, Equipment, Age, Size, Speed, Languages, Ability Score Increase, Alignment and Creature Type (D&D Beyond lists a description's headings as features); "Ability Score Improvement" (a real class feature) stays. Test added to `tests/character-transfer.test.js` (153 in all, Node and browser runner). Not tried again with a real D&D Beyond file.

Section 3 is done (branch `sayfa-hesaplari`, pushed 2026-11-07).

Step 4, combat (branch `savas`, cut from `sayfa-hesaplari`):
1. Conditions: done. New `combat.js` (`window.Combat`, no DOM; loaded after `sheet-maths.js`): the 15 SRD conditions with icons (`CONDITIONS`), exhaustion levels 1–6 (`EXHAUSTION`), `normalize` / `toggle` / `setExhaustion` / `active` / `summary` on a `{ poisoned: true, …, exhaustion: 2 }` object. On the sheet, Overview has a **🩹 Conditions** panel above the death saves (`renderConditionsPanel`, `toggleSheetCondition`, `setSheetExhaustion`; `state.conditions`): chips with the SRD text as tooltip (`rules/catalog/srd51-conditions.json` via `RulesCatalog.load('conditions', '2014')`), an exhaustion select, and the active conditions with their text. On the table, a token shows up to 4 condition icons along its top (+n): a player token's come from its character sheet (`inventories/<sheet>/conditions`, read with the new `fbListenToSheetField` next to the HP listener), a monster token's from the token (`tokens/<id>/conditions`). DMs get condition buttons and an exhaustion select in the token menu (`conditionsSection`, `setTokenConditions`); for a player token that writes only the sheet's `conditions` field (new `fbSaveSheetField`, allowed fields `conditions` and `hp`), never the whole sheet. `firebase-rules/database.rules.json` (proposal) accepts `conditions` on tokens. `window.vttApi` also has `openTokenMenu` and `tokenConditions` for testing. Tests: `tests/combat.test.js` (3; in the browser runner). 156 tests pass. Checked in the browser with writes stubbed (sheet panel; a monster token's conditions saved on the token; a player token's sent as one sheet field). The canvas did not redraw at higher zoom in the hidden pane, so the icons were only seen small.

## Next plan: closing the gaps with other character builders

**Superseded on 2026-11-07 by the feature plan in "Resume here"**, which folds phases A and C2 into its steps 3 and 7. Kept for its details.

Written 2026-11-06 after comparing this builder with D&D Beyond, Roll20's Charactermancer and Foundry VTT's dnd5e system (from what those are generally known to offer; not re-checked live). Everything here stays within SRD 5.1 / 5.2 (CC-BY-4.0) or the campaign's homebrew: no book text. Do the phases in order; inside a phase the items are independent. Same working rules as above (ask before push/merge, stub saves when testing, tests at the end of a phase, commit per item).

What we already do as well or better: rules validation with DM-set strictness, multiclass prerequisites, per-campaign homebrew (species, subraces, backgrounds, feats, subclasses, spells), converting old sheets, Quick Build, the VTT link (portrait token, party button, HP bar), spells refreshed from the catalog. What the others have that we don't:

### Phase A: the sheet does the maths (highest value for play)

A1. **Feature text and limited uses.** Today features are names only, and builder features have no uses. Add SRD 5.1 feature descriptions (class, subclass, species traits, background feature, feat) to `rules/srd5.js` (or a separate `rules/srd5-features.js`, like the spells file), and for limited features `uses: { count by class level or ability mod, reset: 'short' | 'long' }`: Rage, Bardic Inspiration, Channel Divinity, Wild Shape, Second Wind, Action Surge, Indomitable, Ki, Lay on Hands (pool), Divine Sense, Sorcery Points, Arcane Recovery, Breath Weapon, Relentless Endurance, etc. `featuresFromDerived` then fills the sheet's existing feature cards (`maxUses`, reset type, desc), which the sheet's rest buttons already handle.
A2. **Attacks and actions.** No attack bonus or damage is worked out today. Add the SRD weapons table (damage, type, properties: finesse, light, heavy, reach, thrown, two-handed, versatile, ammunition, range) and compute per equipped weapon: attack bonus (proficiency + STR/DEX, finesse picks the higher), damage, Fighting Style effects (Archery, Dueling, Great Weapon), Extra Attack count; spell attack / save DC per class; cantrip damage scaling by character level. Show an "Actions" block on the sheet.
A3. **Equipment from data, AC that follows the armour.** Starting equipment is matched by name to the old forge's items; AC is only computed at creation. Add SRD armour, gear and packs (packs expand into their contents), "any simple weapon" style picks as real selects, a starting-gold shop with SRD prices, and recompute AC whenever armour/shield is equipped (Unarmored Defense, Draconic Resilience, Defense style included).
A4. **Click to roll.** The VTT has a dice roller and a shared log, the sheet has no roll buttons. Make ability checks, saves, skills, initiative, attacks/damage and death saves clickable, posting to the VTT log of the active campaign (advantage/disadvantage toggle).

### Phase B: builder comfort

B1. **Edit every class in ⚔ Forge** (known gap: only the first class's choices), and **remove a level** (undo the last level up), as D&D Beyond allows.
B2. **Prepared spells in the Spells tab.** Mark which spells are prepared today, check the count against the engine's `prepared` number, show always-prepared spells as locked, wizard prepares from the spellbook only. Rituals castable unprepared where the class allows.
B3. **Information while choosing.** Class, species, background and subclass cards that show their features and text (needs A1), a short "what this class does" line, and the ability scores each class wants (we already have `PRIORITY`).
B4. **Optional-rule settings for the DM** (next to strict / manual scores): allow feats or not, allow multiclassing or not, HP fixed / rolled / both, starting level, encumbrance on or off.
B5. **Choices the builder still writes as text:** tool and instrument picks (bard instruments, monk tools, dwarf tools exist), language picks from a list instead of free text, "any martial weapon"-type equipment.

### Phase C: bigger features

C1. **2024 rules (SRD 5.2) in the builder.** The Spells tab already has 2024 spells. Add `rules/srd52.js`: species without ability bonuses, backgrounds that give the ability increases and an origin feat, the 2024 class tables and features, weapon mastery, the SRD 5.2 feats. The engine and builder branch on `build.ruleset`; the campaign picks 2014 or 2024 (DM setting). Large: plan it as its own multi-step plan first.
C2. **Export, print, share.** A printable sheet (print CSS, "Save as PDF" from the browser), a JSON export / import of one character, and a read-only share link.
C3. **Homebrew between campaigns.** Export / import a campaign's homebrew as JSON, and a homebrew **class** form (the engine's `mergeRules` already takes `classes`; the editor has no form for it).
C4. **Companions.** Familiar, Wild Shape and summon stat blocks from the SRD monsters (CC-BY), shown on the sheet and droppable as VTT tokens.

### Phase D: before the site goes public (also in the warnings above)

Licence switch (spell plan step 13), Firebase Authentication instead of plain-text passwords, deploy and test the database rules, Firebase Storage for maps and portraits, real tests on phones and with two people at once, `npm test` on a machine with Node. Also check the SRD 5.1 warlock 6th-level list (Arcane Gate seems to be missing from the data).

Then: decide on merging `karakter-olusturucu` → `kampanya-sistemi` → `main` (ask first). Optional: the builder's edit screen showing every class's choices.

Note: on the machine used on 2026-11-06 evening, Node.js was not installed and `git` was only GitHub Desktop's copy (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). Steps 7 and 8 were tested with `tests/browser-runner.html` (serve the folder, open `/tests/browser-runner.html`): it runs every `tests/*.test.js` file through small stand-ins for `node:test`, `node:assert`, `fs` and `path`. 68 pass there. Run `npm test` once on a machine with Node to confirm. New test files have to be added to the `FILES` list in the runner.

## Before release (tell the friend)

- **Firebase Storage** is not enabled (the bucket returns 404). Maps fall back to data URLs in the database.
- **Database rules** are only a proposal in `firebase-rules/database.rules.json`, not deployed. The database is publicly readable and writable.
- **There is no Firebase Auth.** Permissions are enforced only in the UI. `accounts/` holds plain-text passwords. This is a security problem that the friend has to fix before real use.

## Working rules agreed with the user

- Do not push unless asked. Do not merge into `main` until the whole feature plan is done (then one merge, on the user's word).
- One new branch per plan section, cut from the previous section's branch; commit after each step and wait for the user's go (see "Resume here").
- The "How to use" / Help page is the very last task.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The site uses the live shared database:
  - Test only with throwaway data, or with stubbed saves (`window.save`, `fbSaveInventory`, `fbSaveVtt`).
  - Clean up afterwards.
  - The user may be using the site at the same time.
- Do not read account contents. Do not create real accounts with passwords in tests.
- In PowerShell, commit with `git commit -F <file>` or a bash heredoc, because quotes break.
