/** Free: the tarp comes off. By a hit, at that hit's contact; by time running out, as a beat of
 *  its own: the actor shakes itself loose and the sheet slides off it along the floor, crumples
 *  and fades inside the frame (choreo/snare.ts `tarpOff`). */
import type { StepOf } from "@rankzero/core";
import type { Builder } from "../timeline";
import { MOVE } from "../tuning";
import { tarpOff } from "./snare";
import type { Placed } from "./index";

export function free(b: Builder, step: StepOf<"free">, i: number): Placed {
  const at = step.cause === "hit" && b.cause !== null ? b.cause.at : b.cursor;
  if (!b.has(step.actor)) return { at, apply: at };
  tarpOff(b, step.actor, at, b.opts.cosmeticSeed + i);
  // a pet that scrambled in from the frame's edge before the tarp landed goes home now (choreo/move.ts)
  if (b.track(step.actor).rig !== "scrapper") b.out.add(step.actor);
  if (step.cause === "timeout") {
    b.nudge({ actor: step.actor, key: "hop", from: at, outMs: MOVE.freeMs, holdMs: 0, backMs: 0, dx: 0, arc: 8, contact: null });
    b.busy(at, at + MOVE.freeMs);
    b.cursor = at + MOVE.freeMs + 80;
  }
  return { at, apply: at };
}
