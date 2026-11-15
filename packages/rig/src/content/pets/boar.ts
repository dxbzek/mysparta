/**
 * The boar, drawn from life (15 Nov 2026). A wild boar, not a farm pig: massive forequarters
 * under a bristled shoulder hump and mane, a narrow sloping rump, a long wedge head ending in the
 * snout disc, up-curved tusks, small erect ears, short thin legs on hooves. About 41% of a
 * fighter's height (35 of 84; the owner's cap is 45%).
 *
 * It stands on the tips of its toes (unguligrade): the hind `.paw` is cannon, pastern and hoof
 * from the hock down, the fore `.paw` the same from the knee (the wrist). Stifle forward, hock
 * back, elbow back, the wrist folding the hoof back in the swing. Motion from Muybridge, Animal
 * Locomotion (1887), plate 674 (sow walking: short stiff strides, the big body barely rocking):
 * the run a heavy trot in diagonal pairs, the flee a short-strided gallop; the attack a charge,
 * head low, then the tusks hooked up through the target.
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
export const BOAR_GAITS = {
  run: { hindB: 0, foreF: 0.02, hindF: 0.5, foreB: 0.52, duty: 0.55 },
  flee: { hindB: 0, hindF: 0.1, foreF: 0.48, foreB: 0.58, duty: 0.34 },
} as const;
const G = 1.27;
const fitP = (p: Pt): Pt => [p[0] * G, p[1] * G];
const FAR: Pt = [0.8, 0];
export const BOAR_ANGLES = { hind: -12, fore: -10 } as const;

export function boar(): PetArt & { anatomy: Anatomy } {
  const a = quadSkeleton({
    body: [-1, -20], hips: [-6, -20.5], chest: [4, -21], neck: [11, -20], head: [14.5, -18.5], jaw: [19, -14.4], ear: [14.6, -22.8],
    tail: [[-16.2, -20.2], [-16.9, -17.8], [-17.2, -15.6]],
    hind: [[-11, -16.5], [-7.2, -11.2], [-11.0, -6.4]], fore: [[9, -16], [6.6, -10.6], [7.6, -5.2]],
    hindAngle: BOAR_ANGLES.hind, foreAngle: BOAR_ANGLES.fore, far: FAR,
    limits: { hip: [-100, 60], stifle: [8, 150], hock: [-150, -2], shoulder: [-80, 100], elbow: [-140, 0], wrist: [-35, 175] },
    map: { body: fitP, head: fitP, hind: fitP, fore: fitP },
  }, 20);
  const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
  const hindParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[-8, -21], [-5.6, -17.4], [-5.4, -13.4], [-6.4, -11.0], [-8.6, -11.2], [-12, -12.6], [-15.2, -14.6], [-15.8, -17.6], [-13.4, -20.6]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[-5.8, -12.4], [-6.8, -10.6], [-9.2, -8.0], [-10.6, -6.6], [-11.8, -6.0], [-12.1, -7.2], [-10.7, -9.4], [-8.9, -11.8], [-7.4, -13.0]]), d), "skin", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp([[-11.9, -6.9], [-10.4, -6.9], [-10.0, -3.2], [-9.6, -1.9], [-8.9, -0.9], [-8.5, 0.2], [-10.5, 0.2], [-10.7, -1.2], [-11.1, -2.6], [-11.7, -4.6]]), d), "hair", z + 0.2, sh);
    if (!far) a.ink(`${n}.paw`, [[[-9.6, -0.9], [-9.5, 0.1]], [[-10.6, -2.4], [-9.6, -2.2]]], 0.2, z + 0.25, false);
  };
  const foreParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[10.6, -18], [11.2, -14.4], [9.6, -11.6], [7.6, -9.8], [5.6, -10.2], [5.4, -12.4], [6.6, -15.4], [8.4, -18.4]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv(S([[7.7, -11.0], [8.2, -8.0], [8.4, -5.6], [7.0, -5.0], [6.6, -7.6], [6.0, -10.4]]), d), "skin", z + 0.1, sh);
    a.fill(`${n}.paw`, mv(floorClamp([[6.9, -5.7], [8.5, -5.7], [8.7, -3.0], [9.1, -1.7], [9.9, -0.8], [10.1, 0.2], [8.0, 0.2], [7.6, -1.4], [7.2, -3.2]]), d), "hair", z + 0.2, sh);
    if (!far) a.ink(`${n}.paw`, [[[9.0, -0.8], [9.0, 0.1]], [[7.4, -2.6], [8.6, -2.6]]], 0.2, z + 0.25, false);
  };
  hindParts("hindB", FAR, 10, true);
  foreParts("foreB", FAR, 11, true);
  // tail: thin, hanging, a dark tuft
  a.fill("tail1", band([[-15.8, -20.4], [-16.6, -19.0], [-16.9, -17.6]], 0.55, 0.45), "skin", 19.9);
  a.fill("tail2", band([[-16.8, -17.9], [-17.1, -16.6], [-17.2, -15.4]], 0.45, 0.4), "skin", 19.8);
  a.fill("tail3", S([[-17.2, -16.0], [-16.4, -15.0], [-16.6, -13.2], [-17.4, -12.6], [-18.0, -13.4], [-17.9, -15.0]], 3), "hair", 19.7);
  a.fill("ear", [[14.6, -22.6], [14.6, -25.6], [15.8, -26.6], [17.0, -24.2], [16.8, -22.4]], "hair", 19.5, true);
  // body masses: narrow rump under barrel under the great forequarters under the neck and head
  a.fill("hips", S([[-4, -22.4], [-8, -23], [-12, -22.4], [-15.4, -20.6], [-17, -17.6], [-16.4, -14.4], [-14, -12.0], [-10.4, -11.4], [-7, -12.4], [-4.4, -15.6]]), "skin", 20.0);
  a.fill("body", S([[-12, -22.6], [-6, -23.4], [0, -24.6], [5, -25.0], [6, -20], [5.6, -13], [2, -10.6], [-3, -10.2], [-8, -10.8], [-11.6, -13], [-12.6, -18]]), "skin", 20.1);
  a.fill("chest", S([[-2, -24.4], [2, -26.2], [6, -27.4], [9.6, -26.6], [12.4, -24.2], [13.8, -21], [13.6, -16.6], [12.2, -12.8], [9.4, -10.8], [5.6, -10.4], [2, -11], [-1, -13], [-2.6, -17.6], [-2.8, -21.6]]), "skin", 20.2);
  // the mane: a bristled crest from the back over the hump to the nape
  const crest: Pt[] = [];
  for (let k = 0; k <= 18; k++) {
    const x = -8 + k;
    const top = -23.4 - 3.6 * Math.exp(-((x - 6) ** 2) / 40);
    crest.push([x, top - (k % 2 === 0 ? 1.1 : 0)]);
  }
  a.fill("chest", [...crest, [10.6, -25.6], [6, -25.4], [0, -24.0], [-6, -22.6], [-8.2, -22.6]], "hair", 20.25);
  a.ink("body", [line([[-8, -20], [-7, -16]]), line([[-4, -21], [-3.2, -16.6]]), line([[0, -22], [0.6, -17.6]]), line([[-10.4, -14.6], [-6, -12.6], [-1, -12.0]])], 0.28, 20.15);
  a.ink("chest", [line([[3.6, -22.4], [4.2, -17.6]]), line([[7.0, -23.4], [7.6, -18.6]]), line([[10.2, -22.2], [10.6, -17.6]])], 0.28, 20.27);
  a.fill("neck", S([[9, -25.6], [12, -25], [14.8, -23.4], [16.2, -20.6], [15.6, -16.6], [13.4, -13.4], [10.4, -12.6], [8.6, -16], [8.4, -21]]), "skin", 20.3);
  a.fill("neck", S([[11.6, -25.2], [14.6, -23.6], [15.2, -22.0], [12.6, -23.0], [10.2, -24.2]], 3), "hair", 20.31);
  a.fill("ear", [[13.6, -22.4], [13.4, -26.0], [15.0, -27.0], [16.4, -24.4], [16.0, -22.4]], "hair", 20.35);
  a.fill("ear", [[14.2, -23.0], [14.2, -25.4], [15.0, -26.0], [15.6, -24.0]], "accent", 20.355);
  a.fill("jaw", [[18.6, -14.6], [26.4, -13.0], [26.2, -15.6], [18.8, -16.6]], "ink", 20.37);
  a.fill("jaw", S([[18.6, -14.7], [22.4, -13.9], [24.6, -13.4], [26.6, -12.7], [26.1, -11.8], [22.0, -11.9], [19.0, -12.8]], 3), "skin", 20.38);
  a.fill("jaw", [[23.4, -13.4], [24.2, -13.6], [24.8, -15.2], [24.5, -16.0], [24.0, -15.0]], "white", 20.385);   // lower tusk
  a.fill("head", S([[13.2, -22.6], [15.4, -24.0], [17.6, -23.2], [20.6, -20.6], [24.4, -17.4], [27.2, -15.2], [27.85, -13.6], [27.4, -12.5], [25.6, -12.65], [22.4, -13.4], [19.2, -14.2], [16.2, -14.6], [13.8, -15.8], [12.8, -19]]), "skin", 20.4);
  a.fill("head", S([[13.4, -22.4], [15.4, -23.8], [17.6, -23.0], [19.4, -21.4], [16.8, -21.0], [14.4, -20.6]], 3), "hair", 20.41);
  a.fill("head", ellipse(27.65, -13.9, 0.75, 1.35, 0, 12), "accent", 20.42);                                       // snout disc
  a.inkFill("head", ellipse(27.75, -14.4, 0.2, 0.32, 0, 8), 20.43);
  a.inkFill("head", ellipse(27.75, -13.3, 0.2, 0.32, 0, 8), 20.43);
  a.fill("head", [[23.4, -13.1], [24.8, -13.25], [25.9, -15.6], [25.7, -17.2], [25.0, -15.7], [24.1, -13.9]], "white", 20.44);   // upper tusk
  a.inkFill("head", ellipse(18.4, -19.5, 0.38, 0.32, 0, 8), 20.45);
  a.ink("head", [[[17.2, -20.6], [19.6, -19.9]]], 0.38, 20.46);                                                      // brow
  a.ink("head", [line([[20.4, -17.8], [22.6, -16.4], [24.6, -15.4]]), line([[19.6, -16.4], [21.6, -15.4]])], 0.22, 20.46);   // wrinkles
  a.ink("head", [[[16.2, -21.6], [17.6, -18.6]]], 0.2, 20.47);                                                       // scar
  hindParts("hindF", [0, 0], 40, false);
  foreParts("foreF", [0, 0], 41, false);
  a.settleFeet();
  return { rig: a.rig("boar", 35), shapes: a.shapes, clips: clips(a), anatomy: a };
}

function clips(a: Anatomy): Record<CompanionClip, Clip> {
  const { bones, legs } = a;
  const X = (n: string): number => legs.find((l) => l.name === n)!.restContact[0];
  const H = BOAR_ANGLES.hind;
  const F = BOAR_ANGLES.fore;
  const zero = { body: 0, hips: 0, chest: 0, neck: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const S0: Hi = { x: 0, y: 0, rot: zero, feet: {
    hindF: { x: X("hindF"), y: 0, a: H }, hindB: { x: X("hindF") + 1.8, y: 0, a: H },
    foreF: { x: X("foreF"), y: 0, a: F }, foreB: { x: X("foreF") - 1.6, y: 0, a: F } } };

  const idle = sampleClip(bones, legs, P.idle.durationMs, true, 40, (t) => {
    const u = t / P.idle.durationMs;
    const snort = Math.max(0, 1 - Math.abs(t - 640) / 90);
    return poseFrom(S0, { y: 0.15 * sn(u, 1, 0.25), rot: { chest: -0.6 * sn(u), neck: 2 * sn(u, 1, 0.1) + 3 * snort, head: -4 * snort, jaw: 4 * snort, ear: -8 * snort,
      tail1: 8 * sn(u, 2), tail2: 10 * sn(u, 2, -0.1), tail3: 12 * sn(u, 2, -0.2) } });
  }, { events: P.idle.events });

  const hindP = { stance: profile([[0, H], [0.5, H + 1], [1, H + 30]]), swing: profile([[0, H + 30], [0.3, H + 50], [0.62, H + 16], [0.88, H - 6], [1, H]]) };
  const foreP = { stance: profile([[0, F], [0.5, F + 1], [1, F + 28]]), swing: profile([[0, F + 28], [0.3, F + 65], [0.52, F + 80], [0.76, F + 28], [0.93, F - 3], [1, F]]) };
  const legOf = (fast: boolean) => (n: string) => (n.startsWith("hind") ? { ...hindP, lift: fast ? 2.6 : 2.0 } : { ...foreP, lift: fast ? 2.8 : 2.2 });
  const run = sampleClip(bones, legs, P.run.durationMs, true, 10, gaitOf(legs, {
    duration: P.run.durationMs, phase: BOAR_GAITS.run, duty: BOAR_GAITS.run.duty, half: 3.8,
    home: { hindF: X("hindF") - 0.4, hindB: X("hindF") + 0.6, foreF: X("foreF") + 1.0, foreB: X("foreF") + 0.2 }, leg: legOf(false),
    body: (u) => { const dip = Math.cos(4 * Math.PI * (u - 0.27)); return { y: 1.2 + 0.4 * dip, rot: { body: 0.5 * sn(u, 2), hips: -1 * sn(u, 2), chest: 1 * sn(u, 2, 0.05),
      neck: 6 - dip, head: 6 + 1.5 * dip, ear: -10, tail1: 10 + 6 * sn(u, 2, 0.1), tail2: 8 * sn(u, 2), tail3: 10 * sn(u, 2, -0.1) } }; },
  }), { events: P.run.events, lag: { tail2: 30, tail3: 50 } });
  const flee = sampleClip(bones, legs, P.flee.durationMs, true, 10, gaitOf(legs, {
    duration: P.flee.durationMs, phase: BOAR_GAITS.flee, duty: BOAR_GAITS.flee.duty, half: 6.6,
    home: { hindF: X("hindF") + 0.4, hindB: X("hindF") + 1.0, foreF: X("foreF") + 1.6, foreB: X("foreF") + 0.8 }, leg: legOf(true),
    body: (u) => { const flex = Math.cos(2 * Math.PI * (u - 0.95)); return { y: 1.8 + 0.5 * Math.cos(2 * Math.PI * (u - 0.25)), rot: { body: 2.5 * sn(u, 1, 0.1), hips: -7 * flex, chest: 5 * flex,
      neck: 10 + 2 * flex, head: 4, ear: -26, jaw: 4, tail1: -30 + 8 * flex, tail2: 10 * sn(u), tail3: 10 * sn(u, 1, -0.1) } }; },
    fly: [[0.445, 0.03, 0.4], [0.925, 0.07, 0.6]],
  }), { events: P.flee.events, lag: { tail2: 30, tail3: 50 }, air: true });

  // attack: head down and the weight on the forelegs, a short charge, the tusks hooked up through the target at 150
  const lower = poseFrom(S0, { x: -0.8, y: 1.6, rot: { body: 3, hips: -3, chest: 4, neck: 16, head: 14, ear: -24, tail1: -30, jaw: 4 } });
  const drive = poseFrom(S0, { x: 4.0, y: 1.0, rot: { body: 5, hips: -4, chest: 5, neck: 20, head: 16, ear: -30, tail1: -40, jaw: 10 },
    feet: { foreF: { x: 4.6, y: -1.2, a: 20 }, foreB: { x: 3.2 }, hindF: { a: 26 }, hindB: { a: 24 } } });
  const hook = poseFrom(S0, { x: 5.0, y: 1.0, rot: { body: -2, hips: 2, chest: -6, neck: -6, head: -24, ear: -30, tail1: -36, jaw: 14 },
    feet: { foreF: { x: 5.6, a: 4 }, foreB: { x: 4.2, a: 10 }, hindF: { a: 28 }, hindB: { a: 26 } } });
  const attack = sampleClip(bones, legs, P.attack.durationMs, false, 10, track([
    [0, S0], [80, lower, "out"], [118, drive, "inOut"], [150, hook, "inOut"], [190, poseFrom(hook, { rot: { head: -6, neck: 4 } }), "inOut"], [280, S0, "inOut"],
  ]), { events: P.attack.events, lag: { tail2: 30, tail3: 50 } });

  const flinch = poseFrom(S0, { x: -1.2, y: 1.0, rot: { body: -3, hips: 4, chest: -3, neck: -10, head: -10, jaw: 16, ear: -40, tail1: 30 },
    feet: { foreF: { x: -0.4, y: -0.8, a: 16 } } });
  const hit = sampleClip(bones, legs, P.hit.durationMs, false, 10, track([
    [0, S0], [60, flinch, "out"], [150, poseFrom(flinch, { x: 0.4, feet: { foreF: { x: 0.4, y: 0.8, a: -16 } } }), "inOut"], [300, S0, "inOut"],
  ]), { events: P.hit.events, lag: { tail2: 30, tail3: 50 } });

  const down = poseFrom(S0, { x: 0.6, y: 8.0, rot: { body: 3, hips: 4, chest: 4, neck: 12, head: 12, jaw: 12, ear: -40, tail1: 20 },
    feet: { hindF: { x: 0.8, a: -50 }, hindB: { x: 1.4, a: -50 }, foreF: { x: 2.6, y: -0.6, a: 80 }, foreB: { x: 2.0, y: -0.6, a: 80 } } });
  const ko = sampleClip(bones, legs, P.ko.durationMs, false, 20, track([
    [0, S0], [100, poseFrom(S0, { x: -0.8, y: 0.6, rot: { neck: -8, head: -10, ear: -30 } }), "out"],
    [240, poseFrom(S0, { y: 3.4, rot: { hips: 6, head: 6 }, feet: { hindF: { x: 0.2, a: -20 }, hindB: { x: 0.4, a: -20 }, foreF: { x: 1.6 }, foreB: { x: 1.2 } } }), "in"],
    [400, down, "in"], [470, poseFrom(down, { y: -0.4, rot: { head: -6 } }), "out"], [600, down, "inOut"],
  ]), { events: P.ko.events, lag: { tail2: 40, tail3: 60 } });
  return { idle, run, flee, attack, hit, ko };
}
