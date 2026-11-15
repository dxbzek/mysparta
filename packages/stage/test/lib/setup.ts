/** Shared setup for the stage tests: options, players for the fixtures, and small readers. */
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { stageFor } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import type { BoutFixtureName } from "@rankzero/core/fixtures";
import type { Rig } from "@rankzero/rig";
import { capsuleGateRig, capsuleRig } from "@rankzero/rig/testing";
import type { PlayerOpts } from "../../src/contracts";
import { buildPlayer } from "../../src/createFightPlayer";
import type { StagePlayer } from "../../src/createFightPlayer";
import type { Internal } from "../../src/timeline";

export const FIXTURE_NAMES: readonly BoutFixtureName[] = ["bout-gate", "bout-all-steps", "bout-cap"];
export const RIGS: Readonly<Record<"capsule" | "capsule-gate", Rig>> = { capsule: capsuleRig, "capsule-gate": capsuleGateRig };

export function optsFor(log: BoutLog, reduced = false, cosmeticSeed = 7): PlayerOpts {
  return {
    reducedMotion: reduced, cosmeticSeed, stage: stageFor(log.seed),
    text: { fight: "FIGHT", wins: (n) => `${n} WINS`, block: "BLOCK", miss: "MISS", crit: "CRIT", overtime: "OVERTIME",
      moveName: (id) => `move:${id}`, skillName: (id) => `skill:${id}`, moveResult: (id, part) => (part === "pet" ? `fled:${id}` : `result:${id}`) },
    fonts: { display: "sans-serif", body: "sans-serif" },
  };
}

const cache = new Map<string, StagePlayer>();
/** A player for a fixture; cached, since a player is pure and built once. */
export function fixturePlayer(name: BoutFixtureName, rig: keyof typeof RIGS = "capsule", reduced = false, internal?: Internal): StagePlayer {
  const key = `${name}|${rig}|${reduced}`;
  if (internal === undefined) {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
  }
  const fx = BOUT_FIXTURES[name];
  const p = buildPlayer(fx.log, fx.a, fx.b, RIGS[rig], optsFor(fx.log, reduced), internal);
  if (internal === undefined) cache.set(key, p);
  return p;
}

export function playerFor(log: BoutLog, a: FighterSnapshot, b: FighterSnapshot, rig: Rig = capsuleRig, reduced = false,
  internal?: Internal): StagePlayer {
  return buildPlayer(log, a, b, rig, optsFor(log, reduced), internal);
}

/** Sample times from `from` to `to` every `step` ms. */
export function times(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let t = from; t <= to; t += step) out.push(t);
  return out;
}
