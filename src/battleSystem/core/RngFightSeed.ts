/* eslint-disable no-console */
export type Rng = () => number;

/** Hash 32-bit simple (FNV-1a) para semillar desde strings. */
export function hash32(str: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32: RNG rápido, determinístico en [0,1). */
export function mulberry32(seed: number, opts?: { debug?: boolean }): Rng {
  const debug = !!opts?.debug;
  const s = seed >>> 0;               // fuerza a uint32
  if (debug) console.log("[RNG] mulberry32 seed:", s);
  let t = s || 1;                     // si seed=0 y no queremos secuencia 0, usar 1
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crea un RNG desde string (id de match, etc.). */
export function rngFromString(s: string, opts?: { debug?: boolean }): Rng {
  return mulberry32(hash32(s), opts);
}

/** Entero en [min, max] inclusive. */
export function rollInt(rng: Rng, min: number, max: number): number {
  const lo = Math.floor(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  // evitar sesgo con +1 y floor
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Dado un RNG, devuelve 1..100 (int). */
export function roll100(rng: Rng): number {
  return 1 + Math.floor(rng() * 100);
}

/** ¿Ocurre un evento con `percent`%? (acepta 0..100) */
export function chance(rng: Rng, percent: number): boolean {
  return rng() < Math.max(0, Math.min(100, percent)) / 100;
}

/** Elección ponderada. Devuelve null si vacío o pesos no positivos. */
export function pickWeighted<T>(rng: Rng, items: Array<{ item: T; weight: number }>): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, it.weight || 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight || 0);
    if (r <= 0) return it.item;
  }
  return items[items.length - 1]?.item ?? null;
}

/** Deriva N RNGs hijos consumiendo el padre (útil para sub-sistemas). */
export function splitRng(parent: Rng, n: number): Rng[] {
  const out: Rng[] = [];
  for (let i = 0; i < n; i++) {
    // consumir el padre para derivar semillas hijas
    const seed = Math.floor(parent() * 0xffffffff) >>> 0;
    out.push(mulberry32(seed));
  }
  return out;
}
