/** A heal (Energy Drink and Second Wind on the user, Whistle on a companion): a green "+N", a ring
 *  of plus shapes, the HP bar fills. A whistled companion first runs to its owner's side and hops. */
import type { StepOf } from "@rankzero/core";
import { healAt } from "../effects";
import type { Builder } from "../timeline";
import { MOVE, OUTCOME } from "../tuning";
import type { Placed } from "./index";

export function heal(b: Builder, step: StepOf<"heal">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.target)) return { at: s, apply: s };
  let at = s;
  if (step.target !== step.actor) {
    let from = s;
    const pet = b.track(step.target);
    if (pet.rig !== "scrapper" && b.has(step.actor)) {
      // the pet runs in to its owner's side at the whistle
      const owner = b.place(step.actor, s);
      const p = b.place(step.target, s);
      const x = owner.x + owner.facing * MOVE.petRunGap;
      const ms = Math.round((Math.abs(x - p.x) / MOVE.petRunSpeed) * 1000);
      if (ms > 40) {
        b.face(step.target, s, x >= p.x ? 1 : -1);
        b.move(step.target, s, ms, x, p.y, 0, "inOut");
        b.play(step.target, "run", s, { until: s + ms });
        b.face(step.target, s + ms, pet.homeFacing);
        b.out.add(step.target);
        from = s + ms;
      }
    }
    b.nudge({ actor: step.target, key: "hop", from, outMs: OUTCOME.healHopMs, holdMs: 0, backMs: 0, dx: 0,
      arc: OUTCOME.healHop, contact: null });
    b.busy(s, from + OUTCOME.healHopMs);
    at = from + OUTCOME.healHopMs / 2;
  }
  healAt(b, i, step.target, at, step.amount, step.hpAfter);
  b.cursor = at + OUTCOME.healRingMs;
  return { at: s, apply: at };
}
