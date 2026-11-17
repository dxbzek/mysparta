/** Snared: the tarp lies over the target and wobbles until it is freed. A scrapper plays its
 *  snared clip under it; a companion holds its hit pose. A Grapple hold (content v2) snares
 *  with no tarp: the target just holds its snared clip, pinned, until it is freed. */
import type { ActorId, StepOf } from "@rankzero/core";
import type { FxSize } from "@rankzero/rig";
import { drawnBox } from "../bounds";
import type { Sling } from "../model";
import type { Builder } from "../timeline";
import { MOVE } from "../tuning";
import type { Placed } from "./index";

/** The tarp over a pet is drawn to the pet's size (round 2, owner on the recorded fight: drawn at a
 *  fighter's size it stood over a raccoon as a tall upright curtain): `size` for the rig, `dx` the
 *  centre of its body from its place, in its facing, and `half` how far the sheet, its spread hem
 *  and its pegs reach each side of that centre. A fighter's tarp keeps the fighter-sized art. */
export function petTarp(b: Builder, id: ActorId): { size: FxSize; dx: number; half: number } | null {
  const tr = b.track(id);
  if (tr.rig === "scrapper") return null;
  // the box of the pose it holds under the sheet (its hit pose, held: snare below), facing +1
  const box = drawnBox(b.rig, b.rig.samplePose(tr.rig, "hit", PINNED_MS), b.dress(id), { x: 0, y: 0, facing: 1 });
  // a sheet lies low: as wide as most of the body is tall, and no taller than its width allows, so a
  // goose's neck pokes out of it instead of propping it up into a tent
  const tall = Math.max(4, -box.y0);
  const w = Math.max(box.x1 - box.x0, 0.9 * tall);
  const h = Math.min(tall, 0.6 * w + 4);
  return { size: { w, h }, dx: (box.x0 + box.x1) / 2, half: w / 2 + 5 + 5 + 7 };
}
/** The clip time of the hit pose a pinned pet holds. */
const PINNED_MS = 60;

export function snare(b: Builder, step: StepOf<"snare">, i: number): Placed {
  const tarped = b.tarpLanding !== null && b.tarpLanding.target === step.target;
  const landing = tarped ? b.tarpLanding!.at : b.cursor;
  b.tarpLanding = null;
  if (!b.has(step.target)) return { at: landing, apply: landing };
  const tr = b.track(step.target);
  const seg = tr.rig === "scrapper"
    ? b.play(step.target, "snared", landing, { until: Infinity })
    : b.play(step.target, "hit", landing, { c0: PINNED_MS, rate: 0, until: Infinity });
  const p = b.place(step.target, landing);
  // a pet's tarp: its size, centred on its body; the loop runs the settled heave only (it used to
  // run the drop from above again every 900 ms)
  const pt = petTarp(b, step.target);
  // (for every target: it replayed the drop from above every 900 ms, and a fighter's sheet jumped
  // 30 units each time; with reduced motion it lies still, settled)
  const cover = { fx: "tarp" as const, from: landing, to: tarped ? Infinity : landing, x: pt?.dx ?? 0, y: 0, facing: p.facing,
    seed: b.opts.cosmeticSeed + i, contact: null, follow: step.target,
    ...(b.motion.fxLoop ? { loopMs: 900, p0: 0.35, p1: 1 } : { p0: 1, p1: 1 }),
    ...(pt !== null ? { size: pt.size } : {}) };
  if (tarped) b.fx.push(cover);
  // snared, its hands are at its face, under the tarp or pinned by a Grapple: the shield is off
  // the arm until it is free (review round 2: it was drawn on top of the sheet at head height, and
  // after a Grapple the car door sat over the pinned head). A sling that has only just ended (the
  // Grapple's own) carries on, so the shield does not flick back onto the arm in between.
  let sling: Sling | undefined;
  if (tr.rig === "scrapper" && (b.shieldNow.get(step.target) ?? null) !== null) {
    sling = b.slings.find((g) => g.actor === step.target && g.shield && g.to !== Infinity && g.to <= landing && g.to + MOVE.reslingMs >= landing);
    if (sling !== undefined) sling.to = Infinity;
    else { sling = { actor: step.target, from: landing, to: Infinity, shield: true, held: false }; b.slings.push(sling); }
  }
  b.snared.set(step.target, { seg, cover, ...(sling !== undefined ? { sling } : {}) });
  if (b.cursor < landing + 200) b.cursor = landing + 200;
  return { at: landing, apply: landing };
}
