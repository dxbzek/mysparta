/**
 * The fight player: build the timeline once from the log, then every call is a pure function of
 * `t`. `state` is the reducer's state after the steps whose result is shown by `t`; `hud` is the
 * DOM's view; `draw` paints the canvas.
 */
import type { BoutLog, BoutState, FighterSnapshot } from "@rankzero/core";
import { initialState, reduce } from "@rankzero/core";
import type { DrawEnv, Rig } from "@rankzero/rig";
import type { CreateFightPlayer, FightPlayer, HudFrame, PlayerOpts } from "./contracts";
import { poseAt } from "./blend";
import { cameraAt } from "./camera";
import { drawFrame } from "./draw";
import type { Frame } from "./frame";
import { frameAt } from "./frame";
import { hudAt } from "./hud";
import type { Tracks } from "./model";
import type { Internal } from "./timeline";
import { buildTimeline } from "./timeline";

/** The player with two more doors for tests and tools: the frame model and the built tracks. */
export interface StagePlayer extends FightPlayer {
  frame(tMs: number): Frame;
  readonly tracks: Tracks;
}

export function buildPlayer(log: BoutLog, a: FighterSnapshot, b: FighterSnapshot, rig: Rig, opts: PlayerOpts,
  internal: Internal = {}): StagePlayer {
  const tracks = buildTimeline(log, a, b, rig, opts, internal);
  const states: BoutState[] = [initialState(log.init)];
  for (const step of log.steps) states.push(reduce(states[states.length - 1]!, step));
  const applied = (t: number): number => {
    let n = 0;
    while (n < tracks.applyAt.length && tracks.applyAt[n]! <= t) n += 1;
    return n;
  };
  return {
    timeline: tracks.timeline,
    tracks,
    state(tMs: number): BoutState { return states[applied(tMs)]!; },
    hud(tMs: number): HudFrame { return hudAt(tracks, tMs); },
    frame(tMs: number): Frame { return frameAt(tracks, tMs); },
    draw(env: DrawEnv, tMs: number, view: { w: number; h: number; dpr: number }): void {
      drawFrame(env, frameAt(tracks, tMs), rig, opts, view, cameraAt(tracks, tMs, view, opts.reducedMotion),
        (a) => { const tr = tracks.byId.get(a.id); return tr ? poseAt(rig, tr, tMs) : rig.samplePose(a.rig, a.clip, a.clipT, a.aim); });
    },
  };
}

export const createFightPlayer: CreateFightPlayer = (log, a, b, rig, opts) => buildPlayer(log, a, b, rig, opts);
