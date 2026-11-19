/** An overtime loss: the OVERTIME sticker the first time, then a small coral number and an HP
 *  drop, with no dash and no flinch clip. */
import type { StepOf } from "@rankzero/core";
import { overtimeLoss, overtimeSticker } from "../effects";
import type { Builder } from "../timeline";
import { HIT_STOP, OUTCOME } from "../tuning";
import type { Placed } from "./index";

export function overtime(b: Builder, step: StepOf<"overtime">, i: number): Placed {
  const s = b.cursor;
  if (!b.has(step.actor)) return { at: s, apply: s };
  overtimeSticker(b, s);
  const at = s + 80;
  overtimeLoss(b, i, step.actor, at, step.damage, step.hpAfter);
  b.busy(s, s + OUTCOME.overtimeBeatMs);
  const hitStop = i === b.killStep ? Math.min(HIT_STOP.knockout, b.motion.hitStopCap) : 0;
  b.cause = { step: i, at, actor: step.actor, hitStop };
  b.cursor = s + OUTCOME.overtimeBeatMs;
  return { at: s, apply: at };
}
