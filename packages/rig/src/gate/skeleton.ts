/**
 * The scrapper skeleton: adult proportions, about 7.3 heads in 84 units (style 13).
 *
 * Every body part is its own piece on its own bone and turns on a pin (owner amendment 13.2):
 * pelvis, torso, head, both upper arms, forearms and hands, both thighs, shins and feet. One more
 * bone, `held`, is the hand's grip: the held item is its child and turns with the wrist; and
 * `hair` hangs from the crown and is moved only by secondary motion (`SECONDARY`). Both come
 * after the 16 bones of the contract, so their indices are the contract's.
 *
 * Units are stage units (a standing scrapper is 84 tall, feet at y 0, y down, facing +x). At rest
 * the figure stands straight with the arms hanging; every limb bone then points along +y.
 *
 * Sign rules (degrees, clockwise on screen is positive):
 *  - torso and head: positive leans forward;
 *  - an upper arm or a thigh: negative swings it forward;
 *  - an elbow (`arm*.lo`) only bends negative (the forearm comes forward and up);
 *  - a knee (`leg*.lo`) only bends positive (the shin goes back).
 * The limits below are checked on every sampled frame of every clip by a rig test.
 */
import type { BoneDef, RigDef } from "../contracts";

/** Source drawings (`.review/style-sampler`) are in units of a 182-unit man; this maps them to 84. */
export const K = 0.46;

/** The proportions in one settings object, so a proportion change is a change here only. */
export const PROPORTION = {
  heads: 7.3,
  hip: 44.85,              // hip joint centre above the floor, legs straight
  thigh: 21.16,
  shin: 20.24,
  ankle: 3.22,             // ankle above the sole
  torso: 24.38,            // hip centre to the neck base
  upperArm: 14.26,
  forearm: 12.42,
  grip: 3.0,               // wrist to the middle of the fist
  shoulderF: [0.46, -21.39] as const,
  shoulderB: [-1.38, -21.85] as const,
  hipF: [0.92, 0.46] as const,
  hipB: [-1.15, 0] as const,
  neck: [0.23, -24.38] as const,
} as const;

export const BONE = {
  root: 0, pelvis: 1, torso: 2, head: 3, armBup: 4, armBlo: 5, handB: 6, armFup: 7, armFlo: 8, handF: 9,
  legBup: 10, legBlo: 11, footB: 12, legFup: 13, legFlo: 14, footF: 15, held: 16, hair: 17, stow: 18,
} as const;

/**
 * The stow channel (review round 2, 16 Nov 2026): bone `stow` draws nothing; a clip whose hands
 * go to the head (the Move reactions: ears, rub-eyes, angry, snared) keys it to `STOW.on`. It is
 * a bone angle, not a flag, so it lives in the pose data and the stage's crossfade blends it like
 * any joint: over the crossfade into such a clip it turns from 0 to `on`, and back at the end.
 * That turn IS the put-away motion: the rig moves the held item from the hand to where it is
 * kept (a short one-hand item at the front hip, a long or two-hand one slung on the back, a
 * bulky one set down on the floor) as the channel goes from 0 to `away` of `on`, so the item
 * has left the hand before the hands are up at the head, and no blade, tine or sign goes through
 * the face. `on` is a wide angle on purpose: the stage gives a bigger gap a longer crossfade, so
 * the put-away always gets the longest one and is a motion a viewer sees, never a jump.
 */
export const STOW = { on: 52, away: 0.9 } as const;
/** Items worn on the hands, never put away (they sit on the fists at the ears). */
export const WORN_ITEMS: readonly string[] = ["knuckle-dusters"];
/** How far this pose's held item is put away: 0 in the hand, 1 the channel fully on. */
export const stowAmount = (rot: readonly number[]): number => Math.min(1, Math.max(0, (rot[BONE.stow] ?? 0) / STOW.on));
/** Is this pose's held item out of the hand? */
export const isStowed = (rot: readonly number[]): boolean => stowAmount(rot) > 1e-4;

/** Where the hair hinges on the head (the back of the crown), in the head bone's frame. */
export const HAIR_PIVOT = [-1.4, -12.6] as const;

const P = PROPORTION;
const bones: BoneDef[] = [
  { id: "root", parent: -1, x: 0, y: 0 },
  { id: "pelvis", parent: 0, x: 0, y: -P.hip },
  { id: "torso", parent: 1, x: 0, y: 0, limit: [-70, 115] },
  { id: "head", parent: 2, x: P.neck[0], y: P.neck[1], limit: [-65, 60] },
  { id: "armB.up", parent: 2, x: P.shoulderB[0], y: P.shoulderB[1] },
  { id: "armB.lo", parent: 4, x: 0, y: P.upperArm, limit: [-160, 2] },
  { id: "handB", parent: 5, x: 0, y: P.forearm, limit: [-95, 95] },
  { id: "armF.up", parent: 2, x: P.shoulderF[0], y: P.shoulderF[1] },
  { id: "armF.lo", parent: 7, x: 0, y: P.upperArm, limit: [-160, 2] },
  { id: "handF", parent: 8, x: 0, y: P.forearm, limit: [-95, 95] },
  { id: "legB.up", parent: 1, x: P.hipB[0], y: P.hipB[1], limit: [-130, 60] },
  { id: "legB.lo", parent: 10, x: 0, y: P.thigh, limit: [-2, 160] },
  { id: "footB", parent: 11, x: 0, y: P.shin, limit: [-60, 70] },
  { id: "legF.up", parent: 1, x: P.hipF[0], y: P.hipF[1], limit: [-130, 60] },
  { id: "legF.lo", parent: 13, x: 0, y: P.thigh, limit: [-2, 160] },
  { id: "footF", parent: 14, x: 0, y: P.shin, limit: [-60, 70] },
  { id: "held", parent: 9, x: 0, y: P.grip },
  { id: "hair", parent: 3, x: -1.4, y: -12.6, limit: [-40, 40] },
  { id: "stow", parent: 1, x: 0, y: 0 },
];

/**
 * Secondary motion: bones no clip keys, driven by the motion of their parent (hair flicks back
 * when the head snaps, trails when the body runs). `gain` turns the parent's change of angle over
 * the last `ms` into this bone's angle, `drag` is degrees per unit of forward travel in that
 * time; the result is held inside `limit`. A pure function of t like everything else.
 */
export const SECONDARY = [{ bone: "hair", gain: 0.85, drag: 2.2, ms: 70 }] as const;

/** The scrapper rig of the gate pack. */
export const SCRAPPER_RIG: RigDef = { id: "scrapper", height: 84, bones };

/** Elbows and knees: the joints that may bend one way only. */
export const ONE_WAY_JOINTS = ["armB.lo", "armF.lo", "legB.lo", "legF.lo"] as const;

/**
 * Three builds from the same rig. `scale` sizes the whole body; `limb` and `torso` widen the
 * limbs and the trunk across their bones (lengths never change, so every clip fits every build).
 */
export const BUILDS = [
  { scale: 1, limb: 1, torso: 1 },          // lean
  { scale: 1.03, limb: 1.24, torso: 1.27 }, // stocky
  { scale: 1.08, limb: 0.94, torso: 0.96 }, // tall
] as const;

/** A hand's grip turns the held item this far from the hand bone: with the arm hanging, an item
 *  in the fist points forward and a little up (the thumb side of a relaxed fist faces forward). */
export const GRIP_ROT = -10;

/**
 * A real body's range, read in the side view (degrees as in the sign rules above). Checked on
 * every 60 fps frame of every clip by `test/gate/anatomy.test.ts`; the clip kit refuses a key
 * that breaks them (owner, 15 Nov 2026: "animations aren't realistic, arms are twisting").
 *  - reach: a wrist target is at most 95% of shoulder-to-wrist length away (an arm is never
 *    pulled dead straight by IK; a punch moves the body in instead); a leg at most 99%;
 *  - wrist: the hand against the forearm, -70 to +80 (flexion and extension of a real wrist);
 *  - shoulder: the upper arm against the torso, from past overhead (-185) to 65 behind the back
 *    (the most a shoulder extends, seen from the side);
 *  - turnPerFrame: a forearm or a hand turns at most 25 degrees in one 60 fps frame (1500 deg/s,
 *    the top of a real fast strike); `aimTurn` more when a strike is bent to a target at the far
 *    ends of the height range (the bend adds its own turn on top of the clip's);
 *  - the trunk: a hand or forearm never inside the back part of the chest (half depth 5.5).
 */
export const ANATOMY = {
  reach: 0.95,
  legReach: 0.99,
  wrist: [-70, 80] as const,
  shoulder: [-185, 65] as const,
  turnPerFrame: 25,
  aimTurn: 2,
  trunkHalfDepth: 5.5,
  trunkCore: 0.35,
  headRadius: 4,
} as const;

/** The foot bones: what "feet on the floor" is measured on. */
export const FEET = ["footB", "footF"] as const;
