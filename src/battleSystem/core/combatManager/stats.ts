// Lecturas y helpers de stats (puros/deterministas)
import { toPct, asInt, pct } from "../CombatMath";
import type { CombatSide, DamageFlavor, SideKey } from "../CombatTypes";
import { SHIELD_BLOCK_BONUS_PERCENT, CRIT_DEFAULT_CHANCE_PERCENT, CRIT_DEFAULT_BONUS_PERCENT, SHIELD_DR_BONUS_PERCENT, MAG_DEF_SOFTCAP, PHYS_DEF_SOFTCAP } from "../CombatConfig";
import { StatusEngine } from "../StatusEngine";

/** Devuelve chance de evadir (0..100) considerando pasiva activa. */
export function evasionPct(side: CombatSide, passive = true): number {
  const base = toPct(side.combat.evasion);
  const add = passive && side._passiveRuntime__?.active ? toPct(side._passiveRuntime__!.effects.evasionFlat) : 0;
  return pct(base + add);
}

/** Devuelve chance de bloquear (0..100), sumando escudo y pasiva si corresponden. */
export function blockPct(side: CombatSide, hasShield: boolean, passive = true): number {
  const base = toPct(side.combat.blockChance);
  const addPv = passive && side._passiveRuntime__?.active ? toPct(side._passiveRuntime__!.effects.blockChancePercent) : 0;
  const addSh = hasShield ? SHIELD_BLOCK_BONUS_PERCENT : 0;
  return pct(base + addPv + addSh);
}

/** Devuelve chance de crítico (0..100) incluyendo bonus por pasiva. */
export function critPct(side: CombatSide, passive = true): number {
  const base = toPct(side.combat.criticalChance || CRIT_DEFAULT_CHANCE_PERCENT);
  const add = passive && side._passiveRuntime__?.active ? toPct(side._passiveRuntime__!.effects.criticalChancePercent) : 0;
  return pct(base + add);
}

/** Devuelve el bonus de daño crítico efectivo (0..100). */
export function critBonusPct(side: CombatSide): number {
  const raw = side.combat.criticalDamageBonus;
  const asPercent = toPct(raw || CRIT_DEFAULT_BONUS_PERCENT);
  return pct(asPercent);
}

/** Poder mágico efectivo (flat), incluyendo bonus de pasiva si aplica. */
export function magicPower(side: CombatSide, passive = true): number {
  const base = asInt(side.combat.magicPower || 0);
  const add = passive && side._passiveRuntime__?.active ? asInt(side._passiveRuntime__!.effects.magicPowerFlat || 0) : 0;
  return Math.max(0, base + add);
}

/** Poder físico (attackPower) como entero ≥ 0. */
export function attackPower(side: CombatSide): number {
  return Math.max(0, asInt(side.combat.attackPower || 0));
}

/** Devuelve DR total (0..100) combinando DR propia, escudo y estados via StatusEngine. */
export function drPct(side: CombatSide, hasShield: boolean, SE: StatusEngine, owner: SideKey): number {
  const base = toPct(side.combat.damageReduction || 0);
  const sh = hasShield ? SHIELD_DR_BONUS_PERCENT : 0;
  const st = toPct(SE.extraDamageReduction(owner) * 100);
  return pct(base + sh + st);
}

/** Defensa física efectiva aplicando multiplicador del StatusEngine. */
export function physDefEff(side: CombatSide, SE: StatusEngine, owner: SideKey): number {
  const base = Math.max(0, asInt(side.stats?.physicalDefense || 0));
  const mul = SE.physDefMul(owner);
  const bonusPct = toPct((mul - 1) * 100);
  return Math.max(0, base + Math.floor((base * bonusPct) / 100));
}

/** Defensa mágica efectiva (entero ≥ 0). */
export function magDefEff(side: CombatSide): number {
  return Math.max(0, asInt(side.stats?.magicalDefense || 0));
}

/** Convierte una defensa en % de reducción usando softcap por flavor. */
export function defenseDRPercent(def: number, flavor: DamageFlavor): number {
  if (def <= 0) return 0;
  const cap = flavor === "magical" ? MAG_DEF_SOFTCAP : PHYS_DEF_SOFTCAP;
  return Math.floor((def * 100) / (def + cap));
}
