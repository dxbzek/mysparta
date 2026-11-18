/** A companion runs: it turns to its own side's edge, plays its flee clip and leaves the stage.
 *  Scared off by an Air Horn it first jumps on the spot, then runs off at a pace the eye can
 *  follow (it used to leave the frame from its spot at the camera's edge in two frames). */
import type { StepOf } from "@rankzero/core";
import { resultTag } from "../effects";
import { homeSpan } from "../camera";
import { drawnBox } from "../bounds";
import { BODY_GAP, STAGE_W } from "../layout";
import { CORAL } from "../palette";
import type { Builder } from "../timeline";
import { MOVE } from "../tuning";
import { tarpOff } from "./snare";

import type { Placed } from "./index";

export function flee(b: Builder, step: StepOf<"flee">, i: number): Placed {
  const at = b.fleeAt ?? b.cursor;
  if (!b.has(step.actor)) return { at, apply: at };
  const tr = b.track(step.actor);
  // a pet pinned under a tarp throws it off first: the sheet slides off and stays (round-2 close:
  // a pinned raccoon fled with its pegged tarp following it)
  tarpOff(b, step.actor, at, b.opts.cosmeticSeed + i);
  const p = b.place(step.actor, at);
  const edge = tr.side === "a" ? -40 : STAGE_W + 40;
  const facing: 1 | -1 = tr.side === "a" ? -1 : 1;
  const scared = b.fleeAt !== null;
  const jump = scared ? MOVE.startleMs : 0;
  let x0 = p.x;
  if (scared) {
    // the startle: a jump in fright, the hit clip in the air. A pet standing at the edge of the
    // camera's frame, partly cut on a tall phone, jumps in toward the middle first (at most
    // `startleIn`), so the scare and the run off start where they can be seen (review round 2:
    // the Air Horn's "runs off" was a tag over an empty corner)
    const span = homeSpan(b);
    const m = span.must ?? span;
    const r = Math.max(tr.reach.back, tr.reach.front);
    const inside = Math.min(m.x1 - r, Math.max(m.x0 + r, p.x));
    x0 = p.x + Math.sign(inside - p.x) * Math.min(MOVE.startleIn, Math.abs(inside - p.x));
    // never into a fighter: it lands clear of every standing fighter's drawn body, its owner's
    // first (the checker, level 30 n 10: the stray dog jumped into its owner's silhouette and ran
    // off from behind his legs and his pallet). A shield slung on the back counts (`slungRoom`).
    const [pl, pr] = p.facing === 1 ? [tr.reach.back, tr.reach.front] : [tr.reach.front, tr.reach.back];
    for (const o of b.actors) {
      if (o.rig !== "scrapper" || b.status.get(o.id) !== "up") continue;
      const q = b.place(o.id, at + jump);
      const ob = drawnBox(b.rig, b.poseAt(o.id, at + jump), b.dress(o.id), q);
      const lo = ob.x0 - MOVE.slungRoom - BODY_GAP.petClear;
      const hi = ob.x1 + MOVE.slungRoom + BODY_GAP.petClear;
      if (x0 > p.x && q.x > p.x) x0 = Math.max(p.x, Math.min(x0, lo - pr));
      if (x0 < p.x && q.x < p.x) x0 = Math.min(p.x, Math.max(x0, hi + pl));
    }
    b.play(step.actor, "hit", at, { until: at + jump });
    if (Math.abs(x0 - p.x) > 0.5) b.move(step.actor, at, jump, x0, p.y, 9, "inOut");
    else b.nudge({ actor: step.actor, key: "hop", from: at, outMs: jump / 2, holdMs: 0, backMs: jump / 2, dx: 0, arc: 9, contact: null });
  }
  const go = at + jump;
  const ms = Math.round((Math.abs(edge - x0) / (scared ? MOVE.scaredSpeed : MOVE.fleeSpeed)) * 1000);
  b.face(step.actor, go, facing);
  b.move(step.actor, go, ms, edge, p.y, 0, scared ? "in" : "linear");
  b.play(step.actor, "flee", go, { until: go + ms });
  tr.goneAt = go + ms;
  b.status.set(step.actor, "fled");
  b.out.delete(step.actor);
  b.cue(at, i, "companion", 0, b.soundItem(step.actor));
  // scared off by an Air Horn: say so over it as it turns tail
  if (b.fleeAt !== null) resultTag(b, "air-horn", step.actor, at, CORAL, "pet");
  if (b.cursor < go + 300) b.cursor = go + 300;
  return { at, apply: at + 1 };
}
