/**
 * Fight sound cues on the one fight clock (fight-screen lane). The fight screen calls `advance`
 * once per frame with the clock time before and after `tick`. A cue sounds when playing time
 * crosses its `at`; a seek (skip, scrub, replay restart, the debug handle) moves the time and
 * plays nothing. Speed 2x only moves time faster: pitch and the cue list stay the same.
 *
 * Which sound a cue makes follows what made it (stage contract rev 3, `Cue.item` and `Cue.on`):
 * the item's own set from soundMap.ts, else the family's set.
 */
import type { Cue } from "@rankzero/stage";
import { cuesBetween, realAt } from "@rankzero/stage";
import type { AudioEngine } from "./engine";
import { intensityFromHp } from "./music";
import { itemSet } from "./soundMap";

/** `delayMs`: how long after now (real ms) the cue's moment comes; 0 or absent is now. */
export interface CueSink { play(cue: Cue, delayMs?: number): unknown }

/** How the fight clock maps presentation time to real time: its speed and its holds (clock.ts: a
 *  Move's span plays at 1x at any speed). */
export interface ClockMap { speed: number; holds: readonly (readonly [number, number])[] }

export interface CueDriver {
  /** The clock played from `from` to `to`. Returns the cues sounded, in order. With `aheadMs`
   *  (clock ms, usually the frame just played) the cues the clock will reach during the next frame
   *  are started now, each scheduled at its own moment (sound review, owner on the recorded fight: a
   *  cue sounded on the first frame after the clock passed it, up to a frame late, every time).
   *  `rate` is a number (the clock's speed over that frame: `(at - to) / rate` real ms ahead) or the
   *  clock's own map (`realAt(at) - realAt(to)`, so a cue just inside a 1x hold at 3x is not played
   *  at the 3x rate, 67 ms early: round-2 close). */
  advance(from: number, to: number, aheadMs?: number, rate?: number | ClockMap): Cue[];
  /** The clock jumped. No sound. */
  seek(to: number): void;
}

export function createCueDriver(cues: readonly Cue[], sink: CueSink): CueDriver {
  // the clock time up to which cues have been started (some of them scheduled ahead)
  let started = -Infinity;
  return {
    advance(from, to, aheadMs = 0, rate = 1) {
      const lo = Math.max(from, started);
      const hi = to + Math.max(0, aheadMs);
      const due = hi > lo ? cuesBetween(cues, lo, hi) : [];
      const delay = (at: number): number => {
        if (at <= to) return 0;
        if (typeof rate === "number") return rate > 0 ? (at - to) / rate : 0;
        return Math.max(0, realAt(at, rate.speed, rate.holds) - realAt(to, rate.speed, rate.holds));
      };
      for (const c of due) sink.play(c, delay(c.at));
      started = Math.max(started, hi);
      return due;
    },
    seek() {
      // A seek plays no sound, by rule. Nothing is queued either: the next advance starts here.
      started = -Infinity;
    },
  };
}

/** The set and the sound in it that a cue plays, given how many sounds each set has now. The
 *  pick mixes the cue's seeded variant with its step, so repeats of one item vary but a replay
 *  of the same bout sounds the same. */
export function soundFor(cue: Cue, size: (name: string) => number): { name: string; variant: number } | null {
  const pick = cue.variant + cue.step;
  const own = itemSet(cue);
  if (own !== null) {
    const n = size(own);
    if (n > 0) return { name: own, variant: pick % n };
  }
  const n = size(cue.family);
  return n > 0 ? { name: cue.family, variant: pick % n } : null;
}

/** The knockout blow: the heavy layer (`accent`) under the kill step's impact. */
export const isKnockout = (cue: Cue, killStep: number): boolean => killStep >= 0 && cue.accent === true && cue.step === killStep;

/** When the knockout lands on the fight clock (Infinity when the bout has none). */
export function knockoutAt(cues: readonly Cue[], killStep: number): number {
  for (const c of cues) if (isKnockout(c, killStep)) return c.at;
  return Infinity;
}

/** The music scene and intensity at fight time `t` (plan 13.17): the fight loops until the
 *  knockout, then "post" (the loops fade out under the ko sting). Intensity follows the lower HP of
 *  the two scrappers (`a0`, `b0`). A seek back before the knockout is a fight again. */
export function fightMusicAt(t: number, koAt: number, hp: Partial<Record<string, { now: number; max: number }>>): { scene: "fight" | "post"; intensity: number } {
  const fr: number[] = [];
  for (const id of ["a0", "b0"]) {
    const h = hp[id];
    if (h && h.max > 0) fr.push(Math.max(0, h.now) / h.max);
  }
  return { scene: t >= koAt ? "post" : "fight", intensity: intensityFromHp(fr) };
}

/** Plays each cue's sound; with `killStep`, the knockout blow also plays the music's ko sting. */
export const engineSink = (engine: AudioEngine, killStep = -1): CueSink => ({
  play: (cue, delayMs) => {
    if (isKnockout(cue, killStep)) engine.sting("ko");
    const s = soundFor(cue, (name) => engine.size(name));
    return s !== null && engine.play(s.name, s.variant, delayMs);
  },
});
