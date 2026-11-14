/**
 * One scrapper (with its companions, if any) playing one named clip on the Yard floor, outside a
 * bout: the create preview, the Locker hero, the face-off sheet, the level-up screen. One drawing
 * function (`drawActorStage`, pure for a given `t`) and one frame loop for every screen, so no
 * screen writes a second one.
 *
 * The view is a window onto the 360 x 240 stage, cropped to fill the canvas (cover), centred
 * on the scrapper. A clip that does not loop plays, holds idle for `restMs`, and plays again.
 */
import { useEffect, useRef } from "react";
import type { CompanionId, HeldId, Look, StageId } from "@rankzero/core";
import type { DrawEnv, Place, Rig } from "@rankzero/rig";
import { makeDrawEnv } from "../seams/canvas";
import { rig as seamRig } from "../seams/rig";

export interface ActorScene {
  look: Look;
  held?: HeldId | null;
  door?: boolean;
  clip?: string;
  companions?: readonly CompanionId[];
  /** 1 faces right (the default), -1 faces left (the rival in a face-off). */
  facing?: 1 | -1;
  stage?: StageId;
  /** Rest between plays of a clip that does not loop, in ms. */
  restMs?: number;
  /** The window onto the stage in stage units; default 200 x 150 around the scrapper. */
  window?: { w: number; h: number };
  /** Where the floor line sits, as a share of the canvas height from the top. Default 0.8. */
  floorAt?: number;
}

const MARK_X = 180;
const FLOOR_Y = 195;
/** Companion marks relative to the owner (brief 3.12, left side: owner at x 70). */
const COMPANION_OFFSETS: readonly { dx: number; dy: number }[] = [
  { dx: -30, dy: -15 },   // first Raccoon, behind
  { dx: -24, dy: 21 },    // second Raccoon, in front
  { dx: 54, dy: 11 },     // Goose or Boar, ahead
];

export function companionPlaces(companions: readonly CompanionId[], facing: 1 | -1): { id: CompanionId; at: Place }[] {
  let raccoons = 0;
  return companions.map((id) => {
    const slot = id === "raccoon" ? Math.min(raccoons++, 1) : 2;
    const o = COMPANION_OFFSETS[slot]!;
    return { id, at: { x: MARK_X + facing * o.dx, y: FLOOR_Y + o.dy, facing } };
  });
}

/** The time inside the clip to sample for scene time `t`. Pure. */
export function clipTimeAt(rig: Rig, clip: string, t: number, restMs: number): { clip: string; t: number } {
  const info = rig.clipInfo("scrapper", clip);
  if (info.loop || clip === "idle") return { clip, t };
  const cycle = info.durationMs + restMs;
  const u = ((t % cycle) + cycle) % cycle;
  return u < info.durationMs ? { clip, t: u } : { clip: "idle", t: u - info.durationMs };
}

/** Draws the scene at scene time `t` into a view of `w x h` CSS px at `dpr`. Pure for a given t. */
export function drawActorStage(env: DrawEnv, rig: Rig, scene: ActorScene, t: number, view: { w: number; h: number; dpr: number }): void {
  const c = env.ctx;
  const facing = scene.facing ?? 1;
  const win = scene.window ?? { w: 200, h: 150 };
  const dpr = view.dpr > 0 ? view.dpr : 1;
  const k = Math.max(view.w / win.w, view.h / win.h) * dpr;
  const cx = MARK_X;
  const visibleH = (view.h * dpr) / k;
  const cy = FLOOR_Y - ((scene.floorAt ?? 0.8) - 0.5) * visibleH;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, view.w * dpr, view.h * dpr);
  c.setTransform(k, 0, 0, k, (view.w * dpr) / 2 - cx * k, (view.h * dpr) / 2 - cy * k);
  const stage = scene.stage ?? "yard";
  rig.drawStage(env, stage, "back", 0);
  rig.drawStage(env, stage, "floor", 0);
  const pets = companionPlaces(scene.companions ?? [], facing);
  const { clip, t: ct } = clipTimeAt(rig, scene.clip ?? "idle", t, scene.restMs ?? 900);
  const scrapper = {
    y: FLOOR_Y,
    draw: () => rig.drawActor(env, rig.samplePose("scrapper", clip, ct), { look: scene.look, held: scene.held ?? null, door: scene.door ?? false, scale: 1 }, { x: MARK_X, y: FLOOR_Y, facing }),
  };
  const others = pets.map((p, i) => ({
    y: p.at.y,
    draw: () => rig.drawActor(env, rig.samplePose(p.id, "idle", t + 300 * (i + 1)), { held: null, door: false, scale: 1 }, p.at),
  }));
  // draw order by floor y, as on the fight stage
  for (const a of [scrapper, ...others].sort((p, q) => p.y - q.y)) a.draw();
}

export interface ActorStageProps extends ActorScene {
  /** Fixed scene time (screenshots, tests). Without it the stage runs its own frame loop. */
  t?: number;
  height: number;
  label: string;
  className?: string;
  rig?: Rig;
}

export function ActorStage({ t, height, label, className, rig = seamRig, ...scene }: ActorStageProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const env = makeDrawEnv(context);
    let frame = 0;
    const started = performance.now();
    const paint = (time: number): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      try {
        drawActorStage(env, rig, sceneRef.current, time, { w, h, dpr });
      } catch (error) {
        console.warn("ActorStage: draw failed", error);
      }
    };
    if (t !== undefined) {
      paint(t);
      return undefined;
    }
    const loop = (now: number): void => {
      paint(now - started);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [t, rig]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} style={{ display: "block", width: "100%", height }} />;
}
