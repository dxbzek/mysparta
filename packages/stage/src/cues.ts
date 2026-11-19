/**
 * Sound cues (brief 3.13). Every cue is a time on the fight clock; the host plays each cue whose
 * `at` the clock crossed this frame, and a seek plays none. The variation inside a family comes
 * from the cosmetic seed, never a time. At most one impact cue in any 60 ms.
 */
import type { Cue, SfxFamily } from "./contracts";
import { SFX_VARIANTS } from "./contracts";
import { SOUND } from "./tuning";

/** A cheap stable hash to 0..1, for cosmetic choices only. */
export function noise(seed: number, a: number, b = 0): number {
  let h = (seed | 0) ^ Math.imul((a | 0) + 0x632be5ab, 0x9e3779b1) ^ Math.imul((b | 0) + 0x85ebca6b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const FAMILY_SALT: Readonly<Record<SfxFamily, number>> = {
  fist: 1, blunt: 2, blade: 3, block: 4, whoosh: 5, dash: 6, landing: 7, throw: 8,
  drop: 9, crowd: 10, companion: 11, move: 12, win: 13, loss: 14, swing: 15,
};

export function pickVariant(seed: number, step: number, family: SfxFamily, n = 0): number {
  const count = SFX_VARIANTS[family];
  return Math.floor(noise(seed, step * 16 + n, FAMILY_SALT[family]) * count) % count;
}

export const IMPACT_FAMILIES: ReadonlySet<SfxFamily> = new Set<SfxFamily>(["fist", "blunt", "blade", "block"]);

/** Sorted by time; an impact cue closer than 60 ms to the impact cue kept before it is dropped. */
export function finishCues(list: readonly Cue[]): Cue[] {
  const sorted = [...list].sort((p, q) => (p.at !== q.at ? p.at - q.at : p.step - q.step));
  const out: Cue[] = [];
  let lastImpact = -Infinity;
  for (const c of sorted) {
    if (IMPACT_FAMILIES.has(c.family)) {
      if (c.at - lastImpact < SOUND.impactGapMs) continue;
      lastImpact = c.at;
    }
    out.push(c);
  }
  return out;
}

/** The cues a host plays when the clock moves from `from` to `to` by playing (not by a seek):
 *  every cue with from < at <= to. A cue at exactly 0 plays on the first frame (from < 0). */
export function cuesBetween(cues: readonly Cue[], from: number, to: number): Cue[] {
  if (!(to > from)) return [];
  return cues.filter((c) => c.at > from && c.at <= to);
}
