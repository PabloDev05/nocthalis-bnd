import { asInt, roll100 } from "../CombatMath";
import { BLOCK_REDUCTION_PERCENT, ULT_COOLDOWN_TURNS, ULT_DAMAGE_MAIN_MULT, ULT_DAMAGE_WEAPON_PART, ULT_EXTRA_FLAT, ULT_PITY_AFTER_FAILS, DEBUG_PROC } from "../CombatConfig";
import { magDefEff, physDefEff, defenseDRPercent, evasionPct, blockPct, drPct, magicPower, attackPower } from "./stats";
import { attackFlavor, elementKey, weaponCategory } from "../CombatFlavor";
import { applyMitigation } from "./mitigation";
import { STATUS_CATALOG, isStatusKey, type StatusKey } from "../../constants/status";
import type { AttackOutput, CombatEvent, CombatSide, DamageFlavor, SideKey, UltimateRuntime, UltimateEffects } from "../CombatTypes";
import { ultimateChance } from "../CombatProcs";
import { StatusEngine } from "../StatusEngine";

/** Intenta castear ultimate (chance + pity + cooldown) y, si procede, resuelve el golpe. */
export function tryUltimate(A: CombatSide, attackerKey: SideKey, defenderKey: SideKey, D: CombatSide, SE: StatusEngine, rng: () => number, events: CombatEvent[]): AttackOutput | null {
  const runtime = A._ultimateRuntime__ as UltimateRuntime;
  const cfg = A.ultimateSkill;

  if (!cfg?.enabled || !cfg.proc?.enabled) return null;
  if (cfg.proc.respectCooldown && runtime.cooldown > 0) {
    runtime.failStreak++;
    return null;
  }
  if (SE.silenced(attackerKey)) {
    runtime.failStreak++;
    return null;
  }

  const fate = asInt(A.baseStats?.fate || 0);
  const chance = ultimateChance(fate);
  const roll = roll100(rng);
  let forced = false;

  if (roll > chance) {
    runtime.failStreak++;
    if (runtime.failStreak >= ULT_PITY_AFTER_FAILS) forced = true;
    else return null;
  }

  runtime.cooldown = Math.max(1, ULT_COOLDOWN_TURNS);
  runtime.failStreak = 0;

  events.push({
    type: "ultimate_cast",
    actor: attackerKey,
    name: cfg.name,
    chance,
    roll,
    forcedByPity: forced,
  });

  const out = performUltimateStrike(A, attackerKey, D, defenderKey, SE, rng, events, cfg.effects);
  if (DEBUG_PROC && out) console.debug("[ULT HIT]", A.name, "dmg=", out.damage);
  return out;
}

/** Resuelve la ultimate (miss → block → mitigaciones) y aplica debuffs si define. */
export function performUltimateStrike(
  A: CombatSide,
  attackerKey: SideKey,
  D: CombatSide,
  defenderKey: SideKey,
  SE: StatusEngine,
  rng: () => number,
  events: CombatEvent[],
  eff?: UltimateEffects
): AttackOutput {
  // Miss por evasión
  const ev = evasionPct(D, true);
  if (roll100(rng) <= ev) {
    events.push({ type: "miss", actor: attackerKey });
    return { damage: 0, flags: { miss: true } };
  }

  // ¿Block?
  const defHasShield = weaponCategory(D.weaponOff) === "shield";
  const blocked = roll100(rng) <= blockPct(D, defHasShield, true);
  const blockReducedPercent = blocked ? BLOCK_REDUCTION_PERCENT : 0;

  // Base de daño (stat fuerte + parte de arma)
  const flavor: DamageFlavor = attackFlavor(A);
  const baseStat = flavor === "magical" ? magicPower(A, true) : attackPower(A);
  const w = A.weaponMain;
  const weaponAvg = w ? Math.floor((asInt((w as any).minDamage || 0) + asInt((w as any).maxDamage || 0)) / 2) : 1;
  const raw = baseStat * ULT_DAMAGE_MAIN_MULT + weaponAvg * ULT_DAMAGE_WEAPON_PART + ULT_EXTRA_FLAT;

  // Mitigación
  const def = flavor === "magical" ? magDefEff(D) : physDefEff(D, SE, defenderKey);
  const defDR = defenseDRPercent(def, flavor);
  const elemK = elementKey(A, flavor);
  const elemRes = elemK ? Math.max(0, Math.min(100, D.resistances?.[elemK] || 0)) : 0;
  const dr = drPct(D, defHasShield, SE, defenderKey);

  const mit = applyMitigation({
    flavor,
    raw,
    defenseDRPercent: defDR,
    elementResPercent: elemRes,
    critBonusPercent: 0,
    blockReducedPercent: blockReducedPercent,
    drReducedPercent: dr,
  });

  // Evento 'block' con números útiles (si bloqueó)
  if (blocked) {
    events.push({
      type: "block",
      actor: defenderKey,
      blockedAmount: mit.blockedAmount,
      preBlock: mit.preBlock,
      blockReducedPercent,
      finalAfterBlock: mit.preBlock - mit.blockedAmount,
      finalAfterDR: mit.final,
    } as any);
  }

  // Aplicar daño
  D.currentHP = Math.max(0, D.currentHP - mit.final);
  if (mit.final > 0) SE.wakeIfDamaged(defenderKey);

  // Evento de golpe
  events.push({
    type: "hit",
    actor: attackerKey,
    flavor,
    vfx: "ultimate-hit",
    damage: {
      final: mit.final,
      breakdown: {
        mainRoll: 0,
        offRoll: 0,
        baseStat,
        passiveBonus: 0,
        defenseFactor: mit.factors.defenseFactor,
        elementFactor: elemK ? mit.factors.elementFactor : undefined,
        critBonusPercent: 0,
        blockReducedPercent: mit.factors.blockReducedPercent,
        drReducedPercent: mit.factors.drReducedPercent,
        preBlock: mit.preBlock,
        blockedAmount: mit.blockedAmount,
        ultimateDamage: baseStat * ULT_DAMAGE_MAIN_MULT,
      },
    },
  });

  // Debuff de ulti (si define)
  if (eff?.applyDebuff) {
    const key = eff.applyDebuff as unknown as StatusKey;
    const baseDur = isStatusKey(key) ? STATUS_CATALOG[key]?.baseDuration ?? 1 : 1;
    const dur = Math.max(1, asInt(eff.debuffDurationTurns ?? baseDur));
    const val = Math.max(0, asInt(eff.debuffValue ?? 0));
    const dot = eff.applyDebuff === "bleed" ? Math.max(0, asInt(eff.bleedDamagePerTurn ?? 0)) : undefined;

    SE.tryApply({
      to: defenderKey,
      key,
      duration: dur,
      stacks: 1,
      value: eff.applyDebuff === "bleed" ? undefined : val,
      dotDamage: dot,
      baseChance: 100,
      source: attackerKey,
      pushEvent: () => {},
    });
  }

  return { damage: mit.final, flags: { miss: false, blocked, crit: false } };
}
