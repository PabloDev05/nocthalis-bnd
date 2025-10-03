// Pipeline de mitigación. Devuelve daño final y breakdown listo para el evento.
import { pct, asInt } from "../CombatMath";
import type { DamageFlavor } from "../CombatTypes";

export type MitigationInput = {
  flavor: DamageFlavor;
  raw: number;
  defenseDRPercent: number; // 0..100
  elementResPercent?: number; // 0..100
  critBonusPercent?: number; // 0..100
  blockReducedPercent?: number; // 0..100
  drReducedPercent?: number; // 0..100  (DR plana stackeada al final)
};

export type MitigationResult = {
  final: number;
  preBlock: number;
  blockedAmount: number;
  factors: {
    defenseFactor: number; // 100 - defenseDRPercent
    elementFactor?: number; // 100 - elemRes
    critBonusPercent: number;
    blockReducedPercent: number;
    drReducedPercent: number;
  };
};

export function applyMitigation(m: MitigationInput): MitigationResult {
  let dmg = asInt(m.raw);

  // Defensa softcap
  if (m.defenseDRPercent > 0) dmg = Math.floor((dmg * (100 - m.defenseDRPercent)) / 100);

  // Resistencia elemental
  if ((m.elementResPercent ?? 0) > 0) dmg = Math.floor((dmg * (100 - (m.elementResPercent as number))) / 100);

  // Crítico
  if ((m.critBonusPercent ?? 0) > 0) dmg = Math.floor((dmg * (100 + (m.critBonusPercent as number))) / 100);

  const preBlock = dmg;

  // Block
  if ((m.blockReducedPercent ?? 0) > 0) dmg = Math.floor((dmg * (100 - (m.blockReducedPercent as number))) / 100);
  const blockedAmount = Math.max(0, preBlock - dmg);

  // DR plana
  if ((m.drReducedPercent ?? 0) > 0) dmg = Math.floor((dmg * (100 - (m.drReducedPercent as number))) / 100);

  return {
    final: Math.max(0, asInt(dmg)),
    preBlock,
    blockedAmount,
    factors: {
      defenseFactor: 100 - m.defenseDRPercent,
      elementFactor: m.elementResPercent != null ? 100 - (m.elementResPercent as number) : undefined,
      critBonusPercent: m.critBonusPercent ?? 0,
      blockReducedPercent: m.blockReducedPercent ?? 0,
      drReducedPercent: m.drReducedPercent ?? 0,
    },
  };
}
