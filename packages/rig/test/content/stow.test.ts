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
import { BONE, WORN_ITEMS } from "../../src/gate/skeleton";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const S = "scrapper" as const;
type Pt = readonly [number, number];

const ITEMS = (Object.keys(WEAPON_META) as HeldId[]).filter((h) => h !== "fists" && !WORN_ITEMS.includes(h));
const dressOf = (held: HeldId): Dress => ({ look: { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 },
  held, shield: null, scale: 1 });

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
  const item = polysOf(parts.filter((p) => p.tag !== undefined && p.tag.startsWith("item:")));
  if (head.length === 0 || item.length === 0) return false;
  return dense(item).some((p) => head.some((h) => inside(p, h))) || dense(head).some((p) => item.some((q) => inside(p, q)));
}
const times = (clip: string): number[] => {
  const d = rig.clipInfo(S, clip).durationMs;
  return Array.from({ length: Math.round(d / 40) + 1 }, (_, i) => Math.min(d, i * 40));
};
const HOMES: Place[] = [{ x: 0, y: 0, facing: 1 }, { x: 0, y: 0, facing: -1 }];

describe("free hands: a Move reaction puts the held item away", () => {
  it("names the four hands-at-the-head clips", () => {
    expect([...FREE_HAND_CLIPS].sort()).toEqual(["angry", "ears", "rub-eyes", "snared"]);
  });
  it("no held item crosses the head in ears, rub-eyes, angry or snared", () => {
    const bad: string[] = [];
    for (const clip of FREE_HAND_CLIPS) for (const held of ITEMS) for (const t of times(clip)) for (const at of HOMES) {
      if (itemCrossesHead(ins.parts(rig.samplePose(S, clip, t), dressOf(held), at))) bad.push(`${clip} ${held} t${t} f${at.facing}`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });
  it("the item is still drawn, put away, and both hands are empty", () => {
    const bad: string[] = [];
    for (const clip of FREE_HAND_CLIPS) for (const held of ITEMS) {
      const parts = ins.parts(rig.samplePose(S, clip, 100), dressOf(held), HOMES[0]!);
      if (!parts.some((p) => p.tag?.startsWith("stowed:"))) bad.push(`${clip} ${held}: not drawn`);
      if (parts.some((p) => p.tag?.startsWith("item:"))) bad.push(`${clip} ${held}: still in a hand`);
    }
    expect(bad).toEqual([]);
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
