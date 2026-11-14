/**
 * The gate arena, "yard", drawn as the style-13 back alley: a teal brick wall at night, a sodium
 * street lamp on the left throwing orange light down the wall and onto the asphalt, a roll-up
 * shutter with a stencilled "0", a lit window, chain-link fence sections with four crowd
 * silhouettes behind them (they bob on a hit), grime, cracks, a puddle and the faded painted
 * ring on the floor. Stage geometry of brief 3.12: the wall is the top 46% (to y 110.4), the
 * floor the bottom 54%, actors stand on y 195.
 *
 * Everything static is precomputed once into path strings from a seeded generator, so a frame is
 * a handful of fills. Glow is stepped flat shapes with alpha (no gradient).
 */
import type { DrawEnv, StageDraw } from "../contracts";
import { ALLEY, GLOW, GLOW_HOT, INK, LAMP, LINE, TEAL_DEEP } from "./style";
import type { Pt } from "./vocab";
import { dPoly, dPolys, ellipsePoly, halftone, hash01, inkLine, roundRect } from "./vocab";

const W = 360;
const WALL = 110.4;
const H = 240;
const LAMP_AT: Pt = [64, 22];

let n = 0;
const rnd = (seed: number): number => hash01(seed, n++);

// ------------------------------------------------------------------------------ wall paths
function bricks(): string {
  const polys: Pt[][] = [];
  const bh = 5.6;
  const bw = 14;
  for (let r = 0; r * bh < WALL; r++) {
    const y = r * bh;
    polys.push([[0, y], [W, y], [W, y + 0.7], [0, y + 0.7]]);
    for (let c = -1; c * bw < W + bw; c++) {
      const x = c * bw + (r % 2) * (bw / 2) + (rnd(11) - 0.5) * 0.8;
      polys.push([[x, y], [x + 0.7, y], [x + 0.7, y + bh], [x, y + bh]]);
    }
  }
  return dPolys(polys);
}
/** A few bricks picked out lighter where the lamp hits them. */
function litBricks(): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < 46; i++) {
    const r = Math.floor(rnd(12) * 16);
    const c = Math.floor(rnd(13) * 12);
    const x = c * 14 + (r % 2) * 7 + 0.8;
    const y = r * 5.6 + 0.8;
    const dx = x + 6 - LAMP_AT[0];
    const dy = y + 2 - LAMP_AT[1];
    if (dx * dx / 2.2 + dy * dy > 95 * 95) continue;
    polys.push([[x, y], [x + 12.6, y], [x + 12.6, y + 4.8], [x, y + 4.8]]);
  }
  return dPolys(polys);
}
function blotches(seed: number, count: number, x0: number, y0: number, x1: number, y1: number, rMin: number, rMax: number): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const cx = x0 + rnd(seed) * (x1 - x0);
    const cy = y0 + rnd(seed) * (y1 - y0);
    const r = rMin + rnd(seed) * (rMax - rMin);
    const pts: Pt[] = [];
    const k = 9;
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2;
      const rr = r * (0.55 + rnd(seed) * 0.6);
      pts.push([cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr]);
    }
    polys.push(pts);
  }
  return dPolys(polys);
}
function streaks(seed: number, count: number, x0: number, x1: number, y0: number, y1: number): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd(seed) * (x1 - x0);
    const top = y0 + rnd(seed) * 20;
    const len = 14 + rnd(seed) * (y1 - top - 14);
    polys.push(inkLine([[x, top], [x + (rnd(seed) - 0.5) * 2, top + len * 0.5], [x + (rnd(seed) - 0.5) * 2, top + len]], 0.9 + rnd(seed) * 1.6));
  }
  return dPolys(polys);
}
function cracks(seed: number, count: number): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    let x = rnd(seed) * W;
    let y = WALL + 6 + rnd(seed) * (H - WALL - 8);
    const pts: Pt[] = [[x, y]];
    const segs = 3 + Math.floor(rnd(seed) * 4);
    for (let j = 0; j < segs; j++) {
      x += 4 + rnd(seed) * 12;
      y += (rnd(seed) - 0.5) * 5;
      pts.push([x, y]);
    }
    polys.push(inkLine(pts, 0.55 + rnd(seed) * 0.5));
  }
  return dPolys(polys);
}
function shutterSlats(x: number, y: number, w: number, h: number): string {
  const polys: Pt[][] = [];
  for (let yy = y + 3; yy < y + h; yy += 3.2) polys.push([[x, yy], [x + w, yy], [x + w, yy + 0.6], [x, yy + 0.6]]);
  return dPolys(polys);
}
/** The chain-link mesh as thin diagonal bars inside a box. */
function mesh(x0: number, x1: number, y0: number, y1: number): string {
  const polys: Pt[][] = [];
  const step = 4.2;
  for (let s = x0 - (y1 - y0); s < x1; s += step) {
    for (const dir of [1, -1]) {
      const a: Pt = dir === 1 ? [s, y1] : [s, y0];
      const b: Pt = dir === 1 ? [s + (y1 - y0), y0] : [s + (y1 - y0), y1];
      // clip to the box in x
      const clipX = (p: Pt, q: Pt, xv: number): Pt => { const t = (xv - p[0]) / (q[0] - p[0]); return [xv, p[1] + (q[1] - p[1]) * t]; };
      let p = a;
      let q = b;
      if (p[0] < x0) p = clipX(a, b, x0);
      if (q[0] > x1) q = clipX(a, b, x1);
      if (p[0] >= q[0]) continue;
      polys.push(inkLine([p, q], 0.45, false));
    }
  }
  return dPolys(polys);
}
const TOP_RAIL = (x0: number, x1: number, y: number): string => dPoly([[x0, y], [x1, y], [x1, y + 1.6], [x0, y + 1.6]]);
function posts(xs: readonly number[], y0: number, y1: number): string {
  return dPolys(xs.map((x) => [[x - 1.1, y0], [x + 1.1, y0], [x + 1.1, y1], [x - 1.1, y1]] as Pt[]));
}
/** One crowd member: head and shoulders, as one silhouette. */
function person(x: number, base: number, h: number, lean: number): string {
  const head = ellipsePoly(x + lean, base - h, h * 0.2, h * 0.24, 12);
  const body: Pt[] = [[x - h * 0.36, base], [x - h * 0.3, base - h * 0.52], [x - h * 0.12 + lean, base - h * 0.74], [x + h * 0.14 + lean, base - h * 0.74], [x + h * 0.32, base - h * 0.5], [x + h * 0.38, base]];
  return dPolys([head, body]);
}
function rimOf(x: number, base: number, h: number, lean: number): string {
  // lamp-side edge light (the lamp is to the left)
  return dPolys([
    inkLine([[x - h * 0.1 + lean, base - h * 1.18], [x - h * 0.2 + lean, base - h * 1.02], [x - h * 0.16 + lean, base - h * 0.9]], 0.8, true),
    inkLine([[x - h * 0.12 + lean, base - h * 0.72], [x - h * 0.3, base - h * 0.5], [x - h * 0.35, base - h * 0.2]], 0.8, true),
  ]);
}
function glowRings(cx: number, cy: number, rx: number, ry: number, steps: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps;
    out.push(dPoly(ellipsePoly(cx, cy, rx * k, ry * k, 40)));
  }
  return out;
}
function zeroRing(cx: number, cy: number, rx: number, ry: number, thick: number, seed: number): string {
  const polys: Pt[][] = [];
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    if (rnd(seed) < 0.22) continue;     // worn paint: gaps
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 0.9) / segs) * Math.PI * 2;
    const t = thick * (0.7 + rnd(seed) * 0.4);
    polys.push([
      [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry], [cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry],
      [cx + Math.cos(a1) * (rx - t), cy + Math.sin(a1) * (ry - t * 0.42)], [cx + Math.cos(a0) * (rx - t), cy + Math.sin(a0) * (ry - t * 0.42)],
    ]);
  }
  return dPolys(polys);
}

const P = {
  wallRect: dPoly([[0, 0], [W, 0], [W, WALL], [0, WALL]]),
  bricks: bricks(),
  litBricks: litBricks(),
  wallGlow: glowRings(LAMP_AT[0] + 8, LAMP_AT[1] + 30, 150, 110, 6),
  wallGrime: blotches(21, 26, 0, 0, W, WALL, 4, 12),
  wallStreaks: streaks(22, 18, 0, W, 0, WALL),
  wallDots: halftone(230, 0, 360, 60, 2.2, 0.55, 30),
  kerb: dPoly([[0, WALL - 5], [W, WALL - 5], [W, WALL], [0, WALL]]),
  shutterBox: dPoly([[196, 32], [292, 32], [292, WALL - 5], [196, WALL - 5]]),
  shutterHead: dPoly([[192, 26], [296, 26], [296, 33], [192, 33]]),
  shutterSlats: shutterSlats(196, 33, 96, WALL - 5 - 33),
  stencil0: zeroRing(244, 66, 17, 21, 6, 31),
  lock: dPoly(roundRect(240.5, WALL - 13, 7, 6, 1)),
  window: dPoly([[118, 14], [152, 14], [152, 48], [118, 48]]),
  windowBars: dPolys([[[134.4, 14], [135.6, 14], [135.6, 48], [134.4, 48]], [[118, 30.4], [152, 30.4], [152, 31.6], [118, 31.6]]]),
  drain: dPolys([[[172, 0], [175.4, 0], [175.4, WALL - 5], [172, WALL - 5]], [[170.6, 40], [176.8, 40], [176.8, 43], [170.6, 43]]]),
  pole: dPolys([[[50, 8], [54.4, 8], [55.6, WALL], [48.8, WALL]], [[50, 8], [72, 8], [72, 11.4], [50, 11.4]]]),
  lampHead: dPoly([[60, 11.4], [80, 11.4], [77, 18.6], [63, 18.6]]),
  lampBulb: dPoly(ellipsePoly(70, 19.6, 7.2, 2.2, 16)),
  lampHalo: glowRings(70, 21, 22, 13, 4),
  fenceL: { mesh: mesh(0, 40, 54, WALL - 5), rail: TOP_RAIL(0, 41, 52.6), posts: posts([2, 39], 52, WALL - 5) },
  fenceR: { mesh: mesh(306, 360, 50, WALL - 5), rail: TOP_RAIL(305, 360, 48.6), posts: posts([307, 333, 358], 48, WALL - 5) },
  floorRect: dPoly([[0, WALL], [W, WALL], [W, H], [0, H]]),
  floorGlow: glowRings(160, 196, 230, 54, 6),
  cone: dPoly([[60, 19], [80, 19], [250, H], [-60, H]]),
  floorGrime: blotches(41, 30, 0, WALL + 4, W, H, 5, 15),
  floorCracks: cracks(42, 24),
  floorDots: halftone(0, 214, 360, 240, 2.4, 0.6, 30),
  puddle: dPoly(ellipsePoly(292, 224, 34, 6.5, 30)),
  puddleLight: dPolys([inkLine([[270, 223], [300, 222.4]], 1.6), inkLine([[284, 226], [306, 225.6]], 1.0)]),
  ring: zeroRing(180, 197, 62, 20, 4.2, 43),
  can: dPolys([roundRect(318, 200, 6.4, 3.4, 1.2)]),
  paper: dPoly([[28, 214], [40, 211.4], [42.6, 216.6], [31, 219]]),
};
const crowd = [
  { x: 14, h: 15, lean: 1 }, { x: 30, h: 13.5, lean: -1 }, { x: 318, h: 16, lean: -1.2 }, { x: 344, h: 14, lean: 0.8 },
];
const CROWD_BASE = WALL - 5;

function fill(env: DrawEnv, d: string, colour: string, alpha = 1): void {
  const c = env.ctx;
  if (alpha !== 1) { const a = c.globalAlpha; c.globalAlpha = a * alpha; c.fillStyle = colour; c.fill(env.path(d)); c.globalAlpha = a; return; }
  c.fillStyle = colour;
  c.fill(env.path(d));
}
function outline(env: DrawEnv, d: string, w: number = LINE.stage): void {
  const c = env.ctx;
  c.strokeStyle = INK;
  c.lineWidth = w;
  c.lineJoin = "round";
  c.stroke(env.path(d));
}

export const drawYard: StageDraw = (env, layer, crowdBounce) => {
  const c = env.ctx;
  c.save();
  if (layer === "back") {
    fill(env, P.wallRect, ALLEY.brick);
    fill(env, P.litBricks, ALLEY.brickLit, 0.55);
    for (const g of P.wallGlow) fill(env, g, GLOW, 0.07);
    fill(env, P.bricks, ALLEY.mortar, 0.9);
    fill(env, P.wallDots, TEAL_DEEP, 0.6);
    fill(env, P.wallStreaks, ALLEY.grime, 0.35);
    fill(env, P.wallGrime, ALLEY.grime, 0.28);
    // window, drain pipe
    fill(env, P.window, ALLEY.windowLit, 0.85);
    fill(env, P.windowBars, ALLEY.shutterLine);
    outline(env, P.window);
    fill(env, P.drain, ALLEY.pole);
    // shutter with its stencilled zero
    fill(env, P.shutterBox, ALLEY.shutter);
    fill(env, P.shutterSlats, ALLEY.shutterLine, 0.9);
    fill(env, P.stencil0, ALLEY.paint, 0.45);
    fill(env, P.lock, ALLEY.trash);
    outline(env, P.shutterBox);
    fill(env, P.shutterHead, ALLEY.shutterLine);
    outline(env, P.shutterHead);
    // crowd behind the fences
    const up = -2.6 * (crowdBounce < 0 ? 0 : crowdBounce > 1 ? 1 : crowdBounce);
    crowd.forEach((p, i) => {
      const dy = up * (i % 2 === 0 ? 1 : 0.7);
      c.save();
      c.translate(0, dy);
      fill(env, person(p.x, CROWD_BASE + 2, p.h, p.lean), ALLEY.crowd);
      if (p.x < 100) fill(env, rimOf(p.x, CROWD_BASE + 2, p.h, p.lean), GLOW, 0.8);
      c.restore();
    });
    for (const f of [P.fenceL, P.fenceR]) {
      fill(env, f.mesh, ALLEY.fence, 0.95);
      fill(env, f.posts, ALLEY.pole);
      fill(env, f.rail, ALLEY.pole);
    }
    fill(env, P.kerb, ALLEY.shutterLine);
    // the lamp: pole, head, bulb, halo
    fill(env, P.pole, ALLEY.pole);
    outline(env, P.pole, 1);
    fill(env, P.lampHead, ALLEY.pole);
    for (const g of P.lampHalo) fill(env, g, GLOW_HOT, 0.16);
    fill(env, P.lampBulb, LAMP);
  } else {
    fill(env, P.floorRect, ALLEY.floor);
    for (const g of P.floorGlow) fill(env, g, GLOW, 0.075);
    fill(env, P.cone, GLOW_HOT, 0.05);
    fill(env, P.floorGrime, ALLEY.grime, 0.3);
    fill(env, P.ring, ALLEY.paint, 0.4);
    fill(env, P.floorCracks, ALLEY.crack, 0.9);
    fill(env, P.floorDots, TEAL_DEEP, 0.55);
    fill(env, P.puddle, ALLEY.puddle, 0.9);
    fill(env, P.puddleLight, LAMP, 0.55);
    fill(env, P.can, ALLEY.sign);
    fill(env, P.paper, ALLEY.paint, 0.7);
    c.strokeStyle = INK;
    c.lineWidth = LINE.stage * 1.4;
    c.beginPath();
    c.moveTo(0, WALL);
    c.lineTo(W, WALL);
    c.stroke();
  }
  c.restore();
};
