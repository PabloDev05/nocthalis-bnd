export const asInt = (n: number) => Math.trunc(Number(n) || 0);
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, asInt(v)));
export const pct = (x: number) => clamp(x, 0, 100);

export const toPct = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1 && n >= 0) return clamp(n * 100, 0, 100);
  return pct(n);
};

export const roll100 = (rng: () => number) => Math.floor(rng() * 100) + 1;
