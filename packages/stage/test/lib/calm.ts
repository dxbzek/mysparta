/**
 * Screen motion measured frame by frame (calm fight, owner 15 Nov 2026: "I'm getting dizzy
 * watching it"). Every 60 fps frame of a bout is sampled: the camera's zoom rate and the speed,
 * acceleration and turns of its centre on the canvas, the screen shake in CSS px, and any actor
 * drawn in the white hit flash. `calmProblems` turns the numbers into sentences against the
 * limits the owner's fix set; the stage test and tools/tmp read the same numbers.
 */
import type { CameraView } from "../../src/camera";
import { cameraAt } from "../../src/camera";
import type { StagePlayer } from "../../src/createFightPlayer";

export const FRAME_MS = 1000 / 60;
/** The limits. Zoom in % per second, pan in CSS px per second (the view's centre on the canvas). */
export const CALM = {
  /** Outside the one knockout push-in the camera may ease no faster than this. */
  zoomRate: 3,
  /** The knockout push-in: its fastest zoom, pan and acceleration. */
  pushZoomRate: 25,
  panSpeed: 140,
  panAccel: 600,
  /** A pan that changes direction faster than this counts as a reversal (none allowed). */
  turnSpeed: 2,
  /** Screen shake: at most this many CSS px, for less than this long, and only this soon after a
   *  crit or the knockout blow. */
  shakePx: 3,
  shakeMs: 150,
} as const;

export interface MotionStats {
  frames: number;
  /** The fastest zoom outside the push-in, and inside it (% per second). */
  maxZoomRate: number;
  maxPushZoomRate: number;
  /** How many separate stretches of zoom faster than `CALM.zoomRate` the bout has, and when the first starts. */
  pushes: number;
  firstPushAt: number | null;
  maxPan: number;
  maxAccel: number;
  reversals: number;
  maxShakePx: number;
  longestShakeMs: number;
  /** Frames that shake although no crit or knockout blow landed in the last `CALM.shakeMs`. */
  strayShakeFrames: number;
  whiteFrames: number;
}

export type CameraFn = (t: number) => CameraView;

/** The numbers for one bout on one canvas. `cam` replaces the stage camera (a planted fault). */
export function motionStats(p: StagePlayer, view: { w: number; h: number }, reduced: boolean, cam?: CameraFn): MotionStats {
  const camera: CameraFn = cam ?? ((t) => cameraAt(p.tracks, t, view, reduced));
  const log = p.timeline;
  const loud = p.timeline.contacts.filter((c) => c.starts.shake !== null).map((c) => c.at);
  const s: MotionStats = { frames: 0, maxZoomRate: 0, maxPushZoomRate: 0, pushes: 0, firstPushAt: null, maxPan: 0, maxAccel: 0,
    reversals: 0, maxShakePx: 0, longestShakeMs: 0, strayShakeFrames: 0, whiteFrames: 0 };
  let prev: { k: number; cx: number; cy: number } | null = null;
  let prevV: number | null = null;
  let lastSign = 0;
  let zooming = false;
  let shakeFrom: number | null = null;
  const dt = FRAME_MS / 1000;
  for (let t = 0; t <= log.durationMs; t += FRAME_MS) {
    s.frames += 1;
    const c = camera(t);
    const cx = c.x0 + view.w / c.k / 2;
    const cy = c.y0 + view.h / c.k / 2;
    if (prev !== null) {
      const z = (Math.abs(Math.log(c.k / prev.k)) / dt) * 100;
      const fast = z > CALM.zoomRate;
      if (fast && !zooming) {
        s.pushes += 1;
        if (s.firstPushAt === null) s.firstPushAt = t;
      }
      zooming = fast;
      if (fast) s.maxPushZoomRate = Math.max(s.maxPushZoomRate, z);
      else s.maxZoomRate = Math.max(s.maxZoomRate, z);
      const vx = ((cx - prev.cx) * c.k) / dt;
      const vy = ((cy - prev.cy) * c.k) / dt;
      const v = Math.hypot(vx, vy);
      s.maxPan = Math.max(s.maxPan, v);
      if (prevV !== null) s.maxAccel = Math.max(s.maxAccel, Math.abs(vx - prevV) / dt);
      const sign = Math.abs(vx) > CALM.turnSpeed ? Math.sign(vx) : 0;
      if (sign !== 0 && lastSign !== 0 && sign !== lastSign) s.reversals += 1;
      if (sign !== 0) lastSign = sign;
      prevV = vx;
    }
    prev = { k: c.k, cx, cy };
    const f = p.frame(t);
    // the stage paints the shake 1:1 in CSS px under the camera (draw.ts SHAKE_PX)
    const px = Math.hypot(f.shake.x, f.shake.y);
    if (px > 1e-9) {
      if (shakeFrom === null) shakeFrom = t;
      s.longestShakeMs = Math.max(s.longestShakeMs, t - shakeFrom + FRAME_MS);
      if (!loud.some((at) => t >= at && t < at + CALM.shakeMs)) s.strayShakeFrames += 1;
    } else shakeFrom = null;
    s.maxShakePx = Math.max(s.maxShakePx, px);
    if (f.actors.some((a) => a.dress.tint === "white")) s.whiteFrames += 1;
  }
  return s;
}

/** Every limit the numbers break, as sentences. `koAt` is when the knockout push-in may start. */
export function calmProblems(s: MotionStats, koAt: number | null, reduced: boolean): string[] {
  const out: string[] = [];
  const r = (v: number): string => v.toFixed(1);
  if (s.maxZoomRate > CALM.zoomRate) out.push(`zoom eases at ${r(s.maxZoomRate)}%/s outside the push-in (limit ${CALM.zoomRate})`);
  if (s.pushes > (reduced ? 0 : 1)) out.push(`${s.pushes} push-ins (limit ${reduced ? 0 : 1})`);
  if (s.firstPushAt !== null && (koAt === null || s.firstPushAt < koAt)) out.push(`a push-in starts at ${Math.round(s.firstPushAt)} ms, before the knockout (${koAt})`);
  if (s.maxPushZoomRate > CALM.pushZoomRate) out.push(`the push-in zooms at ${r(s.maxPushZoomRate)}%/s (limit ${CALM.pushZoomRate})`);
  if (s.maxPan > CALM.panSpeed) out.push(`the camera pans at ${r(s.maxPan)} px/s (limit ${CALM.panSpeed})`);
  if (s.maxAccel > CALM.panAccel) out.push(`the camera accelerates at ${r(s.maxAccel)} px/s2 (limit ${CALM.panAccel})`);
  if (s.reversals > 0) out.push(`the pan turns back ${s.reversals} times`);
  if (s.maxShakePx > CALM.shakePx) out.push(`the screen shakes ${r(s.maxShakePx)} px (limit ${CALM.shakePx})`);
  if (s.longestShakeMs > CALM.shakeMs) out.push(`a shake lasts ${Math.round(s.longestShakeMs)} ms (limit ${CALM.shakeMs})`);
  if (s.strayShakeFrames > 0) out.push(`${s.strayShakeFrames} frames shake with no crit or knockout behind them`);
  if (s.whiteFrames > 0) out.push(`${s.whiteFrames} frames flash an actor white`);
  if (reduced && (s.maxPan > 0 || s.maxZoomRate > 0 || s.maxShakePx > 0)) out.push("reduced motion moves the camera or shakes");
  return out;
}
