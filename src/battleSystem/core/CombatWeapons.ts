// Funciones para tirar daño de armas (principal y secundaria).
// Usadas por CombatManager, pero también pueden ser útiles en otros módulos.
import type { WeaponData } from "./Weapon";
import { asInt } from "./CombatMath";
import { PRIMARY_WEAPON_BONUS_MULT, isPrimaryWeapon } from "./Weapon";
import { OFFHAND_FOCUS_CONTRIB_PERCENT, OFFHAND_WEAPON_CONTRIB_PERCENT } from "./CombatConfig";
import { weaponCategory } from "./CombatFlavor";

export function rollMainWeapon(rng: () => number, w?: WeaponData | null, isPrimary = false): number {
  if (!w) return 0;
  const lo = Math.max(0, asInt((w as any).minDamage || 0));
  const hi = Math.max(lo, asInt((w as any).maxDamage || 0));
  const base = hi <= lo ? lo : lo + asInt(rng() * (hi - lo + 1));
  const mult = isPrimary ? PRIMARY_WEAPON_BONUS_MULT : 1;
  return Math.floor(base * mult);
}

export function rollOffhand(rng: () => number, off?: WeaponData | null): number {
  if (!off) return 0;
  const cat = weaponCategory(off);
  const lo = Math.max(0, asInt((off as any).minDamage || 0));
  const hi = Math.max(lo, asInt((off as any).maxDamage || 0));
  const base = hi <= lo ? lo : lo + asInt(rng() * (hi - lo + 1));
  if (cat === "weapon") return Math.floor((base * OFFHAND_WEAPON_CONTRIB_PERCENT) / 100);
  if (cat === "focus") return Math.floor((base * OFFHAND_FOCUS_CONTRIB_PERCENT) / 100);
  return 0;
}

export { isPrimaryWeapon };
