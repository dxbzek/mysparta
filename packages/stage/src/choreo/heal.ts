/** A heal (Energy Drink on the drinker, Whistle on a companion): "+N" in Teal, a ring of plus
 *  shapes, the HP bar fills. A whistled companion hops first. */
import type { StepOf } from "@rankzero/core";
import { healAt } from "../effects";
import type { Builder } from "../timeline";
import { OUTCOME } from "../tuning";
import type { Placed } from "./index";

export function heal(b: Builder, step: StepOf<"heal">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.target)) return { at: s, apply: s };
  let at = s;
  if (step.target !== step.actor) {
    b.nudge({ actor: step.target, key: "hop", from: s, outMs: OUTCOME.healHopMs, holdMs: 0, backMs: 0, dx: 0,
      arc: OUTCOME.healHop, contact: null });
    b.busy(s, s + OUTCOME.healHopMs);
    at = s + OUTCOME.healHopMs / 2;
  }
  healAt(b, i, step.target, at, step.amount, step.hpAfter);
  b.cursor = at + OUTCOME.healRingMs;
  return { at: s, apply: at };
}
