import { CombatManager } from "../../classes/combat/CombatManager";

const DEBUG_PVP = false;

export type TimelineEvent = "hit" | "crit" | "block" | "miss";

export interface TimelineEntry {
  turn: number;
  actor: "attacker" | "defender"; // POV del ATACANTE
  damage: number;
  attackerHP: number; // HP del atacante DESPUÉS del golpe
  defenderHP: number; // HP del defensor DESPUÉS del golpe
  event: TimelineEvent;
}

export interface PvpFightResult {
  outcome: "win" | "lose" | "draw";
  turns: number;
  timeline: TimelineEntry[];
  log: string[];
  snapshots: Array<{
    round: number;
    actor: "player" | "enemy";
    damage: number;
    playerHP: number;
    enemyHP: number;
    events: string[];
    status?: Record<string, any>;
  }>;
}

/* ───────────── utils num ───────────── */
function seededXorShift(seed0: number) {
  let x = seed0 | 0 || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000; // 0..1
  };
}
function i(n: any, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}
function clampInt(n: any, min: number, max: number) {
  const v = Math.round(i(n, min));
  return Math.max(min, Math.min(max, v));
}
const toNum = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pctToFrac = (v: any) => {
  const n = toNum(v, 0);
  return n > 1 ? n / 100 : n < 0 ? 0 : n;
};
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/* ───────────── arma por clase / snapshot ───────────── */
function inferWeaponByClass(className?: string): string {
  const c = (className || "").toLowerCase();
  if (c.includes("guerrero")) return "basic_sword";
  if (c.includes("mago")) return "basic_staff";
  if (c.includes("asesino")) return "basic_dagger";
  if (c.includes("arquero")) return "basic_bow";
  return "fists";
}
function pickWeaponSlug(raw: any): string {
  // prioridad: snapshot.weapon.slug → snapshot.weapon → equipment.weapon.slug → equipment.mainHand.slug → por clase
  const slug = raw?.weapon?.slug ?? raw?.weapon ?? raw?.equipment?.weapon?.slug ?? raw?.equipment?.mainHand?.slug ?? inferWeaponByClass(raw?.className ?? raw?.class?.name);
  return String(slug || "fists")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* ───────────── pasiva por snapshot/clase (solo nombre) ───────────── */
function getPassiveName(raw: any): string | null {
  return raw?.class?.passiveDefault?.name ?? raw?.passiveDefault?.name ?? null;
}
function flagsToEvent(flags: { miss?: boolean; crit?: boolean; blocked?: boolean }): TimelineEvent {
  if (flags?.miss) return "miss";
  if (flags?.blocked) return "block";
  if (flags?.crit) return "crit";
  return "hit";
}

/* políticas de “marcado” (no alteran daño, solo eventos) */
function shouldTagPassiveOnAttack(className?: string, flags?: { crit?: boolean }): boolean {
  const c = (className || "").toLowerCase();
  if (c.includes("asesino")) return !!flags?.crit; // Sombra Letal: marca solo en crit
  if (c.includes("mago")) return true; // Llama Interna: marca siempre al atacar
  if (c.includes("arquero")) return true; // Ojo del Águila: marca siempre al atacar
  return false;
}
function shouldTagPassiveOnDefense(className?: string, flags?: { blocked?: boolean }): boolean {
  const c = (className || "").toLowerCase();
  if (c.includes("guerrero")) return !!flags?.blocked; // Espíritu de Guardia: marca cuando bloquea
  return false;
}

/* ───────────── normalización a Manager ───────────── */
function toCMEntity(raw: any) {
  const csRaw = raw?.combat ?? raw?.combatStats ?? {};

  const combatNorm = {
    attackPower: toNum(csRaw.attackPower, 5),
    magicPower: toNum(csRaw.magicPower, 0),
    evasion: clamp01(pctToFrac(csRaw.evasion)),
    blockChance: clamp01(pctToFrac(csRaw.blockChance)),
    damageReduction: clamp01(pctToFrac(csRaw.damageReduction)),
    criticalChance: clamp01(pctToFrac(csRaw.criticalChance)),
    criticalDamageBonus: Math.max(0, pctToFrac(csRaw.criticalDamageBonus ?? 0.5)),
    attackSpeed: Math.max(0.1, toNum(csRaw.attackSpeed, 1)),
    maxHP: toNum(csRaw.maxHP ?? raw?.maxHP, 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  return {
    name: raw?.name ?? raw?.username ?? "—",
    className: raw?.className ?? raw?.class?.name ?? undefined,
    stats: raw?.stats ?? {},
    resistances: raw?.resistances ?? {},
    equipment: raw?.equipment ?? {},
    maxHP,
    currentHP,
    combat: combatNorm,
    combatStats: combatNorm,
    __weapon: pickWeaponSlug(raw), // ← arma resuelta
    __passiveName: getPassiveName(raw),
  };
}

/* ───────────── Simulación PvP ───────────── */
export function runPvpWithManager({ attackerSnapshot, defenderSnapshot, seed, maxRounds = 30 }: { attackerSnapshot: any; defenderSnapshot: any; seed: number; maxRounds?: number }): PvpFightResult {
  const rng = seededXorShift(seed);
  const attacker = toCMEntity(attackerSnapshot);
  const defender = toCMEntity(defenderSnapshot);

  if (DEBUG_PVP) {
    console.log("[PVP] A.combat =", attacker.combat);
    console.log("[PVP] D.combat =", defender.combat);
    console.log("[PVP] A HP =", attacker.currentHP, "/", attacker.maxHP);
    console.log("[PVP] D HP =", defender.currentHP, "/", defender.maxHP);
  }

  const cm = new CombatManager(attacker, defender, { rng, damageJitter: 0.15 });

  const timeline: TimelineEntry[] = [];
  const log: string[] = [];
  const snapshots: PvpFightResult["snapshots"] = [];

  for (let turn = 1; turn <= maxRounds; turn++) {
    cm.startRound(turn, () => {});
    const isAtkTurn = turn % 2 === 1;
    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    const entry: TimelineEntry = {
      turn,
      actor: isAtkTurn ? "attacker" : "defender",
      damage: i(out.damage, 0),
      attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
      defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
      event: flagsToEvent(out.flags),
    };
    timeline.push(entry);

    // Log humano
    if (isAtkTurn) {
      const tgt = defenderSnapshot?.name ?? "Defensor";
      const hp = entry.defenderHP;
      const mhp = defender.maxHP;
      log.push(
        out.flags?.miss
          ? `El atacante falla contra ${tgt}. (${hp}/${mhp} HP)`
          : out.flags?.blocked
          ? `Bloqueo de ${tgt}. Daño ${entry.damage}. (${hp}/${mhp} HP)`
          : out.flags?.crit
          ? `¡Crítico! El atacante golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
          : `El atacante golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
      );
    } else {
      const tgt = attackerSnapshot?.name ?? "Atacante";
      const hp = entry.attackerHP;
      const mhp = attacker.maxHP;
      log.push(
        out.flags?.miss
          ? `El defensor falla contra ${tgt}. (${hp}/${mhp} HP)`
          : out.flags?.blocked
          ? `Bloqueo de ${tgt}. Daño ${entry.damage}. (${hp}/${mhp} HP)`
          : out.flags?.crit
          ? `¡Crítico! El defensor golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
          : `El defensor golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
      );
    }

    // Snapshot por golpe (para animaciones + "pasiva")
    const actorSide = isAtkTurn ? "player" : "enemy";
    const atkEntity = isAtkTurn ? attacker : defender;
    const defEntity = isAtkTurn ? defender : attacker;

    const events: string[] = [];
    if (out.flags?.crit) events.push(`${actorSide}:crit`);
    events.push(`${actorSide}:attack`);
    events.push(`${actorSide}:weapon:${atkEntity.__weapon || "fists"}`);
    if (out.flags?.miss) {
      events.push(`${actorSide}:miss`);
    } else {
      if (out.flags?.blocked) events.push(`${actorSide}:blocked`); // “el ataque fue bloqueado”
      events.push(`${actorSide}:hit`);
      events.push(`${actorSide}:hit:physical`);
    }

    // Marca de pasiva del ATACANTE (mago/arquero en todos los ataques, asesino solo en crit)
    if (shouldTagPassiveOnAttack(atkEntity.className, out.flags) && atkEntity.__passiveName) {
      events.push(`${actorSide}:passive:${atkEntity.__passiveName}`);
    }
    // Marca de pasiva del DEFENSOR (guerrero cuando bloquea)
    if (shouldTagPassiveOnDefense(defEntity.className, out.flags) && defEntity.__passiveName) {
      const defSide = actorSide === "player" ? "enemy" : "player";
      events.push(`${defSide}:passive:${defEntity.__passiveName}`);
    }

    snapshots.push({
      round: turn,
      actor: actorSide,
      damage: entry.damage,
      playerHP: entry.attackerHP,
      enemyHP: entry.defenderHP,
      events,
      status: {},
    });

    if (cm.isCombatOver()) break;
  }

  // ganador desde la perspectiva del atacante
  let w = cm.getWinner(); // "player" | "enemy" | null
  if (!w) {
    const aHP = clampInt((cm as any).player?.currentHP, 0, attacker.maxHP);
    const dHP = clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP);
    const diff = aHP - dHP;
    const thr = Math.max(1, Math.round(0.01 * (aHP + dHP + 1)));
    if (Math.abs(diff) <= thr) w = null;
    else w = diff > 0 ? "player" : "enemy";
  }
  const outcome: "win" | "lose" | "draw" = !w ? "draw" : w === "player" ? "win" : "lose";

  return { outcome, turns: timeline.length, timeline, log, snapshots };
}
