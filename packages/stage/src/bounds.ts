/**
 * The drawn box of one actor, measured from the rig's own drawing: `drawActor` is run on a probe
 * context that paints nothing and only notes every point a fill, stroke or rect reaches, through
 * the current transform. The rig has no bounds call, so this is how the stage learns how big a
 * companion is drawn (for the per-rig scale and the pets' marks) and how much of a fighter a pet
 * covers (the tests). A path string is read as pairs of numbers: the rig writes absolute M/L/Z
 * polygons, and for any other path the control points still bound the shape. Arcs and ellipses
 * add their bounding box. A part drawn at (nearly) no opacity does not count.
 */
import type { CompanionId } from "@rankzero/core";
import type { Ctx2D, Dress, Pose, Rig, RigId } from "@rankzero/rig";
import type { Reach } from "./layout";

export interface Box { x0: number; y0: number; x1: number; y1: number }

type P = [number, number];
const paths = new Map<string, P[]>();

/** The box `drawActor` paints for this pose and dress at this place, in stage units. */
export function drawnBox(rig: Rig, pose: Pose, dress: Dress, at: { x: number; y: number; facing: 1 | -1 }): Box {
  let m = [1, 0, 0, 1, 0, 0];
  let alpha = 1;
  const stack: [number[], number][] = [];
  let path: P[] = [];
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const mul = (a: number, b: number, c: number, d: number, e: number, f: number): void => {
    m = [m[0]! * a + m[2]! * b, m[1]! * a + m[3]! * b, m[0]! * c + m[2]! * d, m[1]! * c + m[3]! * d,
      m[0]! * e + m[2]! * f + m[4]!, m[1]! * e + m[3]! * f + m[5]!];
  };
  const to = (x: number, y: number): P => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
  const add = (pts: readonly P[]): void => {
    if (alpha <= 0.05) return;
    for (const [x, y] of pts) {
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
    }
  };
  /** Every pair of numbers of a call, as points through the transform. */
  const pts = (n: number[]): P[] => { const o: P[] = []; for (let i = 0; i + 1 < n.length; i += 2) o.push(to(n[i]!, n[i + 1]!)); return o; };
  const oval = (x: number, y: number, rx: number, ry: number): void => { path.push(...pts([x - rx, y - ry, x + rx, y - ry, x - rx, y + ry, x + rx, y + ry])); };
  const rect = (x: number, y: number, w: number, h: number): P[] => pts([x, y, x + w, y, x, y + h, x + w, y + h]);
  const paint = (p?: unknown): void => add(Array.isArray(p) ? (p as P[]).map(([x, y]) => to(x, y)) : path);
  const calls: Record<string, (...a: number[]) => unknown> = {
    save: () => { stack.push([m, alpha]); },
    restore: () => { const s = stack.pop(); if (s !== undefined) [m, alpha] = s; },
    translate: (x, y) => mul(1, 0, 0, 1, x!, y!),
    rotate: (r) => mul(Math.cos(r!), Math.sin(r!), -Math.sin(r!), Math.cos(r!), 0, 0),
    scale: (x, y) => mul(x!, 0, 0, y!, 0, 0),
    transform: (a, b, c, d, e, f) => mul(a!, b!, c!, d!, e!, f!),
    setTransform: (a, b, c, d, e, f) => { m = [a!, b!, c!, d!, e!, f!]; },
    beginPath: () => { path = []; },
    moveTo: (...a) => { path.push(...pts(a)); },
    lineTo: (...a) => { path.push(...pts(a)); },
    quadraticCurveTo: (...a) => { path.push(...pts(a)); },
    bezierCurveTo: (...a) => { path.push(...pts(a)); },
    arc: (x, y, r) => oval(x!, y!, r!, r!),
    ellipse: (x, y, rx, ry, rot) => {
      const c = Math.abs(Math.cos(rot!));
      const s = Math.abs(Math.sin(rot!));
      oval(x!, y!, rx! * c + ry! * s, rx! * s + ry! * c);
    },
    rect: (x, y, w, h) => { path.push(...rect(x!, y!, w!, h!)); },
    fill: paint as () => void,
    stroke: paint as () => void,
    fillRect: (x, y, w, h) => add(rect(x!, y!, w!, h!)),
    strokeRect: (x, y, w, h) => add(rect(x!, y!, w!, h!)),
    measureText: () => ({ width: 0 }),
  };
  const ctx = new Proxy({}, {
    get: (_, k) => (k === "globalAlpha" ? alpha : calls[k as string] ?? (() => undefined)),
    set: (_, k, v) => { if (k === "globalAlpha") alpha = v as number; return true; },
  }) as Ctx2D;
  rig.drawActor({
    ctx,
    path: (d: string): unknown => {
      let p = paths.get(d);
      if (p === undefined) {
        const n = (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? []).map(Number);
        p = [];
        for (let i = 0; i + 1 < n.length; i += 2) p.push([n[i]!, n[i + 1]!]);
        if (paths.size > 4000) paths.clear();
        paths.set(d, p);
      }
      return p;
    },
  }, pose, dress, at);
  return box;
}

/** Box area, and the share of `of` that `by` covers (0 to 1). */
export function boxArea(b: Box): number { return Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0); }
export function coverOf(by: Box, of: Box): number {
  const w = Math.min(by.x1, of.x1) - Math.max(by.x0, of.x0);
  const h = Math.min(by.y1, of.y1) - Math.max(by.y0, of.y0);
  const a = boxArea(of);
  return w <= 0 || h <= 0 || a <= 0 ? 0 : (w * h) / a;
}

/** The reach (see layout.Reach) of an actor's whole idle loop in this dress, as the rig draws it:
 *  how layout.PET_REACH, SCRAPPER_REACH and PET_SCALE were measured, and how the tests check them. */
export function measureReach(rig: Rig, kind: RigId, dress: Dress): Reach {
  const ms = rig.clipInfo(kind, "idle").durationMs;
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let n = 0; n < 8; n++) {
    const q = drawnBox(rig, rig.samplePose(kind, "idle", (n * ms) / 8), dress, { x: 0, y: 0, facing: 1 });
    b.x0 = Math.min(b.x0, q.x0); b.y0 = Math.min(b.y0, q.y0); b.x1 = Math.max(b.x1, q.x1); b.y1 = Math.max(b.y1, q.y1);
  }
  return { back: -b.x0, front: b.x1, up: -b.y0, down: Math.max(0, b.y1) };
}
/** The largest scale at which a pet stands no taller than `share` of a fighter (build 0, empty hands). */
export function scaleForShare(rig: Rig, kind: CompanionId, share: number): number {
  const fighter = measureReach(rig, "scrapper", { held: null, shield: null, scale: 1 }).up;
  return Math.min(1, (share * fighter) / measureReach(rig, kind, { held: null, shield: null, scale: 1 }).up);
}
