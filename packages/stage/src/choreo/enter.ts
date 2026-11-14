/** The intro. The left scrapper jumps in at 0 to 450, the right one at 250 to 700, the
 *  companions run in at 600 to 900. A dust puff and a landing sound where each scrapper lands. */
import type { StepOf } from "@rankzero/core";
import { STAGE_W } from "../layout";
import type { Builder } from "../timeline";
import { INTRO } from "../tuning";
import type { Placed } from "./index";

export function enter(b: Builder, step: StepOf<"enter">, i: number): Placed {
  const tr = b.track(step.actor);
  const offX = (side: "a" | "b", by: number): number => (side === "a" ? -by : STAGE_W + by);
  if (tr.rig === "scrapper") {
    const at = tr.side === "a" ? INTRO.leftJumpAt : INTRO.rightJumpAt;
    const info = b.info("scrapper", "enter");
    const landAt = info.events.find((e) => e.name === "land")?.t ?? info.durationMs;
    tr.start = { x: offX(tr.side, INTRO.offStage), y: tr.home.y };
    tr.showFrom = at;
    b.move(step.actor, at, landAt, tr.home.x, tr.home.y, 0, "out");
    b.play(step.actor, "enter", at);
    b.fx.push({ fx: "dust", from: at + landAt, to: at + landAt + 360, x: tr.home.x, y: tr.home.y, facing: tr.homeFacing,
      seed: b.opts.cosmeticSeed + i, contact: null });
    b.cue(at + landAt, i, "landing");
    return { at, apply: at + landAt };
  }
  const at = INTRO.companionsAt;
  tr.start = { x: offX(tr.side, 30 + Math.abs(tr.home.x - (tr.side === "a" ? 0 : STAGE_W))), y: tr.home.y };
  tr.showFrom = at;
  b.move(step.actor, at, INTRO.companionsRunMs, tr.home.x, tr.home.y, 0, "out");
  b.play(step.actor, "run", at, { until: at + INTRO.companionsRunMs });
  b.cue(at, i, "companion");
  return { at, apply: at + INTRO.companionsRunMs };
}
