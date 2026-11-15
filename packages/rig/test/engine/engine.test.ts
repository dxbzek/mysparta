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
import { PLANT_REACH } from "../../src/engine/sample";
import { PROBE_RIG, probePack } from "../../src/engine/probe";
import { gatePack } from "../../src/gate/pack";
import { recorder } from "../gate/helpers";

const rig = createRig(gatePack, probePack as ContentPack);
const ins = inspectOf(rig);
const bird = { held: null, shield: null, scale: 1 };
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
  it("keeps one bend side and a continuous solution when the target sweeps all round the shoulder", () => {
    // the classic arm twist: a solver that picks the branch nearer some angle jumps from elbow-down
    // to elbow-up as the target moves. Sweep a wrist target in a full circle at 3 distances.
    const m = modelOf(gatePack.scrapper);
    const rot = m.def.bones.map(() => 0);
    const sh = frames(m, rot, 0, 0)[7]!;
    const sweep = (bend?: -1 | 1): { flips: number; jump: number } => {
      let flips = 0;
      let jump = 0;
      for (const r of [8, 16, 24]) {
        let prev: number[] | null = null;
        for (let a = 0; a <= 720; a += 2) {
          const tx = sh.e + r * Math.cos((a * Math.PI) / 180);
          const ty = sh.f + r * Math.sin((a * Math.PI) / 180);
          const out = twoBone(m, prev ?? rot, 0, 0, 7, 8, 9, tx, ty, bend === undefined ? {} : { bend });
          if (prev !== null) {
            if (Math.sign(out.rot[8]!) !== Math.sign(prev[8]!) && Math.abs(out.rot[8]!) > 3) flips++;
            jump = Math.max(jump, Math.abs(out.rot[7]! - prev[7]!), Math.abs(out.rot[8]! - prev[8]!));
          }
          prev = out.rot;
        }
      }
      return { flips, jump };
    };
    const ok = sweep();
    expect(ok.flips).toBe(0);
    expect(ok.jump).toBeLessThan(20);                 // 2 degrees of target turn never jumps the arm
    for (let a = 0; a < 360; a += 15) {
      const out = twoBone(m, rot, 0, 0, 7, 8, 9, sh.e + 16 * Math.cos(a), sh.f + 16 * Math.sin(a));
      expect(out.rot[8]!).toBeLessThan(0);             // an elbow always bends the elbow's way
      const knee = twoBone(m, rot, 0, 0, 13, 14, 15, 8 + Math.cos(a) * 6, -4 + Math.sin(a) * 6);
      expect(knee.rot[14]!).toBeGreaterThan(0);        // a knee always the knee's way
    }
    // planted fault: forcing the other side makes the elbow bend backwards, and the check sees it
    expect(twoBone(m, rot, 0, 0, 7, 8, 9, sh.e + 10, sh.f + 10, { bend: 1 }).rot[8]!).toBeGreaterThan(0);
  });
  it("never pulls a limb past maxReach, and reports the reach it was asked for", () => {
    const m = modelOf(gatePack.scrapper);
    const rot = m.def.bones.map(() => 0);
    const sh = frames(m, rot, 0, 0)[7]!;
    const L = Math.hypot(m.def.bones[8]!.x, m.def.bones[8]!.y) + Math.hypot(m.def.bones[9]!.x, m.def.bones[9]!.y);
    const out = twoBone(m, rot, 0, 0, 7, 8, 9, sh.e + L * 1.2, sh.f, { maxReach: 0.95 });
    const f = frames(m, out.rot, 0, 0)[9]!;
    expect(Math.hypot(f.e - sh.e, f.f - sh.f) / L).toBeCloseTo(0.95, 6);
    expect(out.reached).toBe(false);
    expect(out.reach).toBeCloseTo(1.2, 6);
    // planted fault: without the cap the same target pulls the arm dead straight
    const free = twoBone(m, rot, 0, 0, 7, 8, 9, sh.e + L * 1.2, sh.f);
    expect(Math.abs(free.rot[8]!)).toBeLessThan(1);
  });
  it("sinks the hips instead of pulling a planted leg straight", () => {
    // a lunge whose hips go further forward than the back leg reaches
    const c = { duration: 100, loop: false, events: [], plant: ["footB", "footF"],
      keys: [{ t: 0, rot: { "legB.up": 10, "legB.lo": 20, "legF.up": -10, "legF.lo": 20 }, root: [0, 2] as [number, number] },
        { t: 100, rot: { "legB.up": 10, "legB.lo": 20, "legF.up": -10, "legF.lo": 20 }, root: [16, 2] as [number, number] }] };
    const r2 = createRig(gatePack, { clips: { punch: c } } as unknown as ContentPack);
    const p = r2.samplePose("scrapper", "punch", 100);
    const fr = frames(modelOf(gatePack.scrapper), p.rot, p.root.x, p.root.y);
    const B = gatePack.scrapper.bones;
    const legL = Math.hypot(B[11]!.x, B[11]!.y) + Math.hypot(B[12]!.x, B[12]!.y);
    const reach = Math.hypot(fr[12]!.e - fr[10]!.e, fr[12]!.f - fr[10]!.f) / legL;
    expect(reach).toBeLessThanOrEqual(PLANT_REACH + 1e-6);
    expect(p.root.y).toBeGreaterThan(2);               // the hips went down to keep the knee bent
  });
  it("every ease runs from 0 to 1", () => {
    for (const k of ["linear", "in", "out", "inOut", "back", "snap"] as const) {
      expect(ease(0, k)).toBeCloseTo(0, 9);
      expect(ease(1, k)).toBeCloseTo(1, 9);
    }
  });
});
