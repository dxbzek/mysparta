/**
 * Footwork (movement pass 2, 16 Nov 2026): the clips the stage plays to carry a fighter across
 * the floor without a foot sliding. Each lists its feet's contacts (`Stride`, engine/sample.ts);
 * the stage moves the body only in the ways written next to each clip, so a foot on the floor
 * holds its spot on the stage (stage/src/footwork.ts carries them, tuning.ts `RUN`, `HOP`).
 * Poses from Muybridge, "Animal Locomotion" (1887, public domain): plate 62 (running) for the
 * push-off and the stop, plate 163 (standing jump) and the boxers of plates 336 and 338 for the
 * shuffle and the slip.
 *
 * DASH_PUSH (52 ms) the first step of the run, out of the brace. The back foot drives on its toe
 *   while the body speeds up from rest to the run speed at an even rate (the stage moves the body
 *   `RUN_SPEED / 2 * t^2 / 52`, 14.56 units); the toe is carried back by exactly that (`move`),
 *   so it pushes, it does not slide. The front knee comes through. It ends on the dash loop's
 *   pose at 12 ms (the back toe leaving the floor), where the loop takes over.
 * BRAKE (158 ms) the last step of the run. It starts on the dash loop's pose at 12 ms (in the
 *   air). The stage keeps the run speed through the flight (it may stretch the first 40 ms of it
 *   to fit the distance) and plays the last 8 ms of it at 1x, the front toe pawing back onto its
 *   spot; at 48 ms (`land`) the front foot plants 14 units ahead of where it stands in the guard
 *   and the body slows from the run speed to rest by 98 ms (`step`) at an even rate, 14 units,
 *   the weight sinking over the bent front knee; the back foot comes down behind at 80 ms. Then
 *   it rises into the guard.
 * SHUFFLE (180 ms) the boxer's bounce step, forward or back: the knees dip, both feet push off
 *   the toes at 50 ms (`step`), the body is in the air until 120 ms (`land`), when both feet land
 *   on their toes where they stand in the guard, and the knees take it. The stage moves the body
 *   only while it is in the air, on an arc.
 * SLIP (300 ms) a dodge with no jump: from the raised guard the knees drop and the trunk dips
 *   forward under the blow, the chin tucked behind the lead shoulder, the head 9 units or more
 *   lower at 110 ms (the stage's `evadeLead`, when the blow passes), then he rises into the
 *   guard. Both toes stay put.
 */
import type { Clip } from "../../contracts";
import { GUARD_UP } from "../../gate/clips/brace";
import { GROUND, LAND, RUN_SPEED, runAt } from "../../gate/clips/dash";
import { TOE_B, TOE_F } from "../../gate/clips/idle";
import { clip, onToe, solve, TOE } from "../../gate/clips/kit";
import type { ArmSpec, LegSpec, Spec } from "../../gate/clips/kit";
import { BONE } from "../../gate/skeleton";

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
type AngleArm = { up: number; lo: number; hand?: number };
type AngleLeg = { up: number; lo: number; foot?: number };
const armMix = (a: AngleArm, b: AngleArm, u: number): ArmSpec => ({ up: lerp(a.up, b.up, u), lo: lerp(a.lo, b.lo, u), hand: lerp(a.hand ?? 0, b.hand ?? 0, u) });
const legMix = (a: AngleLeg, b: AngleLeg, u: number): LegSpec => ({ up: lerp(a.up, b.up, u), lo: lerp(a.lo, b.lo, u), foot: lerp(a.foot ?? 0, b.foot ?? 0, u) });
/** The thigh, knee and foot angles a leg spec solves to (local, as `{ up, lo, foot }` keys them). */
function anglesOf(s: Spec, side: "F" | "B"): AngleLeg {
  const r = solve(s);
  const [u, l, f] = side === "F" ? [BONE.legFup, BONE.legFlo, BONE.footF] : [BONE.legBup, BONE.legBlo, BONE.footB];
  return { up: r[u]!, lo: r[l]!, foot: r[f]! };
}

function armAnglesOf(s: Spec, side: "F" | "B"): AngleArm {
  const r = solve(s);
  const [u, l, h] = side === "F" ? [BONE.armFup, BONE.armFlo, BONE.handF] : [BONE.armBup, BONE.armBlo, BONE.handB];
  return { up: r[u]!, lo: r[l]!, hand: r[h]! };
}

/** The guard at the bottom of the idle's bounce: the shuffle starts here and every footwork clip
 *  ends here, the toes where the idle's stand (`TOE_F`, `TOE_B`). */
export const SET: Spec = {
  root: [-1, 4.4], pelvis: 0, torso: 9, head: -6, held: 0,
  legF: onToe(TOE_F, 3), legB: onToe(TOE_B, 10),
  F: { at: [11.4, -55.5], aim: -86 }, B: { up: 6, lo: -142, hand: 0 },
  face: "neutral",
};
const GUARD_ARM_B: AngleArm = { up: 6, lo: -142, hand: 0 };

// ------------------------------------------------------------------------------- push-off
/** How long the push-off lasts and how far the body travels in it (units at scale 1). */
export const PUSH_MS = 52;
export const PUSH_TRAVEL = (RUN_SPEED / 2) * PUSH_MS;
/** The dash loop's clip time the push-off ends on and the brake starts on (the back toe just left). */
export const RUN_JOIN = 12;
const pushed = (t: number): number => ((RUN_SPEED / 2) * t * t) / PUSH_MS;
/** Where the back toe leaves the floor in the run (dash.ts: lands `LAND` ahead, carried `GROUND` ms). */
const B_OFF = LAND - RUN_SPEED * GROUND;
const RUN_END = runAt(RUN_JOIN);
const PUSH_START: Spec = { ...GUARD_UP, legF: onToe(TOE_F, 4), legB: onToe(B_OFF + PUSH_TRAVEL, 22) };
const F0 = anglesOf(PUSH_START, "F");
const F1 = RUN_END.legF as AngleLeg;

function pushAt(t: number): Spec {
  const u = t / PUSH_MS;
  const r0 = PUSH_START.root!;
  const r1 = RUN_END.root!;
  // the front foot is off the floor at once: the knee bends first, the thigh drives after it
  const legF: LegSpec = t === 0 ? PUSH_START.legF! : { up: lerp(F0.up, F1.up, Math.pow(u, 0.8)), lo: lerp(F0.lo, F1.lo, clamp01(1.5 * u)), foot: lerp(F0.foot ?? 0, F1.foot ?? 0, u) };
  return {
    root: [lerp(r0[0], r1[0], u), lerp(r0[1], r1[1], u)],
    pelvis: lerp(PUSH_START.pelvis ?? 0, RUN_END.pelvis ?? 0, u),
    torso: lerp(PUSH_START.torso ?? 0, RUN_END.torso ?? 0, u),
    head: lerp(PUSH_START.head ?? 0, RUN_END.head ?? 0, u),
    held: 0,
    legF,
    legB: onToe(B_OFF + PUSH_TRAVEL - pushed(t), lerp(22, 54, u)),
    F: armMix(PUSH_START.F as AngleArm, RUN_END.F as AngleArm, u),
    B: armMix(PUSH_START.B as AngleArm, RUN_END.B as AngleArm, u),
    face: "grit",
  };
}
const PUSH_TIMES = [0, 6, 12, 18, 24, 30, 36, 42, 47, PUSH_MS];
export const DASH_PUSH = clip(PUSH_MS, false, [{ t: 0, name: "step" }],
  PUSH_TIMES.map((t) => [t, t === PUSH_MS ? RUN_END : pushAt(t)] as const),
  {
    lag: { head: 20 },
    stride: { speed: 0, contacts: [{ foot: "footB", from: 0, to: PUSH_MS, at: TOE,
      move: Array.from({ length: PUSH_MS / 4 + 1 }, (_, i) => [i * 4, -pushed(i * 4)] as const) }] },
  });

// ---------------------------------------------------------------------------------- brake
export const BRAKE_LAND = 48;
export const BRAKE_STOP = 98;
export const BRAKE_MS = 158;
/** The last part of the flight the stage always plays at 1x (the front toe pawing back onto its spot). */
export const BRAKE_PAW = 8;
export const BRAKE_TRAVEL = (RUN_SPEED / 2) * (BRAKE_STOP - BRAKE_LAND);
const braked = (t: number): number => { const u = clamp01((t - BRAKE_LAND) / (BRAKE_STOP - BRAKE_LAND)); return BRAKE_TRAVEL * (1 - (1 - u) * (1 - u)); };
const F_LAND = TOE_F + BRAKE_TRAVEL;
const B_DOWN = 80;
const B_LAND = TOE_B + (BRAKE_TRAVEL - braked(B_DOWN));
/** The toe, put `h` above the floor at figure x `x`, with the foot at world angle `foot`. */
const toeAt = (x: number, h: number, foot: number): LegSpec => {
  const s = onToe(x, foot) as { at: readonly [number, number]; foot: number };
  return { at: [s.at[0], s.at[1] - h], foot };
};
const RUN_B = RUN_END.F as AngleArm;
const RUN_BB = RUN_END.B as AngleArm;
const GUARD_F: AngleArm = { up: -14, lo: -112, hand: 30 };
function brakeBody(t: number): Pick<Spec, "root" | "pelvis" | "torso" | "head" | "F" | "B"> {
  // the trunk comes up out of the run's lean and rocks back as the front foot bites, then settles
  const torso = t <= BRAKE_LAND ? lerp(RUN_END.torso ?? 20, 8, t / BRAKE_LAND) : lerp(8, 3, clamp01((t - BRAKE_LAND) / 30));
  const rootY = t <= 40 ? lerp(RUN_END.root![1], 13, t / 40) : lerp(13, 11, clamp01((t - 40) / (BRAKE_STOP - 40)));
  const u = clamp01(t / BRAKE_STOP);
  return {
    root: [lerp(RUN_END.root![0], 0, clamp01(t / 40)), rootY],
    pelvis: lerp(RUN_END.pelvis ?? 0, -2, u),
    torso,
    head: -torso + 4,
    F: armMix(RUN_B, GUARD_F, u),
    B: armMix(RUN_BB, GUARD_ARM_B, u),
  };
}
const brakeF = (t: number): LegSpec => {
  if (t <= 16) return legMix(RUN_END.legF as AngleLeg, { up: -64, lo: 46, foot: 0 }, t / 16);
  if (t <= 32) return legMix({ up: -64, lo: 46, foot: 0 }, { up: -66, lo: 20, foot: -2 }, (t - 16) / 16);
  if (t < BRAKE_LAND - BRAKE_PAW) return { up: -66, lo: 20, foot: -2 };
  // the last 8 ms of the flight: the toe paws back at the run speed onto its spot, coming down
  if (t < BRAKE_LAND) { const u = (t - (BRAKE_LAND - BRAKE_PAW)) / BRAKE_PAW; return toeAt(F_LAND + RUN_SPEED * (BRAKE_LAND - t), 1.4 * (1 - u), -2 * (1 - u)); }
  return onToe(F_LAND - braked(t), t < BRAKE_STOP ? 0 : 2);
};
const brakeB = (t: number): LegSpec => {
  // the back foot kicks up behind off the push, swings under the body and comes down beneath the
  // hips, the toe pawing back at the body's speed in the last 8 ms so it lands without a scrape
  if (t <= 20) return legMix(anglesOf(RUN_END, "B"), { up: 30, lo: 96, foot: -20 }, t / 20);
  if (t <= 40) return legMix({ up: 30, lo: 96, foot: -20 }, { up: 22, lo: 92, foot: -16 }, (t - 20) / 20);
  if (t < B_DOWN - 8) { const u = (t - 40) / (B_DOWN - 48); return toeAt(lerp(-10, B_LAND + 1.6, u), lerp(9, 1.2, u), lerp(24, 15, u)); }
  if (t < B_DOWN) return toeAt(B_LAND + 0.2 * (B_DOWN - t), (1.2 * (B_DOWN - t)) / 8, 14);
  return onToe(B_LAND - (braked(t) - braked(B_DOWN)), t < BRAKE_STOP ? 14 : 12);
};
const BRAKE_TIMES = [0, 8, 16, 20, 24, 32, BRAKE_LAND - BRAKE_PAW, 44, BRAKE_LAND, 54, 60, 66, B_DOWN - 8, 76, B_DOWN, 86, 92, BRAKE_STOP];
export const BRAKE = clip(BRAKE_MS, false, [{ t: BRAKE_LAND, name: "land" }, { t: BRAKE_STOP, name: "step" }], [
  [0, RUN_END],
  ...BRAKE_TIMES.slice(1).map((t) => [t, { ...brakeBody(t), legF: brakeF(t), legB: brakeB(t), face: "grit" as const }] as const),
  [128, { root: [-1, 7.5], pelvis: 0, torso: 8, head: -4, legF: onToe(TOE_F, 2), legB: onToe(TOE_B, 11), F: { at: [11.4, -54], aim: -88 },
    B: GUARD_ARM_B, ease: "inOut" }],
  [BRAKE_MS, { ...SET, ease: "inOut" }],
], {
  lag: { head: 20, "armB.up": 20, "armB.lo": 20 },
  stride: {
    speed: 0,
    contacts: [
      { foot: "footF", from: BRAKE_LAND, to: BRAKE_MS, at: TOE,
        move: Array.from({ length: 11 }, (_, i) => { const t = BRAKE_LAND + i * 5; return [t, -braked(t)] as const; }) },
      { foot: "footB", from: B_DOWN, to: BRAKE_MS, at: TOE,
        move: Array.from({ length: 7 }, (_, i) => { const t = B_DOWN + i * 3; return [t, -(braked(t) - braked(B_DOWN))] as const; }) },
    ],
  },
});

// -------------------------------------------------------------------------------- shuffle
export const HOP_MS = 180;
export const HOP_UP = 50;
export const HOP_DOWN = 120;
export const SHUFFLE = clip(HOP_MS, false, [{ t: HOP_UP, name: "step" }, { t: HOP_DOWN, name: "land" }], [
  [0, SET],
  [28, { root: [-1, 7], torso: 11, head: -5, legF: onToe(TOE_F, 2), legB: onToe(TOE_B, 8), ease: "inOut" }],
  [HOP_UP, { root: [-1, 2.6], torso: 9, head: -6, legF: onToe(TOE_F, 26), legB: onToe(TOE_B, 32), F: { at: [11.4, -56.5], aim: -86 }, ease: "in" }],
  // the toes leave the floor straight up before the knees tuck, and come straight down onto their spots
  [60, { root: [-1, 2.8], legF: toeAt(TOE_F, 2.2, 30), legB: toeAt(TOE_B, 2.2, 36) }],
  [85, { root: [-1, 4.5], torso: 9, legF: { up: -22, lo: 40, foot: 22 }, legB: { up: 14, lo: 44, foot: 28 }, ease: "out" }],
  [110, { root: [-1, 3.0], legF: toeAt(TOE_F, 2.2, 26), legB: toeAt(TOE_B, 2.2, 32), ease: "in" }],
  [HOP_DOWN, { root: [-1, 2.8], legF: onToe(TOE_F, 22), legB: onToe(TOE_B, 28) }],
  [148, { root: [-1, 6.8], torso: 10, head: -5, legF: onToe(TOE_F, 3), legB: onToe(TOE_B, 9), F: { at: [11.4, -54.5], aim: -86 }, ease: "out" }],
  [HOP_MS, { ...SET, ease: "inOut" }],
], {
  lag: { head: 30, "armB.up": 30, "armB.lo": 30, handB: 30 },
  stride: {
    speed: 0,
    contacts: [
      { foot: "footF", from: 0, to: HOP_UP, at: TOE }, { foot: "footB", from: 0, to: HOP_UP, at: TOE },
      // (the landings end a hair before the clip: see the blocks in reactions.ts)
      { foot: "footF", from: HOP_DOWN, to: HOP_MS - 0.1, at: TOE }, { foot: "footB", from: HOP_DOWN, to: HOP_MS - 0.1, at: TOE },
    ],
  },
});

// ----------------------------------------------------------------------------------- slip
const SLIP_F: AngleArm = { up: -78, lo: -112, hand: 28 };
const SET_F = armAnglesOf(SET, "F");
export const SLIP_MS = 300;
/** When the blow passes, in clip time (the stage's `OUTCOME.evadeLead`, as the evade). */
export const SLIP_CONTACT = 110;
export const SLIP = clip(SLIP_MS, false, [], [
  [0, { ...GUARD_UP }],
  [50, { root: [-5, 13], pelvis: -4, torso: 26, head: 14, legF: onToe(TOE_F, 2), legB: onToe(TOE_B, 18),
    F: { up: -84, lo: -104, hand: 28 }, B: { up: -10, lo: -136, hand: 0 }, ease: "out" }],
  [SLIP_CONTACT, { root: [-7, 18], pelvis: -6, torso: 36, head: 18, legF: onToe(TOE_F, 0), legB: onToe(TOE_B, 16),
    F: SLIP_F, B: { up: -14, lo: -134, hand: 0 }, face: "grit", ease: "out" }],
  [170, { root: [-6, 16], pelvis: -5, torso: 30, head: 14, ease: "inOut" }],
  [240, { root: [-3, 9], pelvis: -2, torso: 16, head: 2, legF: onToe(TOE_F, 2), legB: onToe(TOE_B, 12),
    F: armMix(SLIP_F, SET_F, 0.65), B: GUARD_ARM_B, ease: "inOut" }],
  [SLIP_MS, { ...SET, ease: "inOut" }],
], {
  lag: { head: 24, "armB.up": 24, "armB.lo": 24 },
  stride: { speed: 0, contacts: [{ foot: "footF", from: 0, to: SLIP_MS, at: TOE }, { foot: "footB", from: 0, to: SLIP_MS, at: TOE }] },
});

/** The footwork clips by the names the stage asks for. */
export const FOOTWORK: Readonly<Record<string, Clip>> = {
  "dash-push": DASH_PUSH, brake: BRAKE, shuffle: SHUFFLE, slip: SLIP,
};
