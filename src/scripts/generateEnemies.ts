// Genera enemigos por nivel + arquetipo + rareza (tier), con RNG determinístico (mulberry32)
export type EnemyDoc = {
  name: string;
  level: number;
  tier: "common" | "elite" | "rare";
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
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

type ArchetypeKey = "melee" | "archer" | "mage" | "tank" | "beast" | "rogue";

const ARCHETYPES: Record<
  ArchetypeKey,
  {
    base: Partial<EnemyDoc["stats"]>;
    growth: Partial<EnemyDoc["stats"]>;
    namePool: string[];
    image: string;
  }
> = {
  melee: {
    base: { strength: 6, vitality: 6, physicalDefense: 4, endurance: 5, dexterity: 4, agility: 4, luck: 2, intelligence: 2, magicalDefense: 2, wisdom: 2 },
    growth: { strength: 1.4 as any, vitality: 1.3 as any, physicalDefense: 0.8 as any, endurance: 0.9 as any, dexterity: 0.6 as any },
    namePool: ["Bandido", "Matón", "Bruto", "Mercenario", "Espadachín"],
    image: "/assets/enemies/melee.png",
  },
  archer: {
    base: { dexterity: 7, agility: 6, luck: 3, strength: 4, vitality: 4, physicalDefense: 3, intelligence: 3, magicalDefense: 2, wisdom: 2 },
    growth: { dexterity: 1.3 as any, agility: 1.1 as any, luck: 0.5 as any, strength: 0.5 as any },
    namePool: ["Arquero", "Tirador", "Cazador", "Vigía", "Carroñero"],
    image: "/assets/enemies/archer.png",
  },
  mage: {
    base: { intelligence: 8, wisdom: 6, magicalDefense: 5, vitality: 4, dexterity: 3, agility: 3, luck: 3, strength: 2, physicalDefense: 2, endurance: 3 },
    growth: { intelligence: 1.5 as any, wisdom: 1.2 as any, magicalDefense: 0.9 as any, vitality: 0.5 as any },
    namePool: ["Acolito", "Cultista", "Hechicero", "Brujo", "Chamán"],
    image: "/assets/enemies/mage.png",
  },
  tank: {
    base: { vitality: 9, physicalDefense: 7, endurance: 7, strength: 5, magicalDefense: 4, agility: 2, dexterity: 3, luck: 2, intelligence: 2, wisdom: 2 },
    growth: { vitality: 1.8 as any, physicalDefense: 1.2 as any, endurance: 1.2 as any, strength: 1.0 as any, magicalDefense: 0.6 as any },
    namePool: ["Guardia", "Caballero", "Vigilante", "Rompehuesos", "Gólem"],
    image: "/assets/enemies/tank.png",
  },
  beast: {
    base: { strength: 7, agility: 8, vitality: 6, physicalDefense: 4, endurance: 4, dexterity: 4, luck: 2, intelligence: 1, magicalDefense: 2, wisdom: 1 },
    growth: { agility: 1.4 as any, strength: 1.2 as any, vitality: 1.1 as any, physicalDefense: 0.6 as any },
    namePool: ["Lobo", "Jabalí", "Saurio", "Hiena", "Raptor"],
    image: "/assets/enemies/beast.png",
  },
  rogue: {
    base: { dexterity: 7, agility: 8, luck: 4, strength: 4, vitality: 4, physicalDefense: 3, intelligence: 2, magicalDefense: 2, endurance: 3, wisdom: 2 },
    growth: { dexterity: 1.3 as any, agility: 1.3 as any, luck: 0.6 as any, strength: 0.5 as any },
    namePool: ["Ratero", "Asaltante", "Acechador", "Cuchillero", "Sombrío"],
    image: "/assets/enemies/rogue.png",
  },
};

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

function buildName(rnd: () => number, arche: ArchetypeKey, level: number, tier: EnemyDoc["tier"]) {
  const pool = ARCHETYPES[arche].namePool;
  const pick = pool[Math.floor(rnd() * pool.length)];
  const suffixLevel = level <= 3 ? "Débil" : level <= 6 ? "Curtido" : level <= 10 ? "Templado" : level <= 13 ? "Letal" : "Élite";
  const prefixTier = tier === "rare" ? "Raro " : tier === "elite" ? "Élite " : "";
  return `${prefixTier}${pick} ${suffixLevel}`;
}

function tierFor(rnd: () => number): EnemyDoc["tier"] {
  // distribución: 70% common, 25% elite, 5% rare
  const x = rnd();
  if (x < 0.05) return "rare";
  if (x < 0.3) return "elite";
  return "common";
}

function applyTierMultipliers(tier: EnemyDoc["tier"], stats: EnemyDoc["stats"], combat: EnemyDoc["combatStats"], resist: EnemyDoc["resistances"]) {
  const statMul = tier === "rare" ? 1.35 : tier === "elite" ? 1.2 : 1.0;
  const combatMul = tier === "rare" ? 1.35 : tier === "elite" ? 1.2 : 1.0;
  const resistBonus = tier === "rare" ? 2 : tier === "elite" ? 1 : 0;

  (Object.keys(stats) as (keyof EnemyDoc["stats"])[]).forEach((k) => (stats[k] = clamp(stats[k] * statMul, 0, 99)));
  (Object.keys(combat) as (keyof EnemyDoc["combatStats"])[]).forEach((k) => (combat[k] = clamp(combat[k] * combatMul, 0, 9999)));
  // resistencias pequeñas suben con tier
  (Object.keys(resist) as (keyof EnemyDoc["resistances"])[]).forEach((k) => (resist[k] = clamp(resist[k] + resistBonus, 0, 99)));
}

function derivedCombat(level: number, arche: ArchetypeKey, stats: EnemyDoc["stats"]) {
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

function roundStats(obj: Partial<EnemyDoc["stats"]>): EnemyDoc["stats"] {
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

export function generateEnemies(levelFrom: number, levelTo: number, perLevel: number, seed: number = 12345): EnemyDoc[] {
  const rnd = mulberry32(seed + levelFrom * 9973 + levelTo);
  const types: ArchetypeKey[] = ["melee", "archer", "mage", "tank", "beast", "rogue"];
  const enemies: EnemyDoc[] = [];

  for (let lvl = levelFrom; lvl <= levelTo; lvl++) {
    for (let i = 0; i < perLevel; i++) {
      const arche = types[Math.floor(rnd() * types.length)];
      const tier = tierFor(rnd); // ← define rareza
      const spec = ARCHETYPES[arche];

      // stats = base + growth * (lvl - 1)
      const base = { ...spec.base } as any;
      Object.entries(spec.growth).forEach(([k, g]) => {
        base[k] = (base[k] || 0) + (g as number) * (lvl - 1);
      });

      const stats = roundStats(base);
      const resistances = resistTemplate(lvl);
      const combatStats = derivedCombat(lvl, arche, stats);

      // aplicar multiplicadores por rareza
      applyTierMultipliers(tier, stats, combatStats, resistances);

      const name = buildName(rnd, arche, lvl, tier);
      const imageUrl = spec.image;

      enemies.push({ name, level: lvl, tier, stats, resistances, combatStats, imageUrl });
    }
  }
  return enemies;
}

export function buildSeedEnemies(): EnemyDoc[] {
  return [...generateEnemies(1, 5, 2, 20251), ...generateEnemies(6, 10, 2, 20252), ...generateEnemies(11, 15, 2, 20253)];
}

if (require.main === module) {
  const all = buildSeedEnemies();
  console.log(`Generados ${all.length} enemigos`);
  console.log(all.slice(0, 5));
}
