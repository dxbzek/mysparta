/**
 * Named random sub-streams of a bout (work package 1). Each system draws from its own stream, so a
 * roll added to one system never shifts the numbers another system sees. Every stream is seeded
 * from the bout seed and its name. Cosmetic randomness is not here: the stage seeds its own.
 */
import { combineSeed, makeRng } from "../prng";

export const STREAM_NAMES = ["clock", "tie", "move", "draw", "throw", "target", "hit", "disarm", "damage"] as const;
export type StreamName = (typeof STREAM_NAMES)[number];

/** A whole-number source: int(n) is 0 to n - 1. */
export interface Stream { int(n: number): number }
export type Streams = Readonly<Record<StreamName, Stream>>;

export function boutStreams(seed: number): Streams {
  const out = {} as Record<StreamName, Stream>;
  for (const name of STREAM_NAMES) {
    const rng = makeRng(combineSeed(seed, "bout", name));
    out[name] = { int: (n) => rng.int(n) };
  }
  return out;
}

/** roll(a..b): a whole number from a to b inclusive. */
export function roll(s: Stream, a: number, b: number): number {
  return a + s.int(b - a + 1);
}
