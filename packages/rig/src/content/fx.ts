/**
 * The six content effects and the three Move props, in the comic style of `gate/fx.ts`: flat
 * fills from the palette in style.ts, a Night Ink outline, no gradient. Each effect is a pure
 * function of progress 0..1 and its seed; `at` is where the stage puts it (the target's place
 * for a tarp, tape or crackers; the user's place for rings, plus and the trail). The engine wraps
 * every call in save / restore.
 *
 * First pass (static batch): readable shapes with simple timing; the animation pass tunes them.
 */
import type { DrawEnv, FxDraw, MoveProp, PropArt } from "../contracts";
import { ALLEY, FX, GLOW_HOT, ICON, INK, LAMP, LINE, PALETTES, TEAL } from "../gate/style";
import type { Pt } from "../gate/vocab";
import { dPoly, dPolys, ellipsePoly, hash01, inkLine } from "../gate/vocab";
import { bar, blob, fillOf, line, lines, rod, roundRect } from "./kit";

function paint(env: DrawEnv, d: string, colour: string, outline: number = LINE.item): void {
  const c = env.ctx;
  const p = env.path(d);
  if (outline > 0) {
    c.strokeStyle = INK;
    c.lineWidth = outline * 1.6;
    c.lineJoin = "round";
    c.stroke(p);
  }
  c.fillStyle = colour;
  c.fill(p);
}
const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const qs = (seed: number): number => Math.abs(Math.floor(seed)) % 16;

/** Tarp: a sheet thrown over the target, dropping from above and settling into a draped heap. */
export const tarp: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  c.translate(at.x, at.y);
  const drop = clamp(progress / 0.35);
  const top = -96 + drop * 30 + clamp((progress - 0.35) / 0.65) * 4;
  const s = qs(seed);
  const pts: Pt[] = [];
  const w = 26;
  for (let i = 0; i <= 8; i++) { const x = -w + (2 * w * i) / 8; pts.push([x, top + Math.sin(i * 1.3 + s) * 2.2 * (1 - drop * 0.5) + Math.abs(x) * 0.12]); }
  const hem: Pt[] = [];
  for (let i = 8; i >= 0; i--) { const x = -w - 4 + ((2 * w + 8) * i) / 8; hem.push([x, -2 - (i % 2) * 5 - hash01(s, i) * 3]); }
  paint(env, dPoly([...pts, ...hem]), ALLEY.shutter);
  paint(env, dPolys([inkLine([[-14, top + 10], [-18, -8]], 1.2), inkLine([[2, top + 8], [4, -10]], 1.2), inkLine([[16, top + 10], [20, -6]], 1.2)]), INK, 0);
  paint(env, dPolys([inkLine([[-22, top + 4], [-8, top + 2]], 1.4), inkLine([[-20, top + 18], [-16, top + 40]], 1.0)]), LAMP, 0);
  for (const x of [-20, 0, 20]) paint(env, dPoly(ellipsePoly(x, top + 2.6, 1.2, 1.2, 8)), FX.spark, 0.6);
};

/** Tape: hazard tape wound round the target, tightening. */
export const tape: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  c.translate(at.x, at.y);
  const k = clamp(progress / 0.4);
  const s = qs(seed);
  for (let i = 0; i < 3; i++) {
    const y = -26 - i * 14 + hash01(s, i) * 4;
    const r = 18 - k * 5;
    const band: Pt[] = [];
    for (let j = 0; j <= 10; j++) { const a = -Math.PI * 0.95 + (Math.PI * 1.9 * j) / 10; band.push([Math.cos(a) * r, y + Math.sin(a) * 4 + (j - 5) * 0.6 * (i % 2 === 0 ? 1 : -1)]); }
    paint(env, dPoly(inkLine(band, 3.2, false)), PALETTES[3]!.top);
    const stripes: Pt[][] = [];
    for (let j = 1; j < 10; j += 2) { const p = band[j]!; stripes.push([[p[0] - 0.8, p[1] - 1.5], [p[0] + 0.8, p[1] - 1.5], [p[0] + 0.2, p[1] + 1.5], [p[0] - 1.4, p[1] + 1.5]]); }
    paint(env, dPolys(stripes), INK, 0);
  }
};

/** Crackers: firecrackers popping round the target's feet, a few at a time. */
export const crackers: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  c.translate(at.x, at.y);
  const s = qs(seed);
  for (let i = 0; i < 6; i++) {
    const t0 = hash01(s, i) * 0.7;
    const u = (progress - t0) / 0.25;
    if (u < 0 || u > 1) continue;
    const x = (hash01(s, i + 9) - 0.5) * 40;
    const y = -2 - hash01(s, i + 19) * 30 * u;
    const r = 3 + 5 * Math.sin(u * Math.PI);
    const star: Pt[] = [];
    for (let k = 0; k < 14; k++) { const a = (k * Math.PI) / 7; const rr = k % 2 === 0 ? r : r * 0.45; star.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    paint(env, dPoly(star), k2(i) ? FX.spark : GLOW_HOT);
    paint(env, dPoly(ellipsePoly(x, y, r * 0.3, r * 0.3, 8)), FX.burstCore, 0);
  }
  function k2(i: number): boolean { return i % 2 === 0; }
};

/** Rings: sound rings spreading forward from the user (Whistle, Air Horn). */
export const rings: FxDraw = (env, progress, at) => {
  const c = env.ctx;
  c.translate(at.x, at.y - 66);
  c.scale(at.facing, 1);
  for (let i = 0; i < 3; i++) {
    const u = progress * 1.4 - i * 0.2;
    if (u <= 0 || u >= 1) continue;
    const r = 8 + u * 40;
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) { const a = -0.7 + (1.4 * k) / 12; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    c.globalAlpha = 1 - u;
    paint(env, dPoly(inkLine(pts, 2.6, true)), FX.whoosh, 0.8);
    c.globalAlpha = 1;
  }
};

/** Plus: green plus signs rising off the user (a heal). */
export const plus: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  c.translate(at.x, at.y);
  const s = qs(seed);
  for (let i = 0; i < 5; i++) {
    const u = clamp((progress - i * 0.1) / 0.6);
    if (u <= 0 || u >= 1) continue;
    const x = (hash01(s, i) - 0.5) * 34;
    const y = -30 - hash01(s, i + 7) * 40 - u * 26;
    const k = 2.4 + hash01(s, i + 3) * 2;
    const p: Pt[] = [[-k, -k * 0.35], [-k * 0.35, -k * 0.35], [-k * 0.35, -k], [k * 0.35, -k], [k * 0.35, -k * 0.35], [k, -k * 0.35], [k, k * 0.35], [k * 0.35, k * 0.35], [k * 0.35, k], [-k * 0.35, k], [-k * 0.35, k * 0.35], [-k, k * 0.35]];
    c.globalAlpha = Math.sin(u * Math.PI);
    paint(env, dPoly(p.map(([a, b]) => [a + x, b + y] as Pt)), ICON.health);
    c.globalAlpha = 1;
  }
};

/** Trail: the Haymaker's wide swing arc, a thick white crescent fading behind the fist. */
export const trail: FxDraw = (env, progress, at) => {
  const c = env.ctx;
  c.translate(at.x, at.y - 56);
  c.scale(at.facing, 1);
  const u = clamp(progress);
  const a1 = -2.2 + u * 2.6;
  const a0 = a1 - 1.6;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let k = 0; k <= 12; k++) {
    const a = a0 + ((a1 - a0) * k) / 12;
    outer.push([Math.cos(a) * 30, Math.sin(a) * 30]);
    inner.push([Math.cos(a) * (30 - 6 * (k / 12)), Math.sin(a) * (30 - 6 * (k / 12))]);
  }
  c.globalAlpha = 1 - u * 0.8;
  paint(env, dPoly([...outer, ...inner.reverse()]), FX.whoosh, 0.6);
  c.globalAlpha = 1;
  void TEAL;
};

export const CONTENT_FX = { tarp, tape, crackers, rings, plus, trail };

// ---------------------------------------------------------------------------- Move props
/** The can of the Energy Drink, the referee whistle and the air horn: small real objects drawn
 *  in the back hand while their Move plays (item units, grip at the origin). */
export const PROPS: Record<MoveProp, PropArt> = {
  can: { grip: { x: 0, y: 0, rot: 80 }, shapes: [
    fillOf(roundRect(-6, -2.6, 12, 5.2, 0.8), "metal", 0),
    fillOf(roundRect(-3, -2.6, 6, 5.2, 0.2), "accent", 1),
    lines([[[-5.2, -2.6], [-5.2, 2.6]], [[5.2, -2.6], [5.2, 2.6]]], 0.25, 2, false),
    fillOf(bar(4.8, 6.6, [[0, 2.2], [1, 1.6]], 0), "metal", 1.5),
  ] },
  whistle: { grip: { x: 0, y: 0, rot: -10 }, shapes: [
    fillOf([[-1, -1.2], [4, -1.2], [5, -0.4], [7.4, -0.6], [8.6, 1.4], [7, 3.4], [4.4, 3], [2.6, 1.2], [-1, 1.2]], "metal", 0),
    blob(6.4, 1.4, 0.7, 0.7, 1, 8),
    fillOf(ellipsePoly(-1.6, 0, 1.2, 1.2, 10), "accent", 0.5),
  ] },
  horn: { grip: { x: 0, y: 0, rot: -10 }, shapes: [
    fillOf(rod(-3.6, 3, 2.2, 0.4), "accent", 0),
    fillOf(roundRect(2.4, -1.2, 2.6, 2.4, 0.3), "metal", 1),
    fillOf([[4.6, -0.9], [8, -0.9], [12.6, -3.6], [12.6, 3.6], [8, 0.9], [4.6, 0.9]], "metal", 2),
    line([[12.4, -3.2], [12.4, 3.2]], 0.3, 3, false),
  ] },
};
