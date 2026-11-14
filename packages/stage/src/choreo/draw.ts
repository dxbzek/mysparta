/** Draw a weapon: the draw clip; the icon leaves the bag strip at the start, the weapon is in
 *  the hand halfway through. */
import type { StepOf } from "@rankzero/core";
import type { Builder } from "../timeline";
import type { Placed } from "./index";

export function draw(b: Builder, step: StepOf<"draw">, i: number): Placed {
  const s = b.cursor;
  const tr = b.track(step.actor);
  const dur = b.info(tr.rig, "draw").durationMs;
  b.play(step.actor, "draw", s);
  b.bag(tr.side, s, step.bagAfter);
  const inHand = s + Math.round(dur / 2);
  b.setHeld(step.actor, inHand, step.weapon);
  b.heldNow.set(step.actor, step.weapon);
  b.cue(s, i, "whoosh");
  b.cursor = s + dur;
  return { at: s, apply: inHand };
}
