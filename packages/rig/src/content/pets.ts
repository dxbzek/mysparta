/**
 * The six pets (companions): a jointed rig each, every part on its own pin (each leg in three
 * pieces, the neck, the head, the tail in links, a bird's wings in two), and their shapes in the
 * style-13 hand. Facing right, units of the stage, y down, feet dropped onto the floor by the
 * sampler (no clip plants a foot). Bone names the engine reads: "body" (the hit point, the aim
 * bend) and "head" (its frontmost point is the mouth, beak or tusk: the striking end).
 *
 * A leg hangs along +y at rest (its shapes are drawn that way); a neck, a head and a tail are
 * drawn in their natural rest direction. Colour slots of a pet (engine): "skin" and "top" its
 * body colour, "hair" its dark colour, "accent" its light colour, plus "white" and "ink".
 *
 * Every pet has all six companion clips (animation pass, 16 Nov 2026): `pet-clips.ts`.
 */
import type { CompanionId } from "@rankzero/core";
import type { BoneDef, ColourSlot, RigDef, Shape } from "../contracts";
import { alleyCatClips, boarClips, crowClips, raccoonClips } from "./pet-clips";
import type { PetArt } from "./pets/kind";
import { strayDog } from "./pets/stray-dog";
import { goose } from "./pets/goose";
import type { Poly, Pt } from "../gate/vocab";
import { dPoly, dPolys, ellipsePoly, inkLine, limb, quad, rotPt } from "../gate/vocab";

export type { PetArt };

class Builder {
  bones: BoneDef[] = [{ id: "root", parent: -1, x: 0, y: 0 }];
  shapes: Shape[] = [];
  bone(id: string, parent: string, x: number, y: number, limit?: readonly [number, number]): this {
    const p = this.bones.findIndex((b) => b.id === parent);
    if (p < 0) throw new Error(`no bone ${parent}`);
    const b: BoneDef = { id, parent: p, x, y };
    if (limit !== undefined) b.limit = limit;
    this.bones.push(b);
    return this;
  }
  fill(bone: string, pts: Poly, slot: ColourSlot, z: number, shade?: Poly): this {
    const s: Shape = { bone, d: dPoly(pts), slot, z };
    if (shade !== undefined) s.shade = dPoly(shade);
    this.shapes.push(s);
    return this;
  }
  fills(bone: string, list: readonly Poly[], slot: ColourSlot, z: number): this {
    this.shapes.push({ bone, d: dPolys(list), slot, z });
    return this;
  }
  ink(bone: string, pts: Poly, w: number, z: number, taper = true): this {
    this.shapes.push({ bone, d: dPoly(inkLine(pts, w, taper)), slot: "ink", z });
    return this;
  }
  inks(bone: string, list: readonly Poly[], w: number, z: number, taper = true): this {
    this.shapes.push({ bone, d: dPolys(list.map((p) => inkLine(p, w, taper))), slot: "ink", z });
    return this;
  }
  /**
   * A three-piece leg on `parent` at (x, y): upper, lower and the paw / hoof / foot, each its own
   * bone. `w` half-widths at the top of the upper, the knee, the ankle and the paw.
   */
  leg(name: string, parent: string, x: number, y: number, len: readonly [number, number, number], w: readonly [number, number, number, number],
    slot: ColourSlot, z: number, foot: (b: Builder, bone: string, z: number) => void, limits?: { lo: readonly [number, number] }): this {
    this.bone(`${name}.up`, parent, x, y, [-80, 80]);
    this.bone(`${name}.lo`, `${name}.up`, 0, len[0], limits?.lo ?? [-120, 120]);
    this.bone(`${name}.paw`, `${name}.lo`, 0, len[1], [-80, 80]);
    this.fill(`${name}.up`, limb(len[0], [[0, w[0], w[0]], [0.6, w[0] * 0.92, w[0] * 0.92], [1, w[1], w[1]]]), slot, z);
    this.fill(`${name}.lo`, limb(len[1], [[0, w[1], w[1]], [1, w[2], w[2]]]), slot, z + 0.1);
    foot(this, `${name}.paw`, z + 0.2);
    void len[2];
    void w[3];
    return this;
  }
  rig(id: CompanionId, height: number): RigDef { return { id, height, bones: this.bones }; }
}

/** A chain of `n` points of a smooth curve, for tails and necks. */
function curve(a: Pt, c: Pt, b: Pt, n = 8): Pt[] { return quad(a, c, b, n); }
/** A tapering band along a polyline (a tail, a neck), half-widths w0 at the start and w1 at the end. */
function taper(pts: Poly, w0: number, w1: number, round = true): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const t = i / (pts.length - 1);
    const h = w0 + (w1 - w0) * t;
    const p = pts[i]!;
    left.push([p[0] - (dy / l) * h, p[1] + (dx / l) * h]);
    right.push([p[0] + (dy / l) * h, p[1] - (dx / l) * h]);
  }
  const end: Pt[] = [];
  if (round) {
    const p = pts[pts.length - 1]!;
    const q = pts[pts.length - 2]!;
    const ang = Math.atan2(p[1] - q[1], p[0] - q[0]);
    for (let k = 1; k < 5; k++) { const g = ang - Math.PI / 2 + (Math.PI * k) / 5; end.push([p[0] + Math.cos(g) * w1, p[1] + Math.sin(g) * w1]); }
  }
  return [...left, ...end.reverse().reverse(), ...right.reverse()];
}
const R = (pts: Poly, deg: number, ox = 0, oy = 0): Pt[] => pts.map((p) => { const r = rotPt(p, deg); return [r[0] + ox, r[1] + oy] as Pt; });

/** A paw: a rounded pad pointing forward along the floor, with toe lines. */
const paw = (len: number, h: number, slot: ColourSlot = "skin", toes = true) => (b: Builder, bone: string, z: number): void => {
  b.fill(bone, limb(len, [[0, h * 0.9, h * 0.9], [1, h * 0.8, h * 0.8]]), slot, z);
  b.fill(bone, [[-h * 0.9, len - h * 0.2], [h * 2.4, len - h * 0.5], [h * 2.9, len + h * 0.5], [h * 2.2, len + h * 1.0], [-h * 1.0, len + h * 1.0]], slot, z + 0.05);
  if (toes) b.inks(bone, [[[h * 1.2, len + 0.1], [h * 1.3, len + h * 0.9]], [[h * 2.0, len], [h * 2.1, len + h * 0.9]]], 0.22, z + 0.06, false);
};
/** A cloven hoof. */
const hoof = (len: number, h: number) => (b: Builder, bone: string, z: number): void => {
  b.fill(bone, limb(len, [[0, h, h], [1, h * 0.95, h * 0.95]]), "skin", z);
  b.fill(bone, [[-h * 1.1, len - 0.6], [h * 1.3, len - 0.8], [h * 1.9, len + 1.6], [-h * 1.2, len + 1.6]], "hair", z + 0.05);
  b.ink(bone, [[h * 0.4, len - 0.4], [h * 0.5, len + 1.5]], 0.3, z + 0.06, false);
};
/** A bird's foot: a scaly shank and three toes forward, one back. */
const birdFoot = (len: number, slot: ColourSlot) => (b: Builder, bone: string, z: number): void => {
  b.fill(bone, limb(len, [[0, 0.75, 0.75], [1, 0.6, 0.6]]), slot, z);
  b.fill(bone, [[-2.6, len + 0.2], [-0.4, len - 0.5], [2.4, len - 0.3], [5.6, len + 0.3], [5.8, len + 1.0], [2, len + 1.0], [-2.6, len + 1.0]], slot, z + 0.05);
  b.inks(bone, [[[0.2, len - 0.2], [0.4, len + 0.3]], [[0.2, len * 0.3], [0.2, len * 0.6]]], 0.18, z + 0.06, false);
};

/** The idle pose of the four legs of a quadruped (hind: thigh forward, hock back; fore straight). */
function legsAt(h: [number, number, number], f: [number, number, number]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of ["B", "F"]) {
    const dh = s === "B" ? 4 : 0;
    out[`hind${s}.up`] = h[0] + dh; out[`hind${s}.lo`] = h[1]; out[`hind${s}.paw`] = h[2] - dh;
    out[`fore${s}.up`] = f[0] - dh; out[`fore${s}.lo`] = f[1]; out[`fore${s}.paw`] = f[2] + dh;
  }
  return out;
}

// ---------------------------------------------------------------------------------- cat
function alleyCat(): PetArt {
  const b = new Builder();
  b.bone("body", "root", 0, -14);
  b.leg("hindB", "body", -8, 0.5, [5.4, 5.6, 4], [2.1, 1.2, 0.9, 1], "skin", 10, paw(3.4, 0.95));
  b.leg("foreB", "body", 8, 1.4, [5.2, 5.4, 3], [1.7, 1.15, 0.95, 1], "skin", 10, paw(2.6, 0.95));
  b.bone("tail1", "body", -10.6, -2, [-80, 80]).bone("tail2", "tail1", -6, -2, [-80, 80]).bone("tail3", "tail2", -5.4, -3.4, [-80, 80]);
  b.fill("tail1", taper([[0.4, 0], [-3, -0.6], [-6.2, -2]], 1.2, 1.05, false), "skin", 15);
  b.fill("tail2", taper([[0.4, 0], [-3, -1.2], [-5.6, -3.4]], 1.05, 0.95, false), "skin", 15.1);
  b.fill("tail3", taper([[0.4, 0], [-1.4, -2.8], [-1.2, -6]], 0.95, 0.9), "skin", 15.2);
  b.inks("tail2", [[[-1.6, -1.6], [-1.0, 0.4]], [[-3.8, -2.6], [-3.2, -0.8]]], 0.5, 15.25);
  b.ink("tail3", [[-0.6, -3.6], [0.6, -3.0]], 0.5, 15.25);
  b.fill("body", [[-11.6, -1.2], [-9, -4.4], [-2, -4.2], [5, -4.6], [10.4, -3.8], [12, 0], [10.6, 3.4], [5, 3.6], [-2, 2.6], [-9, 3.4], [-11.8, 1.6]], "skin", 20,
    [[-2, 2.6], [5, 3.6], [10.6, 3.4], [8, 2.2]]);
  b.fill("body", [[4, 1.8], [10.6, 1.0], [10.6, 3.4], [5, 3.6]], "accent", 20.1);
  b.inks("body", [[[-7, -4], [-6.2, -1.6]], [[-4, -4.2], [-3.4, -1.2]], [[-1, -4.3], [-0.6, -1.6]], [[2, -4.5], [2.4, -2]]], 0.55, 20.2);
  b.bone("neck", "body", 10, -2.4, [-50, 50]).bone("head", "neck", 2.6, -4.2, [-60, 60]);
  b.fill("neck", [[-2.4, 2.4], [-1.4, -1.6], [2, -4.4], [4.6, -2.6], [3.6, 1.6], [0.6, 3.6]], "skin", 25);
  b.fill("head", [[-2.6, 0.6], [-3, -2.2], [-1.6, -4.4], [1.6, -5], [4.4, -4], [6.2, -1.8], [6.8, 0.2], [5.6, 1.8], [2.6, 2.6], [-0.6, 2.4]], "skin", 30,
    [[-0.6, 2.4], [2.6, 2.6], [5.6, 1.8], [3, 1.2]]);
  b.fill("head", [[3.6, 0], [6.8, 0.2], [5.6, 1.8], [3.4, 1.8]], "accent", 30.1);
  b.fill("head", [[-1.8, -3.6], [-1.6, -8.6], [1.6, -4.8]], "skin", 30.2);
  b.fill("head", [[1.2, -4.6], [3.2, -8.8], [4.4, -3.8]], "skin", 30.2);
  b.fill("head", [[-1.2, -4.4], [-1.2, -7.2], [0.6, -4.8]], "accent", 30.25);
  b.fill("head", [[2.8, -2.6], [4.6, -2.8], [4.4, -1.6], [3.0, -1.6]], "white", 30.3);
  b.fill("head", [[3.5, -2.7], [3.9, -2.7], [3.9, -1.7], [3.5, -1.7]], "ink", 30.35);
  b.fill("head", ellipsePoly(6.6, -0.4, 0.55, 0.4, 8), "hair", 30.36);
  b.inks("head", [[[5, 0.6], [8.6, 0.0]], [[5, 1.0], [8.4, 1.4]], [[1.6, -3.6], [4.8, -3.4]]], 0.18, 30.4);
  b.ink("head", [[3.4, -6.6], [3.8, -5.2]], 0.35, 30.4); // a notched ear
  b.leg("hindF", "body", -7.4, 1, [5.4, 5.6, 4], [2.3, 1.3, 0.95, 1], "skin", 40, paw(3.4, 1.0));
  b.leg("foreF", "body", 9, 2, [5.2, 5.4, 3], [1.85, 1.2, 1.0, 1], "skin", 40, paw(2.6, 1.0));
  const rest = { ...legsAt([-26, 58, -30], [4, -6, 2]), body: 0, neck: 0, head: 4, tail1: -10, tail2: 30, tail3: 30 };
  return { rig: b.rig("alley-cat", 26), shapes: b.shapes, clips: alleyCatClips(rest, { body: -1, head: 2, tail1: -4, tail2: 22, tail3: 46 }) };
}

// ------------------------------------------------------------------------------ raccoon
function raccoon(): PetArt {
  const b = new Builder();
  b.bone("body", "root", 0, -12.4);
  b.leg("hindB", "body", -8, 1, [4.6, 4.8, 3], [2.6, 1.5, 1.2, 1], "hair", 10, paw(3, 1.2, "hair"));
  b.leg("foreB", "body", 8, 2, [4.2, 4.4, 2], [1.9, 1.3, 1.1, 1], "hair", 10, paw(2.4, 1.1, "hair"));
  b.bone("tail1", "body", -11, -2, [-70, 70]).bone("tail2", "tail1", -5, -1.4, [-70, 70]).bone("tail3", "tail2", -4.8, -1.2, [-70, 70]);
  const ringed = (bone: string, len: number, w0: number, w1: number, z: number, tipDark: boolean): void => {
    b.fill(bone, taper([[0.8, 0], [-len, -len * 0.25]], w0, w1, tipDark), "skin", z);
    b.inks(bone, [[[-len * 0.3, -w0 - 0.2], [-len * 0.3 - 0.4, w0 + 0.2]], [[-len * 0.75, -w1 - 0.3], [-len * 0.75 - 0.4, w1]]], 1.1, z + 0.05, false);
    if (tipDark) b.fill(bone, ellipsePoly(-len - 0.4, -len * 0.25, w1 * 0.9, w1 * 0.9, 10), "hair", z + 0.06);
  };
  ringed("tail1", 5, 2.4, 2.9, 15, false);
  ringed("tail2", 4.8, 2.9, 2.7, 15.1, false);
  ringed("tail3", 4.6, 2.7, 1.8, 15.2, true);
  // hunched body, belly pale
  b.fill("body", [[-12.2, -1], [-10, -5.6], [-4, -8.2], [2, -8], [8, -6], [11.6, -3], [12, 1.4], [9.6, 4.2], [3, 4.4], [-4, 4.4], [-10, 3.6], [-12.6, 1.6]], "skin", 20,
    [[-4, 4.4], [3, 4.4], [9.6, 4.2], [6, 2.6], [-2, 2.8]]);
  b.fill("body", [[0, 2], [9, 0.6], [9.6, 4.2], [3, 4.4], [-2, 4.2]], "accent", 20.1);
  b.inks("body", [[[-6, -6.6], [-4.6, -4]], [[-2, -7.6], [-0.8, -5.2]], [[2.4, -7.6], [3.2, -5.4]]], 0.3, 20.2);
  b.bone("neck", "body", 10, -2.6, [-50, 50]).bone("head", "neck", 2.8, -1.6, [-60, 60]);
  b.fill("neck", [[-2.4, 3.4], [-2, -3.2], [2.6, -4.2], [4.4, 0.4], [2.6, 3.6]], "skin", 25);
  b.fill("head", [[-3.2, 1.2], [-3.4, -2.8], [-1, -4.8], [2.6, -4.6], [6, -2.8], [8.8, -1], [9.8, 0.2], [8.8, 1.2], [5, 1.6], [1, 3.2], [-2, 3]], "skin", 30,
    [[1, 3.2], [5, 1.6], [8.8, 1.2], [6, 2.6]]);
  b.fill("head", [[-0.8, -1.6], [2.2, -3.4], [5.6, -2.4], [7.2, -0.8], [5, -0.2], [2.4, -0.8], [-0.4, 0.4]], "hair", 30.1); // the mask
  b.fill("head", [[0, -3.6], [3, -4.6], [5.8, -3], [3, -3.2]], "accent", 30.15);
  b.fill("head", [[5.4, 0.4], [8.8, -0.2], [8.8, 1.2], [5.4, 1.4]], "accent", 30.15);
  b.fill("head", ellipsePoly(9.6, -0.3, 0.75, 0.6, 8), "hair", 30.2);
  b.fill("head", ellipsePoly(3.4, -1.7, 0.7, 0.6, 8), "white", 30.25);
  b.fill("head", ellipsePoly(3.6, -1.6, 0.36, 0.36, 6), "ink", 30.3);
  b.fill("head", [[-2.6, -3], [-2.6, -7], [0.6, -4.4]], "skin", 30.35);
  b.fill("head", [[-2.0, -3.6], [-2.1, -5.8], [-0.2, -4.2]], "accent", 30.4);
  b.leg("hindF", "body", -7, 1.6, [4.6, 4.8, 3], [2.8, 1.6, 1.25, 1], "hair", 40, paw(3, 1.25, "hair"));
  b.leg("foreF", "body", 9, 2.6, [4.2, 4.4, 2], [2.0, 1.35, 1.15, 1], "hair", 40, paw(2.4, 1.15, "hair"));
  const rest = { ...legsAt([-28, 56, -28], [8, -10, 2]), body: 2, neck: 0, head: 4, tail1: -12, tail2: -14, tail3: -10 };
  return { rig: b.rig("raccoon", 26), shapes: b.shapes, clips: raccoonClips(rest, { body: 0.5, head: 1, tail1: -6, tail2: -6, tail3: -2 }) };
}

// --------------------------------------------------------------------------------- boar
function boar(): PetArt {
  const b = new Builder();
  b.bone("body", "root", 0, -25);
  b.leg("hindB", "body", -22, 4, [9.4, 9, 5], [5, 3, 2.2, 1], "skin", 10, hoof(5, 2.1));
  b.leg("foreB", "body", 19, 6, [8.6, 8.6, 5], [4.6, 2.8, 2.2, 1], "skin", 10, hoof(5, 2.1));
  b.bone("tail1", "body", -30, -6, [-60, 60]).bone("tail2", "tail1", -3, 2.4, [-60, 60]).bone("tail3", "tail2", -1.2, 3, [-60, 60]);
  b.fill("tail1", taper([[0.6, 0], [-3, 2.4]], 0.9, 0.75, false), "skin", 15);
  b.fill("tail2", taper([[0.3, 0], [-1.2, 3]], 0.75, 0.6, false), "skin", 15.1);
  b.fill("tail3", [[-0.8, -0.2], [0.8, -0.2], [1.6, 3.2], [0, 4.6], [-1.6, 3.2]], "hair", 15.2);
  // heavy front, a bristled ridge down the spine
  b.fill("body", [[-31.4, 0], [-29, -9.6], [-20, -14.6], [-6, -16.8], [8, -19], [20, -18.6], [28.6, -12], [31.2, -2], [30, 7], [24, 11.4], [10, 12], [-6, 11], [-20, 10.4], [-29, 7]], "skin", 20,
    [[-6, 11], [10, 12], [24, 11.4], [20, 8.4], [4, 9]]);
  b.fill("body", [[-24, -12.6], [-20, -16.4], [-16, -14.8], [-12, -18.8], [-8, -16.4], [-3, -20.4], [1, -17.6], [6, -22.2], [10, -18.8], [15, -22.8], [18.6, -18.4], [23.4, -20.4], [25.6, -14.6], [14, -16.2], [0, -14.8], [-14, -12.8]], "hair", 20.1);
  b.inks("body", [[[-18, -4], [-14, 2]], [[-10, -6], [-6, 0]], [[0, -8], [3, -1]], [[10, -9], [12, -2]], [[-22, 4], [-12, 7.4], [2, 8.6]]], 0.45, 20.2);
  b.bone("neck", "body", 27, -6, [-40, 40]).bone("head", "neck", 4, 1, [-60, 60]);
  b.fill("neck", [[-5, -11], [3, -12], [8, -6], [7, 8], [-2, 10]], "skin", 25);
  b.fill("head", [[-2.4, -11], [6, -10.6], [13, -7], [19.6, -2.4], [21.6, 1], [21.4, 6.6], [17, 8.4], [9, 8.6], [1, 9.6], [-3.4, 4]], "skin", 30,
    [[1, 9.6], [9, 8.6], [17, 8.4], [14, 6.4], [4, 7.2]]);
  b.fill("head", [[-2.4, -11], [6, -10.6], [9, -8.6], [2, -8.4], [-3, -6]], "hair", 30.05);
  b.fill("head", ellipsePoly(21.4, 3.8, 1.9, 3.1, 14), "accent", 30.1); // the snout disc
  b.fills("head", [ellipsePoly(21.8, 2.6, 0.5, 0.8, 6), ellipsePoly(21.8, 5.0, 0.5, 0.8, 6)], "ink", 30.15);
  b.fill("head", [[14.6, 6.6], [17.4, 6.0], [20.4, 2.8], [21.4, -1.8], [20.2, -2.2], [18, 1.4], [14.6, 4.6]], "white", 30.2); // the tusk
  b.ink("head", [[16.4, 5.4], [19.4, 1.6]], 0.2, 30.25);
  b.fill("head", ellipsePoly(9.6, -3.4, 1.0, 0.8, 8), "ink", 30.3);
  b.ink("head", [[7.6, -5.4], [11.6, -4.8]], 0.55, 30.3);
  b.inks("head", [[[12, -0.8], [16, 1.4]], [[8, 3], [13.6, 4]]], 0.32, 30.3);
  b.fill("head", [[-0.6, -9.4], [-2.6, -16.4], [1.4, -14.2], [4.4, -10]], "skin", 30.4);
  b.fill("head", [[-0.4, -10.6], [-1.6, -14.4], [1.0, -13.4], [2.6, -10.6]], "accent", 30.45);
  b.leg("hindF", "body", -20, 5, [9.4, 9, 5], [5.4, 3.2, 2.3, 1], "skin", 40, hoof(5, 2.2));
  b.leg("foreF", "body", 21, 7, [8.6, 8.6, 5], [5, 3, 2.3, 1], "skin", 40, hoof(5, 2.2));
  const rest = { ...legsAt([-14, 26, -12], [6, -6, 0]), body: 0, neck: 0, head: 10, tail1: -10, tail2: 10, tail3: 10 };
  return { rig: b.rig("boar", 52), shapes: b.shapes, clips: boarClips(rest, { body: -0.6, head: 13, tail1: 14, tail2: 26 }) };
}

// --------------------------------------------------------------------------------- crow
function crow(): PetArt {
  const b = new Builder();
  b.bone("body", "root", 0, -11);
  const legs = (s: "B" | "F", z: number, dx: number): void => {
    b.bone(`leg${s}.up`, "body", dx, 3.4, [-70, 70]).bone(`leg${s}.lo`, `leg${s}.up`, 0, 2.6, [-100, 100]).bone(`leg${s}.foot`, `leg${s}.lo`, 0, 5.4, [-70, 70]);
    b.fill(`leg${s}.up`, limb(2.6, [[0, 1.8, 1.8], [1, 1.0, 1.0]]), "skin", z);
    b.fill(`leg${s}.lo`, limb(5.4, [[0, 0.62, 0.62], [1, 0.5, 0.5]]), "hair", z + 0.1);
    birdFoot(0.6, "hair")(b, `leg${s}.foot`, z + 0.2);
  };
  legs("B", 10, -1);
  b.bone("tail", "body", -6, -1, [-40, 40]);
  b.fill("tail", [[1, -1.6], [-6, -1.2], [-9.6, 0.4], [-8, 1.6], [-9.2, 2.4], [-6.4, 2.6], [1, 1.6]], "skin", 15);
  b.inks("tail", [[[-2, 0], [-8, 0.8]], [[-2, 1], [-7.4, 2]]], 0.2, 15.1);
  b.fill("body", [[-7.6, -0.6], [-5.4, -4.6], [0, -6.2], [5.4, -5.6], [8, -2.4], [7.4, 2.4], [3.4, 4.6], [-2, 4.4], [-6.2, 2.4]], "skin", 20,
    [[-2, 4.4], [3.4, 4.6], [7.4, 2.4], [4, 2.6]]);
  b.fill("body", [[-4.8, -4.2], [0, -5.8], [5, -5.2], [1.6, -4.4], [-2.6, -3.4]], "accent", 20.1); // blue-grey sheen on the back
  b.bone("wingB", "body", 3, -3.4, [-90, 60]).bone("wingB.tip", "wingB", -7, 1, [-60, 60]);
  b.bone("wingF", "body", 3.6, -3, [-90, 60]).bone("wingF.tip", "wingF", -7, 1.2, [-60, 60]);
  const wing = (s: "B" | "F", z: number): void => {
    b.fill(`wing${s}`, [[1.6, -1.6], [-3, -2.4], [-7.6, -1.2], [-7.8, 1.6], [-3, 3], [1.4, 2]], "skin", z);
    b.inks(`wing${s}`, [[[-1.4, 0], [-6.4, 0.8]], [[-1, 1.6], [-5.6, 2.2]]], 0.24, z + 0.05);
    b.fill(`wing${s}.tip`, [[1, -1.4], [-4, -1.2], [-9, 1.2], [-6.6, 1.8], [-8.2, 2.6], [-3.6, 2.4], [1, 1.8]], "hair", z + 0.1);
    b.fill(`wing${s}`, [[0.6, -1.4], [-3, -2.2], [-6.4, -1.4], [-3, -1.2]], "accent", z + 0.08);
    b.inks(`wing${s}.tip`, [[[-1.6, -0.2], [-7, 1.4]], [[-1.4, 1], [-6.2, 2.2]]], 0.18, z + 0.15);
    b.inks(`wing${s}`, [[[-2, -1.6], [-1, -0.6]]], 0.3, z + 0.06);
  };
  wing("B", 18);
  b.bone("neck", "body", 5.6, -3.6, [-50, 50]).bone("head", "neck", 1.6, -3.4, [-60, 60]);
  b.fill("neck", [[-2.4, 2.4], [-1.8, -2], [1.6, -4.2], [3.6, -2], [3, 2]], "skin", 25);
  b.fill("head", [[-2.6, 0.8], [-2.8, -1.8], [-1, -3.6], [1.8, -3.6], [3.6, -2], [3.8, 0.6], [1.6, 2], [-1, 2]], "skin", 30);
  b.fill("head", [[2.8, -2.2], [5.6, -2.0], [8.6, -0.2], [5.8, 0.2], [3.2, 0.8]], "accent", 30.1); // the heavy beak
  b.fill("head", [[3.2, 0.8], [5.8, 0.2], [8.2, 0.0], [5.6, 1.4], [3.4, 1.6]], "accent", 30.12);
  b.ink("head", [[3.2, 0.6], [8.2, 0]], 0.18, 30.15);
  b.fill("head", ellipsePoly(1.2, -1.6, 0.75, 0.75, 10), "white", 30.2);
  b.fill("head", ellipsePoly(1.35, -1.55, 0.4, 0.4, 8), "ink", 30.25);
  b.inks("head", [[[-1.8, -3.0], [-3.4, -4.2]], [[-1, -3.4], [-2.2, -4.8]]], 0.3, 30.3);
  wing("F", 45);
  legs("F", 40, 1);
  const rest = { body: -16, tail: 18, "legB.up": 10, "legB.lo": 4, "legB.foot": 2, "legF.up": 22, "legF.lo": -4, "legF.foot": -2,
    wingB: 8, "wingB.tip": -4, wingF: 8, "wingF.tip": -4, neck: 10, head: 12 };
  return { rig: b.rig("crow", 26), shapes: b.shapes, clips: crowClips(rest, { neck: 4, head: 20, tail: 20, "wingF.tip": -8 }) };
}

export const PET_ART: Record<CompanionId, PetArt> = {
  raccoon: raccoon(), goose: goose(), boar: boar(), "stray-dog": strayDog(), crow: crow(), "alley-cat": alleyCat(),
};
export { R as rotatePoly, curve };
