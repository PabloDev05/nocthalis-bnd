export const seedCharacterClasses = [
  /* ───────────────────────────── Vampire ───────────────────────────── */
  {
    name: "Vampire",
    description: "A cursed noble who rules the night with graceful lethality.",
    iconName: "Droplet",
    imageMainClassUrl: "/assets/classes/vampire/vampire_class.png",

    primaryWeapons: ["Rapier", "Dagger"],
    secondaryWeapons: ["Shortsword", "Scimitar", "Kris", "Shadowfang Blade"],

    defaultWeapon: "Rapier",
    allowedWeapons: ["Rapier", "Dagger", "Shortsword", "Scimitar", "Kris", "Shadowfang Blade", "Crimson Scimitar", "Bloodfang Sabre", "Shadow Kris", "Nightfang Blade", "Curved Fangblade"],

    // Passive: flat bonus damage + extra combat stat for 3 turns (Fate-based, repeatable)
    passiveSkill: {
      enabled: true,
      name: "Crimson Impulse",
      damageType: "magical",
      shortDescEn: "+6 magic damage and +2 Evasion for 3 turns (scales with Fate).",
      longDescEn: "On basic hits, may grant +6 magic damage and +2 Evasion for 3 turns. Chance = min(7% + Fate×1, 35%). No stacking; refresh duration if active.",
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
      vitality: 7,
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
      maxHP: 220,
      attackPower: 24,
      magicPower: 8,
      criticalChance: 12,
      criticalDamageBonus: 35,
      attackSpeed: 6,
      evasion: 7,
      blockChance: 4,
      blockValue: 6,
      lifeSteal: 8,
      damageReduction: 5,
      movementSpeed: 5,
    },

    ultimateSkill: {
      enabled: true,
      name: "Crimson Feast",
      description: "A precise strike for +60% physical damage. Applies 'Weaken' (-10% Physical Defense for 2 turns).",
      cooldownTurns: 6,
      effects: {
        bonusDamagePercent: 60,
        applyDebuff: "weaken",
        debuffValue: -10,
        debuffDurationTurns: 2,
      },
      proc: {
        enabled: true,
        procInfoEn: "At the start of each turn, if ready: Chance = min(1% + Fate×1, 8%). On success, it casts and goes on cooldown.",
        trigger: { check: "onTurnStart", scaleBy: "fate", baseChancePercent: 1, fateScalePerPoint: 1, maxChancePercent: 8 },
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
          { name: "Voracious Bite", description: "Critical hits heal +5% extra HP." },
          { name: "Crimson Rite", description: "+5% Attack while below 50% HP." },
        ],
      },
      {
        name: "Nosferatu",
        slug: "nosferatu",
        iconName: "Moon",
        imageSubclassUrl: "",
        passives: [
          { name: "Night Shroud", description: "+5% Evasion at battle start for 2 turns." },
          { name: "Cold Immortality", description: "+5 resistance to Fear." },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ───────────────────────────── Werewolf ──────────────────────────── */
  {
    name: "Werewolf",
    description: "A relentless beast that dominates the hunt with brute ferocity.",
    iconName: "Claw",
    imageMainClassUrl: "/assets/classes/werewolf/werewolf_class.png",

    primaryWeapons: ["Iron Claws", "Dual Daggers"],
    secondaryWeapons: ["Shortsword", "Light Axe", "Feral Fangblade", "Savage Paw"],

    defaultWeapon: "Iron Claws",
    allowedWeapons: ["Iron Claws", "Dual Daggers", "Shortsword", "Light Axe", "Feral Fangblade", "Savage Paw", "Claw Gauntlets", "Beast Fangs", "Dire Talons", "Bloodclaw", "Rendfangs"],

    passiveSkill: {
      enabled: true,
      name: "Lupine Frenzy",
      damageType: "magical",
      shortDescEn: "+7 magic damage and +2 Attack Speed for 3 turns (scales with Fate).",
      longDescEn: "On basic hits, may grant +7 magic damage and +2 Attack Speed for 3 turns. Chance = min(6% + Fate×1, 32%). No stacking; refresh duration.",
      trigger: { check: "onBasicHit", scaleBy: "fate", baseChancePercent: 6, fateScalePerPoint: 1, maxChancePercent: 32 },
      durationTurns: 3,
      bonusDamage: 7,
      extraEffects: { attackSpeedFlat: 2 },
    },

    baseStats: {
      strength: 10,
      dexterity: 8,
      intelligence: 3,
      vitality: 9,
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
      maxHP: 250,
      attackPower: 28,
      magicPower: 4,
      criticalChance: 10,
      criticalDamageBonus: 30,
      attackSpeed: 7,
      evasion: 8,
      blockChance: 3,
      blockValue: 5,
      lifeSteal: 3,
      damageReduction: 6,
      movementSpeed: 7,
    },

    ultimateSkill: {
      enabled: true,
      name: "Savage Rend",
      description: "A ferocious claw strike for +65% physical damage. Applies 'Bleed' (8 damage per turn for 2 turns).",
      cooldownTurns: 6,
      effects: { bonusDamagePercent: 65, applyDebuff: "bleed", bleedDamagePerTurn: 8, debuffDurationTurns: 2 },
      proc: {
        enabled: true,
        procInfoEn: "At turn start, if ready: Chance = min(1% + Fate×1, 8%). On success, fires and goes on cooldown.",
        trigger: { check: "onTurnStart", scaleBy: "fate", baseChancePercent: 1, fateScalePerPoint: 1, maxChancePercent: 8 },
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
          { name: "Alpha Roar", description: "On ultimate use, gain +5% Attack for 2 turns." },
          { name: "Predator Instinct", description: "On Dodge, gain +5% Attack for 1 turn." },
        ],
      },
      {
        name: "Berserker",
        slug: "berserker",
        iconName: "Flame",
        imageSubclassUrl: "",
        passives: [
          { name: "Savage Wrath", description: "+10% damage while below 50% HP." },
          { name: "Blood Frenzy", description: "Attacks have 20% chance to apply 1 Bleed stack." },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ──────────────────────────── Necromancer ────────────────────────── */
  {
    name: "Necromancer",
    description: "A grave-lord who bends arcane decay to shatter the living.",
    iconName: "Skull",
    imageMainClassUrl: "/assets/classes/necromancer/necromancer_class.png",

    primaryWeapons: ["Bone Staff", "Scepter"],
    secondaryWeapons: ["Wand", "Occult Rod", "Grimoire", "Soul Orb"],

    defaultWeapon: "Bone Staff",
    allowedWeapons: ["Bone Staff", "Scepter", "Wand", "Occult Rod", "Grimoire", "Soul Orb", "Corrupted Scepter", "Skull Wand", "Plague Rod", "Soulbone Cane", "Ghoul Scepter", "Occult Crook"],

    passiveSkill: {
      enabled: true,
      name: "Umbral Focus",
      damageType: "magical",
      shortDescEn: "+9 magic damage and +3 Magic Power for 3 turns (scales with Fate).",
      longDescEn: "On spell cast, may grant +9 magic damage and +3 Magic Power for 3 turns. Chance = min(7% + Fate×1, 35%). No stacking; refresh duration.",
      trigger: { check: "onSpellCast", scaleBy: "fate", baseChancePercent: 7, fateScalePerPoint: 1, maxChancePercent: 35 },
      durationTurns: 3,
      bonusDamage: 9,
      extraEffects: { magicPowerFlat: 3 },
    },

    baseStats: {
      strength: 3,
      dexterity: 4,
      intelligence: 12,
      vitality: 6,
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
      maxHP: 220,
      attackPower: 8,
      magicPower: 32,
      criticalChance: 8,
      criticalDamageBonus: 30,
      attackSpeed: 4,
      evasion: 5,
      blockChance: 2,
      blockValue: 5,
      lifeSteal: 0,
      damageReduction: 4,
      movementSpeed: 4,
    },

    ultimateSkill: {
      enabled: true,
      name: "Soul Curse",
      description: "A single target blast for +55% magic damage. Applies 'Curse' (-10% Attack for 2 turns).",
      cooldownTurns: 6,
      effects: { bonusDamagePercent: 55, applyDebuff: "curse", debuffValue: -10, debuffDurationTurns: 2 },
      proc: {
        enabled: true,
        procInfoEn: "Checks each turn if available: Chance = min(1% + Fate×1, 8%). On success, casts and goes on cooldown.",
        trigger: { check: "onTurnStart", scaleBy: "fate", baseChancePercent: 1, fateScalePerPoint: 1, maxChancePercent: 8 },
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
          { name: "Bone Guard", description: "Gain +5% Damage Reduction for 2 turns at battle start." },
          { name: "Corpse Burst", description: "On kill, deal 10 magic damage to enemy target." },
        ],
      },
      {
        name: "Soulbinder",
        slug: "soulbinder",
        iconName: "Ghost",
        imageSubclassUrl: "",
        passives: [
          { name: "Shadow Tethers", description: "Hits reduce enemy Speed by -5% for 1 turn." },
          { name: "Breath Steal", description: "Restore 10 HP when landing a killing blow." },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ───────────────────────────── Revenant ──────────────────────────── */
  {
    name: "Revenant",
    description: "A spectral marksman who pierces fate with cursed shot.",
    iconName: "Crossbow",
    imageMainClassUrl: "/assets/classes/revenant/revenant_class.png",

    primaryWeapons: ["Cursed Crossbow", "Twin Flintlocks"],
    secondaryWeapons: ["Shortbow", "Arquebus", "Hexed Rifle", "Twin Daggers"],

    defaultWeapon: "Cursed Crossbow",
    allowedWeapons: ["Cursed Crossbow", "Twin Flintlocks", "Shortbow", "Arquebus", "Hexed Rifle", "Twin Daggers", "Ancient Pistol", "Bone Carbine", "Spectral Arquebus", "Ghastly Handcannon"],

    passiveSkill: {
      enabled: true,
      name: "Spectral Deadeye",
      damageType: "magical",
      shortDescEn: "+5 magic damage and +2% Critical Chance for 3 turns (scales with Fate).",
      longDescEn: "On ranged hits, may grant +5 magic damage and +2% Critical Chance for 3 turns. Chance = min(8% + Fate×1, 36%). No stacking; refresh duration.",
      trigger: { check: "onRangedHit", scaleBy: "fate", baseChancePercent: 8, fateScalePerPoint: 1, maxChancePercent: 36 },
      durationTurns: 3,
      bonusDamage: 5,
      extraEffects: { criticalChancePercent: 2 },
    },

    baseStats: {
      strength: 6,
      dexterity: 11,
      intelligence: 5,
      vitality: 6,
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
      maxHP: 220,
      attackPower: 24,
      magicPower: 10,
      criticalChance: 14,
      criticalDamageBonus: 40,
      attackSpeed: 6,
      evasion: 9,
      blockChance: 3,
      blockValue: 5,
      lifeSteal: 2,
      damageReduction: 4,
      movementSpeed: 7,
    },

    ultimateSkill: {
      enabled: true,
      name: "Wraithshot",
      description: "A cursed projectile for +60% physical damage. Applies 'Fear' (reduces enemy Critical Chance by -10% for 2 turns).",
      cooldownTurns: 6,
      effects: { bonusDamagePercent: 60, applyDebuff: "fear", debuffValue: -10, debuffDurationTurns: 2 },
      proc: {
        enabled: true,
        procInfoEn: "At turn start, if ready: Chance = min(1% + Fate×1, 8%). On success, fires and goes on cooldown.",
        trigger: { check: "onTurnStart", scaleBy: "fate", baseChancePercent: 1, fateScalePerPoint: 1, maxChancePercent: 8 },
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
          { name: "Piercing Bolt", description: "Your shots ignore 10% Physical Defense." },
          { name: "Spectral Tension", description: "First attack of battle has +10% Crit Chance." },
        ],
      },
      {
        name: "Gunslinger Shade",
        slug: "gunslinger-shade",
        iconName: "Gun",
        imageSubclassUrl: "",
        passives: [
          { name: "Twin Shot", description: "Basic attack has 20% chance to hit twice." },
          { name: "Hexed Bullet", description: "Critical hits have 20% chance to apply Fear for 1 turn." },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },

  /* ───────────────────────────── Exorcist ──────────────────────────── */
  {
    name: "Exorcist",
    description: "A priest-warrior who scorches abominations with sacred iron.",
    iconName: "Sparkles",
    imageMainClassUrl: "/assets/classes/exorcist/exorcist_class.png",

    primaryWeapons: ["Holy Mace", "Flail"],
    secondaryWeapons: ["Warhammer", "Morningstar", "Censer", "Cleric Staff"],

    defaultWeapon: "Holy Mace",
    allowedWeapons: ["Holy Mace", "Flail", "Warhammer", "Morningstar", "Censer", "Cleric Staff", "Consecrated Flail", "Blessed Morningstar", "Iron Censer", "Divine Hammer", "Sanctified Club"],

    passiveSkill: {
      enabled: true,
      name: "Hallowed Smite",
      damageType: "magical",
      shortDescEn: "+6 magic damage and +2% Block Chance for 3 turns (scales with Fate).",
      longDescEn: "On hit or when being hit, may grant +6 magic damage and +2% Block Chance for 3 turns. Chance = min(7% + Fate×1, 34%). No stacking; refresh duration.",
      trigger: { check: "onHitOrBeingHit", scaleBy: "fate", baseChancePercent: 7, fateScalePerPoint: 1, maxChancePercent: 34 },
      durationTurns: 3,
      bonusDamage: 6,
      extraEffects: { blockChancePercent: 2 },
    },

    baseStats: {
      strength: 6,
      dexterity: 5,
      intelligence: 10,
      vitality: 8,
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
      attackSpeed: 4,
      evasion: 5,
      blockChance: 6,
      blockValue: 10,
      lifeSteal: 0,
      damageReduction: 6,
      movementSpeed: 4,
    },

    ultimateSkill: {
      enabled: true,
      name: "Sacred Judgement",
      description: "A heavy mace strike for +55% magic holy damage. Applies 'Silence' (target cannot use ultimate next turn).",
      cooldownTurns: 7,
      effects: { bonusDamagePercent: 55, applyDebuff: "silence", debuffDurationTurns: 1 },
      proc: {
        enabled: true,
        procInfoEn: "Checks each turn if available: Chance = min(1% + Fate×1, 8%). On success, casts and goes on cooldown.",
        trigger: { check: "onTurnStart", scaleBy: "fate", baseChancePercent: 1, fateScalePerPoint: 1, maxChancePercent: 8 },
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
          { name: "Self-Discipline", description: "If below 50% HP, gain +5% Damage Reduction for 2 turns." },
          { name: "Penitence", description: "Your first hit in battle deals +10% extra damage." },
        ],
      },
      {
        name: "Inquisitor",
        slug: "inquisitor",
        iconName: "Hammer",
        imageSubclassUrl: "",
        passives: [
          { name: "Sacred Mark", description: "Your hits reduce target Defense by -5% for 1 turn." },
          { name: "Iron Faith", description: "+5% Block Chance permanently." },
        ],
      },
    ],

    affinities: [],
    talents: [],
  },
];
