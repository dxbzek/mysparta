/**
 * Movement pass (owner, 16 Nov 2026: "make sure characters have animation for walks, run, dodge
 * etc, block properly"; poses and timing from Muybridge's "Animal Locomotion", 1887). Measured on
 * the poses the rig gives the stage, every 60 fps frame:
 *  - a foot on the floor in the run and the backward walk is carried back at exactly the speed
 *    the stage moves the fighter (tuning.ts), so it does not slide (0.5 units);
 *  - the run has a flight (both feet off the floor) and swings each arm against its leg;
 *  - at the moment a blow lands, a block has a forearm across the line to the head, and an
 *    evade has taken the head off that line.
 * Each line has a planted-fault control.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Pose } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { apply, frames, modelOf, worldAngles } from "../../src/engine/pose";
import { inContact, strideOf } from "../../src/engine/sample";
import type { Stride } from "../../src/engine/sample";
import { contentPack } from "../../src/content/pack";
import { BACK_SPEED } from "../../src/gate/clips/backpedal";
import { RUN_SPEED } from "../../src/gate/clips/dash";
import { EVADE_CONTACT, EVADE_DOWN, EVADE_UP } from "../../src/gate/clips/evade";
import { BRAKE_LAND, BRAKE_PAW, BRAKE_STOP, BRAKE_TRAVEL, PUSH_MS, RUN_JOIN, SLIP_CONTACT, SLIP_MS } from "../../src/content/clips/footwork";
import { STANCE, jointsOf } from "../../src/gate/clips/kit";
import { gatePack } from "../../src/gate/pack";
import { BONE, SCRAPPER_RIG } from "../../src/gate/skeleton";

const S = "scrapper" as const;
const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const model = modelOf(SCRAPPER_RIG);
const frameTimes = (d: number): number[] => Array.from({ length: Math.round((d * 60) / 1000) + 1 }, (_, i) => (i * 1000) / 60);

/** The stage's speeds, read from its tuning file (the rig may not import the stage). */
const tuning = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../stage/src/tuning.ts"), "utf8");
const num = (name: string): number => Number(new RegExp(`${name}:\\s*([0-9.]+)`).exec(tuning)![1]);

/** The worst slide of a foot on the floor: the stage x of the point it stands on (figure x plus
 *  the travel at `speed` units per ms) against where it touched down, over each contact. */
function worstSlide(clip: string, stride: Stride, speed: number): number {
  const d = rig.clipInfo(S, clip).durationMs;
  let worst = 0;
  for (const k of stride.contacts) {
    const fi = model.index.get(k.foot)!;
    let x0: number | undefined;
    for (const t of frameTimes(d * 2)) {
      const tc = t % d;
      if (!inContact(k, tc)) { x0 = undefined; continue; }
      const p = rig.samplePose(S, clip, t);
      const [x, y] = apply(frames(model, p.rot, p.root.x, p.root.y)[fi]!, k.at[0], k.at[1]);
      expect(Math.abs(y), `${clip} ${k.foot} on the floor at ${t.toFixed(0)}`).toBeLessThan(0.5);
      const sx = x + speed * t;
      if (x0 === undefined) x0 = sx;
      worst = Math.max(worst, Math.abs(sx - x0));
    }
  }
  return worst;
}

describe("movement: feet on the floor travel with the body", () => {
  it("the run and the backward walk move at the stage's speeds (tuning.ts dashSpeed, dashBackSpeed)", () => {
    expect(RUN_SPEED * 1000).toBe(num("dashSpeed"));
    expect(BACK_SPEED * 1000).toBe(num("dashBackSpeed"));
  });
  it("a foot on the floor in the run is carried back at the run speed: no slide over 0.5 units", () => {
    const s = strideOf(ins.clip(S, "dash"))!;
    expect(s.speed).toBe(RUN_SPEED);
    expect(worstSlide("dash", s, RUN_SPEED)).toBeLessThan(0.5);
  });
  it("a foot on the floor in the backward walk is carried forward at the back speed: no slide", () => {
    const s = strideOf(ins.clip(S, "backpedal"))!;
    expect(worstSlide("backpedal", s, -BACK_SPEED)).toBeLessThan(0.5);
  });
  it("planted fault: the run measured against another speed slides", () => {
    const s = strideOf(ins.clip(S, "dash"))!;
    expect(worstSlide("dash", s, RUN_SPEED * 0.8)).toBeGreaterThan(0.5);
  });
});

describe("movement: the run", () => {
  const d = rig.clipInfo(S, "dash").durationMs;
  const ps = frameTimes(d).map((t) => rig.samplePose(S, "dash", t));
  /** Pearson correlation. */
  function corr(a: number[], b: number[]): number {
    const ma = a.reduce((x, y) => x + y, 0) / a.length;
    const mb = b.reduce((x, y) => x + y, 0) / b.length;
    let sab = 0, saa = 0, sbb = 0;
    a.forEach((v, i) => { sab += (v - ma) * (b[i]! - mb); saa += (v - ma) ** 2; sbb += (b[i]! - mb) ** 2; });
    return sab / Math.sqrt(saa * sbb);
  }
  /** World angle of the thigh and of the upper arm of a side, every frame. */
  const swingOf = (poses: Pose[], leg: number, arm: number): [number[], number[]] => {
    const w = poses.map((p) => worldAngles(model, p.rot));
    return [w.map((x) => x[leg]!), w.map((x) => x[arm]!)];
  };
  it("has a flight: frames with both feet off the floor, in each step", () => {
    const air = ps.map((p, i) => [i, p.lift] as const).filter(([, l]) => l > 1);
    expect(air.some(([i]) => i < ps.length / 2)).toBe(true);
    expect(air.some(([i]) => i >= ps.length / 2)).toBe(true);
  });
  it("swings each arm against its own leg, the elbows bent", () => {
    for (const [leg, arm, lo] of [[BONE.legFup, BONE.armFup, BONE.armFlo], [BONE.legBup, BONE.armBup, BONE.armBlo]] as const) {
      const [l, a] = swingOf(ps, leg, arm);
      expect(corr(l, a), `side ${arm}`).toBeLessThan(-0.7);
      for (const p of ps) expect(p.rot[lo]!).toBeLessThan(-60);
    }
    // the free arm swings further than the weapon arm
    const range = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
    expect(range(swingOf(ps, BONE.legBup, BONE.armBup)[1])).toBeGreaterThan(range(swingOf(ps, BONE.legFup, BONE.armFup)[1]) + 15);
  });
  it("planted fault: arms swinging with the legs are caught", () => {
    const [l, a] = swingOf(ps, BONE.legFup, BONE.armFup);
    expect(corr(l, a.map((v) => -v))).toBeGreaterThan(0.7);
  });
});

describe("movement: the head off the line at the blow", () => {
  const stanceHead = jointsOf(STANCE)[BONE.head]!;
  /** The head's centre (a little above the neck joint, along the head bone). */
  const headOf = (p: Pose): [number, number] => apply(frames(model, p.rot, p.root.x, p.root.y)[BONE.head]!, 0, -8);
  /** Does the front forearm cross the level line through the head centre, in front of it? */
  function covers(p: Pose): boolean {
    const fr = frames(model, p.rot, p.root.x, p.root.y);
    const [hx, hy] = headOf(p);
    const [ex, ey] = [fr[BONE.armFlo]!.e, fr[BONE.armFlo]!.f];
    const [wx, wy] = apply(fr[BONE.handF]!, 0, 3);           // the fist
    if ((ey - hy) * (wy - hy) > 0) return false;             // both ends above, or both below
    const u = (hy - ey) / (wy - ey);
    return ex + (wx - ex) * u > hx + 2;
  }
  /** Does a shield on the back wrist stand square in front of the head? It is upright when the
   *  back forearm is at about -124 degrees (content/shields.ts, the grip turn) and its face runs
   *  from about 12 units above the wrist to 6 below. */
  function shieldCovers(p: Pose): boolean {
    const fr = frames(model, p.rot, p.root.x, p.root.y);
    const wa = worldAngles(model, p.rot);
    const [hx, hy] = headOf(p);
    const [wx, wy] = [fr[BONE.handB]!.e, fr[BONE.handB]!.f];
    return Math.abs(wa[BONE.armBlo]! + 124) <= 20 && wy - 12 <= hy && wy + 6 >= hy && wx > hx + 2;
  }
  it("a block has the front forearm across the line to the head as the blow lands, a shield block the shield", () => {
    expect(covers(rig.samplePose(S, "brace", 120)), "brace").toBe(true);
    expect(covers(rig.samplePose(S, "block", 0)), "block").toBe(true);
    expect(covers(rig.samplePose(S, "block", 40)), "block recoil").toBe(true);
    expect(shieldCovers(rig.samplePose(S, "block-shield", 0)), "block-shield").toBe(true);
    expect(shieldCovers(rig.samplePose(S, "block-shield", 40)), "block-shield recoil").toBe(true);
  });
  it("planted fault: the plain stance does not cover the head", () => {
    expect(covers(rig.samplePose(S, "punch", 0))).toBe(false);
    expect(shieldCovers(rig.samplePose(S, "punch", 0))).toBe(false);
  });
  it("an evade has the head 6 units or more back from where it stood, as the swing passes", () => {
    const p = rig.samplePose(S, "evade", EVADE_CONTACT);
    const h = headOf(p);
    const h0 = apply(frames(model, rig.samplePose(S, "punch", 0).rot, STANCE.root![0], STANCE.root![1])[BONE.head]!, 0, -8);
    expect(h0[0] - h[0]).toBeGreaterThanOrEqual(6);
    expect(stanceHead[0]).toBeGreaterThan(h[0]);
  });
  it("planted fault: the stance's head is on the line", () => {
    const p = rig.samplePose(S, "punch", 0);
    const h0 = apply(frames(model, rig.samplePose(S, "punch", 0).rot, STANCE.root![0], STANCE.root![1])[BONE.head]!, 0, -8);
    expect(h0[0] - headOf(p)[0]).toBeLessThan(6);
  });
});

/**
 * Movement pass 2: the footwork clips the stage carries a fighter with (content/clips/footwork.ts,
 * stage/src/footwork.ts). Their timing is the stage's (tuning.ts `FOOTWORK.fallback`, `OUTCOME`);
 * measured on the poses, a foot on the floor holds its spot against the stage's own motion: the
 * push-off speeding up from rest at an even rate, the brake slowing to rest at an even rate, the
 * evade's hop carried only while both feet are off the floor. The slip takes the head down out
 * of the line with both toes planted.
 */
describe("movement pass 2: the footwork clips", () => {
  const word = (name: string): number => Number(new RegExp(`\\b${name}:\\s*([0-9.]+)`).exec(tuning)![1]);
  /** How far the stage has carried the body by clip time `t` of a clip (units, at scale 1). */
  const pushed = (t: number): number => (RUN_SPEED / 2) * t * t / PUSH_MS;
  const braked = (t: number): number => {
    const u = Math.min(1, Math.max(0, (t - BRAKE_LAND) / (BRAKE_STOP - BRAKE_LAND)));
    return BRAKE_TRAVEL * (1 - (1 - u) * (1 - u));
  };
  /** The worst slide of the toes in contact over a clip, against the stage's travel `carry(t)`. */
  function slideAgainst(clip: string, carry: (t: number) => number): number {
    const c = ins.clip(S, clip);
    const st = strideOf(c)!;
    const d = c.duration;
    let worst = 0;
    for (const k of st.contacts) {
      const fi = model.index.get(k.foot)!;
      let x0: number | undefined;
      for (let t = k.from; t < Math.min(k.to, d); t += 2) {
        const p = rig.samplePose(S, clip, t);
        const [x, y] = apply(frames(model, p.rot, p.root.x, p.root.y)[fi]!, k.at[0], k.at[1]);
        expect(Math.abs(y), `${clip} ${k.foot} on the floor at ${t}`).toBeLessThan(0.5);
        const sx = x + carry(t);
        if (x0 === undefined) x0 = sx;
        worst = Math.max(worst, Math.abs(sx - x0));
      }
    }
    return worst;
  }

  it("the clips keep the stage's timing (tuning.ts FOOTWORK.fallback, OUTCOME.evadeUp, evadeDown)", () => {
    expect(rig.clipInfo(S, "dash-push").durationMs).toBe(word("push"));
    expect(PUSH_MS).toBe(word("push"));
    expect(RUN_JOIN).toBe(word("join"));
    expect(rig.clipInfo(S, "dash").durationMs).toBe(word("cycle"));
    const brake = rig.clipInfo(S, "brake");
    expect(brake.durationMs).toBe(word("brake"));
    expect(brake.events).toEqual([{ t: word("land"), name: "land" }, { t: word("stop"), name: "step" }]);
    expect(BRAKE_PAW).toBe(word("paw"));
    const hop = rig.clipInfo(S, "shuffle");
    expect(hop.durationMs).toBe(word("hop"));
    expect(hop.events).toEqual([{ t: word("up"), name: "step" }, { t: word("down"), name: "land" }]);
    expect(EVADE_UP).toBe(word("evadeUp"));
    expect(EVADE_DOWN.B).toBe(word("evadeDown"));
    expect(rig.clipInfo(S, "slip").durationMs).toBe(SLIP_MS);
    expect(SLIP_CONTACT).toBe(EVADE_CONTACT);
  });
  it("the push-off's back toe drives against the body speeding up from rest: no slide", () => {
    expect(slideAgainst("dash-push", pushed)).toBeLessThan(0.5);
  });
  it("the brake's feet hold against the body slowing to rest: no slide", () => {
    expect(slideAgainst("brake", braked)).toBeLessThan(0.5);
  });
  it("planted fault: the brake against a body that does not slow (the run speed on) slides", () => {
    expect(slideAgainst("brake", (t) => RUN_SPEED * Math.max(0, t - BRAKE_LAND))).toBeGreaterThan(0.5);
  });
  it("the shuffle, the slip and the evade hold their toes while the stage does not move them", () => {
    expect(slideAgainst("shuffle", () => 0)).toBeLessThan(0.5);
    expect(slideAgainst("slip", () => 0)).toBeLessThan(0.5);
    expect(slideAgainst("evade", () => 0)).toBeLessThan(0.5);
  });
  it("the push-off starts on the brace's end and ends on the dash loop; the brake starts on the dash loop", () => {
    // the legs and the trunk (the head and the free arm trail by their lag, which a one-shot clip lets go of at its end)
    const LEGS = [BONE.pelvis, BONE.torso, BONE.legBup, BONE.legBlo, BONE.footB, BONE.legFup, BONE.legFlo, BONE.footF];
    const same = (a: Pose, b: Pose): number => Math.max(...LEGS.map((i) => Math.abs(a.rot[i]! - b.rot[i]!)), Math.abs(a.root.y - b.root.y));
    expect(same(rig.samplePose(S, "dash-push", PUSH_MS), rig.samplePose(S, "dash", RUN_JOIN))).toBeLessThan(1);
    expect(same(rig.samplePose(S, "brake", 0), rig.samplePose(S, "dash", RUN_JOIN))).toBeLessThan(1);
  });
  it("a slip has the head 9 units or more below where it stood as the blow passes, no jump", () => {
    const h0 = apply(frames(model, rig.samplePose(S, "slip", 0).rot, 0, rig.samplePose(S, "slip", 0).root.y)[BONE.head]!, 0, -8);
    const p = rig.samplePose(S, "slip", SLIP_CONTACT);
    const h = apply(frames(model, p.rot, p.root.x, p.root.y)[BONE.head]!, 0, -8);
    expect(h[1] - h0[1]).toBeGreaterThanOrEqual(9);
    expect(p.lift).toBe(0);
  });
});
