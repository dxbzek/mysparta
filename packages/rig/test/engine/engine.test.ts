/**
 * The engine is not scrapper-shaped (critic line of the WP2 gate): a 6-bone rig that is not a
 * scrapper samples, draws, plants its foot and mirrors with no engine change. Plus the IK and
 * the easing it rests on.
 */
import { describe, expect, it } from "vitest";
import type { ContentPack, Place } from "../../src/contracts";
import { COMPANION_CLIPS } from "../../src/contracts";
import { ease } from "../../src/engine/ease";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { twoBone } from "../../src/engine/ik";
import { frames, modelOf } from "../../src/engine/pose";
import { PROBE_RIG, probePack } from "../../src/engine/probe";
import { gatePack } from "../../src/gate/pack";
import { recorder } from "../gate/helpers";

const rig = createRig(gatePack, probePack as ContentPack);
const ins = inspectOf(rig);
const bird = { held: null, door: false, scale: 1 };
const times = (d: number): number[] => Array.from({ length: Math.round((d * 60) / 1000) + 1 }, (_, i) => (i * 1000) / 60);

describe("a 6-bone rig that is not a scrapper", () => {
  it("is the goose of the probe pack, with 6 bones", () => {
    expect(ins.rigDef("goose")).toBe(PROBE_RIG);
    expect(PROBE_RIG.bones.length).toBe(6);
  });
  it("samples every clip into finite poses with one angle per bone", () => {
    for (const c of COMPANION_CLIPS) for (const t of times(rig.clipInfo("goose", c).durationMs)) {
      const p = rig.samplePose("goose", c, t);
      expect(p.rot.length).toBe(6);
      for (const v of [...p.rot, p.root.x, p.root.y, p.lift]) expect(Number.isFinite(v)).toBe(true);
    }
  });
  it("plants its foot: the foot joint stays put (under 0.5 units) while the body bobs and pecks", () => {
    for (const c of ["idle", "attack", "hit"]) {
      const at: Place = { x: 100, y: 190, facing: 1 };
      const pts = times(rig.clipInfo("goose", c).durationMs).map((t) => ins.joints(rig.samplePose("goose", c, t), bird, at)[5]!);
      const body = times(rig.clipInfo("goose", c).durationMs).map((t) => ins.joints(rig.samplePose("goose", c, t), bird, at)[2]!);
      for (const [x, y] of pts) expect(Math.hypot(x - pts[0]![0], y - pts[0]![1]), c).toBeLessThan(0.5);
      const moved = Math.max(...body.map((b) => Math.hypot(b[0] - body[0]![0], b[1] - body[0]![1])));
      expect(moved, `${c}: the body moves over the planted foot`).toBeGreaterThan(1);
    }
  });
  it("keeps its knee inside its limit while planted", () => {
    const lim = PROBE_RIG.bones[4]!.limit!;
    for (const c of ["idle", "attack"]) for (const t of times(rig.clipInfo("goose", c).durationMs)) {
      const v = rig.samplePose("goose", c, t).rot[4]!;
      expect(v).toBeGreaterThanOrEqual(lim[0] - 1e-6);
      expect(v).toBeLessThanOrEqual(lim[1] + 1e-6);
    }
  });
  it("draws with the Ctx2D subset, balanced, and mirrors: every point of a left-facing bird is the mirror image", () => {
    const r = recorder();
    for (const c of COMPANION_CLIPS) rig.drawActor(r.env, rig.samplePose("goose", c, 100), bird, { x: 50, y: 190, facing: -1 });
    expect(r.depth()).toBe(0);
    expect(r.fills.length).toBeGreaterThan(10);
    const p = rig.samplePose("goose", "attack", 150);
    const right = ins.joints(p, bird, { x: 100, y: 190, facing: 1 });
    const left = ins.joints(p, bird, { x: 100, y: 190, facing: -1 });
    right.forEach((q, i) => { expect(left[i]![0] - 100).toBeCloseTo(100 - q[0], 6); expect(left[i]![1]).toBeCloseTo(q[1], 6); });
    const sr = rig.strikePoint("goose", "attack", bird);
    expect(sr.x).toBeGreaterThan(5);            // the beak is in front at the contact
  });
});

describe("IK and easing", () => {
  it("two-bone IK lands the end joint on a reachable target and bends the lower joint inside its limit", () => {
    const m = modelOf(gatePack.scrapper);
    const rot = m.def.bones.map(() => 0);
    for (const [tx, ty] of [[10, -50], [25, -60], [-8, -60], [20, -55]] as const) {
      const out = twoBone(m, rot, 0, 0, 7, 8, 9, tx, ty);
      const f = frames(m, out.rot, 0, 0)[9]!;
      expect(out.reached).toBe(true);
      expect(Math.hypot(f.e - tx, f.f - ty)).toBeLessThan(1e-6);
      expect(out.rot[8]!).toBeLessThanOrEqual(2 + 1e-6);    // an elbow bends one way
    }
  });
  it("every ease runs from 0 to 1", () => {
    for (const k of ["linear", "in", "out", "inOut", "back", "snap"] as const) {
      expect(ease(0, k)).toBeCloseTo(0, 9);
      expect(ease(1, k)).toBeCloseTo(1, 9);
    }
  });
});
