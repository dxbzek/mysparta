/**
 * The skills' own pictures on the stage (owner, 16 Nov 2026, on his phone: "The skill is not even
 * identifiable", then, against bigger tags: "No it's not about it. The effects aren't there").
 * Each Move has a signature a viewer can name without reading a word, drawn on the actors where
 * they are in this frame, in the rig's style: flat fills, one ink outline, glow as stepped flat
 * shapes with alpha, no gradient, no filter. No dim, no floor ring, no banner, no flash, no shake.
 *
 *   haymaker         the cocked fist glows hot and crackles, power lines pull into it, speed
 *                    lines stream off his back; on the boosted swing the fist glows and a big
 *                    star bursts on the target.
 *   energy-drink     fizz bubbles off the can at his mouth; a green crackle round him as it hits.
 *   tarp             speed lines behind the flying sheet.
 *   whistle          teal sound arcs pulse out of his mouth, shrill marks over his head.
 *   snatch           a streak where the weapon flies from the robbed hand to his, a flash where
 *                    it left.
 *   air-horn         a blast flares at the horn's bell and white sound waves cross the stage in
 *                    a cone to the enemy, whose head shakes in shock marks.
 *   body-slam        motion arcs as he hauls the enemy over his head, then cracks in the floor and
 *                    a ring of dust where it lands.
 *   sand-in-the-eyes a tan cloud and falling grains round the enemy's face.
 *   taunt            a jagged shout burst at his mouth with shout lines, pumping with his fist.
 *   angry            (the Taunt's target) red anger marks at the temple and steam off the head.
 *   second-wind      air streams pulled into his mouth, green sparkles rising round him.
 *   grapple          strain marks squeezing in round the hug, sweat flying off the enemy.
 *   proc             a passive's small mark (`PROC_MARK`): the armour plate's flash on the chest,
 *                    a blade's glint, steam off a stubborn head, a heart for a pet lover.
 *
 * Firecrackers keeps the rig's own crackers effect (the lit bundle, its flight and the pops).
 */
import type { SkillId } from "@rankzero/core";
import type { DrawEnv, Pose, Rig } from "@rankzero/rig";
import type { FrameActor, FrameSig } from "./frame";
import { CORAL, GREEN, INK, SIG_COLOUR, TEAL, VOLT, WHITE } from "./palette";

type Pt = { x: number; y: number };
type C = DrawEnv["ctx"];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (a: number, b: number): number => {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 0x9e37, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Where to draw on an actor in this frame. */
export interface Body { a: FrameActor; f: 1 | -1; head: Pt; mouth: Pt; chest: Pt; hand: Pt; feet: Pt; s: number }

export function bodyOf(rig: Rig, a: FrameActor, pose: Pose): Body {
  const f = a.place.facing;
  const s = a.dress.scale > 0 ? a.dress.scale : 1;
  const rx = pose.root.x * s;
  const ry = pose.root.y * s;
  const hp = rig.hitPoint(a.rig, a.dress, "head");
  const bp = rig.hitPoint(a.rig, a.dress, "body");
  const head = { x: a.place.x + f * (hp.x + rx), y: a.place.y + hp.y + ry };
  const chest = { x: a.place.x + f * (bp.x + rx), y: a.place.y + bp.y + ry };
  const big = a.rig === "scrapper";
  const mouth = { x: head.x + f * (big ? 5 : 4), y: head.y + (big ? 3 : 1) };
  const h = rig.handAnchor(pose, a.dress, a.place);
  return { a, f, head, mouth, chest, hand: { x: h.x, y: h.y }, feet: { x: a.place.x, y: a.place.y }, s };
}

// ------------------------------------------------------------------ drawing kit
function inkLine(c: C, pts: readonly Pt[], colour: string, w: number): void {
  if (pts.length < 2) return;
  c.beginPath();
  c.moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) c.lineTo(p.x, p.y);
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = INK;
  c.lineWidth = w + 1.8;
  c.stroke();
  c.strokeStyle = colour;
  c.lineWidth = w;
  c.stroke();
}
function shape(c: C, pts: readonly Pt[], fill: string, line = 1.2): void {
  c.beginPath();
  c.moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) c.lineTo(p.x, p.y);
  c.closePath();
  if (line > 0) {
    c.strokeStyle = INK;
    c.lineWidth = line * 1.6;
    c.lineJoin = "round";
    c.stroke();
  }
  c.fillStyle = fill;
  c.fill();
}
function disc(c: C, p: Pt, r: number, fill: string, line = 1): void {
  c.beginPath();
  c.ellipse(p.x, p.y, r, r, 0, 0, Math.PI * 2);
  if (line > 0) {
    c.strokeStyle = INK;
    c.lineWidth = line * 1.6;
    c.stroke();
  }
  c.fillStyle = fill;
  c.fill();
}
/** A spiky star of `n` points. */
function star(c: C, p: Pt, r: number, n: number, fill: string, rot = 0, inner = 0.45, line = 1.1): void {
  const pts: Pt[] = [];
  for (let k = 0; k < 2 * n; k++) {
    const a = rot + (k * Math.PI) / n;
    const rr = k % 2 === 0 ? r : r * inner;
    pts.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr });
  }
  shape(c, pts, fill, line);
}
/** An arc stroke: centre, radius, from angle a0 to a1. */
function arc(c: C, p: Pt, r: number, a0: number, a1: number, colour: string, w: number): void {
  const pts: Pt[] = [];
  for (let k = 0; k <= 12; k++) { const a = a0 + ((a1 - a0) * k) / 12; pts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }); }
  inkLine(c, pts, colour, w);
}
function zigzag(c: C, from: Pt, to: Pt, n: number, amp: number, seed: number, colour: string, w: number): void {
  const pts: Pt[] = [from];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let k = 1; k < n; k++) {
    const u = k / n;
    const off = (hash(seed, k) - 0.5) * 2 * amp;
    pts.push({ x: from.x + dx * u - (dy / len) * off, y: from.y + dy * u + (dx / len) * off });
  }
  pts.push(to);
  inkLine(c, pts, colour, w);
}
/** A stepped glow: flat discs at falling alpha (no gradient). */
function glow(c: C, p: Pt, r: number, colour: string, alpha: number): void {
  const a0 = c.globalAlpha;
  for (const [k, al] of [[1, 0.18], [0.72, 0.28], [0.46, 0.45]] as const) {
    c.globalAlpha = a0 * alpha * al;
    c.beginPath();
    c.ellipse(p.x, p.y, r * k, r * k, 0, 0, Math.PI * 2);
    c.fillStyle = colour;
    c.fill();
  }
  c.globalAlpha = a0;
}
function puff(c: C, p: Pt, r: number, fill: string): void {
  const pts: Pt[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const rr = r * (1 + 0.1 * Math.sin(k * 2.7));
    pts.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr * 0.85 });
  }
  shape(c, pts, fill, 0.8);
}
function heart(c: C, p: Pt, r: number, fill: string): void {
  const pts: Pt[] = [];
  for (let k = 0; k <= 24; k++) {
    const t = (k / 24) * Math.PI * 2;
    pts.push({ x: p.x + r * 0.9 * Math.pow(Math.sin(t), 3), y: p.y - r * (0.8 * Math.cos(t) - 0.3 * Math.cos(2 * t) - 0.12 * Math.cos(3 * t)) });
  }
  shape(c, pts, fill, 1);
}
/** Lines streaming off the back of a body, sliding back over time. */
function speedLines(c: C, b: Body, e: number, n: number, colour: string, seed: number): void {
  for (let k = 0; k < n; k++) {
    const y = b.feet.y - 16 - hash(seed, k) * 54;
    const slide = ((e / 260 + hash(seed, k + 9)) % 1) * 14;
    const x0 = b.feet.x - b.f * (14 + slide + hash(seed, k + 3) * 6);
    const len = 10 + hash(seed, k + 5) * 12;
    inkLine(c, [{ x: x0, y }, { x: x0 - b.f * len, y }], colour, 1.4);
  }
}

// ------------------------------------------------------------------ each skill
export type Painter = (c: C, s: FrameSig, me: Body | null, them: Body | null) => void;

const haymaker: Painter = (c, s, me) => {
  if (me === null) return;
  const hot = s.e / 120;
  glow(c, me.hand, 15 + 2 * Math.sin(s.e / 45), VOLT, 1);
  disc(c, me.hand, 5.5 + Math.sin(s.e / 40), "#FFF4B8", 1);
  // power pulled into the fist from all round it
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + 0.4;
    const u = (s.e / 240 + k / 6) % 1;
    const r0 = 26 - u * 14;
    inkLine(c, [{ x: me.hand.x + Math.cos(a) * r0, y: me.hand.y + Math.sin(a) * r0 }, { x: me.hand.x + Math.cos(a) * (r0 - 6), y: me.hand.y + Math.sin(a) * (r0 - 6) }], VOLT, 1.3);
  }
  // it crackles
  for (let k = 0; k < 3; k++) {
    const a = hash(Math.floor(hot), k) * Math.PI * 2;
    zigzag(c, me.hand, { x: me.hand.x + Math.cos(a) * 13, y: me.hand.y + Math.sin(a) * 13 }, 4, 3, Math.floor(hot) * 7 + k, WHITE, 1);
  }
  speedLines(c, me, s.e, 6, WHITE, 11);
};

const haymakerSwing: Painter = (c, s, me, them) => {
  const at = (s.at ?? s.to) - s.from;
  if (me !== null && s.e < at + 40) glow(c, me.hand, 13, VOLT, 1);
  if (them === null || s.e < at) return;
  const u = clamp01((s.e - at) / 300);
  const p = them.chest;
  const r = 12 + 18 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5);
  c.globalAlpha *= 1 - u * u;
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5 + 0.2;
    inkLine(c, [{ x: p.x + Math.cos(a) * r * 0.9, y: p.y + Math.sin(a) * r * 0.9 }, { x: p.x + Math.cos(a) * (r + 12), y: p.y + Math.sin(a) * (r + 12) }], VOLT, 2);
  }
  star(c, p, r, 9, VOLT, 0.3, 0.5, 1.4);
  star(c, p, r * 0.55, 7, WHITE, 0, 0.5, 0);
};

const energyDrink: Painter = (c, s, me) => {
  if (me === null) return;
  // fizz off the can as he chugs
  for (let k = 0; k < 9; k++) {
    const u = (s.e / 520 + hash(3, k)) % 1;
    const x = me.mouth.x + me.f * (2 + hash(5, k) * 8) + Math.sin(u * 9 + k) * 2;
    const y = me.mouth.y - 4 - u * 26;
    c.globalAlpha = (1 - u) * (s.alpha);
    disc(c, { x, y }, 1.1 + hash(7, k) * 1.4, k % 3 === 0 ? WHITE : SIG_COLOUR["energy-drink"], 0.55);
  }
  c.globalAlpha = s.alpha;
  if (s.progress > 0.55) {
    // the drink hits: green crackle round him
    const k0 = Math.floor(s.e / 80);
    for (let k = 0; k < 4; k++) {
      const a = hash(k0, k) * Math.PI * 2;
      const r = 20 + hash(k0, k + 4) * 8;
      const p = { x: me.chest.x + Math.cos(a) * r * 0.7, y: me.chest.y - 6 + Math.sin(a) * r };
      zigzag(c, p, { x: p.x + Math.cos(a) * 9, y: p.y + Math.sin(a) * 9 }, 3, 2.5, k0 + k, GREEN, 1.3);
    }
  }
};

const whistle: Painter = (c, s, me) => {
  if (me === null) return;
  const dir = me.f === 1 ? 0 : Math.PI;
  for (let k = 0; k < 3; k++) {
    const u = (s.e / 300 + k / 3) % 1;
    c.globalAlpha = s.alpha * (1 - u);
    // (from the whistle's end, so the whistle itself shows)
    arc(c, { x: me.mouth.x + me.f * 12, y: me.mouth.y }, 4 + u * 34, dir - 0.6, dir + 0.6, TEAL, 2.6);
  }
  c.globalAlpha = s.alpha;
  // the shrill note: sharp marks over his head
  const j = Math.floor(s.e / 90);
  for (let k = 0; k < 2; k++) {
    const x = me.head.x + me.f * (4 + k * 8);
    const y = me.head.y - 14 - k * 3;
    zigzag(c, { x, y }, { x: x + me.f * 6, y: y - 7 }, 3, 1.6, j + k, TEAL, 1.4);
  }
};

const airHorn: Painter = (c, s, me, them) => {
  if (me === null) return;
  // (past the horn's own bell, so the horn itself shows)
  const bell = { x: me.mouth.x + me.f * 17, y: me.mouth.y - 2 };
  const to = them !== null ? them.head : { x: bell.x + me.f * 120, y: bell.y };
  const dx = to.x - bell.x;
  const dy = to.y - bell.y;
  const D = Math.max(30, Math.hypot(dx, dy) + 14);
  const dir = Math.atan2(dy, dx);
  // the blast lasts until `at`; the enemy's shock marks go on while it winces
  const blast = (s.at ?? s.to) - s.from;
  const fade = clamp01((blast - s.e) / 160);
  if (fade > 0) {
    c.globalAlpha = s.alpha * fade;
    // the blast at the bell
    const pulse = 1 + 0.15 * Math.sin(s.e / 35);
    star(c, bell, 6 * pulse, 8, WHITE, s.e / 200, 0.5, 1.1);
    // the cone and the sound waves that cross it
    c.globalAlpha = s.alpha * fade * 0.35;
    for (const sd of [-1, 1]) inkLine(c, [bell, { x: bell.x + Math.cos(dir + sd * 0.36) * D, y: bell.y + Math.sin(dir + sd * 0.36) * D }], WHITE, 1.2);
    for (let k = 0; k < 4; k++) {
      const u = (s.e / 420 + k / 4) % 1;
      c.globalAlpha = s.alpha * fade * (1 - u * 0.7);
      arc(c, bell, 8 + u * (D - 8), dir - 0.36, dir + 0.36, WHITE, 3.2);
    }
  }
  c.globalAlpha = s.alpha;
  if (them !== null && s.e > 140) {
    // the enemy's head shakes in shock marks on both sides
    const j = Math.floor(s.e / 70);
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y = them.head.y - 6 + k * 6;
        const x = them.head.x + sd * (10 + (k % 2) * 3);
        zigzag(c, { x, y }, { x: x + sd * 8, y: y - 2 + k * 2 }, 3, 1.8, j + k * 5 + (sd > 0 ? 50 : 0), WHITE, 1.3);
      }
    }
  }
};

const tarp: Painter = (c, s) => {
  if (s.fly === undefined || s.fly.u >= 1) return;
  const vx = s.fly.x - s.fly.x0;
  const vy = s.fly.y - s.fly.y0;
  const len = Math.hypot(vx, vy) || 1;
  for (let k = -1; k <= 1; k++) {
    const ox = (-vy / len) * k * 8;
    const oy = (vx / len) * k * 8;
    const back = 16 + (k === 0 ? 8 : 0);
    inkLine(c, [{ x: s.fly.x + ox - (vx / len) * 18, y: s.fly.y + oy - (vy / len) * 18 },
      { x: s.fly.x + ox - (vx / len) * (18 + back), y: s.fly.y + oy - (vy / len) * (18 + back) }], WHITE, 1.4);
  }
};

const snatch: Painter = (c, s) => {
  if (s.fly === undefined) return;
  const f = s.fly;
  // the flash where the weapon left the hand
  const u0 = clamp01(s.e / 200);
  if (u0 < 1) star(c, { x: f.x0, y: f.y0 }, 4 + 9 * Math.sin(u0 * Math.PI), 6, SIG_COLOUR.snatch, 0.2, 0.45, 1.1);
  // the streak behind it
  c.globalAlpha = s.alpha * (f.u < 1 ? 1 : 0.5);
  const back = 0.55;
  const tail = { x: f.x + (f.x0 - f.x) * back, y: f.y + (f.y0 - f.y) * back };
  inkLine(c, [tail, { x: f.x, y: f.y }], SIG_COLOUR.snatch, 2.6);
  inkLine(c, [{ x: tail.x, y: tail.y - 4 }, { x: f.x, y: f.y - 3 }], WHITE, 1.1);
};

const bodySlam: Painter = (c, s, me, them) => {
  const at = (s.at ?? s.to) - s.from;
  if (me !== null && s.e > at - 340 && s.e < at) {
    // the haul over the head: motion arcs
    const p = { x: me.head.x, y: me.head.y + 6 };
    for (let k = 0; k < 3; k++) arc(c, p, 24 + k * 6, -Math.PI * 0.95, -Math.PI * 0.05, WHITE, 1.4);
  }
  if (s.e < at) return;
  const u = clamp01((s.e - at) / 420);
  const p = them !== null ? them.feet : me !== null ? me.feet : null;
  if (p === null) return;
  c.globalAlpha = s.alpha * (1 - u * 0.8);
  // cracks in the floor (flat on its plane)
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3;
    const r = 8 + 26 * Math.min(1, u * 3);
    zigzag(c, { x: p.x + Math.cos(a) * 4, y: p.y + Math.sin(a) * 1.2 }, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.28 }, 3, 1.5, k + 3, "#2B2118", 1.6);
  }
  // a ring of dust thrown up
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const r = 10 + 30 * u;
    puff(c, { x: p.x + Math.cos(a) * r, y: p.y - 3 + Math.sin(a) * r * 0.25 - 8 * u }, 4 + 4 * u, "#C9A97C");
  }
};

const sand: Painter = (c, s, _me, them) => {
  if (them === null) return;
  const u = s.progress;
  // in front of the face, so the hands rubbing the eyes still show through it
  const face = { x: them.head.x + them.f * 9, y: them.head.y + 1 };
  c.globalAlpha = s.alpha * 0.8 * (u > 0.7 ? 1 - ((u - 0.7) / 0.3) * 0.8 : 1);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + hash(1, k);
    const r = 3 + 6 * Math.min(1, u * 4) + Math.sin(s.e / 160 + k) * 1.2;
    puff(c, { x: face.x + Math.cos(a) * r, y: face.y + Math.sin(a) * r * 0.7 - u * 4 }, 2 + hash(2, k) * 1.6 + u * 1.4, SIG_COLOUR["sand-in-the-eyes"]);
  }
  c.globalAlpha = s.alpha;
  // the grains fall off the face
  for (let k = 0; k < 12; k++) {
    const v = (s.e / 600 + hash(4, k)) % 1;
    disc(c, { x: face.x + (hash(6, k) - 0.5) * 22, y: face.y + 4 + v * 26 }, 0.9, "#B88A4A", 0.4);
  }
};

/** The shout's jagged balloon, pumping with the fist. */
const taunt: Painter = (c, s, me) => {
  if (me === null || s.e < 100) return;
  const beat = Math.abs(Math.sin(((s.e - 100) / 320) * Math.PI));
  const p = { x: me.mouth.x + me.f * 13, y: me.mouth.y - 5 };
  const r = 8 + 3 * beat;
  const pts: Pt[] = [];
  for (let k = 0; k < 18; k++) {
    const a = (k * Math.PI) / 9;
    const rr = k % 2 === 0 ? r * (1.25 + 0.2 * hash(Math.floor(s.e / 110), k)) : r * 0.78;
    pts.push({ x: p.x + Math.cos(a) * rr * 1.2, y: p.y + Math.sin(a) * rr });
  }
  shape(c, pts, SIG_COLOUR.taunt, 1.2);
  star(c, p, r * 0.55, 5, WHITE, 0.1, 0.45, 0);
  // shout lines toward the enemy
  for (const k of [-1, 0, 1]) {
    const a = (me.f === 1 ? 0 : Math.PI) + k * 0.45;
    const r0 = r * 1.7 + beat * 3;
    inkLine(c, [{ x: p.x + Math.cos(a) * r0, y: p.y + Math.sin(a) * r0 }, { x: p.x + Math.cos(a) * (r0 + 8), y: p.y + Math.sin(a) * (r0 + 8) }], WHITE, 1.5);
  }
};

/** The comic anger mark (four bent corners) at the temple, and steam off the head. */
function angerMark(c: C, b: Body, e: number, size: number): void {
  const p = { x: b.head.x - b.f * 4, y: b.head.y - 10 };
  const k = size * (1 + 0.18 * Math.abs(Math.sin(e / 90)));
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const q = { x: p.x + sx * k, y: p.y + sy * k };
    inkLine(c, [{ x: q.x - sx * k * 0.1, y: q.y + sy * k * 0.9 }, { x: q.x + sx * k * 0.05, y: q.y + sy * k * 0.15 }, { x: q.x + sx * k * 0.9, y: q.y - sy * k * 0.1 }], CORAL, 1.5);
  }
}
function steam(c: C, b: Body, e: number, alpha: number): void {
  for (let k = 0; k < 2; k++) {
    const u = (e / 560 + k / 2) % 1;
    c.globalAlpha = alpha * (1 - u);
    puff(c, { x: b.head.x + (k === 0 ? -5 : 5) + Math.sin(u * 6) * 2, y: b.head.y - 12 - u * 16 }, 2.4 + u * 3, WHITE);
  }
  c.globalAlpha = alpha;
}
const angry: Painter = (c, s, me) => {
  if (me === null) return;
  angerMark(c, me, s.e, 4.5);
  steam(c, me, s.e, s.alpha);
};

const secondWind: Painter = (c, s, me) => {
  if (me === null) return;
  // air pulled into the mouth
  for (let k = 0; k < 5; k++) {
    const u = (s.e / 420 + k / 5) % 1;
    const a = (me.f === 1 ? 0 : Math.PI) + (k - 2) * 0.5;
    const r = 30 * (1 - u) + 4;
    const p0 = { x: me.mouth.x + Math.cos(a) * r, y: me.mouth.y + Math.sin(a) * r * 0.8 };
    const p1 = { x: me.mouth.x + Math.cos(a) * (r + 9), y: me.mouth.y + Math.sin(a) * (r + 9) * 0.8 };
    c.globalAlpha = s.alpha * Math.sin(u * Math.PI);
    inkLine(c, [p1, p0], "#D9FFE0", 1.3);
  }
  // green sparkles rising round him
  for (let k = 0; k < 6; k++) {
    const u = (s.e / 700 + hash(8, k)) % 1;
    const p = { x: me.feet.x + (hash(9, k) - 0.5) * 34, y: me.feet.y - 10 - u * 70 };
    c.globalAlpha = s.alpha * Math.sin(u * Math.PI);
    star(c, p, 3.2, 4, GREEN, 0, 0.35, 0.7);
  }
  c.globalAlpha = s.alpha;
};

const grapple: Painter = (c, s, me, them) => {
  if (me === null || them === null) return;
  const mid = { x: (me.chest.x + them.chest.x) / 2, y: (me.chest.y + them.chest.y) / 2 };
  const squeeze = Math.abs(Math.sin(s.e / 110));
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y = mid.y - 12 + k * 10;
      const x = mid.x + sd * (24 - squeeze * 4);
      inkLine(c, [{ x, y: y - 3 }, { x: x - sd * 4, y }, { x, y: y + 3 }], WHITE, 1.4);
    }
  }
  // sweat flies off the held one
  for (let k = 0; k < 3; k++) {
    const u = (s.e / 380 + k / 3) % 1;
    const a = -Math.PI / 2 + (k - 1) * 0.8;
    const p = { x: them.head.x + Math.cos(a) * (8 + u * 14), y: them.head.y - 4 + Math.sin(a) * (8 + u * 14) + u * u * 8 };
    c.globalAlpha = s.alpha * (1 - u);
    shape(c, [{ x: p.x, y: p.y - 3.2 }, { x: p.x + 1.8, y: p.y + 0.6 }, { x: p.x, y: p.y + 2 }, { x: p.x - 1.8, y: p.y + 0.6 }], "#BFEFFF", 0.7);
  }
  c.globalAlpha = s.alpha;
};

// ------------------------------------------------------------------ passives
/** Each passive's small mark when it procs: where it sits and what it is. */
export const PROC_MARK: Readonly<Record<string, (c: C, b: Body, e: number, alpha: number) => void>> = {
  padding: (c, b, e) => plate(c, b, e, "#C8A27A", true),
  "plate-vest": (c, b, e) => plate(c, b, e, "#AEB8C4", false),
  anticipation: (c, b, e) => eyeGlint(c, b, e, WHITE, false),
  "sharp-eye": (c, b, e) => eyeGlint(c, b, e, VOLT, true),
  "sharpening-stone": (c, b, e) => {
    const u = clamp01(e / 500);
    star(c, { x: b.hand.x + b.f * (4 + u * 22), y: b.hand.y - 2 - u * 6 }, 5 + 2 * Math.sin(u * Math.PI), 4, WHITE, 0, 0.25, 0.9);
  },
  "bare-knuckle": (c, b, e) => {
    const r = 5 + 4 * Math.sin(clamp01(e / 400) * Math.PI);
    star(c, b.hand, r, 7, "#FFB45A", 0.2, 0.5, 1);
    for (let k = 0; k < 3; k++) {
      const a = (b.f === 1 ? 0 : Math.PI) + (k - 1) * 0.6;
      inkLine(c, [{ x: b.hand.x + Math.cos(a) * (r + 2), y: b.hand.y + Math.sin(a) * (r + 2) }, { x: b.hand.x + Math.cos(a) * (r + 8), y: b.hand.y + Math.sin(a) * (r + 8) }], "#FFB45A", 1.3);
    }
  },
  payback: (c, b, e) => slashes(c, b, e, CORAL),
  parry: (c, b, e) => slashes(c, b, e, WHITE),
  flurry: (c, b, e) => {
    for (let k = 1; k <= 3; k++) {
      c.globalAlpha *= 0.8;
      arc(c, { x: b.hand.x - b.f * k * 5, y: b.hand.y }, 5, -Math.PI / 2, Math.PI / 2 * (b.f === 1 ? 1 : 3), WHITE, 1.1);
    }
    speedLines(c, { ...b, feet: { x: b.hand.x + b.f * 14, y: b.hand.y + 40 } }, e, 3, WHITE, 21);
  },
  "firm-grip": (c, b, e) => {
    const sq = Math.abs(Math.sin(e / 70));
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const r0 = 6 + sq * 1.5;
      inkLine(c, [{ x: b.hand.x + Math.cos(a) * r0, y: b.hand.y + Math.sin(a) * r0 }, { x: b.hand.x + Math.cos(a) * (r0 + 5), y: b.hand.y + Math.sin(a) * (r0 + 5) }], VOLT, 1.3);
    }
  },
  "head-start": (c, b, e) => {
    speedLines(c, b, e, 6, WHITE, 31);
    puff(c, { x: b.feet.x - b.f * 10, y: b.feet.y - 3 }, 4 + clamp01(e / 400) * 3, "#C9A97C");
  },
  "heavy-lifter": (c, b, e) => {
    // strain: short ticks off both shoulders, shaking, and a bead of sweat
    const j = Math.sin(e / 45) * 0.8;
    for (const sd of [-1, 1]) {
      const sh = { x: b.chest.x + sd * 9, y: b.chest.y - 16 };
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + sd * (0.5 + k * 0.42);
        inkLine(c, [{ x: sh.x + Math.cos(a) * 5 + j, y: sh.y + Math.sin(a) * 5 }, { x: sh.x + Math.cos(a) * 10 + j, y: sh.y + Math.sin(a) * 10 }], WHITE, 1.3);
      }
    }
    sweat(c, b, e);
  },
  pitcher: (c, b, e) => {
    const u = clamp01(e / 450);
    arc(c, { x: b.hand.x - b.f * 6, y: b.hand.y + 6 }, 14, b.f === 1 ? -2.4 + u : -0.7 - u, b.f === 1 ? -0.9 + u : -2.2 - u, WHITE, 2.4);
  },
  "knock-loose": (c, b, e) => star(c, { x: b.hand.x + b.f * 6, y: b.hand.y }, 6 + 5 * Math.sin(clamp01(e / 350) * Math.PI), 6, VOLT, 0.4, 0.42, 1),
  "last-stand": (c, b, e) => {
    glow(c, { x: b.chest.x, y: b.chest.y - 6 }, 30 + 3 * Math.sin(e / 70), CORAL, 0.6);
    // a heartbeat line over the head
    const x0 = b.head.x - 14;
    const y = b.head.y - 16;
    const beat = (e / 450) % 1;
    const pts: Pt[] = [{ x: x0, y }, { x: x0 + 9, y }, { x: x0 + 12, y: y - 7 - 3 * Math.sin(beat * Math.PI) }, { x: x0 + 15, y: y + 6 }, { x: x0 + 18, y }, { x: x0 + 28, y }];
    inkLine(c, pts, CORAL, 1.6);
    heart(c, { x: b.chest.x, y: b.chest.y - 4 }, 3.5 + 1.2 * Math.abs(Math.sin(e / 110)), CORAL);
  },
  stubborn: (c, b, e, alpha) => { steam(c, b, e, alpha); angerMark(c, b, e, 3.5); },
  slippery: (c, b, e) => {
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const x = b.chest.x + sd * (16 + k * 5);
        const pts: Pt[] = [];
        for (let j = 0; j <= 8; j++) pts.push({ x: x + Math.sin(j * 1.2 + e / 60) * 2.2, y: b.chest.y - 22 + j * 6 });
        inkLine(c, pts, "#9FF5E6", 1.2);
      }
    }
  },
  "quick-swap": (c, b, e) => {
    const a0 = e / 90;
    arc(c, b.hand, 9, a0, a0 + Math.PI * 1.4, WHITE, 1.6);
    const tip = { x: b.hand.x + Math.cos(a0 + Math.PI * 1.4) * 9, y: b.hand.y + Math.sin(a0 + Math.PI * 1.4) * 9 };
    star(c, tip, 2.4, 3, WHITE, a0, 0.3, 0.6);
  },
  "pet-lover": (c, b, e) => {
    const u = clamp01(e / 650);
    heart(c, { x: b.head.x + b.f * 9, y: b.head.y - 10 - u * 14 }, 5 + Math.sin(u * Math.PI) * 1.5, CORAL);
  },
  "junk-collector": (c, b, e) => {
    // an arrow curling back into the bag at his hip
    const p = { x: b.feet.x - b.f * 8, y: b.feet.y - 34 };
    const u = clamp01(e / 500);
    const a1 = -Math.PI * 0.5 + Math.PI * 1.5 * (0.3 + 0.7 * u) * b.f;
    arc(c, p, 9, -Math.PI * 0.5, a1, VOLT, 1.8);
    const tip = { x: p.x + Math.cos(a1) * 9, y: p.y + Math.sin(a1) * 9 };
    const d = a1 + (b.f * Math.PI) / 2;
    shape(c, [{ x: tip.x + Math.cos(d) * 4, y: tip.y + Math.sin(d) * 4 }, { x: tip.x + Math.cos(d + 2.4) * 3.5, y: tip.y + Math.sin(d + 2.4) * 3.5 },
      { x: tip.x + Math.cos(d - 2.4) * 3.5, y: tip.y + Math.sin(d - 2.4) * 3.5 }], VOLT, 0.8);
  },
  "trick-shot": (c, b, e) => {
    const u = clamp01(e / 450);
    const p0 = { x: b.hand.x + b.f * 6, y: b.hand.y };
    const pts: Pt[] = [p0, { x: p0.x + b.f * 10, y: p0.y + 10 }, { x: p0.x + b.f * 20, y: p0.y - 2 }, { x: p0.x + b.f * 30, y: p0.y + 8 }];
    inkLine(c, pts.slice(0, 1 + Math.ceil(u * 3)), WHITE, 1.4);
    star(c, pts[Math.min(3, Math.ceil(u * 3))]!, 4, 5, VOLT, 0, 0.45, 0.9);
  },
};
function plate(c: C, b: Body, e: number, fill: string, quilted: boolean): void {
  const u = clamp01(e / 160);
  const p = { x: b.chest.x, y: b.chest.y - 2 };
  const w = 9 * (0.6 + 0.4 * u);
  const h = 13 * (0.6 + 0.4 * u);
  shape(c, [{ x: p.x - w, y: p.y - h }, { x: p.x + w, y: p.y - h }, { x: p.x + w * 0.9, y: p.y + h * 0.7 }, { x: p.x, y: p.y + h }, { x: p.x - w * 0.9, y: p.y + h * 0.7 }], fill, 1.1);
  if (quilted) {
    for (const dy of [-0.4, 0.2]) inkLine(c, [{ x: p.x - w * 0.8, y: p.y + h * dy }, { x: p.x + w * 0.8, y: p.y + h * dy }], fill, 0.5);
  } else {
    // a shine across the plate, and the clank
    const sx = p.x - w + 2 * w * clamp01((e - 120) / 260);
    inkLine(c, [{ x: sx - 2, y: p.y + h * 0.4 }, { x: sx + 3, y: p.y - h * 0.8 }], WHITE, 1.6);
  }
  star(c, { x: p.x + b.f * (w + 4), y: p.y - h * 0.5 }, 4, 5, WHITE, 0.3, 0.42, 0.8);
}
function eyeGlint(c: C, b: Body, e: number, colour: string, aimLine: boolean): void {
  const p = { x: b.head.x + b.f * 4, y: b.head.y - 1 };
  star(c, p, 4 + 2 * Math.sin(clamp01(e / 400) * Math.PI), 4, colour, 0.0, 0.25, 0.8);
  if (aimLine) {
    c.setLineDash([3, 3]);
    inkLine(c, [{ x: p.x + b.f * 7, y: p.y }, { x: p.x + b.f * (30 + clamp01(e / 300) * 30), y: p.y + 6 }], colour, 1.1);
    c.setLineDash([]);
  } else {
    for (const dy of [-4, 4]) inkLine(c, [{ x: p.x + b.f * 7, y: p.y + dy * 0.5 }, { x: p.x + b.f * 13, y: p.y + dy }], colour, 1.1);
  }
}
function slashes(c: C, b: Body, e: number, colour: string): void {
  const u = clamp01(e / 260);
  const p = { x: b.hand.x + b.f * 4, y: b.hand.y };
  const r = 10 * u;
  inkLine(c, [{ x: p.x - r, y: p.y - r }, { x: p.x + r, y: p.y + r }], colour, 2);
  inkLine(c, [{ x: p.x - r, y: p.y + r }, { x: p.x + r, y: p.y - r }], colour, 2);
}
function sweat(c: C, b: Body, e: number): void {
  const u = (e / 420) % 1;
  const p = { x: b.head.x - b.f * 8, y: b.head.y - 4 + u * 10 };
  shape(c, [{ x: p.x, y: p.y - 3.2 }, { x: p.x + 1.8, y: p.y + 0.6 }, { x: p.x, y: p.y + 2 }, { x: p.x - 1.8, y: p.y + 0.6 }], "#BFEFFF", 0.7);
}

const proc: Painter = (c, s, me) => {
  if (me === null || s.skill === undefined) return;
  PROC_MARK[s.skill]?.(c, me, s.e, s.alpha);
};

export const PAINTERS: Readonly<Partial<Record<FrameSig["kind"], Painter>>> = {
  haymaker, "haymaker-swing": haymakerSwing, "energy-drink": energyDrink, whistle, "air-horn": airHorn, tarp, snatch,
  "body-slam": bodySlam, "sand-in-the-eyes": sand, taunt, angry, "second-wind": secondWind, grapple, proc,
};

/** Paints one signature (in stage units, inside the stage transform). */
export function drawSig(env: DrawEnv, s: FrameSig, rig: Rig, pose: (a: FrameActor) => Pose): void {
  const paint = PAINTERS[s.kind];
  if (paint === undefined || s.alpha <= 0) return;
  const me = s.actor !== null ? bodyOf(rig, s.actor, pose(s.actor)) : null;
  const them = s.target !== null ? bodyOf(rig, s.target, pose(s.target)) : null;
  const c = env.ctx;
  c.save();
  c.globalAlpha = clamp01(s.alpha);
  paint(c, s, me, them);
  c.restore();
}

/** The passives with a mark (a test checks that every passive has one). */
export const MARKED_PASSIVES: readonly SkillId[] = Object.keys(PROC_MARK) as SkillId[];
