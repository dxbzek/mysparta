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
import { cuesBetween } from "@rankzero/stage";
import type { AudioEngine } from "./engine";
import { itemSet } from "./soundMap";

/** `delayMs`: how long after now (real ms) the cue's moment comes; 0 or absent is now. */
export interface CueSink { play(cue: Cue, delayMs?: number): unknown }

export interface CueDriver {
  /** The clock played from `from` to `to`. Returns the cues sounded, in order. With `aheadMs`
   *  (clock ms, usually the frame just played) the cues the clock will reach during the next frame
   *  are started now, each scheduled `(at - to) / rate` real ms ahead at its own moment (sound
   *  review, owner on the recorded fight: a cue sounded on the first frame after the clock passed
   *  it, up to a frame late, every time). `rate` is the clock's speed over that frame. */
  advance(from: number, to: number, aheadMs?: number, rate?: number): Cue[];
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
      for (const c of due) sink.play(c, c.at > to && rate > 0 ? (c.at - to) / rate : 0);
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

export const engineSink = (engine: AudioEngine): CueSink => ({
  play: (cue, delayMs) => {
    const s = soundFor(cue, (name) => engine.size(name));
    return s !== null && engine.play(s.name, s.variant, delayMs);
  },
});
