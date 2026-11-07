# Handoff: MamiRock D&D site

State on 2026-11-06 (evening), for the next working session. Start with "Where things stand", then "Next plan" at the end of the Next steps section.

**Also read `DIFFERENCES.md`** (Turkish): how the whole site, not just the character builder, compares with D&D Beyond (and its Maps VTT), Roll20, Foundry VTT and Owlbear Rodeo, including differences in how things work (accounts, permissions, data and syncing, dice). It ends with proposed work beyond the builder plan: E (table: dice expressions and hidden rolls, conditions, applying damage, SRD monsters and an encounter builder, several scenes, map drawing and a DM layer, walls and vision, handouts), F (saving sheets field by field instead of whole-object `set()`, campaign backup, undo, copying homebrew and maps between campaigns), G (a searchable SRD rules tab, SRD items), H (= phase D here). Each claim there is marked "(arandı)" (searched that day, sources listed) or "(genel bilgi)" (general knowledge, not re-checked); re-check before building on one. Ask the user which phase to start; the builder plan (A–D) was the default until they choose.

## Where things stand

| Branch | State |
|---|---|
| `main` | VTT, initiative tracker, LEGACY_BG fix and the campaign system: `main`, `origin/main` and `kampanya-sistemi` are the same commit (`20cd8a8`). |
| `vtt-ozelligi` | VTT work, merged into `main`. Pushed. |
| `kampanya-sistemi` | Campaign system. Same commit as `main`. Pushed. |
| `arayuz-duzeni` | Cut from `karakter-olusturucu` on 2026-11-07. Holds `LAYOUT_UI.md`, the plan for per-campaign roles and the new layout. Not pushed. |
| `kataloglar` | Cut from `main` on 2026-11-07 for feature plan step 6 (catalogs). **Current branch.** Not pushed. |
| `kampanya-rolleri` | Cut from `arayuz-duzeni`. **Current branch.** Everything in `LAYOUT_UI.md` is done, one commit per step: the role model (R1–R6) and the new layout (L1–L6, plus Notes as its own section). Pushed, and on 2026-11-07 fast-forwarded into `main` (`main` = `1421cb4`, pushed). Read `LAYOUT_UI.md` for what changed where. |
| `karakter-olusturucu` | Character builder and the spell plan, cut from `kampanya-sistemi`. Pushed up to `25decde`; the spell-plan commits after it (steps 7–14 and this handoff) are **not pushed**. **Not merged** into `main`. |

On `karakter-olusturucu`, after `main` (oldest first): character builder (`a55568f` … `dd0a121`, 8 commits), spell steps 1–6 (`957264d` … `40c0de2`), docs (`25decde`), then unpushed: step 7 `f61d72b`, 8 `fcf3a63`, 9 `6566754`, 10 `b720e27`, 11 `5a82711`, 12 `9cd44e5`, 14 `bbac6cb`, and the commit adding the "Next plan" below. `git log --oneline main..karakter-olusturucu` lists them.

## Run and test

```bash
npm start
```
Serves on http://localhost:3000.

```bash
npm test
```
Runs all tests (`node --test "tests/*.test.js"`): 110 tests. On 2026-11-07 they passed with Node (v24) and in `tests/browser-runner.html`.

On Windows, if `node` or `git` is not found, refresh PATH or use the full path `"/c/Program Files/nodejs/node.exe"`. On the machine used on 2026-11-06 evening neither was installed: `git` came from GitHub Desktop (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`), and the site was served with a small PowerShell `HttpListener` script instead of `npm start`.

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
- Feature descriptions are names only, and builder features have no limited uses (Rage, Ki, Channel Divinity…); the sheet's feature cards support uses but they stay empty (plan A1).
- No weapon attack bonus or damage anywhere; AC is only computed at creation, not when armour changes (A2, A3).
- No click-to-roll from the sheet; the VTT has a roller (A4).
- No "prepared today" in the Spells tab and no check of the prepared count (B2). Spell picks in the builder are 2014 (SRD 5.1) only; 2024 spells exist only in the Spells tab catalog (C1).
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

Step 6 is done. Next in the plan: **1** character import, on its own new branch.

## Next plan: closing the gaps with other character builders

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

- Do not push or merge unless asked.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The site uses the live shared database:
  - Test only with throwaway data, or with stubbed saves (`window.save`, `fbSaveInventory`, `fbSaveVtt`).
  - Clean up afterwards.
  - The user may be using the site at the same time.
- Do not read account contents. Do not create real accounts with passwords in tests.
- In PowerShell, commit with `git commit -F <file>` or a bash heredoc, because quotes break.
