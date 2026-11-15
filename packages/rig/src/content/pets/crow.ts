/**
 * The crow, drawn from life (15 Nov 2026). A big street crow: an egg body tilted tail-down, a
 * long wedge tail, a heavy arched bill, a flat crown, a pale eye, scaly legs and the blue-grey
 * sheen of crow feathers on the crown, nape and wing coverts, so it reads on the dark arena as a
 * clear silhouette and not a black blob. About 20% of a fighter's height (16.5 of 84 units).
 *
 * Skeleton: body, tail, neck, head, jaw (the lower mandible); wings of three bones from the
 * shoulder (coverts, secondaries, primaries) that lie folded along the side and fan open; legs
 * like the goose's: `.up` the feathered drumstick, `.lo` the bare tarsus, `.foot` the toes, the heel
 * pointing back. Motion: crows hop with both feet together when they hurry (run), flap away low
 * (flee, after Muybridge, Animal Locomotion (1887), plate 756, pigeon flying: the wings sweep down
 * and forward fully open, then come up half folded), and hop in to stab with the bill (attack).
 */
import type { Clip, CompanionClip } from "../../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../../contracts";
import type { Pt } from "../../gate/vocab";
import type { Hi, Rot } from "./anatomy";
import { Anatomy, ellipse, line, poseFrom, profile, restLeg, sampleClip, smooth, sn, track } from "./anatomy";
import type { PetArt } from "./kind";
import { floorClamp } from "./quad-build";
import { gaitOf } from "./quad";

const P = PLACEHOLDER_COMPANION_CLIPS;
/** Touch-down share of the cycle per leg and the duty factor of each gait (the tests read these). */
export const CROW_GAITS = {
  run: { legB: 0, legF: 0, duty: 0.42 },
} as const;
const LEG: readonly [Pt, Pt, Pt] = [[-0.2, -6.0], [-0.8, -3.4], [-0.2, -0.6]];
const FAR: Pt = [0.7, 0];
export const CROW_LIMITS = { hip: [-80, 150], ankle: [-172, -3], toes: [-60, 160] } as const;
const WING = ["wing", "wing.mid", "wing.tip"] as const;

export function crow(): PetArt & { anatomy: Anatomy } {
  const rest: Rot = { body: 0, tail: 0, neck: 0, head: 0, jaw: 0 };
  for (const s of ["F", "B"]) for (const w of WING) rest[w.replace("wing", `wing${s}`)] = 0;
  const shift = (j: readonly [Pt, Pt, Pt], d: Pt): [Pt, Pt, Pt] => j.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt) as [Pt, Pt, Pt];
  restLeg(rest, "legF", "foot", 0, LEG, 0);
  restLeg(rest, "legB", "foot", 0, shift(LEG, FAR), 0);
  const a = new Anatomy(rest);
  a.bone("body", "root", [-0.5, -8.6], [-80, 60]);
  a.bone("tail", "body", [-5.0, -8.2], [-40, 50]);
  a.bone("neck", "body", [3.6, -11.0], [-60, 70]);
  a.bone("head", "neck", [5.4, -13.4], [-70, 80]);
  a.bone("jaw", "head", [8.2, -13.6], [0, 35]);
  for (const [s, d] of [["B", [0.5, -0.4]], ["F", [0, 0]]] as const) {
    a.bone(`wing${s}`, "body", [3.2 + d[0], -11.2 + d[1]], [-30, 120]);
    a.bone(`wing${s}.mid`, `wing${s}`, [-0.4 + d[0], -11.4 + d[1]], [-80, 30]);
    a.bone(`wing${s}.tip`, `wing${s}.mid`, [-3.0 + d[0], -10.8 + d[1]], [-80, 40]);
  }
  const L = CROW_LIMITS;
  a.leg("legB", "foot", "body", shift(LEG, FAR), -1, [L.hip, L.ankle, L.toes], [2.4 + FAR[0], 0], [[2.4 + FAR[0], 0]]);
  a.leg("legF", "foot", "body", LEG, -1, [L.hip, L.ankle, L.toes], [2.4, 0], [[2.4, 0]]);

  const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
  const mv = (pts: readonly Pt[], d: Pt): Pt[] => pts.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt);
  const legParts = (n: string, d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    a.fill(`${n}.up`, mv(S([[-1.3, -7.0], [0.6, -6.6], [0.4, -4.6], [-0.4, -3.3], [-1.5, -3.2], [-1.7, -5.0]]), d), "skin", z, sh);
    a.fill(`${n}.lo`, mv([[-1.1, -3.7], [-0.5, -3.7], [0.1, -0.7], [-0.5, -0.5]], d), "skin", z + 0.1, sh);
    a.fill(`${n}.foot`, mv(floorClamp([[-2.3, 0.15], [-1.9, -0.45], [-0.6, -0.8], [0.4, -0.65], [1.6, -0.4], [2.4, -0.15], [2.55, 0.15]]), d), "skin", z + 0.2, sh);
    if (!far) a.ink(`${n}.lo`, [[[-0.9, -2.8], [-0.5, -2.9]], [[-0.7, -1.9], [-0.3, -2.0]]], 0.12, z + 0.15, false);
  };
  const wing = (s: "B" | "F", d: Pt, z: number, far: boolean): void => {
    const sh = far ? true : undefined;
    const W = (id: string): string => id.replace("wing", `wing${s}`);
    a.fill(W("wing.tip"), mv(S([[-2.8, -11.2], [-6.0, -10.9], [-9.0, -9.7], [-10.0, -8.6], [-8.0, -8.3], [-4.6, -8.9], [-2.8, -9.6]]), d), "hair", z, sh);
    if (!far) a.ink(W("wing.tip"), [line([[-4.4, -10.2], [-7.2, -9.6], [-9.4, -8.8]]), line([[-4.6, -9.4], [-7.6, -8.8]])], 0.14, z + 0.02);
    a.fill(W("wing.mid"), mv(S([[-0.2, -11.6], [-3.4, -11.5], [-6.0, -10.3], [-6.8, -8.9], [-4.4, -8.0], [-1.0, -8.4]]), d), "skin", z + 0.05, sh);
    if (!far) a.ink(W("wing.mid"), [[[-2.4, -9.0], [-2.0, -8.3]], [[-4.0, -9.0], [-3.8, -8.2]], [[-5.4, -9.3], [-5.4, -8.6]]], 0.14, z + 0.06);
    a.fill(W("wing"), mv(S([[4.0, -11.6], [1.4, -12.25], [-1.6, -11.85], [-3.6, -10.6], [-3.4, -9.0], [-1.0, -8.0], [1.6, -7.8], [3.6, -8.8]]), d), far ? "skin" : "accent", z + 0.1, sh);
    if (!far) a.ink(W("wing"), [line([[2.6, -11.0], [0.4, -10.4], [-2.2, -9.6]]), line([[2.4, -9.6], [0.0, -9.0], [-2.0, -8.6]])], 0.14, z + 0.12);
  };
  legParts("legB", FAR, 10, true);
  wing("B", [0.5, -0.4], 18, true);
  // body masses: tail under the body under the neck under the head, one outline
  a.fill("tail", [[-4.6, -9.3], [-8.4, -8.5], [-11.6, -7.1], [-12.1, -6.0], [-11.0, -5.6], [-7.6, -6.2], [-4.8, -7.0]], "skin", 20.0);
  a.ink("tail", [line([[-6.0, -7.9], [-9.4, -7.0], [-11.4, -6.3]])], 0.14, 20.01);
  a.fill("body", S([[4.6, -11.4], [2.0, -12.6], [-1.6, -12.4], [-4.6, -10.8], [-6.2, -8.8], [-5.4, -6.8], [-3.0, -5.4], [0.4, -4.9], [3.2, -5.6], [5.0, -7.4], [5.6, -9.6]]), "skin", 20.05);
  a.fill("body", S([[3.6, -12.0], [0.6, -12.6], [-2.4, -12.1], [-4.4, -10.8], [-1.6, -11.2], [1.6, -11.4]], 3), "accent", 20.07);   // sheen on the back
  a.fill("neck", S([[2.6, -12.4], [4.6, -13.6], [6.4, -13.2], [7.0, -11.4], [6.4, -9.6], [4.4, -9.0], [2.8, -10.0]]), "skin", 20.1);
  a.fill("neck", S([[3.4, -12.6], [4.8, -13.5], [5.9, -13.3], [4.8, -12.6]], 3), "accent", 20.11);                                // sheen on the nape
  a.fill("jaw", [[8.2, -13.7], [11.0, -13.55], [10.8, -15.0], [8.3, -15.0]], "ink", 20.12);
  a.fill("jaw", [[8.0, -13.75], [11.4, -13.5], [10.6, -13.0], [8.4, -12.9]], "skin", 20.13);
  a.fill("head", S([[4.0, -14.0], [4.6, -15.6], [6.2, -16.4], [7.8, -16.0], [8.6, -14.8], [8.4, -13.2], [7.2, -12.4], [5.4, -12.4], [4.2, -12.9]]), "skin", 20.2);
  a.fill("head", S([[4.7, -15.4], [6.2, -16.2], [7.6, -15.9], [6.4, -15.5]], 3), "accent", 20.21);                                 // sheen on the crown
  a.fill("head", [[7.8, -15.25], [9.4, -15.05], [11.2, -14.25], [12.05, -13.45], [11.4, -13.4], [9.2, -13.6], [7.9, -13.85]], "skin", 20.22);   // the heavy bill
  a.ink("head", [line([[8.4, -14.95], [10.0, -14.7], [11.6, -13.9]])], 0.14, 20.225);
  a.fill("head", [[8.6, -14.9], [10.2, -14.68], [11.2, -14.2], [10.2, -14.45], [8.8, -14.6]], "accent", 20.23);                      // the bill's shine
  a.fill("head", ellipse(6.85, -14.7, 0.5, 0.42, 0, 10), "white", 20.24);                                                          // pale eye
  a.inkFill("head", ellipse(7.0, -14.7, 0.2, 0.2, 0, 8), 20.25);
  a.ink("head", [[[6.1, -15.35], [7.6, -15.05]]], 0.22, 20.26);                                                                    // brow
  a.ink("head", [[[7.7, -14.5], [8.4, -14.3]], [[7.7, -14.1], [8.4, -14.0]]], 0.1, 20.26);                                         // nasal bristles
  a.ink("head", [[[4.4, -15.0], [3.7, -15.8]], [[4.7, -15.6], [4.2, -16.5]]], 0.18, 20.26);                                         // ragged crown
  legParts("legF", [0, 0], 40, false);
  wing("F", [0, 0], 45, false);
  a.settleFeet();
  return { rig: a.rig("crow", 16), shapes: a.shapes, clips: clips(a), anatomy: a };
}

function clips(a: Anatomy): Record<CompanionClip, Clip> {
  const { bones, legs } = a;
  const X = legs.find((l) => l.name === "legF")!.restContact[0];
  const wings = (w: number, m: number, t: number, wb = w, mb = m, tb = t): Rot => ({ wingF: w, "wingF.mid": m, "wingF.tip": t, wingB: wb, "wingB.mid": mb, "wingB.tip": tb });
  const zero: Rot = { body: 0, tail: 0, neck: 0, head: 0, jaw: 0, ...wings(0, 0, 0) };
  const S0: Hi = { x: 0, y: 0, rot: zero, feet: { legF: { x: X + 0.6, y: 0, a: 0 }, legB: { x: X - 0.5, y: 0, a: 0 } } };

  const idle = sampleClip(bones, legs, P.idle.durationMs, true, 40, (t) => {
    const u = t / P.idle.durationMs;
    const cock = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 300) / 500))));
    const flick = Math.max(0, 1 - Math.abs(t - 900) / 70);
    return poseFrom(S0, { y: 0.1 * sn(u, 2), rot: { body: 1 * sn(u), neck: -6 * cock, head: 14 * cock, tail: -12 * flick, ...wings(2 * flick, 0, 0) } });
  }, { events: P.idle.events });

  // run: hops, both feet together, the wings flicking open for each
  const toes = { stance: profile([[0, 0], [0.5, 0], [1, 40]]), swing: profile([[0, 40], [0.4, 70], [0.8, 20], [1, 0]]), lift: 1.4 };
  const run = sampleClip(bones, legs, P.run.durationMs, true, 10, gaitOf(legs, {
    duration: P.run.durationMs, phase: CROW_GAITS.run, duty: CROW_GAITS.run.duty, half: 1.4,
    home: { legF: X + 0.2, legB: X - 0.2 }, leg: () => toes,
    body: (u) => { const crouch = Math.max(0, Math.sin(Math.PI * Math.min(1, u / 0.44))); return { y: 0.9 * crouch, rot: { body: 8 + 6 * crouch, tail: -10 * crouch + 8 * sn(u), neck: 6, head: -8 - 4 * crouch,
      ...wings(20 + 40 * Math.max(0, sn(u, 1, -0.45)), -10 - 25 * Math.max(0, sn(u, 1, -0.45)), -10 - 20 * Math.max(0, sn(u, 1, -0.45))) } }; },
    fly: [[0.44, 0.56, 3.2]],
  }), { events: P.run.events, lag: { tail: 30, "wingF.tip": 25, "wingB.tip": 25 }, air: true });

  // flee: low flapping flight, legs tucked, the full downstroke and the half-folded upstroke
  const flee = sampleClip(bones, legs, P.flee.durationMs, true, 10, (t) => {
    const u = t / P.flee.durationMs;
    const beat = sn(u, 1, 0.25);                   // +1 wings up, -1 down
    const up = 6.5 + 0.8 * sn(u, 1, -0.05);
    return { x: 0, y: -up, rot: { body: 12, tail: -6 + 6 * beat, neck: 4, head: -12, jaw: 0,
      ...wings(45 + 55 * beat, -36 + 12 * beat, -32 + 16 * beat, 42 + 55 * beat, -34 + 12 * beat, -30 + 16 * beat) },
    feet: { legF: { x: X - 1.6, y: -up + 1.6, a: 70 }, legB: { x: X - 2.2, y: -up + 1.6, a: 70 } } };
  }, { events: P.flee.events, lag: { tail: 30, "wingF.tip": 20, "wingB.tip": 20 }, air: true });

  // attack: crouch, a hop in with the wings half open, land and drive the bill down at 150
  const crouch = poseFrom(S0, { y: 1.0, rot: { body: 10, tail: -14, neck: 8, head: -6, ...wings(12, -6, -6) } });
  const hop = poseFrom(S0, { x: 1.6, y: -2.6, rot: { body: 6, tail: 10, neck: -10, head: 10, jaw: 18, ...wings(78, -36, -40, 70, -32, -36) },
    feet: { legF: { x: 1.6, y: -2.2, a: 30 }, legB: { x: 1.4, y: -2.2, a: 30 } } });
  const stab = poseFrom(S0, { x: 4.6, y: 0.8, rot: { body: 34, tail: -22, neck: 26, head: 14, jaw: 4, ...wings(46, -30, -30, 40, -26, -26) },
    feet: { legF: { x: 4.8, a: 6 }, legB: { x: 4.4, a: 6 } } });
  const attack = sampleClip(bones, legs, P.attack.durationMs, false, 10, track([
    [0, S0], [50, crouch, "inOut"], [95, hop, "out"], [130, poseFrom(stab, { y: -1.0, rot: { body: -10, neck: -10 }, feet: { legF: { y: -0.6 }, legB: { y: -0.6 } } }), "in"],
    [150, stab, "in"], [190, poseFrom(stab, { rot: { body: -12, neck: -12, head: -6, jaw: 20 } }), "out"], [280, poseFrom(S0, { x: 4.6, feet: { legF: { x: 4.6 }, legB: { x: 4.6 } } }), "inOut"],
  ]), { events: P.attack.events, lag: { tail: 30, "wingF.tip": 25, "wingB.tip": 25 }, air: true });

  const flare = poseFrom(S0, { x: -1.0, y: -0.4, rot: { body: -14, tail: 20, neck: -16, head: -10, jaw: 22, ...wings(84, -40, -44, 76, -36, -40) },
    feet: { legF: { x: -0.6, y: -0.8, a: 30 } } });
  const hit = sampleClip(bones, legs, P.hit.durationMs, false, 10, track([
    [0, S0], [60, flare, "out"], [150, poseFrom(flare, { x: 0.6, y: 0.4, rot: { ...wings(-40, 20, 24) }, feet: { legF: { x: 0.6, y: 0.8, a: -30 } } }), "inOut"], [300, S0, "inOut"],
  ]), { events: P.hit.events, lag: { tail: 30, "wingF.tip": 30, "wingB.tip": 30 }, air: true });

  // ko: the legs give, it pitches forward onto its breast, the bill on the floor, a wing fallen open
  const down: Hi = poseFrom(S0, { x: 0.6, y: 2.4, rot: { body: 34, tail: -24, neck: 30, head: 20, jaw: 12, ...wings(26, -24, -28, 8, -4, -4) },
    feet: { legF: { x: -2.2, y: -1.0, a: 40 }, legB: { x: -2.0, y: -1.0, a: 40 } } });
  const ko = sampleClip(bones, legs, P.ko.durationMs, false, 20, track([
    [0, S0], [90, poseFrom(S0, { x: -0.6, rot: { body: -14, neck: -12, head: -10, ...wings(60, -30, -30) } }), "out"],
    [240, poseFrom(S0, { y: 1.6, rot: { body: 14, neck: 10, head: 6, ...wings(40, -20, -20) }, feet: { legF: { x: -1, a: 20 }, legB: { x: -1, a: 20 } } }), "in"],
    [400, down, "in"], [470, poseFrom(down, { y: -0.4, rot: { head: -8 } }), "out"], [600, down, "inOut"],
  ]), { events: P.ko.events, lag: { tail: 40, head: 40 } });
  return { idle, run, flee, attack, hit, ko };
}
