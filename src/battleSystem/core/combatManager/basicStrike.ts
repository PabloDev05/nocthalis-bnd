import { isPrimaryWeapon, rollMainWeapon, rollOffhand } from "../CombatWeapons";
import { attackFlavor, elementKey, isRanged, weaponCategory } from "../CombatFlavor";
import { asInt, roll100 } from "../CombatMath";
import { BLOCK_REDUCTION_PERCENT } from "../CombatConfig";
import { magDefEff, physDefEff, defenseDRPercent, evasionPct, blockPct, drPct, magicPower, attackPower, critPct, critBonusPct } from "./stats";
import { applyMitigation } from "./mitigation";
import type { AttackOutput, CombatEvent, CombatSide, DamageFlavor, SideKey } from "../CombatTypes";
import { StatusEngine } from "../StatusEngine";
import { pushPassiveEvent } from "./passives";

/** Resuelve un ataque básico (miss → block/crit → mitigaciones) y emite eventos detallados. */
export function performBasicStrike(A: CombatSide, attackerKey: SideKey, D: CombatSide, defenderKey: SideKey, SE: StatusEngine, rng: () => number, events: CombatEvent[]): AttackOutput {
  const flavor: DamageFlavor = attackFlavor(A);

  // Miss por confusión
  if (SE.confusionMiss(attackerKey)) {
    events.push({ type: "miss", actor: attackerKey });
    return { damage: 0, flags: { miss: true } };
  }

  // Evasión
  if (roll100(rng) <= evasionPct(D, true)) {
    events.push({ type: "miss", actor: defenderKey });
    return { damage: 0, flags: { miss: true } };
  }

  // ¿Block?
  const defHasShield = weaponCategory(D.weaponOff) === "shield";
  const blocked = roll100(rng) <= blockPct(D, defHasShield, true);
  const blockReducedPercent = blocked ? BLOCK_REDUCTION_PERCENT : 0;

  // ¿Crítico?
  const isCrit = roll100(rng) <= critPct(A, true);

  // Daño base
  const mainRoll = rollMainWeapon(rng, A.weaponMain, isPrimaryWeapon(A.weaponMain, A.classMeta?.primaryWeapons));
  const offRollPart = rollOffhand(rng, A.weaponOff);
  const baseStat = flavor === "magical" ? magicPower(A, true) : attackPower(A);

  // Bonus por pasiva (si aplica)
  let passiveBonus = 0;
  if (A._passiveRuntime__?.active && A._passiveRuntime__?.remainingTurns > 0) {
    if (A.passiveDefaultSkill?.damageType === flavor) passiveBonus = Math.max(0, asInt(A._passiveRuntime__?.bonusDamage || 0));
  }

  let raw = mainRoll + offRollPart + baseStat + passiveBonus;

  // Defensa y elemento
  const def = flavor === "magical" ? magDefEff(D) : physDefEff(D, SE, defenderKey);
  const defDR = defenseDRPercent(def, flavor);
  const elemK = elementKey(A, flavor);
  const elemRes = elemK ? Math.max(0, Math.min(100, D.resistances?.[elemK] || 0)) : 0;

  // Crítico y DR plana
  const critBonus = isCrit ? critBonusPct(A) : 0;
  const dr = drPct(D, defHasShield, SE, defenderKey);

  // Mitigación total
  const mit = applyMitigation({
    flavor,
    raw,
    defenseDRPercent: defDR,
    elementResPercent: elemRes,
    critBonusPercent: critBonus,
    blockReducedPercent,
    drReducedPercent: dr,
  });

  // Evento 'block' (si bloqueó) con números útiles
  if (blocked) {
    events.push({
      type: "block",
      actor: defenderKey, // quien bloquea
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

  // Evento 'crit' SOLO si hubo crítico
  if (isCrit) {
    events.push({ type: "crit", actor: attackerKey } as any);
  }

  // Evento 'hit' con breakdown
  events.push({
    type: "hit",
    actor: attackerKey,
    flavor,
    vfx: isCrit ? "basic-crit" : "basic-hit",
    damage: {
      final: mit.final,
      breakdown: {
        mainRoll,
        offRoll: offRollPart,
        baseStat,
        passiveBonus,
        defenseFactor: mit.factors.defenseFactor,
        elementFactor: elemK ? mit.factors.elementFactor : undefined,
        critBonusPercent: mit.factors.critBonusPercent,
        blockReducedPercent: mit.factors.blockReducedPercent,
        drReducedPercent: mit.factors.drReducedPercent,
        preBlock: mit.preBlock,
        blockedAmount: mit.blockedAmount,
      },
    },
  });

  // Pasivas (fate/pity ya dentro de pushPassiveEvent)
  const fateA = asInt(A.baseStats?.fate || 0);
  const fateD = asInt(D.baseStats?.fate || 0);
  if (A.passiveDefaultSkill?.enabled) {
    const t = A.passiveDefaultSkill.trigger.check;
    if ((flavor === "magical" && t === "onSpellCast") || (flavor === "physical" && t === "onBasicHit") || (isRanged(A) && t === "onRangedHit") || t === "onHitOrBeingHit") {
      pushPassiveEvent(attackerKey, A, fateA, t, events, rng);
    }
  }
  if (D.passiveDefaultSkill?.enabled && D.passiveDefaultSkill.trigger.check === "onHitOrBeingHit") {
    pushPassiveEvent(defenderKey, D, fateD, "onHitOrBeingHit", events, rng);
  }

  return { damage: mit.final, flags: { miss: false, blocked, crit: isCrit } };
}
