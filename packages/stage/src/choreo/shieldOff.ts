/** A shield is knocked off the back arm (content v2): it pops off in an arc, lands on the floor
 *  and stays there as a prop. Splinters fly from the arm where it was hit. */
import type { StepOf } from "@rankzero/core";
import type { Builder } from "../timeline";
import { CONTACT, OUTCOME } from "../tuning";
import type { Placed } from "./index";
import { afterHit } from "./disarm";
import { dropOnFloor } from "./props";

export function shieldOff(b: Builder, step: StepOf<"shieldOff">, i: number): Placed {
  const at = afterHit(b) + 30;
  if (!b.has(step.target)) return { at, apply: at };
  const p = b.place(step.target, at);
  const from = { x: p.x - p.facing * 4, y: p.y - 46, rot: 0 };
  b.fx.push({ fx: "spark", from: at, to: at + CONTACT.burstMs, x: from.x + p.facing * 8, y: from.y, facing: p.facing,
    seed: b.opts.cosmeticSeed + i, contact: null });
  const landed = dropOnFloor(b, i, step.target, step.shield, at, OUTCOME.disarmMs, "pop", from);
  b.setShield(step.target, at, null);
  b.shieldNow.set(step.target, null);
  if (b.cursor < at + 200) b.cursor = at + 200;
  return { at, apply: landed };
}
