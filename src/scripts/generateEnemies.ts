// src/scripts/generateEnemies.ts
// Genera enemigos con stats/loot/XP/Gold escalados y perfiles de drop por SLOT.
// Produce exactamente 50 enemigos: 3 por nivel (1..15) + minibosses (4,8,12) + bosses (10,15).

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales (compatibles con src/models/Enemy.ts)

export type EnemyTier = "common" | "elite" | "rare";
export type BossType = "miniboss" | "boss" | "world";
type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";
type SlotKey = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

export interface DropProfile {
  rolls: number;
  rarityChances: Record<RarityKey, number>;
  slotWeights: Partial<Record<SlotKey, number>>;
  guaranteedMinRarity?: "uncommon" | "rare" | "epic";
}

export interface SeedEnemy {
  name: string;
  level: number;
  tier: EnemyTier;
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    vitality: number;
    physicalDefense: number;
    magicalDefense: number;
    luck: number;
    agility: number;
    endurance: number;
    wisdom: number;
  };
  resistances: {
    fire: number;
    ice: number;
    lightning: number;
    poison: number;
    sleep: number;
    paralysis: number;
    confusion: number;
    fear: number;
    dark: number;
    holy: number;
    stun: number;
    bleed: number;
    curse: number;
    knockback: number;
    criticalChanceReduction: number;
    criticalDamageReduction: number;
  };
  combatStats: {
    maxHP: number;
    maxMP: number;
    attackPower: number;
    magicPower: number;
    criticalChance: number;
    criticalDamageBonus: number;
    attackSpeed: number;
    evasion: number;
    blockChance: number;
    blockValue: number;
    lifeSteal: number;
    manaSteal: number;
    damageReduction: number;
    movementSpeed: number;
  };
  imageUrl: string;

  xpReward: number;
  goldReward: number;
  dropProfile: DropProfile;

  isBoss?: boolean;
  bossType?: BossType | null;

  mechanics?: string[];
  immunities?: string[];
  lootTierMultiplier?: number;
  xpMultiplier?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RNG determinístico

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

// ─────────────────────────────────────────────────────────────────────────────
// Arquetipos

type ArchetypeKey = "melee" | "archer" | "mage" | "tank" | "beast" | "rogue";

const ARCHETYPES: Record<
  ArchetypeKey,
  {
    base: Partial<SeedEnemy["stats"]>;
    growth: Partial<Record<keyof SeedEnemy["stats"], number>>;
    namePool: string[];
    image: string;
  }
> = {
  melee: {
    base: { strength: 6, vitality: 6, physicalDefense: 4, endurance: 5, dexterity: 4, agility: 4, luck: 2, intelligence: 2, magicalDefense: 2, wisdom: 2 },
    growth: { strength: 1.4, vitality: 1.3, physicalDefense: 0.8, endurance: 0.9, dexterity: 0.6 },
    namePool: ["Bandido", "Matón", "Bruto", "Mercenario", "Espadachín"],
    image: "/assets/enemies/melee.png",
  },
  archer: {
    base: { dexterity: 7, agility: 6, luck: 3, strength: 4, vitality: 4, physicalDefense: 3, intelligence: 3, magicalDefense: 2, wisdom: 2 },
    growth: { dexterity: 1.3, agility: 1.1, luck: 0.5, strength: 0.5 },
    namePool: ["Arquero", "Tirador", "Cazador", "Vigía", "Carroñero"],
    image: "/assets/enemies/archer.png",
  },
  mage: {
    base: { intelligence: 8, wisdom: 6, magicalDefense: 5, vitality: 4, dexterity: 3, agility: 3, luck: 3, strength: 2, physicalDefense: 2, endurance: 3 },
    growth: { intelligence: 1.5, wisdom: 1.2, magicalDefense: 0.9, vitality: 0.5 },
    namePool: ["Acolito", "Cultista", "Hechicero", "Brujo", "Chamán"],
    image: "/assets/enemies/mage.png",
  },
  tank: {
    base: { vitality: 9, physicalDefense: 7, endurance: 7, strength: 5, magicalDefense: 4, agility: 2, dexterity: 3, luck: 2, intelligence: 2, wisdom: 2 },
    growth: { vitality: 1.8, physicalDefense: 1.2, endurance: 1.2, strength: 1.0, magicalDefense: 0.6 },
    namePool: ["Guardia", "Caballero", "Vigilante", "Rompehuesos", "Gólem"],
    image: "/assets/enemies/tank.png",
  },
  beast: {
    base: { strength: 7, agility: 8, vitality: 6, physicalDefense: 4, endurance: 4, dexterity: 4, luck: 2, intelligence: 1, magicalDefense: 2, wisdom: 1 },
    growth: { agility: 1.4, strength: 1.2, vitality: 1.1, physicalDefense: 0.6 },
    namePool: ["Lobo", "Jabalí", "Saurio", "Hiena", "Raptor"],
    image: "/assets/enemies/beast.png",
  },
  rogue: {
    base: { dexterity: 7, agility: 8, luck: 4, strength: 4, vitality: 4, physicalDefense: 3, intelligence: 2, magicalDefense: 2, endurance: 3, wisdom: 2 },
    growth: { dexterity: 1.3, agility: 1.3, luck: 0.6, strength: 0.5 },
    namePool: ["Ratero", "Asaltante", "Acechador", "Cuchillero", "Sombrío"],
    image: "/assets/enemies/rogue.png",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Resistencias por banda de nivel

function resistTemplate(level: number) {
  const band = level <= 5 ? 0 : level <= 10 ? 1 : 2;
  const base = [0, 2, 4][band];
  const spike = [1, 2, 3][band];
  return {
    fire: base,
    ice: base + 1,
    lightning: base,
    poison: base + 1,
    sleep: base,
    paralysis: base,
    confusion: base + 1,
    fear: base + 1,
    dark: base + 1,
    holy: base,
    stun: base + spike,
    bleed: base + 1,
    curse: base + 1,
    knockback: base + spike,
    criticalChanceReduction: base + 1,
    criticalDamageReduction: base + 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat derivados del statline + arquetipo

function derivedCombat(level: number, arche: ArchetypeKey, stats: SeedEnemy["stats"]) {
  const atkBias = { melee: 1.1, archer: 1.0, mage: 0.6, tank: 0.9, beast: 1.05, rogue: 1.0 }[arche];
  const magBias = { melee: 0.4, archer: 0.5, mage: 1.4, tank: 0.3, beast: 0.3, rogue: 0.5 }[arche];

  const maxHP = clamp(40 + stats.vitality * 10 + level * 12 + stats.physicalDefense * 2, 30, 9999);
  const maxMP = clamp(10 + stats.wisdom * 8 + stats.intelligence * 6 + level * 5, 0, 9999);

  const attackPower = clamp(stats.strength * 2 + stats.dexterity * 1.2 + level * (2.0 * atkBias), 1, 999);
  const magicPower = clamp(stats.intelligence * 2.2 + stats.wisdom * 1.5 + level * (2.2 * magBias), 0, 999);

  const criticalChance = clamp(3 + stats.luck * 0.8 + stats.dexterity * 0.2, 0, 40);
  const criticalDamageBonus = clamp(20 + Math.floor(level * 1.2), 20, 60);
  const attackSpeed = clamp(4 + Math.floor(stats.agility / 2), 1, 12);
  const evasion = clamp(3 + Math.floor(stats.agility * 0.8), 0, 20);
  const blockChance = clamp(Math.floor((stats.physicalDefense + stats.endurance) / 8), 0, 15);
  const blockValue = clamp(Math.floor((stats.physicalDefense + stats.vitality) / 3), 0, 20);
  const lifeSteal = 0;
  const manaSteal = arche === "mage" ? 2 : 0;
  const damageReduction = clamp(Math.floor((stats.physicalDefense + stats.magicalDefense) / 4), 0, 15);
  const movementSpeed = clamp(4 + Math.floor(stats.agility / 3), 3, 8);

  return {
    maxHP,
    maxMP,
    attackPower,
    magicPower,
    criticalChance,
    criticalDamageBonus,
    attackSpeed,
    evasion,
    blockChance,
    blockValue,
    lifeSteal,
    manaSteal,
    damageReduction,
    movementSpeed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades varias

function roundStats(obj: Partial<SeedEnemy["stats"]>): SeedEnemy["stats"] {
  const def = {
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    vitality: 0,
    physicalDefense: 0,
    magicalDefense: 0,
    luck: 0,
    agility: 0,
    endurance: 0,
    wisdom: 0,
  };
  const out: any = { ...def, ...obj };
  Object.keys(out).forEach((k) => (out[k] = clamp(out[k], 0, 99)));
  return out;
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot weights por arquetipo

function slotWeightsForArchetype(arche: ArchetypeKey): Record<SlotKey, number> {
  const base: Record<SlotKey, number> = {
    helmet: 1,
    chest: 1,
    gloves: 1,
    boots: 1,
    mainWeapon: 1,
    offWeapon: 1,
    ring: 1,
    belt: 1,
    amulet: 1,
  };
  if (arche === "melee" || arche === "tank") {
    base.mainWeapon = 3;
    base.offWeapon = 3;
    base.chest = 2;
    base.gloves = 2;
  }
  if (arche === "mage") {
    base.mainWeapon = 3;
    base.offWeapon = 3;
    base.amulet = 2;
    base.helmet = 2;
  }
  if (arche === "archer") {
    base.mainWeapon = 3;
    base.offWeapon = 3;
    base.ring = 2;
    base.boots = 2;
  }
  if (arche === "rogue") {
    base.mainWeapon = 3;
    base.ring = 2;
    base.boots = 2;
    base.gloves = 2;
  }
  if (arche === "beast") {
    base.belt = 2;
    base.boots = 2;
    base.chest = 2;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rarity chances / rolls / guarantees (por tier + boss)

function normalizeTo100(obj: Record<string, number>) {
  const total = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
  const out: any = {};
  for (const k of Object.keys(obj)) out[k] = Math.round((obj[k] / total) * 100);
  // Ajuste por redondeo: asegura que sumen 100
  const sum = Object.values(out).reduce((a: number, b) => a + (b as number), 0);
  if (sum !== 100) {
    const keys = Object.keys(out);
    out[keys[0]] += 100 - sum;
  }
  return out as Record<RarityKey, number>;
}

function computeDropProfile(level: number, arche: ArchetypeKey, tier: EnemyTier, bossType?: BossType | null): DropProfile {
  const rarityBase =
    tier === "elite"
      ? { common: 50, uncommon: 35, rare: 12, epic: 3, legendary: 0 }
      : tier === "rare"
      ? { common: 35, uncommon: 40, rare: 18, epic: 6, legendary: 1 }
      : { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 };

  let rolls = tier === "common" ? 1 : 2;
  let guaranteedMin: "uncommon" | "rare" | "epic" | undefined;

  if (bossType === "miniboss") {
    rolls += 1;
    rarityBase.rare += 5;
    rarityBase.epic += 3;
    guaranteedMin = "uncommon";
  }
  if (bossType === "boss") {
    rolls += 2;
    rarityBase.rare += 10;
    rarityBase.epic += 8;
    rarityBase.legendary += 2;
    guaranteedMin = "rare";
  }
  if (bossType === "world") {
    rolls += 3;
    rarityBase.uncommon += 5;
    rarityBase.rare += 12;
    rarityBase.epic += 10;
    rarityBase.legendary += 3;
    guaranteedMin = "epic";
  }

  const rarityChances = normalizeTo100(rarityBase);
  const slotWeights = slotWeightsForArchetype(arche);

  return { rolls, rarityChances, slotWeights, guaranteedMinRarity: guaranteedMin };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recompensas XP/Oro

function computeRewards(level: number, tier: EnemyTier, bossType?: BossType | null) {
  const tierMul = tier === "elite" ? 1.35 : tier === "rare" ? 1.7 : 1.0;
  const bossMul = bossType === "miniboss" ? 1.2 : bossType === "boss" ? 1.6 : bossType === "world" ? 2.0 : 1.0;

  const baseXP = 12 + level * 8; // curva base
  const baseGold = 6 + level * 3;

  const xp = Math.round(baseXP * tierMul * bossMul);
  const gold = Math.round(baseGold * tierMul * bossMul);

  return { xpReward: xp, goldReward: gold };
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de un enemigo

function buildEnemy(rnd: () => number, level: number, tier: EnemyTier, arche: ArchetypeKey, bossType?: BossType | null): SeedEnemy {
  const spec = ARCHETYPES[arche];

  const base: any = { ...spec.base };
  // growth * (lvl-1)
  Object.entries(spec.growth).forEach(([k, g]) => {
    base[k] = (base[k] || 0) + (g as number) * (level - 1);
  });

  // Multiplicadores por tier
  const statMul = tier === "elite" ? 1.15 : tier === "rare" ? 1.35 : 1.0;

  const stats = roundStats(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, (v as number) * statMul])));

  const resistances = resistTemplate(level);
  // subir un poco resist si es rare
  if (tier === "elite" || tier === "rare") {
    (Object.keys(resistances) as (keyof SeedEnemy["resistances"])[]).forEach((k) => {
      resistances[k] = clamp(resistances[k] + (tier === "rare" ? 2 : 1), 0, 99);
    });
  }

  const combatStats = derivedCombat(level, arche, stats);

  // Nombre e imagen
  const pickName = pick(rnd, spec.namePool);
  const suffix = level <= 3 ? "Débil" : level <= 6 ? "Curtido" : level <= 10 ? "Templado" : level <= 13 ? "Letal" : "Élite";
  const tierTag = tier === "rare" ? "Raro " : tier === "elite" ? "Élite " : "";
  const bossTag = bossType ? (bossType === "miniboss" ? " (Minijefe)" : bossType === "boss" ? " (Jefe)" : " (World Boss)") : "";
  const name = `${tierTag}${pickName} ${suffix}${bossTag}`;
  const imageUrl = spec.image;

  const dropProfile = computeDropProfile(level, arche, tier, bossType);
  const { xpReward, goldReward } = computeRewards(level, tier, bossType);

  return {
    name,
    level,
    tier,
    stats,
    resistances,
    combatStats,
    imageUrl,
    xpReward,
    goldReward,
    dropProfile,
    isBoss: !!bossType,
    bossType: bossType ?? null,
    mechanics: bossType ? ["enrage", "crushing-blow"] : [],
    immunities: bossType ? ["fear"] : [],
    lootTierMultiplier: 1.0,
    xpMultiplier: 1.0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública

export function generateEnemies(levelFrom: number, levelTo: number, perLevel: number, seed: number): SeedEnemy[] {
  const rnd = mulberry32(seed + levelFrom * 7919 + levelTo * 104729);
  const types: ArchetypeKey[] = ["melee", "archer", "mage", "tank", "beast", "rogue"];
  const enemies: SeedEnemy[] = [];

  for (let lvl = levelFrom; lvl <= levelTo; lvl++) {
    for (let i = 0; i < perLevel; i++) {
      const arche = pick(rnd, types);
      // prob tier: 70% common, 25% elite, 5% rare
      const r = rnd();
      const tier: EnemyTier = r < 0.05 ? "rare" : r < 0.3 ? "elite" : "common";
      enemies.push(buildEnemy(rnd, lvl, tier, arche, null));
    }
  }
  return enemies;
}

/**
 * Genera EXACTAMENTE 50 enemigos:
 * - 3 por nivel del 1 al 15 = 45
 * - Miniboss en niveles 4, 8, 12  → 3
 * - Boss en niveles 10 y 15       → 2
 */
export function buildSeedEnemies(): SeedEnemy[] {
  const all: SeedEnemy[] = [];

  // 45 regulares
  all.push(...generateEnemies(1, 15, 3, 20258));

  // minibosses (toman arquetipo aleatorio)
  const miniLevels = [4, 8, 12];
  for (const lvl of miniLevels) {
    const rnd = mulberry32(8800 + lvl);
    const arche = pick(rnd, ["melee", "archer", "mage", "tank", "beast", "rogue"] as ArchetypeKey[]);
    // miniboss suele ser "elite" (a veces "rare" en rangos altos)
    const tier: EnemyTier = lvl >= 10 ? (rnd() < 0.4 ? "rare" : "elite") : "elite";
    all.push(buildEnemy(rnd, lvl, tier, arche, "miniboss"));
  }

  // bosses (10, 15)
  const bossLevels = [10, 15];
  for (const lvl of bossLevels) {
    const rnd = mulberry32(9900 + lvl);
    const arche = pick(rnd, ["tank", "melee", "mage"] as ArchetypeKey[]); // más “épicos”
    const tier: EnemyTier = lvl >= 15 ? "rare" : "elite";
    all.push(buildEnemy(rnd, lvl, tier, arche, "boss"));
  }

  // sanity: debe ser 50
  if (all.length !== 50) {
    // Si por algún cambio futuro no diera 50, recortamos o rellenamos con comunes lvl 1
    if (all.length > 50) return all.slice(0, 50);
    const rnd = mulberry32(123);
    while (all.length < 50) {
      all.push(buildEnemy(rnd, 1, "common", "melee", null));
    }
  }
  return all;
}

// Ejecución directa para debug
if (require.main === module) {
  const list = buildSeedEnemies();
  console.log(`Generados: ${list.length}`);
  console.log(
    list.slice(0, 5).map((e) => ({
      name: e.name,
      lvl: e.level,
      tier: e.tier,
      boss: e.bossType ?? "no",
    }))
  );
}
