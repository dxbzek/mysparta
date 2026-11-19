/** Snared: the tarp lies over the target, pegged down, and heaves until it is freed. The target is
 *  hidden under it from the hem's touchdown (choreo/move.ts: its landing sound is cued there) to the
 *  moment it comes off (choreo/free.ts); a scrapper holds its snared clip under it, a companion its
 *  hit pose, so it is in that pose when the sheet comes off. A Grapple hold (content v2) snares with
 *  no tarp: the target just holds its snared clip, pinned, until it is freed. */
import type { ActorId, StepOf } from "@rankzero/core";
import type { FxSize } from "@rankzero/rig";
import { drawnBox, topPoint } from "../bounds";

import { homeSpan } from "../camera";
import type { FxItem, Sling } from "../model";
import type { Builder } from "../timeline";
import { MOVE } from "../tuning";
import type { Placed } from "./index";

/** How far the drawn tarp reaches each side of its centre once pegged down, for a body `w` across
 *  (rig content/fx.ts `tarpHalf`: the sheet, its spread hem and the pegs on it). */
export const tarpHalf = (w: number): number => (w / 2 + 5) * 1.08 + 5 + 1.5;
/** How far it slides along the floor as it comes off (rig content/fx.ts `tarpSlide`). */
export const tarpSlide = (w: number): number => (w / 2 + 5) * 0.8;

/** The pose a target holds under the tarp: a scrapper's snared clip, a companion's hit pose. */
function heldPose(b: Builder, id: ActorId): { clip: string; c0: number } {
  return b.track(id).rig === "scrapper" ? { clip: "snared", c0: 0 } : { clip: "hit", c0: PINNED_MS };
}

/**
 * The tarp over a target, one design for a pet and a fighter (round-2 close: a fighter's tarp was
 * a tall blue box, a goose's a tall dome with its head floating over it). `size` for the rig: `h`
 * the standing body's height (the dome it lands as covers all of it, what it holds too), `w` the
 * width the sheet lies over once the body is down under it (as wide as most of the body is tall,
 * so the low pegged sheet, 0.4 of its width at most, is a heap a body fits under); `dx` the
 * centre of the sheet from the target's place, in its facing, and `half` how far the pegged sheet
 * reaches each side of that centre.
 */
export function tarpSize(b: Builder, id: ActorId): { size: FxSize; dx: number; half: number } {
  const tr = b.track(id);
  const pose = heldPose(b, id);
  // the box of the pose it holds under the sheet, what it holds included, facing +1
  const sample = b.rig.samplePose(tr.rig, pose.clip, pose.c0);
  const box = drawnBox(b.rig, sample, b.dress(id), { x: 0, y: 0, facing: 1 });
  // (the dome is as tall as the body itself: what it holds is put away in the snared pose)
  const bare = drawnBox(b.rig, sample, { ...b.dress(id), held: null, shield: null }, { x: 0, y: 0, facing: 1 });
  const tall = Math.max(4, -bare.y0);
  if (tr.rig === "scrapper") {
    // a fighter's sheet hangs from just under the chin at the lowest the snared loop ducks the
    // head, so the face always shows; it is as wide as the bare body, arms at the face included
    const d = { ...b.dress(id), held: null, shield: null };
    const head = b.rig.hitPoint("scrapper", d, "head");
    const standTop = topPoint(b.rig, b.rig.samplePose("scrapper", "idle", 0), d, { x: 0, y: 0, facing: 1 }).y;
    const r = Math.max(4, head.y - standTop);
    const loop = b.info("scrapper", "snared").durationMs;
    let chin = -Infinity;
    for (let t = 0; t < loop; t += 35) chin = Math.max(chin, topPoint(b.rig, b.rig.samplePose("scrapper", "snared", t), d, { x: 0, y: 0, facing: 1 }).y + 2 * r);
    const neck = Math.max(10, -chin - 1);
    const w = bare.x1 - bare.x0 + 6;
    return { size: { w, h: tall, neck }, dx: (bare.x0 + bare.x1) / 2, half: drapeHalf(w) };
  }
  const w = Math.max(box.x1 - box.x0, 0.9 * tall);
  return { size: { w, h: tall }, dx: (box.x0 + box.x1) / 2, half: tarpHalf(w) };
}
/** How far the drawn shoulder drape reaches each side of its centre once pegged, for a fighter's
 *  sheet `w` across (rig content/fx.ts `drapeHalf`). */
export const drapeHalf = (w: number): number => w / 2 + 6 + 5 + 1;
/** The clip time of the hit pose a pinned pet holds. */
const PINNED_MS = 60;

/** The centre offset (in the target's facing) that keeps a pegged sheet of half-width `half`, on a
 *  target standing at `x` facing `facing`, inside the frame: the bout's frame for a pet, the part
 *  every canvas shows (the scrappers' room) for a fighter. */
export function inFrameDx(b: Builder, x: number, facing: 1 | -1, dx: number, half: number, fighter = false): number {
  const whole = homeSpan(b);
  const span = fighter && whole.must !== undefined ? whole.must : whole;

  const centre = x + facing * dx;
  const lo = span.x0 + half;
  const hi = span.x1 - half;
  const kept = lo <= hi ? Math.min(hi, Math.max(lo, centre)) : (span.x0 + span.x1) / 2;
  return (kept - x) * facing;
}

export function snare(b: Builder, step: StepOf<"snare">, i: number): Placed {
  const tarped = b.tarpLanding !== null && b.tarpLanding.target === step.target;
  const landing = tarped ? b.tarpLanding!.at : b.cursor;
  const dx = tarped ? b.tarpLanding!.dx : 0;
  b.tarpLanding = null;
  if (!b.has(step.target)) return { at: landing, apply: landing };
  const tr = b.track(step.target);
  const pose = heldPose(b, step.target);
  // under a tarp it ducks into its pose as the sheet opens over it (its held item put away), so
  // nothing pokes out of the falling sheet (round-2 close: a sledgehammer stood out of it)
  const from = tarped ? landing - MOVE.tarpDropMs : landing;
  const seg = tr.rig === "scrapper"
    ? b.play(step.target, "snared", from, { until: Infinity })
    : b.play(step.target, "hit", from, { c0: pose.c0, rate: 0, until: Infinity });

  const p = b.place(step.target, landing);
  const ts = tarpSize(b, step.target);
  // the sheet lands as a dome over the standing body, sinks to its low pegged shape as the body
  // goes down under it, then heaves on a loop (with reduced motion it lies still, settled)
  const P = MOVE.tarpPhases;
  const cover: FxItem = { fx: "tarp", from: landing, to: tarped ? Infinity : landing, x: dx, y: 0, facing: p.facing,
    seed: b.opts.cosmeticSeed + i, contact: null, follow: step.target, size: ts.size,
    lead: { ms: MOVE.tarpSlumpMs, p0: P.land, p1: P.slump },
    ...(b.motion.fxLoop ? { loopMs: 900, p0: P.slump, p1: P.heave } : { p0: P.slump, p1: P.slump }) };
  let covered: { from: number; to: number } | undefined;
  if (tarped) {
    b.fx.push(cover);
    // hidden under it from the touchdown: no head floats over the sheet, nothing it holds pokes out
    covered = { from: landing, to: Infinity };
    (tr.covered ??= []).push(covered);
  }
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
  b.snared.set(step.target, { seg, cover, ...(sling !== undefined ? { sling } : {}), ...(covered !== undefined ? { covered } : {}) });
  if (b.cursor < landing + 200) b.cursor = landing + 200;
  return { at: landing, apply: landing };
}

/**
 * The tarp comes off a snared actor at `at` (freed, or it runs): the cover ends, the body shows
 * again, and the sheet slides along the floor away from where it lay, crumples and fades, inside
 * the frame (round-2 close: it floated up, was cut off at the frame's edge and vanished in one
 * frame). Toward the middle of the frame, so it never slides out of it. Returns whether there was a
 * tarp (a Grapple hold has none).
 */
export function tarpOff(b: Builder, id: ActorId, at: number, seed: number): boolean {
  const snared = b.snared.get(id);
  if (snared === undefined) return false;
  const tarp = snared.cover.to !== snared.cover.from;
  snared.seg.to = at;
  // (a cover that never began, the Grapple's, stays empty)
  if (tarp) snared.cover.to = Math.max(at, snared.cover.from);
  if (snared.covered !== undefined) snared.covered.to = at;
  if (snared.sling !== undefined) snared.sling.to = at;
  b.snared.delete(id);
  if (!tarp || snared.cover.size === undefined) return tarp;
  const p = b.place(id, at);
  const x = p.x + p.facing * snared.cover.x;
  const span = homeSpan(b);
  const dir: 1 | -1 = x <= (span.x0 + span.x1) / 2 ? 1 : -1;
  b.fx.push({ fx: "tarp", from: at, to: at + MOVE.tarpOffMs, x, y: p.y, facing: dir, seed, contact: null, under: id,
    size: snared.cover.size, p0: MOVE.tarpPhases.heave, p1: 1 });
  return true;
}
