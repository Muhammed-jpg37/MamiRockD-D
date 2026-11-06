/* ========================================================
   D&D 5e (2014) RULES DATA — SRD 5.1 content only
   Used by character-engine.js. Content beyond the SRD (other
   subclasses, species, backgrounds, feats) is added per campaign
   through the DM's homebrew, merged in with mergeRules().

   This work includes material taken from the System Reference
   Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and
   available at https://dnd.wizards.com/resources/systems-reference-document.
   The SRD 5.1 is licensed under the Creative Commons Attribution
   4.0 International License available at
   https://creativecommons.org/licenses/by/4.0/legalcode.
   ======================================================== */
(function (root) {
  'use strict';

  const ASI = [4, 8, 12, 16, 19];

  // A per-level table (index 0 = class level 1) from the levels where the value changes:
  // steps({ 1: 2, 4: 3, 10: 4 }) → 2 at levels 1–3, 3 at 4–9, 4 at 10–20.
  function steps(changes) {
    const out = [];
    let v = 0;
    for (let lvl = 1; lvl <= 20; lvl++) {
      if (changes[lvl] !== undefined) v = changes[lvl];
      out.push(v);
    }
    return out;
  }

  /* Spells per class (SRD 5.1 class tables). On a class's `spellcasting`:
     cantrips[lvl-1]      cantrips known at that class level
     known[lvl-1]         spells known (bard, ranger, sorcerer, warlock); the bard's
                          table already includes the spells learned through Magical Secrets
     prepared             prepared casters: ability modifier + class level / levelDivisor
                          (rounded down), at least 1, chosen from the whole class list
                          (the wizard's from the spellbook) after each long rest
     replaceOnLevelUp     known casters may swap one known spell for another class spell
                          of a level they can cast when they gain a level in the class
     ritual               'known' | 'prepared' | 'spellbook': which spells can be cast
                          as rituals (the spell must have the ritual tag)
     spellbook            wizard: { start, perLevel } 1st-level wizard spells in the book
                          at level 1, then spells added at each wizard level, of a level
                          the wizard has slots for
     mysticArcanum        warlock: { classLevel: spellLevel }, one spell each, once per
                          long rest, not counted in spells known
     magicalSecrets       bard: { classLevel: count } spells from any class's list; they
                          count as bard spells and are part of `known` */

  const SRD5 = {
    id: 'srd5.1',
    ruleset: '5e-2014',
    abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    abilityNames: { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' },
    maxAbility: 20,

    // Keys match the character sheet (index.html DND_ALL_SKILLS).
    skills: {
      acrobatics: { name: 'Acrobatics', ability: 'dex' },
      animalHandling: { name: 'Animal Handling', ability: 'wis' },
      arcana: { name: 'Arcana', ability: 'int' },
      athletics: { name: 'Athletics', ability: 'str' },
      deception: { name: 'Deception', ability: 'cha' },
      history: { name: 'History', ability: 'int' },
      insight: { name: 'Insight', ability: 'wis' },
      intimidation: { name: 'Intimidation', ability: 'cha' },
      investigation: { name: 'Investigation', ability: 'int' },
      medicine: { name: 'Medicine', ability: 'wis' },
      nature: { name: 'Nature', ability: 'int' },
      perception: { name: 'Perception', ability: 'wis' },
      performance: { name: 'Performance', ability: 'cha' },
      persuasion: { name: 'Persuasion', ability: 'cha' },
      religion: { name: 'Religion', ability: 'int' },
      sleightOfHand: { name: 'Sleight of Hand', ability: 'dex' },
      stealth: { name: 'Stealth', ability: 'dex' },
      survival: { name: 'Survival', ability: 'wis' }
    },

    abilityMethods: {
      standardArray: [15, 14, 13, 12, 10, 8],
      pointBuy: { budget: 27, min: 8, max: 15, cost: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } },
      roll: { min: 3, max: 18 },     // 4d6, drop the lowest
      manual: { min: 1, max: 20 }    // only when the campaign allows it
    },

    // Spell slots per spell level (index 0 = 1st level) by caster level.
    spellSlots: {
      1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2],
      9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1],
      13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1], 15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1],
      17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1], 19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
    },
    // Warlock Pact Magic: [number of slots, slot level] by warlock level.
    pactSlots: {
      1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2], 5: [2, 3], 6: [2, 3], 7: [2, 4], 8: [2, 4], 9: [2, 5], 10: [2, 5],
      11: [3, 5], 12: [3, 5], 13: [3, 5], 14: [3, 5], 15: [3, 5], 16: [3, 5], 17: [4, 5], 18: [4, 5], 19: [4, 5], 20: [4, 5]
    },

    fightingStyles: {
      archery: { name: 'Archery' },
      defense: { name: 'Defense' },
      dueling: { name: 'Dueling' },
      greatWeapon: { name: 'Great Weapon Fighting' },
      protection: { name: 'Protection' },
      twoWeapon: { name: 'Two-Weapon Fighting' }
    },

    classes: {
      barbarian: {
        name: 'Barbarian', hitDie: 12, saves: ['str', 'con'],
        armor: 'Light Armor, Medium Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', tools: '',
        skills: { choose: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
        spellcasting: null, asiLevels: ASI,
        unarmoredDefense: ['dex', 'con'],
        subclassLevel: 3, subclassTitle: 'Primal Path',
        multiclass: { requires: { all: { str: 13 } }, armor: 'Shields', weapons: 'Simple Weapons, Martial Weapons', skills: 0 },
        startingWealth: { dice: 2, mult: 10 },
        equipment: [['a greataxe', 'any martial melee weapon'], ['two handaxes', 'any simple weapon'], ["an explorer's pack and four javelins"]],
        features: {
          1: ['Rage', 'Unarmored Defense'], 2: ['Reckless Attack', 'Danger Sense'], 3: ['Primal Path'], 5: ['Extra Attack', 'Fast Movement'],
          7: ['Feral Instinct'], 9: ['Brutal Critical (1 die)'], 11: ['Relentless Rage'], 13: ['Brutal Critical (2 dice)'],
          15: ['Persistent Rage'], 17: ['Brutal Critical (3 dice)'], 18: ['Indomitable Might'], 20: ['Primal Champion']
        },
        subclasses: {
          berserker: { name: 'Path of the Berserker', features: { 3: ['Frenzy'], 6: ['Mindless Rage'], 10: ['Intimidating Presence'], 14: ['Retaliation'] } }
        }
      },
      bard: {
        name: 'Bard', hitDie: 8, saves: ['dex', 'cha'],
        armor: 'Light Armor', weapons: 'Simple Weapons, Hand Crossbows, Longswords, Rapiers, Shortswords', tools: 'Three musical instruments',
        skills: { choose: 3, from: 'any' },
        spellcasting: {
          ability: 'cha', progression: 'full',
          cantrips: steps({ 1: 2, 4: 3, 10: 4 }),
          known: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
          replaceOnLevelUp: true, ritual: 'known',
          magicalSecrets: { 10: 2, 14: 2, 18: 2 }
        },
        asiLevels: ASI,
        expertise: { 3: 2, 10: 2 },
        subclassLevel: 3, subclassTitle: 'Bard College',
        multiclass: { requires: { all: { cha: 13 } }, armor: 'Light Armor', weapons: '', tools: 'One musical instrument', skills: 1, skillsFrom: 'any' },
        startingWealth: { dice: 5, mult: 10 },
        equipment: [['a rapier', 'a longsword', 'any simple weapon'], ["a diplomat's pack", "an entertainer's pack"], ['a lute', 'any other musical instrument'], ['leather armor and a dagger']],
        features: {
          1: ['Spellcasting', 'Bardic Inspiration (d6)'], 2: ['Jack of All Trades', 'Song of Rest (d6)'], 3: ['Bard College', 'Expertise'],
          5: ['Bardic Inspiration (d8)', 'Font of Inspiration'], 6: ['Countercharm'], 9: ['Song of Rest (d8)'],
          10: ['Bardic Inspiration (d10)', 'Expertise', 'Magical Secrets'], 13: ['Song of Rest (d10)'], 14: ['Magical Secrets'],
          15: ['Bardic Inspiration (d12)'], 17: ['Song of Rest (d12)'], 18: ['Magical Secrets'], 20: ['Superior Inspiration']
        },
        subclasses: {
          // Additional Magical Secrets: 2 spells from any class at bard level 6, NOT counted in spells known.
          lore: { name: 'College of Lore', bonusSkills: { 3: 3 }, additionalMagicalSecrets: { 6: 2 }, features: { 3: ['Bonus Proficiencies', 'Cutting Words'], 6: ['Additional Magical Secrets'], 14: ['Peerless Skill'] } }
        }
      },
      cleric: {
        name: 'Cleric', hitDie: 8, saves: ['wis', 'cha'],
        armor: 'Light Armor, Medium Armor, Shields', weapons: 'Simple Weapons', tools: '',
        skills: { choose: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
        spellcasting: {
          ability: 'wis', progression: 'full',
          cantrips: steps({ 1: 3, 4: 4, 10: 5 }),
          prepared: { levelDivisor: 1 }, ritual: 'prepared'
        },
        asiLevels: ASI,
        subclassLevel: 1, subclassTitle: 'Divine Domain',
        multiclass: { requires: { all: { wis: 13 } }, armor: 'Light Armor, Medium Armor, Shields', weapons: '', skills: 0 },
        startingWealth: { dice: 5, mult: 10 },
        equipment: [['a mace', 'a warhammer (if proficient)'], ['scale mail', 'leather armor', 'chain mail (if proficient)'], ['a light crossbow and 20 bolts', 'any simple weapon'], ["a priest's pack", "an explorer's pack"], ['a shield and a holy symbol']],
        features: {
          1: ['Spellcasting', 'Divine Domain'], 2: ['Channel Divinity (1/rest)'], 5: ['Destroy Undead (CR 1/2)'], 6: ['Channel Divinity (2/rest)'],
          8: ['Destroy Undead (CR 1)'], 10: ['Divine Intervention'], 11: ['Destroy Undead (CR 2)'], 14: ['Destroy Undead (CR 3)'],
          17: ['Destroy Undead (CR 4)'], 18: ['Channel Divinity (3/rest)'], 20: ['Divine Intervention Improvement']
        },
        subclasses: {
          life: { name: 'Life Domain', armor: 'Heavy Armor', features: { 1: ['Bonus Proficiency', 'Disciple of Life'], 2: ['Channel Divinity: Preserve Life'], 6: ['Blessed Healer'], 8: ['Divine Strike'], 17: ['Supreme Healing'] } }
        }
      },
      druid: {
        name: 'Druid', hitDie: 8, saves: ['int', 'wis'],
        armor: 'Light Armor, Medium Armor, Shields (nonmetal)', weapons: 'Clubs, Daggers, Darts, Javelins, Maces, Quarterstaffs, Scimitars, Sickles, Slings, Spears', tools: 'Herbalism Kit',
        skills: { choose: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
        spellcasting: {
          ability: 'wis', progression: 'full',
          cantrips: steps({ 1: 2, 4: 3, 10: 4 }),
          prepared: { levelDivisor: 1 }, ritual: 'prepared'
        },
        asiLevels: ASI,
        subclassLevel: 2, subclassTitle: 'Druid Circle',
        multiclass: { requires: { all: { wis: 13 } }, armor: 'Light Armor, Medium Armor, Shields (nonmetal)', weapons: '', skills: 0 },
        startingWealth: { dice: 2, mult: 10 },
        equipment: [['a wooden shield', 'any simple weapon'], ['a scimitar', 'any simple melee weapon'], ["leather armor, an explorer's pack, and a druidic focus"]],
        features: {
          1: ['Druidic', 'Spellcasting'], 2: ['Wild Shape', 'Druid Circle'], 4: ['Wild Shape Improvement'], 8: ['Wild Shape Improvement'],
          18: ['Timeless Body', 'Beast Spells'], 20: ['Archdruid']
        },
        subclasses: {
          land: { name: 'Circle of the Land', features: { 2: ['Bonus Cantrip', 'Natural Recovery'], 3: ['Circle Spells'], 6: ["Land's Stride"], 10: ["Nature's Ward"], 14: ["Nature's Sanctuary"] } }
        }
      },
      fighter: {
        name: 'Fighter', hitDie: 10, saves: ['str', 'con'],
        armor: 'All Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', tools: '',
        skills: { choose: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
        spellcasting: null, asiLevels: [4, 6, 8, 12, 14, 16, 19],
        fightingStyle: { 1: ['archery', 'defense', 'dueling', 'greatWeapon', 'protection', 'twoWeapon'] },
        subclassLevel: 3, subclassTitle: 'Martial Archetype',
        multiclass: { requires: { any: { str: 13, dex: 13 } }, armor: 'Light Armor, Medium Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', skills: 0 },
        startingWealth: { dice: 5, mult: 10 },
        equipment: [['chain mail', 'leather armor, longbow, and 20 arrows'], ['a martial weapon and a shield', 'two martial weapons'], ['a light crossbow and 20 bolts', 'two handaxes'], ["a dungeoneer's pack", "an explorer's pack"]],
        features: {
          1: ['Fighting Style', 'Second Wind'], 2: ['Action Surge (one use)'], 3: ['Martial Archetype'], 5: ['Extra Attack'],
          9: ['Indomitable (one use)'], 11: ['Extra Attack (2)'], 13: ['Indomitable (two uses)'],
          17: ['Action Surge (two uses)', 'Indomitable (three uses)'], 20: ['Extra Attack (3)']
        },
        subclasses: {
          champion: { name: 'Champion', features: { 3: ['Improved Critical'], 7: ['Remarkable Athlete'], 10: ['Additional Fighting Style'], 15: ['Superior Critical'], 18: ['Survivor'] }, fightingStyle: { 10: 'class' } }
        }
      },
      monk: {
        name: 'Monk', hitDie: 8, saves: ['str', 'dex'],
        armor: '', weapons: 'Simple Weapons, Shortswords', tools: "One type of artisan's tools or one musical instrument",
        skills: { choose: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
        spellcasting: null, asiLevels: ASI,
        unarmoredDefense: ['dex', 'wis'],
        subclassLevel: 3, subclassTitle: 'Monastic Tradition',
        multiclass: { requires: { all: { dex: 13, wis: 13 } }, armor: '', weapons: 'Simple Weapons, Shortswords', skills: 0 },
        startingWealth: { dice: 5, mult: 1 },
        equipment: [['a shortsword', 'any simple weapon'], ["a dungeoneer's pack", "an explorer's pack"], ['10 darts']],
        features: {
          1: ['Unarmored Defense', 'Martial Arts'], 2: ['Ki', 'Unarmored Movement'], 3: ['Monastic Tradition', 'Deflect Missiles'], 4: ['Slow Fall'],
          5: ['Extra Attack', 'Stunning Strike'], 6: ['Ki-Empowered Strikes'], 7: ['Evasion', 'Stillness of Mind'], 10: ['Purity of Body'],
          13: ['Tongue of the Sun and Moon'], 14: ['Diamond Soul'], 15: ['Timeless Body'], 18: ['Empty Body'], 20: ['Perfect Self']
        },
        subclasses: {
          openHand: { name: 'Way of the Open Hand', features: { 3: ['Open Hand Technique'], 6: ['Wholeness of Body'], 11: ['Tranquility'], 17: ['Quivering Palm'] } }
        }
      },
      paladin: {
        name: 'Paladin', hitDie: 10, saves: ['wis', 'cha'],
        armor: 'All Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', tools: '',
        skills: { choose: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
        spellcasting: {
          ability: 'cha', progression: 'half',
          cantrips: steps({ 1: 0 }),
          prepared: { levelDivisor: 2 }   // from paladin level 2, when Spellcasting starts
        },
        asiLevels: ASI,
        fightingStyle: { 2: ['defense', 'dueling', 'greatWeapon', 'protection'] },
        subclassLevel: 3, subclassTitle: 'Sacred Oath',
        multiclass: { requires: { all: { str: 13, cha: 13 } }, armor: 'Light Armor, Medium Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', skills: 0 },
        startingWealth: { dice: 5, mult: 10 },
        equipment: [['a martial weapon and a shield', 'two martial weapons'], ['five javelins', 'any simple melee weapon'], ["a priest's pack", "an explorer's pack"], ['chain mail and a holy symbol']],
        features: {
          1: ['Divine Sense', 'Lay on Hands'], 2: ['Fighting Style', 'Spellcasting', 'Divine Smite'], 3: ['Divine Health', 'Sacred Oath'],
          5: ['Extra Attack'], 6: ['Aura of Protection'], 10: ['Aura of Courage'], 11: ['Improved Divine Smite'], 14: ['Cleansing Touch'], 18: ['Aura Improvements']
        },
        subclasses: {
          devotion: { name: 'Oath of Devotion', features: { 3: ['Oath Spells', 'Channel Divinity'], 7: ['Aura of Devotion'], 15: ['Purity of Spirit'], 20: ['Holy Nimbus'] } }
        }
      },
      ranger: {
        name: 'Ranger', hitDie: 10, saves: ['str', 'dex'],
        armor: 'Light Armor, Medium Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', tools: '',
        skills: { choose: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
        spellcasting: {
          ability: 'wis', progression: 'half',
          cantrips: steps({ 1: 0 }),
          known: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
          replaceOnLevelUp: true
        },
        asiLevels: ASI,
        fightingStyle: { 2: ['archery', 'defense', 'dueling', 'twoWeapon'] },
        subclassLevel: 3, subclassTitle: 'Ranger Archetype',
        multiclass: { requires: { all: { dex: 13, wis: 13 } }, armor: 'Light Armor, Medium Armor, Shields', weapons: 'Simple Weapons, Martial Weapons', skills: 1, skillsFrom: 'class' },
        startingWealth: { dice: 5, mult: 10 },
        equipment: [['scale mail', 'leather armor'], ['two shortswords', 'two simple melee weapons'], ["a dungeoneer's pack", "an explorer's pack"], ['a longbow and a quiver of 20 arrows']],
        features: {
          1: ['Favored Enemy', 'Natural Explorer'], 2: ['Fighting Style', 'Spellcasting'], 3: ['Ranger Archetype', 'Primeval Awareness'],
          5: ['Extra Attack'], 6: ['Favored Enemy and Natural Explorer improvements'], 8: ["Land's Stride"],
          10: ['Natural Explorer improvement', 'Hide in Plain Sight'], 14: ['Favored Enemy improvement', 'Vanish'], 18: ['Feral Senses'], 20: ['Foe Slayer']
        },
        subclasses: {
          hunter: { name: 'Hunter', features: { 3: ["Hunter's Prey"], 7: ['Defensive Tactics'], 11: ['Multiattack'], 15: ["Superior Hunter's Defense"] } }
        }
      },
      rogue: {
        name: 'Rogue', hitDie: 8, saves: ['dex', 'int'],
        armor: 'Light Armor', weapons: 'Simple Weapons, Hand Crossbows, Longswords, Rapiers, Shortswords', tools: "Thieves' Tools",
        skills: { choose: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
        spellcasting: null, asiLevels: [4, 8, 10, 12, 16, 19],
        expertise: { 1: 2, 6: 2 },
        subclassLevel: 3, subclassTitle: 'Roguish Archetype',
        multiclass: { requires: { all: { dex: 13 } }, armor: 'Light Armor', weapons: '', tools: "Thieves' Tools", skills: 1, skillsFrom: 'class' },
        startingWealth: { dice: 4, mult: 10 },
        equipment: [['a rapier', 'a shortsword'], ['a shortbow and quiver of 20 arrows', 'a shortsword'], ["a burglar's pack", "a dungeoneer's pack", "an explorer's pack"], ["leather armor, two daggers, and thieves' tools"]],
        features: {
          1: ['Expertise', 'Sneak Attack', "Thieves' Cant"], 2: ['Cunning Action'], 3: ['Roguish Archetype'], 5: ['Uncanny Dodge'],
          6: ['Expertise'], 7: ['Evasion'], 11: ['Reliable Talent'], 14: ['Blindsense'], 15: ['Slippery Mind'], 18: ['Elusive'], 20: ['Stroke of Luck']
        },
        subclasses: {
          thief: { name: 'Thief', features: { 3: ['Fast Hands', 'Second-Story Work'], 9: ['Supreme Sneak'], 13: ['Use Magic Device'], 17: ["Thief's Reflexes"] } }
        }
      },
      sorcerer: {
        name: 'Sorcerer', hitDie: 6, saves: ['con', 'cha'],
        armor: '', weapons: 'Daggers, Darts, Slings, Quarterstaffs, Light Crossbows', tools: '',
        skills: { choose: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
        spellcasting: {
          ability: 'cha', progression: 'full',
          cantrips: steps({ 1: 4, 4: 5, 10: 6 }),
          known: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
          replaceOnLevelUp: true
        },
        asiLevels: ASI,
        subclassLevel: 1, subclassTitle: 'Sorcerous Origin',
        multiclass: { requires: { all: { cha: 13 } }, armor: '', weapons: '', skills: 0 },
        startingWealth: { dice: 3, mult: 10 },
        equipment: [['a light crossbow and 20 bolts', 'any simple weapon'], ['a component pouch', 'an arcane focus'], ["a dungeoneer's pack", "an explorer's pack"], ['two daggers']],
        features: {
          1: ['Spellcasting', 'Sorcerous Origin'], 2: ['Font of Magic'], 3: ['Metamagic'], 10: ['Metamagic'], 17: ['Metamagic'], 20: ['Sorcerous Restoration']
        },
        subclasses: {
          draconic: {
            name: 'Draconic Bloodline', hpPerLevel: 1, unarmoredBase: 13,
            features: { 1: ['Dragon Ancestor', 'Draconic Resilience'], 6: ['Elemental Affinity'], 14: ['Dragon Wings'], 18: ['Draconic Presence'] }
          }
        }
      },
      warlock: {
        name: 'Warlock', hitDie: 8, saves: ['wis', 'cha'],
        armor: 'Light Armor', weapons: 'Simple Weapons', tools: '',
        skills: { choose: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
        spellcasting: {
          ability: 'cha', progression: 'pact',
          cantrips: steps({ 1: 2, 4: 3, 10: 4 }),
          known: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
          replaceOnLevelUp: true,
          mysticArcanum: { 11: 6, 13: 7, 15: 8, 17: 9 }
        },
        asiLevels: ASI,
        subclassLevel: 1, subclassTitle: 'Otherworldly Patron',
        multiclass: { requires: { all: { cha: 13 } }, armor: 'Light Armor', weapons: 'Simple Weapons', skills: 0 },
        startingWealth: { dice: 4, mult: 10 },
        equipment: [['a light crossbow and 20 bolts', 'any simple weapon'], ['a component pouch', 'an arcane focus'], ["a scholar's pack", "a dungeoneer's pack"], ['leather armor, any simple weapon, and two daggers']],
        features: {
          1: ['Otherworldly Patron', 'Pact Magic'], 2: ['Eldritch Invocations'], 3: ['Pact Boon'], 11: ['Mystic Arcanum (6th level)'],
          13: ['Mystic Arcanum (7th level)'], 15: ['Mystic Arcanum (8th level)'], 17: ['Mystic Arcanum (9th level)'], 20: ['Eldritch Master']
        },
        subclasses: {
          fiend: { name: 'The Fiend', features: { 1: ["Dark One's Blessing"], 6: ["Dark One's Own Luck"], 10: ['Fiendish Resilience'], 14: ['Hurl Through Hell'] } }
        }
      },
      wizard: {
        name: 'Wizard', hitDie: 6, saves: ['int', 'wis'],
        armor: '', weapons: 'Daggers, Darts, Slings, Quarterstaffs, Light Crossbows', tools: '',
        skills: { choose: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
        spellcasting: {
          ability: 'int', progression: 'full',
          cantrips: steps({ 1: 3, 4: 4, 10: 5 }),
          prepared: { levelDivisor: 1, from: 'spellbook' }, ritual: 'spellbook',
          spellbook: { start: 6, perLevel: 2 }
        },
        asiLevels: ASI,
        subclassLevel: 2, subclassTitle: 'Arcane Tradition',
        multiclass: { requires: { all: { int: 13 } }, armor: '', weapons: '', skills: 0 },
        startingWealth: { dice: 4, mult: 10 },
        equipment: [['a quarterstaff', 'a dagger'], ['a component pouch', 'an arcane focus'], ["a scholar's pack", "an explorer's pack"], ['a spellbook']],
        features: { 1: ['Spellcasting', 'Arcane Recovery'], 2: ['Arcane Tradition'], 18: ['Spell Mastery'], 20: ['Signature Spells'] },
        subclasses: {
          evocation: { name: 'School of Evocation', features: { 2: ['Evocation Savant', 'Sculpt Spells'], 6: ['Potent Cantrip'], 10: ['Empowered Evocation'], 14: ['Overchannel'] } }
        }
      }
    },

    species: {
      dwarf: {
        name: 'Dwarf', size: 'Medium', speed: 25, abilityBonuses: { con: 2 }, senses: 'Darkvision 60 ft',
        languages: ['Common', 'Dwarvish'], weapons: 'Battleaxe, Handaxe, Light Hammer, Warhammer',
        toolChoice: ["Smith's tools", "Brewer's supplies", "Mason's tools"],
        traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Combat Training', 'Tool Proficiency', 'Stonecunning'],
        subraces: { hill: { name: 'Hill Dwarf', abilityBonuses: { wis: 1 }, hpPerLevel: 1, traits: ['Dwarven Toughness'] } }
      },
      elf: {
        name: 'Elf', size: 'Medium', speed: 30, abilityBonuses: { dex: 2 }, senses: 'Darkvision 60 ft',
        languages: ['Common', 'Elvish'], skills: ['perception'],
        traits: ['Darkvision', 'Keen Senses', 'Fey Ancestry', 'Trance'],
        subraces: {
          high: { name: 'High Elf', abilityBonuses: { int: 1 }, weapons: 'Longsword, Shortsword, Shortbow, Longbow', extraLanguages: 1, cantrip: 'wizard', traits: ['Elf Weapon Training', 'Cantrip', 'Extra Language'] }
        }
      },
      halfling: {
        name: 'Halfling', size: 'Small', speed: 25, abilityBonuses: { dex: 2 },
        languages: ['Common', 'Halfling'], traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
        subraces: { lightfoot: { name: 'Lightfoot Halfling', abilityBonuses: { cha: 1 }, traits: ['Naturally Stealthy'] } }
      },
      human: {
        name: 'Human', size: 'Medium', speed: 30, abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
        languages: ['Common'], extraLanguages: 1, traits: []
      },
      dragonborn: {
        name: 'Dragonborn', size: 'Medium', speed: 30, abilityBonuses: { str: 2, cha: 1 },
        languages: ['Common', 'Draconic'], traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
        ancestry: {
          black: { name: 'Black', damage: 'Acid', breath: '5 by 30 ft. line (Dex save)' },
          blue: { name: 'Blue', damage: 'Lightning', breath: '5 by 30 ft. line (Dex save)' },
          brass: { name: 'Brass', damage: 'Fire', breath: '5 by 30 ft. line (Dex save)' },
          bronze: { name: 'Bronze', damage: 'Lightning', breath: '5 by 30 ft. line (Dex save)' },
          copper: { name: 'Copper', damage: 'Acid', breath: '5 by 30 ft. line (Dex save)' },
          gold: { name: 'Gold', damage: 'Fire', breath: '15 ft. cone (Dex save)' },
          green: { name: 'Green', damage: 'Poison', breath: '15 ft. cone (Con save)' },
          red: { name: 'Red', damage: 'Fire', breath: '15 ft. cone (Dex save)' },
          silver: { name: 'Silver', damage: 'Cold', breath: '15 ft. cone (Con save)' },
          white: { name: 'White', damage: 'Cold', breath: '15 ft. cone (Con save)' }
        }
      },
      gnome: {
        name: 'Gnome', size: 'Small', speed: 25, abilityBonuses: { int: 2 }, senses: 'Darkvision 60 ft',
        languages: ['Common', 'Gnomish'], traits: ['Darkvision', 'Gnome Cunning'],
        subraces: { rock: { name: 'Rock Gnome', abilityBonuses: { con: 1 }, tools: "Tinker's tools", traits: ["Artificer's Lore", 'Tinker'] } }
      },
      halfElf: {
        name: 'Half-Elf', size: 'Medium', speed: 30, abilityBonuses: { cha: 2 },
        abilityChoice: { count: 2, amount: 1, exclude: ['cha'] },
        senses: 'Darkvision 60 ft', languages: ['Common', 'Elvish'], extraLanguages: 1,
        skillChoice: { choose: 2, from: 'any' },
        traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility']
      },
      halfOrc: {
        name: 'Half-Orc', size: 'Medium', speed: 30, abilityBonuses: { str: 2, con: 1 }, senses: 'Darkvision 60 ft',
        languages: ['Common', 'Orc'], skills: ['intimidation'],
        traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks']
      },
      tiefling: {
        name: 'Tiefling', size: 'Medium', speed: 30, abilityBonuses: { cha: 2, int: 1 }, senses: 'Darkvision 60 ft',
        languages: ['Common', 'Infernal'], resistances: 'Fire',
        traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy']
      }
    },

    backgrounds: {
      acolyte: {
        name: 'Acolyte', skills: ['insight', 'religion'], extraLanguages: 2, tools: '',
        feature: 'Shelter of the Faithful',
        equipment: 'A holy symbol, a prayer book or prayer wheel, 5 sticks of incense, vestments, a set of common clothes, and a belt pouch containing 15 gp'
      }
    },

    feats: {
      grappler: { name: 'Grappler', requires: { str: 13 } }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SRD5;
  else root.RULES_SRD5 = SRD5;
})(typeof window !== 'undefined' ? window : this);
