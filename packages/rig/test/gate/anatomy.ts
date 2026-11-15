/**
 * Anatomy measures for the scrapper clips: the numbers behind "the arms twist" (owner, 15 Nov
 * 2026). Each measure reads poses the way the picture is drawn (figure space, facing +x, y down)
 * and returns the frames that break a real human body's range. Used by `anatomy.test.ts` and by
 * the before/after report; the limits are `ANATOMY` in `gate/skeleton.ts`.
 */
import type { Pose } from "../../src/contracts";
import { frames, modelOf, worldAngles } from "../../src/engine/pose";
import { ANATOMY, BONE, SCRAPPER_RIG } from "../../src/gate/skeleton";
import { HEAD_CENTRE } from "../../src/gate/parts";

const model = modelOf(SCRAPPER_RIG);
const B = SCRAPPER_RIG.bones;
const len = (i: number): number => Math.hypot(B[i]!.x, B[i]!.y);

export type Side = "F" | "B";
export const ARMS: readonly { side: Side; up: number; lo: number; hand: number }[] = [
  { side: "F", up: BONE.armFup, lo: BONE.armFlo, hand: BONE.handF },
  { side: "B", up: BONE.armBup, lo: BONE.armBlo, hand: BONE.handB },
];
export const LEGS: readonly { side: Side; up: number; lo: number; foot: number }[] = [
  { side: "F", up: BONE.legFup, lo: BONE.legFlo, foot: BONE.footF },
  { side: "B", up: BONE.legBup, lo: BONE.legBlo, foot: BONE.footB },
];

/** One frame, measured. */
export interface Frame {
  /** Elbow and knee bends (local angle of the lower bone), by side. */
  elbow: Record<Side, number>;
  knee: Record<Side, number>;
  /** Shoulder-to-wrist and hip-to-ankle distance as a share of the limb's full length. */
  armReach: Record<Side, number>;
  legReach: Record<Side, number>;
  /** Upper arm against the torso (negative = forward), the hand against the forearm. */
  shoulder: Record<Side, number>;
  wrist: Record<Side, number>;
  /** World angles, for per-frame turn rates. */
  upperW: Record<Side, number>;
  foreW: Record<Side, number>;
  handW: Record<Side, number>;
  /** Hand or forearm points inside the back half of the trunk, by side (count of points). */
  inTrunk: Record<Side, number>;
  /** Held item (front hand) points inside the head, and inside the middle of the trunk. */
  itemInHead: number;
  itemInTrunk: number;
}

/** Point in a frame `(origin, axis)` as along / across (across > 0 = in front of the body). */
function local(px: number, py: number, ox: number, oy: number, ax: number, ay: number): [number, number] {
  const l = Math.hypot(ax, ay) || 1;
  const ux = ax / l;
  const uy = ay / l;
  const dx = px - ox;
  const dy = py - oy;
  // along the axis, and across: the axis turned a quarter clockwise points to the front (+x at rest
  // the trunk axis is up, (0,-1); turned clockwise on screen it is (+1, 0), the front)
  return [dx * ux + dy * uy, dx * -uy + dy * ux];
}

/** Measures one pose. `itemLen` is the held item's grip-to-tip length (0 for fists). */
export function measure(p: Pose, itemLen = 0, itemGripRot = 0): Frame {
  const rot = p.rot;
  const fr = frames(model, rot, p.root.x, p.root.y);
  const wa = worldAngles(model, rot);
  const J = (i: number): [number, number] => [fr[i]!.e, fr[i]!.f];
  const rec = <T>(f: (s: Side) => T): Record<Side, T> => ({ F: f("F"), B: f("B") });
  const arm = (s: Side) => ARMS.find((a) => a.side === s)!;
  const leg = (s: Side) => LEGS.find((a) => a.side === s)!;
  const reach = (a: number, b: number, c: number, l1: number, l2: number): number => {
    const [ax, ay] = J(a);
    const [cx, cy] = J(c);
    void b;
    return Math.hypot(cx - ax, cy - ay) / (l1 + l2);
  };
  // the trunk: hip centre (pelvis joint) to the neck (head joint)
  const [hx, hy] = J(BONE.pelvis);
  const [nx, ny] = J(BONE.head);
  const trunkLen = Math.hypot(nx - hx, ny - hy);
  const R = ANATOMY.trunkHalfDepth;
  const inTrunk = (s: Side): number => {
    const a = arm(s);
    const [ex, ey] = J(a.lo);
    const [wx, wy] = J(a.hand);
    const pts: [number, number][] = [];
    for (let k = 1; k <= 4; k++) pts.push([ex + ((wx - ex) * k) / 4, ey + ((wy - ey) * k) / 4]);
    let n = 0;
    for (const [px, py] of pts) {
      const [along, across] = local(px, py, hx, hy, nx - hx, ny - hy);
      if (along > 2 && along < trunkLen - 1 && across < -ANATOMY.trunkCore * R && across > -0.92 * R) n++;
    }
    return n;
  };
  let itemInHead = 0;
  let itemInTrunk = 0;
  if (itemLen > 0) {
    const g = fr[BONE.held]!;
    const ang = (wa[BONE.held]! + itemGripRot) * (Math.PI / 180);
    const hc = fr[BONE.head]!;
    const cx = hc.a * HEAD_CENTRE[0] + hc.c * HEAD_CENTRE[1] + hc.e;
    const cy = hc.b * HEAD_CENTRE[0] + hc.d * HEAD_CENTRE[1] + hc.f;
    for (let k = 0; k <= 8; k++) {
      const px = g.e + Math.cos(ang) * (itemLen * k) / 8;
      const py = g.f + Math.sin(ang) * (itemLen * k) / 8;
      if (Math.hypot(px - cx, py - cy) < ANATOMY.headRadius) itemInHead++;
      const [along, across] = local(px, py, hx, hy, nx - hx, ny - hy);
      if (k > 1 && along > 2 && along < trunkLen - 2 && Math.abs(across) < 0.6 * R) itemInTrunk++;
    }
  }
  return {
    elbow: rec((s) => rot[arm(s).lo]!),
    knee: rec((s) => rot[leg(s).lo]!),
    armReach: rec((s) => reach(arm(s).up, arm(s).lo, arm(s).hand, len(arm(s).lo), len(arm(s).hand))),
    legReach: rec((s) => reach(leg(s).up, leg(s).lo, leg(s).foot, len(leg(s).lo), len(leg(s).foot))),
    shoulder: rec((s) => wrapTo(rot[arm(s).up]!, -200)),
    wrist: rec((s) => wrapTo(rot[arm(s).hand]!, -180)),
    upperW: rec((s) => wa[arm(s).up]!),
    foreW: rec((s) => wa[arm(s).lo]!),
    handW: rec((s) => wa[arm(s).hand]!),
    inTrunk: rec(inTrunk),
    itemInHead,
    itemInTrunk,
  };
}

/** `a` turned by whole turns into [lo, lo + 360). */
export const wrapTo = (a: number, lo: number): number => ((((a - lo) % 360) + 360) % 360) + lo;

/** Shortest signed turn from a to b, degrees. */
export const turn = (a: number, b: number): number => {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export interface Report {
  /** Elbow or knee bend changing side between neighbouring frames (both beyond 3 degrees). */
  bendFlips: number;
  /** Frames where an elbow or knee bends the wrong way at all (beyond 3 degrees). */
  wrongBend: number;
  /** Highest reach share, and frames over the 95% line (arms; legs separately). */
  armReachMax: number;
  armOverReach: number;
  legReachMax: number;
  legOverReach: number;
  /** Fastest forearm and hand turn in one 60 fps frame (world), and frames over the limit. */
  foreTurnMax: number;
  handTurnMax: number;
  fastTurns: number;
  /** Wrist outside its range: frames, and the worst angle. */
  wristOut: number;
  wristWorst: number;
  /** Upper arm outside the shoulder's range (behind the back, or past overhead). */
  shoulderOut: number;
  shoulderWorst: number;
  /** Frames with the near (front) forearm inside the back of the trunk, or the held item
   *  through the middle of the trunk (the far arm is drawn behind the body and may cross it). */
  throughTrunk: number;
  /** Frames with the held item through the head. */
  itemThroughHead: number;
}

export function report(fs: readonly Frame[]): Report {
  const r: Report = { bendFlips: 0, wrongBend: 0, armReachMax: 0, armOverReach: 0, legReachMax: 0, legOverReach: 0,
    foreTurnMax: 0, handTurnMax: 0, fastTurns: 0, wristOut: 0, wristWorst: 0, shoulderOut: 0, shoulderWorst: 0,
    throughTrunk: 0, itemThroughHead: 0 };
  const A = ANATOMY;
  fs.forEach((f, i) => {
    const sides: Side[] = ["F", "B"];
    let wrong = false;
    for (const s of sides) {
      if (f.elbow[s] > 3) wrong = true;
      if (f.knee[s] < -3) wrong = true;
    }
    if (wrong) r.wrongBend++;
    let over = false;
    let lover = false;
    let wOut = false;
    let sOut = false;
    for (const s of sides) {
      r.armReachMax = Math.max(r.armReachMax, f.armReach[s]);
      r.legReachMax = Math.max(r.legReachMax, f.legReach[s]);
      if (f.armReach[s] > A.reach + 1e-3) over = true;
      if (f.legReach[s] > A.legReach + 1e-3) lover = true;
      const w = f.wrist[s];
      if (w < A.wrist[0] || w > A.wrist[1]) { wOut = true; if (Math.abs(w) > Math.abs(r.wristWorst)) r.wristWorst = w; }
      const sh = f.shoulder[s];
      if (sh < A.shoulder[0] || sh > A.shoulder[1]) { sOut = true; if (Math.abs(sh) > Math.abs(r.shoulderWorst)) r.shoulderWorst = sh; }
    }
    if (over) r.armOverReach++;
    if (lover) r.legOverReach++;
    if (wOut) r.wristOut++;
    if (sOut) r.shoulderOut++;
    if (f.inTrunk.F > 0 || f.itemInTrunk > 0) r.throughTrunk++;
    if (f.itemInHead > 0) r.itemThroughHead++;
    if (i === 0) return;
    const g = fs[i - 1]!;
    let fast = false;
    for (const s of sides) {
      const flip = (a: number, b: number): boolean => (a > 3 && b < -3) || (a < -3 && b > 3);
      if (flip(g.elbow[s], f.elbow[s]) || flip(g.knee[s], f.knee[s])) r.bendFlips++;
      const ft = Math.abs(turn(g.foreW[s], f.foreW[s]));
      const ht = Math.abs(turn(g.handW[s], f.handW[s]));
      r.foreTurnMax = Math.max(r.foreTurnMax, ft);
      r.handTurnMax = Math.max(r.handTurnMax, ht);
      if (ft > A.turnPerFrame || ht > A.turnPerFrame) fast = true;
    }
    if (fast) r.fastTurns++;
  });
  return r;
}
