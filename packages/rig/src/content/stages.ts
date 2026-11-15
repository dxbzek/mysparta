/**
 * The four content arenas, in the style of the gate's alley (gate/yard.ts): night, sodium and
 * hall light, teal shadow, halftone, grime, flat stepped glow (no gradient). Every arena keeps the
 * stage geometry of brief 3.12: 360 x 240, the back wall the top 46% (to y 110.4) with the floor
 * line inked there, actors standing on y 195, so the choreography never changes with the place.
 * A crowd on the back layer bobs on a hit (`crowdBounce`).
 *
 *   yard-night  the same street after midnight in the rain: a neon sign, a half-open lit
 *               garage, a fire escape, wet asphalt with long reflections
 *   rooftop     a tar roof under city lights: skyline with lit windows, a water tower, a red
 *               aerial light, a parapet with the crowd, a work floodlight on the left
 *   backyard    a fenced backyard under a porch lamp: the house wall and back door, a
 *               clothesline, neighbours over the fence, a patio and night grass
 *   gym         a school gym under hall lights: caged lamps, a hoop, bleachers with the crowd,
 *               a scoreboard, varnished boards with painted court lines
 *
 * Every colour is a style.ts colour (the arena palette test); all static paths are made once
 * from a seed.
 */
import type { DrawEnv, StageDraw } from "../contracts";
import { ALLEY, COMPANION_COLOURS, FIXED, FX, GLOW, GLOW_HOT, HAIR_COLOUR, INK, LAMP, LINE, PALETTES, TEAL, TEAL_DEEP } from "../gate/style";
import type { Pt } from "../gate/vocab";
import { dPoly, dPolys, ellipsePoly, halftone, hash01, inkLine, quad, roundRect } from "../gate/vocab";

export const W = 360;
export const WALL = 110.4;
export const H = 240;
/** Where actors stand (brief 3.12). */
export const FLOOR_Y = 195;

class Rnd {
  n = 0;
  constructor(readonly seed: number) {}
  next(): number { return hash01(this.seed, this.n++); }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
}

// ------------------------------------------------------------------------------- helpers
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
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
function floorLine(env: DrawEnv): void {
  const c = env.ctx;
  c.strokeStyle = INK;
  c.lineWidth = LINE.stage * 1.4;
  c.beginPath();
  c.moveTo(0, WALL);
  c.lineTo(W, WALL);
  c.stroke();
}
/** Stepped glow: nested flat ellipses, each laid with a low alpha (no gradient). */
function glow(cx: number, cy: number, rx: number, ry: number, steps: number): string[] {
  return Array.from({ length: steps }, (_, i) => dPoly(ellipsePoly(cx, cy, rx * (1 - i / steps), ry * (1 - i / steps), 40)));
}
function blotches(r: Rnd, count: number, x0: number, y0: number, x1: number, y1: number, rMin: number, rMax: number, flatK = 1.5): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const cx = r.range(x0, x1);
    const cy = r.range(y0, y1);
    const rr = r.range(rMin, rMax);
    const pts: Pt[] = [];
    for (let j = 0; j < 9; j++) { const a = (j / 9) * Math.PI * 2; const q = rr * (0.55 + r.next() * 0.6); pts.push([cx + Math.cos(a) * q * flatK, cy + Math.sin(a) * q]); }
    polys.push(pts);
  }
  return dPolys(polys);
}
function cracks(r: Rnd, count: number, y0: number, y1: number): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    let x = r.range(0, W);
    let y = r.range(y0, y1);
    const pts: Pt[] = [[x, y]];
    const segs = 3 + Math.floor(r.next() * 4);
    for (let j = 0; j < segs; j++) { x += r.range(4, 14); y += r.range(-2.5, 2.5); pts.push([x, y]); }
    polys.push(inkLine(pts, r.range(0.5, 1.0)));
  }
  return dPolys(polys);
}
function streaks(r: Rnd, count: number, x0: number, x1: number, y0: number, y1: number, w0 = 0.9, w1 = 2.4): string {
  const polys: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const x = r.range(x0, x1);
    const top = y0 + r.next() * 16;
    const len = 10 + r.next() * Math.max(1, y1 - top - 10);
    polys.push(inkLine([[x, top], [x + r.range(-1, 1), top + len * 0.5], [x + r.range(-1, 1), top + len]], r.range(w0, w1)));
  }
  return dPolys(polys);
}
/** One crowd member: head and shoulders as one silhouette, and a lamp-side rim light. */
function person(x: number, base: number, h: number, lean: number): string {
  const head = ellipsePoly(x + lean, base - h, h * 0.2, h * 0.24, 12);
  const body: Pt[] = [[x - h * 0.38, base], [x - h * 0.32, base - h * 0.52], [x - h * 0.12 + lean, base - h * 0.74], [x + h * 0.14 + lean, base - h * 0.74], [x + h * 0.34, base - h * 0.5], [x + h * 0.4, base]];
  return dPolys([head, body]);
}
function rim(x: number, base: number, h: number, lean: number): string {
  return dPolys([
    inkLine([[x - h * 0.1 + lean, base - h * 1.18], [x - h * 0.2 + lean, base - h * 1.02], [x - h * 0.16 + lean, base - h * 0.9]], 0.8),
    inkLine([[x - h * 0.12 + lean, base - h * 0.72], [x - h * 0.32, base - h * 0.5], [x - h * 0.36, base - h * 0.2]], 0.8),
  ]);
}
interface Fan { x: number; h: number; lean: number }
function drawCrowd(env: DrawEnv, fans: readonly Fan[], base: number, bounce: number, colour: string, rimColour: string, rimAlpha: number): void {
  const up = -2.6 * (bounce < 0 ? 0 : bounce > 1 ? 1 : bounce);
  fans.forEach((p, i) => {
    env.ctx.save();
    env.ctx.translate(0, up * (i % 2 === 0 ? 1 : 0.7));
    fill(env, person(p.x, base, p.h, p.lean), colour);
    fill(env, rim(p.x, base, p.h, p.lean), rimColour, rimAlpha);
    env.ctx.restore();
  });
}
function bricks(x0: number, x1: number, y0: number, y1: number, bw: number, bh: number, r: Rnd): string {
  const polys: Pt[][] = [];
  for (let row = 0; y0 + row * bh < y1; row++) {
    const y = y0 + row * bh;
    polys.push(rect(x0, y, x1 - x0, 0.7));
    for (let c = -1; x0 + c * bw < x1 + bw; c++) {
      const x = x0 + c * bw + (row % 2) * (bw / 2) + r.range(-0.4, 0.4);
      if (x < x0 || x > x1) continue;
      polys.push(rect(x, y, 0.7, Math.min(bh, y1 - y)));
    }
  }
  return dPolys(polys);
}
const run = (draw: (env: DrawEnv, layer: "back" | "floor", bounce: number) => void): StageDraw => (env, layer, bounce) => {
  env.ctx.save();
  draw(env, layer, bounce);
  env.ctx.restore();
};

// ---------------------------------------------------------------------------- yard-night
const YN = (() => {
  const r = new Rnd(5101);
  const rain: Pt[][] = [];
  for (let i = 0; i < 90; i++) {
    const x = r.range(-20, W);
    const y = r.range(0, H - 20);
    const l = r.range(6, 13);
    rain.push(inkLine([[x, y], [x + l * 0.22, y + l]], r.range(0.3, 0.55), false));
  }
  const ladder: Pt[][] = [];
  for (let k = 0; k < 2; k++) {
    const y = 12 + k * 40;
    ladder.push(rect(222, y, 92, 2.6), rect(222, y + 2.6, 2, 26), rect(312, y + 2.6, 2, 26));
    for (let x = 226; x < 312; x += 6) ladder.push(rect(x, y - 9, 0.9, 9));
    ladder.push(rect(222, y - 10, 92, 1.4));
    ladder.push(inkLine([[300, y + 2.6], [236, y + 40]], 1.6, false));
  }
  const wet: Pt[][] = [];
  for (let i = 0; i < 22; i++) {
    const x = r.range(0, W);
    const y = r.range(WALL + 14, H - 6);
    wet.push(inkLine([[x, y], [x + r.range(-0.6, 0.6), y + r.range(8, 22)]], r.range(0.6, 1.6), true));
  }
  return {
    wall: dPoly(rect(0, 0, W, WALL)),
    bricks: bricks(0, W, 0, WALL, 14, 5.6, r),
    grime: blotches(r, 30, 0, 0, W, WALL, 4, 12),
    streaks: streaks(r, 22, 0, W, 0, WALL),
    dots: halftone(0, 0, 200, 50, 2.2, 0.55, 30),
    garage: dPoly(rect(98, 38, 96, WALL - 5 - 38)),
    garageInside: dPoly(rect(102, 74, 88, WALL - 5 - 74)),
    shutter: dPoly(rect(98, 38, 96, 36)),
    slats: dPolys(Array.from({ length: 10 }, (_, i) => rect(98, 40.6 + i * 3.4, 96, 0.6))),
    shutterHead: dPoly(rect(94, 32, 104, 7)),
    boxes: dPolys([rect(110, 92, 16, 13.4), rect(128, 86, 13, 19.4), rect(170, 96, 18, 9.4)]),
    neonBox: dPoly(roundRect(26, 20, 52, 18, 3)),
    neonText: dPolys([
      inkLine([[33, 25.4], [33, 32.6], [38, 32.6], [38, 25.4], [33, 25.4]], 1.6, false),
      inkLine([[42, 33], [42, 25.4], [47, 25.4], [47, 29], [42, 29]], 1.6, false),
      inkLine([[56, 25], [51, 25], [51, 33], [56, 33]], 1.6, false), inkLine([[51, 29], [55, 29]], 1.4, false),
      inkLine([[60, 33], [60, 25], [66, 33], [66, 25]], 1.6, false),
    ]),
    neonGlow: glow(52, 29, 46, 26, 4),
    ladder: dPolys(ladder),
    dumpster: dPolys([[[262, 74], [338, 70], [342, 105.4], [258, 105.4]]]),
    dumpsterLid: dPoly([[256, 70], [344, 64], [346, 70], [258, 76]]),
    dumpsterLines: dPolys([inkLine([[276, 76], [276, 104]], 0.8), inkLine([[300, 74], [300, 104]], 0.8), inkLine([[324, 72], [324, 104]], 0.8)]),
    pole: dPolys([rect(14, 6, 4, WALL - 6), rect(14, 6, 22, 3)]),
    lampHead: dPoly([[24, 9], [40, 9], [37.6, 15], [26.4, 15]]),
    lampBulb: dPoly(ellipsePoly(32, 15.6, 5.6, 1.8, 14)),
    lampHalo: glow(32, 17, 20, 12, 4),
    wallGlow: glow(40, 40, 120, 90, 5),
    kerb: dPoly(rect(0, WALL - 5, W, 5)),
    rain: dPolys(rain),
    floor: dPoly(rect(0, WALL, W, H - WALL)),
    floorGlow: glow(146, 150, 150, 40, 5),
    spill: dPoly([[102, WALL], [190, WALL], [228, H], [70, H]]),
    reflNeon: dPolys([inkLine([[40, WALL + 6], [42, 168]], 6), inkLine([[56, WALL + 8], [58, 150]], 3)]),
    reflLamp: dPoly(inkLine([[32, WALL + 4], [33, 190]], 4)),
    wet: dPolys(wet),
    puddles: dPolys([ellipsePoly(70, 214, 38, 6, 26), ellipsePoly(268, 206, 30, 5, 24), ellipsePoly(190, 230, 26, 4.4, 22)]),
    floorGrime: blotches(r, 30, 0, WALL + 4, W, H, 2.5, 7),
    floorCracks: cracks(r, 20, WALL + 6, H - 2),
    floorDots: halftone(0, 214, 360, 240, 2.4, 0.6, 30),
    manhole: dPoly(ellipsePoly(250, 226, 16, 4.4, 22)),
    manholeLines: dPolys([inkLine([[238, 226], [262, 226]], 0.7, false), inkLine([[242, 223.6], [258, 223.6]], 0.6, false), inkLine([[242, 228.4], [258, 228.4]], 0.6, false)]),
  };
})();
const YN_FANS: Fan[] = [{ x: 112, h: 16, lean: 1 }, { x: 134, h: 17, lean: -1 }, { x: 160, h: 15.5, lean: 0.6 }, { x: 180, h: 16.5, lean: -0.8 }];
export const drawYardNight: StageDraw = run((env, layer, bounce) => {
  const P = YN;
  if (layer === "back") {
    fill(env, P.wall, TEAL_DEEP);
    for (const g of P.wallGlow) fill(env, g, GLOW, 0.05);
    fill(env, P.bricks, ALLEY.mortar, 0.9);
    fill(env, P.dots, ALLEY.crack, 0.6);
    fill(env, P.streaks, ALLEY.grime, 0.4);
    fill(env, P.grime, ALLEY.grime, 0.3);
    // the half-open garage: warm light inside, crates, and the crowd standing in it
    fill(env, P.garage, ALLEY.shutterLine);
    fill(env, P.garageInside, GLOW, 0.75);
    fill(env, P.boxes, ALLEY.trash);
    outline(env, P.boxes, 0.8);
    drawCrowd(env, YN_FANS, WALL - 4, bounce, ALLEY.crowd, GLOW_HOT, 0.9);
    fill(env, P.shutter, ALLEY.shutter);
    fill(env, P.slats, ALLEY.shutterLine, 0.9);
    outline(env, P.garage);
    fill(env, P.shutterHead, ALLEY.shutterLine);
    outline(env, P.shutterHead);
    // fire escape
    fill(env, P.ladder, ALLEY.pole);
    // the dumpster
    fill(env, P.dumpster, ALLEY.trash);
    fill(env, P.dumpsterLines, ALLEY.crack);
    outline(env, P.dumpster);
    fill(env, P.dumpsterLid, ALLEY.shutterLine);
    outline(env, P.dumpsterLid, 1);
    // the neon sign
    for (const g of P.neonGlow) fill(env, g, ALLEY.sign, 0.09);
    fill(env, P.neonBox, ALLEY.shutterLine);
    outline(env, P.neonBox, 1.2);
    fill(env, P.neonText, ALLEY.sign);
    fill(env, P.kerb, ALLEY.shutterLine);
    // lamp
    fill(env, P.pole, ALLEY.pole);
    fill(env, P.lampHead, ALLEY.pole);
    for (const g of P.lampHalo) fill(env, g, GLOW_HOT, 0.15);
    fill(env, P.lampBulb, LAMP);
    fill(env, P.rain, LAMP, 0.28);
  } else {
    fill(env, P.floor, ALLEY.floor);
    for (const g of P.floorGlow) fill(env, g, GLOW, 0.06);
    fill(env, P.spill, GLOW_HOT, 0.07);
    fill(env, P.floorGrime, ALLEY.grime, 0.25);
    fill(env, P.floorCracks, ALLEY.crack, 0.9);
    fill(env, P.puddles, ALLEY.puddle, 0.85);
    fill(env, P.reflNeon, ALLEY.sign, 0.45);
    fill(env, P.reflLamp, LAMP, 0.3);
    fill(env, P.wet, LAMP, 0.18);
    fill(env, P.manhole, ALLEY.shutterLine);
    fill(env, P.manholeLines, ALLEY.trash);
    fill(env, P.floorDots, TEAL_DEEP, 0.55);
    fill(env, P.rain, LAMP, 0.18);
    floorLine(env);
  }
});

// ------------------------------------------------------------------------------- rooftop
const RT = (() => {
  const r = new Rnd(5202);
  const towers: Pt[][] = [];
  const windows: Pt[][] = [];
  const windowsHot: Pt[][] = [];
  let x = -6;
  while (x < W) {
    const w = r.range(18, 40);
    const top = r.range(18, 62);
    towers.push(rect(x, top, w, 80 - top));
    if (r.next() < 0.3) towers.push(rect(x + w * 0.4, top - r.range(4, 10), 1.4, 10));
    for (let wy = top + 4; wy < 74; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4.4) {
      const q = r.next();
      if (q < 0.18) windows.push(rect(wx, wy, 2.2, 2.6));
      else if (q < 0.24) windowsHot.push(rect(wx, wy, 2.2, 2.6));
    }
    x += w + r.range(-2, 4);
  }
  const far: Pt[][] = [];
  x = -10;
  while (x < W) { const w = r.range(14, 30); const top = r.range(40, 70); far.push(rect(x, top, w, 80 - top)); x += w; }
  const gravel: Pt[][] = [];
  for (let i = 0; i < 260; i++) { const gx = r.range(0, W); const gy = r.range(WALL + 3, H); gravel.push(ellipsePoly(gx, gy, r.range(0.3, 0.8), r.range(0.2, 0.5), 5)); }
  const tank: Pt[][] = [
    [[262, 20], [300, 20], [298, 52], [264, 52]],
    [[258, 20], [281, 6], [304, 20]],
  ];
  const tankLegs: Pt[][] = [rect(266, 52, 2, 26), rect(294, 52, 2, 26), inkLine([[268, 54], [294, 76]], 1, false), inkLine([[294, 54], [268, 76]], 1, false)];
  return {
    sky: dPoly(rect(0, 0, W, WALL)),
    skyDots: halftone(0, 0, 360, 70, 2.6, 0.5, 30),
    moon: dPoly(ellipsePoly(78, 22, 9, 9, 24)),
    moonBite: dPoly(ellipsePoly(83, 19, 8, 8, 24)),
    moonGlow: glow(78, 22, 26, 26, 4),
    far: dPolys(far),
    towers: dPolys(towers),
    windows: dPolys(windows),
    windowsHot: dPolys(windowsHot),
    cityGlow: glow(180, 82, 230, 34, 5),
    tank: dPolys(tank),
    tankBands: dPolys([inkLine([[263, 30], [299, 30]], 0.8, false), inkLine([[263.6, 42], [298.4, 42]], 0.8, false)]),
    tankLegs: dPolys(tankLegs),
    aerial: dPolys([rect(190, 8, 1.6, 74), inkLine([[184, 20], [198, 20]], 0.9, false), inkLine([[186, 30], [196, 30]], 0.9, false)]),
    aerialLight: dPoly(ellipsePoly(190.8, 7, 1.8, 1.8, 10)),
    aerialGlow: glow(190.8, 7, 9, 9, 3),
    parapet: dPoly(rect(0, 80, W, WALL - 80)),
    parapetCap: dPoly(rect(0, 77, W, 4.4)),
    parapetBricks: bricks(0, W, 81.4, WALL, 12, 4.8, r),
    ac: dPolys([rect(212, 88, 34, 22.4), rect(312, 92, 26, 18.4)]),
    acGrille: dPolys([...Array.from({ length: 6 }, (_, i) => rect(215 + i * 5, 92, 1, 14)), ...Array.from({ length: 4 }, (_, i) => rect(315 + i * 5.6, 95, 1, 12))]),
    acFan: dPoly(ellipsePoly(229, 99, 6.6, 6.6, 18)),
    flood: dPolys([rect(20, 30, 2.4, 80.4), [[12, 22], [32, 18], [34, 30], [14, 32]]]),
    floodLens: dPoly([[30, 19.6], [34, 18.6], [35.6, 29], [32, 30]]),
    floodBeam: dPoly([[34, 20], [36, 31], [250, H], [60, H]]),
    floodGlow: glow(150, 190, 190, 46, 5),
    floor: dPoly(rect(0, WALL, W, H - WALL)),
    gravel: dPolys(gravel),
    seams: dPolys([inkLine([[0, 150], [W, 146]], 0.9, false), inkLine([[0, 196], [W, 200]], 0.9, false), inkLine([[120, WALL], [104, H]], 0.9, false), inkLine([[250, WALL], [268, H]], 0.9, false)]),
    patches: blotches(r, 10, 0, WALL + 10, W, H - 4, 6, 14, 2.2),
    floorCracks: cracks(r, 14, WALL + 6, H - 2),
    skylight: dPoly([[290, 212], [348, 212], [356, 236], [282, 236]]),
    skylightPanes: dPolys([inkLine([[309, 212], [306, 236]], 1, false), inkLine([[329, 212], [331, 236]], 1, false), inkLine([[286, 224], [352, 224]], 1, false)]),
    vent: dPolys([rect(22, 196, 18, 12), [[18, 192], [44, 192], [42, 196], [20, 196]]]),
    ring: (() => {
      const polys: Pt[][] = [];
      for (let i = 0; i < 26; i++) {
        if (r.next() < 0.2) continue;
        const a0 = (i / 26) * Math.PI * 2;
        const a1 = ((i + 0.85) / 26) * Math.PI * 2;
        polys.push([[180 + Math.cos(a0) * 70, 197 + Math.sin(a0) * 22], [180 + Math.cos(a1) * 70, 197 + Math.sin(a1) * 22], [180 + Math.cos(a1) * 66, 197 + Math.sin(a1) * 20.4], [180 + Math.cos(a0) * 66, 197 + Math.sin(a0) * 20.4]]);
      }
      return dPolys(polys);
    })(),
    floorDots: halftone(0, 216, 360, 240, 2.4, 0.6, 30),
  };
})();
const RT_FANS: Fan[] = [{ x: 18, h: 15, lean: 1 }, { x: 52, h: 16.5, lean: -0.8 }, { x: 150, h: 15.5, lean: 0.4 }, { x: 166, h: 17, lean: -1 }, { x: 288, h: 16, lean: 0.8 }];
export const drawRooftop: StageDraw = run((env, layer, bounce) => {
  const P = RT;
  if (layer === "back") {
    fill(env, P.sky, TEAL_DEEP);
    fill(env, P.skyDots, ALLEY.crack, 0.55);
    for (const g of P.moonGlow) fill(env, g, LAMP, 0.05);
    fill(env, P.moon, LAMP, 0.9);
    fill(env, P.moonBite, TEAL_DEEP);
    for (const g of P.cityGlow) fill(env, g, GLOW, 0.07);
    fill(env, P.far, ALLEY.brick);
    fill(env, P.towers, ALLEY.shutterLine);
    fill(env, P.windows, ALLEY.windowLit, 0.75);
    fill(env, P.windowsHot, LAMP, 0.85);
    fill(env, P.aerial, ALLEY.pole);
    for (const g of P.aerialGlow) fill(env, g, ALLEY.sign, 0.18);
    fill(env, P.aerialLight, ALLEY.sign);
    fill(env, P.tankLegs, ALLEY.pole);
    fill(env, P.tank, PALETTES[3]!.bottom);
    fill(env, P.tankBands, ALLEY.crack);
    outline(env, P.tank, 1.2);
    // the crowd behind the parapet
    drawCrowd(env, RT_FANS, 82, bounce, ALLEY.crowd, GLOW, 0.75);
    fill(env, P.parapet, ALLEY.brick);
    fill(env, P.parapetBricks, ALLEY.mortar, 0.85);
    fill(env, P.parapetCap, ALLEY.paint, 0.6);
    outline(env, P.parapetCap, 1);
    fill(env, P.ac, ALLEY.trash);
    fill(env, P.acGrille, ALLEY.crack);
    fill(env, P.acFan, ALLEY.shutterLine);
    outline(env, P.ac, 1);
    fill(env, P.flood, ALLEY.pole);
    outline(env, P.flood, 1);
    fill(env, P.floodLens, LAMP);
  } else {
    fill(env, P.floor, ALLEY.floor);
    fill(env, P.floodBeam, GLOW_HOT, 0.05);
    for (const g of P.floodGlow) fill(env, g, GLOW, 0.07);
    fill(env, P.patches, ALLEY.grime, 0.35);
    fill(env, P.gravel, ALLEY.floorLit, 0.7);
    fill(env, P.seams, ALLEY.crack);
    fill(env, P.floorCracks, ALLEY.crack, 0.8);
    fill(env, P.ring, ALLEY.paint, 0.4);
    fill(env, P.skylight, ALLEY.puddle);
    fill(env, P.skylightPanes, ALLEY.crack);
    outline(env, P.skylight, 1.2);
    fill(env, P.vent, ALLEY.trash);
    outline(env, P.vent, 1);
    fill(env, P.floorDots, TEAL_DEEP, 0.55);
    floorLine(env);
  }
});

// ------------------------------------------------------------------------------ backyard
const BY = (() => {
  const r = new Rnd(5303);
  const planks: Pt[][] = [];
  const plankGaps: Pt[][] = [];
  for (let x = 128; x < W; x += 9) {
    const top = 46 + r.range(-1.5, 1.5);
    planks.push([[x, top + 2], [x + 4.2, top - 1.2], [x + 8.4, top + 2], [x + 8.4, WALL], [x, WALL]]);
    plankGaps.push(rect(x + 8.4, top + 2, 0.6, WALL - top - 2));
  }
  const grain: Pt[][] = [];
  for (let i = 0; i < 40; i++) { const gx = r.range(128, W); const gy = r.range(52, WALL - 4); grain.push(inkLine([[gx, gy], [gx + r.range(-0.4, 0.4), gy + r.range(5, 12)]], 0.4)); }
  const trees: Pt[][] = [];
  for (let i = 0; i < 9; i++) {
    const cx = 140 + i * 26 + r.range(-6, 6);
    const cy = r.range(14, 30);
    const rr = r.range(14, 22);
    const pts: Pt[] = [];
    for (let j = 0; j < 14; j++) { const a = (j / 14) * Math.PI * 2; const q = rr * (0.75 + r.next() * 0.35); pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.9]); }
    trees.push(pts);
  }
  const grass: Pt[][] = [];
  for (let i = 0; i < 170; i++) {
    const gx = r.range(0, W);
    const gy = r.range(WALL + 4, H);
    const h = r.range(2, 5);
    grass.push(inkLine([[gx, gy], [gx + r.range(-1.2, 1.2), gy - h]], 0.6, true));
  }
  const siding: Pt[][] = [];
  for (let y = 4; y < WALL; y += 5.4) siding.push(rect(0, y, 116, 0.8));
  const clothes: Pt[][] = [];
  const cloth = [{ x: 170, w: 16, h: 22 }, { x: 196, w: 12, h: 16 }, { x: 220, w: 20, h: 14 }, { x: 258, w: 14, h: 24 }];
  return {
    sky: dPoly(rect(0, 0, W, 60)),
    skyDots: halftone(116, 0, 360, 50, 2.6, 0.5, 30),
    trees: dPolys(trees),
    fence: dPolys(planks),
    fenceGaps: dPolys(plankGaps),
    fenceRail: dPolys([rect(122, 62, W - 122, 3), rect(122, 94, W - 122, 3)]),
    grain: dPolys(grain),
    house: dPoly(rect(0, 0, 122, WALL)),
    siding: dPolys(siding),
    door: dPoly(rect(64, 34, 28, WALL - 34)),
    doorWin: dPoly(rect(70, 40, 16, 20)),
    doorWinBars: dPolys([rect(77.4, 40, 1.2, 20), rect(70, 49.4, 16, 1.2)]),
    knob: dPoly(ellipsePoly(87.6, 76, 1.4, 1.4, 8)),
    step: dPoly(rect(56, WALL - 6, 44, 6)),
    window: dPoly(rect(12, 26, 30, 30)),
    windowBars: dPolys([rect(26.4, 26, 1.2, 30), rect(12, 40.4, 30, 1.2)]),
    blind: dPoly(rect(12, 26, 30, 11)),
    porchLamp: dPolys([[[50, 30], [58, 30], [57, 40], [51, 40]], rect(52.6, 26, 2.8, 4)]),
    porchBulb: dPoly(ellipsePoly(54, 37, 2.4, 2.8, 12)),
    porchGlow: glow(54, 40, 70, 60, 5),
    line: dPoly(inkLine([[122, 30], [190, 38], [300, 36], [W, 30]], 0.7, false)),
    clothes: cloth.map((c2) => dPoly([[c2.x, 34.4], [c2.x + c2.w, 34.8], [c2.x + c2.w + 1, 34.8 + c2.h], [c2.x - 1, 34.8 + c2.h * 0.92]])),
    pegs: dPolys(cloth.flatMap((c2) => [rect(c2.x + 1, 32.6, 1.2, 3.4), rect(c2.x + c2.w - 2.2, 32.8, 1.2, 3.4)])),
    grill: dPolys([[[318, 84], [348, 84], [344, 98], [322, 98]], rect(322, 98, 1.6, 12.4), rect(342, 98, 1.6, 12.4)]),
    grillLid: dPoly(quad([316, 84], [333, 70], [350, 84], 10)),
    floor: dPoly(rect(0, WALL, W, H - WALL)),
    patio: dPolys([...Array.from({ length: 4 }, (_, i) => [[0, WALL + i * 13], [128 - i * 6, WALL + i * 13], [128 - (i + 1) * 6, WALL + (i + 1) * 13 - 1], [0, WALL + (i + 1) * 13 - 1]] as Pt[])]),
    patioJoints: dPolys([inkLine([[40, WALL], [36, WALL + 52]], 0.6, false), inkLine([[84, WALL], [78, WALL + 52]], 0.6, false)]),
    lampPool: glow(70, 150, 150, 44, 5),
    grass: dPolys(grass),
    patches: blotches(r, 14, 0, WALL + 40, W, H, 6, 14, 2.4),
    hose: dPoly(inkLine([...quad([300, WALL + 4], [260, 140], [300, 150], 8), ...quad([300, 150], [340, 160], [330, 176], 8).slice(1)], 1.6, false)),
    pool: dPoly(ellipsePoly(316, 220, 34, 9, 30)),
    poolWater: dPoly(ellipsePoly(316, 219, 28, 6.4, 28)),
    floorDots: halftone(0, 216, 360, 240, 2.4, 0.6, 30),
  };
})();
const BY_FANS: Fan[] = [{ x: 150, h: 13, lean: 0.8 }, { x: 236, h: 14.5, lean: -0.6 }, { x: 252, h: 13, lean: 0.6 }, { x: 300, h: 14, lean: -1 }];
const CLOTH_COLOURS = [PALETTES[0]!.top, FIXED.white, PALETTES[2]!.bottom, PALETTES[3]!.top];
export const drawBackyard: StageDraw = run((env, layer, bounce) => {
  const P = BY;
  if (layer === "back") {
    fill(env, P.sky, TEAL_DEEP);
    fill(env, P.skyDots, ALLEY.crack, 0.55);
    fill(env, P.trees, ALLEY.crowd, 0.9);
    // neighbours look over the fence
    drawCrowd(env, BY_FANS, 56, bounce, HAIR_COLOUR[1], GLOW, 0.55);
    fill(env, P.fence, PALETTES[1]!.bottom);
    fill(env, P.grain, ALLEY.shutterLine, 0.5);
    fill(env, P.fenceGaps, ALLEY.crack);
    fill(env, P.fenceRail, ALLEY.shutterLine, 0.8);
    // clothesline
    fill(env, P.line, ALLEY.pole);
    P.clothes.forEach((d, i) => { fill(env, d, CLOTH_COLOURS[i % CLOTH_COLOURS.length]!); outline(env, d, 0.9); });
    fill(env, P.pegs, FIXED.wood);
    // grill
    fill(env, P.grill, ALLEY.trash);
    fill(env, P.grillLid, ALLEY.trash);
    outline(env, P.grillLid, 1);
    outline(env, P.grill, 1);
    // the house: siding, a curtained window, the back door with its light, the porch lamp
    fill(env, P.house, ALLEY.shutter);
    fill(env, P.siding, ALLEY.shutterLine, 0.75);
    for (const g of P.porchGlow) fill(env, g, GLOW, 0.075);
    fill(env, P.window, ALLEY.windowLit, 0.75);
    fill(env, P.blind, PALETTES[1]!.top, 0.9);
    fill(env, P.windowBars, ALLEY.shutterLine);
    outline(env, P.window);
    fill(env, P.door, PALETTES[2]!.top);
    fill(env, P.doorWin, LAMP, 0.85);
    fill(env, P.doorWinBars, ALLEY.shutterLine);
    fill(env, P.knob, FIXED.metal);
    outline(env, P.door);
    fill(env, P.step, ALLEY.paint, 0.55);
    outline(env, P.step, 1);
    fill(env, P.porchLamp, ALLEY.pole);
    fill(env, P.porchBulb, LAMP);
    outline(env, P.house, 1.2);
  } else {
    fill(env, P.floor, ALLEY.trash);
    fill(env, P.patches, ALLEY.floor, 0.5);
    fill(env, P.patio, ALLEY.floorLit);
    fill(env, P.patioJoints, ALLEY.crack);
    for (const g of P.lampPool) fill(env, g, GLOW, 0.07);
    fill(env, P.grass, ALLEY.crack, 0.75);
    fill(env, P.hose, COMPANION_COLOURS.raccoon.dark);
    fill(env, P.pool, FX.dust);
    outline(env, P.pool, 1.2);
    fill(env, P.poolWater, ALLEY.puddle);
    fill(env, P.floorDots, TEAL_DEEP, 0.5);
    floorLine(env);
  }
});

// ----------------------------------------------------------------------------------- gym
const GY = (() => {
  const r = new Rnd(5404);
  const blocks = bricks(0, W, 0, 70, 18, 7, r);
  const boards: Pt[][] = [];
  const boardTone: Pt[][] = [];
  for (let y = WALL; y < H; y += 6.2) {
    boards.push(rect(0, y, W, 0.5));
    let x = r.range(-30, 0);
    while (x < W) {
      const l = r.range(30, 70);
      boards.push(rect(x, y, 0.5, 6.2));
      if (r.next() < 0.4) boardTone.push(rect(x, y + 0.5, l, 5.7));
      x += l;
    }
  }
  const benches: Pt[][] = [];
  for (let i = 0; i < 3; i++) benches.push(rect(0, 76 + i * 11, W, 3.2));
  const lamp = (x: number): Pt[][] => [rect(x - 0.6, 0, 1.2, 10), [[x - 7, 10], [x + 7, 10], [x + 5, 16], [x - 5, 16]]];
  const lampXs = [50, 140, 230, 320];
  const pennants: Pt[][] = [];
  for (let i = 0; i < 8; i++) { const x = 8 + i * 13; pennants.push([[x, 26], [x + 11, 26], [x + 5.5, 36]]); }
  const zeros = (cx: number): Pt[][] => [[...Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return [cx + Math.cos(a) * 3.2, 46 + Math.sin(a) * 4.4] as Pt; })]];
  return {
    wall: dPoly(rect(0, 0, W, WALL)),
    blocks,
    band: dPoly(rect(0, 56, W, 8)),
    bandLine: dPoly(rect(0, 64, W, 1.6)),
    pennants: dPolys(pennants),
    pennantLine: dPoly(inkLine([[4, 26], [116, 26]], 0.6, false)),
    lamps: dPolys(lampXs.flatMap(lamp)),
    bulbs: dPolys(lampXs.map((x) => ellipsePoly(x, 16.4, 4.6, 1.8, 12))),
    lampGlows: lampXs.flatMap((x) => glow(x, 22, 46, 26, 3)),
    cones: dPolys(lampXs.map((x) => [[x - 5, 16], [x + 5, 16], [x + 34, WALL], [x - 34, WALL]] as Pt[])),
    board: dPoly(rect(150, 14, 60, 36)),
    boardSquare: dPoly(rect(170, 28, 20, 14)),
    rimHoop: dPoly(inkLine([[166, 47], [194, 47]], 2.2, false)),
    net: dPolys([inkLine([[167, 48], [172, 60], [176, 48], [180, 60], [184, 48], [188, 60], [193, 48]], 0.7, false), inkLine([[171, 56], [189, 56]], 0.6, false)]),
    scoreboard: dPoly(roundRect(256, 30, 52, 26, 2)),
    scoreZeros: dPolys([...zeros(268), ...zeros(296)].map((p) => inkLine(p, 1.4, false))),
    scoreDots: dPolys([ellipsePoly(282, 42, 0.9, 0.9, 6), ellipsePoly(282, 49, 0.9, 0.9, 6)]),
    bleachers: dPolys([rect(0, 70, W, WALL - 70)]),
    benches: dPolys(benches),
    rails: dPolys([rect(0, 69, W, 1.6), rect(118, 69, 2, 41.4), rect(242, 69, 2, 41.4)]),
    floor: dPoly(rect(0, WALL, W, H - WALL)),
    boards: dPolys(boards),
    boardTone: dPolys(boardTone),
    centre: dPolys([
      [...Array.from({ length: 49 }, (_, k) => { const a = (k / 48) * Math.PI * 2; return [180 + Math.cos(a) * 46, 196 + Math.sin(a) * 14] as Pt; }),
        ...Array.from({ length: 49 }, (_, k) => { const a = (1 - k / 48) * Math.PI * 2; return [180 + Math.cos(a) * 43.6, 196 + Math.sin(a) * 12.8] as Pt; })],
    ]),
    lines: dPolys([rect(178.8, WALL, 2.4, H - WALL), rect(0, 128, W, 1.8)]),
    keyPaint: dPoly([[0, 146], [60, 146], [76, H], [0, H]]),
    shine: dPolys(lampXs.map((x) => ellipsePoly(x + 8, 160, 18, 3.4, 20))),
    shine2: dPolys(lampXs.map((x) => ellipsePoly(x + 12, 205, 26, 4.2, 20))),
    scuffs: blotches(r, 26, 0, WALL + 6, W, H, 1.5, 4, 2.6),
    floorDots: halftone(0, 220, 360, 240, 2.4, 0.55, 30),
    shade: dPoly(rect(0, WALL, W, 10)),
  };
})();
const GY_FANS: Fan[] = [
  { x: 14, h: 14, lean: 1 }, { x: 34, h: 15, lean: -0.6 }, { x: 72, h: 14.5, lean: 0.6 }, { x: 96, h: 13.5, lean: -1 },
  { x: 140, h: 14.5, lean: 0.8 }, { x: 214, h: 15, lean: -0.8 }, { x: 266, h: 14, lean: 0.6 }, { x: 300, h: 15.5, lean: -0.6 }, { x: 340, h: 14, lean: 1 },
];
export const drawGym: StageDraw = run((env, layer, bounce) => {
  const P = GY;
  if (layer === "back") {
    fill(env, P.wall, ALLEY.shutter);
    fill(env, P.blocks, ALLEY.shutterLine, 0.7);
    for (const g of P.lampGlows) fill(env, g, LAMP, 0.05);
    fill(env, P.band, PALETTES[0]!.top, 0.85);
    fill(env, P.bandLine, ALLEY.paint, 0.8);
    fill(env, P.pennantLine, ALLEY.pole);
    fill(env, P.pennants, PALETTES[3]!.top);
    outline(env, P.pennants, 0.7);
    // hoop and scoreboard
    fill(env, P.board, FIXED.white);
    outline(env, P.board);
    fill(env, P.boardSquare, FIXED.white);
    outline(env, P.boardSquare, 1.1);
    fill(env, P.net, FIXED.white, 0.85);
    fill(env, P.rimHoop, ALLEY.sign);
    fill(env, P.scoreboard, ALLEY.pole);
    outline(env, P.scoreboard, 1.2);
    fill(env, P.scoreZeros, GLOW_HOT);
    fill(env, P.scoreDots, GLOW_HOT);
    // bleachers and the crowd on them
    fill(env, P.bleachers, ALLEY.brick);
    fill(env, P.benches, FIXED.wood, 0.8);
    drawCrowd(env, GY_FANS.slice(0, 5), 92, bounce, ALLEY.crowd, LAMP, 0.6);
    drawCrowd(env, GY_FANS.slice(5), 103, bounce, ALLEY.crowd, LAMP, 0.6);
    fill(env, P.rails, ALLEY.pole);
    // hall lights
    fill(env, P.cones, LAMP, 0.045);
    fill(env, P.lamps, ALLEY.pole);
    fill(env, P.bulbs, LAMP);
  } else {
    fill(env, P.floor, PALETTES[1]!.bottom);
    fill(env, P.boardTone, PALETTES[1]!.accent, 0.55);
    fill(env, P.boards, ALLEY.shutterLine, 0.5);
    fill(env, P.keyPaint, PALETTES[0]!.top, 0.35);
    fill(env, P.lines, FIXED.white, 0.85);
    fill(env, P.centre, FIXED.white, 0.85);
    fill(env, P.shine, LAMP, 0.18);
    fill(env, P.shine2, LAMP, 0.12);
    fill(env, P.scuffs, ALLEY.shutterLine, 0.3);
    fill(env, P.floorDots, TEAL, 0.5);
    fill(env, P.shade, TEAL_DEEP, 0.45);
    floorLine(env);
  }
});

export const CONTENT_STAGES = { "yard-night": drawYardNight, rooftop: drawRooftop, backyard: drawBackyard, gym: drawGym };
