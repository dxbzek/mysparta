/** Swap: the old weapon is dropped (250 ms, one bounce, it stays on the floor), then the new one
 *  is drawn. */
import type { StepOf } from "@rankzero/core";
import { dropOnFloor, slungAt } from "./props";
import type { Builder } from "../timeline";
import { OUTCOME } from "../tuning";
import type { Placed } from "./index";

export function swap(b: Builder, step: StepOf<"swap">, i: number): Placed {
  const s = b.cursor;
  const tr = b.track(step.actor);
  dropOnFloor(b, i, step.actor, step.dropped, s, OUTCOME.swapDropMs, "drop", slungAt(b, step.actor, step.dropped, s));
  b.setHeld(step.actor, s, "fists");
  const d = s + OUTCOME.swapDropMs;
  const dur = b.info(tr.rig, "draw").durationMs;
  b.play(step.actor, "draw", d);
  b.bag(tr.side, d, step.bagAfter);
  const inHand = d + Math.round(dur / 2);
  b.setHeld(step.actor, inHand, step.weapon);
  b.heldNow.set(step.actor, step.weapon);
  b.cursor = d + dur;
  return { at: s, apply: inHand };
}
