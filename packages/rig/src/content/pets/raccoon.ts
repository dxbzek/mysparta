/**
 * The raccoon, drawn from life (15 Nov 2026). A thick-furred bin raider: the back humped
 * highest over the hips (its hind legs are longer than its fore), a ruff of cheek fur, the black
 * mask with pale brows and muzzle, short rounded ears, a bushy ringed tail held low, dark hands.
 * About 22% of a fighter's height (18.5 of 84 units).
 *
 * It walks on its whole hind sole (plantigrade: the heel touches the floor), so its hind `.paw`
 * is a long flat foot from heel to toes; its hands are near-flat too. Knee forward, heel back,
 * elbow back, wrist folding the hand back in the swing. Run: a trot in diagonal pairs; flee: a
 * humped half-bound, the back gathering and stretching, with two short flights.
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
export const RACCOON_GAITS = {
  run: { hindB: 0, foreF: 0.02, hindF: 0.5, foreB: 0.52, duty: 0.55 },
  flee: { hindB: 0, hindF: 0.06, foreF: 0.46, foreB: 0.56, duty: 0.32 },
} as const;
const G = 1.18;
const fitP = (p: Pt): Pt => [p[0] * G, p[1] * G];
const HEAD_AT: Pt = [8.2, -10.6];
/** The head drawn 1.25x about its joint (a broad face reads at phone size). */
const headP = (p: Pt): Pt => fitP([HEAD_AT[0] + (p[0] - HEAD_AT[0]) * 1.25, HEAD_AT[1] + (p[1] - HEAD_AT[1]) * 1.25]);
const FAR: Pt = [0.5, 0];
export const RACCOON_ANGLES = { hind: -74, fore: -55 } as const;

export function raccoon(): PetArt & { anatomy: Anatomy } {
  const a = quadSkeleton({
    body: [-1, -12.5], hips: [-3.5, -12.8], chest: [2, -11.8], neck: [5.6, -10.8], head: [8.2, -10.6], jaw: [10.0, -9.3], ear: [8.6, -13.2],
    tail: [[-10.2, -12.2], [-13.2, -11.6], [-15.8, -10.4]],
    hind: [[-7, -10.5], [-4.6, -6.4], [-8.0, -1.1]], fore: [[6.2, -8.8], [4.8, -5.6], [5.2, -1.5]],
    hindAngle: RACCOON_ANGLES.hind, foreAngle: RACCOON_ANGLES.fore, far: FAR,
    limits: { hip: [-110, 70], stifle: [8, 160], hock: [-170, -10], shoulder: [-90, 110], elbow: [-160, 0], wrist: [-85, 170] },
    map: { body: fitP, head: headP, hind: fitP, fore: fitP },
  });
  const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
  const hindParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[-5.2, -12.2], [-3.4, -9.6], [-3.5, -6.8], [-4.6, -5.6], [-6.4, -6.0], [-8.6, -7.4], [-10.2, -9.2], [-10.4, -11.4], [-8.4, -13.0]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[-3.7, -7.2], [-4.5, -5.4], [-6.4, -3.3], [-7.3, -1.9], [-8.8, -1.6], [-9.1, -2.7], [-7.9, -4.7], [-6.1, -6.7], [-5.0, -7.7]]), d), "skin", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp([[-9.3, -2.0], [-8.0, -2.1], [-6.0, -1.3], [-4.6, -1.0], [-3.9, -0.5], [-4.1, 0.2], [-9.4, 0.2], [-9.7, -0.9]]), d), "hair", z + 0.2, sh);
    if (!far) a.ink(`${n}.paw`, [[[-4.9, -0.9], [-4.7, -0.1]], [[-5.7, -1.1], [-5.6, -0.1]]], 0.16, z + 0.25, false);
  };
  const foreParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[7.5, -10.2], [7.7, -8.2], [6.5, -6.4], [5.1, -5.0], [3.8, -5.4], [3.8, -7.0], [4.6, -9.0], [5.8, -10.6]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[5.9, -6.3], [6.1, -3.6], [6.0, -1.7], [4.5, -1.5], [4.2, -3.4], [4.1, -5.9]]), d), "hair", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp([[4.3, -2.1], [5.8, -2.1], [6.6, -1.3], [7.6, -0.8], [8.1, -0.3], [7.9, 0.2], [4.2, 0.2], [4.0, -0.9]]), d), "hair", z + 0.2, sh);
    if (!far) a.ink(`${n}.paw`, [[[7.2, -0.8], [7.4, -0.1]], [[6.5, -1.0], [6.6, -0.1]], [[5.8, -1.2], [5.8, -0.1]]], 0.15, z + 0.25, false);
  };
  hindParts("hindB", FAR, 10, true);
  foreParts("foreB", FAR, 11, true);
  // the tail behind the body: bushy, ringed dark, a dark tip
  const tails: [string, Pt[], number, number, number][] = [
    ["tail3", [[-15.7, -10.4], [-17.0, -9.7], [-18.2, -9.1]], 1.7, 1.1, 19.7],
    ["tail2", [[-13.0, -11.7], [-14.6, -11.0], [-16.0, -10.3]], 1.8, 1.7, 19.8],
    ["tail1", [[-9.6, -12.6], [-11.6, -12.4], [-13.4, -11.6]], 1.5, 1.8, 19.9],
  ];
  for (const [id, pts, w0, w1, z] of tails) {
    a.fill(id, band(pts, w0, w1), "skin", z);
    const m = pts[1]!;
    a.fill(id, ellipse(m[0], m[1], 0.62, Math.max(w0, w1) * 1.0, -20, 12), "hair", z + 0.01);
    const e = pts[2]!;
    if (id !== "tail3") a.fill(id, ellipse(e[0] + 0.3, e[1], 0.5, Math.max(w0, w1) * 0.98, -20, 12), "hair", z + 0.012);
  }
  a.fill("tail3", ellipse(-17.9, -9.2, 0.95, 1.05, -20, 12), "hair", 19.71);
  // far ear behind the head
  a.xf = headP;
  a.fill("ear", [[9.1, -12.5], [9.3, -14.5], [10.1, -15.3], [10.9, -14.4], [11.0, -12.7]], "skin", 19.5, true);
  a.xf = fitP;
  // body masses: hips under loin under chest under neck under head
  a.fill("hips", S([[-1, -14.6], [-4, -15.4], [-7.5, -15.0], [-10.0, -13.6], [-11.0, -10.8], [-10.5, -7.8], [-8.4, -6.0], [-5.6, -5.8], [-3.2, -7.0], [-1.6, -10]]), "skin", 20.0);
  a.fill("body", S([[-6.4, -15.2], [-2, -15.6], [2, -14.6], [4, -12.6], [3.6, -7.0], [1.2, -5.0], [-2, -4.8], [-5, -5.4], [-6.6, -8], [-7, -12.6]]), "skin", 20.1);
  a.fill("body", S([[-5.0, -15.3], [-1.4, -15.6], [2.0, -14.7], [0.0, -14.0], [-3.8, -14.2]]), "hair", 20.12);           // dark grizzled back
  a.fill("body", S([[-4.6, -5.6], [-1.8, -5.0], [1.0, -5.1], [2.6, -6.0], [0.4, -6.4], [-3.0, -6.2]]), "accent", 20.13);     // pale belly fur
  a.fill("chest", S([[-0.6, -14.6], [2.4, -14.2], [5.0, -12.8], [7.0, -11.0], [7.6, -8.6], [6.8, -6.2], [4.8, -4.8], [2.2, -4.8], [0, -6.0], [-1.2, -9.2], [-1.4, -12.6]]), "skin", 20.2);
  a.ink("chest", [line([[1.4, -13.0], [2.0, -11.6]]), line([[-0.6, -13.4], [0.0, -12.0]]), line([[3.4, -12.0], [3.8, -10.8]])], 0.18, 20.25);   // fur tufts
  a.fill("neck", S([[3.6, -13.4], [6.0, -13.0], [8.2, -12.4], [9.4, -10.6], [9.0, -8.4], [7.4, -7.0], [5.2, -7.6], [3.8, -10.0]]), "skin", 20.3);
  a.fill("neck", S([[7.4, -11.4], [8.8, -11.0], [9.2, -9.0], [8.2, -7.6], [7.2, -8.6]]), "accent", 20.31);                 // pale cheek ruff
  a.xf = headP;
  a.fill("ear", [[7.8, -12.4], [7.9, -14.6], [8.8, -15.6], [9.8, -14.6], [10.0, -12.8]], "skin", 20.35);
  a.fill("ear", [[8.3, -13.0], [8.4, -14.5], [8.9, -15.0], [9.4, -14.4], [9.4, -13.0]], "accent", 20.355);
  a.fill("jaw", [[9.8, -9.0], [13.6, -8.9], [13.4, -10.6], [9.9, -10.6]], "ink", 20.37);                                      // inside the mouth
  a.fill("jaw", S([[9.4, -9.1], [12.4, -8.95], [14.0, -8.85], [13.7, -8.2], [11.4, -7.9], [9.6, -8.2]], 3), "accent", 20.38);
  a.fill("jaw", [[12.7, -8.95], [13.05, -8.95], [12.9, -9.5]], "white", 20.385);
  a.fill("head", S([[7.0, -11.2], [7.4, -12.8], [8.8, -13.6], [10.4, -13.2], [11.6, -12.0], [13.0, -10.6], [14.4, -9.6], [14.65, -9.0], [13.6, -8.65], [11.8, -8.7], [9.8, -8.3], [8.0, -8.6], [7.0, -9.6]]), "skin", 20.4);
  a.fill("head", S([[8.2, -11.6], [9.6, -12.3], [11.3, -11.85], [12.7, -10.6], [12.3, -10.0], [10.8, -10.3], [9.6, -10.0], [8.6, -10.2]]), "hair", 20.42);   // the mask
  a.fill("head", S([[8.7, -12.7], [10.2, -13.0], [11.6, -12.25], [11.0, -11.95], [9.6, -12.45]], 3), "accent", 20.43);              // pale brow
  a.fill("head", S([[11.8, -10.0], [13.2, -9.85], [14.2, -9.35], [13.4, -8.85], [11.8, -8.95], [11.2, -9.45]], 3), "accent", 20.43); // pale muzzle
  a.inkFill("head", ellipse(14.35, -9.35, 0.48, 0.38, 0, 10), 20.45);                                                                  // nose
  a.fill("head", ellipse(10.7, -11.15, 0.42, 0.3, -12, 10), "white", 20.45);                                                           // eye shine
  a.inkFill("head", ellipse(10.8, -11.12, 0.22, 0.22, 0, 8), 20.46);
  a.ink("head", [[[9.9, -11.75], [11.5, -11.35]]], 0.26, 20.47);                                                                       // narrowed lid
  a.fill("head", [[12.5, -8.75], [12.85, -8.75], [12.68, -8.2]], "white", 20.46);                                                      // a fang
  a.ink("head", [[[8.2, -12.9], [8.6, -13.5]]], 0.2, 20.47);                                                                           // torn brow
  a.xf = fitP;
  hindParts("hindF", [0, 0], 40, false);
  foreParts("foreF", [0, 0], 41, false);
  a.settleFeet();
  return { rig: a.rig("raccoon", 18), shapes: a.shapes, clips: clips(a), anatomy: a };
}

function clips(a: Anatomy): Record<CompanionClip, Clip> {
  const { bones, legs } = a;
  const X = (n: string): number => legs.find((l) => l.name === n)!.restContact[0];
  const H = RACCOON_ANGLES.hind;
  const F = RACCOON_ANGLES.fore;
  const zero = { body: 0, hips: 0, chest: 0, neck: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const S0: Hi = { x: 0, y: 0, rot: zero, feet: {
    hindF: { x: X("hindF"), y: 0, a: H }, hindB: { x: X("hindF") + 1.2, y: 0, a: H },
    foreF: { x: X("foreF"), y: 0, a: F }, foreB: { x: X("foreF") - 0.8, y: 0, a: F } } };

  const idle = sampleClip(bones, legs, P.idle.durationMs, true, 40, (t) => {
    const u = t / P.idle.durationMs;
    const sniff = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 500) / 300))));
    return poseFrom(S0, { y: 0.1 * sn(u, 1, 0.25), rot: { chest: -0.6 * sn(u), neck: 4 * sniff + 2 * sn(u, 6) * sniff, head: 3 * sniff, ear: -10 * sniff,
      tail1: 4 * sn(u), tail2: 5 * sn(u, 1, -0.1), tail3: 6 * sn(u, 1, -0.2), jaw: 1 } });
  }, { events: P.idle.events });

  const hindP = { stance: profile([[0, H], [0.5, H + 1], [1, H + 30]]), swing: profile([[0, H + 30], [0.3, H + 24], [0.6, H + 8], [0.88, H - 4], [1, H]]) };
  const foreP = { stance: profile([[0, F], [0.5, F + 2], [1, F + 32]]), swing: profile([[0, F + 32], [0.3, F + 60], [0.55, F + 66], [0.8, F + 10], [0.94, F - 3], [1, F]]) };
  const legOf = (fast: boolean) => (n: string) => (n.startsWith("hind") ? { ...hindP, lift: fast ? 2.4 : 2.0 } : { ...foreP, lift: fast ? 2.4 : 2.2 });
  const run = sampleClip(bones, legs, P.run.durationMs, true, 10, gaitOf(legs, {
    duration: P.run.durationMs, phase: RACCOON_GAITS.run, duty: RACCOON_GAITS.run.duty, half: 2.6,
    home: { hindF: X("hindF") - 0.3, hindB: X("hindF") + 0.2, foreF: X("foreF") + 0.8, foreB: X("foreF") + 0.3 }, leg: legOf(false),
    body: (u) => { const dip = Math.cos(4 * Math.PI * (u - 0.27)); return { y: 0.8 + 0.3 * dip, rot: { body: 0.6 * sn(u, 2), hips: -1.5 * sn(u, 2), chest: 1.5 * sn(u, 2, 0.05),
      neck: 8 - 1.2 * dip, head: 4 + 2 * dip, ear: -10, jaw: 2, tail1: -4 + 6 * sn(u, 2, 0.1), tail2: 8 * sn(u, 2), tail3: 10 * sn(u, 2, -0.1) } }; },
  }), { events: P.run.events, lag: { tail2: 30, tail3: 50 } });
  const flee = sampleClip(bones, legs, P.flee.durationMs, true, 10, gaitOf(legs, {
    duration: P.flee.durationMs, phase: RACCOON_GAITS.flee, duty: RACCOON_GAITS.flee.duty, half: 5.0,
    home: { hindF: X("hindF") + 0.4, hindB: X("hindF") + 0.8, foreF: X("foreF") + 1.2, foreB: X("foreF") + 0.6 }, leg: legOf(true),
    body: (u) => { const flex = Math.cos(2 * Math.PI * (u - 0.95)); return { y: 1.4 + 0.4 * Math.cos(2 * Math.PI * (u - 0.25)), rot: { body: 2 * sn(u, 1, 0.1), hips: -12 * flex, chest: 9 * flex,
      neck: 14 + 4 * flex, head: -2 - 3 * flex, ear: -30, jaw: 6, tail1: 6 + 6 * flex, tail2: 10 + 6 * sn(u), tail3: 8 * sn(u, 1, -0.1) } }; },
    fly: [[0.385, 0.07, 1.0], [0.885, 0.11, 0.8]],
  }), { events: P.flee.events, lag: { tail2: 30, tail3: 50 }, air: true });

  // attack: hunch, a lunging bite with both hands raking forward, a short worry, back
  const hunch = poseFrom(S0, { x: -0.5, y: 1.2, rot: { body: 2, hips: -6, chest: 6, neck: 10, head: 6, ear: -30, tail1: 10, jaw: 6 } });
  const reach = poseFrom(S0, { x: 3.6, y: -0.2, rot: { body: -10, hips: -2, chest: -12, neck: 26, head: -14, jaw: 38, ear: -36, tail1: 18, tail2: 12 },
    feet: { foreF: { x: 4.8, y: -3.4, a: 40 }, foreB: { x: 4.0, y: -2.4, a: 30 }, hindF: { a: 26 }, hindB: { a: 24 } } });
  const bite = poseFrom(S0, { x: 4.0, y: 0.8, rot: { body: -1, hips: -3, chest: -2, neck: 24, head: -6, jaw: 2, ear: -34, tail1: 12, tail2: 10 },
    feet: { foreF: { x: 5.2, a: 6 }, foreB: { x: 4.4, a: 4 }, hindF: { a: 30 }, hindB: { a: 28 } } });
  const worry = (k: number): Hi => poseFrom(bite, { rot: { neck: 6 * k, head: 14 * k, chest: -2 * k } });
  const attack = sampleClip(bones, legs, P.attack.durationMs, false, 10, track([
    [0, S0], [80, hunch, "inOut"], [125, reach, "in"], [150, bite, "out"], [178, worry(1)], [205, worry(-1)], [230, worry(0.5)], [280, S0, "inOut"],
  ]), { events: P.attack.events, lag: { tail2: 30, tail3: 50 } });

  const flinch = poseFrom(S0, { x: -1.2, y: 1.2, rot: { body: -3, hips: 5, chest: 2, neck: 4, head: 16, jaw: 14, ear: -50, tail1: 30, tail2: 10 },
    feet: { foreF: { x: -0.4, y: -0.8, a: 20 }, hindF: { a: 4 } } });
  const hit = sampleClip(bones, legs, P.hit.durationMs, false, 10, track([
    [0, S0], [60, flinch, "out"], [140, poseFrom(flinch, { x: 0.4, y: -0.3, feet: { foreF: { x: 0.4, y: 0.8, a: -20 } } }), "inOut"], [300, S0, "inOut"],
  ]), { events: P.hit.events, lag: { tail2: 30, tail3: 50 } });

  const down = poseFrom(S0, { x: 0.4, y: 4.8, rot: { body: 2, hips: 6, chest: 6, neck: 10, head: 24, jaw: 10, ear: -50, tail1: 20, tail2: 6 },
    feet: { hindF: { x: 0.4, a: 8 }, hindB: { x: 0.8, a: 8 }, foreF: { x: 3.4, a: 20 }, foreB: { x: 2.8, a: 20 } } });
  const ko = sampleClip(bones, legs, P.ko.durationMs, false, 20, track([
    [0, S0], [90, poseFrom(S0, { x: -0.6, y: 0.5, rot: { neck: -10, head: -10, ear: -40 } }), "out"],
    [240, poseFrom(S0, { y: 2.2, rot: { hips: 6, neck: -2, head: 8 }, feet: { hindF: { x: 0.2, a: 12 }, hindB: { x: 0.4, a: 12 }, foreF: { x: 1.2 }, foreB: { x: 1.0 } } }), "in"],
    [400, down, "in"], [470, poseFrom(down, { y: -0.3, rot: { head: -6 } }), "out"], [600, down, "inOut"],
  ]), { events: P.ko.events, lag: { tail2: 40, tail3: 60 } });
  return { idle, run, flee, attack, hit, ko };
}
