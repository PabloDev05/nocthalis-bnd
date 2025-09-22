/* eslint-disable no-console */
// src/services/stamina.service.ts
import { Types } from "mongoose";
import { Character, type CharacterDoc } from "../models/Character";

export type StaminaSnapshot = {
  stamina: number;
  staminaMax: number;
  usedRate: number;    // puntos por hora usados para calcular la ETA
  updatedAt: string;   // ISO
  etaFullAt: string | null;
};

const DEFAULT_MAX = 100;
const DEFAULT_FULL_REFILL_HOURS = 24; // llena 100 → ~4.1667 por hora

export const STAMINA_COST = {
  pvp: 10,
  pve: 6,
  arena: 5,
  dungeon: 8,
  ultimate: 2,
} as const;
export type StaminaAction = keyof typeof STAMINA_COST;

/* utils */
const isObjId = (s: string) => !!s && Types.ObjectId.isValid(String(s));
const clampInt = (n: any, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(Number(n) || 0)));

function perHourRate(doc: CharacterDoc) {
  const max = Math.max(1, Number(doc.staminaMax ?? DEFAULT_MAX));
  const explicit = Number(doc.staminaRegenPerHour ?? 0);
  return explicit > 0 ? explicit : max / DEFAULT_FULL_REFILL_HOURS;
}

function computeRegenAmount(
  doc: CharacterDoc,
  from: number,
  to: number
): { regenPts: number; rateUsed: number } {
  const max = Math.max(1, Number(doc.staminaMax ?? DEFAULT_MAX));
  const cur = clampInt(doc.stamina, 0, max);
  if (cur >= max) return { regenPts: 0, rateUsed: perHourRate(doc) };

  const hours = Math.max(0, (to - from) / 3600000);
  const rate = perHourRate(doc);
  return { regenPts: Math.floor(hours * rate), rateUsed: rate };
}

async function loadByUserId(userId: string) {
  if (isObjId(userId)) {
    return (
      (await Character.findOne({ userId: new Types.ObjectId(userId) })) ||
      (await Character.findById(userId))
    );
  }
  return await Character.findOne({ userId });
}

/** GET snapshot con regen perezosa */
export async function getStaminaByUserId(userId: string): Promise<StaminaSnapshot> {
  const doc = await loadByUserId(userId);
  if (!doc) {
    const nowIso = new Date().toISOString();
    return { stamina: 0, staminaMax: DEFAULT_MAX, usedRate: 0, updatedAt: nowIso, etaFullAt: null };
  }

  const now = Date.now();
  const max = Math.max(1, Number(doc.staminaMax ?? DEFAULT_MAX));
  const last = Number(new Date(doc.staminaUpdatedAt ?? doc.updatedAt ?? doc.createdAt).getTime());
  const cur = clampInt(doc.stamina, 0, max);

  const { regenPts, rateUsed } = computeRegenAmount(doc, last, now);
  const next = Math.min(max, cur + Math.max(0, regenPts));
  if (next !== cur) {
    doc.stamina = next;
    doc.staminaUpdatedAt = new Date(now);
    await doc.save();
  }

  let etaFullAt: string | null = null;
  const rate = rateUsed || perHourRate(doc);
  if (next < max && rate > 0) {
    const hoursLeft = (max - next) / rate;
    etaFullAt = new Date(now + hoursLeft * 3600000).toISOString();
  }

  return {
    stamina: next,
    staminaMax: max,
    usedRate: rate,
    updatedAt: (doc.staminaUpdatedAt ?? new Date(now)).toISOString(),
    etaFullAt,
  };
}

/** Gasta una cantidad fija */
export async function spendStamina(userId: string, amount: number) {
  const doc = await loadByUserId(userId);
  if (!doc) return { ok: false as const, reason: "not_found" as const };

  // Aplica regen antes de gastar
  await getStaminaByUserId(userId);

  const max = Math.max(1, Number(doc.staminaMax ?? DEFAULT_MAX));
  const cur = clampInt(doc.stamina, 0, max);
  if (cur < amount) return { ok: false as const, reason: "insufficient" as const };

  doc.stamina = cur - amount;
  doc.staminaUpdatedAt = new Date();
  await doc.save();

  return {
    ok: true as const,
    after: {
      stamina: doc.stamina,
      staminaMax: max,
      usedRate: perHourRate(doc),
      updatedAt: (doc.staminaUpdatedAt ?? new Date()).toISOString(),
      etaFullAt: null,
    },
  };
}

/** Gasta según acción (“pvp”, “arena”, etc.) */
export async function spendForAction(userId: string, action: StaminaAction) {
  const cost = STAMINA_COST[action];
  return spendStamina(userId, cost);
}

/** Setter admin/debug */
export async function setStamina(userId: string, value: number): Promise<StaminaSnapshot> {
  const doc = await loadByUserId(userId);
  if (!doc) {
    const nowIso = new Date().toISOString();
    return { stamina: 0, staminaMax: DEFAULT_MAX, usedRate: 0, updatedAt: nowIso, etaFullAt: null };
  }
  const max = Math.max(1, Number(doc.staminaMax ?? DEFAULT_MAX));
  doc.stamina = clampInt(value, 0, max);
  doc.staminaUpdatedAt = new Date();
  await doc.save();

  return {
    stamina: doc.stamina,
    staminaMax: max,
    usedRate: perHourRate(doc),
    updatedAt: (doc.staminaUpdatedAt ?? new Date()).toISOString(),
    etaFullAt: doc.stamina >= max ? null : null,
  };
}
