/**
 * Test helpers (work package 1): hand-built snapshots, scripted random streams and a bout set up
 * without running it, so a rule can be tested with chosen rolls.
 */
import type { FighterSnapshot, Look, StatKey } from "../src/contracts/fighter";
import type { PerkId } from "../src/contracts/ids";
import type { Bout } from "../src/sim/bout";
import { OPENING_TURNS } from "../src/sim/bout";
import { buildSide } from "../src/sim/combatant";
import type { Actor } from "../src/sim/combatant";
import type { Stream, StreamName, Streams } from "../src/sim/rng";
import { STREAM_NAMES } from "../src/sim/rng";

export const LOOK: Look = { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0,
  skin: 0, hairColor: 0, palette: 0 };

export function snap(perks: PerkId[], o: { level?: number; points?: Partial<Record<StatKey, number>>;
  mult?: Partial<Record<StatKey, number>>; id?: string } = {}): FighterSnapshot {
  return {
    id: o.id ?? "test", name: "Test", look: LOOK, level: o.level ?? 10,
    stats: {
      // Content v3: Toughness 0 (no soak, no grip) and Precision 3 (Aim 4, Crit 4: the old base of
      // 5 and 5 within a point), so a hand-built test kit fights as it did unless a test says.
      points: { health: 5, strength: 5, agility: 5, speed: 5, toughness: 0, precision: 3, ...o.points },
      mult: { health: 100, strength: 100, agility: 100, speed: 100, toughness: 100, precision: 100, ...o.mult },
    },
    perks, rulesVersion: 1,
  };
}

/** A stream that answers with a function of n and the call count. */
export function fn(f: (n: number, i: number) => number): Stream {
  let i = 0;
  return { int: (n) => { const v = f(n, i); i += 1; return v < 0 ? 0 : v >= n ? n - 1 : v; } };
}
/** A stream that answers a queue of values, then `rest`. */
export function queue(values: number[], rest: (n: number) => number = (n) => n - 1): Stream {
  let i = 0;
  return { int: (n) => { const v = i < values.length ? values[i]! : rest(n); i += 1; return v < 0 ? 0 : v >= n ? n - 1 : v; } };
}
/** Every stream answers n - 1 (every chance roll fails), unless given. */
export function scripted(over: Partial<Record<StreamName, Stream>> = {}): Streams {
  const out = {} as Record<StreamName, Stream>;
  for (const name of STREAM_NAMES) out[name] = over[name] ?? fn((n) => n - 1);
  return out;
}

/** A bout set up with both sides and no steps yet, at the first turn after the opening, so a rule
 *  test sees the plain rule (the opening's cut has tests of its own). */
export function setup(a: FighterSnapshot, b: FighterSnapshot, r: Streams = scripted()): { bout: Bout; A: Actor; B: Actor } {
  const sa = buildSide("a", a);
  const sb = buildSide("b", b);
  const actors = [...sa.actors, ...sb.actors];
  const bout: Bout = { r, actors, bag: { a: sa.bag, b: sb.bag }, steps: [], turn: OPENING_TURNS + 1, ended: false,
    shown: new Set(), lastTag: -1e6, owed: new Set() };
  // Mid-bout: the sure first draw of a bout (combatant.ts) is over.
  for (const x of actors) x.startDraw = false;
  return { bout, A: sa.actors[0]!, B: sb.actors[0]! };
}
