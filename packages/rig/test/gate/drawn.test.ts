/**
 * The drawn picture holds together (owner, 16 Nov 2026: "Dislocation of arms", "Wrong hand
 * using", "Wrongful animation throwing"). Measured on the part list `drawActor` paints, not on
 * bone angles (`drawn.ts`): every scrapper clip, gate and content and the per-weapon variants,
 * with every item kind (fists, one-hand, two-hand, pair both ways round, shield, Move prop and
 * the items each variant is for), three builds, both facings, every 60 fps frame, plain and
 * aimed at a head and a body:
 *  - no connected parts drawn apart, no joint whose pieces open a notch, no limb drawn longer or
 *    shorter than its bone, no upper arm or thigh rooted outside the trunk;
 *  - every hand on what it holds, the item in the leading hand, the shield on the back forearm;
 *  - shoulders, elbows and wrists inside a real arm's range, and no forearm or hand turning
 *    faster than a real one, as drawn (the two-hand solve included);
 *  - a thrown item starts its flight at the drawn hand at the release, moving forward.
 * Each line has a planted fault that must be seen.
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "@rankzero/core";
import type { Dress, Place } from "../../src/contracts";
import { SCRAPPER_CLIPS } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import type { Paint } from "../../src/engine/draw";
import { apply, moveXf, mul } from "../../src/engine/pose";
import { contentPack } from "../../src/content/pack";
import { VARIANTS } from "../../src/content/clips/use";
import { gatePack } from "../../src/gate/pack";
import { PROPORTION } from "../../src/gate/skeleton";
import type { Drawn } from "./drawn";
import { KINDS, LIMITS, LOOK, addTurn, dressOf, measureDrawn, measureParts, sizeOf, sweep } from "./drawn";

const S = "scrapper" as const;
const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
const HOME: Place = { x: 0, y: 0, facing: 1 };
const CLIPS = [...SCRAPPER_CLIPS, ...Object.keys(VARIANTS)];

const rows = sweep(rig, CLIPS, { ring: 12 });
const faults = (kinds: readonly string[]): string[] => rows.flatMap((r) => r.m.faults.filter((f) => kinds.includes(f.kind))
  .map((f) => `${r.clip}${r.aim ? " @" + r.aim : ""} t${Math.round(r.t)} ${r.kind} b${r.build} f${r.facing}: ${f.kind} ${f.where} ${f.value.toFixed(2)}`));
const first = <T>(xs: T[]): T[] => xs.slice(0, 12);

/** A part list with the parts of some bones moved (stage units). */
function moved(parts: readonly Paint[], tags: readonly string[], dx: number, dy: number): Paint[] {
  return parts.map((p) => (p.tag !== undefined && tags.includes(p.tag)
    ? { ...p, xf: mul(moveXf(dx, dy), p.xf), ...(p.item !== undefined ? { item: mul(moveXf(dx, dy), p.item) } : {}) } : p));
}
const planted = (pose = rig.samplePose(S, "idle", 0), d: Dress = dressOf(KINDS[1]!, 0)) => ({ pose, d, parts: ins.parts(pose, d, HOME) });
const kindsOf = (m: Drawn): string[] => m.faults.map((f) => `${f.kind} ${f.where}`);

describe("drawn: the body holds together", () => {
  it("measures every clip with every item kind, build and facing", () => {
    expect(new Set(rows.map((r) => r.clip)).size).toBe(CLIPS.length);
    expect(new Set(rows.map((r) => r.kind)).size).toBe(KINDS.length);
    expect(rows.length).toBeGreaterThan(60000);
  });
  it(`no connected parts more than ${LIMITS.apart} apart, no joint opening a notch over ${LIMITS.open}, no upper arm or thigh rooted outside the trunk`, () => {
    expect(first(faults(["apart", "open", "socket"]))).toEqual([]);
  });
  it(`no limb drawn more than ${LIMITS.length * 100}% longer or shorter than its bone`, () => {
    expect(first(faults(["length"]))).toEqual([]);
  });
  it("planted fault: a hand moved 3 units off its wrist is seen", () => {
    const { pose, d, parts } = planted();
    expect(measureParts(ins, parts, pose, d, HOME, sizeOf(d)).faults).toEqual([]);
    const m = measureParts(ins, moved(parts, ["handF"], 3, 0), pose, d, HOME, sizeOf(d));
    expect(kindsOf(m)).toContain("apart wristF");
  });
  it("planted fault: a forearm shortened 5 percent is seen", () => {
    const { pose, d, parts } = planted();
    const elbow = apply(parts.find((p) => p.tag === "armF.lo")!.xf, 0, 0);
    const wrist = apply(parts.find((p) => p.tag === "handF")!.xf, 0, 0);
    const k = 0.05;
    const m = measureParts(ins, moved(parts, ["handF", "item:F"], (elbow[0] - wrist[0]) * k, (elbow[1] - wrist[1]) * k), pose, d, HOME, sizeOf(d));
    expect(kindsOf(m)).toContain("length armF.lo");
    expect(PROPORTION.forearm * k).toBeGreaterThan(0.5);
  });
  it("planted fault: an elbow whose pieces end flat at the pin (no round caps) opens a notch at a strong bend", () => {
    const { pose, d, parts } = planted(rig.samplePose(S, "idle", 0), { ...dressOf(KINDS[0]!, 0) });
    const L = PROPORTION.forearm;
    const U = PROPORTION.upperArm;
    const flat = parts.map((p) => (p.ink ? p : p.tag === "armF.lo" ? { ...p, d: `M -1.6 0 L 1.8 0 L 1.4 ${L} L -1.2 ${L} Z` }
      : p.tag === "armF.up" ? { ...p, d: `M -2.8 0 L 2.8 0 L 1.7 ${U} L -1.7 ${U} Z` } : p));
    expect(kindsOf(measureParts(ins, flat, pose, d, HOME, sizeOf(d)))).toContain("open elbowF");
  });
  it("planted fault: an upper arm hung outside the chest is seen", () => {
    const { pose, d, parts } = planted();
    const m = measureParts(ins, moved(parts, ["armF.up", "armF.lo", "handF", "item:F"], 9, -4), pose, d, HOME, sizeOf(d));
    expect(kindsOf(m)).toContain("socket shoulderF");
  });
});

describe("drawn: the right hand holds the right thing", () => {
  it(`every hand within ${LIMITS.grip} of what it holds; the item in the leading hand, a second only for a pair; the shield on the back wrist`, () => {
    expect(first(faults(["grip", "hand"]))).toEqual([]);
  });
  it("a fighter facing left holds everything in the same hands, mirrored", () => {
    const bad: string[] = [];
    for (const kind of KINDS) for (const clip of ["idle", "draw", "throw", "block-shield", "drink", "power-up"]) {
      const d = dressOf(kind, 0);
      for (const t of [0, 90, 180]) {
        const p = rig.samplePose(S, clip, t);
        const r = ins.parts(p, d, { x: 0, y: 0, facing: 1 });
        const l = ins.parts(p, d, { x: 0, y: 0, facing: -1 });
        r.forEach((q, i) => {
          const a = apply(q.xf, 0, 0);
          const b = apply(l[i]!.xf, 0, 0);
          if (q.tag !== l[i]!.tag || Math.abs(a[0] + b[0]) > 1e-6 || Math.abs(a[1] - b[1]) > 1e-6) bad.push(`${kind.name} ${clip} t${t} ${q.tag}`);
        });
      }
    }
    expect(first(bad)).toEqual([]);
  });
  it("planted fault: the weapon drawn in the back hand, and a shield in the front hand, are seen", () => {
    const { pose, d, parts } = planted();
    const back = apply(parts.find((p) => p.tag === "handB")!.xf, 0, PROPORTION.grip);
    const front = apply(parts.find((p) => p.tag === "handF")!.xf, 0, PROPORTION.grip);
    const swapped = parts.map((p) => (p.tag === "item:F" ? { ...p, tag: "item:B" } : p));
    expect(kindsOf(measureParts(ins, swapped, pose, d, HOME, sizeOf(d)))).toContain("hand item not in handF");
    const inBack = moved(parts, ["item:F"], back[0] - front[0], back[1] - front[1]);
    expect(kindsOf(measureParts(ins, inBack, pose, d, HOME, sizeOf(d)))).toContain("grip item:F");
    const sd: Dress = { ...d, shield: "riot-shield" };
    const sp = ins.parts(pose, sd, HOME);
    const wristB = apply(sp.find((p) => p.tag === "handB")!.xf, 0, 0);
    const wristF = apply(sp.find((p) => p.tag === "handF")!.xf, 0, 0);
    const shieldFront = moved(sp, ["shield"], wristF[0] - wristB[0], wristF[1] - wristB[1]);
    expect(kindsOf(measureParts(ins, shieldFront, pose, sd, HOME, sizeOf(sd)))).toContain("grip shield");
  });
});

describe("drawn: a real arm's range and speed", () => {
  it(`shoulders, elbows and wrists as drawn within ANATOMY (${LIMITS.bend} degrees of rounding)`, () => {
    expect(first(faults(["bend"]))).toEqual([]);
  });
  it(`no forearm or hand drawn turning more than ${LIMITS.turn} degrees in one 60 fps frame (ko-fall, snared, every clip)`, () => {
    expect(first(faults(["turn"]))).toEqual([]);
  });
  it("planted fault: a forearm that snaps 40 degrees between frames is seen", () => {
    const { pose, d } = planted();
    const a = measureDrawn(ins, pose, d, HOME, sizeOf(d));
    const b = measureDrawn(ins, pose, d, HOME, sizeOf(d));
    b.angles = { ...b.angles, loB: b.angles["loB"]! + 40 };
    addTurn(b, a);
    expect(kindsOf(b)).toContain("turn loB");
  });
});

// ---------------------------------------------------------------------------------- throws
const THROWN: readonly [string, HeldId][] = [["throw", "bricks"], ["throw", "paint-can"], ["throw", "pipe"], ["throw", "fists"],
  ["throw-side", "boomerang"], ["throw-side", "hubcap"], ["throw-roll", "tyre"], ["throw-flick", "darts"], ["throw-heave", "sledgehammer"], ["throw-heave", "bat"]];
/** What the stage does (`choreo/throw.ts`): the flight starts at the hand anchor of the clip the
 *  item throws with, sampled at its release, unaimed. Returns how far that start is from the
 *  drawn fist and the drawn item grip at the release, and how far the hand moved forward over the
 *  frame before it. */
function release(clip: string, held: HeldId, build: number, facing: 1 | -1, shift = 0): { fist: number; grip: number; forward: number } {
  const d: Dress = { look: LOOK(build), held, shield: null, scale: 1 };
  const at: Place = { x: 40, y: 0, facing };
  const name = rig.attackClip!(held, "throw");
  expect(name).toBe(clip);
  const t = rig.clipInfo(S, name).events.find((e) => e.name === "release")!.t;
  const p = rig.samplePose(S, name, t);
  const hand = rig.handAnchor(p, d, at);
  const start = { x: hand.x + shift, y: hand.y };
  const parts = ins.parts(p, d, at);
  const fist = apply(parts.find((q) => q.tag === "handF")!.xf, 0, PROPORTION.grip);
  const art = ins.held(d);
  const item = parts.find((q) => q.tag === "item:F");
  const grip = art === null || item === undefined ? fist : apply(item.item!, art.grip.x, art.grip.y);
  const before = rig.handAnchor(rig.samplePose(S, name, t - 1000 / 60), d, at);
  return { fist: Math.hypot(start.x - fist[0], start.y - fist[1]), grip: Math.hypot(start.x - grip[0], start.y - grip[1]), forward: (hand.x - before.x) * facing };
}
describe("drawn: throws leave from the hand", () => {
  it("each thrown item's flight starts within 1 unit of the drawn hand and its drawn grip at the release, the hand moving forward", () => {
    const bad: string[] = [];
    for (const [clip, held] of THROWN) for (const b of [0, 1, 2]) for (const f of [1, -1] as const) {
      const r = release(clip, held, b, f);
      if (r.fist > 1 || r.grip > 1 || r.forward <= 0) bad.push(`${clip} ${held} b${b} f${f}: fist ${r.fist.toFixed(2)} grip ${r.grip.toFixed(2)} forward ${r.forward.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });
  it("planted fault: a flight that starts 2 units off the hand is seen", () => {
    const r = release("throw", "bricks", 0, 1, 2);
    expect(r.fist).toBeGreaterThan(1);
  });
});
