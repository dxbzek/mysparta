/** Free: the tarp comes off. By a hit, at that hit's contact; by time running out, as a beat of
 *  its own: the tarp lifts off and the actor shakes itself loose. */
import type { StepOf } from "@rankzero/core";
import type { Builder } from "../timeline";
import { MOVE } from "../tuning";
import type { Placed } from "./index";

export function free(b: Builder, step: StepOf<"free">, i: number): Placed {
  const at = step.cause === "hit" && b.cause !== null ? b.cause.at : b.cursor;
  if (!b.has(step.actor)) return { at, apply: at };
  const snared = b.snared.get(step.actor);
  const p = b.place(step.actor, at);
  if (snared !== undefined) {
    snared.seg.to = at;
    snared.cover.to = at;
    b.snared.delete(step.actor);
  }
  // the tarp flies up and away
  b.fx.push({ fx: "tarp", from: at, to: at + MOVE.freeMs, x: p.x - p.facing * 30, y: p.y - 70, facing: p.facing,
    seed: b.opts.cosmeticSeed + i, contact: null, fly: { x0: p.x, y0: p.y, ms: MOVE.freeMs, arc: 10 } });
  if (step.cause === "timeout") {
    b.nudge({ actor: step.actor, key: "hop", from: at, outMs: MOVE.freeMs, holdMs: 0, backMs: 0, dx: 0, arc: 8, contact: null });
    b.busy(at, at + MOVE.freeMs);
    b.cursor = at + MOVE.freeMs + 80;
  }
  return { at, apply: at };
}
