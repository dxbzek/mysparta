/**
 * The goose, drawn from life (redraw of 15 Nov 2026). A heavy domestic goose with a dark
 * saddle (the Pomeranian look): an egg-shaped body with a low paunch, a long neck in an S as ONE
 * smooth tapered outline, a heavy orange bill with a dark nail and saw-edged jaws, short orange
 * legs set back under the body, webbed feet. About 35% of a fighter's height (29 of 84 units).
 *
 * Skeleton:
 *   body, tail; neck1-3 then head and jaw (the bill opens to hiss); the neck's pieces overlap
 *   with slanted joints in one outline group, so the bones bend it and it still draws as one
 *   tube with one outline.
 *   wingF / wingB (arm and coverts, from the shoulder), .mid (the secondaries) and .tip (the
 *   primaries): three blades that lie stacked when folded and fan apart as the wing opens,
 *   back at rest, raised and spread to threaten.
 *   legs: .up the drumstick (tibiotarsus; the knee is hidden in the body), .lo the bare shank
 *   (tarsometatarsus), .foot the webbed toes. The joint between .up and .lo is the ankle: its
 *   heel points back, like a dog's hock.
 *
 * Motion: a goose walks with its legs wide and short, the body rolling over each planted foot and
 * bobbing twice a stride; the web folds as the foot lifts and opens before it lands. Running at
 * a threat it stretches the neck out low, wings half open; it strikes from an S, wings spread,
 * bill open (the hiss).
 */
import type { Clip, CompanionClip } from "../../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../../contracts";
import type { Pt } from "../../gate/vocab";
import type { Foot, GaitFoot, Hi, Rot } from "./anatomy";
import { Anatomy, gaitFootByJoint, ellipse, line, poseFrom, profile, restLeg, sampleClip, smooth, sn, track } from "./anatomy";
import type { PetArt } from "./kind";
import { GOOSE_TORSO } from "./traced-torsos";

const P = PLACEHOLDER_COMPANION_CLIPS;

const LEG: readonly [Pt, Pt, Pt] = [[-0.6, -8.6], [-2.0, -4.4], [-1.4, -0.9]];
const FAR: Pt = [0.6, 0];
const shift = (j: readonly [Pt, Pt, Pt], d: Pt): [Pt, Pt, Pt] => j.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt) as [Pt, Pt, Pt];
const TOE: Pt = [3.4, 0];
const SOLE: Pt[] = [[-2.6, 0], [3.4, 0]];
export const GOOSE_LIMITS = { hip: [-80, 140], ankle: [-165, -3], toes: [-60, 155] } as const;

/** The neck's centre line at rest (base in the breast to the back of the skull) and its half
 *  width along it; the three neck bones sit on it at these indices. */
const NECK: Pt[] = [[3.2, -11.6], [4.4, -13.0], [5.5, -15.4], [6.2, -17.4], [6.8, -19.6], [6.95, -21.6], [6.75, -23.4], [6.45, -25.0], [6.3, -26.0]];
const NECK_W = [1.6, 1.5, 1.42, 1.34, 1.27, 1.21, 1.16, 1.12, 1.1];
const NECK_JOINT = [1, 3, 5, 7];       // neck1, neck2, neck3, head

export function goose(): PetArt & { anatomy: Anatomy } {
  const rest: Rot = { body: 0, tail: 0, neck1: 0, neck2: 0, neck3: 0, head: 0, jaw: 0, wingF: 0, "wingF.mid": 0, "wingF.tip": 0, wingB: 0, "wingB.mid": 0, "wingB.tip": 0 };
  restLeg(rest, "legF", "foot", 0, LEG, 0);
  restLeg(rest, "legB", "foot", 0, shift(LEG, FAR), 0);
  const a = new Anatomy(rest);
  a.bone("body", "root", [-1.0, -10.4], [-40, 40]);
  a.bone("tail", "body", [-10.2, -13.0], [-40, 40]);
  a.bone("neck1", "body", NECK[NECK_JOINT[0]!]!, [-70, 70]);
  a.bone("neck2", "neck1", NECK[NECK_JOINT[1]!]!, [-70, 70]);
  a.bone("neck3", "neck2", NECK[NECK_JOINT[2]!]!, [-70, 70]);
  a.bone("head", "neck3", NECK[NECK_JOINT[3]!]!, [-85, 70]);
  a.bone("jaw", "head", [9.0, -25.05], [0, 35]);
  a.bone("wingB", "body", [4.0, -13.7], [-20, 110]);
  a.bone("wingB.mid", "wingB", [0.4, -14.2], [-60, 30]);
  a.bone("wingB.tip", "wingB.mid", [-6.2, -13.8], [-70, 40]);
  a.bone("wingF", "body", [3.6, -13.3], [-20, 110]);
  a.bone("wingF.mid", "wingF", [0.0, -13.8], [-60, 30]);
  a.bone("wingF.tip", "wingF.mid", [-6.6, -13.4], [-70, 40]);
  const G = GOOSE_LIMITS;
  a.leg("legB", "foot", "body", shift(LEG, FAR), -1, [G.hip, G.ankle, G.toes], [TOE[0] + FAR[0], FAR[1]], SOLE.map((p) => [p[0] + FAR[0], p[1] + FAR[1]] as Pt));
  a.leg("legF", "foot", "body", LEG, -1, [G.hip, G.ankle, G.toes], TOE, SOLE);

  const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
  const mv = (pts: readonly Pt[], d: Pt): Pt[] => pts.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt);
  const legParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[-1.2, -7.4], [0.0, -6.8], [-0.5, -5.2], [-1.6, -4.4], [-2.7, -4.4], [-2.6, -5.9]]), d), "skin", z, sh);   // feathered "trousers" down to the heel
    a.fill(`${n}.lo`, mv(S([[-2.55, -4.9], [-1.5, -4.9], [-0.9, -1.0], [-1.0, -0.6], [-1.9, -0.6], [-2.5, -3.8]], 3), d), "accent", z + 0.1, sh);
    a.fill(`${n}.foot`, mv([[-2.7, 0.15], [-2.5, -0.6], [-1.6, -1.25], [-0.9, -1.25], [0.6, -0.8], [2.4, -0.45], [3.5, -0.2], [3.6, 0.15]], d), "accent", z + 0.2, sh);
    if (!far) a.ink(`${n}.foot`, [[[-0.9, -0.9], [3.3, -0.1]], [[-0.9, -0.6], [2.2, 0.0]]], 0.16, z + 0.25, false);
  };
  // far side, behind the body
  legParts("legB", FAR, 10, true);
  const wing = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    // primaries: long dark flight feathers crossing over the tail
    a.fill(`${n}.tip`, mv(S([[-5.6, -14.6], [-9.6, -15.1], [-13.0, -15.7], [-15.3, -16.0], [-14.2, -15.0], [-11.2, -13.5], [-7.8, -12.4], [-5.6, -12.4]]), d), "hair", z, sh);
    if (!far) a.ink(`${n}.tip`, [line([[-8.0, -13.9], [-11.4, -14.7], [-14.4, -15.6]]), line([[-8.2, -13.0], [-11.0, -13.9], [-13.0, -14.6]])], 0.2, z + 0.05);
    // the arm with coverts and secondaries: a teardrop over the flank, the saddle dark on top
    // the secondaries: a broad blade under the coverts, its trailing edge scalloped
    a.fill(`${n}.mid`, mv(S([[0.6, -13.9], [-3.0, -13.7], [-6.6, -13.2], [-7.8, -12.3], [-6.4, -10.9], [-3.4, -9.9], [-0.4, -9.5], [2.2, -9.7], [2.4, -11.4]]), d), "skin", z + 0.05, sh);
    if (!far) a.ink(`${n}.mid`, [[[-5.6, -11.2], [-5.0, -10.4]], [[-3.6, -10.6], [-3.1, -9.9]], [[-1.4, -10.2], [-1.0, -9.6]]], 0.18, z + 0.06);
    a.fill(n, mv(S([[4.8, -13.0], [3.6, -14.7], [-0.2, -15.4], [-3.8, -15.0], [-5.4, -13.8], [-3.6, -12.2], [-0.2, -11.4], [2.8, -11.3], [4.6, -12.0]]), d), "skin", z + 0.1, sh);
    if (!far) {
      a.fill(n, S([[3.4, -14.6], [-0.2, -15.3], [-4.2, -15.0], [-7.0, -14.0], [-4.4, -13.4], [0.4, -13.7]]), "hair", z + 0.12);
      a.ink(n, [line([[-3.8, -13.0], [-1.2, -12.4], [1.6, -12.2]]), line([[-2.6, -14.0], [0.2, -13.4], [2.8, -13.2]])], 0.2, z + 0.15);
    }
  };
  wing("wingB", [0.4, -0.4], 18, true);
  // body masses: tail under the body, then the neck pieces upward, then the head: one outline
  // the body traced from a CC0 photograph of a walking goose (traced-torsos.ts); the tail's own feathers
  a.fill("body", GOOSE_TORSO, "skin", 20.05);
  a.ink("tail", [[[-10.5, -13.6], [-13.5, -14.4]], [[-10.8, -12.6], [-13.0, -13.0]]], 0.18, 20.06);
  // the neck: three overlapping pieces, each cut on a slant at its base (back side higher) so the
  // lit side runs on unbroken; the head's back covers the top of the last
  const pieces = ["neck1", "neck2", "neck3"];
  pieces.forEach((id, k) => {
    const i0 = NECK_JOINT[k]!;
    const i1 = NECK_JOINT[k + 1]!;
    a.fill(id, neckPiece(k === 0 ? 0 : i0 - 1, Math.min(NECK.length - 1, i1 + 1), k > 0), "skin", 20.1 + k * 0.05);
  });
  a.fill("jaw", [[9.0, -25.2], [12.4, -25.1], [12.2, -26.6], [9.2, -26.6]], "ink", 20.27);                                    // inside the bill
  a.fill("jaw", S([[8.7, -25.25], [10.5, -25.05], [12.6, -24.95], [12.7, -24.6], [11.0, -24.25], [9.2, -24.3]], 3), "accent", 20.28);
  a.fill("jaw", [[9.6, -25.15], [11.6, -25.1], [11.2, -25.7], [9.8, -25.6]], "accent", 20.275);                              // tongue
  a.fill("head", [[9.2, -25.0], [9.6, -25.4], [10.0, -25.0], [10.4, -25.4], [10.8, -25.0], [11.2, -25.4], [11.6, -25.0], [12.0, -25.35], [12.3, -25.0]], "white", 20.276);   // the saw edge
  a.fill("head", S([[5.0, -25.4], [5.1, -27.0], [6.3, -27.95], [7.8, -27.75], [8.8, -26.9], [9.3, -26.0], [9.1, -25.0], [8.0, -24.35], [6.4, -24.2], [5.3, -24.6]]), "skin", 20.3);
  a.fill("head", S([[8.6, -26.75], [10.6, -26.25], [12.2, -25.75], [12.95, -25.3], [12.85, -24.95], [11.0, -25.0], [9.0, -25.0], [8.5, -25.8]], 3), "accent", 20.32);   // upper bill
  a.fill("head", [[12.0, -25.85], [12.95, -25.35], [12.85, -24.95], [12.1, -25.0]], "hair", 20.33);                         // the nail
  a.inkFill("head", ellipse(7.45, -26.55, 0.42, 0.42, 0, 10), 20.34);                                                         // eye
  a.ink("head", [[[6.5, -27.35], [7.4, -27.2], [8.3, -26.85]]], 0.32, 20.35);                                                 // brow
  a.ink("head", [line([[9.0, -25.0], [11.0, -25.05], [12.8, -25.0]])], 0.18, 20.35);                                         // bill line
  a.inkFill("head", ellipse(10.2, -25.95, 0.28, 0.16, -10, 8), 20.35);                                                        // nostril
  a.ink("head", [[[5.2, -26.6], [4.5, -27.2]], [[5.4, -27.3], [4.9, -28.0]]], 0.24, 20.35);                                   // ruffled crown
  // near side
  legParts("legF", [0, 0], 40, false);
  wing("wingF", [0, 0], 45, false);

  function neckPiece(i0: number, i1: number, slant: boolean): Pt[] {
    // offset the centre line both ways by the half width; at a slanted base the back edge starts
    // higher up the neck than the front edge
    const side = (sign: number): Pt[] => {
      const out: Pt[] = [];
      const pts = line(NECK.slice(i0, i1 + 1), 4);
      const ws = line(NECK_W.slice(i0, i1 + 1).map((w, j) => [j, w] as Pt), 4).map((p) => p[1]);
      for (let j = 0; j < pts.length; j++) {
        const p = pts[Math.min(pts.length - 1, j + 1)]!;
        const q = pts[Math.max(0, j - 1)]!;
        const dx = p[0] - q[0];
        const dy = p[1] - q[1];
        const l = Math.hypot(dx, dy) || 1;
        const w = ws[j]! * (j > pts.length - 3 ? 0.94 : 1);
        out.push([pts[j]![0] + (dy / l) * w * sign, pts[j]![1] - (dx / l) * w * sign]);
      }
      return out;
    };
    const front = side(-1);   // +x side for a neck going up
    const back = side(1);
    const skip = slant ? 4 : 0;   // the back edge starts one span later
    const b = back.slice(skip);
    const top = NECK[i1]!;
    const tw = NECK_W[i1]! * 0.94;
    const cap: Pt[] = [];
    const dir = Math.atan2(NECK[i1]![1] - NECK[i1 - 1]![1], NECK[i1]![0] - NECK[i1 - 1]![0]);
    for (let k = 1; k < 6; k++) { const g = dir - Math.PI / 2 + (Math.PI * k) / 6; cap.push([top[0] + Math.cos(g) * tw, top[1] + Math.sin(g) * tw]); }
    return [...front, ...cap, ...b.reverse()];
  }

  a.settleFeet();
  return { rig: a.rig("goose", 29), shapes: a.shapes, clips: gooseClips(a), anatomy: a };
}

// ------------------------------------------------------------------------------- clips
/** Waddle-run: the feet alternate, each down a little over half the stride. */
export const GOOSE_GAITS = { run: { legB: 0, legF: 0.5, duty: 0.56 }, flee: { legB: 0, legF: 0.5, duty: 0.5 } } as const;

function gooseClips(a: Anatomy): Record<CompanionClip, Clip> {
  const bones = a.bones;
  const legs = a.legs;
  const TX = legs.find((l) => l.name === "legF")!.restContact[0];
  const S0: Hi = {
    x: 0, y: 0, rot: { body: 0, tail: 0, neck1: 0, neck2: 0, neck3: 0, head: 0, jaw: 0, wingF: 0, "wingF.mid": 0, "wingF.tip": 0, wingB: 0, "wingB.mid": 0, "wingB.tip": 0 },
    feet: { legF: { x: TX + 0.8, y: 0, a: 0 }, legB: { x: TX - 0.6, y: 0, a: 0 } },
  };
  // the toes: flat on the floor, the heel peeling up at the push-off, curled down (web folded) as
  // the foot swings, opened again before it lands
  const stance = profile([[0, 0], [0.55, 0], [1, 34]]);
  const swing = profile([[0, 30], [0.35, 36], [0.7, 16], [0.9, -3], [1, 0]]);

  // the wing opens as a fan: the secondaries take most of the primaries' spread, the primaries the
  // rest, so a spread wing shows three blades fanned from the shoulder
  const fan = (h: Hi): Hi => {
    const rot = { ...h.rot };
    for (const w of ["wingF", "wingB"]) { const t = rot[`${w}.tip`] ?? 0; rot[`${w}.mid`] = 0.9 * t; rot[`${w}.tip`] = 0.75 * t; }
    return { ...h, rot };
  };
  const sampleFan: typeof sampleClip = (b, l, d, loop, step, at, r) => sampleClip(b, l, d, loop, step, (t) => fan(at(t)), r);
  const idle = sampleFan(bones, legs, P.idle.durationMs, true, 40, (t) => {
    const u = t / P.idle.durationMs;
    const look = Math.max(0, 1 - Math.abs(t - 640) / 200);
    return poseFrom(S0, { y: 0.15 * sn(u, 1, 0.25),
      rot: { body: 0.6 * sn(u), neck1: 2 * sn(u, 1, 0.1), neck2: -2.5 * sn(u, 1, 0.15), neck3: 2 * sn(u, 1, 0.2) - 6 * look, head: -2 * sn(u, 1, 0.3) + 10 * look,
        tail: 10 * sn(u, 3) * Math.max(0, sn(u, 1, 0.6)), wingF: 1.2 * sn(u), wingB: 1.2 * sn(u), jaw: 0 } });
  }, { events: P.idle.events });

  const gait = (g: { legB: number; legF: number; duty: number }, fast: boolean) => {
    const feet: Record<string, GaitFoot> = {};
    for (const n of ["legB", "legF"] as const) feet[n] = { leg: n, down: g[n], duty: g.duty, half: fast ? 2.4 : 2.2, lift: fast ? 2.6 : 2.4, angle: swing, stance, soft: true };
    const home: Record<string, number> = { legF: TX + 1.6, legB: TX + 1.0 };
    return (t: number): Hi => {
      const u = t / P.run.durationMs;
      const ft: Record<string, Foot> = {};
      for (const [n, gf] of Object.entries(feet)) { const f = gaitFootByJoint(gf, legs.find((l) => l.name === n)!, home[n]!, u); ft[n] = { x: f.x, y: f.y, a: f.a }; }
      const bob = Math.cos(4 * Math.PI * (u - 0.28));                     // low over each planted foot
      const roll = sn(u, 1, 0.1);                                        // rocks onto one foot then the other
      const flap = fast ? sn(u, 2, 0.05) : 0;
      return { x: 0, y: 1.0 + 0.4 * bob, feet: ft, rot: {
        body: (fast ? 10 : 7) + 2.5 * roll, tail: 6 * roll,
        // neck stretched out low and forward, the head level: a goose running at a threat
        neck1: (fast ? 50 : 42) - 2 * bob, neck2: (fast ? 14 : 12) + 2 * bob, neck3: (fast ? 8 : 10), head: (fast ? -64 : -58) - 2.5 * roll, jaw: fast ? 8 : 18,
        wingF: (fast ? 52 : 24) + (fast ? 34 : 5) * flap + 3 * roll, "wingF.tip": (fast ? -22 : -10) + 22 * flap,
        wingB: (fast ? 48 : 20) + (fast ? 34 : 5) * flap - 3 * roll, "wingB.tip": (fast ? -20 : -8) + 22 * flap } };
    };
  };
  const run = sampleFan(bones, legs, P.run.durationMs, true, 10, gait(GOOSE_GAITS.run, false), { events: P.run.events, lag: { "wingF.tip": 25, "wingB.tip": 25, tail: 30 } });
  const flee = sampleFan(bones, legs, P.flee.durationMs, true, 10, gait(GOOSE_GAITS.flee, true), { events: P.flee.events, lag: { "wingF.tip": 25, "wingB.tip": 25, tail: 30 } });

  // ---- attack: rear back into an S with wings spread and the bill open (the hiss), then strike
  const hiss = poseFrom(S0, { x: -0.8, y: 0.4, rot: { body: -10, tail: 14, neck1: -6, neck2: 26, neck3: -44, head: 34, jaw: 30,
    wingF: 64, "wingF.tip": -40, wingB: 58, "wingB.tip": -36 }, feet: { legF: { a: 0 } } });
  const strike = poseFrom(S0, { x: 2.2, y: 1.0, rot: { body: 14, tail: -6, neck1: 46, neck2: 10, neck3: 6, head: -66, jaw: 4,
    wingF: 66, "wingF.tip": -34, wingB: 60, "wingB.tip": -30 }, feet: { legF: { x: 2.6, a: 0 }, legB: { a: 28 } } });
  const step: Hi = poseFrom(strike, { rot: { neck1: -22, neck2: 10, head: 52, jaw: 20 }, feet: { legF: { y: -1.4, x: -0.8, a: 14 } } });
  const attack = sampleFan(bones, legs, P.attack.durationMs, false, 10, track([
    [0, S0], [80, hiss, "out"], [106, poseFrom(hiss, { rot: { neck2: 4, neck3: -6, head: 4 } }), "inOut"], [126, step, "lin"], [150, strike, "lin"],
    [185, poseFrom(strike, { rot: { neck1: -6, head: 6, jaw: 22 } }), "inOut"], [215, poseFrom(strike, { rot: { neck1: -14, neck2: 10, head: 4, jaw: 4, wingF: -20, wingB: -20 } }), "inOut"], [280, S0, "inOut"],
  ]), { events: P.attack.events, lag: { "wingF.tip": 25, "wingB.tip": 25, tail: 30 } });

  const recoil = poseFrom(S0, { x: -1.4, y: 0.4, rot: { body: -14, tail: 16, neck1: -24, neck2: 10, neck3: 16, head: -10, jaw: 16,
    wingF: 74, "wingF.tip": -40, wingB: 68, "wingB.tip": -36 }, feet: { legF: { y: -1.2, x: -1.0, a: 14 } } });
  const hit = sampleFan(bones, legs, P.hit.durationMs, false, 10, track([
    [0, S0], [60, recoil, "out"], [140, poseFrom(recoil, { x: 1.0, rot: { neck1: 12, wingF: -40, wingB: -40, jaw: -10 }, feet: { legF: { y: 1.2, x: 1.0, a: -14 } } }), "inOut"], [300, S0, "inOut"],
  ]), { events: P.hit.events, lag: { "wingF.tip": 30, "wingB.tip": 30, head: 30 } });

  // ---- ko: the legs fold, it sinks onto its belly, the neck flops forward onto the floor, a
  // wing falls open; lands at 400
  const slump = poseFrom(S0, { y: 2.6, rot: { body: -6, neck1: 20, neck2: -10, neck3: -10, head: 20, wingF: 30, wingB: 20, jaw: 10 },
    feet: { legF: { x: -1.2, a: 30 }, legB: { x: -1.0, a: 30 } } });
  const down = poseFrom(S0, { x: 0.6, y: 4.6, rot: { body: 8, tail: -10, neck1: 66, neck2: 14, neck3: 2, head: -66, jaw: 14,
    wingF: 22, "wingF.tip": -20, wingB: 8, "wingB.tip": -6 }, feet: { legF: { x: -3.2, y: -0.4, a: 30 }, legB: { x: -2.8, y: -0.4, a: 30 } } });
  const ko = sampleFan(bones, legs, P.ko.durationMs, false, 20, track([
    [0, S0], [90, poseFrom(S0, { x: -1, rot: { body: -10, neck1: -18, neck2: 12, head: -8, wingF: 60, wingB: 54 } }), "out"], [240, slump, "in"],
    [400, down, "in"], [470, poseFrom(down, { y: -0.4, rot: { neck1: -4, head: -6, wingF: 6 } }), "out"], [600, down, "inOut"],
  ]), { events: P.ko.events, lag: { "wingF.tip": 40, "wingB.tip": 40, head: 40 } });

  return { idle, run, flee, attack, hit, ko };
}
