// src/scripts/seedCharacterClasses.ts

export const seedCharacterClasses = [
  /* ───────────────────────────── Vampire (STR) ───────────────────────────── */
  {
    name: "Vampire",
    description: "A cursed noble who rules the night with graceful lethality.",
    iconName: "Droplet",
    imageMainClassUrl: "/assets/classes/vampire/vampire_class.png",

    primaryWeapons: ["Rapier", "Dagger"],
    secondaryWeapons: ["Shortsword", "Scimitar", "Kris", "Shadowfang Blade"],

    defaultWeapon: "Rapier",
    allowedWeapons: ["Rapier", "Dagger", "Shortsword", "Scimitar", "Kris", "Shadowfang Blade", "Crimson Scimitar", "Bloodfang Sabre", "Shadow Kris", "Nightfang Blade", "Curved Fangblade"],

    // STR-leaning → físico
    passiveDefaultSkill: {
      enabled: true,
      name: "Crimson Impulse",
      damageType: "physical",
      shortDescEn: "+6 physical damage and +2 Evasion for 3 turns.",
      longDescEn: "On basic hits, may grant +6 physical damage and +2 Evasion for 3 turns. " + "Chance = min(7 + Fate×1, 35). No stacking; refresh duration if active.",
      trigger: {
        check: "onBasicHit",
        scaleBy: "fate",
        baseChancePercent: 7,
        fateScalePerPoint: 1,
        maxChancePercent: 35,
      },
      durationTurns: 3,
      bonusDamage: 6,
      extraEffects: { evasionFlat: 2 },
    },

    baseStats: {
      strength: 8,
      dexterity: 7,
      intelligence: 5,
      constitution: 7,
      physicalDefense: 6,
      magicalDefense: 4,
      luck: 6,
      endurance: 7,
      fate: 5,
    },

    resistances: {
      fire: 3,
      ice: 5,
      lightning: 3,
      poison: 4,
      sleep: 6,
      paralysis: 3,
      confusion: 4,
      fear: 7,
      dark: 6,
      holy: 2,
      stun: 4,
      bleed: 8,
      curse: 5,
      knockback: 3,
      criticalChanceReduction: 3,
      criticalDamageReduction: 3,
    },

    combatStats: {
      maxHP: 218,
      attackPower: 24,
      magicPower: 8,
      criticalChance: 12,
      criticalDamageBonus: 35,
      evasion: 7,
      blockChance: 4,
      blockValue: 6,
      lifeSteal: 8,
      damageReduction: 5,
      movementSpeed: 5,
    },

    // Físico: debuff a DEF FÍSICA
    ultimateSkill: {
      enabled: true,
      name: "Crimson Feast",
      description: "A precise strike for +60% physical damage. Weaken (-10 Physical Defense) for 3 turns.",
      usesPerBattle: 1,
      earliestTurn: 3,
      cooldownTurns: 6,
      effects: {
        bonusDamagePercent: 60,
        applies: [
          {
            tag: "weaken",
            stat: "physicalDefense",
            deltaFlat: -10,
            durationTurns: 3,
            resist: "curse",
          },
        ],
      },
      proc: {
        enabled: true,
        procInfoEn: "Turn start (≥3): Chance = min(5 + Fate×1, 15). Single use.",
        trigger: {
          check: "onTurnStart",
          earliestTurn: 3,
          baseChancePercent: 5,
          fateScalePerPoint: 1,
          maxChancePercent: 15,
        },
        respectCooldown: true,
      },
    },

    subclasses: [
      {
        name: "Blood Reaver",
        slug: "blood-reaver",
        iconName: "Sword",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Voracious Bite",
            description: "On Crit, heal 5 HP.",
            trigger: {
              check: "onCrit",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: { healFlat: 5 },
          },
          {
            name: "Crimson Rite",
            description: "If HP < 50%, +5 Attack Power for 2 turns (chance scales with Fate).",
            trigger: {
              check: "onTurnStart",
              condition: "hpBelow50",
              baseChancePercent: 10,
              fateScalePerPoint: 1,
              maxChancePercent: 30,
            },
            effects: { buff: { attackPowerFlat: 5, durationTurns: 2 } },
          },
        ],
      },
      {
        name: "Nosferatu",
        slug: "nosferatu",
        iconName: "Moon",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Night Shroud",
            description: "At battle start, +5 Evasion for 2 turns.",
            trigger: { check: "onBattleStart" },
            effects: { buff: { evasionFlat: 5, durationTurns: 2 } },
          },
          {
            name: "Cold Immortality",
            description: "+5 Fear resistance.",
            trigger: { check: "alwaysOn" },
            effects: { resistFlat: { fear: 5 } },
          },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ──────────────────────────── Necromancer (INT) ────────────────────────── */
  {
    name: "Necromancer",
    description: "A grave-lord who bends arcane decay to shatter the living.",
    iconName: "Skull",
    imageMainClassUrl: "/assets/classes/necromancer/necromancer_class.png",

    primaryWeapons: ["Bone Staff", "Scepter"],
    secondaryWeapons: ["Wand", "Occult Rod", "Grimoire", "Soul Orb"],

    defaultWeapon: "Bone Staff",
    allowedWeapons: ["Bone Staff", "Scepter", "Wand", "Occult Rod", "Grimoire", "Soul Orb", "Corrupted Scepter", "Skull Wand", "Plague Rod", "Soulbone Cane", "Ghoul Scepter", "Occult Crook"],

    // INT-leaning → mágico
    passiveDefaultSkill: {
      enabled: true,
      name: "Umbral Focus",
      damageType: "magical",
      shortDescEn: "+9 magic damage and +3 Magic Power for 3 turns.",
      longDescEn: "On spell cast, may grant +9 magic damage and +3 Magic Power for 3 turns. " + "Chance = min(7 + Fate×1, 35). No stacking; refresh duration.",
      trigger: {
        check: "onSpellCast",
        scaleBy: "fate",
        baseChancePercent: 7,
        fateScalePerPoint: 1,
        maxChancePercent: 35,
      },
      durationTurns: 3,
      bonusDamage: 9,
      extraEffects: { magicPowerFlat: 3 },
    },

    baseStats: {
      strength: 3,
      dexterity: 4,
      intelligence: 12,
      constitution: 6,
      physicalDefense: 3,
      magicalDefense: 8,
      luck: 5,
      endurance: 6,
      fate: 5,
    },

    resistances: {
      fire: 3,
      ice: 6,
      lightning: 4,
      poison: 7,
      sleep: 4,
      paralysis: 3,
      confusion: 5,
      fear: 5,
      dark: 7,
      holy: 2,
      stun: 3,
      bleed: 2,
      curse: 8,
      knockback: 3,
      criticalChanceReduction: 3,
      criticalDamageReduction: 3,
    },

    combatStats: {
      maxHP: 206,
      attackPower: 8,
      magicPower: 32,
      criticalChance: 8,
      criticalDamageBonus: 30,
      evasion: 5,
      blockChance: 2,
      blockValue: 5,
      lifeSteal: 0,
      damageReduction: 4,
      movementSpeed: 4,
    },

    // Mágico: daño mágico + CURSE que reduce Attack Power
    ultimateSkill: {
      enabled: true,
      name: "Soul Curse",
      description: "A single-target blast for +55% magic damage. Applies CURSE (-10 Attack Power) for 3 turns.",
      usesPerBattle: 1,
      earliestTurn: 3,
      cooldownTurns: 6,
      effects: {
        bonusDamagePercent: 55,
        applies: [
          {
            tag: "curse",
            stat: "attackPower",
            deltaFlat: -10,
            durationTurns: 3,
            resist: "curse",
          },
        ],
      },
      proc: {
        enabled: true,
        procInfoEn: "Turn start (≥3): Chance = min(5 + Fate×1, 15). Single use.",
        trigger: {
          check: "onTurnStart",
          earliestTurn: 3,
          baseChancePercent: 5,
          fateScalePerPoint: 1,
          maxChancePercent: 15,
        },
        respectCooldown: true,
      },
    },

    subclasses: [
      {
        name: "Bone Summoner",
        slug: "bone-summoner",
        iconName: "Bone",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Bone Guard",
            description: "At battle start, +5 Damage Reduction for 2 turns.",
            trigger: { check: "onBattleStart" },
            effects: { buff: { damageReductionFlat: 5, durationTurns: 2 } },
          },
          {
            name: "Corpse Burst",
            description: "On Kill, deal 10 magic damage to enemy target.",
            trigger: {
              check: "onKill",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: { bonusMagicDamageFlat: 10 },
          },
        ],
      },
      {
        name: "Soulbinder",
        slug: "soulbinder",
        iconName: "Ghost",
        imageSubclassUrl: "",
        passives: [
          {
            // ⬇️ Antes bajaba attack speed. Ahora: debuff de Evasion (no relacionado a speed).
            name: "Shadow Tethers",
            description: "On Hit, reduce enemy Evasion by -5 for 1 turn (chance scales with Fate).",
            trigger: {
              check: "onHit",
              baseChancePercent: 10,
              fateScalePerPoint: 1,
              maxChancePercent: 30,
            },
            effects: { debuff: { evasionFlat: -5, durationTurns: 1 } },
          },
          {
            name: "Breath Steal",
            description: "On Kill, restore 10 HP.",
            trigger: {
              check: "onKill",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: { healFlat: 10 },
          },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ───────────────────────────── Revenant (DEX) ──────────────────────────── */
  {
    name: "Revenant",
    description: "A spectral marksman who pierces fate with cursed shot.",
    iconName: "Crossbow",
    imageMainClassUrl: "/assets/classes/revenant/revenant_class.png",

    primaryWeapons: ["Cursed Crossbow", "Twin Flintlocks"],
    secondaryWeapons: ["Shortbow", "Arquebus", "Hexed Rifle", "Twin Daggers"],

    defaultWeapon: "Cursed Crossbow",
    allowedWeapons: ["Cursed Crossbow", "Twin Flintlocks", "Shortbow", "Arquebus", "Hexed Rifle", "Twin Daggers", "Ancient Pistol", "Bone Carbine", "Spectral Arquebus", "Ghastly Handcannon"],

    // DEX-leaning → físico/crit
    passiveDefaultSkill: {
      enabled: true,
      name: "Spectral Deadeye",
      damageType: "physical",
      shortDescEn: "+5 physical damage and +2 Critical Chance for 3 turns.",
      longDescEn: "On ranged hits, may grant +5 physical damage and +2 Critical Chance for 3 turns. " + "Chance = min(8 + Fate×1, 36). No stacking; refresh duration.",
      trigger: {
        check: "onRangedHit",
        scaleBy: "fate",
        baseChancePercent: 8,
        fateScalePerPoint: 1,
        maxChancePercent: 36,
      },
      durationTurns: 3,
      bonusDamage: 5,
      extraEffects: { criticalChanceFlat: 2 },
    },

    baseStats: {
      strength: 6,
      dexterity: 11,
      intelligence: 5,
      constitution: 6,
      physicalDefense: 4,
      magicalDefense: 5,
      luck: 6,
      endurance: 6,
      fate: 5,
    },

    resistances: {
      fire: 4,
      ice: 4,
      lightning: 5,
      poison: 4,
      sleep: 6,
      paralysis: 4,
      confusion: 7,
      fear: 6,
      dark: 5,
      holy: 3,
      stun: 5,
      bleed: 4,
      curse: 5,
      knockback: 6,
      criticalChanceReduction: 4,
      criticalDamageReduction: 3,
    },

    combatStats: {
      maxHP: 214,
      attackPower: 24,
      magicPower: 10,
      criticalChance: 14,
      criticalDamageBonus: 40,
      evasion: 9,
      blockChance: 3,
      blockValue: 5,
      lifeSteal: 2,
      damageReduction: 4,
      movementSpeed: 7,
    },

    // Físico: Fear baja Crit del enemigo
    ultimateSkill: {
      enabled: true,
      name: "Wraithshot",
      description: "A cursed projectile for +60% physical damage. Applies FEAR (-10 Critical Chance) for 3 turns.",
      usesPerBattle: 1,
      earliestTurn: 3,
      cooldownTurns: 6,
      effects: {
        bonusDamagePercent: 60,
        applies: [
          {
            tag: "fear",
            stat: "criticalChance",
            deltaFlat: -10,
            durationTurns: 3,
            resist: "fear",
          },
        ],
      },
      proc: {
        enabled: true,
        procInfoEn: "Turn start (≥3): Chance = min(5 + Fate×1, 15). Single use.",
        trigger: {
          check: "onTurnStart",
          earliestTurn: 3,
          baseChancePercent: 5,
          fateScalePerPoint: 1,
          maxChancePercent: 15,
        },
        respectCooldown: true,
      },
    },

    subclasses: [
      {
        name: "Crossbow Phantom",
        slug: "crossbow-phantom",
        iconName: "Crossbow",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Piercing Bolt",
            description: "Your shots ignore 10 Physical Defense for 2 turns (on first hit).",
            trigger: { check: "onFirstHit" },
            effects: { debuff: { physicalDefenseFlat: -10, durationTurns: 2 } },
          },
          {
            name: "Spectral Tension",
            description: "First attack of battle gains +10 Critical Chance.",
            trigger: { check: "onFirstHit" },
            effects: { buff: { criticalChanceFlat: 10, durationTurns: 1 } },
          },
        ],
      },
      {
        name: "Gunslinger Shade",
        slug: "gunslinger-shade",
        iconName: "Gun",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Twin Shot",
            description: "On basic ranged hit, 20% chance to fire an extra shot.",
            trigger: {
              check: "onRangedHit",
              baseChancePercent: 20,
              fateScalePerPoint: 0,
              maxChancePercent: 20,
            },
            effects: { extraHit: 1 },
          },
          {
            name: "Hexed Bullet",
            description: "On Crit, 20% chance to apply FEAR (-5 Critical Chance) for 1 turn.",
            trigger: {
              check: "onCrit",
              baseChancePercent: 20,
              fateScalePerPoint: 0,
              maxChancePercent: 20,
            },
            effects: {
              debuff: { criticalChanceFlat: -5, durationTurns: 1, tag: "fear" },
            },
          },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ───────────────────────────── Werewolf (STR) ──────────────────────────── */
  {
    name: "Werewolf",
    description: "A relentless beast that dominates the hunt with brute ferocity.",
    iconName: "Claw",
    imageMainClassUrl: "/assets/classes/werewolf/werewolf_class.png",

    primaryWeapons: ["Iron Claws", "Dual Daggers"],
    secondaryWeapons: ["Shortsword", "Light Axe", "Feral Fangblade", "Savage Paw"],

    defaultWeapon: "Iron Claws",
    allowedWeapons: ["Iron Claws", "Dual Daggers", "Shortsword", "Light Axe", "Feral Fangblade", "Savage Paw", "Claw Gauntlets", "Beast Fangs", "Dire Talons", "Bloodclaw", "Rendfangs"],

    // STR-leaning → físico (sin speed)
    passiveDefaultSkill: {
      enabled: true,
      name: "Lupine Frenzy",
      damageType: "physical",
      shortDescEn: "+7 physical damage and +2 Critical Chance for 3 turns.",
      longDescEn: "On basic hits, may grant +7 physical damage and +2 Critical Chance for 3 turns. " + "Chance = min(6 + Fate×1, 32). No stacking; refresh duration.",
      trigger: {
        check: "onBasicHit",
        scaleBy: "fate",
        baseChancePercent: 6,
        fateScalePerPoint: 1,
        maxChancePercent: 32,
      },
      durationTurns: 3,
      bonusDamage: 7,
      // ⬇️ reemplaza el antiguo attackSpeedFlat
      extraEffects: { criticalChancePercent: 2 },
    },

    baseStats: {
      strength: 10,
      dexterity: 8,
      intelligence: 3,
      constitution: 9,
      physicalDefense: 7,
      magicalDefense: 3,
      luck: 4,
      endurance: 8,
      fate: 5,
    },

    resistances: {
      fire: 4,
      ice: 4,
      lightning: 3,
      poison: 5,
      sleep: 3,
      paralysis: 6,
      confusion: 6,
      fear: 5,
      dark: 4,
      holy: 2,
      stun: 5,
      bleed: 7,
      curse: 4,
      knockback: 6,
      criticalChanceReduction: 3,
      criticalDamageReduction: 4,
    },

    combatStats: {
      maxHP: 222,
      attackPower: 28,
      magicPower: 4,
      criticalChance: 10,
      criticalDamageBonus: 30,
      evasion: 8,
      blockChance: 3,
      blockValue: 5,
      lifeSteal: 3,
      damageReduction: 6,
      movementSpeed: 7,
    },

    // Físico: Bleed plano
    ultimateSkill: {
      enabled: true,
      name: "Savage Rend",
      description: "A ferocious claw strike for +65% physical damage. Applies BLEED (8 per turn) for 3 turns.",
      usesPerBattle: 1,
      earliestTurn: 3,
      cooldownTurns: 6,
      effects: {
        bonusDamagePercent: 65,
        appliesDot: { tag: "bleed", damagePerTurn: 8, durationTurns: 3 },
      },
      proc: {
        enabled: true,
        procInfoEn: "Turn start (≥3): Chance = min(5 + Fate×1, 15). Single use.",
        trigger: {
          check: "onTurnStart",
          earliestTurn: 3,
          baseChancePercent: 5,
          fateScalePerPoint: 1,
          maxChancePercent: 15,
        },
        respectCooldown: true,
      },
    },

    subclasses: [
      {
        name: "Alpha",
        slug: "alpha",
        iconName: "Wolf",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Alpha Roar",
            description: "On Ultimate cast, +5 Attack Power for 2 turns.",
            trigger: { check: "onUltimateCast" },
            effects: { buff: { attackPowerFlat: 5, durationTurns: 2 } },
          },
          {
            name: "Predator Instinct",
            description: "On Dodge, +5 Attack Power for 1 turn.",
            trigger: {
              check: "onDodge",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: { buff: { attackPowerFlat: 5, durationTurns: 1 } },
          },
        ],
      },
      {
        name: "Berserker",
        slug: "berserker",
        iconName: "Flame",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Savage Wrath",
            description: "If HP < 50%, +10 damage dealt for this turn.",
            trigger: {
              check: "onTurnStart",
              condition: "hpBelow50",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: { bonusPhysicalDamageFlat: 10 },
          },
          {
            name: "Blood Frenzy",
            description: "On Hit, 20% chance to apply 1 Bleed stack (8 per turn, 2 turns).",
            trigger: {
              check: "onHit",
              baseChancePercent: 20,
              fateScalePerPoint: 0,
              maxChancePercent: 20,
            },
            effects: { dot: { tag: "bleed", damagePerTurn: 8, durationTurns: 2 } },
          },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ───────────────────────────── Exorcist (INT) ──────────────────────────── */
  {
    name: "Exorcist",
    description: "A priest-warrior who scorches abominations with sacred iron.",
    iconName: "Sparkles",
    imageMainClassUrl: "/assets/classes/exorcist/exorcist_class.png",

    primaryWeapons: ["Holy Mace", "Flail"],
    secondaryWeapons: ["Warhammer", "Morningstar", "Censer", "Cleric Staff"],

    defaultWeapon: "Holy Mace",
    allowedWeapons: ["Holy Mace", "Flail", "Warhammer", "Morningstar", "Censer", "Cleric Staff", "Consecrated Flail", "Blessed Morningstar", "Iron Censer", "Divine Hammer", "Sanctified Club"],

    // INT-leaning → mágico defensivo
    passiveDefaultSkill: {
      enabled: true,
      name: "Hallowed Smite",
      damageType: "magical",
      shortDescEn: "+6 magic damage and +2 Block Chance for 3 turns.",
      longDescEn: "On hit or when being hit, may grant +6 magic damage and +2 Block Chance for 3 turns. " + "Chance = min(7 + Fate×1, 34). No stacking; refresh duration.",
      trigger: {
        check: "onHitOrBeingHit",
        scaleBy: "fate",
        baseChancePercent: 7,
        fateScalePerPoint: 1,
        maxChancePercent: 34,
      },
      durationTurns: 3,
      bonusDamage: 6,
      extraEffects: { blockChanceFlat: 2 },
    },

    baseStats: {
      strength: 6,
      dexterity: 5,
      intelligence: 10,
      constitution: 8,
      physicalDefense: 6,
      magicalDefense: 7,
      luck: 5,
      endurance: 7,
      fate: 5,
    },

    resistances: {
      fire: 4,
      ice: 5,
      lightning: 4,
      poison: 3,
      sleep: 5,
      paralysis: 4,
      confusion: 5,
      fear: 5,
      dark: 3,
      holy: 7,
      stun: 4,
      bleed: 3,
      curse: 7,
      knockback: 4,
      criticalChanceReduction: 4,
      criticalDamageReduction: 4,
    },

    combatStats: {
      maxHP: 230,
      attackPower: 16,
      magicPower: 26,
      criticalChance: 8,
      criticalDamageBonus: 28,
      evasion: 5,
      blockChance: 6,
      blockValue: 10,
      lifeSteal: 0,
      damageReduction: 6,
      movementSpeed: 4,
    },

    // Mágico: “Silence” 1 turno
    ultimateSkill: {
      enabled: true,
      name: "Sacred Judgement",
      description: "A heavy holy strike for +55% magic damage. Applies SILENCE (cannot use ultimate next turn).",
      usesPerBattle: 1,
      earliestTurn: 3,
      cooldownTurns: 7,
      effects: {
        bonusDamagePercent: 55,
        applies: [
          {
            tag: "silence",
            stat: "ultimateLock",
            deltaFlat: 1,
            durationTurns: 1,
            resist: "holy",
          },
        ],
      },
      proc: {
        enabled: true,
        procInfoEn: "Turn start (≥3): Chance = min(5 + Fate×1, 15). Single use.",
        trigger: {
          check: "onTurnStart",
          earliestTurn: 3,
          baseChancePercent: 5,
          fateScalePerPoint: 1,
          maxChancePercent: 15,
        },
        respectCooldown: true,
      },
    },

    subclasses: [
      {
        name: "Flagellant",
        slug: "flagellant",
        iconName: "ShieldCheck",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Self-Discipline",
            description: "If HP < 50%, +5 Damage Reduction for 2 turns.",
            trigger: {
              check: "onTurnStart",
              condition: "hpBelow50",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: { buff: { damageReductionFlat: 5, durationTurns: 2 } },
          },
          {
            name: "Penitence",
            description: "Your first hit in battle deals +10 extra damage.",
            trigger: { check: "onFirstHit" },
            effects: { bonusHolyDamageFlat: 10 },
          },
        ],
      },
      {
        name: "Inquisitor",
        slug: "inquisitor",
        iconName: "Hammer",
        imageSubclassUrl: "",
        passives: [
          {
            name: "Sacred Mark",
            description: "On Hit, reduce target Defense by -5 for 1 turn.",
            trigger: {
              check: "onHit",
              baseChancePercent: 100,
              fateScalePerPoint: 0,
              maxChancePercent: 100,
            },
            effects: {
              debuff: { physicalDefenseFlat: -5, durationTurns: 1 },
            },
          },
          {
            name: "Iron Faith",
            description: "+5 Block Chance permanently.",
            trigger: { check: "alwaysOn" },
            effects: { permanent: { blockChanceFlat: 5 } },
          },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },
];
