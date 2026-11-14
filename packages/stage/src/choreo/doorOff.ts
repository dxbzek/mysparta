/** The Car Door is knocked off the back arm: it flies off in an arc, lands and stays. */
import type { StepOf } from "@rankzero/core";
import type { Builder } from "../timeline";
import { OUTCOME } from "../tuning";
import type { Placed } from "./index";
import { afterHit } from "./disarm";
import { dropOnFloor } from "./props";

export function doorOff(b: Builder, step: StepOf<"doorOff">, i: number): Placed {
  const at = afterHit(b) + 30;
  if (!b.has(step.target)) return { at, apply: at };
  const p = b.place(step.target, at);
  const from = { x: p.x - p.facing * 4, y: p.y - 46, rot: 0 };
  const landed = dropOnFloor(b, i, step.target, "car-door", at, OUTCOME.disarmMs, "pop", from);
  b.setDoor(step.target, at, false);
  b.doorNow.set(step.target, false);
  if (b.cursor < at + 200) b.cursor = at + 200;
  return { at, apply: landed };
}
