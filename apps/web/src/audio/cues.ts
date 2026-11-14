/**
 * Fight sound cues on the one fight clock (fight-screen lane). The fight screen calls `advance`
 * once per frame with the clock time before and after `tick`. A cue sounds when playing time
 * crosses its `at`; a seek (skip, scrub, replay restart, the debug handle) moves the time and
 * plays nothing. Speed 2x only moves time faster: pitch and the cue list stay the same.
 */
import type { Cue } from "@rankzero/stage";
import { cuesBetween } from "@rankzero/stage";
import type { AudioEngine } from "./engine";

export interface CueSink { play(name: Cue["family"], variant: number): unknown }

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
      for (const c of due) sink.play(c.family, c.variant);
      return due;
    },
    seek() {
      // A seek plays no sound, by rule. Nothing is queued either: the next advance starts here.
    },
  };
}

export const engineSink = (engine: AudioEngine): CueSink => ({ play: (name, variant) => engine.play(name, variant) });
