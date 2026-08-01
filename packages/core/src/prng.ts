/**
 * Deterministic PRNG for the AGOGE combat sim.
 * Canon (04-technical-architecture.md §3): mulberry32, one seeded stream per
 * fight, every random decision drawn from it in a fixed order.
 */

export type PRNGFn = () => number;

/** mulberry32 — 32-bit seeded generator, returns floats in [0, 1). */
export function mulberry32(seed: number): PRNGFn {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit string hash — used to derive seeds from names and keys. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine several numbers/strings into one 32-bit seed. */
export function combineSeed(...parts: Array<number | string>): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = typeof p === "number" ? p.toString(36) : p;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Convenience wrapper: integer helpers over a mulberry32 stream. */
export interface Rng {
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Integer in [min, max] inclusive. */
  roll(min: number, max: number): number;
  /** True with `chance`% probability (integer percent). */
  pct(chance: number): boolean;
  /** Pick one element. */
  pick<T>(arr: readonly T[]): T;
  /** Raw float in [0,1) — avoid in sim logic; prefer integer helpers. */
  raw(): number;
}

export function makeRng(seed: number): Rng {
  const f = mulberry32(seed);
  return {
    int: (maxExclusive) => Math.floor(f() * maxExclusive),
    roll: (min, max) => min + Math.floor(f() * (max - min + 1)),
    pct: (chance) => Math.floor(f() * 100) < chance,
    pick: (arr) => arr[Math.floor(f() * arr.length)]!,
    raw: f,
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
