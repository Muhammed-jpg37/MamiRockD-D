# Handoff: MamiRock D&D site

State on 2026-11-06, for the next working session.

## Where things stand

| Branch | State |
|---|---|
| `main` | VTT plus initiative tracker and the LEGACY_BG startup fix. Pushed. |
| `vtt-ozelligi` | VTT work, merged into `main`. Pushed. |
| `kampanya-sistemi` | Campaign system, 7 steps, cut from `main`. Pushed, **not merged into `main`**. |
| `karakter-olusturucu` | Character builder, cut from `kampanya-sistemi`. **Not pushed, not merged.** Current branch. |

Commits on `karakter-olusturucu` (newest first):

- `dd0a121` Convert old-forge sheets (opt-in)
- `927895d` Level-up flow
- `ceea22e` Character portrait as the VTT token
- `b8024bc` My characters (rename, copy, delete, 10 per account)
- `e3e0a3d` Campaign homebrew editor and builder settings
- `8fa1363` The builder replaces the forge
- `2394d5c` The wizard
- `a55568f` SRD 5.1 rules data, engine and tests

Working tree: clean, apart from the untracked `.claude/` folder and this file.

## Run and test

```bash
npm start
```
Serves on http://localhost:3000.

```bash
npm test
```
Runs the engine tests (`node --test "tests/*.test.js"`). 33 tests pass.

On Windows, if `node` or `git` is not found, refresh PATH or use the full path `"/c/Program Files/nodejs/node.exe"`.

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
- Feature descriptions are names only. Spells known and cantrip counts are not modelled; players add spells in the Spells tab.
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
8. Class rules: cantrips known, spells known, prepared spells, wizard spellbook, Mystic Arcanum, Magical Secrets in `rules/srd5.js`. **Next.**
9. Subclass and race spells (Domain, Oath, Circle, Fiend, High Elf, Tiefling).
10. Engine: spell picks as pending choices, counts, highest level, multiclass lists.
11. Builder UI: a Spells step in the wizard and in level up, written to the Spells tab.
12. Homebrew spells in the campaign homebrew editor.
13. Licence switch: a setting that hides `license: none` spells.
14. Tests and docs (engine tests per table, `CHARACTERS.md`).

Then: decide on merging `karakter-olusturucu` → `kampanya-sistemi` → `main` (ask first). Optional: the builder's edit screen showing every class's choices.

Note: on the machine used on 2026-11-06 evening, Node.js was not installed and `git` was only GitHub Desktop's copy (`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). Step 7's tests were run in the browser through a small `node:test` shim, not with `npm test`.

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
