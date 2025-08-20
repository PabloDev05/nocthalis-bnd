export type WeaponCategory = "weapon" | "shield" | "focus";
export type WeaponDamageType = "physical" | "magic";

export interface WeaponData {
  slug: string; // ej: "basic_sword"
  minDamage: number; // daño mínimo del item (entero)
  maxDamage: number; // daño máximo del item (entero)
  type: WeaponDamageType; // tipo de daño base
  category?: WeaponCategory; // por defecto "weapon"
  hands?: 1 | 2; // opcional
}

export function rollWeaponDamage(rng: () => number, w: WeaponData): number {
  if (!w) return 1;
  const min = Math.max(0, Math.floor(w.minDamage));
  const max = Math.max(min, Math.floor(w.maxDamage));
  const span = max - min + 1;
  const r = Math.floor(rng() * span);
  return min + r; // entero
}
