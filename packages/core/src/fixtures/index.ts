/**
 * FROZEN FIXTURES (work package 0). Import from "@rankzero/core/fixtures".
 * Lanes build and test against these before the sim exists. They are typed against the
 * contract and checked by the reducer and by `checkLog` in the contract tests.
 */
import type { FighterSnapshot } from "../contracts/fighter";
import type { BoutLog } from "../contracts/log";
import { allStepsA, allStepsB, boutAllSteps } from "./bout-all-steps";
import { boutGate } from "./bout-gate";
import { SNAPSHOTS, l1Knife, l1Pipe } from "./snapshots";

export * from "./snapshots";
export { boutGate } from "./bout-gate";
export { allStepsA, allStepsB, boutAllSteps } from "./bout-all-steps";

export type BoutFixtureName = "bout-gate" | "bout-all-steps";
/** A log with its two snapshots, ready for `createFightPlayer(log, a, b, rig, opts)`. */
export interface BoutFixture { name: BoutFixtureName; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot }

/** By name, as the debug route reads it: #/debug/bout?fixture=bout-gate */
export const BOUT_FIXTURES: Readonly<Record<BoutFixtureName, BoutFixture>> = {
  "bout-gate": { name: "bout-gate", log: boutGate, a: l1Pipe, b: l1Knife },
  "bout-all-steps": { name: "bout-all-steps", log: boutAllSteps, a: allStepsA, b: allStepsB },
};

/** Fixtures are shared by every test in a process, so they are frozen all the way down.
 *  A test that needs a changed copy clones first: JSON.parse(JSON.stringify(log)). */
function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const inner of Object.values(value)) deepFreeze(inner);
}
deepFreeze(BOUT_FIXTURES);
deepFreeze(SNAPSHOTS);
