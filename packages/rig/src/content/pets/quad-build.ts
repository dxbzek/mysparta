/**
 * The skeleton every four-legged pet drawn from life shares (raccoon, alley cat, boar): a spine
 * in three parts (hips, body = loin, chest) that flex against each other, neck, head, jaw, ear,
 * a tail in three links, and four legs of three bones (near "F", far "B") whose middle joints bend
 * only the way the animal's do. Joints are given in world rest coordinates of the picture.
 */
import type { Pt } from "../../gate/vocab";
import type { Rot } from "./anatomy";
import { Anatomy, restLeg } from "./anatomy";

export interface QuadSkeleton {
  body: Pt; hips: Pt; chest: Pt; neck: Pt; head: Pt; jaw: Pt; ear: Pt; tail: readonly [Pt, Pt, Pt];
  hind: readonly [Pt, Pt, Pt]; fore: readonly [Pt, Pt, Pt];
  /** World angle of the end bone at rest (the sole flat on the floor). */
  hindAngle: number; foreAngle: number;
  /** The far legs' joints, shifted from the near ones. */
  far: Pt;
  limits: { hip: readonly [number, number]; stifle: readonly [number, number]; hock: readonly [number, number];
    shoulder: readonly [number, number]; elbow: readonly [number, number]; wrist: readonly [number, number] };
  /** Picture-to-stage fit per part (legs may be lengthened, everything scaled). */
  map: { body: (p: Pt) => Pt; head: (p: Pt) => Pt; hind: (p: Pt) => Pt; fore: (p: Pt) => Pt };
}
export const shiftJ = (j: readonly [Pt, Pt, Pt], d: Pt): [Pt, Pt, Pt] => j.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt) as [Pt, Pt, Pt];
export const mv = (pts: readonly Pt[], d: Pt): Pt[] => pts.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt);
export const floorClamp = (p: readonly Pt[]): Pt[] => p.map(([x, y]) => [x, Math.min(0, y)] as Pt);

export function quadSkeleton(q: QuadSkeleton, spineLimit = 30): Anatomy {
  const rest: Rot = { body: 0, hips: 0, chest: 0, neck: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const fit = (j: readonly [Pt, Pt, Pt], m: (p: Pt) => Pt): [Pt, Pt, Pt] => j.map(m) as [Pt, Pt, Pt];
  restLeg(rest, "hindF", "paw", 0, fit(q.hind, q.map.hind), q.hindAngle);
  restLeg(rest, "hindB", "paw", 0, fit(shiftJ(q.hind, q.far), q.map.hind), q.hindAngle);
  restLeg(rest, "foreF", "paw", 0, fit(q.fore, q.map.fore), q.foreAngle);
  restLeg(rest, "foreB", "paw", 0, fit(shiftJ(q.fore, q.far), q.map.fore), q.foreAngle);
  const a = new Anatomy(rest);
  a.xf = q.map.body;
  a.bone("body", "root", q.body, [-35, 35]);
  a.bone("hips", "body", q.hips, [-spineLimit, spineLimit]);
  a.bone("chest", "body", q.chest, [-spineLimit, spineLimit]);
  a.bone("neck", "chest", q.neck, [-70, 60]);
  a.bone("head", "neck", q.head, [-60, 70]);
  a.xf = q.map.head;
  a.bone("jaw", "head", q.jaw, [0, 45]);
  a.bone("ear", "head", q.ear, [-60, 25]);
  a.xf = q.map.body;
  a.bone("tail1", "hips", q.tail[0], [-100, 80]);
  a.bone("tail2", "tail1", q.tail[1], [-80, 80]);
  a.bone("tail3", "tail2", q.tail[2], [-80, 80]);
  const L = q.limits;
  for (const [n, parent, j, hind] of [["hindB", "hips", shiftJ(q.hind, q.far), true], ["foreB", "chest", shiftJ(q.fore, q.far), false],
    ["hindF", "hips", q.hind, true], ["foreF", "chest", q.fore, false]] as const) {
    a.xf = hind ? q.map.hind : q.map.fore;
    // contact and sole are set from the drawn foot later (`settleFeet`); a placeholder here
    const toe: Pt = [j[2][0] + 1, 0];
    if (hind) a.leg(n, "paw", parent, j, 1, [L.hip, L.stifle, L.hock], toe, [toe]);
    else a.leg(n, "paw", parent, j, -1, [L.shoulder, L.elbow, L.wrist], toe, [toe]);
  }
  a.xf = q.map.body;
  return a;
}
