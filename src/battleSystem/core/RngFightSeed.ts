/* eslint-disable no-console */
const DBG = process.env.DEBUG_COMBAT === "1";

/** Mulberry32: RNG simple, rápido, determinístico en [0,1) */
export function mulberry32(seed: number) {
  if (DBG) console.log("[RNG] Creando RNG con seed:", seed);
  let t = seed >>> 0 || 1;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
