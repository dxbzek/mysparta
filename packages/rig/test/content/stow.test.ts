/**
 * Free hands for the Move reactions (review, round 2, 16 Nov 2026: "Reaction gestures keep the
 * weapon in the hand at the head, so blades, tines and the stop sign stick through the face").
 *
 * While a hands-at-the-head clip plays (ears, rub-eyes, angry, snared) the rig puts the held item
 * away: a short one-hand item hangs at the front hip, a long or two-hand one is slung on the
 * back. Measured on the part list `drawActor` paints, for every held item, every frame (25 fps),
 * both facings:
 *  - no held item's drawing crosses the drawn head;
 *  - the item is still drawn (put away, not gone), and both hands are empty;
 *  - outside those clips the item is in the hand as before.
 * A planted fault (the same pose with the stow channel off) must be seen.
 *
 * The way in and the way out (checker, round 2: "the weapon still crosses the face on the way in
 * ... the item teleports, there is no put-away motion"). A clip sampled alone never shows that:
 * the stage crossfades INTO the clip from the pose on screen (an offset that fades, `poseAt` in
 * the stage's blend.ts), and the stow channel is blended with every other bone. `crossfade` below
 * is that same arithmetic, so these tests measure the frames a viewer really gets: every 10 ms of
 * the crossfade in (from idle, from a flinch) and out (back to idle), for every held item:
 *  - no item lies across the head (more than one frame's touch, `GRAZE`) at any moment of it;
 *  - the item travels: it never moves further in 10 ms than a fast swing does (no jump from the
 *    hand to the hip, the back or the floor, and none back).
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import type { Dress, Place, Pose } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import type { Paint } from "../../src/engine/draw";
import { artOf } from "../../src/engine/draw";
import { apply } from "../../src/engine/pose";
import { contentPack } from "../../src/content/pack";
import { FREE_HAND_CLIPS } from "../../src/content/clips/gestures";
import { gatePack } from "../../src/gate/pack";
import { BONE, STOW, WORN_ITEMS } from "../../src/gate/skeleton";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const S = "scrapper" as const;
type Pt = readonly [number, number];

const ITEMS = (Object.keys(WEAPON_META) as HeldId[]).filter((h) => h !== "fists" && !WORN_ITEMS.includes(h));
const dressOf = (held: HeldId, build = 0, l = 0): Dress => ({ look: { build, head: l, hair: l, face: l, top: l, bottom: l, shoes: l, accessory: l, skin: l, hairColor: l, palette: l },
  held, shield: null, scale: 1 });
/** Every build (lean, stocky, tall) in both full looks. */
const LOOKS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];

const polysOf = (ps: readonly Paint[]): Pt[][] => ps.flatMap((p) => artOf(p.d).polys.map((poly) => poly.map(([x, y]) => apply(p.xf, x, y) as Pt)));
function inside(p: Pt, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** Every outline point of the polygons, every 0.4 units along each edge. */
function dense(polys: readonly (readonly Pt[])[]): Pt[] {
  const out: Pt[] = [];
  for (const q of polys) for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[j]!;
    const b = q[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
/** Does any held item's drawing cross the drawn head? */
function itemCrossesHead(parts: readonly Paint[]): boolean {
  const head = polysOf(parts.filter((p) => p.tag === "head" && !p.ink));
  // a stowed item counts too: a long item slung on the back must not cross the head either
  const item = polysOf(parts.filter((p) => p.tag !== undefined && (p.tag.startsWith("item:") || p.tag.startsWith("stowed:"))));
  if (head.length === 0 || item.length === 0) return false;
  return dense(item).some((p) => head.some((h) => inside(p, h))) || dense(head).some((p) => item.some((q) => inside(p, q)));
}
const times = (clip: string): number[] => {
  const d = rig.clipInfo(S, clip).durationMs;
  return Array.from({ length: Math.round(d / 40) + 1 }, (_, i) => Math.min(d, i * 40));
};
const HOMES: Place[] = [{ x: 0, y: 0, facing: 1 }, { x: 0, y: 0, facing: -1 }];

/** The stage's crossfade (blend.ts `offsetPose`): `now` with the gap between the pose that was on
 *  screen (`from`) and the incoming clip's first pose (`to`) added, faded by `w` (1 = all of it). */
function crossfade(now: Pose, from: Pose, to: Pose, w: number): Pose {
  const arc = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;
  const rot = now.rot.map((r, i) => r + arc(to.rot[i]!, from.rot[i]!) * w);
  const add = (n: number, a: number, b: number): number => n + (a - b) * w;
  return { ...now, rot, lift: add(now.lift, from.lift, to.lift),
    root: { x: add(now.root.x, from.root.x, to.root.x), y: add(now.root.y, from.root.y, to.root.y), sx: add(now.root.sx, from.root.sx, to.root.sx), sy: add(now.root.sy, from.root.sy, to.root.sy) } };
}
const smooth = (u: number): number => u * u * (3 - 2 * u);
/** The stage's longest crossfade (tuning.ts BLEND.maxMs) and its ms per degree of gap. */
const FADE = { ms: 230, msPerDeg: 4.5, step: 10 } as const;
/** The poses drawn over a crossfade from `other` into `clip` (or, `out`, from the clip back to idle). */
function fadePoses(clip: string, other: Pose, out: boolean): Pose[] {
  const poses: Pose[] = [];
  const end = rig.clipInfo(S, clip).durationMs;
  for (let t = 0; t <= FADE.ms + 40; t += FADE.step) {
    const w = t >= FADE.ms ? 0 : 1 - smooth(t / FADE.ms);
    poses.push(out
      ? crossfade(rig.samplePose(S, "idle", t), rig.samplePose(S, clip, end), rig.samplePose(S, "idle", 0), w)
      : crossfade(rig.samplePose(S, clip, t), other, rig.samplePose(S, clip, 0), w));
  }
  return poses;
}
const itemParts = (parts: readonly Paint[]): Paint[] => parts.filter((p) => p.tag !== undefined && (p.tag.startsWith("item:") || p.tag.startsWith("stowed:")));
/** The middle of everything drawn of the held item(s). */
function itemMiddle(parts: readonly Paint[]): Pt {
  const pts = polysOf(itemParts(parts)).flat();
  return [pts.reduce((n, p) => n + p[0], 0) / pts.length, pts.reduce((n, p) => n + p[1], 0) / pts.length];
}
/** Most the middle of a held item may move in 10 ms (stage units). The stage's crossfade is
 *  230 ms, and the longest items (a pitchfork, a broom: 75 units) turn half round in it, their
 *  middle moving up to 21 at the fastest moment (a chain straightening as it leaves the fist: 23); a jump from the hand to the back or the floor in
 *  one frame moved it 25 to 100 (the planted fault below). */
const MAX_STEP = 24;
/** A touch this short is not "across the head": at most this many 10 ms samples in a row (one
 *  frame at 60 fps) as a bulky two-hand thing or a flopping chain leaves hands that are already
 *  rising. The fault this guards against lay across the face for 110 ms and more. */
const GRAZE = 2;
const FROM: readonly (readonly [string, number])[] = [["idle", 0], ["idle", 700], ["hit-light", 120]];

describe("free hands: a Move reaction puts the held item away", () => {
  it("names the four hands-at-the-head clips", () => {
    expect([...FREE_HAND_CLIPS].sort()).toEqual(["angry", "ears", "rub-eyes", "snared"]);
  });
  it("no held item crosses the head in ears, rub-eyes, angry or snared", () => {
    const bad: string[] = [];
    // the first look every 40 ms in both facings; the other builds and looks every 80 ms facing
    // right (mirroring is exact), which keeps the test inside the suite's time limit
    for (const clip of FREE_HAND_CLIPS) for (const held of ITEMS) for (const [i, t] of times(clip).entries()) for (const [b, l] of LOOKS) {
      const first = b === 0 && l === 0;
      if (!first && i % 2 === 1) continue;
      for (const at of first ? HOMES : HOMES.slice(0, 1)) {
        if (itemCrossesHead(ins.parts(rig.samplePose(S, clip, t), dressOf(held, b, l), at))) bad.push(`${clip} ${held} t${t} f${at.facing} b${b} l${l}`);
      }
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });
  it("the item is still drawn, put away, and both hands are empty, every frame of the clip", () => {
    const bad: string[] = [];
    for (const clip of FREE_HAND_CLIPS) for (const held of ITEMS) for (const t of times(clip)) for (const [b, l] of [[0, 0], [2, 1]] as const) {
      const parts = ins.parts(rig.samplePose(S, clip, t), dressOf(held, b, l), HOMES[0]!);
      if (!parts.some((p) => p.tag?.startsWith("stowed:"))) bad.push(`${clip} ${held} t${t} b${b}: not drawn`);
      if (parts.some((p) => p.tag?.startsWith("item:"))) bad.push(`${clip} ${held} t${t} b${b}: still in a hand`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });
  it("planted fault: a stowed item placed over the head is caught", () => {
    // a stowed item counts as an item: move the drawn stowed parts onto the head's transform
    const parts = ins.parts(rig.samplePose(S, "ears", 100), dressOf("pipe"), HOMES[0]!);
    const head = parts.find((p) => p.tag === "head" && !p.ink)!;
    const moved = parts.map((p) => (p.tag?.startsWith("stowed:") ? { ...p, xf: head.xf } : p));
    expect(itemCrossesHead(moved)).toBe(true);
  });
  it("outside those clips the item stays in the hand", () => {
    for (const clip of ["idle", "hit-light", "taunt"]) for (const held of ["pipe", "machete", "sledgehammer"] as HeldId[]) {
      const parts = ins.parts(rig.samplePose(S, clip, 100), dressOf(held), HOMES[0]!);
      expect(parts.some((p) => p.tag === "item:F")).toBe(true);
      expect(parts.some((p) => p.tag?.startsWith("stowed:"))).toBe(false);
    }
  });
  it("planted fault: the ears pose with the stow channel off puts the pipe through the head", () => {
    const p = rig.samplePose(S, "ears", 0);
    const rot = [...p.rot];
    rot[BONE.stow] = 0;
    const off: Pose = { ...p, rot };
    expect(itemCrossesHead(ins.parts(off, dressOf("pipe"), HOMES[0]!))).toBe(true);
  });
});

describe("free hands: the put-away is a motion, seen through the stage's crossfade", () => {
  it("the channel is wide enough that the stage gives the put-away its longest crossfade", () => {
    expect(STOW.on * FADE.msPerDeg).toBeGreaterThanOrEqual(FADE.ms);
  });
  it("no held item lies across the head on the way in or out", () => {
    const bad: string[] = [];
    let grazes = 0;
    for (const clip of FREE_HAND_CLIPS) for (const [fromClip, ft] of FROM) for (const out of [false, true]) {
      if (out && (fromClip !== "idle" || ft !== 0)) continue;
      const poses = fadePoses(clip, rig.samplePose(S, fromClip, ft), out);
      for (const held of ITEMS) for (const [b, l] of [[0, 0], [2, 1]] as const) {
        if (b !== 0 && fromClip !== "idle") continue;
        // an item that is in front of the head in the hand before the cut (a cross wrench or a
        // pair held up in guard) is still there for the first frames: that is the stance, not the put-away
        // (and on the way out it is back there for the last frames)
        const rest = itemCrossesHead(ins.parts(poses[out ? poses.length - 1 : 0]!, dressOf(held, b, l), HOMES[0]!));
        let run = 0;
        poses.forEach((p, i) => {
          const exempt = rest && (out ? i * FADE.step >= FADE.ms - 60 : i * FADE.step <= 40);
          run = !exempt && itemCrossesHead(ins.parts(p, dressOf(held, b, l), HOMES[0]!)) ? run + 1 : 0;
          if (run > 0) grazes++;
          if (run > GRAZE) bad.push(`${clip} ${out ? "out" : `in from ${fromClip}@${ft}`} ${held} t${i * FADE.step} b${b}`);
        });
      }
    }
    expect(bad.slice(0, 16)).toEqual([]);
    // and such a touch is rare: a few of the bulky and the linked items, not the rule
    expect(grazes).toBeLessThan(60);
  });
  it("the item travels from the hand to where it is kept and back: it never jumps", () => {
    const bad: string[] = [];
    let arrived = 0;
    for (const clip of FREE_HAND_CLIPS) for (const out of [false, true]) {
      const poses = fadePoses(clip, rig.samplePose(S, "idle", 0), out);
      for (const held of ITEMS) {
        const mids = poses.map((p) => itemMiddle(ins.parts(p, dressOf(held), HOMES[0]!)));
        for (let i = 1; i < mids.length; i++) {
          const d = Math.hypot(mids[i]![0] - mids[i - 1]![0], mids[i]![1] - mids[i - 1]![1]);
          if (d > MAX_STEP) bad.push(`${clip} ${out ? "out" : "in"} ${held} t${i * FADE.step}: moved ${d.toFixed(1)}`);
        }
        // it does end up put away (in) or in the hand (out)
        const last = ins.parts(poses[poses.length - 1]!, dressOf(held), HOMES[0]!);
        if (last.some((p) => p.tag?.startsWith(out ? "stowed:" : "item:"))) bad.push(`${clip} ${out ? "out" : "in"} ${held}: did not arrive`);
        else arrived++;
      }
    }
    expect(bad.slice(0, 16)).toEqual([]);
    expect(arrived).toBe(FREE_HAND_CLIPS.length * 2 * ITEMS.length);
  });
  it("planted fault: an item that flips from the hand to the back in one frame is caught", () => {
    const p = rig.samplePose(S, "ears", 0);
    const rot = [...p.rot];
    rot[BONE.stow] = 0;
    const a = itemMiddle(ins.parts({ ...p, rot }, dressOf("pipe"), HOMES[0]!));
    const b = itemMiddle(ins.parts(p, dressOf("pipe"), HOMES[0]!));
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(MAX_STEP);
  });
  it("planted fault: the crossfade with the item kept in the hand lays it across the head for frames on end", () => {
    // the same crossfade, the channel forced off: what the game drew while the item stayed in the hand
    const poses = fadePoses("ears", rig.samplePose(S, "idle", 0), false).map((p) => { const rot = [...p.rot]; rot[BONE.stow] = 0; return { ...p, rot }; });
    let run = 0;
    let longest = 0;
    for (const p of poses) { run = itemCrossesHead(ins.parts(p, dressOf("pipe"), HOMES[0]!)) ? run + 1 : 0; longest = Math.max(longest, run); }
    expect(longest).toBeGreaterThan(GRAZE * 3);
  });
  it("a long item slung on the back never hangs to the floor or under it", () => {
    const bad: string[] = [];
    for (const clip of FREE_HAND_CLIPS) for (const held of ITEMS) for (const t of times(clip)) for (const [b, l] of [[0, 0], [1, 0], [2, 1]] as const) {
      const parts = ins.parts(rig.samplePose(S, clip, t), dressOf(held, b, l), HOMES[0]!);
      const low = Math.max(...polysOf(parts.filter((p) => p.tag?.startsWith("stowed:"))).flat().map((p) => p[1]));
      if (low > 0.6) bad.push(`${clip} ${held} t${t} b${b}: ${low.toFixed(1)} under the floor`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });
});
