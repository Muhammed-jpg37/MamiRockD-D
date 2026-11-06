/* ========================================================
   CHARACTER ENGINE (D&D 5e 2014)
   A character is stored as the choices made while building it
   (`build`); everything on the sheet is worked out from those
   choices by derive(). Levelling up adds a choice and derives
   again, so the sheet is never rebuilt from scratch.

   No DOM here: the same file runs in the browser
   (window.CharacterEngine) and in Node for the tests
   (tests/engine.test.js).

   build = {
     ruleset: '5e-2014', name,
     species, subrace,
     speciesChoices: { abilities: ['dex', 'con'], skills: [], ancestry, tool, languages: [] },
     background, backgroundChoices: { languages: [] },
     classes: [{ id, level, subclass, hp: [null | roll, ...] }],   // hp[k] = hit die result for that class's level k+1; null = average
     abilities: { method: 'standardArray' | 'pointBuy' | 'roll' | 'manual', base: { str, dex, con, int, wis, cha } },
     choices: {
       skills: { <classId>: [skill, ...] },                 // class skills (first class) or the multiclass skill pick
       subclassSkills: { <classId>: [skill, ...] },         // e.g. College of Lore's bonus skills
       expertise: [skill, ...],
       asi: { '<classId>:<level>': { type: 'asi', abilities: { str: 2 } } | { type: 'feat', feat } },
       fightingStyles: { '<classId>:<level>': styleId }
     },
     details: { alignment, ... }
   }
   ======================================================== */
(function (root) {
  'use strict';

  const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  const mod = (score) => Math.floor((Number(score) - 10) / 2);
  const proficiencyBonus = (level) => Math.ceil(Math.max(1, Math.min(20, level)) / 4) + 1;
  const averageHitDie = (die) => die / 2 + 1;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function newBuild(rules) {
    return {
      ruleset: rules.ruleset,
      name: '',
      species: null, subrace: null, speciesChoices: {},
      background: null, backgroundChoices: {},
      classes: [],
      abilities: { method: 'standardArray', base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      choices: { skills: {}, subclassSkills: {}, expertise: [], asi: {}, fightingStyles: {} },
      details: {}
    };
  }

  /* ---------- Lookups ---------- */

  function speciesOf(build, rules) {
    const sp = build.species && rules.species[build.species];
    const sub = sp && build.subrace && sp.subraces ? sp.subraces[build.subrace] : null;
    return { sp: sp || null, sub: sub || null };
  }

  // [{ entry, def, sub }] for each valid class entry, in order (the first is the starting class).
  function classList(build, rules) {
    return (build.classes || []).filter((c) => c && rules.classes[c.id]).map((c) => {
      const def = rules.classes[c.id];
      const sub = c.subclass && def.subclasses ? def.subclasses[c.subclass] || null : null;
      return { entry: c, def: def, sub: sub, level: Math.max(0, Math.min(20, Number(c.level) || 0)) };
    });
  }

  function totalLevel(build, rules) {
    return classList(build, rules).reduce((s, c) => s + c.level, 0);
  }

  // ASI / feat choices this build has reached: [{ key, classId, level }]
  function asiSlots(build, rules) {
    const out = [];
    classList(build, rules).forEach((c) => {
      (c.def.asiLevels || []).forEach((lvl) => { if (lvl <= c.level) out.push({ key: c.entry.id + ':' + lvl, classId: c.entry.id, level: lvl }); });
    });
    return out;
  }

  // Fighting style choices reached: [{ key, options }]
  function fightingStyleSlots(build, rules) {
    const out = [];
    classList(build, rules).forEach((c) => {
      Object.keys(c.def.fightingStyle || {}).forEach((lvl) => {
        if (Number(lvl) <= c.level) out.push({ key: c.entry.id + ':' + lvl, options: c.def.fightingStyle[lvl] });
      });
      if (c.sub && c.sub.fightingStyle) {
        Object.keys(c.sub.fightingStyle).forEach((lvl) => {
          if (Number(lvl) > c.level) return;
          const classStyles = Object.values(c.def.fightingStyle || {})[0] || Object.keys(rules.fightingStyles || {});
          out.push({ key: c.entry.id + ':' + lvl, options: classStyles });
        });
      }
    });
    return out;
  }

  /* ---------- Ability scores ---------- */

  function pointBuyCost(base, rules) {
    const pb = rules.abilityMethods.pointBuy;
    let total = 0;
    for (const a of ABILITIES) {
      const v = Number(base[a]);
      if (!(v in pb.cost)) return null;   // outside 8..15
      total += pb.cost[v];
    }
    return total;
  }

  // 4d6, drop the lowest, six times. rng() returns [0, 1) (Math.random by default).
  function rollAbilityScores(rng) {
    rng = rng || Math.random;
    const d6 = () => 1 + Math.floor(rng() * 6);
    return Array.from({ length: 6 }, () => {
      const dice = [d6(), d6(), d6(), d6()].sort((a, b) => a - b);
      return dice[1] + dice[2] + dice[3];
    });
  }

  // Racial bonuses, then ASIs (capped at the rules' maximum, 20).
  function abilityScores(build, rules) {
    const base = Object.assign({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, (build.abilities && build.abilities.base) || {});
    const { sp, sub } = speciesOf(build, rules);
    const racial = {};
    ABILITIES.forEach((a) => { racial[a] = 0; });
    [sp && sp.abilityBonuses, sub && sub.abilityBonuses].forEach((b) => { if (b) Object.keys(b).forEach((a) => { racial[a] += b[a]; }); });
    if (sp && sp.abilityChoice) {
      ((build.speciesChoices || {}).abilities || []).slice(0, sp.abilityChoice.count).forEach((a) => {
        if (racial[a] !== undefined) racial[a] += sp.abilityChoice.amount;
      });
    }
    const scores = {};
    ABILITIES.forEach((a) => { scores[a] = Number(base[a]) + racial[a]; });

    const asi = (build.choices && build.choices.asi) || {};
    const feats = [];
    asiSlots(build, rules).forEach((slot) => {
      const c = asi[slot.key];
      if (!c) return;
      if (c.type === 'feat') {
        feats.push(c.feat);
        const f = rules.feats[c.feat];
        if (f && f.abilityBonuses) Object.keys(f.abilityBonuses).forEach((a) => { scores[a] = Math.min(rules.maxAbility, scores[a] + f.abilityBonuses[a]); });
      } else if (c.abilities) {
        Object.keys(c.abilities).forEach((a) => {
          if (scores[a] === undefined || scores[a] >= rules.maxAbility) return;
          scores[a] = Math.min(rules.maxAbility, scores[a] + Number(c.abilities[a] || 0));
        });
      }
    });
    return { base: base, racial: racial, scores: scores, feats: feats };
  }

  /* ---------- Spellcasting ---------- */

  function spellcasting(build, rules, scores, prof) {
    const casters = classList(build, rules).filter((c) => c.def.spellcasting && c.level > 0);
    const slotCasters = casters.filter((c) => c.def.spellcasting.progression !== 'pact');
    let casterLevel = 0;
    if (slotCasters.length === 1) {
      // A single spellcasting class uses its own table: half casters get slots from level 2.
      const c = slotCasters[0];
      casterLevel = c.def.spellcasting.progression === 'full' ? c.level : (c.level >= 2 ? Math.ceil(c.level / 2) : 0);
    } else {
      slotCasters.forEach((c) => {
        casterLevel += c.def.spellcasting.progression === 'full' ? c.level : Math.floor(c.level / 2);
      });
    }
    const slots = {};
    (rules.spellSlots[casterLevel] || []).forEach((n, i) => { slots[i + 1] = n; });
    const pactClass = casters.find((c) => c.def.spellcasting.progression === 'pact');
    const pact = pactClass ? { slots: rules.pactSlots[pactClass.level][0], level: rules.pactSlots[pactClass.level][1] } : null;
    const abilities = casters.map((c) => {
      const a = c.def.spellcasting.ability;
      return { classId: c.entry.id, ability: a, saveDc: 8 + prof + mod(scores[a]), attack: prof + mod(scores[a]) };
    });
    return { casterLevel: casterLevel, slots: slots, pact: pact, abilities: abilities };
  }

  /* ---------- derive(): choices in, sheet out ---------- */

  function derive(build, rules) {
    const classes = classList(build, rules);
    const level = Math.max(1, classes.reduce((s, c) => s + c.level, 0));
    const prof = proficiencyBonus(level);
    const { sp, sub } = speciesOf(build, rules);
    const bg = build.background ? rules.backgrounds[build.background] || null : null;
    const ab = abilityScores(build, rules);
    const scores = ab.scores;
    const mods = {};
    ABILITIES.forEach((a) => { mods[a] = mod(scores[a]); });
    const choices = build.choices || {};

    // Hit points: the first character level gets the full hit die, later levels the roll or the average.
    let hpMax = 0;
    classes.forEach((c, ci) => {
      for (let k = 1; k <= c.level; k++) {
        const isFirst = ci === 0 && k === 1;
        const rolled = (c.entry.hp || [])[k - 1];
        const die = isFirst ? c.def.hitDie : (Number.isInteger(rolled) && rolled >= 1 && rolled <= c.def.hitDie ? rolled : averageHitDie(c.def.hitDie));
        hpMax += Math.max(1, die + mods.con);
      }
      if (c.sub && c.sub.hpPerLevel) hpMax += c.sub.hpPerLevel * c.level;
    });
    const speciesHpPerLevel = ((sp && sp.hpPerLevel) || 0) + ((sub && sub.hpPerLevel) || 0);
    hpMax += speciesHpPerLevel * level;

    // Saving throws come from the starting class only.
    const saveProfs = {};
    ABILITIES.forEach((a) => { saveProfs[a] = !!(classes[0] && classes[0].def.saves.includes(a)); });

    // Skills from every source.
    const skillSet = new Set();
    const addSkills = (list) => (list || []).forEach((s) => { if (rules.skills[s]) skillSet.add(s); });
    addSkills(sp && sp.skills);
    addSkills(sub && sub.skills);
    addSkills((build.speciesChoices || {}).skills);
    addSkills(bg && bg.skills);
    classes.forEach((c) => {
      addSkills((choices.skills || {})[c.entry.id]);
      addSkills((choices.subclassSkills || {})[c.entry.id]);
    });
    const skillProfs = {};
    Object.keys(rules.skills).forEach((s) => { skillProfs[s] = skillSet.has(s); });
    // Expertise doubles the proficiency bonus; the sheet takes it as an extra bonus.
    const skillCustomBonuses = {};
    (choices.expertise || []).forEach((s) => { if (skillSet.has(s)) skillCustomBonuses[s] = prof; });

    // Armour class without armour: the best formula available.
    let acUnarmored = 10 + mods.dex;
    let acSource = 'base';
    classes.forEach((c) => {
      if (c.def.unarmoredDefense) {
        const v = 10 + c.def.unarmoredDefense.reduce((s, a) => s + mods[a], 0);
        if (v > acUnarmored) { acUnarmored = v; acSource = c.entry.id; }
      }
      if (c.sub && c.sub.unarmoredBase) {
        const v = c.sub.unarmoredBase + mods.dex;
        if (v > acUnarmored) { acUnarmored = v; acSource = c.entry.id + ':' + c.entry.subclass; }
      }
    });

    // Proficiencies: the starting class in full, later classes only their multiclass share.
    const join = (parts) => Array.from(new Set(parts.filter(Boolean).join(', ').split(',').map((s) => s.trim()).filter(Boolean))).join(', ');
    const armor = [], weapons = [], tools = [];
    classes.forEach((c, i) => {
      const src = i === 0 ? c.def : (c.def.multiclass || {});
      armor.push(src.armor); weapons.push(src.weapons); tools.push(src.tools);
      if (c.sub) { armor.push(c.sub.armor); weapons.push(c.sub.weapons); tools.push(c.sub.tools); }
    });
    [sp, sub].forEach((s) => { if (s) { armor.push(s.armor); weapons.push(s.weapons); tools.push(s.tools); } });
    if ((build.speciesChoices || {}).tool) tools.push(build.speciesChoices.tool);
    if (bg) tools.push(bg.tools);

    const languages = [].concat((sp && sp.languages) || [], (sub && sub.languages) || [], (build.speciesChoices || {}).languages || [], (build.backgroundChoices || {}).languages || []);

    // Features, in level order.
    const features = [];
    classes.forEach((c) => {
      for (let k = 1; k <= c.level; k++) {
        ((c.def.features || {})[k] || []).forEach((name) => features.push({ name: name, source: c.def.name, level: k, category: 'CLASS' }));
        if (c.sub) ((c.sub.features || {})[k] || []).forEach((name) => features.push({ name: name, source: c.sub.name, level: k, category: 'CLASS' }));
        if ((c.def.asiLevels || []).includes(k)) {
          const pick = (choices.asi || {})[c.entry.id + ':' + k];
          const label = !pick ? 'Ability Score Improvement' : pick.type === 'feat' ? 'Feat: ' + ((rules.feats[pick.feat] || {}).name || pick.feat) : 'Ability Score Improvement (' + Object.keys(pick.abilities || {}).map((a) => a.toUpperCase() + ' +' + pick.abilities[a]).join(', ') + ')';
          features.push({ name: label, source: c.def.name, level: k, category: 'FEATS' });
        }
      }
    });
    [sp, sub].forEach((s) => { if (s) (s.traits || []).forEach((t) => features.push({ name: t, source: s.name, level: 1, category: 'SPECIES' })); });
    if (sp && sp.ancestry && (build.speciesChoices || {}).ancestry && sp.ancestry[build.speciesChoices.ancestry]) {
      const an = sp.ancestry[build.speciesChoices.ancestry];
      features.push({ name: 'Draconic Ancestry: ' + an.name + ' (' + an.damage + ', ' + an.breath + ')', source: sp.name, level: 1, category: 'SPECIES' });
    }
    if (bg && bg.feature) features.push({ name: bg.feature, source: bg.name, level: 1, category: 'BG' });
    Object.keys(choices.fightingStyles || {}).forEach((key) => {
      const st = rules.fightingStyles[choices.fightingStyles[key]];
      const owner = rules.classes[key.split(':')[0]];
      if (st) features.push({ name: 'Fighting Style: ' + st.name, source: owner ? owner.name : key.split(':')[0], level: Number(key.split(':')[1]), category: 'CLASS' });
    });

    const casting = spellcasting(build, rules, scores, prof);
    const hitDice = classes.map((c) => c.level + 'd' + c.def.hitDie).join(' + ');
    const className = classes.length === 1 ? classes[0].def.name : classes.map((c) => c.def.name + ' ' + c.level).join(' / ');
    const subclassName = classes.map((c) => c.sub && c.sub.name).filter(Boolean).join(', ');
    const senses = [(sp && sp.senses) || '', (sub && sub.senses) || ''].filter(Boolean).join(', ');

    // The character sheet's own format (index.html state.characterStats), so the existing sheet keeps working.
    const characterStats = {
      str: scores.str, dex: scores.dex, con: scores.con, int: scores.int, wis: scores.wis, cha: scores.cha,
      profBonus: prof,
      speed: (sub && sub.speed) || (sp && sp.speed) || 30,
      initBonus: mods.dex,
      ac: acUnarmored,
      characterClass: className || '',
      subclass: subclassName,
      species: sp ? sp.name : '',
      subrace: sub ? sub.name : '',
      level: level,
      armorProf: join(armor),
      weaponProf: join(weapons),
      toolProf: join(tools),
      languages: Array.from(new Set(languages)).join(', '),
      saveNotes: '',
      senseNotes: senses,
      saveProfs: saveProfs,
      skillProfs: skillProfs,
      saveCustomBonuses: {},
      skillCustomBonuses: skillCustomBonuses
    };

    return {
      level: level,
      proficiencyBonus: prof,
      abilities: { base: ab.base, racial: ab.racial, scores: scores, mods: mods },
      feats: ab.feats,
      hp: { max: hpMax, hitDice: hitDice },
      acUnarmored: acUnarmored,
      acSource: acSource,
      size: (sp && sp.size) || 'Medium',
      resistances: [(sp && sp.resistances) || '', (sub && sub.resistances) || ''].filter(Boolean),
      spellcasting: casting,
      features: features,
      characterStats: characterStats
    };
  }

  /* ---------- validate(): what's missing or against the rules ---------- */
  // opts.allowManual: the campaign lets players type ability scores.
  // opts.strict === false: rule breaks are reported as warnings instead of errors (DM-unlocked campaigns).
  // Missing choices are always errors with pending: true, so the builder can ask for them.

  function validate(build, rules, opts) {
    opts = opts || {};
    const issues = [];
    const strict = opts.strict !== false;
    const err = (code, message, path, pending) => issues.push({ level: pending || strict ? 'error' : 'warning', code: code, message: message, path: path, pending: !!pending });
    const choices = build.choices || {};

    if (build.ruleset && build.ruleset !== rules.ruleset) err('ruleset', 'This character uses ' + build.ruleset + ' rules.', 'ruleset');

    // Species
    const { sp, sub } = speciesOf(build, rules);
    if (!build.species) err('species-missing', 'Choose a species.', 'species', true);
    else if (!sp) err('species-unknown', 'Unknown species "' + build.species + '".', 'species');
    if (sp) {
      if (sp.subraces && Object.keys(sp.subraces).length && !build.subrace) err('subrace-missing', 'Choose a ' + sp.name + ' subrace.', 'subrace', true);
      else if (build.subrace && !sub) err('subrace-unknown', 'Unknown subrace "' + build.subrace + '".', 'subrace');
      const sc = build.speciesChoices || {};
      if (sp.abilityChoice) {
        const picked = Array.from(new Set(sc.abilities || []));
        if (picked.length < sp.abilityChoice.count) err('species-abilities', 'Choose ' + sp.abilityChoice.count + ' abilities for your ' + sp.name + ' bonus.', 'speciesChoices.abilities', true);
        else if (picked.length > sp.abilityChoice.count || picked.some((a) => !ABILITIES.includes(a) || (sp.abilityChoice.exclude || []).includes(a))) err('species-abilities', 'Those ability bonuses are not allowed.', 'speciesChoices.abilities');
      }
      if (sp.skillChoice) {
        const picked = Array.from(new Set(sc.skills || []));
        if (picked.length < sp.skillChoice.choose) err('species-skills', 'Choose ' + sp.skillChoice.choose + ' skills from ' + sp.name + '.', 'speciesChoices.skills', true);
        else if (picked.length > sp.skillChoice.choose || picked.some((s) => !rules.skills[s])) err('species-skills', 'Too many or unknown species skills.', 'speciesChoices.skills');
      }
      if (sp.ancestry && !(sc.ancestry && sp.ancestry[sc.ancestry])) err('species-ancestry', 'Choose a draconic ancestry.', 'speciesChoices.ancestry', true);
      if (sp.toolChoice && !(sc.tool && sp.toolChoice.includes(sc.tool))) err('species-tool', 'Choose a tool proficiency.', 'speciesChoices.tool', true);
    }

    // Background
    if (!build.background) err('background-missing', 'Choose a background.', 'background', true);
    else if (!rules.backgrounds[build.background]) err('background-unknown', 'Unknown background "' + build.background + '".', 'background');

    // Classes and levels
    const classes = classList(build, rules);
    (build.classes || []).forEach((c, i) => { if (!c || !rules.classes[c.id]) err('class-unknown', 'Unknown class "' + (c && c.id) + '".', 'classes.' + i); });
    if (!classes.length) err('class-missing', 'Choose a class.', 'classes', true);
    const ids = classes.map((c) => c.entry.id);
    if (new Set(ids).size !== ids.length) err('class-duplicate', 'A class appears twice.', 'classes');
    const total = classes.reduce((s, c) => s + c.level, 0);
    classes.forEach((c, i) => { if (c.level < 1) err('class-level', c.def.name + ' needs at least level 1.', 'classes.' + i + '.level'); });
    if (total > 20) err('level-max', 'Total level can be at most 20 (is ' + total + ').', 'classes');

    // Ability scores
    const method = (build.abilities || {}).method;
    const base = (build.abilities || {}).base || {};
    const am = rules.abilityMethods;
    // null/'' must not pass as 0 (Number(null) === 0)
    if (ABILITIES.some((a) => base[a] === null || base[a] === undefined || base[a] === '' || !Number.isInteger(Number(base[a])))) err('abilities-missing', 'Set all six ability scores.', 'abilities.base', true);
    else if (method === 'standardArray') {
      const got = ABILITIES.map((a) => Number(base[a])).sort((x, y) => y - x).join(',');
      if (got !== am.standardArray.slice().sort((x, y) => y - x).join(',')) err('abilities-array', 'Use each standard array value (' + am.standardArray.join(', ') + ') once.', 'abilities.base');
    } else if (method === 'pointBuy') {
      const cost = pointBuyCost(base, rules);
      if (cost === null) err('abilities-pointbuy', 'Point buy scores must be ' + am.pointBuy.min + '–' + am.pointBuy.max + '.', 'abilities.base');
      else if (cost > am.pointBuy.budget) err('abilities-pointbuy', 'Spent ' + cost + ' of ' + am.pointBuy.budget + ' points.', 'abilities.base');
      else if (cost < am.pointBuy.budget) issues.push({ level: 'warning', code: 'abilities-pointbuy-left', message: (am.pointBuy.budget - cost) + ' points unspent.', path: 'abilities.base' });
    } else if (method === 'roll') {
      if (ABILITIES.some((a) => base[a] < am.roll.min || base[a] > am.roll.max)) err('abilities-roll', 'Rolled scores are ' + am.roll.min + '–' + am.roll.max + '.', 'abilities.base');
    } else if (method === 'manual') {
      if (!opts.allowManual) issues.push({ level: 'error', code: 'abilities-manual', message: 'Typing ability scores in is off for this campaign.', path: 'abilities.method' });
      else if (ABILITIES.some((a) => base[a] < am.manual.min || base[a] > am.manual.max)) err('abilities-manual', 'Scores must be ' + am.manual.min + '–' + am.manual.max + '.', 'abilities.base');
    } else {
      err('abilities-method', 'Choose how to set ability scores.', 'abilities.method', true);
    }

    // Multiclassing prerequisites (2014: every class, the old ones too, needs its prerequisite)
    const scores = abilityScores(build, rules).scores;
    if (classes.length > 1) {
      classes.forEach((c) => {
        const req = (c.def.multiclass || {}).requires || {};
        const meets = req.all ? Object.keys(req.all).every((a) => scores[a] >= req.all[a])
          : req.any ? Object.keys(req.any).some((a) => scores[a] >= req.any[a]) : true;
        if (!meets) {
          const need = req.all ? Object.keys(req.all).map((a) => a.toUpperCase() + ' ' + req.all[a]).join(' and ') : Object.keys(req.any).map((a) => a.toUpperCase() + ' ' + req.any[a]).join(' or ');
          err('multiclass-requires', 'Multiclassing ' + c.def.name + ' needs ' + need + '.', 'classes');
        }
      });
    }

    // Skills
    const fixed = new Set([].concat((sp && sp.skills) || [], (sub && sub.skills) || [], (build.background && rules.backgrounds[build.background] ? rules.backgrounds[build.background].skills : []) || [], (build.speciesChoices || {}).skills || []));
    const taken = new Set(fixed);
    classes.forEach((c, i) => {
      const spec = i === 0 ? c.def.skills : { choose: (c.def.multiclass || {}).skills || 0, from: (c.def.multiclass || {}).skillsFrom === 'class' ? c.def.skills.from : 'any' };
      if (!spec || !spec.choose) return;
      const picked = (choices.skills || {})[c.entry.id] || [];
      const from = spec.from === 'any' ? Object.keys(rules.skills) : spec.from;
      if (picked.length < spec.choose) err('skills-missing', 'Choose ' + spec.choose + ' ' + c.def.name + ' skill' + (spec.choose > 1 ? 's' : '') + '.', 'choices.skills.' + c.entry.id, true);
      if (picked.length > spec.choose) err('skills-count', c.def.name + ' gives ' + spec.choose + ' skills, not ' + picked.length + '.', 'choices.skills.' + c.entry.id);
      picked.forEach((s) => {
        if (!from.includes(s)) err('skills-not-allowed', (rules.skills[s] ? rules.skills[s].name : s) + ' is not a ' + c.def.name + ' skill.', 'choices.skills.' + c.entry.id);
        else if (taken.has(s)) err('skills-duplicate', 'Already proficient in ' + rules.skills[s].name + '; pick another.', 'choices.skills.' + c.entry.id);
        taken.add(s);
      });
      if (c.sub && c.sub.bonusSkills) {
        Object.keys(c.sub.bonusSkills).forEach((lvl) => {
          if (Number(lvl) > c.level) return;
          const need = c.sub.bonusSkills[lvl];
          const got = (choices.subclassSkills || {})[c.entry.id] || [];
          if (got.length < need) err('subclass-skills', 'Choose ' + need + ' bonus skills from ' + c.sub.name + '.', 'choices.subclassSkills.' + c.entry.id, true);
          got.forEach((s) => { if (taken.has(s)) err('skills-duplicate', 'Already proficient in ' + (rules.skills[s] || { name: s }).name + '.', 'choices.subclassSkills.' + c.entry.id); taken.add(s); });
        });
      }
    });

    // Expertise
    let expertiseDue = 0;
    classes.forEach((c) => Object.keys(c.def.expertise || {}).forEach((lvl) => { if (Number(lvl) <= c.level) expertiseDue += c.def.expertise[lvl]; }));
    const exp = choices.expertise || [];
    if (exp.length < expertiseDue) err('expertise-missing', 'Choose ' + (expertiseDue - exp.length) + ' more expertise skill(s).', 'choices.expertise', true);
    if (exp.length > expertiseDue) err('expertise-count', 'Only ' + expertiseDue + ' expertise skill(s) allowed.', 'choices.expertise');
    exp.forEach((s) => { if (!taken.has(s)) err('expertise-not-proficient', 'Expertise needs proficiency in ' + (rules.skills[s] || { name: s }).name + '.', 'choices.expertise'); });

    // Subclasses
    classes.forEach((c, i) => {
      if (c.level >= (c.def.subclassLevel || 99) && !c.entry.subclass) err('subclass-missing', 'Choose a ' + (c.def.subclassTitle || 'subclass') + ' for ' + c.def.name + '.', 'classes.' + i + '.subclass', true);
      else if (c.entry.subclass && !c.sub) err('subclass-unknown', 'Unknown subclass "' + c.entry.subclass + '".', 'classes.' + i + '.subclass');
      else if (c.entry.subclass && c.level < c.def.subclassLevel) err('subclass-early', c.def.name + ' chooses a subclass at level ' + c.def.subclassLevel + '.', 'classes.' + i + '.subclass');
      // Hit dice results
      (c.entry.hp || []).forEach((v, k) => {
        if (v !== null && v !== undefined && !(Number.isInteger(v) && v >= 1 && v <= c.def.hitDie)) err('hp-roll', c.def.name + ' level ' + (k + 1) + ' hit die must be 1–' + c.def.hitDie + '.', 'classes.' + i + '.hp');
      });
    });

    // ASIs and feats
    const asi = choices.asi || {};
    const seenFeats = new Set();
    const running = abilityScores(Object.assign({}, build, { choices: Object.assign({}, choices, { asi: {} }) }), rules).scores;
    asiSlots(build, rules).forEach((slot) => {
      const pick = asi[slot.key];
      const label = rules.classes[slot.classId].name + ' level ' + slot.level;
      const unfinished = !pick || (pick.type === 'feat' && !pick.feat) || (pick.type !== 'feat' && !Object.keys(pick.abilities || {}).length);
      if (unfinished) { err('asi-missing', 'Choose an Ability Score Improvement or feat (' + label + ').', 'choices.asi.' + slot.key, true); return; }
      if (pick.type === 'feat') {
        const f = rules.feats[pick.feat];
        if (!f) err('feat-unknown', 'Unknown feat "' + pick.feat + '".', 'choices.asi.' + slot.key);
        else {
          if (seenFeats.has(pick.feat) && !f.repeatable) err('feat-duplicate', f.name + ' can be taken once.', 'choices.asi.' + slot.key);
          Object.keys(f.requires || {}).forEach((a) => { if (running[a] < f.requires[a]) err('feat-requires', f.name + ' needs ' + a.toUpperCase() + ' ' + f.requires[a] + '.', 'choices.asi.' + slot.key); });
          seenFeats.add(pick.feat);
        }
      } else {
        const inc = pick.abilities || {};
        const vals = Object.keys(inc).map((a) => Number(inc[a]));
        const shapeOk = (vals.length === 1 && vals[0] === 2) || (vals.length === 2 && vals[0] === 1 && vals[1] === 1);
        if (!shapeOk || Object.keys(inc).some((a) => !ABILITIES.includes(a))) err('asi-shape', 'An Ability Score Improvement is +2 to one ability or +1 to two (' + label + ').', 'choices.asi.' + slot.key);
        Object.keys(inc).forEach((a) => {
          if (running[a] === undefined) return;
          if (running[a] + Number(inc[a]) > rules.maxAbility) err('asi-cap', a.toUpperCase() + ' can not go above ' + rules.maxAbility + ' (' + label + ').', 'choices.asi.' + slot.key);
          running[a] = Math.min(rules.maxAbility, running[a] + Number(inc[a]));
        });
      }
    });

    // Fighting styles
    const styles = choices.fightingStyles || {};
    const chosenStyles = [];
    fightingStyleSlots(build, rules).forEach((slot) => {
      const st = styles[slot.key];
      if (!st) err('style-missing', 'Choose a fighting style.', 'choices.fightingStyles.' + slot.key, true);
      else if (!slot.options.includes(st)) err('style-not-allowed', 'That fighting style is not available here.', 'choices.fightingStyles.' + slot.key);
      else if (chosenStyles.includes(st)) err('style-duplicate', 'You already have that fighting style.', 'choices.fightingStyles.' + slot.key);
      if (st) chosenStyles.push(st);
    });

    return {
      ok: !issues.some((i) => i.level === 'error'),
      complete: !issues.some((i) => i.pending),
      issues: issues
    };
  }

  // The choices still to make, for the builder to ask about.
  function pendingChoices(build, rules, opts) {
    return validate(build, rules, opts).issues.filter((i) => i.pending);
  }

  /* ---------- Level up ---------- */
  // Returns a new build one level higher in classId (adding the class when it's new).
  // hp: the hit die result for the new level, or null for the average.
  function levelUp(build, rules, classId, hp) {
    if (!rules.classes[classId]) throw new Error('Unknown class "' + classId + '"');
    if (totalLevel(build, rules) >= 20) throw new Error('Already level 20');
    const next = clone(build);
    let entry = next.classes.find((c) => c.id === classId);
    if (!entry) {
      entry = { id: classId, level: 0, subclass: null, hp: [] };
      next.classes.push(entry);
    }
    entry.hp = entry.hp || [];
    while (entry.hp.length < entry.level) entry.hp.push(null);
    entry.level += 1;
    entry.hp.push(hp === undefined ? null : hp);
    return next;
  }

  /* ---------- Homebrew ---------- */
  // Adds a campaign's own content to the rules. homebrew = { classes, species, backgrounds, feats, fightingStyles,
  // subclasses: { <classId>: { <subclassId>: def } }, subraces: { <speciesId>: { <subraceId>: def } } }.
  // Entries with the same id replace the SRD's; everything added is marked homebrew: true.
  function mergeRules(base, homebrew) {
    const out = clone(base);
    if (!homebrew) return out;
    const mark = (def) => Object.assign({}, def, { homebrew: true });
    ['classes', 'species', 'backgrounds', 'feats', 'fightingStyles'].forEach((group) => {
      Object.keys(homebrew[group] || {}).forEach((id) => {
        out[group] = out[group] || {};
        out[group][id] = mark(homebrew[group][id]);
      });
    });
    Object.keys(homebrew.subclasses || {}).forEach((classId) => {
      if (!out.classes[classId]) return;
      out.classes[classId].subclasses = out.classes[classId].subclasses || {};
      Object.keys(homebrew.subclasses[classId]).forEach((id) => { out.classes[classId].subclasses[id] = mark(homebrew.subclasses[classId][id]); });
    });
    Object.keys(homebrew.subraces || {}).forEach((speciesId) => {
      if (!out.species[speciesId]) return;
      out.species[speciesId].subraces = out.species[speciesId].subraces || {};
      Object.keys(homebrew.subraces[speciesId]).forEach((id) => { out.species[speciesId].subraces[id] = mark(homebrew.subraces[speciesId][id]); });
    });
    return out;
  }

  const api = {
    ABILITIES: ABILITIES,
    mod: mod,
    proficiencyBonus: proficiencyBonus,
    averageHitDie: averageHitDie,
    newBuild: newBuild,
    pointBuyCost: pointBuyCost,
    rollAbilityScores: rollAbilityScores,
    abilityScores: abilityScores,
    derive: derive,
    validate: validate,
    pendingChoices: pendingChoices,
    levelUp: levelUp,
    mergeRules: mergeRules,
    totalLevel: totalLevel,
    asiSlots: asiSlots
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CharacterEngine = api;
})(typeof window !== 'undefined' ? window : this);
