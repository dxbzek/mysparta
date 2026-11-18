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

/**
 * The Tarp's drawing over its progress, one design for a pet and a fighter (round-2 close, owner
 * on the recorded fight: a tall upright dome over a goose with its head floating over it, a tall
 * blue box over a fighter, the flying tarp the landed dome passing through a head, and a tarp that
 * floated up off the frame and vanished in one frame):
 *  - 0 to `fly`: in flight, a folded sheet flapping and turning over on its arc (`at` is where it
 *    is in the air);
 *  - `fly` to `land`: the drop. It opens over the target and falls; its hem reaches the floor at
 *    `land`, a dome over the standing body (`at` is the target's place on the floor from here);
 *  - `land` to `slump`: the body goes down under it (the stage hides it from `land`) and the sheet
 *    sinks to its low pegged shape, no taller than 0.4 of its width;
 *  - `slump` to `heave`: the pinned body heaves under it (the stage loops this part);
 *  - `heave` to 1: off. Pegs out, it slides along the floor toward `at.facing`, crumples flat and
 *    fades where it comes to rest.
 */
export const TARP = { fly: 0.12, land: 0.3, slump: 0.4, heave: 0.88 } as const;
/** The size a tarp is drawn at when the stage gives none: over a fighter. */
const FIGHTER_TARP = { w: 84, h: 92 };

/** Tarp: a blue poly tarp (round 2, 16 Nov 2026: in the wall teal it vanished into the arena),
 *  3:1 or more on every arena floor, dark folds down the drape, the crown lit by the lamp, a dark
 *  hem with steel eyelets, pegged down on the hem. `size`: the body it covers (`TARP`). */
export const tarp: FxDraw = (env, progress, at, seed, size) => drape(env, progress, at, seed, size ?? FIGHTER_TARP);

/** How far the drawn tarp reaches each side of its centre once pegged down, for a body `w` across
 *  (the stage keeps it inside the frame): the sheet, its spread hem and the pegs on it. */
export function tarpHalf(w: number): number {
  return (w / 2 + 5) * 1.08 + 5 + 1.5;
}
/** The low height of a pegged-down tarp over a body `w` across and `h` tall: 0.4 of its width at most. */
export function tarpLow(w: number, h: number): number {
  return Math.max(6, Math.min(h + 2, 0.4 * w));
}
/** How far the tarp slides along the floor as it comes off, for a body `w` across. */
export function tarpSlide(w: number): number {
  return (w / 2 + 5) * 0.8;
}

/** The folded sheet in the air: about two thirds of its width, flapping and turning over. */
function flying(env: DrawEnv, u: number, at: { x: number; y: number }, s: number, W: number): void {
  const c = env.ctx;
  c.translate(at.x, at.y);
  c.rotate(-0.35 + 0.7 * u);
  const half = W * 0.66;
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const x = -half + (2 * half * i) / 10;
    const wave = Math.sin(i * 0.95 + u * 16 + s) * 3.2;
    const belly = Math.cos((x / half) * Math.PI * 0.5) * 3;
    top.push([x, -3.5 - belly + wave]);
    bottom.push([x, 3 + wave * 0.55 + hash01(s, i) * 0.8]);
  }
  paint(env, dPoly([...top, ...bottom.slice().reverse()]), ALLEY.tarp);
  // the fold along the middle and the hem band along the lower edge
  const mid: Pt[] = [];
  for (let i = 2; i <= 8; i++) mid.push([top[i]![0], (top[i]![1] + bottom[i]![1]) / 2]);
  paint(env, dPolys([inkLine(mid, 0.8)]), ALLEY.tarpFold, 0);
  paint(env, dPoly([...bottom.map(([x, y]) => [x, y - 1.8] as Pt), ...bottom.slice().reverse()]), ALLEY.tarpHem, 0);
  for (const i of [1, 5, 9]) { const q = bottom[i]!; paint(env, dPoly(ellipsePoly(q[0], q[1] - 0.9, 0.8, 0.8, 8)), FX.spark, 0.4); }
}

function drape(env: DrawEnv, progress: number, at: { x: number; y: number; facing: 1 | -1 }, seed: number, size: { w: number; h: number }): void {
  const c = env.ctx;
  const s = qs(seed);
  const W0 = size.w / 2 + 5;
  // over the standing body at touchdown, and its low pegged height after it
  const tall = size.h + 6;
  const low = tarpLow(size.w, size.h);
  if (progress < TARP.fly) { flying(env, progress / TARP.fly, at, s, W0); return; }
  c.translate(at.x, at.y);
  const ease = (u: number): number => 1 - (1 - u) * (1 - u);
  let lift = 0;       // the hem's height over the floor
  let H = low;        // the crown's height over the hem
  let W = W0 * 1.08;  // half the sheet's width
  let spread = 5;     // the hem's spread past it on the floor
  let slide = 0;
  let lumps = 0.06;
  let pegs = false;
  let alpha = 1;
  if (progress < TARP.land) {
    // it opens over the target and falls, the hem reaching the floor at `land`
    const d = (progress - TARP.fly) / (TARP.land - TARP.fly);
    lift = (1 - d * d) * (tall * 0.5 + 4);
    H = tall * (0.5 + 0.5 * d);
    W = W0 * (0.72 + 0.28 * d);
    spread = 2 * d;
  } else if (progress < TARP.slump) {
    // the body goes down under it: the sheet sinks to its low shape and spreads
    const d = (progress - TARP.land) / (TARP.slump - TARP.land);
    H = low + (tall - low) * (1 - ease(d));
    W = W0 * (1 + 0.08 * d);
    spread = 2 + 3 * d;
  } else if (progress <= TARP.heave) {
    // pegged down, heaving as the body under it struggles
    const d = (progress - TARP.slump) / (TARP.heave - TARP.slump);
    H = low + Math.sin(d * Math.PI * 2) * 1.2;
    pegs = true;
  } else {
    // off: it slides along the floor, crumples flat and fades where it comes to rest
    const d = (progress - TARP.heave) / (1 - TARP.heave);
    slide = at.facing * ease(d) * tarpSlide(size.w);
    H = low * (1 - 0.72 * ease(d));
    W = W0 * 1.08 * (1 - 0.18 * d);
    lumps = 0.06 + 0.3 * d;
    alpha = d < 0.45 ? 1 : 1 - (d - 0.45) / 0.55;
  }
  if (alpha <= 0) return;
  c.globalAlpha = alpha;
  c.translate(slide, 0);
  const height = (x: number): number => {
    const u = x / W;
    const crown = 1 + lumps * Math.sin(u * 5 + s) + (lumps > 0.1 ? lumps * 0.6 * Math.sin(u * 11 + s * 2) : 0);
    return -lift - H * crown * Math.pow(Math.max(0, 1 - u * u), 0.45);
  };
  const top: Pt[] = [];
  for (let i = 0; i <= 12; i++) { const x = -W + (2 * W * i) / 12; top.push([x, height(x) + (hash01(s, i) - 0.5) * 1.4]); }
  const hem: Pt[] = [];
  for (let i = 12; i >= 0; i--) {
    const x = -W - spread + ((2 * W + 2 * spread) * i) / 12;
    hem.push([x, -lift + 0.6 - hash01(s, i + 20) * 1.6]);
  }
  paint(env, dPoly([...top, ...hem]), ALLEY.tarp);
  // folds: dark wedges from near the crown down to the hem, where the sheet drapes over the body
  const folds: Pt[][] = [];
  for (const f of [-0.55, 0.05, 0.6]) {
    const x0 = f * W * 0.55;
    const x1 = f * (W + spread);
    folds.push([[x0 - 1, height(x0) + 3], [x0 + 1.4, height(x0) + 3], [x1 + 2.6, -1.5 - lift], [x1 - 2.2, -1 - lift]]);
  }
  paint(env, dPolys(folds), ALLEY.tarpFold, 0);
  // the hem band along the floor, its eyelets steel rings
  const band: Pt[] = hem.map((h) => [h[0], h[1] - 2.4] as Pt).reverse();
  paint(env, dPoly([...band, ...hem]), ALLEY.tarpHem, 0);
  for (let i = 2; i <= 10; i += 4) { const h = hem[i]!; paint(env, dPoly(ellipsePoly(h[0], h[1] - 1.2, 0.8, 0.8, 8)), FX.spark, 0.4); }
  // grime: a few dark scuffs on the sheet
  const grime: Pt[][] = [];
  for (let k = 0; k < 4; k++) {
    const x = (hash01(s, k + 40) - 0.5) * W * 1.3;
    const y = -lift + (height(x) + lift) * (0.35 + hash01(s, k + 50) * 0.4);
    grime.push(ellipsePoly(x, y, 1.6 + hash01(s, k + 60) * 1.4, 0.8, 6));
  }
  paint(env, dPolys(grime), ALLEY.tarpFold, 0);
  // the crown catches the lamp
  paint(env, dPolys([inkLine([[-W * 0.45, height(-W * 0.45) + 1.5], [W * 0.1, height(W * 0.1) + 1.2]], 1.4)]), LAMP, 0);
  if (pegs) {
    // pegged down on the hem: a stake through the end eyelet of each side, its cord tied over the
    // band to the sheet
    for (const side of [-1, 1] as const) {
      const hx = side * (W + spread - 1.5);
      paint(env, dPolys([inkLine([[hx, -3.6], [hx - side * 3.2, -2.2]], 0.6)]), INK, 0);
      paint(env, dPoly([[hx - 1.2, -5.4], [hx + 1.2, -5.4], [hx + 0.4, 1.4], [hx - 0.4, 1.4]]), ALLEY.tarpHem, 0.5);
      paint(env, dPoly(ellipsePoly(hx, -1.2, 1.3, 0.9, 8)), FX.spark, 0.4);
    }
  }
  c.globalAlpha = 1;
}

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

/** Where the lit bundle phase of the crackers ends (progress 0 to this: a bundle with a burning
 *  fuse, in the hand or in the air; after it, the pops round the target). */
export const CRACKERS_LIT = 0.2;

/** Crackers (Firecrackers): first a bundle of red sticks with a fizzing fuse (progress 0 to
 *  `CRACKERS_LIT`: held, then flying, turning end over end), then a string of pops round the
 *  target's feet and body, a few at a time, each a hot star with a puff of smoke after it. */
export const crackers: FxDraw = (env, progress, at, seed) => {
  const c = env.ctx;
  c.translate(at.x, at.y);
  const s = qs(seed);
  if (progress < CRACKERS_LIT) {
    const u = progress / CRACKERS_LIT;
    c.rotate(u * 5.5);
    const sticks: Pt[][] = [];
    for (let i = 0; i < 3; i++) sticks.push([[-4.2 + i * 2.8, -2.4], [-1.8 + i * 2.8, -2.4], [-1.8 + i * 2.8, 5.6], [-4.2 + i * 2.8, 5.6]]);
    paint(env, dPolys(sticks), ALLEY.sign);
    paint(env, dPoly([[-4.6, 1], [4.6, 1], [4.6, 2.4], [-4.6, 2.4]]), FX.burst, 0.5);
    paint(env, dPoly(inkLine([[0, -2.4], [1.2, -5], [0.4, -7.2]], 0.7, false)), INK, 0);
    // the fuse fizzes: a spark that flickers with the seed and the progress
    const f = 1.6 + 1.4 * Math.abs(Math.sin(u * 40 + s));
    const star: Pt[] = [];
    for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; const rr = k % 2 === 0 ? f : f * 0.4; star.push([0.4 + Math.cos(a) * rr, -7.4 + Math.sin(a) * rr]); }
    paint(env, dPoly(star), FX.spark, 0.5);
    return;
  }
  const v = (progress - CRACKERS_LIT) / (1 - CRACKERS_LIT);
  for (let i = 0; i < 8; i++) {
    const t0 = hash01(s, i) * 0.72;
    const u = (v - t0) / 0.26;
    if (u < 0 || u > 1.6) continue;
    const x = (hash01(s, i + 9) - 0.5) * 44;
    const y = -3 - hash01(s, i + 19) * 46;
    if (u > 1) {
      // the smoke after the pop
      const k = u - 1;
      c.globalAlpha = 1 - k / 0.6;
      paint(env, dPoly(ellipsePoly(x, y - k * 8, 3 + k * 6, 2.4 + k * 4, 10)), ALLEY.paint, 0.6);
      c.globalAlpha = 1;
      continue;
    }
    const r = 3.5 + 6 * Math.sin(u * Math.PI);
    const star: Pt[] = [];
    for (let k = 0; k < 14; k++) { const a = (k * Math.PI) / 7 + i; const rr = k % 2 === 0 ? r : r * 0.42; star.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    paint(env, dPoly(star), i % 2 === 0 ? FX.spark : GLOW_HOT);
    paint(env, dPoly(ellipsePoly(x, y, r * 0.3, r * 0.3, 8)), FX.burstCore, 0);
  }
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
/** A prop's outline points scaled about its grip: the whistle and the horn are drawn a size up from
 *  life (verify, 16 Nov 2026: on the phone the whistle itself did not show, only the hand at the
 *  mouth), the way the comic draws a held object to read. */
const up = (k: number, pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [x * k, y * k]);
const WHISTLE_K = 1.6;
/** The air horn a size and a half up, and turned in the hand so the bell points level at the
 *  enemy from in front of the face (review round 2: at 1.3 and the old grip turn the can poked
 *  out behind the skull and the bell pointed down at the chest; the blow's back hand points
 *  about 30 degrees down as drawn, so a grip turn of -31 puts the horn level; the hand holds the back of
 *  the can, so the can sits in front of the face, not behind the skull). */
const HORN_K = 1.6;

/** The can of the Energy Drink, the referee whistle and the air horn: small real objects drawn
 *  in the back hand while their Move plays (item units, grip at the origin). The rig draws one in
 *  front of the face while the hand is up at the mouth. The whistle hangs on a bright lanyard. */
export const PROPS: Record<MoveProp, PropArt> = {
  can: { grip: { x: 0, y: 0, rot: 80 }, shapes: [
    fillOf(roundRect(-6, -2.6, 12, 5.2, 0.8), "metal", 0),
    fillOf(roundRect(-3, -2.6, 6, 5.2, 0.2), "accent", 1),
    lines([[[-5.2, -2.6], [-5.2, 2.6]], [[5.2, -2.6], [5.2, 2.6]]], 0.25, 2, false),
    fillOf(bar(4.8, 6.6, [[0, 2.2], [1, 1.6]], 0), "metal", 1.5),
  ] },
  whistle: { grip: { x: 0, y: 0, rot: -10 }, shapes: [
    // the lanyard: from the ring down toward the neck
    fillOf(up(WHISTLE_K, [[-2.2, 0.2], [-1.2, 0.4], [-1.4, 4], [-2.4, 7.4], [-3.4, 7.2], [-2.4, 3.8]]), "accent", -1),
    fillOf(up(WHISTLE_K, [[-1, -1.2], [4, -1.2], [5, -0.4], [7.4, -0.6], [8.6, 1.4], [7, 3.4], [4.4, 3], [2.6, 1.2], [-1, 1.2]]), "white", 0),
    // a shade along the underside of the barrel (a bright chrome whistle: it must not melt into
    // the skin of the hand and the face behind it)
    fillOf(up(WHISTLE_K, [[4.6, 2.2], [7.2, 2.6], [6.8, 3.2], [4.4, 2.9]]), "metal", 0.5),
    blob(6.4 * WHISTLE_K, 1.4 * WHISTLE_K, 0.7 * WHISTLE_K, 0.7 * WHISTLE_K, 1, 8),
    fillOf(ellipsePoly(-1.6 * WHISTLE_K, 0, 1.2 * WHISTLE_K, 1.2 * WHISTLE_K, 10), "accent", 0.5),
  ] },
  horn: { grip: { x: -2 * HORN_K, y: 0, rot: -31 }, shapes: [
    fillOf(up(HORN_K, rod(-3.6, 3, 2.2, 0.4)), "accent", 0),
    fillOf(up(HORN_K, roundRect(2.4, -1.2, 2.6, 2.4, 0.3)), "metal", 1),
    fillOf(up(HORN_K, [[4.6, -0.9], [8, -0.9], [12.6, -3.6], [12.6, 3.6], [8, 0.9], [4.6, 0.9]]), "metal", 2),
    line(up(HORN_K, [[12.4, -3.2], [12.4, 3.2]]), 0.3 * HORN_K, 3, false),
  ] },
};
