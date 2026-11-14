/**
 * Knocked out: the fall clip, and the body stays down. The scrapper felled by the kill step
 * gets the knockout beat: the 220 ms hit-stop of its blow, then time scale 0.4 for 500 ms,
 * then the rest of the fall at full speed. A companion just falls and stays down.
 */
import type { StepOf } from "@rankzero/core";
import { isScrapper } from "@rankzero/core";
import type { Builder } from "../timeline";
import { KNOCKOUT } from "../tuning";
import type { Placed } from "./index";

export function ko(b: Builder, step: StepOf<"ko">, i: number): Placed {
  if (!b.has(step.actor)) return { at: b.cursor, apply: b.cursor };
  const tr = b.track(step.actor);
  const hitAt = b.lastHitAt.get(step.actor) ?? b.cursor;
  const kill = isScrapper(step.actor) && b.killStep >= 0 && i > b.killStep && !b.koShown;
  const stop = b.cause !== null && b.cause.at === hitAt ? b.cause.hitStop : 0;
  const k = hitAt + stop;
  const clip = tr.rig === "scrapper" ? "ko-fall" : "ko";
  const info = b.info(tr.rig, clip);
  let fallEnd: number;
  if (kill && b.motion.slowMotion) {
    const slowClip = KNOCKOUT.slowMs * KNOCKOUT.slowScale;
    b.play(step.actor, clip, k, { rate: KNOCKOUT.slowScale, until: k + KNOCKOUT.slowMs });
    b.play(step.actor, clip, k + KNOCKOUT.slowMs, { c0: slowClip, rate: 1, hold: true });
    fallEnd = k + KNOCKOUT.slowMs + Math.max(0, info.durationMs - slowClip);
  } else {
    b.play(step.actor, clip, k, { hold: true });
    fallEnd = k + info.durationMs;
  }
  const landAt = info.events.find((e) => e.name === "land")?.t;
  if (landAt !== undefined) {
    const slowPart = kill && b.motion.slowMotion ? KNOCKOUT.slowMs * KNOCKOUT.slowScale : 0;
    const when = landAt <= slowPart ? k + landAt / KNOCKOUT.slowScale : k + (slowPart > 0 ? KNOCKOUT.slowMs : 0) + (landAt - slowPart);
    b.cue(when, i, "landing");
    const p = b.place(step.actor, when);
    b.fx.push({ fx: "dust", from: when, to: when + 360, x: p.x, y: p.y, facing: p.facing, seed: b.opts.cosmeticSeed + i, contact: null });
  }
  b.status.set(step.actor, "ko");
  b.out.delete(step.actor);
  if (kill) {
    b.koShown = true;
    if (b.cursor < fallEnd) b.cursor = fallEnd;
  } else if (b.cursor < k + 200) b.cursor = k + 200;
  return { at: k, apply: k };
}
