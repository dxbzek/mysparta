/**
 * The stage camera (owner amendment, fight screen v2, plan 13.7). The brief's fixed full-stage
 * camera made the scrappers 91 px tall on a phone; the owner asked for large fighters whose faces
 * read. The camera frames the two scrappers (and a companion while it acts), pans and zooms a
 * little toward the action, and pushes in for a moment on a crit and on the knockout blow.
 *
 * Like everything in the stage it is a pure function of `t` and the built tracks: the framing at
 * `t` is a weighted average of the raw framing at fixed offsets around `t`, so a seek, a replay,
 * 2x and the Node video all see the same picture. Nothing is kept between frames.
 *
 * Reduced motion: the camera holds the home framing and never moves.
 */
import type { ActorId } from "@rankzero/core";
import type { Nudge, Tracks } from "./model";
import { FLOOR_Y, HOME, STAGE_H, STAGE_W } from "./layout";
import { drawPlace, segAt } from "./track";

/** Every number of the camera, in stage units and ms at 1x. */
export const CAMERA = {
  /** Half the width kept around a scrapper standing in guard, around one that swings, flinches or
   *  throws (its arms and weapon reach out), and around one lying down. */
  padScrapper: 20,
  padAction: 32,
  /** A heavy flinch leans far back. */
  padHeavy: 42,
  padDown: 46,
  padCompanion: 20,
  /** The camera never shows less height than this, so a scrapper (about 80 units) fills at most
   *  about 60% of the canvas and numbers keep some air above the heads. */
  minVisibleH: 122,
  /** Space under the scrappers' floor line, and under a companion's (which stands nearer). */
  under: 13,
  underCompanion: 7,
  /** Smoothing: samples from -span to +span around t, triangular weights. */
  smoothSpan: 320,
  smoothStep: 40,
  /** How soft the envelope's maximum is, in stage units (smaller = closer to the true maximum). */
  softness: 7,
  /** A scrapper outside this range (jumping in, running off) is held at its edge for framing. */
  slack: 70,
  /** The push-in on a heavy hit: how much closer, how fast in, how slow out. */
  punchCrit: 0.1,
  punchKo: 0.2,
  punchInMs: 70,
  punchOutMs: 520,
  /** Shakes of at least this size are a crit or the knockout (tuning CONTACT.shake). */
  punchAmpCrit: 6,
  punchAmpKo: 8,
} as const;

/** The part of the stage in view: its left and top edge in stage units, and stage units to CSS px. */
export interface CameraView { x0: number; y0: number; k: number }

interface Raw { x0: number; x1: number; bottom: number }

const nudgeCache = new WeakMap<Tracks, Map<ActorId, Nudge[]>>();
function nudgesOf(tr: Tracks): Map<ActorId, Nudge[]> {
  let m = nudgeCache.get(tr);
  if (m === undefined) {
    m = new Map();
    for (const n of tr.nudges) {
      const list = m.get(n.actor);
      if (list === undefined) m.set(n.actor, [n]);
      else list.push(n);
    }
    nudgeCache.set(tr, m);
  }
  return m;
}

/** The raw framing at one time: the span to keep in view and the lowest floor line. */
function rawAt(tr: Tracks, t: number, still: boolean): Raw {
  const lo = HOME.x - CAMERA.slack;
  const hi = STAGE_W - HOME.x + CAMERA.slack;
  let x0 = Infinity;
  let x1 = -Infinity;
  let floor = FLOOR_Y;
  const nudges = nudgesOf(tr);
  for (const a of tr.actors) {
    const scrapper = a.rig === "scrapper";
    const shown = t >= a.showFrom && t < a.goneAt;
    if (still || !shown) {
      if (!scrapper) continue;
      x0 = Math.min(x0, a.home.x - CAMERA.padScrapper);
      x1 = Math.max(x1, a.home.x + CAMERA.padScrapper);
      continue;
    }
    const p = drawPlace(a, nudges.get(a.id) ?? [], t);
    const seg = segAt(a, t);
    if (!scrapper) {
      // a companion counts for its depth always, and for the width only while it acts
      if (p.x > 0 && p.x < STAGE_W) floor = Math.max(floor, p.floorY + CAMERA.underCompanion - CAMERA.under);
      if (seg === null || !seg.busy) continue;
    }
    const x = p.x < lo ? lo : p.x > hi ? hi : p.x;
    const down = seg !== null && seg.clip.startsWith("ko");
    const calm = seg === null || seg.clip === "idle" || seg.clip === "brace" || seg.clip === "dash" || seg.clip === "backpedal";
    const heavy = seg !== null && (seg.clip === "hit-heavy" || seg.clip === "slammed" || seg.clip === "evade");
    const pad = !scrapper ? CAMERA.padCompanion : down ? CAMERA.padDown : calm ? CAMERA.padScrapper : heavy ? CAMERA.padHeavy : CAMERA.padAction;
    x0 = Math.min(x0, x - pad);
    x1 = Math.max(x1, x + pad);
  }
  if (x0 === Infinity) { x0 = HOME.x - CAMERA.padScrapper; x1 = STAGE_W - HOME.x + CAMERA.padScrapper; }
  return { x0, x1, bottom: Math.min(STAGE_H, floor + CAMERA.under) };
}

/** How far the camera is pushed in at `t` by a crit or the knockout blow (0 = not at all). */
export function punchAt(tr: Tracks, t: number): number {
  let best = 0;
  for (const s of tr.shakes) {
    if (s.amp < CAMERA.punchAmpCrit) continue;
    const e = t - s.from;
    if (e < 0 || e >= CAMERA.punchInMs + CAMERA.punchOutMs) continue;
    const size = s.amp >= CAMERA.punchAmpKo ? CAMERA.punchKo : CAMERA.punchCrit;
    const u = e < CAMERA.punchInMs ? e / CAMERA.punchInMs : 1 - (e - CAMERA.punchInMs) / CAMERA.punchOutMs;
    const shaped = e < CAMERA.punchInMs ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
    best = Math.max(best, size * shaped);
  }
  return best;
}

/** The camera at `t` for a canvas of `view.w x view.h` CSS px. */
export function cameraAt(tr: Tracks, t: number, view: { w: number; h: number }, reduced: boolean): CameraView {
  const w = view.w > 0 ? view.w : STAGE_W;
  const h = view.h > 0 ? view.h : STAGE_H;
  const kOf = (span: number): number => Math.min(w / span, h / CAMERA.minVisibleH);
  let x0: number;
  let x1: number;
  let bottom: number;
  if (reduced) {
    const r = rawAt(tr, t, true);
    ({ x0, x1, bottom } = r);
  } else {
    // A soft envelope of the framings around t: each edge is a smooth maximum (log-sum-exp) of
    // that edge over the span, so the camera opens BEFORE a lunge or a flinch reaches the edge
    // and keeps everyone in view, and it still moves without a jump.
    const tau = CAMERA.softness;
    let total = 0;
    let e0 = 0;
    let e1 = 0;
    let eb = 0;
    const raws: { r: Raw; wgt: number }[] = [];
    for (let o = -CAMERA.smoothSpan; o <= CAMERA.smoothSpan; o += CAMERA.smoothStep) {
      const wgt = CAMERA.smoothSpan + CAMERA.smoothStep - Math.abs(o);
      raws.push({ r: rawAt(tr, Math.max(0, t + o), false), wgt });
      total += wgt;
    }
    const m0 = Math.min(...raws.map((q) => q.r.x0));
    const m1 = Math.max(...raws.map((q) => q.r.x1));
    const mb = Math.max(...raws.map((q) => q.r.bottom));
    for (const { r, wgt } of raws) {
      e0 += wgt * Math.exp((m0 - r.x0) / tau);
      e1 += wgt * Math.exp((r.x1 - m1) / tau);
      eb += wgt * Math.exp((r.bottom - mb) / tau);
    }
    x0 = m0 - tau * Math.log(e0 / total);
    x1 = m1 + tau * Math.log(e1 / total);
    bottom = mb + tau * Math.log(eb / total);
  }
  let cx = (x0 + x1) / 2;
  const kFloor = Math.max(w / STAGE_W, h / STAGE_H);
  let k = kOf(x1 - x0) * (1 + (reduced ? 0 : punchAt(tr, t)));
  if (k < kFloor) k = kFloor;
  const vw = w / k;
  const vh = h / k;
  if (cx - vw / 2 < 0) cx = vw / 2;
  if (cx + vw / 2 > STAGE_W) cx = STAGE_W - vw / 2;
  if (bottom > STAGE_H) bottom = STAGE_H;
  if (bottom - vh < 0) bottom = vh;
  return { x0: cx - vw / 2, y0: bottom - vh, k };
}
