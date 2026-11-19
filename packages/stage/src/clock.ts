/**
 * The one fight clock. It holds presentation time `t` (ms at 1x). `tick` adds speed x real time
 * unless paused; `seek` jumps. `t` stays inside 0 to the bout's length. It has no timer of its
 * own: the host calls `tick` from its frame loop with the real time since the last frame.
 *
 * Inside a hold (`Timeline.holds`: a Move, from its action to the end of its signature) the clock
 * runs at no more than `HOLD_SPEED` whatever the speed, so a Move keeps its 1x length in real time
 * at 2x and 3x (review round 2: at 3x every Move shrank to 0.3 to 0.4 s and could not be told
 * apart). Everything between the Moves still runs at the chosen speed.
 */
import type { CreateFightClock, FightClock } from "./contracts";

/** The fastest a hold plays. */
export const HOLD_SPEED = 1;

type Holds = readonly (readonly [from: number, to: number])[];

/** Presentation time after `realDtMs` of real time from `t` at `speed`, honouring the holds. */
export function advance(t: number, realDtMs: number, speed: number, holds: Holds): number {
  let left = realDtMs;
  let at = t;
  for (let guard = 0; left > 1e-9 && guard < 64; guard++) {
    const hold = holds.find((h) => at >= h[0] && at < h[1]);
    const rate = hold !== undefined ? Math.min(speed, HOLD_SPEED) : speed;
    // the next edge where the rate changes
    let edge = Infinity;
    if (hold !== undefined) edge = hold[1];
    else for (const h of holds) if (h[0] > at && h[0] < edge) edge = h[0];
    const need = (edge - at) / rate;
    if (need >= left) return at + left * rate;
    at = edge;
    left -= need;
  }
  return at;
}

/** Real time (ms) from 0 until presentation time `t` at `speed`: the inverse of `advance` from 0,
 *  for a recording (tools/record-bout.mjs) to place frames and sounds. */
export function realAt(t: number, speed: number, holds: Holds): number {
  let real = 0;
  let at = 0;
  const edges = [...new Set(holds.flatMap((h) => [h[0], h[1]]))].filter((e) => e > 0).sort((p, q) => p - q);
  for (const e of [...edges, Infinity]) {
    const to = Math.min(e, t);
    if (to > at) {
      const inHold = holds.some((h) => at >= h[0] && at < h[1]);
      real += (to - at) / (inHold ? Math.min(speed, HOLD_SPEED) : speed);
      at = to;
    }
    if (at >= t) break;
  }
  return real;
}

export const createFightClock: CreateFightClock = (durationMs: number, holds: Holds = []): FightClock => {
  const end = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const hold = (v: number): number => (!(v > 0) ? 0 : v > end ? end : v);
  const spans = [...holds].filter((h) => h[1] > h[0]).sort((p, q) => p[0] - q[0]);
  let t = 0;
  return {
    get t() { return t; },
    speed: 1,
    paused: false,
    tick(realDtMs: number): number {
      if (this.paused || !(realDtMs > 0)) return t;
      const speed = this.speed === 3 ? 3 : this.speed === 2 ? 2 : 1;
      t = hold(speed === 1 || spans.length === 0 ? t + speed * realDtMs : advance(t, realDtMs, speed, spans));
      return t;
    },
    seek(tMs: number): void {
      t = hold(tMs);
    },
  };
};
