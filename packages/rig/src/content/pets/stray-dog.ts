/**
 * The stray dog, v3 (15 Nov 2026; owner: "Dog doesn't look like a dog"). Drawn frame by frame:
 *
 *  - Its body and legs are whole silhouettes, one per drawn frame, on the "body" bone, named
 *    "body@N" (the engine draws a frame's shapes only while the "frame" bone's angle rounds to N).
 *    Frames 0 to 5 are traced from Muybridge's galloping hound (plate 710, see dog-frames.ts);
 *    frame 6 standing and frame 7 lying are drawn by hand at the same proportions (checked
 *    against side photos of street dogs: deep chest, tucked belly, upright ears).
 *  - Head, jaw, ears and the tail stay on bones so they can turn: a head with a long muzzle, a
 *    clear stop and big upright ears (one torn), a scarred muzzle; a bushy sickle tail.
 *
 * Every frame is registered on the head joint, so the head rides steady while the body works
 * under it, as in the photographs; the engine puts each frame's lowest point on the floor (and
 * leaves the stretched flight of the gallop in the air). About 30% of a fighter's height.
 */
import type { Clip, CompanionClip, Key, Shape } from "../../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../../contracts";
import type { Poly, Pt } from "../../gate/vocab";
import { dPolys } from "../../gate/vocab";
import type { Rot } from "./anatomy";
import { Anatomy, band, ellipse, line, smooth } from "./anatomy";
import type { PetArt } from "./kind";
import type { DogFrame } from "./dog-frames";
import { GALLOP_FRAMES } from "./dog-frames";

const P = PLACEHOLDER_COMPANION_CLIPS;
/** The head joint stands this high over the floor in the standing frame. */
const HEAD_Y = 15;
/** The picture is drawn in round numbers, then fitted to 30% of a fighter. */
const K = 0.9;
/** How far the head joint stands ahead of the actor's place (the middle of the standing dog). */
const MID = 13;
/** The drawn tail's pivot (the hand-drawn frames; the traced ones carry the hound's own tail). */
const HIPS: Pt = [-14, 2];
const TAIL_AT: Pt = [-26.4, 1.2];

const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
const mv = (pts: readonly Pt[], dx: number, dy = 0): Pt[] => pts.map((p) => [p[0] + dx, p[1] + dy] as Pt);

// ------------------------------------------------------------------------- hand frames
/** Standing (frame 6): the head held high, the floor 19 under the head joint; deep chest, a
 *  tucked belly, the hind leg's long hock, the forelegs straight under the withers. */
const STAND: DogFrame = (() => {
  const torso = mv(S([[1.6, 0], [-2, 0.2], [-6, 0.6], [-12, 0.9], [-18, 0.8], [-23, 0.7], [-26.4, 2.2], [-28, 4.6], [-27.8, 7.4], [-25.4, 9.4],
    [-21, 9.0], [-17, 7.2], [-12, 7.8], [-8, 9.6], [-4.8, 9.8], [-2.4, 8.2], [-0.8, 5.6], [1.2, 2.6]]), 0, -1.2);
  const fore = (dx: number): Pt[] => mv(S([[-4.0, 6.4], [-5.1, 11], [-5.3, 15.4], [-5.2, 17.4], [-3.9, 18.1], [-3.4, 18.6], [-3.6, 19], [-7.3, 19], [-7.5, 18.4],
    [-7.5, 17.4], [-7.7, 15.6], [-8.0, 12], [-8.8, 8.4], [-8.8, 6.6]], 3), dx);
  const hind = (dx: number): Pt[] => mv(S([[-19.0, 5.0], [-18.3, 9.6], [-20.0, 12.4], [-21.9, 14.4], [-21.8, 17.4], [-20.0, 18.2], [-19.6, 18.6], [-19.8, 19], [-23.6, 19],
    [-23.7, 17.8], [-24.4, 14.4], [-25.6, 12.6], [-27.6, 9.8], [-28.4, 6.2]], 3), dx);
  return { lift: 0, tail: TAIL_AT, body: [torso, fore(0), hind(0)], shade: [fore(-2.3), hind(1.8)] };
})();
/** Lying on its chest (frame 7): floor at y = 6.5, forelegs out in front, the hind legs folded. */
const LIE: DogFrame = (() => {
  const torso = S([[2, -1.0], [-3, -1.3], [-9, -1.0], [-15, -0.8], [-21, -0.4], [-25.6, 1.2], [-28.4, 3.8], [-27.8, 6.5], [-20, 6.5], [-10, 6.5], [-3, 6.5], [0.2, 4.8], [2, 2]]);
  const fore = S([[-2.4, 4.4], [3.6, 4.8], [8.4, 5.4], [9.2, 6.5], [-2.4, 6.5]], 3);
  const haunch = S([[-19.5, 1.5], [-15.5, 3.4], [-15.4, 6.5], [-24, 6.5], [-24.8, 3.4]], 3);
  return { lift: 0, tail: [-26.4, 2.4], body: [torso, fore, haunch], shade: [mv(fore, -1.2, -0.6)] };
})();
const FRAMES: readonly DogFrame[] = [...GALLOP_FRAMES, STAND, LIE];
export const DOG_FRAME = { gallop: [0, 1, 2, 3, 4, 5], stand: 6, lie: 7 } as const;

export function strayDog(): PetArt & { anatomy: Anatomy } {
  const rest: Rot = { body: 0, frame: 0, head: 0, jaw: 0, ear: 0, hips: 0, tail1: 0, tail2: 0, tail3: 0 };
  const a = new Anatomy(rest);
  // the head joint stands HEAD_Y over the floor; everything below is drawn about it
  // ... and the actor's place sits under the middle of the body, not under the head
  a.xf = (p) => [(p[0] + MID) * K, (p[1] - HEAD_Y) * K];
  a.bone("frame", "root", [0, HEAD_Y]);
  a.bone("body", "root", [0, 0], [-25, 25]);
  a.bone("head", "body", [0, 0], [-50, 70]);
  a.bone("jaw", "head", [4.2, 1.2], [0, 45]);
  a.bone("ear", "head", [1.6, -3.0], [-60, 25]);
  a.bone("hips", "body", HIPS, [-30, 30]);
  a.bone("tail1", "hips", TAIL_AT, [-110, 80]);
  a.bone("tail2", "tail1", [-28.6, -0.8], [-80, 80]);
  a.bone("tail3", "tail2", [-30.0, -3.2], [-80, 80]);

  // frames: each silhouette with its shading, in one outline group with the head
  const clockwise = (poly: readonly Pt[]): Pt[] => {
    let area = 0;
    poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]!; area += p[0] * q[1] - q[0] * p[1]; });
    return area < 0 ? [...poly].reverse() : [...poly];
  };
  FRAMES.forEach((f, n) => {
    const shape: Shape = { bone: `body@${n}`, d: dPolys(f.body.map((p) => a.local("body", clockwise(p)) as Poly)), slot: "skin", z: 20 };
    // the far legs of the hand-drawn frames sit in shadow; the traced frames keep one clean
    // silhouette (the photograph's own shading flickered from frame to frame)
    if (n >= DOG_FRAME.stand && f.shade.length > 0) shape.shade = dPolys(f.shade.map((p) => a.local("body", clockwise(p)) as Poly));
    a.shapes.push(shape);
  });

  // the drawn tail, for the frames drawn by hand (the traced frames carry the hound's own):
  // bushy, carried in a sickle, a pale tip
  const tailFill = (bone: string, pts: Pt[], slot: "skin" | "accent", z: number): void => {
    for (const n of [DOG_FRAME.stand, DOG_FRAME.lie]) a.shapes.push({ bone: `${bone}@${n}`, d: dPolys([a.local(bone, pts) as Poly]), slot, z });
  };
  tailFill("tail3", band([[-30.0, -3.2], [-30.4, -5.4], [-29.6, -7.2]], 1.25, 0.75), "skin", 19.7);
  tailFill("tail3", band([[-30.25, -5.9], [-29.6, -7.2]], 1.0, 0.7), "accent", 19.72);
  tailFill("tail2", band([[-28.4, -0.9], [-29.6, -2.0], [-30.1, -3.4]], 1.6, 1.3), "skin", 19.8);
  tailFill("tail1", band([[-25.0, 2.0], [-26.8, 0.6], [-28.6, -0.8]], 1.6, 1.6), "skin", 19.9);

  // the far ear, behind the head
  a.fill("ear", [[2.4, -2.6], [2.6, -7.0], [3.4, -8.0], [5.0, -4.2], [4.8, -2.4]], "skin", 19.5, true);
  // the neck root over the cut, then the head on top
  a.fill("head", ellipse(-0.6, 0.6, 3.2, 3.6, -20, 16), "skin", 20.3);
  a.fill("ear", [[0.0, -2.4], [-0.4, -6.6], [0.6, -9.0], [1.6, -7.6], [2.0, -7.0], [1.7, -6.4], [2.7, -5.6], [3.2, -2.6]], "skin", 20.35);   // big, upright, torn
  a.fill("ear", [[0.8, -3.2], [0.6, -6.6], [1.1, -7.8], [2.2, -3.6]], "accent", 20.355);
  a.fill("jaw", [[4.4, 1.0], [10.0, 1.0], [9.8, -0.8], [4.6, -0.6]], "ink", 20.37);                                    // inside the mouth
  a.fill("jaw", S([[3.8, 0.9], [6.6, 1.2], [9.4, 1.2], [10.2, 1.6], [9.6, 2.3], [7.0, 2.7], [4.6, 2.6], [3.2, 1.9]], 3), "skin", 20.38);
  a.fill("jaw", [[8.6, 1.2], [9.1, 1.2], [8.85, 0.4]], "white", 20.385);
  a.fill("head", S([[-1.8, -0.4], [-1.2, -2.6], [1.0, -3.6], [3.4, -3.7], [4.9, -3.0], [5.6, -2.3], [8.0, -1.9], [10.2, -1.5], [10.9, -0.6],
    [10.6, 0.6], [9.4, 1.1], [6.4, 1.2], [3.6, 1.6], [1.0, 2.4], [-1.2, 1.6]]), "skin", 20.4);
  a.fill("head", S([[5.8, -2.2], [8.0, -1.8], [10.2, -1.4], [10.85, -0.6], [10.5, 0.6], [9.4, 1.05], [6.6, 1.1], [5.8, -0.4]], 3), "hair", 20.42);   // dark muzzle
  a.fill("head", [[8.6, 1.05], [9.15, 1.05], [8.9, 1.9]], "white", 20.44);                                            // fang over the lip
  a.inkFill("head", ellipse(10.5, -0.75, 0.7, 0.55, 0, 10), 20.45);                                                   // nose
  a.fill("head", ellipse(3.6, -1.9, 0.62, 0.42, -10, 10), "accent", 20.44);                                           // eye
  a.inkFill("head", ellipse(3.75, -1.9, 0.32, 0.32, 0, 8), 20.45);
  a.ink("head", [[[2.4, -2.9], [3.8, -2.7], [5.0, -2.2]]], 0.36, 20.46);                                              // hard brow at the stop
  a.ink("head", [line([[5.0, 1.15], [7.4, 1.2], [9.6, 1.0]])], 0.22, 20.46);                                          // lip line
  a.ink("head", [[[6.4, -2.0], [7.2, -0.9], [7.5, -0.2]], [[0.2, -1.4], [1.2, -0.4]]], 0.18, 20.47);                  // scars
  a.ink("head", [[[-1.0, 1.0], [0.4, 2.0]], [[-1.6, -0.4], [-0.6, 0.6]]], 0.2, 20.47);                                 // ruff
  return { rig: a.rig("stray-dog", 25), shapes: a.shapes, clips: clips(a), anatomy: a };
}

// ------------------------------------------------------------------------------- clips
interface Beat { t: number; frame: number; rot?: Rot; root?: Pt; scale?: readonly [number, number]; ease?: "lin" | "in" | "out" | "inOut" }
const easeOf = (u: number, e: Beat["ease"]): number => (e === "in" ? u * u : e === "out" ? 1 - (1 - u) * (1 - u) : e === "inOut" ? u * u * (3 - 2 * u) : u);
/**
 * A clip from beats, sampled every 10 ms: the drawn frame steps at each beat (two keys at the same
 * time just before it, so the "frame" bone never passes through other frames), every other bone and the root
 * ease between beats. A beat's root y defaults to its frame's own flight (a gallop's stretched
 * frame stays in the air).
 */
function framesClip(c: CompanionClip, beats: readonly Beat[], lag: Rot, loop = false): Clip {
  const full = beats.map((b) => ({ ...b, rot: { hips: 0, ...b.rot } as Rot, root: [(b.root?.[0] ?? 0) * K, -(b.root?.[1] ?? 0) * K] as const, scale: b.scale ?? [1, 1] as const }));
  const keyAt = (t: number, frame: number): Key => {
    let i = 0;
    while (i + 1 < full.length - 1 && t >= full[i + 1]!.t) i++;
    const A = full[i]!;
    const B = full[Math.min(i + 1, full.length - 1)]!;
    const u = B.t > A.t ? easeOf(Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))), B.ease) : 0;
    const rot: Rot = { frame };
    for (const k of new Set([...Object.keys(A.rot), ...Object.keys(B.rot)])) { const va = A.rot[k] ?? 0; rot[k] = va + ((B.rot[k] ?? va) - va) * u; }
    const mix = (x: number, y: number): number => x + (y - x) * u;
    // a frame's own flight steps with the frame; a beat's extra lift eases
    return { t, rot, root: [mix(A.root[0], B.root[0]), mix(A.root[1], B.root[1]) - FRAMES[frame]!.lift * K], scale: [mix(A.scale[0], B.scale[0]), mix(A.scale[1], B.scale[1])] };
  };
  const keys: Key[] = [];
  const d = P[c].durationMs;
  for (let i = 0; i * 10 <= d; i++) {
    const t = i * 10;
    let j = 0;
    while (j + 1 < full.length && t >= full[j + 1]!.t) j++;
    const frame = full[j]!.frame;
    const prevFrame = keys.length > 0 ? keys[keys.length - 1]!.rot!["frame"]! : frame;
    // the new frame is up a millisecond before its beat, so the beat itself (a contact) shows it
    if (frame !== prevFrame) keys.push(keyAt(t - 1, prevFrame), keyAt(t - 1, frame));
    keys.push(keyAt(t, frame));
  }
  return { duration: d, loop, events: P[c].events, keys, lag };
}

function clips(_a: Anatomy): Record<CompanionClip, Clip> {
  const G = DOG_FRAME.gallop;
  const stride = (tail: Rot, head: Rot): Beat[] => [
    ...G.map((n, i) => ({ t: i * 40, frame: n, rot: { head: head.head! + [0, 1, 2, 1, -1, -1][i]!, ear: head.ear!, jaw: head.jaw!, tail1: tail.tail1! + [0, -6, -10, -4, 4, 6][i]!,
      tail2: tail.tail2! + [0, 4, 8, 4, -2, -4][i]!, tail3: tail.tail3! } })),
    { t: 240, frame: G[0]!, rot: { head: head.head!, ear: head.ear!, jaw: head.jaw!, tail1: tail.tail1!, tail2: tail.tail2!, tail3: tail.tail3! } },
  ];
  const run = framesClip("run", stride({ tail1: -48, tail2: 18, tail3: 14 }, { head: 4, ear: -18, jaw: 8 }), { tail2: 30, tail3: 50 }, true);
  const flee = framesClip("flee", stride({ tail1: -96, tail2: -10, tail3: 0 }, { head: 10, ear: -52, jaw: 4 }), { tail2: 30, tail3: 50 }, true);
  const ST = DOG_FRAME.stand;
  const idle = framesClip("idle", [
    { t: 0, frame: ST, rot: { head: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0, jaw: 2 } },
    { t: 600, frame: ST, rot: { head: -2, ear: 0, tail1: 5, tail2: 6, tail3: 8, jaw: 4 }, scale: [1, 0.985], ease: "inOut" },
    { t: 720, frame: ST, rot: { head: -2, ear: -18, tail1: 5, tail2: 6, tail3: 8, jaw: 4 }, ease: "out" },
    { t: 820, frame: ST, rot: { head: -1, ear: 0, tail1: 3, tail2: 3, tail3: 4, jaw: 3 }, ease: "inOut" },
    { t: 1200, frame: ST, rot: { head: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0, jaw: 2 }, scale: [1, 1], ease: "inOut" },
  ], { tail2: 40, tail3: 70, ear: 20 }, true);
  // attack: gather (the hound's gathered frame), the stretched lunge in the air, the landing
  // bite at 150 with the jaw snapping shut, a hard head shake, back to standing
  const attack = framesClip("attack", [
    { t: 0, frame: ST, rot: { head: 0, jaw: 2, ear: 0, tail1: 0, tail2: 0, tail3: 0 } },
    { t: 70, frame: G[0]!, rot: { head: 10, jaw: 10, ear: -30, tail1: -40, tail2: 10, tail3: 8 }, root: [-0.8, 0], ease: "out" },
    { t: 110, frame: G[2]!, rot: { head: -6, jaw: 40, ear: -40, tail1: -50, tail2: 14, tail3: 10 }, root: [3.0, 0], ease: "out" },
    { t: 150, frame: G[3]!, rot: { head: 4, jaw: 0, ear: -40, tail1: -40, tail2: 10, tail3: 8 }, root: [4.6, 0], ease: "in" },
    { t: 175, frame: G[3]!, rot: { head: 22, jaw: 0, ear: -40, tail1: -30 }, root: [4.6, 0] },
    { t: 198, frame: G[3]!, rot: { head: -14, jaw: 0, ear: -40, tail1: -36 }, root: [4.6, 0] },
    { t: 220, frame: G[4]!, rot: { head: 16, jaw: 4, ear: -40, tail1: -30 }, root: [4.0, 0] },
    { t: 250, frame: ST, rot: { head: -4, jaw: 4, ear: -20, tail1: -10, tail2: 0, tail3: 0 }, root: [1.6, 0], ease: "out" },
    { t: 280, frame: ST, rot: { head: 0, jaw: 2, ear: 0, tail1: 0, tail2: 0, tail3: 0 }, root: [0, 0], ease: "inOut" },
  ], { tail2: 30, tail3: 50 });
  // hit: a flinch, the head jerked down and away, ears flat, tail tucked, a hop back
  const hit = framesClip("hit", [
    { t: 0, frame: ST, rot: { head: 0, jaw: 2, ear: 0, tail1: 0, tail2: 0, tail3: 0 } },
    { t: 60, frame: ST, rot: { head: 26, jaw: 18, ear: -55, tail1: -70, tail2: -20, tail3: -10 }, root: [-1.8, 0.8], scale: [1.04, 0.94], ease: "inOut" },
    { t: 140, frame: ST, rot: { head: 14, jaw: 8, ear: -45, tail1: -80, tail2: -10, tail3: 0 }, root: [-0.8, 0], scale: [1, 1], ease: "inOut" },
    { t: 300, frame: ST, rot: { head: 0, jaw: 2, ear: 0, tail1: 0, tail2: 0, tail3: 0 }, root: [0, 0], ease: "inOut" },
  ], { tail2: 40, tail3: 60, ear: 30 });
  // ko: it staggers, the legs go, it drops onto its chest (400), the head sinks onto its paws
  const ko = framesClip("ko", [
    { t: 0, frame: ST, rot: { head: 0, jaw: 2, ear: 0, tail1: 0, tail2: 0, tail3: 0 } },
    { t: 90, frame: ST, rot: { head: -16, jaw: 14, ear: -40, tail1: -40 }, root: [-0.8, 0.6], ease: "out" },
    { t: 240, frame: G[4]!, rot: { head: 20, jaw: 10, ear: -50, tail1: -60, tail2: 10 }, root: [-0.4, 0], ease: "in" },
    { t: 400, frame: DOG_FRAME.lie, rot: { head: 30, jaw: 8, ear: -50, tail1: -86, tail2: 10, tail3: 4 }, scale: [1.06, 0.94], ease: "in" },
    { t: 470, frame: DOG_FRAME.lie, rot: { head: 24, jaw: 8, ear: -50, tail1: -86, tail2: 10, tail3: 4 }, root: [0, 0.4], scale: [1, 1], ease: "out" },
    { t: 600, frame: DOG_FRAME.lie, rot: { head: 30, jaw: 6, ear: -50, tail1: -86, tail2: 10, tail3: 4 }, ease: "inOut" },
  ], { tail2: 40, tail3: 60 });
  return { idle, run, flee, attack, hit, ko };
}
