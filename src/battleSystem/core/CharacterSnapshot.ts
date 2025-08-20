// src/services/characterSnapshot.ts
// Construye un snapshot autocontenido para guardar en Match.
// NO cambia tu lógica de combate: acá NO convertimos %→fracción.
// El CombatManager/runner hará las conversiones que necesite.

export type CharacterSnapshot = {
  // ---- Requeridos por Match ----
  userId: any; // ObjectId o string
  characterId: any; // ObjectId o string
  username: string; // visible en UI
  className: string; // visible en UI
  weapon: string; // slug para animaciones: p.ej. "basic_bow"

  // ---- Datos visibles / auxiliares ----
  name: string;
  level: number;

  // ---- Números base (se copian tal cual) ----
  stats: Record<string, number>;
  resistances: Record<string, number>;
  equipment: Record<string, unknown>;

  // ---- HP redundante ----
  maxHP: number;
  currentHP: number;

  // ---- Bloque de combate (TAL CUAL está en el personaje) ----
  // Si tus combatStats traen porcentajes (12.9, 5, 15.7, etc),
  // se guardan así; el runner los normaliza después.
  combat: {
    attackPower: number;
    magicPower: number;
    evasion: number; // puede venir 12.9 si así lo guardás
    blockChance: number; // idem
    damageReduction: number; // idem
    criticalChance: number; // idem
    criticalDamageBonus: number; // puede venir 41.4 (=+41.4%) o 0.5 (=+50%) según tu modelo
    attackSpeed: number;
    maxHP?: number; // redundante
  };

  // Por compat con código que mira "combatStats" en vez de "combat"
  combatStats: CharacterSnapshot["combat"];

  // ---- Opcional: metadata de clase/pasiva (para UI/runner) ----
  class?: { name: string; passiveDefault?: { name: string; description?: string } | null };
  passiveDefault?: { name: string; description?: string } | null; // espejo conveniente
};

// ───────────────────────────────────────────────────────────────────────────────
// Helpers mínimos (sin conversiones de %)
// ───────────────────────────────────────────────────────────────────────────────

const toNum = (v: any, d = 0) => {
  if (typeof v === "string") {
    const s = v.replace?.("%", "").replace?.(",", ".") ?? v;
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const clampInt = (v: any, min: number, max: number) => {
  const n = Math.round(toNum(v, min));
  return Math.max(min, Math.min(max, n));
};

const toSlug = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "";

// Fallback de arma por clase
const inferWeaponByClass = (className?: string): string => {
  const c = (className || "").toLowerCase();
  if (c.includes("guerrero")) return "basic_sword";
  if (c.includes("mago")) return "basic_staff";
  if (c.includes("asesino")) return "basic_dagger";
  if (c.includes("arquero")) return "basic_bow";
  return "fists";
};

// Selección de arma (slug) desde snapshot/equipo → fallback por clase
function pickWeaponSlug(character: any, className?: string): string {
  const slug =
    character?.weapon?.slug ??
    character?.weapon ?? // si ya viene seteado como string
    character?.equipment?.weapon?.slug ??
    character?.equipment?.mainHand?.slug ??
    character?.equipment?.weaponName ??
    character?.equipment?.weapon?.name ??
    (character?.equipment?.weaponId ? `weapon#${character.equipment.weaponId}` : null);

  const resolved = slug ? toSlug(slug) : inferWeaponByClass(className);
  return resolved || inferWeaponByClass(className);
}

// ───────────────────────────────────────────────────────────────────────────────
// Builder (pasa TODO tal cual; solo asegura que HP sea válido y arma por defecto)
// ───────────────────────────────────────────────────────────────────────────────

export function buildCharacterSnapshot(character: any): CharacterSnapshot {
  // Ids / identidad
  const userId = character?.userId ?? character?.user?._id ?? character?.user?.id;
  const characterId = character?._id ?? character?.id;
  const username = character?.username ?? character?.user?.username ?? character?.user?.name ?? "—";
  const name = character?.name ?? username ?? "—";

  const className = character?.className ?? character?.class?.name ?? "—";
  const level = toNum(character?.level, 1);

  // Pasiva por defecto (si viene en la clase del doc)
  const passiveDefault = character?.class?.passiveDefault ?? character?.passiveDefault ?? null;

  // Arma (slug): equipo → snapshot → por clase
  const weapon = pickWeaponSlug(character, className);

  // Combat de origen (copiamos TAL CUAL esté en el personaje)
  const srcCombat = character?.combatStats ?? character?.combat ?? {};
  const combat = {
    attackPower: toNum(srcCombat.attackPower, 0),
    magicPower: toNum(srcCombat.magicPower, 0),
    // IMPORTANTÍSIMO: NO convertimos aquí.
    evasion: toNum(srcCombat.evasion, 0),
    blockChance: toNum(srcCombat.blockChance, 0),
    damageReduction: toNum(srcCombat.damageReduction, 0),
    criticalChance: toNum(srcCombat.criticalChance, 0),
    // Puede venir 41.4 (=+41.4%) o 0.5 (=+50%); el runner lo normaliza
    criticalDamageBonus: toNum(srcCombat.criticalDamageBonus, 0.5),
    attackSpeed: toNum(srcCombat.attackSpeed, 1),
    maxHP: toNum(srcCombat.maxHP ?? character?.maxHP, 100),
  };

  // HP coherente (inicia al 100%)
  const maxHP = clampInt(character?.maxHP ?? combat.maxHP, 1, 10_000_000);
  const currentHP = clampInt(character?.currentHP ?? maxHP, 0, maxHP);

  // Copias planas de stats/resist/equipment
  const stats = { ...(character?.stats ?? {}) } as Record<string, number>;
  const resistances = { ...(character?.resistances ?? {}) } as Record<string, number>;
  const equipment = { ...(character?.equipment ?? {}) } as Record<string, unknown>;

  // Ensamblar snapshot
  const snap: CharacterSnapshot = {
    userId,
    characterId,
    username,
    className,
    weapon,

    name,
    level,

    stats,
    resistances,
    equipment,

    maxHP,
    currentHP,

    combat,
    combatStats: combat, // espejo por compat

    // metadata de clase/pasiva (opcional; útil para UI y runner)
    class: { name: className, passiveDefault },
    passiveDefault,
  };

  return snap;
}
