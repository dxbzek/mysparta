/**
 * The four gate effects, in the comic style: an inked impact star with speed lines (burst), lamp-
 * lit dust puffs (dust), hot sparks (spark) and white swing streaks (whoosh). Each is a pure
 * function of progress 0..1 and its seed; `at.facing` is the facing of the actor it belongs to
 * (a burst sprays back toward the attacker, a whoosh follows the swing).
 */
import type { DrawEnv, FxDraw, Place } from "../contracts";
import { FX, INK, LINE } from "./style";
import type { Pt } from "./vocab";
import { dPoly, hash01 } from "./vocab";

function star(points: number, r0: number, r1: number, seed: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const outer = i % 2 === 0;
    const r = outer ? r1 * (0.75 + hash01(seed, i) * 0.45) : r0 * (0.85 + hash01(seed, i + 50) * 0.3);
    const a = (i * Math.PI) / points + hash01(seed, 99) * 0.6;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}
function wedge(a: number, r0: number, r1: number, w: number): Pt[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [[c * r0 - s * w * 0.2, s * r0 + c * w * 0.2], [c * r1 - s * w, s * r1 + c * w], [c * r1 + s * w, s * r1 - c * w], [c * r0 + s * w * 0.2, s * r0 - c * w * 0.2]];
}
function begin(env: DrawEnv, at: Place): void {
  env.ctx.translate(at.x, at.y);
}
function fillInk(env: DrawEnv, d: string, colour: string, line: number): void {
  const c = env.ctx;
  const p = env.path(d);
  c.fillStyle = colour;
  c.fill(p);
  if (line > 0) {
    c.strokeStyle = INK;
    c.lineWidth = line;
    c.lineJoin = "round";
    c.stroke(p);
  }
}
const qSeed = (seed: number): number => Math.abs(Math.floor(seed)) % 8;

export const burst: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  begin(env, at);
  const p = progress;
  // pops out in the first 30%, holds, then shrinks away
  const k = p < 0.3 ? 0.55 + (p / 0.3) * 0.6 : p < 0.65 ? 1.15 - (p - 0.3) * 0.4 : 1.01 * (1 - (p - 0.65) / 0.35);
  if (k <= 0.02) return;
  const s = qSeed(seed);
  c.save();
  c.scale(k, k);
  // speed lines spray back toward the attacker
  const lines: string[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (at.facing === 1 ? 0 : Math.PI) + (i / 8 - 0.5) * 2.6 + (hash01(s, i) - 0.5) * 0.2;
    lines.push(dPoly(wedge(a, 14 + hash01(s, i + 10) * 4, 28 + hash01(s, i + 20) * 10, 1.1)));
  }
  fillInk(env, lines.join(""), INK, 0);
  fillInk(env, dPoly(star(12, 6, 15, s)), FX.burst, LINE.figure);
  fillInk(env, dPoly(star(8, 3, 7.5, s + 3)), FX.burstCore, 0);
  c.restore();
};

export const dust: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  begin(env, at);
  const p = progress;
  const s = qSeed(seed);
  c.globalAlpha = c.globalAlpha * (1 - p) * 0.9;
  for (let i = 0; i < 5; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (5 + i * 3.4 + p * (12 + i * 4));
    const y = -2.2 - p * (4 + hash01(s, i) * 6) - i * 0.6;
    const r = 2.6 + p * 5 + hash01(s, i + 5) * 1.6;
    const pts: Pt[] = [];
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2;
      const rr = r * (0.8 + hash01(s, i * 10 + j) * 0.35);
      pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr]);
    }
    fillInk(env, dPoly(pts), FX.dust, 0.8);
  }
};

export const spark: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  begin(env, at);
  const p = progress;
  const s = qSeed(seed);
  c.globalAlpha = c.globalAlpha * (1 - p * p);
  const out: string[] = [];
  for (let i = 0; i < 9; i++) {
    const a = hash01(s, i) * Math.PI * 2;
    const r0 = 2 + p * 10;
    const r1 = r0 + 6 + hash01(s, i + 30) * 8 * (1 - p * 0.5);
    out.push(dPoly(wedge(a, r0, r1, 0.9)));
  }
  fillInk(env, out.join(""), FX.spark, 0.5);
};

export const whoosh: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  begin(env, at);
  c.scale(at.facing, 1);
  const p = progress;
  const s = qSeed(seed);
  c.globalAlpha = c.globalAlpha * (1 - p) * 0.9;
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = 22 + i * 6 + hash01(s, i) * 2;
    const a0 = -2.2 + p * 0.6;
    const a1 = a0 + 1.4 + p * 0.5 - i * 0.18;
    const pts: Pt[] = [];
    const w = 1.6 - i * 0.4;
    for (let j = 0; j <= 10; j++) { const a = a0 + ((a1 - a0) * j) / 10; const t = Math.sin((Math.PI * j) / 10); pts.push([Math.cos(a) * (r + w * t), Math.sin(a) * (r + w * t) + 6]); }
    for (let j = 10; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / 10; const t = Math.sin((Math.PI * j) / 10); pts.push([Math.cos(a) * (r - w * t), Math.sin(a) * (r - w * t) + 6]); }
    out.push(dPoly(pts));
  }
  fillInk(env, out.join(""), FX.whoosh, 0);
};

export const GATE_FX = { burst, dust, spark, whoosh };
