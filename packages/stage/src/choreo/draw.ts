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
  // the whoosh as the weapon shows in the hand (round-2 close: at the start of the draw it came
  // about 110 ms before anything was drawn)
  b.cue(inHand, i, "whoosh", 0, step.weapon);
  b.cursor = s + dur;
  return { at: s, apply: inHand };
}
