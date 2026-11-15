/** A companion runs: it turns to its own side's edge, plays its flee clip and leaves the stage.
 *  Scared off by an Air Horn it first jumps on the spot, then runs off at a pace the eye can
 *  follow (it used to leave the frame from its spot at the camera's edge in two frames). */
import type { StepOf } from "@rankzero/core";
import { resultTag } from "../effects";
import { STAGE_W } from "../layout";
import { CORAL } from "../palette";
import type { Builder } from "../timeline";
import { MOVE } from "../tuning";
import type { Placed } from "./index";

export function flee(b: Builder, step: StepOf<"flee">, i: number): Placed {
  const at = b.fleeAt ?? b.cursor;
  if (!b.has(step.actor)) return { at, apply: at };
  const tr = b.track(step.actor);
  const p = b.place(step.actor, at);
  const edge = tr.side === "a" ? -40 : STAGE_W + 40;
  const facing: 1 | -1 = tr.side === "a" ? -1 : 1;
  const scared = b.fleeAt !== null;
  const jump = scared ? MOVE.startleMs : 0;
  if (scared) {
    // the startle: a jump on the spot, the hit clip in the air
    b.play(step.actor, "hit", at, { until: at + jump });
    b.nudge({ actor: step.actor, key: "hop", from: at, outMs: jump / 2, holdMs: 0, backMs: jump / 2, dx: 0, arc: 9, contact: null });
  }
  const go = at + jump;
  const ms = Math.round((Math.abs(edge - p.x) / (scared ? MOVE.scaredSpeed : MOVE.fleeSpeed)) * 1000);
  b.face(step.actor, go, facing);
  b.move(step.actor, go, ms, edge, p.y, 0, scared ? "in" : "linear");
  b.play(step.actor, "flee", go, { until: go + ms });
  tr.goneAt = go + ms;
  b.status.set(step.actor, "fled");
  b.out.delete(step.actor);
  b.cue(at, i, "companion", 0, b.soundItem(step.actor));
  // scared off by an Air Horn: say so over it as it turns tail
  if (b.fleeAt !== null) resultTag(b, "air-horn", step.actor, at, CORAL, "pet");
  if (b.cursor < go + 300) b.cursor = go + 300;
  return { at, apply: at + 1 };
}
