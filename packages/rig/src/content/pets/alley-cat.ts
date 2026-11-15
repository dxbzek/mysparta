/**
 * The alley cat, drawn from life (15 Nov 2026). A lean ginger tabby tom off the bins: a long
 * low body over long hind legs, a round head with a short muzzle and big triangular ears (one
 * notched), a slit-pupil glare, a scar, a long tail. About 25% of a fighter's height (21 of 84).
 *
 * Digitigrade like the dog: stifle forward, the long hind metatarsus up to a high hock, elbow
 * back, wrist folding the paw back in the swing. Motion from Muybridge, Animal Locomotion (1887),
 * plate 718 (cat trotting and galloping): the run a low trot in diagonal pairs with the head
 * level and the tail out behind; the flee a rotary gallop, the back folding and stretching hard.
 * The attack is a cat's: weight back, the front lifted, a swipe with one paw then the other and a
 * hissing bite between them.
 */
import type { Clip, CompanionClip } from "../../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../../contracts";
import type { Pt } from "../../gate/vocab";
import type { Anatomy, Hi } from "./anatomy";
import { band, ellipse, line, poseFrom, profile, sampleClip, smooth, sn, track } from "./anatomy";
import type { PetArt } from "./kind";
import { floorClamp, mv, quadSkeleton } from "./quad-build";
import { gaitOf } from "./quad";

const P = PLACEHOLDER_COMPANION_CLIPS;
/** Touch-down share of the cycle per leg and the duty factor of each gait (the tests read these). */
export const CAT_GAITS = {
  run: { hindB: 0, foreF: 0.02, hindF: 0.5, foreB: 0.52, duty: 0.52 },
  flee: { hindB: 0, hindF: 0.08, foreF: 0.5, foreB: 0.58, duty: 0.3 },
} as const;
const G = 1.07;
const fitP = (p: Pt): Pt => [p[0] * G, p[1] * G];
const HEAD_AT: Pt = [8.4, -15.0];
/** The head drawn 1.2x about its joint (a broad face reads at phone size). */
const headP = (p: Pt): Pt => fitP([HEAD_AT[0] + (p[0] - HEAD_AT[0]) * 1.2, HEAD_AT[1] + (p[1] - HEAD_AT[1]) * 1.2]);
const FAR: Pt = [0.5, 0];
export const CAT_ANGLES = { hind: -20, fore: -15 } as const;

export function alleyCat(): PetArt & { anatomy: Anatomy } {
  const a = quadSkeleton({
    body: [-1, -12.2], hips: [-3.6, -12.4], chest: [2, -12.0], neck: [6.0, -12.6], head: [8.4, -15.0], jaw: [10.2, -13.5], ear: [9.0, -16.6],
    tail: [[-9.8, -12.6], [-13.2, -11.6], [-16.4, -12.6]],
    hind: [[-6.6, -10.8], [-3.6, -7.0], [-7.6, -3.4]], fore: [[6.2, -10.0], [4.8, -6.6], [5.4, -1.8]],
    hindAngle: CAT_ANGLES.hind, foreAngle: CAT_ANGLES.fore, far: FAR,
    limits: { hip: [-120, 70], stifle: [8, 160], hock: [-165, -2], shoulder: [-100, 120], elbow: [-155, 0], wrist: [-45, 170] },
    map: { body: fitP, head: headP, hind: fitP, fore: fitP },
  }, 35);
  const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
  const stripe = (bone: string, pts: Pt[], z: number): void => { a.fill(bone, pts, "hair", z); };
  const hindParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[-5.4, -12.6], [-3.6, -10.0], [-3.0, -7.6], [-3.6, -6.4], [-5.0, -6.8], [-7.6, -8.0], [-9.8, -9.6], [-10.0, -11.6], [-8.2, -12.8]]), d), "skin", z, sh);
    if (!far) stripe(`${n}.up`, [[-8.8, -11.6], [-6.4, -9.8], [-6.8, -9.2], [-9.2, -10.8]], z + 0.05);
    a.fill(`${n}.lo`, mv(S([[-3.2, -7.6], [-3.9, -6.4], [-5.8, -4.8], [-7.2, -3.8], [-7.8, -3.0], [-8.5, -3.4], [-8.3, -4.2], [-7.0, -5.6], [-5.6, -7.4], [-4.4, -8.2]]), d), "skin", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp(S([[-8.3, -3.6], [-7.4, -3.8], [-6.6, -1.6], [-6.0, -0.9], [-5.0, -0.7], [-4.6, -0.2], [-4.8, 0.2], [-6.8, 0.2], [-7.2, -0.6], [-7.6, -1.6], [-8.2, -2.8]], 3)), d), "skin", z + 0.2, sh);
  };
  const foreParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[7.2, -11.2], [7.4, -9.4], [6.2, -7.6], [5.0, -6.2], [3.9, -6.6], [4.0, -8.4], [4.8, -10.2], [6.0, -11.6]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[5.6, -7.0], [5.9, -4.4], [5.9, -2.2], [4.9, -2.0], [4.6, -4.4], [4.3, -6.6]]), d), "skin", z + 0.1, sh);
    if (!far) stripe(`${n}.lo`, [[4.5, -5.2], [5.9, -5.6], [5.9, -5.0], [4.5, -4.6]], z + 0.15);
    a.fill(`${n}.paw`, mv(floorClamp([[4.8, -2.4], [5.9, -2.4], [6.1, -1.4], [6.6, -0.9], [7.4, -0.7], [7.7, -0.2], [7.5, 0.2], [5.0, 0.2], [4.8, -0.8]]), d), "accent", z + 0.2, sh);
  };
  hindParts("hindB", FAR, 10, true);
  foreParts("foreB", FAR, 11, true);
  // tail: long, ringed, carried low and out, the tip curling up
  a.fill("tail3", band([[-16.3, -12.6], [-17.3, -14.0], [-17.5, -15.8]], 0.82, 0.6), "skin", 19.7);
  a.fill("tail3", band([[-17.35, -14.9], [-17.5, -15.8]], 0.7, 0.58), "hair", 19.72);
  a.fill("tail2", band([[-13.0, -11.7], [-15.0, -11.8], [-16.6, -12.8]], 0.88, 0.82), "skin", 19.8);
  a.fill("tail2", ellipse(-14.9, -11.8, 0.45, 0.9, 0, 10), "hair", 19.81);
  a.fill("tail1", band([[-9.4, -12.8], [-11.6, -12.2], [-13.4, -11.7]], 0.95, 0.88), "skin", 19.9);
  a.fill("tail1", ellipse(-11.9, -12.15, 0.45, 0.95, -10, 10), "hair", 19.91);
  a.xf = headP;
  a.fill("ear", [[10.0, -16.0], [10.6, -19.6], [12.0, -16.4]], "skin", 19.5, true);
  a.xf = fitP;
  // body masses
  a.fill("hips", S([[-1.5, -13.8], [-4.5, -14.2], [-8, -13.9], [-10.2, -12.6], [-10.8, -10.4], [-9.8, -8.6], [-7.6, -8.0], [-4.6, -8.6], [-2.2, -10.2]]), "skin", 20.0);
  stripe("hips", [[-6.2, -14.1], [-5.4, -11.4], [-6.0, -11.4], [-7.0, -14.0]], 20.05);
  stripe("hips", [[-8.6, -13.6], [-8.0, -11.2], [-8.6, -11.4], [-9.4, -13.2]], 20.05);
  a.fill("body", S([[-6.8, -14.0], [-3, -14.2], [1, -13.8], [3.6, -13.4], [3.4, -9.2], [1, -8.0], [-2, -7.8], [-4.6, -8.6], [-6.6, -9.6], [-7.2, -12.0]]), "skin", 20.1);
  for (const x of [-3.4, -1.0, 1.4]) stripe("body", [[x, -14.1], [x + 0.9, -10.8], [x + 0.3, -10.8], [x - 0.6, -14.0]], 20.12);
  a.fill("body", S([[-4.4, -8.4], [-1.8, -7.9], [1.0, -8.1], [2.2, -8.8], [0.0, -9.0], [-3.2, -9.0]]), "accent", 20.13);
  a.fill("chest", S([[-0.5, -13.8], [2.4, -13.6], [5, -13.4], [7, -12.4], [7.8, -10.4], [7.2, -8.4], [5.4, -7.2], [2.8, -7.4], [0.6, -8.4], [-0.8, -10.4], [-1.2, -12.6]]), "skin", 20.2);
  a.fill("chest", S([[6.6, -11.8], [7.6, -10.4], [7.1, -8.6], [5.8, -7.8], [6.2, -9.8]]), "accent", 20.22);
  stripe("chest", [[3.4, -13.5], [4.0, -11.0], [3.4, -11.0], [2.8, -13.5]], 20.23);
  a.fill("neck", S([[4.2, -13.8], [6.2, -14.6], [8.0, -15.6], [9.6, -15.0], [9.8, -13.2], [8.6, -11.4], [6.8, -10.6], [4.8, -11.4]]), "skin", 20.3);
  a.xf = headP;
  a.fill("ear", [[7.8, -16.0], [8.2, -19.8], [9.0, -18.8], [9.5, -19.0], [10.3, -17.0]], "skin", 20.35);   // the notched ear
  a.fill("ear", [[8.6, -16.8], [8.75, -18.6], [9.4, -17.3]], "accent", 20.355);
  a.fill("jaw", [[10.2, -13.6], [12.4, -13.6], [12.2, -15.0], [10.3, -15.0]], "ink", 20.37);
  a.fill("jaw", S([[10.0, -13.6], [11.4, -13.5], [12.3, -13.4], [12.1, -12.9], [10.8, -12.7], [9.8, -13.0]], 3), "accent", 20.38);
  a.fill("jaw", [[11.6, -13.5], [11.95, -13.5], [11.8, -14.0]], "white", 20.385);
  a.fill("head", S([[7.2, -15.4], [7.8, -16.8], [9.4, -17.4], [11.0, -16.9], [12.0, -15.8], [12.6, -14.6], [12.75, -13.8], [12.0, -13.25], [10.8, -13.1], [9.2, -13.0], [7.8, -13.6]]), "skin", 20.4);
  a.fill("head", S([[10.8, -14.2], [12.0, -14.1], [12.7, -13.6], [12.1, -13.2], [10.8, -13.15], [10.2, -13.6]], 3), "accent", 20.42);   // white muzzle
  stripe("head", [[9.2, -17.3], [9.6, -16.2], [9.3, -16.2], [8.8, -17.2]], 20.42);
  stripe("head", [[10.2, -17.15], [10.3, -16.1], [10.0, -16.1], [9.8, -17.2]], 20.42);
  a.fill("head", ellipse(10.75, -15.35, 0.62, 0.42, -14, 10), "accent", 20.44);                                      // eye
  a.inkFill("head", [[10.7, -15.75], [10.95, -15.35], [10.7, -14.95], [10.55, -15.35]], 20.45);                     // slit pupil
  a.ink("head", [[[9.9, -16.05], [11.5, -15.65]]], 0.3, 20.46);                                                      // glare
  a.inkFill("head", ellipse(12.55, -14.1, 0.32, 0.24, 0, 8), 20.45);                                                // nose
  a.ink("head", [line([[11.0, -13.85], [12.2, -14.5]]), [[11.2, -14.6], [13.8, -15.0]], [[11.3, -14.3], [13.9, -14.1]]], 0.12, 20.46);  // whiskers, mouth
  a.ink("head", [[[8.6, -16.4], [9.6, -15.0]]], 0.16, 20.47);                                                        // scar
  a.xf = fitP;
  hindParts("hindF", [0, 0], 40, false);
  foreParts("foreF", [0, 0], 41, false);
  a.settleFeet();
  return { rig: a.rig("alley-cat", 21), shapes: a.shapes, clips: clips(a), anatomy: a };
}

function clips(a: Anatomy): Record<CompanionClip, Clip> {
  const { bones, legs } = a;
  const X = (n: string): number => legs.find((l) => l.name === n)!.restContact[0];
  const H = CAT_ANGLES.hind;
  const F = CAT_ANGLES.fore;
  const zero = { body: 0, hips: 0, chest: 0, neck: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const S0: Hi = { x: 0, y: 0, rot: zero, feet: {
    hindF: { x: X("hindF"), y: 0, a: H }, hindB: { x: X("hindF") + 1.2, y: 0, a: H },
    foreF: { x: X("foreF"), y: 0, a: F }, foreB: { x: X("foreF") - 0.7, y: 0, a: F } } };

  const idle = sampleClip(bones, legs, P.idle.durationMs, true, 40, (t) => {
    const u = t / P.idle.durationMs;
    const flick = Math.max(0, 1 - Math.abs(t - 700) / 80);
    return poseFrom(S0, { y: 0.1 * sn(u, 1, 0.25), rot: { chest: -0.6 * sn(u), neck: 1.5 * sn(u, 1, 0.1), head: -1.5 * sn(u, 1, 0.2), ear: -14 * flick,
      tail1: 6 * sn(u), tail2: 10 * sn(u, 1, -0.12), tail3: 18 * sn(u, 1, -0.25) } });
  }, { events: P.idle.events });

  const hindP = { stance: profile([[0, H], [0.5, H + 1], [1, H + 40]]), swing: profile([[0, H + 40], [0.28, H + 56], [0.6, H + 14], [0.86, H - 6], [1, H]]) };
  const foreP = { stance: profile([[0, F], [0.5, F + 2], [1, F + 36]]), swing: profile([[0, F + 36], [0.3, F + 75], [0.52, F + 95], [0.76, F + 36], [0.93, F - 2], [1, F]]) };
  const legOf = (fast: boolean) => (n: string) => (n.startsWith("hind") ? { ...hindP, lift: fast ? 2.0 : 1.3 } : { ...foreP, lift: fast ? 2.0 : 1.4 });
  const run = sampleClip(bones, legs, P.run.durationMs, true, 10, gaitOf(legs, {
    duration: P.run.durationMs, phase: CAT_GAITS.run, duty: CAT_GAITS.run.duty, half: 3.2,
    home: { hindF: X("hindF") - 0.4, hindB: X("hindF"), foreF: X("foreF") + 0.8, foreB: X("foreF") + 0.4 }, leg: legOf(false),
    body: (u) => { const dip = Math.cos(4 * Math.PI * (u - 0.26)); return { y: 1.0 + 0.3 * dip, rot: { body: 0.6 * sn(u, 2), hips: -1.4 * sn(u, 2), chest: 1.4 * sn(u, 2, 0.05),
      neck: 12 - 1.5 * dip, head: -8 + 2 * dip, ear: -6, tail1: -10 + 5 * sn(u, 2, 0.1), tail2: -6 + 6 * sn(u, 2), tail3: 14 + 8 * sn(u, 2, -0.1) } }; },
  }), { events: P.run.events, lag: { tail2: 30, tail3: 50 } });
  const flee = sampleClip(bones, legs, P.flee.durationMs, true, 10, gaitOf(legs, {
    duration: P.flee.durationMs, phase: CAT_GAITS.flee, duty: CAT_GAITS.flee.duty, half: 4.6,
    home: { hindF: X("hindF") + 0.6, hindB: X("hindF") + 1.0, foreF: X("foreF") + 1.4, foreB: X("foreF") + 0.8 }, leg: legOf(true),
    body: (u) => { const flex = Math.cos(2 * Math.PI * (u - 0.95)); return { y: 1.8 + 0.5 * Math.cos(2 * Math.PI * (u - 0.25)), rot: { body: 2 * sn(u, 1, 0.1), hips: -16 * flex, chest: 12 * flex,
      neck: 18 + 4 * flex, head: -12 - 3 * flex, ear: -40, jaw: 4, tail1: -20 + 8 * flex, tail2: -4 + 8 * sn(u), tail3: 6 * sn(u, 1, -0.1) } }; },
    fly: [[0.385, 0.11, 1.4], [0.885, 0.11, 1.0]],
  }), { events: P.flee.events, lag: { tail2: 30, tail3: 50 }, air: true });

  // attack: weight back, the front up, the near paw swipes down at 150 with a hissing lunge, then the far paw
  const coil = poseFrom(S0, { x: -0.8, y: 1.4, rot: { body: -4, hips: 6, chest: -8, neck: 6, head: 6, jaw: 20, ear: -40, tail1: 20, tail2: 10 } });
  const rear = poseFrom(S0, { x: 0.4, y: 0.4, rot: { body: -14, hips: 12, chest: -10, neck: 16, head: 14, jaw: 32, ear: -46, tail1: 24 },
    feet: { foreF: { x: 2.6, y: -5.0, a: 30 }, foreB: { x: 0.8, y: -1.6, a: 40 }, hindF: { a: 18 }, hindB: { a: 16 } } });
  const swipe = poseFrom(S0, { x: 2.2, y: 0.8, rot: { body: -2, hips: 4, chest: -2, neck: 20, head: -2, jaw: 30, ear: -46, tail1: 18 },
    feet: { foreF: { x: 5.2, y: -0.6, a: 10 }, foreB: { x: 1.4, y: -2.6, a: 40 }, hindF: { a: 22 }, hindB: { a: 20 } } });
  const second = poseFrom(S0, { x: 2.4, y: 0.6, rot: { body: -6, hips: 6, chest: -4, neck: 18, head: 0, jaw: 24, ear: -46, tail1: 16 },
    feet: { foreF: { x: 3.4, a: 4 }, foreB: { x: 5.0, y: -0.8, a: 12 }, hindF: { a: 22 }, hindB: { a: 20 } } });
  const attack = sampleClip(bones, legs, P.attack.durationMs, false, 10, track([
    [0, S0], [70, coil, "out"], [118, rear, "inOut"], [150, swipe, "lin"], [180, poseFrom(second, { feet: { foreB: { y: -3.0, x: -2, a: 40 } } }), "inOut"], [210, second, "inOut"], [280, S0, "inOut"],
  ]), { events: P.attack.events, lag: { tail2: 30, tail3: 50 } });

  const flinch = poseFrom(S0, { x: -1.4, y: 1.6, rot: { body: -4, hips: 6, chest: 2, neck: 2, head: 18, jaw: 16, ear: -55, tail1: 30, tail2: 30, tail3: 20 },
    feet: { foreF: { x: -0.5, y: -1.0, a: 24 }, hindF: { a: 6 } } });
  const hit = sampleClip(bones, legs, P.hit.durationMs, false, 10, track([
    [0, S0], [60, flinch, "out"], [140, poseFrom(flinch, { x: 0.5, y: -0.4, feet: { foreF: { x: 0.5, y: 1.0, a: -24 } } }), "inOut"], [300, S0, "inOut"],
  ]), { events: P.hit.events, lag: { tail2: 30, tail3: 50 } });

  const down = poseFrom(S0, { x: 0.6, y: 6.0, rot: { body: 2, hips: 6, chest: 6, neck: 10, head: 26, jaw: 10, ear: -50, tail1: -10, tail2: -10 },
    feet: { hindF: { x: 0.8, a: -40 }, hindB: { x: 1.2, a: -40 }, foreF: { x: 4.0, a: -60 }, foreB: { x: 3.4, a: -60 } } });
  const ko = sampleClip(bones, legs, P.ko.durationMs, false, 20, track([
    [0, S0], [90, poseFrom(S0, { x: -0.8, y: 0.6, rot: { neck: -10, head: -12, ear: -40 } }), "out"],
    [240, poseFrom(S0, { y: 2.8, rot: { hips: 8, neck: -2, head: 8 }, feet: { hindF: { x: 0.2, a: -16 }, hindB: { x: 0.4, a: -16 }, foreF: { x: 1.2 }, foreB: { x: 1.0 } } }), "in"],
    [400, down, "in"], [470, poseFrom(down, { y: -0.3, rot: { head: -6 } }), "out"], [600, down, "inOut"],
  ]), { events: P.ko.events, lag: { tail2: 40, tail3: 60 } });
  return { idle, run, flee, attack, hit, ko };
}
