/**
 * Anatomy lines (owner, 15 Nov 2026, after the first real-engine bout: "animations aren't
 * realistic, arms are twisting etc"). Every 60 fps frame of every gate clip and of the throw,
 * plain and aimed at every target height the stage can ask for, keeps a real body's range
 * (`ANATOMY` in skeleton.ts): elbows and knees bend one way and never flip, no limb is pulled
 * straight by IK, wrists and shoulders stay in range, forearms and hands turn at a real arm's
 * rate, nothing goes through the body or the head, the near arm is drawn over the body and the
 * far arm under it, and every clip the stage can switch between starts and ends in the guard.
 *
 * Each line has a planted-fault control: the same measure on a pose broken on purpose must fail.
 */
import { describe, expect, it } from "vitest";
import { COMPANION_IDS } from "@rankzero/core";
import { GATE_CLIPS } from "../../src/contracts";
import type { Pose, Shape } from "../../src/contracts";
import { THROW } from "../../src/gate/clips/throw";
import { STANCE, solve } from "../../src/gate/clips/kit";
import { gatePack } from "../../src/gate/pack";
import { ANATOMY, BONE } from "../../src/gate/skeleton";
import { PIPE } from "../../src/gate/weapons/pipe";
import { POCKET_KNIFE } from "../../src/gate/weapons/pocket-knife";
import type { Frame } from "./anatomy";
import { measure, report, turn } from "./anatomy";
import { ATTACKS, dress, rig as gateRig } from "./helpers";
import { createRig } from "../../src/engine/createRig";
import type { ContentPack } from "../../src/contracts";

const S = "scrapper" as const;
const rig = createRig(gatePack, { clips: { throw: THROW } } as unknown as ContentPack);
const ITEM: Record<string, [number, number]> = {
  punch: [0, 0],
  flick: [Math.hypot(POCKET_KNIFE.tip.x, POCKET_KNIFE.tip.y), POCKET_KNIFE.grip.rot],
};
const itemOf = (clip: string): [number, number] => ITEM[clip] ?? [Math.hypot(PIPE.tip.x, PIPE.tip.y), PIPE.grip.rot];

/** 60 fps sample times, both ends. */
function times(clip: string): number[] {
  const d = rig.clipInfo(S, clip).durationMs;
  const n = Math.max(1, Math.round((d * 60) / 1000));
  return Array.from({ length: n + 1 }, (_, i) => (i * d) / n);
}
/** Every target height the stage can aim a swing at (as the aim test of rig.test.ts). */
const TARGETS: number[] = [];
for (const li of [0, 1, 2]) for (const scale of [1, 1.15]) for (const z of ["head", "body"] as const) TARGETS.push(gateRig.hitPoint(S, dress(null, li, scale), z).y);
for (const id of COMPANION_IDS) for (const scale of [1, 1.15]) TARGETS.push(gateRig.hitPoint(id, dress(null, 0, scale), "body").y);

interface Run { name: string; poses: Pose[]; frames: Frame[]; hop: boolean[] }
function runOf(clip: string, aimY?: number, held: "fists" | "pipe" | "pocket-knife" = "pipe"): Run {
  const [len, rot] = itemOf(clip);
  const d = dress(clip === "punch" ? "fists" : clip === "flick" ? "pocket-knife" : held);
  const poses = times(clip).map((t) => (aimY === undefined ? rig.samplePose(S, clip, t) : rig.samplePose(S, clip, t, { y: aimY, dress: d })));
  // an aim at a target above reach hops the body up: the legs push straight on purpose there
  const hop = poses.map((p, i) => p.lift > 0.01 || (aimY !== undefined && p.root.y < rig.samplePose(S, clip, times(clip)[i]!).root.y - 0.01));
  return { name: aimY === undefined ? clip : `${clip} aimed at ${aimY.toFixed(1)}`, poses, frames: poses.map((p) => measure(p, len, rot)), hop };
}
const RUNS: Run[] = [...GATE_CLIPS, "throw"].map((c) => runOf(c));
for (const [c] of ATTACKS) for (const y of TARGETS) RUNS.push(runOf(c, y));

describe("anatomy: elbows and knees", () => {
  it("never flip their bend between frames, and never bend the wrong way", () => {
    for (const r of RUNS) {
      const rep = report(r.frames);
      expect(rep.bendFlips, r.name).toBe(0);
      expect(rep.wrongBend, r.name).toBe(0);
    }
  });
  it("planted fault: an elbow that flips side is caught", () => {
    const r = RUNS[0]!;
    const bad = r.frames.map((f, i) => (i === 3 ? { ...f, elbow: { ...f.elbow, F: -f.elbow.F } } : f));
    expect(report(bad).bendFlips).toBeGreaterThan(0);
  });
});

describe("anatomy: reach (no limb pulled straight by IK)", () => {
  it(`keeps every arm within ${ANATOMY.reach * 100}% of its length and every leg within ${ANATOMY.legReach * 100}%`, () => {
    for (const r of RUNS) r.frames.forEach((f, i) => {
      for (const s of ["F", "B"] as const) {
        expect(f.armReach[s], `${r.name} frame ${i} arm ${s}`).toBeLessThanOrEqual(ANATOMY.reach + 1e-3);
        if (!r.hop[i]) expect(f.legReach[s], `${r.name} frame ${i} leg ${s}`).toBeLessThanOrEqual(ANATOMY.legReach + 1e-3);
      }
    });
  });
  it("planted fault: a straight arm is caught", () => {
    const p = { ...RUNS[0]!.poses[0]!, rot: [...RUNS[0]!.poses[0]!.rot] };
    p.rot[BONE.armFlo] = 0;
    expect(report([measure(p)]).armOverReach).toBe(1);
  });
});

describe("anatomy: wrists and shoulders", () => {
  it(`keeps every wrist in ${ANATOMY.wrist[0]}..${ANATOMY.wrist[1]} and every shoulder in ${ANATOMY.shoulder[0]}..${ANATOMY.shoulder[1]}`, () => {
    for (const r of RUNS) {
      const rep = report(r.frames);
      expect(rep.wristOut, `${r.name} worst wrist ${rep.wristWorst}`).toBe(0);
      expect(rep.shoulderOut, `${r.name} worst shoulder ${rep.shoulderWorst}`).toBe(0);
    }
  });
  it("planted fault: a broken wrist and an arm behind the back are caught", () => {
    const p = { ...RUNS[0]!.poses[0]!, rot: [...RUNS[0]!.poses[0]!.rot] };
    p.rot[BONE.handF] = 95;
    p.rot[BONE.armBup] = 120;
    const rep = report([measure(p)]);
    expect(rep.wristOut).toBe(1);
    expect(rep.shoulderOut).toBe(1);
  });
});

describe("anatomy: turn rate", () => {
  it(`no forearm or hand turns more than ${ANATOMY.turnPerFrame} degrees in one 60 fps frame`, () => {
    for (const r of RUNS) {
      // an aim at the far ends of the height range (a raccoon on the floor, the tallest head) adds
      // the aim's own bend on top of the clip: at most ANATOMY.aimTurn more
      const limit = ANATOMY.turnPerFrame + (r.name.includes("aimed") ? ANATOMY.aimTurn : 0);
      const rep = report(r.frames);
      expect(rep.foreTurnMax, r.name).toBeLessThanOrEqual(limit);
      expect(rep.handTurnMax, r.name).toBeLessThanOrEqual(limit);
    }
  });
  it("planted fault: a forearm that spins is caught", () => {
    const f = RUNS[0]!.frames;
    const spun: Frame = { ...f[1]!, foreW: { ...f[1]!.foreW, B: f[1]!.foreW.B + 40 } };
    expect(report([f[0]!, spun]).fastTurns).toBe(1);
  });
});

describe("anatomy: nothing through the body", () => {
  it("no near forearm inside the back of the trunk, no held item through the head or the middle of the trunk", () => {
    for (const r of RUNS) {
      const rep = report(r.frames);
      expect(rep.throughTrunk, r.name).toBe(0);
      expect(rep.itemThroughHead, r.name).toBe(0);
    }
  });
  it("planted fault: a forearm folded into the chest and a pipe through the face are caught", () => {
    const p = { ...RUNS[0]!.poses[0]!, rot: [...RUNS[0]!.poses[0]!.rot] };
    p.rot[BONE.armFup] = 40;          // the upper arm back...
    p.rot[BONE.armFlo] = -150;         // ...the forearm folded forward into the chest
    expect(measure(p).inTrunk.F).toBeGreaterThan(0);
    const q = { ...RUNS[0]!.poses[0]!, rot: [...RUNS[0]!.poses[0]!.rot] };
    q.rot[BONE.armFup] = -160;         // the arm up by the head...
    q.rot[BONE.armFlo] = -75;
    q.rot[BONE.handF] = -60;           // ...the pipe turned back into the face
    const [len, gr] = itemOf("swing");
    expect(measure(q, len, gr).itemInHead).toBeGreaterThan(0);
  });
});

describe("anatomy: draw order", () => {
  const shapes: Shape[] = [];
  const L = gatePack.looks;
  for (const list of [L.heads, L.tops, L.bottoms, L.shoes]) for (const set of list) shapes.push(...set);
  shapes.push(...L.hands);
  /** Front limbs over the body, back limbs under it, in every look. */
  function orderOk(all: readonly Shape[]): string[] {
    const zs = (pred: (b: string) => boolean): number[] => all.filter((s) => pred(s.bone.replace(/:open$/, ""))).map((s) => s.z);
    const body = zs((b) => b === "torso" || b === "pelvis");
    const front = zs((b) => b === "armF.up" || b === "armF.lo" || b === "handF");
    const back = zs((b) => b === "armB.up" || b === "armB.lo" || b === "handB");
    const bad: string[] = [];
    if (Math.min(...front) <= Math.max(...body)) bad.push("a front arm part is drawn under the body");
    if (Math.max(...back) >= Math.min(...body)) bad.push("a back arm part is drawn over the body");
    return bad;
  }
  it("draws the front arm over the body and the back arm under it, in every look", () => {
    expect(orderOk(shapes)).toEqual([]);
  });
  it("planted fault: a front forearm drawn under the body is caught", () => {
    const broken = shapes.map((s) => (s.bone === "armF.lo" ? { ...s, z: 5 } : s));
    expect(orderOk(broken).length).toBeGreaterThan(0);
  });
});

/**
 * Clip switches. The stage first cut from clip to clip with no blend, so a clip that starts or ends
 * far from the guard made the arms jump in one frame (the first bout: brace to dash turned a
 * forearm 164 degrees between two frames). Every clip starts and ends near the stance, and the
 * loops the stage can leave at any frame (idle, dash, backpedal) stay near it all through.
 * The jump in, the knockout's last frame and the winner's loop are exempt: nothing follows them
 * in a bout.
 */
describe("anatomy: clip switches stay in the guard", () => {
  const SWITCH = 30;   // degrees from the stance, per forearm and hand: at most 60 between two clips
  const stance = (): Frame => measure({ rig: S, rot: solve(STANCE), root: { x: 0, y: 0, sx: 1, sy: 1 }, face: "neutral", lift: 0 });
  function off(f: Frame, g: Frame): number {
    let m = 0;
    for (const s of ["F", "B"] as const) m = Math.max(m, Math.abs(turn(g.foreW[s], f.foreW[s])), Math.abs(turn(g.handW[s], f.handW[s])));
    return m;
  }
  const LOOPS = new Set(["idle", "backpedal"]);
  function entries(): [string, Frame][] {
    const out: [string, Frame][] = [];
    for (const r of RUNS.slice(0, GATE_CLIPS.length + 1)) {
      if (r.name === "win" || r.name === "dash") continue;
      if (LOOPS.has(r.name)) { r.frames.forEach((f, i) => out.push([`${r.name} frame ${i}`, f])); continue; }
      if (r.name !== "enter" && r.name !== "evade") out.push([`${r.name} start`, r.frames[0]!]);
      if (r.name !== "ko-fall" && r.name !== "brace") out.push([`${r.name} end`, r.frames[r.frames.length - 1]!]);
    }
    return out;
  }
  it(`every clip start and end, and every frame of a loop, is within ${SWITCH} degrees of the stance`, () => {
    const g = stance();
    for (const [name, f] of entries()) expect(off(f, g), name).toBeLessThanOrEqual(SWITCH);
  });
  /* Two poses sit further from the guard on purpose (movement pass, 16 Nov 2026): the run pumps
   * its arms (a sprint, not a shuffle) and the brace ends with the forearm raised in front of the
   * face (a block or an evade starts there, so the evade's start sits between the two). The stage now crossfades every cut (stage/src/blend.ts, checked
   * frame to frame on whole bouts by the stage's blend test), so they may; FADE_SWITCH keeps the
   * gap one a crossfade closes in its longest time (BLEND.maxMs 230, about 14 frames): 100 degrees
   * there is at most 11 degrees a frame at the fade's fastest, under half a real arm's 25. */
  const FADE_SWITCH = 100;
  it(`every frame of the run, and the brace's end, is within ${FADE_SWITCH} degrees of the stance`, () => {
    const g = stance();
    const run = RUNS.find((r) => r.name === "dash")!;
    run.frames.forEach((f, i) => expect(off(f, g), `dash frame ${i}`).toBeLessThanOrEqual(FADE_SWITCH));
    const brace = RUNS.find((r) => r.name === "brace")!;
    expect(off(brace.frames[brace.frames.length - 1]!, g), "brace end").toBeLessThanOrEqual(FADE_SWITCH);
    const evade = RUNS.find((r) => r.name === "evade")!;
    expect(off(evade.frames[0]!, g), "evade start").toBeLessThanOrEqual(FADE_SWITCH);
  });
  it("planted fault: a clip that starts with the arm thrown up is caught", () => {
    const g = stance();
    const p = { ...RUNS[0]!.poses[0]!, rot: [...RUNS[0]!.poses[0]!.rot] };
    p.rot[BONE.armFup] = -150;
    expect(off(measure(p), g)).toBeGreaterThan(SWITCH);
  });
});
