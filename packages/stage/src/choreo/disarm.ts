/** Disarm: the weapon flies up out of the hand in an arc for 450 ms, lands and stays on the
 *  floor. Resisted (Firm Grip): the tag shows and the weapon stays in the hand. */
import type { StepOf } from "@rankzero/core";
import { skillTag } from "../effects";
import type { Builder } from "../timeline";
import { OUTCOME } from "../tuning";
import type { Placed } from "./index";
import { dropOnFloor } from "./props";

/** When the steps that follow a hit happen: just after its contact. */
export function afterHit(b: Builder): number {
  return b.cause === null ? b.cursor : b.cause.at + 40;
}

export function disarm(b: Builder, step: StepOf<"disarm">, i: number): Placed {
  const at = afterHit(b);
  if (!b.has(step.target)) return { at, apply: at };
  skillTag(b, step.procs, at);
  if (step.resisted === true) return { at, apply: at };
  const landed = dropOnFloor(b, i, step.target, step.weapon, at, OUTCOME.disarmMs, "pop");
  b.setHeld(step.target, at, "fists");
  b.heldNow.set(step.target, "fists");
  if (b.cursor < at + 200) b.cursor = at + 200;
  return { at, apply: landed };
}
