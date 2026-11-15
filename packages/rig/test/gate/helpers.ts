/** Shared test helpers for the rig lane: a recording Ctx2D, the gate rig, sampling. */
import type { HeldId, Look } from "@rankzero/core";
import type { Ctx2D, DrawEnv, Dress, Place, Pose, Rig, RigId } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import type { RigInspect } from "../../src/engine/createRig";
import { gatePack } from "../../src/gate/pack";

export const rig: Rig = createRig(gatePack);
export const ins: RigInspect = inspectOf(rig);
export const HOME: Place = { x: 0, y: 0, facing: 1 };
export const LOOKS: Look[] = [
  { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 },
  { build: 1, head: 1, hair: 1, face: 1, top: 1, bottom: 1, shoes: 1, accessory: 1, skin: 1, hairColor: 1, palette: 1 },
  { build: 2, head: 0, hair: 1, face: 0, top: 1, bottom: 0, shoes: 1, accessory: 0, skin: 2, hairColor: 2, palette: 2 },
];
export const ATTACKS: readonly [string, HeldId][] = [["punch", "fists"], ["flick", "pocket-knife"], ["swing", "pipe"]];
export function dress(held: HeldId | null, look = 0, scale = 1, extra: Partial<Dress> = {}): Dress {
  return { look: LOOKS[look]!, held, shield: null, scale, ...extra };
}
/** 60 fps sample times over a clip, both ends included. */
export function times(r: Rig, rigId: RigId, clip: string): number[] {
  const d = r.clipInfo(rigId, clip).durationMs;
  const n = Math.max(1, Math.round((d * 60) / 1000));
  return Array.from({ length: n + 1 }, (_, i) => (i * d) / n);
}
export function poses(r: Rig, rigId: RigId, clip: string): Pose[] {
  return times(r, rigId, clip).map((t) => r.samplePose(rigId, clip, t));
}
export function boneIndex(r: Rig, rigId: RigId, id: string): number {
  return inspectOf(r).rigDef(rigId).bones.findIndex((b) => b.id === id);
}

/** A Ctx2D that records what is drawn and checks the save stack. */
export interface Recorder { env: DrawEnv; fills: string[]; strokes: string[]; paths: string[]; depth(): number; calls: Set<string> }
export function recorder(): Recorder {
  const fills: string[] = [];
  const strokes: string[] = [];
  const paths: string[] = [];
  const calls = new Set<string>();
  let depth = 0;
  let fill = "#000000";
  let stroke = "#000000";
  const stack: [string, string][] = [];
  const note = (n: string) => (..._a: unknown[]): void => { calls.add(n); };
  const ctx: Ctx2D = {
    save() { calls.add("save"); depth++; stack.push([fill, stroke]); },
    restore() { calls.add("restore"); depth--; const s = stack.pop(); if (s) { fill = s[0]; stroke = s[1]; } },
    translate: note("translate"), rotate: note("rotate"), scale: note("scale"), transform: note("transform"), setTransform: note("setTransform"),
    beginPath: note("beginPath"), closePath: note("closePath"), moveTo: note("moveTo"), lineTo: note("lineTo"),
    quadraticCurveTo: note("quadraticCurveTo"), bezierCurveTo: note("bezierCurveTo"), arc: note("arc"), ellipse: note("ellipse"), rect: note("rect"),
    fill(p?: unknown) { calls.add("fill"); fills.push(fill); if (typeof p === "string") paths.push(p); },
    stroke() { calls.add("stroke"); strokes.push(stroke); },
    clip: note("clip"),
    fillRect() { calls.add("fillRect"); fills.push(fill); },
    strokeRect() { calls.add("strokeRect"); strokes.push(stroke); },
    clearRect: note("clearRect"), fillText: note("fillText"), strokeText: note("strokeText"),
    measureText: () => ({ width: 10 }), setLineDash: note("setLineDash"),
    get fillStyle() { return fill; }, set fillStyle(c: string) { fill = c; },
    get strokeStyle() { return stroke; }, set strokeStyle(c: string) { stroke = c; },
    lineWidth: 1, lineCap: "round", lineJoin: "round", miterLimit: 10, lineDashOffset: 0, globalAlpha: 1, font: "", textAlign: "left", textBaseline: "alphabetic",
  };
  // paths are their own d strings, so a test can read what was filled
  const env: DrawEnv = { ctx, path: (d: string) => d };
  return { env, fills, strokes, paths, depth: () => depth, calls };
}
