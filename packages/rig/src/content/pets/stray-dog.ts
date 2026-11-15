/**
 * The stray dog, drawn from life (redraw of 15 Nov 2026). A lean street pariah: deep chest and
 * a tucked belly, prick ears (one torn), a sickle tail, a scarred muzzle and a snarl that shows
 * a fang. About 30% of a fighter's height (25 of 84 units to the ear tips).
 *
 * Skeleton, from the anatomy of a dog standing (side view):
 *   spine    hips (croup, sacrum), body (loin; the bone the engine hits), chest (thorax); the
 *            hips and the chest turn against the body, so the back flexes and stretches
 *   neck, head, jaw (opens), ear (twitches, flattens), tail1-3 (a sickle carried high)
 *   hind leg  .up femur (hip to stifle), .lo tibia (stifle to hock), .paw metatarsus and toes.
 *            The stifle points forward, the hock back: the visible backward bend is the ankle.
 *   fore leg  .up humerus (shoulder to elbow), .lo forearm (elbow to wrist), .paw pastern and
 *            toes. The elbow points back; the wrist folds the paw back and up in the swing.
 * The dog stands on its toes (digitigrade): the pad, never the hock or the wrist, meets the floor.
 *
 * Motion from Eadweard Muybridge, Animal Locomotion (1887): plate 706 (mastiff trotting) for the
 * run, a trot in diagonal pairs (near hind with far fore, far hind with near fore), the body
 * dipping over each pair; plate 710 (hound galloping) for the flee, a rotary gallop (far hind,
 * near hind, near fore, far fore) with the back gathered under and stretched out, two flights.
 */
import type { Clip, CompanionClip } from "../../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../../contracts";
import type { Pt } from "../../gate/vocab";
import type { Foot, GaitFoot, Hi, Rot } from "./anatomy";
import { Anatomy, gaitFootByJoint, band, ellipse, line, poseFrom, profile, restLeg, sampleClip, smooth, sn, track } from "./anatomy";
import type { PetArt } from "./kind";

const P = PLACEHOLDER_COMPANION_CLIPS;

// ---------------------------------------------------------------------------- skeleton
/** Rest joints (world, stage units, floor at y = 0). */
const HIND: readonly [Pt, Pt, Pt] = [[-7.0, -13.6], [-4.3, -8.92], [-8.18, -4.61]];
const FORE: readonly [Pt, Pt, Pt] = [[8.4, -12.2], [5.88, -8.6], [5.88, -3.0]];
const FAR: Pt = [0.4, 0];
const shift = (j: readonly [Pt, Pt, Pt], d: Pt): [Pt, Pt, Pt] => j.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt) as [Pt, Pt, Pt];
/** World angle of the end bone at rest: the hind metatarsus and the fore pastern lean forward. */
export const DOG_HIND_ANGLE = -10;
export const DOG_FORE_ANGLE = -18;
/** The front of each sole at rest (the point that stays on the floor as the heel lifts). */
const HIND_TOE: Pt = [-5.9, 0];
const FORE_TOE: Pt = [7.9, 0];
const HIND_SOLE: Pt[] = [[-8.1, 0], [-5.9, 0]];
const FORE_SOLE: Pt[] = [[5.8, 0], [7.9, 0]];

/** Joint limits: the sign of each leg joint is the way it really bends. */
export const DOG_LIMITS = {
  hip: [-115, 60], stifle: [8, 155], hock: [-160, -2],
  shoulder: [-80, 110], elbow: [-150, 0], wrist: [-45, 170],
} as const;

function floorClamp(p: Pt[]): Pt[] { return p.map(([x, y]) => [x, Math.min(0, y)] as Pt); }

/** The picture is drawn in round numbers, then fitted: legs lengthened (a street pariah is leggy),
 *  the body lifted onto them, the head enlarged, and the whole dog scaled to 30% of a fighter. */
const G = 0.92;
const LIFT = 1.6;
const bodyMap = (p: Pt): Pt => [p[0] * G, (p[1] - LIFT) * G];
const hindMap = (p: Pt): Pt => [p[0] * G, p[1] * ((13.6 + LIFT) / 13.6) * G];
const foreMap = (p: Pt): Pt => [p[0] * G, p[1] * ((12.2 + LIFT) / 12.2) * G];
const HEAD_AT: Pt = [11.2, -21.0];
const headMap = (p: Pt): Pt => bodyMap([HEAD_AT[0] + (p[0] - HEAD_AT[0]) * 1.12, HEAD_AT[1] + (p[1] - HEAD_AT[1]) * 1.12]);


export function strayDog(): PetArt & { anatomy: Anatomy } {
  const rest: Rot = { body: 0, hips: 0, chest: 0, neck: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const fit = (j: readonly [Pt, Pt, Pt], m: (p: Pt) => Pt): [Pt, Pt, Pt] => j.map(m) as [Pt, Pt, Pt];
  restLeg(rest, "hindF", "paw", 0, fit(HIND, hindMap), DOG_HIND_ANGLE);
  restLeg(rest, "hindB", "paw", 0, fit(shift(HIND, FAR), hindMap), DOG_HIND_ANGLE);
  restLeg(rest, "foreF", "paw", 0, fit(FORE, foreMap), DOG_FORE_ANGLE);
  restLeg(rest, "foreB", "paw", 0, fit(shift(FORE, FAR), foreMap), DOG_FORE_ANGLE);
  const a = new Anatomy(rest);
  a.xf = bodyMap;
  a.bone("body", "root", [-1.0, -15.4], [-35, 35]);
  a.bone("hips", "body", [-3.2, -15.6], [-30, 30]);
  a.bone("chest", "body", [1.4, -15.8], [-30, 30]);
  a.bone("neck", "chest", [6.6, -15.8], [-70, 50]);
  a.bone("head", "neck", [11.2, -21.0], [-50, 70]);
  a.xf = headMap;
  a.bone("jaw", "head", [13.4, -19.9], [0, 42]);
  a.bone("ear", "head", [11.9, -22.5], [-55, 20]);
  a.xf = bodyMap;
  a.bone("tail1", "hips", [-10.4, -15.9], [-90, 70]);
  a.bone("tail2", "tail1", [-12.7, -17.7], [-70, 70]);
  a.bone("tail3", "tail2", [-14.3, -19.9], [-70, 70]);
  const L = DOG_LIMITS;
  const leg = (n: string, parent: string, j: readonly [Pt, Pt, Pt], hind: boolean, d: Pt): void => {
    const toe: Pt = hind ? [HIND_TOE[0] + d[0], HIND_TOE[1] + d[1]] : [FORE_TOE[0] + d[0], FORE_TOE[1] + d[1]];
    const sole = (hind ? HIND_SOLE : FORE_SOLE).map((p) => [p[0] + d[0], p[1] + d[1]] as Pt);
    a.xf = hind ? hindMap : foreMap;
    if (hind) a.leg(n, "paw", parent, j, 1, [L.hip, L.stifle, L.hock], toe, sole);
    else a.leg(n, "paw", parent, j, -1, [L.shoulder, L.elbow, L.wrist], toe, sole);
  };
  leg("hindB", "hips", shift(HIND, FAR), true, FAR);
  leg("foreB", "chest", shift(FORE, FAR), false, FAR);
  leg("hindF", "hips", HIND, true, [0, 0]);
  leg("foreF", "chest", FORE, false, [0, 0]);

  // ---------------------------------------------------------------------------- shapes
  const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
  const mv = (pts: readonly Pt[], d: Pt): Pt[] => pts.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt);
  // legs: one picture per leg, used near (own outline group, over the body) and far (behind, in shadow)
  const hindParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.xf = hindMap;
    a.fill(`${n}.up`, mv(S([[-5.8, -14.4], [-4.4, -12.8], [-3.6, -10.6], [-3.3, -8.7], [-4.4, -7.8], [-6.0, -8.5], [-8.2, -9.8], [-10.2, -11.2], [-10.9, -12.9], [-10.0, -14.4], [-8.0, -15.0]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[-3.4, -9.5], [-3.9, -8.2], [-5.6, -6.6], [-7.4, -5.1], [-7.9, -4.3], [-8.9, -4.0], [-9.1, -4.9], [-8.5, -6.3], [-7.8, -8.0], [-6.6, -9.6], [-4.9, -10.3]]), d), "skin", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp(S([[-8.8, -4.9], [-7.5, -4.9], [-7.2, -2.7], [-6.8, -1.3], [-5.9, -1.15], [-5.3, -0.45], [-5.7, 0.2], [-8.1, 0.2], [-8.4, -0.6], [-8.2, -1.7], [-8.4, -3.2]], 3)), d), "skin", z + 0.2, sh);
    if (!far) a.ink(`${n}.paw`, [[[-6.4, -1.0], [-6.2, -0.1]], [[-7.2, -1.1], [-7.1, -0.1]]], 0.2, z + 0.25, false);
  };
  const foreParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.xf = foreMap;
    a.fill(`${n}.up`, mv(S([[9.5, -13.6], [10.1, -11.7], [8.7, -9.8], [7.0, -8.4], [5.6, -7.9], [4.5, -8.4], [4.7, -9.8], [5.6, -11.4], [6.8, -13.3], [8.2, -14.2]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[6.8, -8.9], [6.9, -6.0], [6.75, -3.4], [6.5, -2.5], [5.3, -2.5], [5.05, -3.4], [5.0, -6.0], [4.9, -8.4], [5.7, -9.3]]), d), "skin", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp(S([[5.2, -3.2], [6.6, -3.2], [6.8, -2.1], [7.1, -1.4], [7.8, -1.1], [8.3, -0.45], [7.9, 0.2], [5.8, 0.2], [5.5, -0.6], [5.6, -1.7], [5.2, -2.5]], 3)), d), "skin", z + 0.2, sh);
    if (!far) a.ink(`${n}.paw`, [[[7.0, -0.9], [7.15, -0.1]], [[6.3, -0.9], [6.35, -0.1]]], 0.2, z + 0.25, false);
  };
  hindParts("hindB", FAR, 10, true);
  foreParts("foreB", FAR, 11, true);
  a.xf = bodyMap;
  // the tail, behind the body: a sickle carried high, pale at the tip
  a.fill("tail3", band([[-14.25, -19.8], [-14.6, -21.3], [-14.3, -22.8]], 0.72, 0.42), "skin", 19.7);
  a.fill("tail3", band([[-14.55, -21.9], [-14.3, -22.8]], 0.5, 0.36), "accent", 19.75);
  a.fill("tail2", band([[-12.6, -17.6], [-13.6, -18.6], [-14.35, -20.0]], 0.9, 0.72), "skin", 19.8);
  a.fill("tail1", band([[-10.0, -15.6], [-11.4, -16.9], [-12.8, -17.8]], 1.1, 0.9), "skin", 19.9);
  a.xf = headMap;
  // the far ear, behind the head
  a.fill("ear", [[11.9, -21.9], [11.9, -24.2], [12.6, -25.6], [13.6, -23.8], [13.9, -22.0]], "skin", 19.5, true);
  a.xf = bodyMap;
  // body masses, one outline: hips under the loin under the chest under the neck under the head
  a.fill("hips", S([[-2.0, -16.6], [-5.0, -17.0], [-8.4, -16.8], [-10.6, -15.8], [-11.8, -13.9], [-11.5, -11.8], [-10.0, -10.6], [-7.5, -10.6], [-4.5, -11.6], [-2.2, -13.0]]), "skin", 20.0);
  a.fill("body", S([[-6.6, -16.5], [-3.0, -16.95], [1.0, -17.0], [3.5, -16.4], [3.4, -11.0], [1.0, -9.6], [-2.0, -9.9], [-4.6, -10.6], [-6.8, -11.8], [-7.4, -14.4]]), "skin", 20.1);
  a.fill("body", S([[-5.2, -16.75], [-1.0, -17.05], [2.6, -16.8], [1.0, -15.9], [-3.6, -15.9]]), "hair", 20.15);          // dark saddle
  a.fill("chest", S([[-0.5, -16.9], [2.5, -17.4], [5.0, -18.0], [7.2, -17.6], [9.4, -15.6], [10.5, -13.0], [10.1, -10.8], [8.6, -9.0], [6.2, -8.1], [3.2, -8.3], [0.8, -9.2], [-0.8, -11.0], [-1.4, -14.0]]), "skin", 20.2);
  a.fill("chest", S([[9.4, -13.6], [10.3, -12.2], [9.9, -10.6], [8.6, -9.2], [8.6, -11.4]]), "accent", 20.25);               // pale chest
  a.ink("chest", [line([[2.2, -14.6], [2.6, -12.4], [3.0, -10.2]]), line([[3.8, -15.0], [4.2, -12.8], [4.6, -10.0]]), line([[0.8, -14.0], [1.2, -12.2], [1.6, -10.6]])], 0.2, 20.26);   // ribs
  a.fill("neck", S([[3.6, -17.3], [5.8, -18.9], [8.3, -20.5], [10.3, -22.0], [12.4, -21.6], [13.4, -19.8], [12.8, -17.4], [11.0, -14.6], [8.6, -13.4], [5.0, -14.0]]), "skin", 20.3);
  a.ink("neck", [[[5.4, -18.6], [6.0, -19.5]], [[6.7, -19.3], [7.3, -20.3]], [[8.0, -20.1], [8.6, -21.1]]], 0.28, 20.33);       // hackles
  a.xf = headMap;
  a.fill("ear", [[10.9, -22.0], [10.7, -24.3], [11.3, -26.1], [11.95, -25.3], [12.25, -24.85], [12.05, -24.45], [12.7, -24.1], [13.1, -22.4]], "skin", 20.35);
  a.fill("ear", [[11.4, -22.6], [11.35, -24.4], [11.6, -25.2], [12.1, -23.2]], "accent", 20.355);
  a.fill("jaw", [[13.0, -20.1], [17.6, -19.9], [17.4, -21.6], [13.2, -21.4]], "ink", 20.37);                                      // inside the mouth (shows as it opens)
  a.fill("jaw", S([[12.6, -20.3], [14.6, -19.95], [17.0, -19.85], [17.9, -19.55], [17.6, -18.9], [15.8, -18.5], [13.6, -18.5], [12.2, -19.2]]), "skin", 20.38);
  a.fill("jaw", [[16.6, -19.8], [17.05, -19.8], [16.85, -20.45]], "white", 20.385);                                               // lower fang
  a.fill("head", S([[10.2, -21.2], [10.8, -22.6], [12.4, -23.4], [14.2, -23.15], [15.4, -22.35], [17.3, -21.75], [18.8, -21.25], [19.05, -20.4], [17.8, -19.8], [15.4, -19.55], [13.0, -19.35], [11.0, -19.8]]), "skin", 20.4);
  a.fill("head", S([[15.6, -22.2], [17.3, -21.7], [18.8, -21.2], [19.0, -20.4], [17.8, -19.85], [15.6, -19.7], [15.1, -20.9]]), "hair", 20.42);  // dark muzzle
  a.fill("head", [[16.6, -19.9], [17.0, -19.9], [16.82, -19.25]], "white", 20.44);                                              // the fang over the lip
  a.inkFill("head", ellipse(18.55, -20.95, 0.6, 0.45, 0, 10), 20.45);                                                             // nose
  a.inkFill("head", ellipse(14.3, -22.0, 0.55, 0.3, -12, 10), 20.45);                                                             // eye
  a.ink("head", [[[13.3, -22.95], [14.2, -22.75], [15.1, -22.3]]], 0.38, 20.46);                                                  // hard brow
  a.ink("head", [line([[14.4, -19.95], [16.4, -19.8], [18.0, -19.9]])], 0.24, 20.46);                                            // lip line
  a.ink("head", [[[16.0, -22.3], [16.6, -21.4], [16.9, -20.7]], [[12.4, -21.3], [13.2, -20.5]]], 0.18, 20.47);                   // scars
  hindParts("hindF", [0, 0], 40, false);
  foreParts("foreF", [0, 0], 41, false);
  a.xf = foreMap;
  a.fill("foreF.paw", [[5.4, -1.9], [4.9, -1.5], [5.4, -1.2]], "skin", 41.15);                                                   // dewclaw

  a.settleFeet();
  const art = { rig: a.rig("stray-dog", 25), shapes: a.shapes };
  return { ...art, clips: dogClips(a), anatomy: a };
}

// ------------------------------------------------------------------------------- clips

/** Trot (run): diagonal pairs. Gallop (flee): rotary, far hind first. Shares of the cycle at which
 *  each foot touches down, and how long it stays down. */
export const DOG_GAITS = {
  run: { hindB: 0, foreF: 0.02, hindF: 0.5, foreB: 0.52, duty: 0.52 },
  flee: { hindB: 0, hindF: 0.08, foreF: 0.5, foreB: 0.58, duty: 0.3 },
} as const;

function dogClips(a: Anatomy): Record<CompanionClip, Clip> {
  const bones = a.bones;
  const legs = a.legs;
  const toe = (n: string): number => legs.find((l) => l.name === n)!.restContact[0];
  const HIND_X = toe("hindF");
  const FORE_X = toe("foreF");
  const S0: Hi = {
    x: 0, y: 0, rot: { body: 0, hips: 0, chest: 0, neck: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 },
    feet: {
      hindF: { x: HIND_X, y: 0, a: DOG_HIND_ANGLE }, hindB: { x: HIND_X + 1.6, y: 0, a: DOG_HIND_ANGLE },
      foreF: { x: FORE_X, y: 0, a: DOG_FORE_ANGLE }, foreB: { x: FORE_X - 0.5, y: 0, a: DOG_FORE_ANGLE },
    },
  };
  // the end bone's world angle over stance and swing: flat at touch-down, the heel peeling up
  // (the angle growing) to the push-off, folded (the fore paw flipped up behind) in the swing
  const hindStance = profile([[0, -10], [0.5, -9], [1, 30]]);
  const hindSwing = profile([[0, 30], [0.25, 45], [0.55, 10], [0.85, -16], [1, -10]]);
  const foreStance = profile([[0, -18], [0.55, -16], [1, 22]]);
  const foreSwing = profile([[0, 22], [0.28, 70], [0.5, 95], [0.74, 34], [0.93, -19], [1, -18]]);
  const hindStanceG = profile([[0, -10], [0.45, -6], [1, 24]]);
  const hindSwingG = profile([[0, 24], [0.3, 40], [0.6, 0], [0.88, -18], [1, -10]]);
  const foreStanceG = profile([[0, -18], [0.5, -10], [1, 30]]);
  const foreSwingG = profile([[0, 30], [0.25, 75], [0.48, 100], [0.74, 24], [0.93, -19], [1, -18]]);

  // ---- idle: breathing, an ear twitch, the tail swaying
  const idle = sampleClip(bones, legs, P.idle.durationMs, true, 40, (t) => {
    const u = t / P.idle.durationMs;
    const tw = Math.max(0, 1 - Math.abs(t - 760) / 70);                     // ear flick at 760 ms
    const tw2 = Math.max(0, 1 - Math.abs(t - 900) / 60);
    return poseFrom(S0, {
      y: 0.12 * sn(u, 1, 0.25),
      rot: { chest: -0.8 * sn(u), hips: 0.3 * sn(u), neck: 1.2 * sn(u, 1, 0.1), head: -1.5 * sn(u, 1, 0.2), ear: -16 * tw - 8 * tw2,
        tail1: 4 * sn(u, 2), tail2: 6 * sn(u, 2, -0.1), tail3: 8 * sn(u, 2, -0.2), jaw: 2 + 2 * sn(u, 2) },
    });
  }, { events: P.idle.events });

  // ---- run: a fast trot, diagonal pairs, the body dipping over each, the head steady and low
  const gait = (g: { hindB: number; hindF: number; foreF: number; foreB: number; duty: number }, fast: boolean): ((t: number) => Hi) => {
    const feet: Record<string, GaitFoot> = {};
    const hs = fast ? hindStanceG : hindStance;
    const hw = fast ? hindSwingG : hindSwing;
    const fs = fast ? foreStanceG : foreStance;
    const fw = fast ? foreSwingG : foreSwing;
    for (const n of ["hindB", "hindF", "foreF", "foreB"] as const) {
      const hind = n.startsWith("hind");
      feet[n] = { leg: n, down: g[n], duty: g.duty, half: fast ? 5.4 : 4.0, lift: fast ? (hind ? 3.0 : 2.6) : (hind ? 1.6 : 1.8),
        angle: hind ? hw : fw, stance: hind ? hs : fs };
    }
    const home: Record<string, number> = fast
      ? { hindF: HIND_X + 0.2, hindB: HIND_X + 0.6, foreF: FORE_X + 1.4, foreB: FORE_X + 0.8 }
      : { hindF: HIND_X - 0.4, hindB: HIND_X, foreF: FORE_X + 1.0, foreB: FORE_X + 0.6 };
    return (t) => {
      const u = t / P.run.durationMs;
      const ft: Record<string, Foot> = {};
      for (const [n, gf] of Object.entries(feet)) { const f = gaitFootByJoint(gf, legs.find((l) => l.name === n)!, home[n]!, u); ft[n] = { x: f.x, y: f.y, a: f.a }; }
      if (!fast) {
        const dip = Math.cos(4 * Math.PI * (u - 0.26));                       // lowest at mid-stance of each pair
        return { x: 0, y: 1.3 + 0.35 * dip, feet: ft,
          rot: { body: 0.8 * sn(u, 2, 0.1), hips: -1.2 * sn(u, 2), chest: 1.2 * sn(u, 2, 0.05), neck: 10 - 1.5 * dip, head: -4 + 2.5 * dip, jaw: 6, ear: -14,
            tail1: -38 + 5 * sn(u, 2, 0.1), tail2: 8 + 7 * sn(u, 2, 0), tail3: 6 + 9 * sn(u, 2, -0.1) } };
      }
      // rotary gallop: gathered (back arched, hind feet reaching under) at 0.95, stretched at 0.44;
      // two flights, stretched (0.385 to 0.495) and gathered (0.885 to 0.995), the whole dog off the floor
      const flex = Math.cos(TAU1 * (u - 0.95));                               // +1 gathered, -1 stretched
      const fly = 1.6 * bump(u, 0.385, 0.11) + 1.2 * bump(u, 0.885, 0.11);
      for (const f of Object.values(ft)) f.y -= fly;
      return { x: 0, y: 2.0 + 0.6 * Math.cos(TAU1 * (u - 0.25)) - fly, feet: ft,
        rot: { body: 3 * sn(u, 1, 0.1), hips: -14 * flex, chest: 11 * flex, neck: 22 + 5 * flex, head: -8 - 4 * flex, jaw: 10, ear: -40,
          tail1: -70 + 8 * flex, tail2: 30 + 6 * sn(u), tail3: 20 + 8 * sn(u, 1, -0.1) } };
    };
  };
  const run = sampleClip(bones, legs, P.run.durationMs, true, 10, gait(DOG_GAITS.run, false), { events: P.run.events, lag: { tail2: 30, tail3: 50, ear: 20 } });
  const flee = sampleClip(bones, legs, P.flee.durationMs, true, 10, gait(DOG_GAITS.flee, true), { events: P.flee.events, lag: { tail2: 30, tail3: 50 }, air: true });

  // ---- attack: crouch, lunge (hind feet planted, fore feet stepping), bite at 150, shake, back
  const crouch = poseFrom(S0, { x: -0.6, y: 1.6, rot: { body: 3, hips: -4, chest: 5, neck: 14, head: 6, ear: -30, tail1: -40, tail2: 10, jaw: 4 } });
  const reach = poseFrom(S0, { x: 4.0, y: 1.0, rot: { body: 2, hips: -6, chest: 2, neck: 40, head: -24, jaw: 38, ear: -36, tail1: -30, tail2: 14, tail3: 10 },
    feet: { foreF: { x: 5.2, y: -2.4, a: 40 }, foreB: { x: 4.4, y: -1.2, a: 20 }, hindF: { a: 24 }, hindB: { a: 22 } } });
  const bite = poseFrom(S0, { x: 4.3, y: 1.2, rot: { body: 3, hips: -5, chest: 3, neck: 40, head: -10, jaw: 2, ear: -34, tail1: -30, tail2: 14, tail3: 10 },
    feet: { foreF: { x: 5.2, a: 2 }, foreB: { x: 4.2 }, hindF: { a: 26 }, hindB: { a: 24 } } });
  const shake = (k: number): Hi => poseFrom(bite, { rot: { neck: 8 * k, head: 20 * k, chest: -2 * k, tail1: 6 * k } });
  const attack = sampleClip(bones, legs, P.attack.durationMs, false, 10, track([
    [0, S0], [80, crouch, "out"], [125, reach, "in"], [150, bite, "out"],
    [175, shake(1)], [198, shake(-1)], [220, shake(0.8)], [240, shake(-0.4)], [280, S0, "inOut"],
  ]), { events: P.attack.events, lag: { tail2: 30, tail3: 50, ear: 20 } });

  // ---- hit: flinch back and down, head turned away, ears flat, tail tucked
  const flinch = poseFrom(S0, { x: -1.6, y: 1.6, rot: { body: -3, hips: 5, chest: 2, neck: 6, head: 18, jaw: 10, ear: -50, tail1: -70, tail2: 20, tail3: 10 },
    feet: { foreF: { x: -0.4, y: -1.0, a: 12 }, hindF: { a: 6 } } });
  const hit = sampleClip(bones, legs, P.hit.durationMs, false, 10, track([
    [0, S0], [60, flinch, "out"], [130, poseFrom(flinch, { x: 0.6, y: -0.4, rot: { neck: 8, head: 6 }, feet: { foreF: { x: 0.4, y: 1.0, a: -12 } } }), "inOut"], [300, S0, "inOut"],
  ]), { events: P.hit.events, lag: { tail2: 30, tail3: 50, ear: 30 } });

  // ---- ko: the hind legs fold, the chest goes down, the head drops last; lands at 400
  const sag = poseFrom(S0, { y: 3.4, rot: { body: -4, hips: 8, chest: 4, neck: -6, head: 10, ear: -30, tail1: -60, tail2: 10 },
    feet: { hindF: { x: -0.4, a: -40 }, hindB: { x: 0.2, a: -40 }, foreF: { x: 1.4 }, foreB: { x: 1.2 } } });
  const down: Hi = poseFrom(S0, { x: 0.6, y: 8.2, rot: { body: 2, hips: 4, chest: 6, neck: 14, head: 30, jaw: 8, ear: -50, tail1: -82, tail2: 10, tail3: 4 },
    feet: { hindF: { x: 0.6, y: 0, a: -64 }, hindB: { x: 1.2, a: -64 }, foreF: { x: 6.2, y: 0, a: -70 }, foreB: { x: 5.4, a: -70 } } });
  const ko = sampleClip(bones, legs, P.ko.durationMs, false, 20, track([
    [0, S0], [90, poseFrom(S0, { x: -0.8, y: 0.6, rot: { neck: -12, head: -12, ear: -40 } }), "out"], [240, sag, "in"], [400, down, "in"],
    [470, poseFrom(down, { y: -0.3, rot: { head: -6 } }), "out"], [600, down, "inOut"],
  ]), { events: P.ko.events, lag: { tail2: 40, tail3: 60 } });

  return { idle, run, flee, attack, hit, ko };
}
const TAU1 = Math.PI * 2;
/** A half-sine bump over the cycle window [a, a + w] (wrapping past 1), 0 elsewhere. */
function bump(u: number, a: number, w: number): number {
  let p = (u - a) % 1;
  if (p < 0) p += 1;
  return p <= w ? Math.sin((Math.PI * p) / w) : 0;
}
