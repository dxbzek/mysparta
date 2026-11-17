/** The intro. The left scrapper jumps in at 0 to 450, the right one at 250 to 700, the
 *  companions run in from 600, one after another `INTRO.companionStaggerMs` apart, each heard as
 *  it comes into the frame (round-2 close: four pet sounds fired at once at 600 ms, 150 ms before
 *  any pet showed, and smeared into one blob). A dust puff and a landing sound where each scrapper
 *  lands. */
import type { StepOf } from "@rankzero/core";
import { homeSpan } from "../camera";
import { STAGE_W } from "../layout";
import { eased } from "../track";

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
  // the companions before it in the log have already started their run
  const k = b.actors.filter((a) => a.rig !== "scrapper" && a.showFrom !== Infinity).length;
  tr.start = { x: offX(tr.side, 30 + Math.abs(tr.home.x - (tr.side === "a" ? 0 : STAGE_W))), y: tr.home.y };
  // how long into its run its front comes into the bout's frame (the run is eased out)
  const span = homeSpan(b);
  const front = tr.reach.front;
  let seenIn: number = INTRO.companionsRunMs;
  for (let e = 0; e <= INTRO.companionsRunMs; e += 5) {
    const x = tr.start.x + (tr.home.x - tr.start.x) * eased("out", e / INTRO.companionsRunMs);
    if (tr.side === "a" ? x + front >= span.x0 : x - front <= span.x1) { seenIn = e; break; }
  }
  // its sound as it shows, and never on top of the pet sound before it
  const last = b.cues.reduce((m, c) => (c.family === "companion" ? Math.max(m, c.at) : m), -Infinity);
  const at = Math.max(INTRO.companionsAt + k * INTRO.companionStaggerMs, last + INTRO.companionSoundGapMs - seenIn);
  tr.showFrom = at;
  b.move(step.actor, at, INTRO.companionsRunMs, tr.home.x, tr.home.y, 0, "out");
  b.play(step.actor, "run", at, { until: at + INTRO.companionsRunMs });
  b.cue(at + seenIn, i, "companion", 0, b.soundItem(step.actor));
  return { at, apply: at + INTRO.companionsRunMs };
}
