// src/battleSystem/fixtures/Fixtures.ts
// Fixtures DEV listos para el pvpRunner, alineados con tu seed de clases (enteros).
// - Usamos constitution.
// - Porcentajes como enteros 0..100 (el runner hace clamp si hace falta).

import type { ResistancesMap as Resistances } from "../constants/resistances";

/* ───────────────── Tipos mínimos locales ───────────────── */

export type BaseStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
  fate: number;
};

export type CombatStats = {
  maxHP: number;
  attackPower: number;
  magicPower: number;

  // Porcentajes SIEMPRE en 0..100 (el runner normaliza/clamp).
  criticalChance: number; // 0..100
  criticalDamageBonus: number; // 0..100 (ej. 35 = +35%)
  evasion: number; // 0..100
  blockChance: number; // 0..100
  blockValue: number; // plano
  lifeSteal: number; // 0..100
  damageReduction: number; // 0..100
  movementSpeed: number; // 0..100
};

type PassiveTriggerCheck = "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit" | "onTurnStart";

type PassiveDefaultSkillCfg = {
  enabled?: boolean;
  name: string;
  damageType?: "magical" | "physical";
  shortDescEn?: string;
  longDescEn?: string;
  trigger: {
    check: PassiveTriggerCheck;
    scaleBy?: "fate";
    baseChancePercent?: number;
    fateScalePerPoint?: number;
    maxChancePercent?: number;
  };
  durationTurns?: number;
  bonusDamage?: number;
  extraEffects?: Record<string, number>;
};

type UltimateSkillCfg = {
  enabled?: boolean;
  name: string;
  description?: string;
  cooldownTurns: number;
  effects?: {
    bonusDamagePercent?: number;
    applyDebuff?: string;
    debuffValue?: number;
    bleedDamagePerTurn?: number;
    debuffDurationTurns?: number;
  };
  proc?: {
    enabled?: boolean;
    respectCooldown?: boolean;
    trigger?: {
      check: PassiveTriggerCheck; // típicamente "onTurnStart"
      scaleBy?: "fate";
      baseChancePercent?: number;
      fateScalePerPoint?: number;
      maxChancePercent?: number;
    };
  };
};

type ClassCfg = {
  name: "Vampire" | "Werewolf" | "Necromancer" | "Revenant" | "Exorcist";
  primaryWeapons: string[];
  secondaryWeapons?: string[];
  defaultWeapon: string;
  passiveDefaultSkill?: PassiveDefaultSkillCfg;
  ultimateSkill?: UltimateSkillCfg;
};

type FixtureSnapshot = {
  // Lo que consume el pvpRunner
  name: string;
  username?: string;
  className: ClassCfg["name"];
  stats: BaseStats;
  resistances: Resistances;
  combat: CombatStats;
  maxHP: number;
  currentHP: number;
  weapon?: string; // slug o nombre; el runner normaliza
  offHand?: string;
  class: {
    name: string;
    primaryWeapons: string[];
    defaultWeapon: string;
    passiveDefaultSkill?: PassiveDefaultSkillCfg;
    ultimateSkill?: UltimateSkillCfg;
  };
};

/* ───────────────── Seed: definiciones por clase ───────────────── */

// 1) Vampire (STR/DEX físico)
const CLASS_VAMPIRE: ClassCfg = {
  name: "Vampire",
  primaryWeapons: ["Rapier", "Dagger"],
  secondaryWeapons: ["Shortsword", "Scimitar", "Kris", "Shadowfang Blade"],
  defaultWeapon: "Rapier",
  passiveDefaultSkill: {
    enabled: true,
    name: "Crimson Impulse",
    damageType: "physical",
    shortDescEn: "+6 physical damage and +2 Evasion for 3 turns (scales with Fate).",
    longDescEn: "On basic hits, may grant +6 physical damage and +2 Evasion for 3 turns. Chance = min(7% + Fate×1, 35%). No stacking; refresh duration if active.",
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
      respectCooldown: true,
      trigger: {
        check: "onTurnStart",
        scaleBy: "fate",
        baseChancePercent: 1,
        fateScalePerPoint: 1,
        maxChancePercent: 8,
      },
    },
  },
};

const STATS_VAMPIRE: BaseStats = {
  strength: 8,
  dexterity: 7,
  intelligence: 5,
  constitution: 7,
  physicalDefense: 6,
  magicalDefense: 4,
  luck: 6,
  endurance: 7,
  fate: 5,
};

const RES_VAMPIRE: Resistances = {
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
};

const COMBAT_VAMPIRE: CombatStats = {
  maxHP: 220,
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
};

// 2) Werewolf (STR físico)
const CLASS_WEREWOLF: ClassCfg = {
  name: "Werewolf",
  primaryWeapons: ["Iron Claws", "Dual Daggers"],
  secondaryWeapons: ["Shortsword", "Light Axe", "Feral Fangblade", "Savage Paw"],
  defaultWeapon: "Iron Claws",
  passiveDefaultSkill: {
    enabled: true,
    name: "Lupine Frenzy",
    damageType: "physical",
    shortDescEn: "+7 physical damage and +2 Attack Speed for 3 turns (scales with Fate).",
    longDescEn: "On basic hits, may grant +7 physical damage and +2 Attack Speed for 3 turns. Chance = min(6% + Fate×1, 32%). No stacking; refresh duration.",
    trigger: {
      check: "onBasicHit",
      scaleBy: "fate",
      baseChancePercent: 6,
      fateScalePerPoint: 1,
      maxChancePercent: 32,
    },
    durationTurns: 3,
    bonusDamage: 7,
  },
  ultimateSkill: {
    enabled: true,
    name: "Savage Rend",
    description: "A ferocious claw strike for +65% physical damage. Applies 'Bleed' (8 damage per turn for 2 turns).",
    cooldownTurns: 6,
    effects: {
      bonusDamagePercent: 65,
      applyDebuff: "bleed",
      bleedDamagePerTurn: 8,
      debuffDurationTurns: 2,
    },
    proc: {
      enabled: true,
      respectCooldown: true,
      trigger: {
        check: "onTurnStart",
        scaleBy: "fate",
        baseChancePercent: 1,
        fateScalePerPoint: 1,
        maxChancePercent: 8,
      },
    },
  },
};

const STATS_WEREWOLF: BaseStats = {
  strength: 10,
  dexterity: 8,
  intelligence: 3,
  constitution: 9,
  physicalDefense: 7,
  magicalDefense: 3,
  luck: 4,
  endurance: 8,
  fate: 5,
};

const RES_WEREWOLF: Resistances = {
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
};

const COMBAT_WEREWOLF: CombatStats = {
  maxHP: 250,
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
};

// 3) Necromancer (INT mágico)
const CLASS_NECRO: ClassCfg = {
  name: "Necromancer",
  primaryWeapons: ["Bone Staff", "Scepter"],
  secondaryWeapons: ["Wand", "Occult Rod", "Grimoire", "Soul Orb"],
  defaultWeapon: "Bone Staff",
  passiveDefaultSkill: {
    enabled: true,
    name: "Umbral Focus",
    damageType: "magical",
    shortDescEn: "+9 magic damage and +3 Magic Power for 3 turns (scales with Fate).",
    longDescEn: "On spell cast, may grant +9 magic damage and +3 Magic Power for 3 turns. Chance = min(7% + Fate×1, 35%). No stacking; refresh duration.",
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
  ultimateSkill: {
    enabled: true,
    name: "Soul Curse",
    description: "A single target blast for +55% magic damage. Applies 'Curse' (-10% Attack for 2 turns).",
    cooldownTurns: 6,
    effects: {
      bonusDamagePercent: 55,
      applyDebuff: "curse",
      debuffValue: -10,
      debuffDurationTurns: 2,
    },
    proc: {
      enabled: true,
      respectCooldown: true,
      trigger: {
        check: "onTurnStart",
        scaleBy: "fate",
        baseChancePercent: 1,
        fateScalePerPoint: 1,
        maxChancePercent: 8,
      },
    },
  },
};

const STATS_NECRO: BaseStats = {
  strength: 3,
  dexterity: 4,
  intelligence: 12,
  constitution: 6,
  physicalDefense: 3,
  magicalDefense: 8,
  luck: 5,
  endurance: 6,
  fate: 5,
};

const RES_NECRO: Resistances = {
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
};

const COMBAT_NECRO: CombatStats = {
  maxHP: 220,
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
};

// 4) Revenant (DEX físico)
const CLASS_REVENANT: ClassCfg = {
  name: "Revenant",
  primaryWeapons: ["Cursed Crossbow", "Twin Flintlocks"],
  secondaryWeapons: ["Shortbow", "Arquebus", "Hexed Rifle", "Twin Daggers"],
  defaultWeapon: "Cursed Crossbow",
  passiveDefaultSkill: {
    enabled: true,
    name: "Spectral Deadeye",
    damageType: "physical",
    shortDescEn: "+5 physical damage and +2% Critical Chance for 3 turns (scales with Fate).",
    longDescEn: "On ranged hits, may grant +5 physical damage and +2% Critical Chance for 3 turns. Chance = min(8% + Fate×1, 36%). No stacking; refresh duration.",
    trigger: {
      check: "onRangedHit",
      scaleBy: "fate",
      baseChancePercent: 8,
      fateScalePerPoint: 1,
      maxChancePercent: 36,
    },
    durationTurns: 3,
    bonusDamage: 5,
    extraEffects: { criticalChancePercent: 2 },
  },
  ultimateSkill: {
    enabled: true,
    name: "Wraithshot",
    description: "A cursed projectile for +60% physical damage. Applies 'Fear' (reduces enemy Critical Chance by -10% for 2 turns).",
    cooldownTurns: 6,
    effects: {
      bonusDamagePercent: 60,
      applyDebuff: "fear",
      debuffValue: -10,
      debuffDurationTurns: 2,
    },
    proc: {
      enabled: true,
      respectCooldown: true,
      trigger: {
        check: "onTurnStart",
        scaleBy: "fate",
        baseChancePercent: 1,
        fateScalePerPoint: 1,
        maxChancePercent: 8,
      },
    },
  },
};

const STATS_REVENANT: BaseStats = {
  strength: 6,
  dexterity: 11,
  intelligence: 5,
  constitution: 6,
  physicalDefense: 4,
  magicalDefense: 5,
  luck: 6,
  endurance: 6,
  fate: 5,
};

const RES_REVENANT: Resistances = {
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
};

const COMBAT_REVENANT: CombatStats = {
  maxHP: 220,
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
};

// 5) Exorcist (INT mágico)
const CLASS_EXORCIST: ClassCfg = {
  name: "Exorcist",
  primaryWeapons: ["Holy Mace", "Flail"],
  secondaryWeapons: ["Warhammer", "Morningstar", "Censer", "Cleric Staff"],
  defaultWeapon: "Holy Mace",
  passiveDefaultSkill: {
    enabled: true,
    name: "Hallowed Smite",
    damageType: "magical",
    shortDescEn: "+6 magic damage and +2% Block Chance for 3 turns (scales with Fate).",
    longDescEn: "On hit or when being hit, may grant +6 magic damage and +2% Block Chance for 3 turns. Chance = min(7% + Fate×1, 34%). No stacking; refresh duration.",
    trigger: {
      check: "onHitOrBeingHit",
      scaleBy: "fate",
      baseChancePercent: 7,
      fateScalePerPoint: 1,
      maxChancePercent: 34,
    },
    durationTurns: 3,
    bonusDamage: 6,
    extraEffects: { blockChancePercent: 2 },
  },
  ultimateSkill: {
    enabled: true,
    name: "Sacred Judgement",
    description: "A heavy mace strike for +55% magic holy damage. Applies 'Silence' (target cannot use ultimate next turn).",
    cooldownTurns: 7,
    effects: { bonusDamagePercent: 55, applyDebuff: "silence", debuffDurationTurns: 1 },
    proc: {
      enabled: true,
      respectCooldown: true,
      trigger: {
        check: "onTurnStart",
        scaleBy: "fate",
        baseChancePercent: 1,
        fateScalePerPoint: 1,
        maxChancePercent: 8,
      },
    },
  },
};

const STATS_EXORCIST: BaseStats = {
  strength: 6,
  dexterity: 5,
  intelligence: 10,
  constitution: 8,
  physicalDefense: 6,
  magicalDefense: 7,
  luck: 5,
  endurance: 7,
  fate: 5,
};

const RES_EXORCIST: Resistances = {
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
};

const COMBAT_EXORCIST: CombatStats = {
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
};

/* ───────────────── Builder común ───────────────── */

type FixtureOpts = {
  name?: string;
  level?: number;
  weapon?: string; // override; si no, usa class.defaultWeapon
  currentHPPct?: number; // 1..100 para iniciar dañado en tests
};

function clamp01to100(n: number) {
  return Math.max(1, Math.min(100, Math.round(n)));
}

function buildFixture(classCfg: ClassCfg, stats: BaseStats, res: Resistances, cmb: CombatStats, opts: FixtureOpts = {}): FixtureSnapshot {
  const name = opts.name ?? classCfg.name;
  const level = Math.max(1, Math.floor(opts.level ?? 1));
  const maxHP = cmb.maxHP;
  const pct = clamp01to100(opts.currentHPPct ?? 100);
  const currentHP = pct === 100 ? maxHP : Math.max(1, Math.floor((maxHP * pct) / 100));

  return {
    name,
    username: name,
    className: classCfg.name,
    stats: { ...stats },
    resistances: { ...res },
    combat: { ...cmb },
    maxHP,
    currentHP,
    weapon: opts.weapon ?? classCfg.defaultWeapon,
    class: {
      name: classCfg.name,
      primaryWeapons: [...classCfg.primaryWeapons],
      defaultWeapon: classCfg.defaultWeapon,
      passiveDefaultSkill: classCfg.passiveDefaultSkill,
      ultimateSkill: classCfg.ultimateSkill,
    },
  };
}

/* ───────────────── Helpers exportados ───────────────── */

export function makeVampireFixture(opts: FixtureOpts = {}) {
  return buildFixture(CLASS_VAMPIRE, STATS_VAMPIRE, RES_VAMPIRE, COMBAT_VAMPIRE, opts);
}
export function makeWerewolfFixture(opts: FixtureOpts = {}) {
  return buildFixture(CLASS_WEREWOLF, STATS_WEREWOLF, RES_WEREWOLF, COMBAT_WEREWOLF, opts);
}
export function makeNecromancerFixture(opts: FixtureOpts = {}) {
  return buildFixture(CLASS_NECRO, STATS_NECRO, RES_NECRO, COMBAT_NECRO, opts);
}
export function makeRevenantFixture(opts: FixtureOpts = {}) {
  return buildFixture(CLASS_REVENANT, STATS_REVENANT, RES_REVENANT, COMBAT_REVENANT, opts);
}
export function makeExorcistFixture(opts: FixtureOpts = {}) {
  return buildFixture(CLASS_EXORCIST, STATS_EXORCIST, RES_EXORCIST, COMBAT_EXORCIST, opts);
}

/* ───────── Packs convenientes para pruebas (opcional) ───────── */

export function makeDemoDuelVampireVsWerewolf() {
  return {
    attackerSnapshot: makeVampireFixture({ name: "Vlad", level: 8 }),
    defenderSnapshot: makeWerewolfFixture({ name: "Fenrir", level: 8 }),
  };
}

export function makeDemoDuelNecroVsExorcist() {
  return {
    attackerSnapshot: makeNecromancerFixture({ name: "Morvane", level: 9 }),
    defenderSnapshot: makeExorcistFixture({ name: "Sister Aegis", level: 9 }),
  };
}
