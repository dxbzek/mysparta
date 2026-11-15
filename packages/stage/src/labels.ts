/**
 * Where the tags over the fight go on the canvas (owner, 16 Nov 2026: "The skill is not even
 * identifiable"). Tags used to stack by count in stage units, and under the phone camera the
 * clamp to the top band undid the stack, so a later tag covered an earlier one (HEAD START! over
 * HAYMAKER in 3 of 3 bouts, +40 RIPOSTE over TAUNT). Now:
 *
 *  - every tag rides on its actor: its box sits just over that actor's head, wherever it is now;
 *  - no tag pops in over a fighter's head and shoulders (`avoidOf`), where the Moves happen (the
 *    cocked fist, the whistle, the hands at the ears): under the phone camera the heads are near
 *    the top band, so a tag that has no room above goes beside the head, not down over it;
 *  - every tag is the same small size (the owner turned down bigger name tags: the Move's own
 *    action and effect say which Move it is, sigs.ts);
 *  - no two tags ever overlap: each one takes its spot when it pops in (`birthsFor`: the spots of
 *    the tags already up are fixed, it takes the nearest free one, up first, then down, then to
 *    the side) and keeps it while it shows, so nothing jumps; only when two riders walk into each
 *    other does the younger one step aside in that frame;
 *  - the same words over the same actor while the first still shows are one tag (two "WOODEN
 *    PALLET!" read as one, held until the second's time is up);
 *  - every tag stays inside the canvas and below the top band where the host's controls sit.
 *
 * All in CSS px of the canvas, from the camera of the frame. A pure function of the frame (and of
 * the built tracks for the spots).
 */
import type { ActorId } from "@rankzero/core";
import type { CameraView } from "./camera";
import { cameraAt } from "./camera";
import type { Frame, FrameText } from "./frame";
import { frameAt } from "./frame";
import { STAGE_H, STAGE_W } from "./layout";
import type { Tracks } from "./model";
import { TEXT } from "./tuning";

export const MARGIN = 6;
/** Numbers and tags stay below this band at the top of the canvas, where the host's controls sit. */
export const TOP_BAND = 52;
/** A sticker's box is this many times its text size tall. */
export const STICKER_H = 1.35;

export const LABEL = {
  /** Clear px kept between two tags, and between a riding tag's box and the head under it. */
  gap: 3, headGap: 3,
  /** Text sizes follow the camera up to this scale, so a close camera does not blow them up. */
  kMax: { tag: 2.5 },
  /** The widest a glyph of the body font is drawn, as a share of the text size. */
  glyph: { body: TEXT.glyph },
  /** A tag: padding and the icon's room. */
  tag: { pad: 0.9, icon: 1.25 },
  /** Extra px a CRIT is lifted under the camera, clear of the number it labels. */
  critLift: 12,
} as const;

/** Stage units to CSS px of the canvas: px = unit x k + o. */
export interface Screen { k: number; ox: number; oy: number; w: number; h: number; top: number; cam: boolean }

export function fitView(view: { w: number; h: number; dpr: number }): { k: number; ox: number; oy: number } {
  const dpr = view.dpr > 0 ? view.dpr : 1;
  const k = Math.min(view.w / STAGE_W, view.h / STAGE_H) * dpr;
  return { k, ox: (view.w * dpr - STAGE_W * k) / 2, oy: (view.h * dpr - STAGE_H * k) / 2 };
}

export function screenOf(view: { w: number; h: number; dpr?: number }, cam?: CameraView): Screen {
  if (cam) return { k: cam.k, ox: -cam.x0 * cam.k, oy: -cam.y0 * cam.k, w: view.w, h: view.h, top: TOP_BAND, cam: true };
  const dpr = view.dpr !== undefined && view.dpr > 0 ? view.dpr : 1;
  const f = fitView({ w: view.w, h: view.h, dpr });
  return { k: f.k / dpr, ox: f.ox / dpr, oy: f.oy / dpr, w: view.w, h: view.h, top: 0, cam: false };
}

/** A tag placed on the canvas: its box's centre and size in CSS px, and its text size there. */
export interface Label { t: FrameText; x: number; y: number; w: number; h: number; size: number }
export type Box = { x0: number; x1: number; y0: number; y1: number };
export const boxOf = (l: { x: number; y: number; w: number; h: number }): Box =>
  ({ x0: l.x - l.w / 2, x1: l.x + l.w / 2, y0: l.y - l.h / 2, y1: l.y + l.h / 2 });
const meet = (p: Box, q: Box, gap: number): boolean =>
  Math.min(p.x1, q.x1) + gap > Math.max(p.x0, q.x0) && Math.min(p.y1, q.y1) + gap > Math.max(p.y0, q.y0);

/** The text size in CSS px, without the pop. */
export function labelPx(t: FrameText, s: Screen): number {
  const size = t.size0 ?? t.size;
  if (!s.cam) return size * s.k;
  return size * Math.min(s.k, LABEL.kMax.tag);
}

/** The box a tag needs at text size `px`. */
export function labelSize(t: FrameText, px: number): { w: number; h: number } {
  const n = t.text.length;
  const iconW = t.icon !== undefined ? LABEL.tag.icon * px : 0;
  return { w: LABEL.glyph.body * px * n + LABEL.tag.pad * px + iconW, h: px * STICKER_H };
}

/** Where a tag would sit with nothing else up: a rider's box just over the head point, anything
 *  else centred on its point; held inside the canvas and below the top band. */
function wanted(t: FrameText, s: Screen): Label {
  const size = labelPx(t, s);
  const { w, h } = labelSize(t, size);
  const ax = t.x * s.k + s.ox;
  const ay = t.y * s.k + s.oy;
  const rides = t.actor !== undefined && t.role !== "crit";
  const y = rides ? ay - LABEL.headGap - h / 2 : ay - (s.cam && t.kind === "tag" ? LABEL.critLift : 0);
  return clampIn({ t, x: ax, y, w, h, size }, s);
}

function clampIn(l: Label, s: Screen): Label {
  const hx = l.w / 2 + MARGIN;
  const top = s.top + MARGIN + l.h / 2;
  const bottom = s.h - MARGIN - l.h / 2;
  const x = s.w < 2 * hx ? s.w / 2 : Math.min(s.w - hx, Math.max(hx, l.x));
  const y = bottom < top ? (top + bottom) / 2 : Math.min(bottom, Math.max(top, l.y));
  return { ...l, x, y };
}

/** Where to try a tag, in order: up over the head (a stack), then beside the head (the side away
 *  from the other fighter first, so it does not cover the action between them), then down. `sx`
 *  in tag widths toward the away side, `k` in tag heights. */
const TRIES: readonly (readonly [sx: number, k: number])[] = (() => {
  const out: [number, number][] = [];
  for (const k of [0, -1, -2, -3, -4, -5, -6]) out.push([0, k]);
  // the away side all the way down the body first, then the side toward the other fighter
  for (const sd of [1, -1]) for (const sx of [0.8, 1.1, 1.5, 1.9]) for (const k of [0, 1, 2, -1, 3, -2, 4]) out.push([sd * sx, k]);
  for (const k of [1, 2, 3, 4, 5]) out.push([0, k]);
  for (const sx of [0.55, 1.1, 1.7]) for (const k of [5, 6, 7]) { out.push([sx, k]); out.push([-sx, k]); }
  return out;
})();

/** The nearest free spot for `l` among `placed` and clear of `avoid`. Null when there is none. */
function freeSpot(l: Label, placed: readonly Label[], s: Screen, avoid: readonly Box[] = [], away: 1 | -1 = -1): Label | null {
  const step = l.h + LABEL.gap;
  for (const [sx, k] of TRIES) {
    const c = clampIn({ ...l, x: l.x + away * sx * (l.w + LABEL.gap), y: l.y + k * step }, s);
    const b = boxOf(c);
    if (placed.every((p) => !meet(b, boxOf(p), LABEL.gap - 0.01)) && avoid.every((q) => !meet(b, q, 0))) return c;
  }
  return null;
}

/** Which side of its actor is away from the nearest other fighter (+1 is +x). */
function awayOf(f: Frame, t: FrameText): 1 | -1 {
  const me = f.actors.find((a) => a.id === t.actor);
  if (me === undefined) return -1;
  let best: number | null = null;
  for (const a of f.actors) {
    if (a.id === me.id || a.rig !== "scrapper") continue;
    if (best === null || Math.abs(a.place.x - me.place.x) < Math.abs(best - me.place.x)) best = a.place.x;
  }
  if (best === null) return me.place.x > STAGE_W / 2 ? 1 : -1;
  return best > me.place.x ? -1 : 1;
}

/** The head and shoulders of every standing fighter, in px of the canvas: no tag pops in there. */
export function avoidOf(f: Frame, s: Screen): Box[] {
  const out: Box[] = [];
  for (const a of f.actors) {
    if (a.rig !== "scrapper" || a.clip.startsWith("ko")) continue;
    const k = a.dress.scale > 0 ? a.dress.scale : 1;
    const x = a.place.x + a.place.facing * AVOID.dx * k;
    const y = a.place.y - AVOID.head * k;
    out.push({ x0: (x - AVOID.half * k) * s.k + s.ox, x1: (x + AVOID.half * k) * s.k + s.ox,
      y0: (y - AVOID.up * k) * s.k + s.oy, y1: (y + AVOID.down * k) * s.k + s.oy });
  }
  return out;
}
/** The box kept clear round a fighter's head, in figure units: its head's middle this high over
 *  its floor place and this far forward, and this far each side, up (a cocked fist, a raised horn)
 *  and down (the shoulders and the hands at the face). */
export const AVOID = { head: 74, dx: 2, half: 15, up: 18, down: 16 } as const;

/** A tag's spot relative to where it would sit alone (`wanted`), fixed when it pops in. `twin`:
 *  the same words over the same actor were already up, so it is that tag, held on. */
export interface Spot { dx: number; dy: number; twin?: number }

const isLabel = (t: FrameText): boolean => t.kind === "tag" || t.kind === "sticker";
const order = (p: FrameText, q: FrameText): number => (p.from ?? 0) - (q.from ?? 0) || (p.idx ?? 0) - (q.idx ?? 0);
const sameWords = (p: FrameText, q: FrameText): boolean => p.text === q.text && p.actor !== undefined && p.actor === q.actor;

/**
 * Lays out the tags of one frame. `spots` (from `birthsFor`) keeps each tag where it popped in; a
 * twin is drawn only while the tag it repeats is gone. Older tags are placed first.
 */
export function layoutLabels(f: Frame, s: Screen, spots?: ReadonlyMap<number, Spot>): Label[] {
  const texts = f.texts.filter(isLabel).sort(order);
  const placed: Label[] = [];
  const shown: FrameText[] = [];
  for (const t of texts) {
    // the same words over the same actor, already up: one tag
    if (shown.some((u) => sameWords(u, t))) continue;
    const base = wanted(t, s);
    const spot = t.idx !== undefined ? spots?.get(t.idx) : undefined;
    const want = spot !== undefined ? clampIn({ ...base, x: base.x + spot.dx, y: base.y + spot.dy }, s) : base;
    const b = boxOf(want);
    // a tag with a spot keeps it (it was clear of the heads when it popped in); one without is
    // kept clear of them now
    const avoid = spot === undefined ? avoidOf(f, s) : [];
    const free = placed.every((p) => !meet(b, boxOf(p), LABEL.gap - 0.01)) && avoid.every((q) => !meet(b, q, 0));
    const got = free ? want : freeSpot(want, placed, s, avoid, awayOf(f, t)) ?? want;
    placed.push(got);
    shown.push(t);
  }
  return placed;
}

const births = new WeakMap<Tracks, Map<string, Map<number, Spot>>>();

/** Each tag's spot, fixed at the moment it pops in, for a canvas of `view` (a pure function of the
 *  built tracks; memoised). */
export function birthsFor(tr: Tracks, view: { w: number; h: number }, reduced: boolean): Map<number, Spot> {
  let byView = births.get(tr);
  if (byView === undefined) births.set(tr, (byView = new Map()));
  const key = `${view.w}x${view.h}|${reduced ? 1 : 0}`;
  const hit = byView.get(key);
  if (hit !== undefined) return hit;
  const spots = new Map<number, Spot>();
  const idxs = tr.tags.map((g, i) => i).filter((i) => tr.tags[i]!.kind === "tag" || tr.tags[i]!.kind === "sticker")
    .sort((p, q) => tr.tags[p]!.from - tr.tags[q]!.from || p - q);
  for (const i of idxs) {
    const g = tr.tags[i]!;
    const f = frameAt(tr, g.from);
    const s = screenOf(view, cameraAt(tr, g.from, view, reduced));
    const texts = f.texts.filter(isLabel).sort(order);
    const me = texts.find((t) => t.idx === i);
    if (me === undefined) continue;
    // the tags already up, where they are now
    const up = layoutLabels({ ...f, texts: texts.filter((t) => t.idx !== undefined && spots.has(t.idx)) }, s, spots);
    const twin = up.find((l) => sameWords(l.t, me));
    if (twin !== undefined) {
      const from = spots.get(twin.t.idx!)!;
      spots.set(i, { dx: from.dx, dy: from.dy, twin: twin.t.idx! });
      continue;
    }
    const base = wanted(me, s);
    const away = awayOf(f, me);
    const got = freeSpot(base, up, s, avoidOf(f, s), away) ?? freeSpot(base, up, s, [], away) ?? base;
    spots.set(i, { dx: got.x - base.x, dy: got.y - base.y });
  }
  byView.set(key, spots);
  return spots;
}

/** The actor a riding tag is over, for tests. */
export const riderOf = (l: Label): ActorId | undefined => l.t.actor;
