/* eslint-disable no-console */
import { Types } from "mongoose";
import { Character, type CharacterDoc } from "../models/Character";

/** Snapshot simple para devolver al front */
export type StaminaSnapshot = {
  stamina: number;
  staminaMax: number;
  usedRate: number; // puntos/hora efectivos usados para regenerar
  updatedAt: string; // ISO
  etaFullAt: string | null; // ISO o null si ya está lleno
};

/** utils básicos */
const isObjId = (s?: string) => !!s && Types.ObjectId.isValid(String(s));
const clampInt = (n: any, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(Number(n) || 0)));

/** Política de regen por defecto: “llenado total en 24h” */
const DEFAULT_FULL_REFILL_HOURS = 24;

/** Devuelve cuántos puntos regenera entre `from` y `to` según política configurada. */
function computeRegenAmount(doc: CharacterDoc, from: number, to: number): { regenPts: number; rateUsed: number } {
  const staminaMax = Math.max(1, Number(doc.staminaMax ?? 100));
  const current = clampInt(doc.stamina, 0, staminaMax);
  if (current >= staminaMax) return { regenPts: 0, rateUsed: Number(doc.staminaRegenPerHour ?? 0) };

  const hours = Math.max(0, (to - from) / 3600000);

  // Si configuraste una tasa explícita (>0), se usa esa.
  const perHour = Number(doc.staminaRegenPerHour ?? 0);
  if (perHour > 0) {
    return { regenPts: Math.floor(hours * perHour), rateUsed: perHour };
  }

  // Si no, usamos la política “full en 24h”
  const need = staminaMax - current;
  const rate = need / DEFAULT_FULL_REFILL_HOURS; // puntos/hora para alcanzar el lleno justo en 24h
  const regen = Math.floor(hours * rate);
  return { regenPts: regen, rateUsed: rate };
}

/** Aplica regen “perezosa” al documento (sin guardar). */
function applyLazyRegenToDoc(doc: CharacterDoc, now = Date.now()) {
  const last = new Date(doc.staminaUpdatedAt ?? doc.updatedAt ?? Date.now()).getTime();
  if (!Number.isFinite(last) || last <= 0) {
    doc.staminaUpdatedAt = new Date(now);
    return { changed: false, stamina: clampInt(doc.stamina, 0, doc.staminaMax), staminaMax: Number(doc.staminaMax ?? 100), usedRate: Number(doc.staminaRegenPerHour ?? 0) };
  }

  const { regenPts, rateUsed } = computeRegenAmount(doc, last, now);
  const sMax = Math.max(1, Number(doc.staminaMax ?? 100));
  const sNow = clampInt(doc.stamina, 0, sMax);
  const sNew = clampInt(sNow + regenPts, 0, sMax);

  if (sNew !== sNow) {
    doc.stamina = sNew;
    doc.staminaUpdatedAt = new Date(now);
    return { changed: true, stamina: sNew, staminaMax: sMax, usedRate: rateUsed };
  }

  // Aun sin sumar punto, actualizamos timestamp para no acumular drift
  doc.staminaUpdatedAt = new Date(now);
  return { changed: false, stamina: sNew, staminaMax: sMax, usedRate: rateUsed };
}

/** Calcula ETA (ms epoch) de llenado si sigue inactivo. */
function etaFullMs(stamina: number, staminaMax: number, perHour: number, now = Date.now()): number | null {
  if (stamina >= staminaMax) return null;
  const need = Math.max(0, staminaMax - stamina);
  const perMs = Math.max(perHour, 1e-12) / 3600000; // pts/ms
  const ms = Math.ceil(need / perMs);
  return now + ms;
}

/* ────────────────────────────────────────────────────────────────────
 * API pública del servicio
 * ──────────────────────────────────────────────────────────────────── */

/** Lee (y regenera perezoso) la stamina del personaje del usuario. */
export async function getStaminaByUserId(userId: string): Promise<StaminaSnapshot> {
  if (!isObjId(userId)) throw new Error("getStaminaByUserId: userId inválido");

  const ch = await Character.findOne({ userId: new Types.ObjectId(userId) });
  if (!ch) throw new Error("Character no encontrado para el usuario");

  const { staminaMax } = ch;
  const res = applyLazyRegenToDoc(ch, Date.now());
  // Guardamos sólo si cambió algo significativo (stamina o timetag)
  await ch.save();

  const perHourUsed = res.usedRate > 0 ? res.usedRate : Math.max(1, staminaMax - res.stamina) / DEFAULT_FULL_REFILL_HOURS;
  const eta = etaFullMs(res.stamina, staminaMax, perHourUsed);

  return {
    stamina: res.stamina,
    staminaMax,
    usedRate: perHourUsed,
    updatedAt: ch.staminaUpdatedAt.toISOString(),
    etaFullAt: eta ? new Date(eta).toISOString() : null,
  };
}

/** Intenta gastar stamina (con regen perezoso previo). */
export async function spendStamina(userId: string, amount: number): Promise<{ ok: true; after: StaminaSnapshot } | { ok: false; reason: "insufficient" | "not_found" }> {
  if (!isObjId(userId)) throw new Error("spendStamina: userId inválido");
  const cost = Math.max(0, Math.floor(amount || 0));

  const ch = await Character.findOne({ userId: new Types.ObjectId(userId) });
  if (!ch) return { ok: false, reason: "not_found" };

  const { staminaMax } = ch;
  const res = applyLazyRegenToDoc(ch, Date.now());

  if (res.stamina < cost) {
    // No gastamos; devolvemos snapshot actualizado
    return { ok: false, reason: "insufficient" };
  }

  ch.stamina = Math.max(0, res.stamina - cost);
  ch.staminaUpdatedAt = new Date(); // marca consumo
  await ch.save();

  const perHourUsed = res.usedRate > 0 ? res.usedRate : Math.max(1, staminaMax - ch.stamina) / DEFAULT_FULL_REFILL_HOURS;
  const eta = etaFullMs(ch.stamina, staminaMax, perHourUsed);

  return {
    ok: true,
    after: {
      stamina: ch.stamina,
      staminaMax,
      usedRate: perHourUsed,
      updatedAt: ch.staminaUpdatedAt.toISOString(),
      etaFullAt: eta ? new Date(eta).toISOString() : null,
    },
  };
}

/** Admin/Debug: setear stamina (clampeado) */
export async function setStamina(userId: string, value: number): Promise<StaminaSnapshot> {
  if (!isObjId(userId)) throw new Error("setStamina: userId inválido");
  const ch = await Character.findOne({ userId: new Types.ObjectId(userId) });
  if (!ch) throw new Error("Character no encontrado");

  const sMax = Math.max(1, Number(ch.staminaMax ?? 100));
  ch.stamina = clampInt(value, 0, sMax);
  ch.staminaUpdatedAt = new Date();
  await ch.save();

  const perHourUsed = Number(ch.staminaRegenPerHour ?? 0) > 0 ? Number(ch.staminaRegenPerHour) : Math.max(1, sMax - ch.stamina) / DEFAULT_FULL_REFILL_HOURS;
  const eta = etaFullMs(ch.stamina, sMax, perHourUsed);

  return {
    stamina: ch.stamina,
    staminaMax: sMax,
    usedRate: perHourUsed,
    updatedAt: ch.staminaUpdatedAt.toISOString(),
    etaFullAt: eta ? new Date(eta).toISOString() : null,
  };
}

/** NUEVO: recuperar stamina (poción, item, recompensa). Siempre clampea a staminaMax */
export async function recoverStamina(userId: string, amount: number): Promise<StaminaSnapshot> {
  if (!isObjId(userId)) throw new Error("recoverStamina: userId inválido");
  const gain = Math.max(0, Math.floor(amount || 0));

  const ch = await Character.findOne({ userId: new Types.ObjectId(userId) });
  if (!ch) throw new Error("Character no encontrado");

  const { staminaMax } = ch;
  const res = applyLazyRegenToDoc(ch, Date.now());

  // sumamos y CLAMPEAMOS
  ch.stamina = clampInt(res.stamina + gain, 0, staminaMax);
  ch.staminaUpdatedAt = new Date();
  await ch.save();

  const perHourUsed = res.usedRate > 0 ? res.usedRate : Math.max(1, staminaMax - ch.stamina) / DEFAULT_FULL_REFILL_HOURS;
  const eta = etaFullMs(ch.stamina, staminaMax, perHourUsed);

  return {
    stamina: ch.stamina,
    staminaMax,
    usedRate: perHourUsed,
    updatedAt: ch.staminaUpdatedAt.toISOString(),
    etaFullAt: eta ? new Date(eta).toISOString() : null,
  };
}
