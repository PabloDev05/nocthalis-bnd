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
  rarityChances: Record<RarityKey, number>; // enteros 0..100, suman 100
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
    constitution: number;
    physicalDefense: number;
    magicalDefense: number;
    luck: number;
    endurance: number;
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
    attackPower: number;
    magicPower: number;
    criticalChance: number; // %
    criticalDamageBonus: number; // % (extra sobre base)
    attackSpeed: number; // ticks/turn o tu unidad actual
    evasion: number; // %
    blockChance: number; // %
    blockValue: number; // valor plano
    lifeSteal: number; // %
    damageReduction: number; // %
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
  lootTierMultiplier?: number; // p.ej. 1.0, 1.2...
  xpMultiplier?: number; // p.ej. 1.0, 1.6...
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
const asInt = (n: number) => Math.round(n);

// Pequeña variación reproducible (±pct)
function jitterInt(rnd: () => number, base: number, pctRange: number) {
  if (base <= 0 || pctRange <= 0) return asInt(base);
  const delta = (rnd() * 2 - 1) * pctRange; // [-pct, +pct]
  return Math.max(0, asInt(base * (1 + delta)));
}

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
    base: { strength: 6, constitution: 6, physicalDefense: 4, endurance: 5, dexterity: 5, luck: 2, intelligence: 2, magicalDefense: 2 },
    growth: { strength: 1.4, constitution: 1.3, physicalDefense: 0.8, endurance: 0.9, dexterity: 0.7 },
    namePool: ["Bandido", "Matón", "Bruto", "Mercenario", "Espadachín"],
    image: "/assets/enemies/melee.png",
  },
  archer: {
    base: { dexterity: 11, luck: 3, strength: 4, constitution: 4, physicalDefense: 3, intelligence: 3, magicalDefense: 2, endurance: 3 },
    growth: { dexterity: 1.8, luck: 0.5, strength: 0.5 },
    namePool: ["Arquero", "Tirador", "Cazador", "Vigía", "Carroñero"],
    image: "/assets/enemies/archer.png",
  },
  mage: {
    base: { intelligence: 12, magicalDefense: 5, constitution: 4, dexterity: 3, luck: 3, strength: 2, physicalDefense: 2, endurance: 3 },
    growth: { intelligence: 2.0, magicalDefense: 0.9, constitution: 0.5 },
    namePool: ["Acolito", "Cultista", "Hechicero", "Brujo", "Chamán"],
    image: "/assets/enemies/mage.png",
  },
  tank: {
    base: { constitution: 9, physicalDefense: 7, endurance: 7, strength: 5, magicalDefense: 4, dexterity: 3, luck: 2, intelligence: 2 },
    growth: { constitution: 1.8, physicalDefense: 1.2, endurance: 1.2, strength: 1.0, magicalDefense: 0.6 },
    namePool: ["Guardia", "Caballero", "Vigilante", "Rompehuesos", "Gólem"],
    image: "/assets/enemies/tank.png",
  },
  beast: {
    base: { strength: 7, constitution: 6, physicalDefense: 4, endurance: 4, dexterity: 8, luck: 2, intelligence: 1, magicalDefense: 2 },
    growth: { dexterity: 1.4, strength: 1.2, constitution: 1.1, physicalDefense: 0.6 },
    namePool: ["Lobo", "Jabalí", "Saurio", "Hiena", "Raptor"],
    image: "/assets/enemies/beast.png",
  },
  rogue: {
    base: { dexterity: 11, luck: 4, strength: 4, constitution: 4, physicalDefense: 3, intelligence: 2, magicalDefense: 2, endurance: 3 },
    growth: { dexterity: 1.9, luck: 0.6, strength: 0.5 },
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

function derivedCombat(level: number, arche: ArchetypeKey, stats: SeedEnemy["stats"], rnd: () => number) {
  const atkBias = { melee: 1.1, archer: 1.0, mage: 0.6, tank: 0.9, beast: 1.05, rogue: 1.0 }[arche];
  const magBias = { melee: 0.4, archer: 0.5, mage: 1.4, tank: 0.3, beast: 0.3, rogue: 0.5 }[arche];

  // Base “determinista”
  let maxHP = 40 + stats.constitution * 10 + level * 12 + stats.physicalDefense * 2;
  let attackPower = stats.strength * 2 + stats.dexterity * 1.2 + level * (2.0 * atkBias);
  let magicPower = stats.intelligence * 2.6 + level * (2.2 * magBias);

  let criticalChance = 3 + stats.luck * 0.8 + stats.dexterity * 0.2;
  let criticalDamageBonus = 20 + level * 1.2;
  let attackSpeed = 4 + stats.dexterity / 2;
  let evasion = 3 + stats.dexterity * 0.8;
  let blockChance = (stats.physicalDefense + stats.endurance) / 8;
  let blockValue = (stats.physicalDefense + stats.constitution) / 3;
  let lifeSteal = 0;
  let damageReduction = (stats.physicalDefense + stats.magicalDefense) / 4;
  let movementSpeed = 4 + stats.dexterity / 3;

  // Jitter leve para que no salgan clones (±6% stats de combate)
  const J = 0.06;
  maxHP = jitterInt(rnd, maxHP, J);
  attackPower = jitterInt(rnd, attackPower, J);
  magicPower = jitterInt(rnd, magicPower, J);
  criticalChance = jitterInt(rnd, criticalChance, J);
  criticalDamageBonus = jitterInt(rnd, criticalDamageBonus, J);
  attackSpeed = jitterInt(rnd, attackSpeed, J);
  evasion = jitterInt(rnd, evasion, J);
  blockChance = jitterInt(rnd, blockChance, J);
  blockValue = jitterInt(rnd, blockValue, J);
  movementSpeed = jitterInt(rnd, movementSpeed, J);
  // lifeSteal / damageReduction los mantenemos enteros directos
  damageReduction = clamp(asInt(damageReduction), 0, 20);

  return {
    maxHP: clamp(maxHP, 30, 9999),
    attackPower: clamp(attackPower, 1, 999),
    magicPower: clamp(magicPower, 0, 999),
    criticalChance: clamp(criticalChance, 0, 40),
    criticalDamageBonus: clamp(criticalDamageBonus, 20, 60),
    attackSpeed: clamp(attackSpeed, 1, 12),
    evasion: clamp(evasion, 0, 25),
    blockChance: clamp(blockChance, 0, 18),
    blockValue: clamp(blockValue, 0, 24),
    lifeSteal: asInt(lifeSteal),
    damageReduction: clamp(damageReduction, 0, 20),
    movementSpeed: clamp(movementSpeed, 3, 9),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
function roundStats(obj: Partial<SeedEnemy["stats"]>, rnd: () => number, tier: EnemyTier): SeedEnemy["stats"] {
  const def: SeedEnemy["stats"] = {
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    constitution: 0,
    physicalDefense: 0,
    magicalDefense: 0,
    luck: 0,
    endurance: 0,
  };
  const out: any = { ...def, ...obj };

  // Jitter de stats base leve (más en tiers altos)
  const J = tier === "rare" ? 0.08 : tier === "elite" ? 0.06 : 0.04;
  (Object.keys(out) as (keyof SeedEnemy["stats"])[]).forEach((k) => {
    out[k] = clamp(jitterInt(rnd, out[k], J), 0, 99);
  });
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

  const baseXP = 12 + level * 8;
  const baseGold = 6 + level * 3;

  const xp = Math.round(baseXP * tierMul * bossMul);
  const gold = Math.round(baseGold * tierMul * bossMul);

  return { xpReward: xp, goldReward: gold, xpMul: tierMul * bossMul, lootMul: tierMul * bossMul };
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de un enemigo

function buildEnemy(rnd: () => number, level: number, tier: EnemyTier, arche: ArchetypeKey, bossType?: BossType | null): SeedEnemy {
  const spec = ARCHETYPES[arche];

  // Base + growth determinista
  const base: any = { ...spec.base };
  Object.entries(spec.growth).forEach(([k, g]) => {
    base[k] = (base[k] || 0) + (g as number) * (level - 1);
  });

  const statMul = tier === "elite" ? 1.15 : tier === "rare" ? 1.35 : 1.0;
  const stats = roundStats(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, (v as number) * statMul])), rnd, tier);

  // Resistencias por nivel + tier
  const resistances = resistTemplate(level);
  if (tier === "elite" || tier === "rare") {
    (Object.keys(resistances) as (keyof SeedEnemy["resistances"])[]).forEach((k) => {
      resistances[k] = clamp(resistances[k] + (tier === "rare" ? 2 : 1), 0, 99);
    });
  }

  const combatStats = derivedCombat(level, arche, stats, rnd);

  const pickName = pick(rnd, spec.namePool);
  const suffix = level <= 3 ? "Débil" : level <= 6 ? "Curtido" : level <= 10 ? "Templado" : level <= 13 ? "Letal" : "Élite";
  const tierTag = tier === "rare" ? "Raro " : tier === "elite" ? "Élite " : "";
  const bossTag = bossType ? (bossType === "miniboss" ? " (Minijefe)" : bossType === "boss" ? " (Jefe)" : " (World Boss)") : "";
  const name = `${tierTag}${pickName} ${suffix}${bossTag}`;
  const imageUrl = spec.image;

  const dropProfile = computeDropProfile(level, arche, tier, bossType);
  const { xpReward, goldReward, xpMul, lootMul } = computeRewards(level, tier, bossType);

  // Mecánicas/ inmunidades simples (temas de flavor, sin romper balance)
  const baseMech: string[] =
    arche === "tank" ? ["shield-wall"] : arche === "mage" ? ["arcane-burst"] : arche === "rogue" ? ["bleed"] : arche === "beast" ? ["maul"] : arche === "archer" ? ["volley"] : ["crushing-blow"];

  const mechanics = bossType ? Array.from(new Set([...baseMech, "enrage"])) : baseMech;
  const immunities = bossType ? ["fear"] : [];

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
    mechanics,
    immunities,
    lootTierMultiplier: Number(lootMul.toFixed(2)),
    xpMultiplier: Number(xpMul.toFixed(2)),
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

  all.push(...generateEnemies(1, 15, 3, 20258));

  const miniLevels = [4, 8, 12];
  for (const lvl of miniLevels) {
    const rnd = mulberry32(8800 + lvl);
    const arche = pick(rnd, ["melee", "archer", "mage", "tank", "beast", "rogue"] as ArchetypeKey[]);
    const tier: EnemyTier = lvl >= 10 ? (rnd() < 0.4 ? "rare" : "elite") : "elite";
    all.push(buildEnemy(rnd, lvl, tier, arche, "miniboss"));
  }

  const bossLevels = [10, 15];
  for (const lvl of bossLevels) {
    const rnd = mulberry32(9900 + lvl);
    const arche = pick(rnd, ["tank", "melee", "mage"] as ArchetypeKey[]);
    const tier: EnemyTier = lvl >= 15 ? "rare" : "elite";
    all.push(buildEnemy(rnd, lvl, tier, arche, "boss"));
  }

  // Ajuste de longitud exacta
  if (all.length !== 50) {
    if (all.length > 50) all.splice(50);
    else {
      const rnd = mulberry32(123);
      while (all.length < 50) all.push(buildEnemy(rnd, 1, "common", "melee", null));
    }
  }

  // 🔒 Garantizar unicidad por (name, level, tier, bossType) para no chocar con el índice
  ensureUniqueNames(all);

  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardarraíl de unicidad de nombre por clave compuesta
function ensureUniqueNames(list: SeedEnemy[]) {
  const makeKey = (e: SeedEnemy) => `${e.name}|${e.level}|${e.tier}|${e.bossType ?? "null"}`;
  const seen = new Set<string>();

  for (const e of list) {
    const baseName = e.name;
    let suffixIndex = 1;
    let key = makeKey(e);

    while (seen.has(key)) {
      suffixIndex += 1;
      // Numeración romana para mantener flavor temático
      const roman = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"][suffixIndex - 1] ?? ` ${suffixIndex}`;
      e.name = baseName + roman;
      key = makeKey(e);
    }
    seen.add(key);
  }
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
      xp: e.xpReward,
      gold: e.goldReward,
    }))
  );
}
