/**
 * The painter: style 13 on the Canvas 2D subset of the contract (no filter, no gradient, no
 * pattern). Every part is drawn the same way:
 *
 *   outline pass (per outline group = the integer part of `z`):
 *     the part's rough polygon, filled and stroked in Night Ink a little wider than the part;
 *   fill pass:
 *     clip to the part; fill its teal shadow colour; lay the halftone dots; fill the lit colour
 *     again, pushed toward the lamp (upper left) by 40% of the part's thickness, so a crescent
 *     of dotted shadow stays on the far side; then the part's own `shade` shape, if any.
 *
 * Outlines of one group go under all fills of that group, so the joints inside a limb (elbow,
 * knee) read as one limb, and a group drawn later (a front arm) gets a full outline over what is
 * behind it. A shape with slot "ink" is a line or a dark detail: filled, no outline, no shadow.
 * Rough lines and dots are made once per path and cached; nothing here is random.
 */
import type { DrawEnv, Shape } from "../contracts";
import { BACK_VEIL, DOT, FLASH, HALFTONE, INK, LIGHT, LINE, ROUGH, TEAL } from "../gate/style";
import type { Pt } from "../gate/vocab";
import { bbox, dPoly, halftone, parsePolys, roughPoly, seedOf, thickness } from "../gate/vocab";
import type { Xf } from "./pose";
import { invVec } from "./pose";

export interface PathArt { rough: string; dots: string; thick: number; polys: Pt[][] }
const artCache = new Map<string, PathArt>();
export function artOf(d: string): PathArt {
  let a = artCache.get(d);
  if (a === undefined) {
    const polys = parsePolys(d);
    const seed = seedOf(d);
    const rough = polys.map((p, i) => dPoly(roughPoly(p, seed + i * 7919, ROUGH.amp, ROUGH.seg))).join("");
    const [x0, y0, x1, y1] = bbox(polys);
    const thick = polys.reduce((m, p) => Math.max(m, thickness(p)), 0);
    const dots = Number.isFinite(x0) ? halftone(x0, y0, x1, y1, HALFTONE.step, HALFTONE.r, HALFTONE.angle) : "";
    a = { rough, dots, thick, polys };
    if (artCache.size > 20000) artCache.clear();
    artCache.set(d, a);
  }
  return a;
}

/** One part ready to paint: where its frame is on the stage and what colours it takes. */
export interface Paint {
  d: string;
  z: number;
  /** Bone frame to stage, with the build's width scale in it. */
  xf: Xf;
  lit: string;
  shade: string;
  /** "ink": no outline, no shadow. */
  ink: boolean;
  /** An extra shadow shape of the part (`Shape.shade`). */
  extra?: string;
  /** Push into the dark (back limbs). */
  veil?: boolean;
  /** Outline weight in stage units. */
  line?: number;
  /** Skip the outline (a tiny detail that has its own). */
  noOutline?: boolean;
  /** What the part is (a bone id, "item:F", "shield"...), for measuring the drawn picture. */
  tag?: string;
  /** The build's width scale in `xf` (limb and trunk parts). */
  kx?: number;
  /** For an item's part: the item drawing's own frame (where its grip and grip2 are). */
  item?: Xf;
}

function scaleOf(m: Xf): number { return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }

function withXf(env: DrawEnv, m: Xf, fn: () => void): void {
  const c = env.ctx;
  c.save();
  c.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  fn();
  c.restore();
}

/** Paints a list of parts in z order, by outline group. `white` is the hit flash. */
export function paintParts(env: DrawEnv, parts: readonly Paint[], white: boolean): void {
  const sorted = [...parts].sort((p, q) => p.z - q.z);
  const c = env.ctx;
  let i = 0;
  while (i < sorted.length) {
    const group = Math.floor(sorted[i]!.z);
    let j = i;
    while (j < sorted.length && Math.floor(sorted[j]!.z) === group) j++;
    const g = sorted.slice(i, j);
    // outlines
    for (const p of g) {
      if (p.ink || p.noOutline === true) continue;
      const art = artOf(p.d);
      withXf(env, p.xf, () => {
        const s = scaleOf(p.xf);
        const path = env.path(art.rough);
        c.fillStyle = INK;
        c.fill(path);
        c.strokeStyle = INK;
        c.lineWidth = (p.line ?? LINE.figure) / s;
        c.lineJoin = "round";
        c.lineCap = "round";
        c.stroke(path);
      });
    }
    // fills
    for (const p of g) {
      const path = env.path(p.d);
      if (p.ink) {
        withXf(env, p.xf, () => { c.fillStyle = white ? INK : INK; c.fill(path); });
        continue;
      }
      const art = artOf(p.d);
      withXf(env, p.xf, () => {
        if (white) {
          c.fillStyle = FLASH;
          c.fill(path);
          return;
        }
        c.save();
        c.clip(path);
        c.fillStyle = p.shade;
        c.fill(path);
        if (art.dots.length > 0) {
          c.fillStyle = DOT;
          c.globalAlpha = c.globalAlpha * 0.85;
          c.fill(env.path(art.dots));
          c.globalAlpha = c.globalAlpha / 0.85;
        }
        const s = scaleOf(p.xf);
        const k = LIGHT.share * art.thick * s;
        const [ox, oy] = invVec(p.xf, LIGHT.dx * k, LIGHT.dy * k);
        c.translate(ox, oy);
        c.fillStyle = p.lit;
        c.fill(path);
        c.translate(-ox, -oy);
        if (p.extra !== undefined) {
          c.fillStyle = p.shade;
          c.fill(env.path(p.extra));
        }
        if (p.veil === true) {
          const a = c.globalAlpha;
          c.globalAlpha = a * BACK_VEIL;
          c.fillStyle = TEAL;
          c.fill(path);
          c.globalAlpha = a;
        }
        c.restore();
      });
    }
    i = j;
  }
}

/** A part list entry from a `Shape` and its frame. */
export function paintOf(s: Shape, xf: Xf, lit: string, shade: string, veil = false): Paint {
  const p: Paint = { d: s.d, z: s.z, xf, lit, shade, ink: s.slot === "ink", veil };
  if (s.shade !== undefined) p.extra = s.shade;
  return p;
}
