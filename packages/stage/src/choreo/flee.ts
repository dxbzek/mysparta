/** A companion runs: it turns to its own side's edge, plays its flee clip and leaves the stage. */
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
  const ms = Math.round((Math.abs(edge - p.x) / MOVE.fleeSpeed) * 1000);
  b.face(step.actor, at, facing);
  b.move(step.actor, at, ms, edge, p.y, 0, "linear");
  b.play(step.actor, "flee", at, { until: at + ms });
  tr.goneAt = at + ms;
  b.status.set(step.actor, "fled");
  b.out.delete(step.actor);
  b.cue(at, i, "companion", 0, b.soundItem(step.actor));
  // scared off by an Air Horn: say so over it as it turns tail
  if (b.fleeAt !== null) resultTag(b, "air-horn", step.actor, at, CORAL, "pet");
  if (b.cursor < at + 300) b.cursor = at + 300;
  return { at, apply: at + 1 };
}
