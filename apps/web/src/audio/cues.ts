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

export interface CueSink { play(cue: Cue): unknown }

export interface CueDriver {
  /** The clock played from `from` to `to`. Returns the cues sounded, in order. */
  advance(from: number, to: number): Cue[];
  /** The clock jumped. No sound. */
  seek(to: number): void;
}

export function createCueDriver(cues: readonly Cue[], sink: CueSink): CueDriver {
  return {
    advance(from, to) {
      const due = cuesBetween(cues, from, to);
      for (const c of due) sink.play(c);
      return due;
    },
    seek() {
      // A seek plays no sound, by rule. Nothing is queued either: the next advance starts here.
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
  play: (cue) => {
    const s = soundFor(cue, (name) => engine.size(name));
    return s !== null && engine.play(s.name, s.variant);
  },
});
