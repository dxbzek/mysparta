/**
 * TEST DOUBLE (work package 0, frozen). `capsuleRig` is a complete `Rig` made of sticks and
 * capsules. The stage lane and the fight-screen lane build against it before the real art
 * exists. It is never replaced: the web seam file just stops pointing at it.
 * Import it from "@rankzero/rig/testing".
 *
 * `capsuleGateRig` is the same double cut down to what a rig built from the gate pack alone
 * does (the contract's "Gate-only rig" rule): 13 clips with `CLIP_FALLBACK` for the other 10,
 * the yard only, the four gate effects, no Move props, placeholder companions with the times of
 * `PLACEHOLDER_COMPANION_CLIPS`, every weapon outside the gate a straight bar
 * `placeholderLength(reach)` long (so a weapon that bends does not bend), and the
 * `DOOR_PLACEHOLDER` panel. The stage lane tests the fallback path with it before the first
 * integration.
 *
 * Both doubles bend a clip with a contact toward an `Aim`: the waist, both shoulders and (for a
 * low target) the knees turn by one angle found by a bisection, and whatever is still too low is
 * made up by a hop. A companion lowers its body and head, or leaps.
 *
 * What is real in it:
 *  - every clip name of the contract, with the lengths and event times of the timing table;
 *  - the geometry the stage places actors with. `strikePoint`, `hitPoint` and `handAnchor` are
 *    measured from the same forward kinematics, the same scale and the same build that
 *    `drawActor` draws with, so a point they give is a point on the picture;
 *  - weapon size. A weapon is 12 + 10 x Reach units long (`WEAPON_META`), at its own size in the
 *    hand, in flight and on the floor. The three weapons that bend are four links that trail
 *    the hand through `Pose.trail`;
 *  - a pair (bare fists, Knuckle Dusters, Screwdrivers) is drawn in both hands and `Dress.lead`
 *    swaps the arms; a Move prop is drawn in the back hand; five arenas.
 * What is not: the look. Poses are rough, the colours are its own, and the back hand is not
 * pinned to a two-hand weapon.
 *
 * Clip times that the timing table fixes:
 *   idle 1200 loop; enter 450 (land at 370); punch, flick, swing, thrust 280 with contact at 150;
 *   smash 380 with contact at 240; throw: release at 180, then an 80 recoil (260 in all);
 *   draw 200; hit-light and hit-heavy 300; block 220; evade 320; power-up 350; drink 450;
 *   slam and slammed 600; ko-fall 600; companion attack 280 with contact at 150.
 * Clip times the table does not give, chosen here: dash, backpedal, run and flee are 240 loops;
 *   brace 120; snared 600 loop; win 800 loop; slam contact at 400; ko-fall lands at 450;
 *   companion idle 1200, hit 300, ko 600.
 */
import { WEAPON_META } from "@rankzero/core";
import type { CompanionId, HeldId, Look, PropId, StageId } from "@rankzero/core";
import type { Aim, Clip, ClipInfo, Ctx2D, DrawEnv, Dress, Ease, FaceId, FxKind, IconRef, Key, MoveProp, Offset,
  Place, Pose, Rig, RigId, SvgArt } from "../contracts";
import { CLIP_FALLBACK, COMPANION_CLIPS, DOOR_PLACEHOLDER, GATE_CLIPS, GATE_WEAPONS, SCRAPPER_BONES, SCRAPPER_CLIPS,
  TRAIL_LEN, TRAIL_STEP_MS, placeholderLength, strikeTime } from "../contracts";
import type { CompanionClip, ContentClip, ScrapperClip } from "../contracts";

const INK = "#14152B";
const WHITE = "#FFFFFF";
const DEG = Math.PI / 180;
/** A held item points along the hand, tipped 10 degrees up: forward when the arm hangs down. */
const GRIP = -10;

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[capsuleRig] ${message}`);
}

// ---------------------------------------------------------------------------------- clips

type Rot = Readonly<Record<string, number>>;
interface KeyOpts { root?: readonly [number, number]; scale?: readonly [number, number]; face?: FaceId; ease?: Ease }
const k = (t: number, rot: Rot, o: KeyOpts = {}): Key => ({ t, rot, ...o });
const clip = (duration: number, loop: boolean, events: Clip["events"], keys: readonly Key[]): Clip =>
  ({ duration, loop, events, keys });

/** The standing pose every one-shot clip starts from and returns to. */
const I: Rot = { torso: 3, "armF.up": -12, "armF.lo": -25, "armB.up": 12, "armB.lo": -20,
  "legF.up": -6, "legF.lo": 8, "legB.up": 8, "legB.lo": 4 };
/** The same pose after a swing that went over the top: 348 is -12 one turn later. */
const I_OVER: Rot = { ...I, "armF.up": 348, handF: -360 };
const I_OVER2: Rot = { ...I, "armF.up": 348, handF: -360, "armB.up": 372 };
const CROUCH: Rot = { torso: 18, "armF.up": -30, "armF.lo": -100, "armB.up": -15, "armB.lo": -100,
  "legF.up": -45, "legF.lo": 65, "legB.up": -12, "legB.lo": 52 };
const RUN_A: Rot = { torso: 20, head: -8, "legF.up": -50, "legF.lo": 35, "legB.up": 40, "legB.lo": 55,
  "armF.up": 45, "armF.lo": -80, "armB.up": -50, "armB.lo": -80 };
const RUN_B: Rot = { torso: 20, head: -8, "legB.up": -50, "legB.lo": 35, "legF.up": 40, "legF.lo": 55,
  "armB.up": 45, "armB.lo": -80, "armF.up": -50, "armF.lo": -80 };
const BACK_A: Rot = { torso: -6, "legF.up": 25, "legF.lo": 20, "legB.up": -25, "legB.lo": 30,
  "armF.up": -30, "armF.lo": -70, "armB.up": 20, "armB.lo": -60 };
const BACK_B: Rot = { torso: -6, "legB.up": 25, "legB.lo": 20, "legF.up": -25, "legF.lo": 30,
  "armB.up": -30, "armB.lo": -70, "armF.up": 20, "armF.lo": -60 };
const GUARD: Rot = { torso: -8, "armF.up": -75, "armF.lo": -95, "armB.up": -55, "armB.lo": -100,
  "legF.up": -20, "legF.lo": 30, "legB.up": 25, "legB.lo": 20 };
const SNARED_A: Rot = { torso: 26, head: 20, "armF.up": -20, "armF.lo": -100, "armB.up": -10, "armB.lo": -100,
  "legF.up": -30, "legF.lo": 45, "legB.up": -5, "legB.lo": 35 };
const SNARED_B: Rot = { ...SNARED_A, torso: 14, head: 8 };
const WIN_A: Rot = { torso: -6, head: -8, "armF.up": -160, "armF.lo": -20, handF: 106, "armB.up": -150, "armB.lo": -25 };
const WIN_B: Rot = { torso: -3, head: -4, "armF.up": -172, "armF.lo": -40, handF: 135, "armB.up": -140, "armB.lo": -10,
  "legF.up": -8, "legF.lo": 14, "legB.up": 6, "legB.lo": 10 };
const DOWN: Rot = { root: -90, torso: -5, head: 6, "armF.up": -60, "armF.lo": -20, "armB.up": -40,
  "legF.up": -20, "legF.lo": 30, "legB.up": 5 };

const SCRAPPER: Record<ScrapperClip, Clip> = {
  idle: clip(1200, true, [], [k(0, I), k(600, { ...I, torso: 5, "armF.lo": -30, "armB.lo": -24 }, { scale: [1, 0.985], ease: "inOut" }), k(1200, I, { ease: "inOut" })]),
  enter: clip(450, false, [{ t: 370, name: "land" }], [
    k(0, { torso: 20, "armF.up": -150, "armB.up": -130, "legF.up": -60, "legF.lo": 80, "legB.up": -20, "legB.lo": 70 }, { root: [0, -34], face: "shout" }),
    k(300, { torso: 10, "armF.up": -120, "armB.up": -100, "legF.up": -25, "legF.lo": 20, "legB.up": 10, "legB.lo": 20 }, { root: [0, -6], face: "shout", ease: "in" }),
    k(370, CROUCH, { scale: [1.1, 0.88], face: "grit" }),
    k(450, I, { ease: "out" }),
  ]),
  dash: clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [k(0, RUN_A, { face: "grit" }), k(120, RUN_B, { face: "grit" }), k(240, RUN_A, { face: "grit" })]),
  backpedal: clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [k(0, BACK_A), k(120, BACK_B), k(240, BACK_A)]),
  brace: clip(120, false, [], [k(0, I), k(120, GUARD, { face: "grit", ease: "out" })]),
  punch: clip(280, false, [{ t: 150, name: "contact" }], [
    k(0, I),
    k(90, { torso: -10, "armF.up": 35, "armF.lo": -120, "armB.up": -40, "armB.lo": -90, "legF.up": -10, "legB.up": 14 }, { root: [-3, 0], face: "grit", ease: "out" }),
    k(150, { torso: 18, "armF.up": -100, "armF.lo": -4, "armB.up": 30, "armB.lo": -60, "legF.up": -24, "legF.lo": 20, "legB.up": 24 }, { root: [7, 0], face: "shout", ease: "in" }),
    k(190, { torso: 22, "armF.up": -108, "armF.lo": 0, "armB.up": 36, "armB.lo": -60, "legF.up": -26, "legF.lo": 22, "legB.up": 26 }, { root: [8, 0], face: "shout", ease: "out" }),
    k(280, I, { ease: "inOut" }),
  ]),
  flick: clip(280, false, [{ t: 150, name: "contact" }], [
    k(0, I),
    k(90, { torso: -6, "armF.up": -30, "armF.lo": -130, handF: 76, "armB.up": 20, "armB.lo": -40, "legB.up": 12 }, { root: [-2, 0], face: "grit", ease: "out" }),
    k(150, { torso: 12, "armF.up": -75, "armF.lo": -15, handF: 98, "armB.up": 25, "armB.lo": -50, "legF.up": -18, "legF.lo": 14, "legB.up": 18 }, { root: [5, 0], face: "shout", ease: "in" }),
    k(190, { torso: 15, "armF.up": -85, "armF.lo": -5, handF: 115, "armB.up": 28, "armB.lo": -50, "legF.up": -20, "legF.lo": 16, "legB.up": 20 }, { root: [6, 0], face: "shout", ease: "out" }),
    k(280, I, { ease: "inOut" }),
  ]),
  swing: clip(280, false, [{ t: 150, name: "contact" }], [
    k(0, I),
    k(90, { torso: -14, "armF.up": 160, "armF.lo": -30, handF: -216, "armB.up": -30, "armB.lo": -70, "legF.up": -8, "legB.up": 16 }, { root: [-3, 0], face: "grit", ease: "out" }),
    // contact: the arm is out at chest height and the weapon lies level, far end forward
    k(150, { torso: 20, "armF.up": 280, "armF.lo": -15, handF: -275, "armB.up": 30, "armB.lo": -50, "legF.up": -24, "legF.lo": 20, "legB.up": 24 }, { root: [6, 0], face: "shout", ease: "in" }),
    k(190, { torso: 26, "armF.up": 340, "armF.lo": -10, handF: -306, "armB.up": 36, "armB.lo": -50, "legF.up": -26, "legF.lo": 22, "legB.up": 26 }, { root: [7, 0], face: "shout", ease: "out" }),
    k(280, I_OVER, { ease: "inOut" }),
  ]),
  smash: clip(380, false, [{ t: 240, name: "contact" }], [
    k(0, I),
    k(170, { torso: -18, head: -10, "armF.up": 185, "armF.lo": -20, handF: -232, "armB.up": 175, "armB.lo": -20, "legF.up": -8, "legB.up": 14 }, { root: [-3, 0], scale: [0.96, 1.06], face: "grit", ease: "out" }),
    // contact: both arms out in front, the weapon coming down through shoulder height
    k(240, { torso: 35, head: 8, "armF.up": 245, "armF.lo": -10, handF: -245, "armB.up": 235, "armB.lo": -10, "legF.up": -40, "legF.lo": 50, "legB.up": 10, "legB.lo": 40 }, { root: [6, 0], scale: [1.06, 0.92], face: "shout", ease: "in" }),
    // after it: the swing carries on down to the floor
    k(290, { torso: 40, head: 10, "armF.up": 300, "armF.lo": -10, handF: -265, "armB.up": 290, "armB.lo": -10, "legF.up": -42, "legF.lo": 54, "legB.up": 10, "legB.lo": 42 }, { root: [7, 0], scale: [1.08, 0.9], face: "shout", ease: "out" }),
    k(380, I_OVER2, { ease: "inOut" }),
  ]),
  thrust: clip(280, false, [{ t: 150, name: "contact" }], [
    k(0, I),
    k(90, { torso: -8, "armF.up": 25, "armF.lo": -115, handF: 108, "armB.up": -30, "armB.lo": -80, "legF.up": -10, "legB.up": 14 }, { root: [-4, 0], face: "grit", ease: "out" }),
    k(150, { torso: 20, "armF.up": -95, "armF.lo": -5, handF: 90, "armB.up": 34, "armB.lo": -40, "legF.up": -34, "legF.lo": 30, "legB.up": 30 }, { root: [9, 0], face: "shout", ease: "in" }),
    k(190, { torso: 23, "armF.up": -100, "armF.lo": 0, handF: 87, "armB.up": 38, "armB.lo": -40, "legF.up": -36, "legF.lo": 32, "legB.up": 32 }, { root: [10, 0], face: "shout", ease: "out" }),
    k(280, I, { ease: "inOut" }),
  ]),
  throw: clip(260, false, [{ t: 180, name: "release" }], [
    k(0, I),
    k(120, { torso: -15, "armF.up": 170, "armF.lo": -40, handF: -215, "armB.up": -60, "armB.lo": -30, "legF.up": -10, "legB.up": 16 }, { root: [-3, 0], face: "grit", ease: "out" }),
    // release: the hand lets go out in front at shoulder height
    k(180, { torso: 22, "armF.up": 255, "armF.lo": -10, handF: -267, "armB.up": 30, "armB.lo": -50, "legF.up": -26, "legF.lo": 22, "legB.up": 24 }, { root: [5, 0], face: "shout", ease: "in" }),
    k(260, I_OVER, { root: [-2, 0], ease: "out" }),
  ]),
  draw: clip(200, false, [], [k(0, I), k(100, { ...I, torso: 6, head: 10, "armF.up": 70, "armF.lo": -80 }, { ease: "out" }), k(200, I, { ease: "inOut" })]),
  "hit-light": clip(300, false, [], [
    k(0, I, { face: "dazed" }),
    k(60, { torso: -18, head: -12, "armF.up": -40, "armF.lo": -60, "armB.up": 30, "armB.lo": -30, "legF.up": -12, "legB.up": 12 }, { root: [-3, 0], face: "dazed", ease: "out" }),
    k(300, I, { ease: "inOut" }),
  ]),
  "hit-heavy": clip(300, false, [], [
    k(0, I, { face: "dazed" }),
    k(60, { torso: -36, head: -22, "armF.up": -110, "armF.lo": -30, "armB.up": -80, "armB.lo": -20, "legF.up": -30, "legF.lo": 30, "legB.up": 18 }, { root: [-6, 0], scale: [0.94, 1.06], face: "dazed", ease: "out" }),
    k(180, { torso: -28, head: -16, "armF.up": -90, "armF.lo": -40, "armB.up": -60, "armB.lo": -30, "legF.up": -22, "legF.lo": 24, "legB.up": 16 }, { root: [-5, 0], face: "dazed" }),
    k(300, I, { ease: "inOut" }),
  ]),
  block: clip(220, false, [], [
    k(0, I),
    k(60, { torso: -6, "armF.up": -95, "armF.lo": -110, "armB.up": -85, "armB.lo": -115, "legF.up": -18, "legF.lo": 26, "legB.up": 22 }, { face: "grit", ease: "out" }),
    k(160, { torso: -10, "armF.up": -92, "armF.lo": -112, "armB.up": -82, "armB.lo": -116, "legF.up": -18, "legF.lo": 26, "legB.up": 24 }, { root: [-1, 0], face: "grit" }),
    k(220, I, { ease: "inOut" }),
  ]),
  evade: clip(320, false, [{ t: 320, name: "land" }], [
    k(0, I),
    k(60, CROUCH, { face: "grit", ease: "out" }),
    k(160, { torso: -18, "armF.up": -80, "armF.lo": -30, "armB.up": 60, "armB.lo": -30, "legF.up": -55, "legF.lo": 70, "legB.up": -30, "legB.lo": 60 }, { root: [0, -14], face: "grin", ease: "out" }),
    k(320, I, { root: [0, 0], ease: "in" }),
  ]),
  snared: clip(600, true, [], [k(0, SNARED_A, { face: "dazed" }), k(300, SNARED_B, { face: "dazed", ease: "inOut" }), k(600, SNARED_A, { face: "dazed", ease: "inOut" })]),
  "power-up": clip(350, false, [], [
    k(0, I),
    k(120, { ...CROUCH, "armF.lo": -120, "armB.lo": -120 }, { scale: [1.06, 0.92], face: "grit", ease: "out" }),
    k(240, { torso: -10, head: -10, "armF.up": -165, "armF.lo": -30, "armB.up": -150, "armB.lo": -30 }, { scale: [0.95, 1.08], face: "shout", ease: "back" }),
    k(350, I, { ease: "inOut" }),
  ]),
  drink: clip(450, false, [], [
    k(0, I),
    k(120, { ...I, torso: -6, head: -18, "armB.up": -110, "armB.lo": -125 }, { ease: "out" }),
    k(330, { ...I, torso: -9, head: -26, "armB.up": -114, "armB.lo": -128 }),
    k(450, I, { face: "grin", ease: "inOut" }),
  ]),
  slam: clip(600, false, [{ t: 400, name: "contact" }], [
    k(0, I),
    k(150, { ...CROUCH, torso: 25, "armF.up": -80, "armF.lo": -10, "armB.up": -70, "armB.lo": -10 }, { root: [6, 0], face: "grit", ease: "out" }),
    k(300, { torso: -15, head: -10, "armF.up": 200, "armF.lo": -10, "armB.up": 190, "armB.lo": -10 }, { root: [4, 0], scale: [0.96, 1.06], face: "grit", ease: "out" }),
    k(400, { torso: 45, head: 10, "armF.up": 310, "armF.lo": -5, "armB.up": 300, "armB.lo": -5, "legF.up": -45, "legF.lo": 60, "legB.up": 5, "legB.lo": 45 }, { root: [6, 0], scale: [1.08, 0.9], face: "shout", ease: "in" }),
    k(600, I_OVER2, { ease: "inOut" }),
  ]),
  slammed: clip(600, false, [{ t: 400, name: "land" }], [
    k(0, I, { face: "dazed" }),
    k(150, { torso: -20, head: -15, "armF.up": -90, "armB.up": -70 }, { root: [0, -6], face: "dazed", ease: "out" }),
    k(300, { root: -170, torso: -10, "armF.up": -140, "armB.up": -120, "legF.up": -30, "legB.up": 20 }, { root: [-6, -44], face: "dazed", ease: "out" }),
    k(400, DOWN, { root: [-12, 0], scale: [1.08, 0.9], face: "dazed", ease: "in" }),
    k(520, DOWN, { root: [-12, 0], face: "dazed" }),
    k(600, I, { face: "dazed", ease: "inOut" }),
  ]),
  "ko-fall": clip(600, false, [{ t: 450, name: "land" }], [
    k(0, { torso: -20, head: -15, "armF.up": -70, "armF.lo": -40, "armB.up": -50, "armB.lo": -30, "legF.up": -10, "legB.up": 10 }, { face: "dazed" }),
    k(200, { root: -32, torso: -25, head: -20, "armF.up": -120, "armF.lo": -20, "armB.up": -100, "armB.lo": -20, "legF.up": -30, "legF.lo": 20 }, { root: [-4, -5], face: "dazed", ease: "out" }),
    k(450, DOWN, { root: [-10, 0], scale: [1.06, 0.92], face: "dazed", ease: "in" }),
    k(520, DOWN, { root: [-10, -2], face: "dazed", ease: "out" }),
    k(600, DOWN, { root: [-10, 0], face: "dazed", ease: "in" }),
  ]),
  win: clip(800, true, [], [k(0, WIN_A, { face: "grin" }), k(400, WIN_B, { scale: [1.02, 0.97], face: "grin", ease: "inOut" }), k(800, WIN_A, { face: "grin", ease: "inOut" })]),
};

const COMPANION_BONES = ["root", "body", "head", "legF", "legB", "tail"] as const;
const C_IDLE: Rot = { tail: 10 };
const C_RUN_A: Rot = { body: -4, legF: -38, legB: 34, tail: -20, head: -6 };
const C_RUN_B: Rot = { body: 4, legF: 34, legB: -38, tail: 10, head: 4 };
const COMPANION: Record<CompanionClip, Clip> = {
  idle: clip(1200, true, [], [k(0, C_IDLE), k(600, { tail: -14, head: 5 }, { scale: [1, 0.97], ease: "inOut" }), k(1200, C_IDLE, { ease: "inOut" })]),
  run: clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [k(0, C_RUN_A), k(120, C_RUN_B), k(240, C_RUN_A)]),
  attack: clip(280, false, [{ t: 150, name: "contact" }], [
    k(0, C_IDLE),
    k(90, { body: -12, head: -14, legF: -10, legB: 16, tail: 30 }, { root: [-4, 0], face: "grit", ease: "out" }),
    k(150, { body: 14, head: 24, legF: -30, legB: 30, tail: -30 }, { root: [10, -3], face: "shout", ease: "in" }),
    k(190, { body: 16, head: 28, legF: -32, legB: 32, tail: -34 }, { root: [11, -1], face: "shout", ease: "out" }),
    k(280, C_IDLE, { ease: "inOut" }),
  ]),
  hit: clip(300, false, [], [
    k(0, C_IDLE, { face: "dazed" }),
    k(60, { body: -16, head: -20, legF: 14, legB: -10, tail: 40 }, { root: [-5, 0], face: "dazed", ease: "out" }),
    k(300, C_IDLE, { ease: "inOut" }),
  ]),
  ko: clip(600, false, [{ t: 400, name: "land" }], [
    k(0, { body: -16, head: -20 }, { face: "dazed" }),
    k(200, { body: -90, head: -30, legF: -100, legB: -80 }, { root: [-4, -8], face: "dazed", ease: "out" }),
    k(400, { body: -178, head: -10, legF: -196, legB: -164, tail: -30 }, { root: [-8, 0], scale: [1.08, 0.9], face: "dazed", ease: "in" }),
    k(600, { body: -180, head: -8, legF: -190, legB: -170, tail: -30 }, { root: [-8, 0], face: "dazed" }),
  ]),
  flee: clip(240, true, [{ t: 0, name: "step" }, { t: 120, name: "step" }], [k(0, C_RUN_A, { face: "dazed" }), k(120, C_RUN_B, { face: "dazed" }), k(240, C_RUN_A, { face: "dazed" })]),
};

const CONTENT_CLIPS: ReadonlySet<string> = new Set(Object.keys(CLIP_FALLBACK));

/** `gateOnly`: answer a content clip with its gate clip, as a rig with no content pack does. */
function findClip(rig: RigId, name: string, gateOnly: boolean): Clip {
  if (rig === "scrapper") {
    const key = gateOnly && CONTENT_CLIPS.has(name) ? CLIP_FALLBACK[name as ContentClip] : name;
    const c = (SCRAPPER as Record<string, Clip | undefined>)[key];
    if (c !== undefined && Object.prototype.hasOwnProperty.call(SCRAPPER, key)) return c;
  } else {
    const c = (COMPANION as Record<string, Clip | undefined>)[name];
    if (c !== undefined && Object.prototype.hasOwnProperty.call(COMPANION, name)) return c;
  }
  warnOnce(`clip:${rig}:${name}`, `no clip "${name}" for rig "${rig}", using idle`);
  return rig === "scrapper" ? SCRAPPER.idle : COMPANION.idle;
}

function eased(u: number, ease: Ease | undefined): number {
  switch (ease) {
    case "in": return u * u;
    case "out": return 1 - (1 - u) * (1 - u);
    case "inOut": return u * u * (3 - 2 * u);
    case "back": { const v = u - 1; return 1 + 2.70158 * v * v * v + 1.70158 * v * v; }
    case "snap": { const v = 1 - u; return 1 - v * v * v * v; }
    default: return u;
  }
}

/** Clip time inside the clip: a loop wraps, any other clip holds its first and its last pose. */
function clipTime(c: Clip, tMs: number): number {
  const d = c.duration;
  let t = Number.isFinite(tMs) ? tMs : 0;
  if (c.loop) { t = t % d; if (t < 0) t += d; } else { t = t < 0 ? 0 : t > d ? d : t; }
  return t;
}

/** One sample of a clip at a time that is already inside it. */
function sampleAt(c: Clip, bones: readonly string[], t: number): Omit<Pose, "rig" | "trail"> {
  let a = c.keys[0]!;
  let b = c.keys[c.keys.length - 1]!;
  for (let i = 0; i + 1 < c.keys.length; i++) {
    const k0 = c.keys[i]!;
    const k1 = c.keys[i + 1]!;
    if (t >= k0.t && t <= k1.t) { a = k0; b = k1; break; }
  }
  const span = b.t - a.t;
  const raw = span <= 0 ? 1 : (t - a.t) / span;
  const u = eased(raw < 0 ? 0 : raw > 1 ? 1 : raw, b.ease);
  const mix = (x: number, y: number): number => x + (y - x) * u;

  const rot = bones.map((id) => mix(a.rot?.[id] ?? 0, b.rot?.[id] ?? 0));
  const ra = a.root ?? [0, 0];
  const rb = b.root ?? [0, 0];
  const sa = a.scale ?? [1, 1];
  const sb = b.scale ?? [1, 1];
  const y = mix(ra[1], rb[1]);
  return {
    rot,
    root: { x: mix(ra[0], rb[0]), y, sx: mix(sa[0], sb[0]), sy: mix(sa[1], sb[1]) },
    face: (raw < 0.5 ? a.face : b.face) ?? "neutral",
    lift: y < 0 ? -y : 0,
  };
}

/** The bones from the root to the front hand: their angles add up to where the hand points. */
const HAND_CHAIN = [0, 1, 2, 7, 8, 9] as const;
function handAngle(rot: readonly number[]): number {
  let sum = 0;
  for (const i of HAND_CHAIN) sum += rot[i] ?? 0;
  return sum;
}

// ----------------------------------------------------------------------------------- aim

/** A bend: `theta` degrees spread over waist, shoulders and knees (scrapper) or body and head
 *  (companion), and `lift` units of hop at full weight. */
interface Bend { theta: number; lift: number }
const NO_BEND: Bend = { theta: 0, lift: 0 };
function contactOf(c: Clip): number | null {
  for (const e of c.events) if (e.name === "contact") return e.t;
  return null;
}
/** 1 at the contact, easing to 0 at the clip's start and end; 0 for a clip with no contact. */
function bendWeight(c: Clip, t: number): number {
  const tc = contactOf(c);
  if (tc === null) return 0;
  const d = c.duration;
  let u = t <= tc ? (tc > 0 ? t / tc : 1) : (d > tc ? (d - t) / (d - tc) : 1);
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * u * (3 - 2 * u);
}
type Sample = Omit<Pose, "rig" | "trail">;
function bent(rig: RigId, s: Sample, bend: Bend, w: number): Sample {
  if (w === 0 || (bend.theta === 0 && bend.lift === 0)) return s;
  const rot = [...s.rot];
  const add = (i: number, deg: number): void => { rot[i] = (rot[i] ?? 0) + deg * w; };
  const th = bend.theta;
  if (rig === "scrapper") {
    add(B.torso, 0.35 * th);
    add(B.armFup, 0.5 * th);
    add(B.armBup, 0.5 * th);
    if (th > 0) {                                          // a low target: squat on both knees too
      add(B.legFup, -0.55 * th); add(B.legFlo, 1.0 * th);
      add(B.legBup, -0.55 * th); add(B.legBlo, 1.0 * th);
    }
  } else {
    add(1, 0.5 * th);                                      // body
    add(2, 0.5 * th);                                      // head
  }
  const y = s.root.y + bend.lift * w;
  return { ...s, rot, root: { ...s.root, y }, lift: y < 0 ? -y : 0 };
}

/** The pose of a found clip at a time, bent. Pure. */
function poseOf(rig: RigId, c: Clip, tMs: number, bend: Bend, withTrail = true): Pose {
  const t = clipTime(c, tMs);
  if (rig !== "scrapper") return { rig, ...bent(rig, sampleAt(c, COMPANION_BONES, t), bend, bendWeight(c, t)) };
  // Where the front hand pointed 40, 80, 120 and 160 ms ago, for a weapon that bends. The past
  // is read from the time asked for, not from the held time: 500 ms after a one-shot clip ended
  // the hand has been still for 500 ms, so the whole trail is the last pose and the chain hangs
  // straight. `clipTime` holds each past sample inside the clip. The past samples are bent by
  // the weight of NOW: the bend turns the whole body and the chain with it, and the chain still
  // trails the keyed swing.
  const now = Number.isFinite(tMs) ? tMs : 0;
  const w = bendWeight(c, t);
  const trail: number[] = [];
  if (withTrail) for (let n = 1; n <= TRAIL_LEN; n++) {
    trail.push(handAngle(bent(rig, sampleAt(c, SCRAPPER_BONES, clipTime(c, now - n * TRAIL_STEP_MS)), bend, w).rot));
  }
  return { rig, ...bent(rig, sampleAt(c, SCRAPPER_BONES, t), bend, w), trail };
}

const bendCache = new Map<string, Bend>();
/** The bend that puts the striking end of this clip at height `aim.y` at its contact. Found by a
 *  scan and a bisection over `theta`; whatever is still too low is made up by a hop. Memoised,
 *  so it is still a pure function of its inputs. */
function bendFor(rig: RigId, name: string, c: Clip, aim: Aim, gateOnly: boolean): Bend {
  const tc = contactOf(c);
  if (tc === null || !Number.isFinite(aim.y)) return NO_BEND;
  const d = aim.dress;
  const key = `${gateOnly ? 1 : 0}|${rig}|${name}|${d.held ?? "fists"}|${d.scale}|${d.look?.build ?? 0}|${d.lead ?? "F"}|${aim.y}`;
  const hit = bendCache.get(key);
  if (hit !== undefined) return hit;
  const trail = isFlex(d.held ?? "fists", gateOnly);         // only a chain's tip reads the trail
  const err = (theta: number): number => strikeEnd(rig, name, poseOf(rig, c, tc, { theta, lift: 0 }, trail), d, gateOnly).y - aim.y;
  const [lo, hi] = rig === "scrapper" ? [-100, 130] : [0, 80];
  let best = 0;
  let bestErr = err(0);
  let bracket: [number, number, number] | null = null;      // [a, b, |midpoint|]
  let prevT = lo;
  let prevE = err(lo);
  if (Math.abs(prevE) < Math.abs(bestErr)) { best = lo; bestErr = prevE; }
  for (let th = lo + 5; th <= hi; th += 5) {
    const e = err(th);
    if (Math.abs(e) < Math.abs(bestErr) || (Math.abs(e) === Math.abs(bestErr) && Math.abs(th) < Math.abs(best))) { best = th; bestErr = e; }
    if ((prevE <= 0 && e >= 0) || (prevE >= 0 && e <= 0)) {
      const mid = Math.abs((prevT + th) / 2);
      if (bracket === null || mid < bracket[2]) bracket = [prevT, th, mid];
    }
    prevT = th;
    prevE = e;
  }
  if (bracket !== null) {
    let [a, b] = bracket;
    let ea = err(a);
    for (let n = 0; n < 40; n++) {
      const m = (a + b) / 2;
      const em = err(m);
      if ((ea <= 0 && em <= 0) || (ea >= 0 && em >= 0)) { a = m; ea = em; } else b = m;
    }
    best = (a + b) / 2;
    bestErr = err(best);
  }
  // Still below the target (y too big): hop up the rest. Pose units are stage units / body scale.
  const s = rig === "scrapper" ? figure(poseOf(rig, c, tc, NO_BEND), d, HOME).body : (d.scale > 0 ? d.scale : 1);
  const bend: Bend = { theta: best, lift: bestErr > 0 ? -bestErr / s : 0 };
  if (bendCache.size > 4000) bendCache.clear();
  bendCache.set(key, bend);
  return bend;
}

function samplePose(rig: RigId, name: string, tMs: number, gateOnly: boolean, aim?: Aim): Pose {
  const c = findClip(rig, name, gateOnly);
  return poseOf(rig, c, tMs, aim === undefined ? NO_BEND : bendFor(rig, name, c, aim, gateOnly));
}

function clipInfo(rig: RigId, name: string, gateOnly: boolean): ClipInfo {
  const c = findClip(rig, name, gateOnly);
  return { durationMs: c.duration, loop: c.loop, events: c.events };
}

// ------------------------------------------------------------------------------- skeleton

interface Seg { parent: number; ox: number; oy: number; lx: number; ly: number }
/** Scrapper, 84 units: legs 38, torso 26, head 20. Feet at the origin, y grows downward. */
const S_SEGS: readonly Seg[] = [
  { parent: -1, ox: 0, oy: 0, lx: 0, ly: 0 },           // root
  { parent: 0, ox: 0, oy: -38, lx: 0, ly: 0 },          // pelvis
  { parent: 1, ox: 0, oy: 0, lx: 0, ly: -26 },          // torso
  { parent: 2, ox: 0, oy: -26, lx: 0, ly: -20 },        // head
  { parent: 2, ox: -1, oy: -23, lx: 0, ly: 14 },        // armB.up
  { parent: 4, ox: 0, oy: 14, lx: 0, ly: 13 },          // armB.lo
  { parent: 5, ox: 0, oy: 13, lx: 0, ly: 4 },           // handB
  { parent: 2, ox: 1, oy: -23, lx: 0, ly: 14 },         // armF.up
  { parent: 7, ox: 0, oy: 14, lx: 0, ly: 13 },          // armF.lo
  { parent: 8, ox: 0, oy: 13, lx: 0, ly: 4 },           // handF
  { parent: 1, ox: -1.5, oy: 0, lx: 0, ly: 19 },        // legB.up
  { parent: 10, ox: 0, oy: 19, lx: 0, ly: 19 },         // legB.lo
  { parent: 11, ox: 0, oy: 19, lx: 6, ly: 0 },          // footB
  { parent: 1, ox: 1.5, oy: 0, lx: 0, ly: 19 },         // legF.up
  { parent: 13, ox: 0, oy: 19, lx: 0, ly: 19 },         // legF.lo
  { parent: 14, ox: 0, oy: 19, lx: 6, ly: 0 },          // footF
];
const B = { root: 0, pelvis: 1, torso: 2, head: 3, armBup: 4, armBlo: 5, handB: 6, armFup: 7, armFlo: 8,
  handF: 9, legBup: 10, legBlo: 11, footB: 12, legFup: 13, legFlo: 14, footF: 15 } as const;

interface Joint { x: number; y: number; ex: number; ey: number; rot: number }
function turn(x: number, y: number, deg: number): [number, number] {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [x * c - y * s, x * s + y * c];
}
/** Forward kinematics in the figure's own space, then dropped so its lowest point is on the floor. */
function solve(segs: readonly Seg[], rot: readonly number[], pad: number): Joint[] {
  const out: Joint[] = [];
  let low = -Infinity;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    const p = seg.parent >= 0 ? out[seg.parent]! : { x: 0, y: 0, ex: 0, ey: 0, rot: 0 };
    const [ox, oy] = turn(seg.ox, seg.oy, p.rot);
    const r = p.rot + (rot[i] ?? 0);
    const [lx, ly] = turn(seg.lx, seg.ly, r);
    const j: Joint = { x: p.x + ox, y: p.y + oy, ex: p.x + ox + lx, ey: p.y + oy + ly, rot: r };
    out.push(j);
    if (i === 0) continue;                                 // the root is a point, not a body part
    if (j.y > low) low = j.y;
    if (j.ey > low) low = j.ey;
  }
  const dy = low + pad;
  for (const j of out) { j.y -= dy; j.ey -= dy; }
  return out;
}

/** Maps the figure's own space to stage units for one actor. */
function mapper(pose: Pose, at: Place, scale: number): (x: number, y: number) => [number, number] {
  return (x, y) => [
    at.x + at.facing * scale * pose.root.sx * (x + pose.root.x),
    at.y + scale * (pose.root.sy * y + pose.root.y),
  ];
}

// -------------------------------------------------------------------------------- drawing

const SKIN = ["#F2C9A0", "#E3A977", "#C98B5E", "#A86B45", "#8A5536", "#6B3F28", "#F6D7B8", "#D9A383"];
const HAIR = ["#2B2233", "#5A3A29", "#8C5A2B", "#C98B2E", "#D8D2C4", "#B2413A", "#3D4A7A", "#1E6F6A"];
const TOPS = ["#FF5A4E", "#22D3B6", "#FFD23F", "#4CC9F0", "#A78BFA", "#5BD66F", "#F4F5FA", "#FF9E3D",
  "#E86BA8", "#7FB7FF", "#B8E04A", "#C9CCE0"];
const BOTTOMS = ["#3E4A8A", "#4A4458", "#2F5D62", "#6A4A3A", "#555B7A"];
const COMPANION_FILL: Record<CompanionId, string> = { raccoon: "#8D93A8", goose: "#F4F5FA", boar: "#9A6B4F" };
const pickOf = (list: readonly string[], i: number | undefined): string => list[((i ?? 0) % list.length + list.length) % list.length]!;

function line(ctx: Ctx2D, x0: number, y0: number, x1: number, y1: number, width: number, colour: string): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 2.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}
function blob(ctx: Ctx2D, x: number, y: number, rx: number, ry: number, rotDeg: number, colour: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotDeg * DEG, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}
function shadow(ctx: Ctx2D, x: number, y: number, rx: number, lift: number): void {
  const shrink = 1 - (lift > 50 ? 50 : lift) / 80;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * shrink, rx * 0.26 * shrink, 0, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
}
/** A cheap stable number from 0 to 1 for cosmetic variation. */
function noise(seed: number, n: number): number {
  let h = (seed | 0) ^ Math.imul(n + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Bare hands for null and for "fists". */
function heldId(dress: Dress): HeldId { return dress.held ?? "fists"; }
/** 12 units plus 10 for each point of Reach (`placeholderLength`): 12 for a knife, 22 for a pipe,
 *  52 for a bike chain. */
function weaponLength(id: string): number {
  const meta = (WEAPON_META as Record<string, { reach: number } | undefined>)[id];
  return placeholderLength(meta === undefined ? 1 : meta.reach);
}
const GATE_HELD: ReadonlySet<string> = new Set(GATE_WEAPONS);
/** A weapon that bends is drawn in links, except as a gate-only stand-in: a straight bar. */
function isFlex(id: string, gateOnly: boolean): boolean {
  if (gateOnly && !GATE_HELD.has(id)) return false;
  return (WEAPON_META as Record<string, { flex?: true } | undefined>)[id]?.flex === true;
}
function isPair(id: string): boolean {
  return (WEAPON_META as Record<string, { pair?: true } | undefined>)[id]?.pair === true;
}
const FLEX_LINKS = 4;
const n2 = (v: number): string => String(Math.round(v * 100) / 100);
/** A weapon stand-in, or its last link, as an SVG path along +x from its start. The far point
 *  is the striking end. Straight lines only, so a test can read the points back. */
function tipPath(len: number, butt: number): string {
  return `M${n2(-butt)} -1.6L${n2(len - 4)} -1.6L${n2(len)} 0L${n2(len - 4)} 1.6L${n2(-butt)} 1.6Z`;
}
function linkPath(len: number): string {
  return `M0 -1.6L${n2(len)} -1.6L${n2(len)} 1.6L0 1.6Z`;
}
/** A held or flying item: its grip in stage units, one angle per link (degrees, in the actor's
 *  own frame, before mirroring), and its striking end in stage units. */
interface Held { id: string; x: number; y: number; angles: readonly number[]; link: number; tipX: number; tipY: number }
function heldAt(id: string, x: number, y: number, angle: number, trail: readonly number[] | undefined, facing: 1 | -1,
  gateOnly: boolean): Held {
  const len = weaponLength(id);
  const angles: number[] = [angle];
  if (isFlex(id, gateOnly)) for (let n = 1; n < FLEX_LINKS; n++) angles.push(trail === undefined ? angle : (trail[n - 1] ?? angle) + GRIP);
  const link = len / angles.length;
  let tx = 0;
  let ty = 0;
  for (const a of angles) { tx += link * Math.cos(a * DEG); ty += link * Math.sin(a * DEG); }
  return { id, x, y, angles, link, tipX: x + facing * tx, tipY: y + ty };
}
function drawHeld(env: DrawEnv, held: Held, flip: 1 | -1, colour: string): void {
  const ctx = env.ctx;
  ctx.save();
  ctx.translate(held.x, held.y);
  ctx.scale(flip, 1);                                     // its own size: no body scale here
  ctx.fillStyle = colour;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.lineJoin = "round";
  let cx = 0;
  let cy = 0;
  held.angles.forEach((a, n) => {
    const last = n === held.angles.length - 1;
    const path = env.path(last ? tipPath(held.link, n === 0 ? 3 : 0) : linkPath(held.link));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a * DEG);
    ctx.fill(path);
    ctx.stroke(path);
    ctx.restore();
    cx += held.link * Math.cos(a * DEG);
    cy += held.link * Math.sin(a * DEG);
  });
  ctx.restore();
}
function drawFace(ctx: Ctx2D, face: FaceId, cx: number, cy: number, f: 1 | -1, s: number, tint: boolean): void {
  if (tint) return;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2 * s;
  ctx.lineCap = "round";
  const ex = cx + f * 3.2 * s;
  for (const dx of [0, 4.4]) {
    ctx.beginPath();
    if (face === "dazed") {
      ctx.moveTo(ex + f * dx * s - s, cy - 2.6 * s); ctx.lineTo(ex + f * dx * s + s, cy - 0.6 * s);
      ctx.moveTo(ex + f * dx * s + s, cy - 2.6 * s); ctx.lineTo(ex + f * dx * s - s, cy - 0.6 * s);
      ctx.stroke();
    } else {
      ctx.arc(ex + f * dx * s, cy - 1.6 * s, 1.05 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const mx = cx + f * 5 * s;
  const my = cy + 3.6 * s;
  ctx.beginPath();
  if (face === "shout") { ctx.ellipse(mx, my, 2 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (face === "grin") { ctx.arc(mx, my - s, 2.6 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  else if (face === "grit") { ctx.moveTo(mx - 2.4 * s, my); ctx.lineTo(mx + 2.4 * s, my); ctx.moveTo(mx - 2.4 * s, my - 1.5 * s); ctx.lineTo(mx + 2.4 * s, my - 1.5 * s); ctx.stroke(); }
  else if (face === "dazed") { ctx.arc(mx, my + 1.4 * s, 2 * s, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  else { ctx.moveTo(mx - 2 * s, my); ctx.lineTo(mx + 2 * s, my); ctx.stroke(); }
}

/** Arm bones, back then front. `Dress.lead: "B"` swaps their angles for a pair. */
const ARM_SWAP: readonly (readonly [number, number])[] = [[B.armBup, B.armFup], [B.armBlo, B.armFlo], [B.handB, B.handF]];
/** One scrapper for one frame: the solved joints and the map to stage units. Drawing, the hand
 *  anchor, the strike point and the hit point all start here, so they cannot disagree. */
interface Figure { j: Joint[]; m: (x: number, y: number) => [number, number]; s: number; body: number; thick: number;
  /** Bone index of the hand that leads the clip, and of the other hand. */
  hand: number; off: number }
function figure(pose: Pose, dress: Dress, at: Place): Figure {
  const s = dress.scale > 0 ? dress.scale : 1;
  const build = ((dress.look?.build ?? 0) % 3 + 3) % 3;   // 0 lean, 1 stocky, 2 tall
  const thick = build === 1 ? 1.3 : 1;
  const tall = build === 2 ? 1.06 : build === 1 ? 0.97 : 1;
  const backLeads = dress.lead === "B" && isPair(heldId(dress));
  let rot = pose.rot;
  if (backLeads) {
    const swapped = [...pose.rot];
    for (const [b, f] of ARM_SWAP) { swapped[b] = pose.rot[f] ?? 0; swapped[f] = pose.rot[b] ?? 0; }
    rot = swapped;
  }
  return { j: solve(S_SEGS, rot, 2.6), m: mapper(pose, at, s * tall), s, body: s * tall, thick,
    hand: backLeads ? B.handB : B.handF, off: backLeads ? B.handF : B.handB };
}
/** What a hand of the figure holds, or null for an empty hand. Only the front hand has a past. */
function heldIn(fig: Figure, bone: number, pose: Pose, dress: Dress, facing: 1 | -1, gateOnly: boolean): Held | null {
  const id = heldId(dress);
  if (id === "fists") return null;
  const q = fig.j[bone]!;
  const [x, y] = fig.m(q.ex, q.ey);
  return heldAt(id, x, y, q.rot + GRIP, bone === B.handF ? pose.trail : undefined, facing, gateOnly);
}

const PROP_FILL: Record<MoveProp, string> = { can: "#5BD66F", whistle: "#FFD23F", horn: "#FF5A4E" };

function drawScrapper(env: DrawEnv, pose: Pose, dress: Dress, at: Place, gateOnly: boolean): void {
  const ctx = env.ctx;
  const f = at.facing;
  const tint = dress.tint === "white";
  const skin = tint ? WHITE : pickOf(SKIN, dress.look?.skin);
  const top = tint ? WHITE : pickOf(TOPS, dress.look?.palette);
  const bottom = tint ? WHITE : pickOf(BOTTOMS, dress.look?.bottom);
  const hair = tint ? WHITE : pickOf(HAIR, dress.look?.hairColor);
  const fig = figure(pose, dress, at);
  const { j, m, s, thick } = fig;
  const metal = tint ? WHITE : "#C9CCE0";
  const seg = (i: number, width: number, colour: string): void => {
    const q = j[i]!;
    const [x0, y0] = m(q.x, q.y);
    const [x1, y1] = m(q.ex, q.ey);
    line(ctx, x0, y0, x1, y1, width * s * thick, colour);
  };
  /** A hand with what it holds. A pair is in both hands; any other weapon is in the front hand. */
  const hand = (bone: number, radius: number): void => {
    const q = j[bone]!;
    const [hx, hy] = m(q.ex, q.ey);
    const held = bone === B.handF || isPair(heldId(dress)) ? heldIn(fig, bone, pose, dress, f, gateOnly) : null;
    if (held !== null) drawHeld(env, held, f, metal);
    if (bone === fig.off && dress.prop !== undefined) {
      if (gateOnly) warnOnce(`prop:${dress.prop}`, `no art for the Move prop "${dress.prop}"`);
      else {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.scale(f, 1);
        ctx.rotate((q.rot + GRIP) * DEG);
        ctx.fillStyle = tint ? WHITE : PROP_FILL[dress.prop];
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(-2.5, -8, 5, 9);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    blob(ctx, hx, hy, radius * s, radius * s, 0, skin);
  };

  shadow(ctx, at.x + f * fig.body * pose.root.x, at.y, 17 * s, pose.lift);

  // back limbs
  seg(B.legBup, 5.5, bottom); seg(B.legBlo, 5, bottom); seg(B.footB, 5.5, INK);
  seg(B.armBup, 4.6, top); seg(B.armBlo, 4.2, skin);
  if (dress.door) {
    const q = j[B.armBlo]!;
    const [dx, dy] = m(q.ex, q.ey);
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(f, 1);                                      // the door has its own size too
    ctx.rotate((q.rot + 8) * DEG);
    ctx.fillStyle = tint ? WHITE : "#7FB7FF";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.rect(-4, -26, DOOR_PLACEHOLDER.w, DOOR_PLACEHOLDER.h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tint ? WHITE : "#C9CCE0";
    ctx.beginPath();
    ctx.rect(0, -23, 14, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  hand(B.handB, 3.6);

  // torso and head
  seg(B.torso, 12, top);
  {
    const q = j[B.head]!;
    const [hx, hy] = m((q.x + q.ex) / 2, (q.y + q.ey) / 2);
    blob(ctx, hx, hy, 9.4 * s, 10 * s, 0, skin);
    const [tx, ty] = m(q.ex, q.ey);
    ctx.beginPath();
    ctx.ellipse((hx + tx) / 2 - f * 2 * s, (hy + ty) / 2 - 1.5 * s, 8 * s, 4.4 * s, f * (q.rot - 12) * DEG, 0, Math.PI * 2);
    ctx.fillStyle = hair;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    drawFace(ctx, pose.face, hx, hy, f, s, tint);
  }

  // front limbs
  seg(B.legFup, 5.5, bottom); seg(B.legFlo, 5, bottom); seg(B.footF, 5.5, INK);
  seg(B.armFup, 4.6, top); seg(B.armFlo, 4.2, skin);
  hand(B.handF, 3.8);
}

interface Beast { leg: number; rx: number; ry: number; head: number; neck: number; tail: number }
const BEASTS: Record<CompanionId, Beast> = {
  raccoon: { leg: 8, rx: 12, ry: 6.5, head: 5.5, neck: 0, tail: 13 },       // 26 units tall
  goose: { leg: 12, rx: 10, ry: 7, head: 4.2, neck: 12, tail: 6 },         // 40 units tall
  boar: { leg: 15, rx: 27, ry: 15, head: 11, neck: 0, tail: 8 },           // 52 tall, 70 long
};
/** One companion for one frame. Bones: root, body, head, legF, legB, tail. */
interface BeastFigure { b: Beast; j: Joint[]; m: (x: number, y: number) => [number, number]; s: number }
function beastFigure(id: CompanionId, pose: Pose, dress: Dress, at: Place): BeastFigure {
  const b = BEASTS[id];
  const s = dress.scale > 0 ? dress.scale : 1;
  const segs: Seg[] = [
    { parent: -1, ox: 0, oy: 0, lx: 0, ly: 0 },                                    // root
    { parent: 0, ox: 0, oy: -(b.leg + b.ry), lx: b.rx * 0.9, ly: -b.ry * 0.5 },    // body: centre to the neck
    { parent: 1, ox: b.rx * 0.9, oy: -b.ry * 0.5, lx: b.head * 0.6 + b.neck * 0.35, ly: -(b.head * 0.5 + b.neck) }, // head
    { parent: 1, ox: b.rx * 0.55, oy: b.ry * 0.7, lx: 0, ly: b.leg },              // legF
    { parent: 1, ox: -b.rx * 0.55, oy: b.ry * 0.7, lx: 0, ly: b.leg },             // legB
    { parent: 1, ox: -b.rx * 0.95, oy: -b.ry * 0.2, lx: -b.tail, ly: -b.tail * 0.5 }, // tail
  ];
  return { b, j: solve(segs, pose.rot, 1.6), m: mapper(pose, at, s), s };
}
/** The tip of the snout or the beak: what a companion strikes with. Stage units. */
function mouthOf(fig: BeastFigure, facing: 1 | -1): [number, number] {
  const head = fig.j[2]!;
  const [hx, hy] = fig.m(head.ex, head.ey);
  return [hx + facing * fig.b.head * 1.7 * fig.s, hy + fig.b.head * 0.2 * fig.s];
}
function drawCompanion(env: DrawEnv, id: CompanionId, pose: Pose, dress: Dress, at: Place): void {
  const ctx = env.ctx;
  const fig = beastFigure(id, pose, dress, at);
  const { b, j, m, s } = fig;
  const f = at.facing;
  const fill = dress.tint === "white" ? WHITE : COMPANION_FILL[id];
  const seg = (i: number, width: number, colour: string): void => {
    const q = j[i]!;
    const [x0, y0] = m(q.x, q.y);
    const [x1, y1] = m(q.ex, q.ey);
    line(ctx, x0, y0, x1, y1, width * s, colour);
  };
  shadow(ctx, at.x + f * s * pose.root.x, at.y, (b.rx + 4) * s, pose.lift);
  seg(5, id === "raccoon" ? 4 : 2.4, fill);
  seg(4, 3, fill);
  const body = j[1]!;
  const [bx, by] = m(body.x, body.y);
  blob(ctx, bx, by, b.rx * s, b.ry * s * pose.root.sy, f * body.rot, fill);
  seg(3, 3, fill);
  if (b.neck > 0) seg(2, 3.4, fill);
  const head = j[2]!;
  const [hx, hy] = m(head.ex, head.ey);
  blob(ctx, hx, hy, b.head * s, b.head * 0.9 * s, 0, fill);
  // snout or beak, then one eye
  const [mx, my] = mouthOf(fig, f);
  ctx.beginPath();
  ctx.moveTo(hx + f * b.head * 0.7 * s, hy - b.head * 0.25 * s);
  ctx.lineTo(mx, my);
  ctx.lineTo(hx + f * b.head * 0.7 * s, hy + b.head * 0.55 * s);
  ctx.closePath();
  ctx.fillStyle = dress.tint === "white" ? WHITE : id === "goose" ? "#FF9E3D" : "#4A4458";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (dress.tint !== "white") {
    const ex = hx + f * b.head * 0.25 * s;
    const ey = hy - b.head * 0.2 * s;
    const r = 0.9 * s + b.head * 0.04;
    ctx.beginPath();
    if (pose.face === "dazed") {
      ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    } else {
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }
}

function drawActor(env: DrawEnv, pose: Pose, dress: Dress, at: Place, gateOnly: boolean): void {
  if (pose.rig === "scrapper") drawScrapper(env, pose, dress, at, gateOnly);
  else drawCompanion(env, pose.rig, pose, dress, at);
}

function handAnchor(pose: Pose, dress: Dress, at: Place): { x: number; y: number; rot: number } {
  if (pose.rig !== "scrapper") {
    const [x, y] = mouthOf(beastFigure(pose.rig, pose, dress, at), at.facing);
    return { x, y, rot: 0 };
  }
  const fig = figure(pose, dress, at);
  const q = fig.j[fig.hand]!;
  const [x, y] = fig.m(q.ex, q.ey);
  return { x, y, rot: q.rot + GRIP };
}

const HOME: Place = { x: 0, y: 0, facing: 1 };

/** The striking end of a pose of the named clip, as an offset from the actor's place. */
function strikeEnd(rig: RigId, clip: string, pose: Pose, dress: Dress, gateOnly: boolean): Offset {
  if (rig !== "scrapper" || pose.rig !== "scrapper") {
    const [x, y] = mouthOf(beastFigure(pose.rig as CompanionId, pose, dress, HOME), 1);
    return { x, y };
  }
  const fig = figure(pose, dress, HOME);
  const held = clip === "throw" ? null : heldIn(fig, fig.hand, pose, dress, 1, gateOnly);
  if (held !== null) return { x: held.tipX, y: held.tipY };
  const q = fig.j[fig.hand]!;
  const [x, y] = fig.m(q.ex, q.ey);                        // the fist, or the hand a throw leaves
  return { x, y };
}

/** Where the striking end is at the strike time of a clip, as an offset from the actor's place,
 *  bent toward `aimY` when one is given. */
function strikePoint(rig: RigId, clip: string, dress: Dress, gateOnly: boolean, aimY?: number): Offset {
  const aim = aimY === undefined ? undefined : { y: aimY, dress };
  const pose = samplePose(rig, clip, strikeTime(clipInfo(rig, clip, gateOnly)) ?? 0, gateOnly, aim);
  return strikeEnd(rig, clip, pose, dress, gateOnly);
}

/** The middle of the head or of the body of a standing actor, as an offset from its place. */
function hitPoint(rig: RigId, dress: Dress, zone: "head" | "body", gateOnly: boolean): Offset {
  const pose = samplePose(rig, "idle", 0, gateOnly);
  if (pose.rig !== "scrapper") {
    const fig = beastFigure(pose.rig, pose, dress, HOME);
    const q = fig.j[zone === "head" ? 2 : 1]!;
    // The head blob is at the end of the head bone. The body bone runs from the middle of the
    // body to the neck, so its middle is the middle of the front half.
    const [x, y] = zone === "head" ? fig.m(q.ex, q.ey) : fig.m((q.x + q.ex) / 2, (q.y + q.ey) / 2);
    return { x, y };
  }
  const fig = figure(pose, dress, HOME);
  const q = fig.j[zone === "head" ? B.head : B.torso]!;
  const [x, y] = fig.m((q.x + q.ex) / 2, (q.y + q.ey) / 2);
  return { x, y };
}

function drawProp(env: DrawEnv, item: PropId, at: Place & { rot: number }, gateOnly: boolean): void {
  const ctx = env.ctx;
  if (item === "car-door") {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.scale(at.facing, 1);
    ctx.rotate(at.rot * DEG);
    ctx.fillStyle = "#7FB7FF";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.rect(-4, -26, DOOR_PLACEHOLDER.w, DOOR_PLACEHOLDER.h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#C9CCE0";
    ctx.beginPath();
    ctx.rect(0, -23, 14, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  // The grip is at the given point. A weapon that bends lies straight when no hand holds it.
  drawHeld(env, heldAt(item, at.x, at.y, at.rot, undefined, at.facing, gateOnly), at.facing, "#C9CCE0");
}

/** The five arenas as flat blocks: wall on the top 46%, floor on the bottom 54% of the
 *  360 x 240 stage. Same geometry in all five; only the colours and the wall pattern differ. */
interface ArenaLook { wall: string; trim: string; floor: string; mark: string; crowd: string; doors: number }
const ARENAS: Record<StageId, ArenaLook> = {
  "yard":       { wall: "#23264F", trim: "#343977", floor: "#3A3F7A", mark: "#F4F5FA", crowd: INK, doors: 82 },
  "yard-night": { wall: "#10122B", trim: "#262A57", floor: "#1D2046", mark: "#7FB7FF", crowd: "#05060F", doors: 82 },
  "rooftop":    { wall: "#F2A65A", trim: "#C9743A", floor: "#8C6A5A", mark: "#FFE9C7", crowd: "#4A2E2A", doors: 120 },
  "backyard":   { wall: "#8FD3F4", trim: "#5BA86B", floor: "#6DBE6F", mark: "#F4F5FA", crowd: "#2F5D3A", doors: 60 },
  "gym":        { wall: "#D9C7A3", trim: "#B08D57", floor: "#C99A5B", mark: "#B2413A", crowd: "#3D2F22", doors: 45 },
};
function drawStage(env: DrawEnv, stage: StageId, layer: "back" | "floor", crowdBounce: number, gateOnly: boolean): void {
  let look: ArenaLook | undefined = Object.prototype.hasOwnProperty.call(ARENAS, stage) ? ARENAS[stage] : undefined;
  if (look === undefined || (gateOnly && stage !== "yard")) {
    warnOnce(`stage:${String(stage)}`, `no arena art for "${String(stage)}", drawing the yard`);
    look = ARENAS.yard;
  }
  const ctx = env.ctx;
  if (layer === "back") {
    ctx.fillStyle = look.wall;
    ctx.fillRect(0, 0, 360, 110.4);
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 1;
    for (let x = 30; x < 360; x += look.doors) {         // shutter doors, fence boards or wall bars
      ctx.strokeRect(x, 34, look.doors - 26, 76.4);
      for (let y = 44; y < 110; y += 10) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + look.doors - 26, y); ctx.stroke(); }
    }
    const up = (crowdBounce < 0 ? 0 : crowdBounce > 1 ? 1 : crowdBounce) * 3;
    ctx.fillStyle = look.crowd;
    for (const x of [112, 150, 214, 252]) {              // four crowd silhouettes
      ctx.beginPath();
      ctx.ellipse(x, 101 - up, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 9, 106 - up, 18, 5);
    }
    return;
  }
  ctx.fillStyle = look.floor;
  ctx.fillRect(0, 110.4, 360, 129.6);
  ctx.strokeStyle = look.mark;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(180, 190, 34, 14, 0, 0, Math.PI * 2);      // the painted "0" ring
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 160); ctx.lineTo(360, 160);
  ctx.moveTo(180, 110.4); ctx.lineTo(180, 240);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 110.4); ctx.lineTo(360, 110.4);
  ctx.stroke();
}

function star(points: number, r0: number, r1: number): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? r1 : r0;
    const a = (i * Math.PI) / points - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  }
  return `${d}Z`;
}
const STAR = star(7, 6, 13);
const PLUS = "M-1 -3H1V-1H3V1H1V3H-1V1H-3V-1H-1Z";

const GATE_FX: ReadonlySet<string> = new Set(["burst", "dust", "spark", "whoosh"]);

function drawFx(env: DrawEnv, fx: FxKind, progress: number, at: Place, seed: number, gateOnly: boolean): void {
  if (gateOnly && !GATE_FX.has(fx)) {
    warnOnce(`fx:${String(fx)}`, `no effect art for "${String(fx)}"`);
    return;
  }
  const ctx = env.ctx;
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const fade = 1 - p;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (fx) {
    case "burst": {
      ctx.rotate(noise(seed, 0) * Math.PI);
      ctx.scale(0.5 + p * 0.9, 0.5 + p * 0.9);
      ctx.globalAlpha = fade;
      const s = env.path(STAR);
      ctx.fillStyle = "#FFD23F";
      ctx.fill(s);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke(s);
      break;
    }
    case "dust": {
      ctx.globalAlpha = 0.8 * fade;
      for (let i = 0; i < 3; i++) blob(ctx, at.facing * (-6 - i * 7 - p * 10), -3 - i * 2 - p * 6 * noise(seed, i), 4 + p * 4, 3 + p * 3, 0, "#C9CCE0");
      break;
    }
    case "spark": {
      ctx.globalAlpha = fade;
      ctx.strokeStyle = "#FFD23F";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = noise(seed, i) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (3 + p * 8), Math.sin(a) * (3 + p * 8));
        ctx.lineTo(Math.cos(a) * (8 + p * 14), Math.sin(a) * (8 + p * 14));
        ctx.stroke();
      }
      break;
    }
    case "whoosh":
    case "trail": {
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = fx === "trail" ? "#FFD23F" : "#F4F5FA";
      ctx.lineWidth = fx === "trail" ? 7 : 3;
      ctx.scale(at.facing, 1);
      ctx.beginPath();
      ctx.arc(-6, -6, 26, -0.45 * Math.PI, (-0.45 + 0.7 * (0.3 + p * 0.7)) * Math.PI);
      ctx.stroke();
      break;
    }
    case "tarp": {
      ctx.globalAlpha = 0.92;
      const wob = Math.sin(p * Math.PI * 6 + noise(seed, 1) * 6) * 2;
      ctx.fillStyle = "#4CC9F0";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.quadraticCurveTo(-22 + wob, -58, 0, -62 + wob);
      ctx.quadraticCurveTo(22 - wob, -58, 24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "tape": {
      for (let i = 0; i < 40; i++) {                      // ticket tape over the whole stage
        const x = noise(seed, i) * 360 - at.x;
        const y = -at.y + (noise(seed, i + 100) * 0.5 + p * (0.7 + noise(seed, i + 200))) * 240;
        ctx.fillStyle = pickOf(TOPS, i);
        ctx.fillRect(x, y, 2.5, 6);
      }
      break;
    }
    case "crackers": {
      ctx.globalAlpha = fade;
      for (let i = 0; i < 5; i++) {
        const a = noise(seed, i) * Math.PI * 2;
        const r = 6 + noise(seed, i + 9) * 16 * p;
        blob(ctx, Math.cos(a) * r, Math.sin(a) * r - 20, 2 + 3 * p, 2 + 3 * p, 0, i % 2 === 0 ? "#FF5A4E" : "#FFD23F");
      }
      break;
    }
    case "rings": {
      ctx.strokeStyle = "#F4F5FA";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const q = p - i * 0.18;
        if (q <= 0) continue;
        ctx.globalAlpha = (1 - q) > 0 ? 1 - q : 0;
        ctx.beginPath();
        ctx.arc(0, 0, 6 + q * 40, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "plus": {
      ctx.globalAlpha = fade;
      const plus = env.path(PLUS);
      ctx.fillStyle = "#22D3B6";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + noise(seed, 3);
        ctx.save();
        ctx.translate(Math.cos(a) * 16, Math.sin(a) * 8 - 30 - p * 14);
        ctx.fill(plus);
        ctx.restore();
      }
      break;
    }
    default:
      warnOnce(`fx:${String(fx)}`, `no effect art for "${String(fx)}"`);
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------- SVG pieces

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

function portrait(look: Look): SvgArt {
  return {
    viewBox: "0 0 48 48",
    parts: [
      { d: circle(24, 24, 22), fill: "#262A57", stroke: INK, strokeWidth: 2 },
      { d: "M8 46C8 34 16 30 24 30C32 30 40 34 40 46Z", fill: pickOf(TOPS, look.palette), stroke: INK, strokeWidth: 2 },
      { d: circle(24, 20, 9.5), fill: pickOf(SKIN, look.skin), stroke: INK, strokeWidth: 2 },
      { d: "M14.5 18C15 11 20 9 24 9C28 9 33 11 33.5 18C29 15 19 15 14.5 18Z", fill: pickOf(HAIR, look.hairColor), stroke: INK, strokeWidth: 1.5 },
      { d: `${circle(21, 20, 1)}${circle(27, 20, 1)}`, fill: INK },
    ],
  };
}
function companionPortrait(id: CompanionId): SvgArt {
  return {
    viewBox: "0 0 48 48",
    parts: [
      { d: circle(24, 24, 22), fill: "#262A57", stroke: INK, strokeWidth: 2 },
      { d: "M10 30C10 22 18 19 26 19C34 19 39 23 39 30C39 36 32 38 24 38C16 38 10 36 10 30Z", fill: COMPANION_FILL[id], stroke: INK, strokeWidth: 2 },
      { d: circle(33, 22, 1.3), fill: INK },
    ],
  };
}
/** Every icon is the plain ring the contract promises for missing art. */
function icon(ref: IconRef): SvgArt {
  void ref;
  return { viewBox: "0 0 24 24", parts: [{ d: circle(12, 12, 8), fill: "none", stroke: "#C9CCE0", strokeWidth: 2 }] };
}

function makeRig(gateOnly: boolean): Rig {
  return {
    clipInfo: (rig, clip) => clipInfo(rig, clip, gateOnly),
    samplePose: (rig, clip, tMs, aim) => samplePose(rig, clip, tMs, gateOnly, aim),
    drawActor: (env, pose, dress, at) => drawActor(env, pose, dress, at, gateOnly),
    handAnchor,
    drawProp: (env, item, at) => drawProp(env, item, at, gateOnly),
    drawStage: (env, stage, layer, crowdBounce) => drawStage(env, stage, layer, crowdBounce, gateOnly),
    strikePoint: (rig, clip, dress, aimY) => strikePoint(rig, clip, dress, gateOnly, aimY),
    hitPoint: (rig, dress, zone) => hitPoint(rig, dress, zone, gateOnly),
    drawFx: (env, fx, progress, at, seed) => drawFx(env, fx, progress, at, seed, gateOnly),
    portrait, companionPortrait, icon,
  };
}

/** The full double: all 23 scrapper clips, five arenas, every effect, the Move props. */
export const capsuleRig: Rig = makeRig(false);
/** The double as a gate-pack rig would behave: content clips answer with their gate clip
 *  (`CLIP_FALLBACK`), every arena draws the yard, content effects and Move props draw nothing. */
export const capsuleGateRig: Rig = makeRig(true);

/** The clip names the capsule rig holds, for tests: all 23 scrapper clips and the 6 companion clips. */
export const CAPSULE_CLIPS = { scrapper: SCRAPPER_CLIPS, companion: COMPANION_CLIPS, gate: GATE_CLIPS } as const;
/** Weapon length in the capsule double, for tests: 12 + 10 x Reach units. */
export function capsuleWeaponLength(id: HeldId | PropId): number { return id === "fists" || id === "car-door" ? 0 : weaponLength(id); }
