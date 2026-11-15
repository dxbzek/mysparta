/**
 * The stage camera (calm camera, owner 15 Nov 2026: "I'm getting dizzy watching it").
 *
 * The camera of fight screen v2 followed every lunge, flinch and companion run with a smoothed
 * pan and zoom and pushed in on every crit: up to 557% zoom per second and 1314 px/s of pan on a
 * phone, with hundreds of reversals in one bout. It now holds ONE frame for the whole bout: the
 * frame that fits both scrappers' home marks (plus room for a knockback, a lean and a heavy
 * flinch) and every companion's mark, with the fighters as large as that allows. Nothing that
 * happens in the bout moves it.
 *
 * The one exception is the knockout. A knocked-out scrapper falls on its back, away from the
 * fight, and lies about a body length behind its mark: outside the bout's frame. From the
 * knockout on the camera makes ONE slow reframe (2.6 s, eased, never turning back) to the frame
 * that holds the bout's frame and the body on the floor, and stays there for the outro.
 *
 * Like everything in the stage it is a pure function of `t` and the built tracks.
 * Reduced motion: the bout's frame from start to end; the camera never moves (a fallen body may
 * lie partly outside it).
 */
import type { Tracks } from "./model";
import { FLOOR_Y, STAGE_H, STAGE_W } from "./layout";

/** Every number of the camera, in stage units and ms at 1x. */
export const CAMERA = {
  /** Half the width kept around a scrapper's home mark: its body, a knockback, a heavy lean back.
   *  A thing that goes further (a pet running off) leaves the frame; the frame does not chase it. */
  scrapperExtent: 40,
  /** Room kept round a pet's drawn box at its mark (layout.PET_MARKS: pets stand beside their
   *  owner, on his back side), for its idle breathing. */
  companionMargin: 3,
  /** The camera never shows less height than this, so a scrapper (about 80 units) fills at most
   *  about 65% of the canvas and numbers keep some air above the heads. */
  minVisibleH: 122,
  /** Space under the scrappers' floor line, and under a companion's (which stands nearer). */
  under: 13,
  underCompanion: 7,
  /** How far behind its mark a knocked-out body reaches, lying on its back (head and arms), when
   *  the timeline has not measured it (`koFocus.reach`, review finding 22: 92 cut a hand off). */
  bodyLength: 92,
  /** Room kept past the far end of the measured body. */
  bodyMargin: 6,
  /** The knockout reframe: eased over this long. Its fastest zoom is 1.5 x ln(k0 / k1) / 2.6 s,
   *  about 22% per second for the widest case (a body lying at the stage's edge), once per bout. */
  koMoveMs: 2600,
} as const;

/** The part of the stage in view: its left and top edge in stage units, and stage units to CSS px. */
export interface CameraView { x0: number; y0: number; k: number }

/** The span to keep in view. On a canvas too narrow for all of it (a tall phone shows at most
 *  240 x w / h stage units across), `must` stays in view: the scrappers' marks and room, and in
 *  the outro the knocked-out body; the pets at the far ends are the ones cut. When even `must`
 *  does not fit, the body's far end (`keepAt`, on the `keep` side) stays in. */
interface Span { x0: number; x1: number; bottom: number; must?: { x0: number; x1: number }; keep?: "x0" | "x1"; keepAt?: number }

/** The fixed frame of a bout: the stage span to keep in view and the lowest floor line. */
export function frameSpan(tr: Tracks): Span {
  let x0 = Infinity;
  let x1 = -Infinity;
  let c0 = Infinity;
  let c1 = -Infinity;
  let bottom = FLOOR_Y + CAMERA.under;
  for (const a of tr.actors) {
    const scrapper = a.rig === "scrapper";
    if (scrapper) {
      c0 = Math.min(c0, a.home.x - CAMERA.scrapperExtent);
      c1 = Math.max(c1, a.home.x + CAMERA.scrapperExtent);
      x0 = Math.min(x0, c0);
      x1 = Math.max(x1, c1);
    } else {
      // the pet's whole drawn box at its mark, facing the fight
      const m = CAMERA.companionMargin;
      const [l, r] = a.homeFacing === 1 ? [a.reach.back, a.reach.front] : [a.reach.front, a.reach.back];
      x0 = Math.min(x0, a.home.x - l - m);
      x1 = Math.max(x1, a.home.x + r + m);
    }
    bottom = Math.max(bottom, a.home.y + (scrapper ? CAMERA.under : CAMERA.underCompanion));
  }
  if (x0 === Infinity) { x0 = 0; x1 = STAGE_W; }
  const s: Span = { x0, x1, bottom: Math.min(STAGE_H, bottom) };
  if (c0 !== Infinity) s.must = { x0: c0, x1: c1 };
  return s;
}

/** The outro frame: the bout's frame and the knocked-out body on the floor. */
export function outroSpan(tr: Tracks): Span {
  const s = frameSpan(tr);
  const f = tr.koFocus;
  if (f === null) return s;
  // the body as the rig draws it lying there (choreo/fall.ts), and a little room past the hand
  const far = Math.max(0, Math.min(STAGE_W, f.x + f.back * ((f.reach ?? CAMERA.bodyLength) + CAMERA.bodyMargin)));
  const must = s.must ?? { x0: s.x0, x1: s.x1 };
  return { x0: Math.min(s.x0, far), x1: Math.max(s.x1, far), bottom: s.bottom, keep: f.back === 1 ? "x1" : "x0", keepAt: far,
    must: { x0: Math.min(must.x0, far), x1: Math.max(must.x1, far) } };
}

/** How far the knockout reframe has gone at `t`, 0 to 1 (eased; 0 until the knockout). */
export function reframeAt(tr: Tracks, t: number): number {
  const f = tr.koFocus;
  if (f === null) return 0;
  const u = (t - f.at) / CAMERA.koMoveMs;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * (3 - 2 * u);
}

/** The view that fits a span on a canvas of `w x h`. */
function fit(s: Span, w: number, h: number): CameraView {
  const kFloor = Math.max(w / STAGE_W, h / STAGE_H);
  const k = Math.max(kFloor, Math.min(w / (s.x1 - s.x0), h / CAMERA.minVisibleH));
  const vw = w / k;
  let x0 = (s.x0 + s.x1) / 2 - vw / 2;
  const m = s.must ?? s;
  // a tall canvas cannot always open wide enough: the scrappers (and a fallen body) stay in;
  // when even they do not fit, the fallen body's far end does
  if (vw < s.x1 - s.x0) {
    x0 = vw >= m.x1 - m.x0 ? Math.min(m.x0, Math.max(m.x1 - vw, x0))
      : s.keepAt === undefined ? (m.x0 + m.x1 - vw) / 2 : s.keep === "x1" ? s.keepAt - vw : s.keepAt;
  }
  return clampView({ x0, y0: s.bottom - h / k, k }, w, h);
}

/** The camera at `t` for a canvas of `view.w x view.h` CSS px. */
export function cameraAt(tr: Tracks, t: number, view: { w: number; h: number }, reduced: boolean): CameraView {
  const w = view.w > 0 ? view.w : STAGE_W;
  const h = view.h > 0 ? view.h : STAGE_H;
  const start = fit(frameSpan(tr), w, h);
  if (reduced) return start;
  const u = reframeAt(tr, t);
  if (u === 0) return start;
  const end = fit(outroSpan(tr), w, h);
  // the scale moves geometrically and the centre with the same easing, so the reframe is one
  // smooth move with no turn in it
  const k = start.k * Math.pow(end.k / start.k, u);
  const cx = start.x0 + w / start.k / 2 + (end.x0 + w / end.k / 2 - (start.x0 + w / start.k / 2)) * u;
  const by = start.y0 + h / start.k + (end.y0 + h / end.k - (start.y0 + h / start.k)) * u;
  return clampView({ x0: cx - w / k / 2, y0: by - h / k, k }, w, h);
}

function clampView(c: CameraView, w: number, h: number): CameraView {
  const vw = w / c.k;
  const vh = h / c.k;
  const x0 = c.x0 < 0 ? 0 : c.x0 + vw > STAGE_W ? STAGE_W - vw : c.x0;
  const y0 = c.y0 < 0 ? 0 : c.y0 + vh > STAGE_H ? STAGE_H - vh : c.y0;
  return { x0, y0, k: c.k };
}
