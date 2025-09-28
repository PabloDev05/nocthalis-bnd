// Determina si un arma es cuerpo a cuerpo o a distancia, y el sabor de daño (físico/mágico) según la clase.
import type { CombatSide } from "./CombatTypes";
import type { WeaponData } from "./Weapon";

export function weaponCategory(w?: WeaponData | null) {
  return (w?.category ?? "weapon").toString().toLowerCase();
}

export function isRanged(side: CombatSide): boolean {
  const clsRanged = (side.className || "").toLowerCase() === "revenant";
  const slug = (side.weaponMain?.slug || "").toLowerCase();
  const cat = weaponCategory(side.weaponMain);
  const rangedSlug = /bow|crossbow|rifle|gun|pistol|arquebus|flintlock|handcannon/.test(slug);
  return clsRanged || rangedSlug || cat === "ranged";
}

export type DamageFlavor = "physical" | "magical";

export function attackFlavor(side: CombatSide): DamageFlavor {
  const c = (side.className || "").toLowerCase();
  return c === "necromancer" || c === "exorcist" ? "magical" : "physical";
}

export function elementKey(side: CombatSide, flavor: DamageFlavor): "holy" | "dark" | null {
  if (flavor !== "magical") return null;
  const cls = (side.className || "").toLowerCase();
  if (cls === "exorcist") return "holy";
  if (cls === "necromancer") return "dark";
  return null;
}
