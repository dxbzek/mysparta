/**
 * The one fight clock. It holds presentation time `t` (ms at 1x). `tick` adds speed x real time
 * unless paused; `seek` jumps. `t` stays inside 0 to the bout's length. It has no timer of its
 * own: the host calls `tick` from its frame loop with the real time since the last frame.
 */
import type { CreateFightClock, FightClock } from "./contracts";

export const createFightClock: CreateFightClock = (durationMs: number): FightClock => {
  const end = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const hold = (v: number): number => (!(v > 0) ? 0 : v > end ? end : v);
  let t = 0;
  return {
    get t() { return t; },
    speed: 1,
    paused: false,
    tick(realDtMs: number): number {
      if (this.paused || !(realDtMs > 0)) return t;
      t = hold(t + (this.speed === 3 ? 3 : this.speed === 2 ? 2 : 1) * realDtMs);
      return t;
    },
    seek(tMs: number): void {
      t = hold(tMs);
    },
  };
};
