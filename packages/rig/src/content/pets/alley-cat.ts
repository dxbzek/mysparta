/**
 * The alley cat, traced (15 Nov 2026; the dog's rotoscope method). Its body, legs and tail are
 * whole silhouettes, one per drawn frame (`body@N`): the run and the flee are traced from
 * Muybridge's cat (plate 718, see cat-frames.ts); standing, the arched-back hiss and lying down
 * are drawn by hand at the same proportions. The head (round, short muzzle, big pointed ears, one
 * notched, a slit-eyed glare, a scar) is on bones so it turns and hisses. About 25% of a fighter.
 */
import type { Clip, CompanionClip } from "../../contracts";
import type { Pt } from "../../gate/vocab";
import type { Rot } from "./anatomy";
import { Anatomy, band, ellipse, line, smooth } from "./anatomy";
import type { PetArt } from "./kind";
import { CAT_GALLOP, CAT_TROT } from "./cat-frames";
import type { Beat, Frame } from "./frames";
import { addFrames, addLitLegs, addTagged, framesClip } from "./frames";

/** The head joint over the floor when standing. */
const HEAD_Y = 14.5;
/** The picture's fit to 25% of a fighter. */
const K = 1.0;
/** How far the head joint stands ahead of the actor's place (the middle of the body). */
const MID = 13;
const S = (pts: Pt[], per = 4): Pt[] => smooth(pts, per);
const mv = (pts: readonly Pt[], dx: number, dy = 0): Pt[] => pts.map((p) => [p[0] + dx, p[1] + dy] as Pt);

// ------------------------------------------------------------------------- hand frames
const fore = (dx: number, floor: number): Pt[] => mv(S([[-3.0, 3.6], [-3.4, 8.4], [-3.4, floor - 1.6], [-2.4, floor - 0.6], [-1.6, floor], [-5.0, floor], [-5.4, floor - 1.2],
  [-5.6, 8.0], [-6.4, 4.0]], 3), dx);
const hind = (dx: number, floor: number): Pt[] => mv(S([[-19.0, 1.6], [-17.6, 6.2], [-19.8, 8.6], [-21.6, floor - 4.6], [-21.4, floor - 1.0], [-19.8, floor - 0.6],
  [-19.6, floor], [-23.4, floor], [-23.6, floor - 4.8], [-25.4, 7.4], [-26.4, 3.8], [-25.4, 0.6]], 3), dx);
/** Standing (frame 12): the floor 14.5 under the head joint, the back level, the tail low. */
const STAND: Frame = { lift: 0, body: [S([[1.0, -1.2], [-3, -1.8], [-8, -2.0], [-14, -2.2], [-20, -2.8], [-24.6, -2.4], [-26.6, -0.4], [-26.8, 2.6],
  [-25, 5.2], [-21, 5.8], [-16, 5.0], [-11, 5.6], [-6.4, 6.4], [-2.6, 5.2], [-0.6, 2.8]]), fore(-1.8, 14.5), hind(1.6, 14.5), fore(0, 14.5), hind(0, 14.5)],
  shade: [fore(-1.8, 14.5), hind(1.6, 14.5)] };
/** The arched back of a cat squaring up (frame 13): stiff legs, the spine humped high, sideways on. */
const ARCH: Frame = { lift: 0, body: [S([[1.0, -0.6], [-2.6, -3.0], [-7, -6.6], [-12, -8.4], [-17, -7.6], [-21.6, -4.6], [-25.0, -1.4], [-26.2, 2.4],
  [-24.6, 5.2], [-21, 4.0], [-16, 1.6], [-11, 1.6], [-6, 4.4], [-2.8, 5.2], [-0.6, 2.8]]), fore(-1.8, 14.5), mv(hind(1.6, 14.5), 1.0), fore(0, 14.5), mv(hind(0, 14.5), 1.0)],
  shade: [fore(-1.8, 14.5), mv(hind(1.6, 14.5), 1.0)] };
/** Lying on its side, the legs out (frame 14): the floor 6 under the head joint. */
const LIE: Frame = { lift: 0, body: [S([[1.2, -0.6], [-4, -1.2], [-10, -1.4], [-17, -1.0], [-23, -0.2], [-26.4, 2.0], [-26.6, 5.0], [-22, 6], [-12, 6], [-4, 6], [0, 4.6]]),
  S([[-3.0, 3.8], [3.6, 4.6], [6.4, 5.2], [6.6, 6], [-3.0, 6]], 3), S([[-24, 3.4], [-30, 4.6], [-33, 5.2], [-33.2, 6], [-24, 6]], 3)] };
const FRAMES: readonly Frame[] = [...CAT_TROT, ...CAT_GALLOP, STAND, ARCH, LIE];
export const CAT_FRAME = { trot: [0, 1, 2, 3, 4, 5], gallop: [6, 7, 8, 9, 10, 11], stand: 12, arch: 13, lie: 14 } as const;
const HAND = [CAT_FRAME.stand, CAT_FRAME.arch, CAT_FRAME.lie];

/** The body's top and bottom edge at x: the highest crossing of the silhouette and the next one
 *  below it (the belly, not a leg further down). */
function depthAt(f: Frame, x: number): [number, number] | null {
  const ys: number[] = [];
  for (const poly of f.body) poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    if ((p[0] - x) * (q[0] - x) <= 0 && p[0] !== q[0]) ys.push(p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]));
  });
  ys.sort((u, v) => u - v);
  return ys.length >= 2 ? [ys[0]!, ys[1]!] : null;
}
/** Four tabby stripes on a frame, at the same places on the body as the drawn frames'. */
export function tabbyStripes(f: Frame): Pt[][] {
  const out: Pt[][] = [];
  for (const x of [-8, -12, -16, -20]) {
    const top = depthAt(f, x);
    const low = depthAt(f, x + 1.0);
    if (top === null || low === null) continue;
    const deep = top[1] - top[0];
    if (deep < 2.5 || deep > 12) continue;   // not the torso here (a leg, the tail)
    const y0 = top[0] - 0.3;
    const y1 = Math.min(low[0] + 0.58 * deep, low[1] - 0.8);
    out.push([[x, y0], [x + 1.0, y1], [x + 0.3, y1], [x - 0.8, y0]]);
  }
  return out;
}

export function alleyCat(): PetArt & { anatomy: Anatomy } {
  const rest: Rot = { body: 0, frame: 0, head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const a = new Anatomy(rest);
  a.xf = (p) => [(p[0] + MID) * K, (p[1] - HEAD_Y) * K];
  a.bone("frame", "root", [0, HEAD_Y]);
  a.bone("body", "root", [0, 0], [-25, 25]);
  a.bone("head", "body", [0, 0], [-50, 60]);
  a.bone("jaw", "head", [3.6, 1.6], [0, 40]);
  a.bone("ear", "head", [1.6, -2.6], [-60, 25]);
  a.bone("tail1", "body", [-26.2, -1.0], [-120, 80]);
  a.bone("tail2", "tail1", [-30.4, -0.6], [-90, 90]);
  a.bone("tail3", "tail2", [-34.2, -2.0], [-90, 90]);
  addFrames(a, FRAMES);
  // the hand-drawn frames' tail: long, ringed, the tip dark
  addTagged(a, "tail1", HAND, band([[-25.6, -1.2], [-28.2, -0.6], [-30.6, -0.6]], 0.95, 0.9), "skin", 19.9);
  addTagged(a, "tail2", HAND, band([[-30.2, -0.6], [-32.6, -1.0], [-34.4, -2.2]], 0.9, 0.85), "skin", 19.8);
  addTagged(a, "tail3", HAND, band([[-34.2, -2.0], [-35.4, -3.8], [-35.4, -5.6]], 0.85, 0.6), "skin", 19.7);
  addTagged(a, "tail3", HAND, band([[-35.4, -4.6], [-35.4, -5.6]], 0.72, 0.58), "hair", 19.72);
  addTagged(a, "tail2", HAND, ellipse(-32.6, -1.0, 0.45, 0.95, 0, 10), "hair", 19.81);
  // tabby stripes across the back in every frame, so they never pop on and off between clips:
  // the drawn standing and arched frames keep their own, every other frame gets them from its
  // silhouette (hanging from the back line to a little past half the body's depth)
  for (const x of [-8, -12, -16, -20]) addTagged(a, "body", HAND.slice(0, 2), [[x, -2.4], [x + 1.2, 1.6], [x + 0.4, 1.6], [x - 0.8, -2.4]], "hair", 20.02);
  // the near legs of the standing and arched cat keep a lit front (the far ones stay in shadow)
  addLitLegs(a, [CAT_FRAME.stand], [[STAND.body[3]!, -9], [STAND.body[4]!, -9]]);
  addLitLegs(a, [CAT_FRAME.arch], [[ARCH.body[3]!, -9], [ARCH.body[4]!, -9]]);
  FRAMES.forEach((f, n) => {
    if (n === CAT_FRAME.stand || n === CAT_FRAME.arch) return;
    for (const st of tabbyStripes(f)) addTagged(a, "body", [n], st, "hair", 20.02);
  });
  // head: the far ear, the near ear (notched), then the head
  a.fill("ear", [[2.6, -2.2], [3.4, -6.4], [5.0, -2.4]], "skin", 19.5, true);
  a.fill("head", ellipse(-0.4, 0.8, 2.6, 2.9, -15, 14), "skin", 20.3);                                                      // neck root over the cut
  a.fill("ear", [[-0.2, -2.0], [0.2, -6.8], [1.0, -5.6], [1.5, -5.9], [2.6, -2.6]], "skin", 20.35);
  a.fill("ear", [[0.5, -2.6], [0.6, -5.4], [1.6, -3.0]], "accent", 20.355);
  a.fill("jaw", [[3.8, 1.5], [6.4, 1.5], [6.2, 0], [3.9, 0]], "ink", 20.37);
  a.fill("jaw", S([[3.4, 1.5], [5.2, 1.6], [6.4, 1.7], [6.1, 2.4], [4.6, 2.7], [3.2, 2.2]], 3), "accent", 20.38);
  a.fill("jaw", [[5.6, 1.6], [6.0, 1.6], [5.8, 1.0]], "white", 20.385);
  a.fill("head", S([[-1.2, 0.2], [-0.8, -1.8], [1.0, -2.8], [3.4, -2.6], [4.8, -1.6], [5.9, -0.4], [6.7, 0.6], [6.6, 1.4], [5.4, 1.7], [3.4, 1.9], [1.0, 2.4], [-1.0, 1.6]]), "skin", 20.4);
  a.fill("head", S([[4.4, 0.2], [5.9, 0.0], [6.7, 0.7], [6.5, 1.5], [5.2, 1.8], [4.2, 1.2]], 3), "accent", 20.42);            // white muzzle
  a.fill("head", [[1.4, -2.6], [1.9, -1.2], [1.5, -1.2], [1.0, -2.6]], "hair", 20.42);
  a.fill("head", [[2.6, -2.7], [2.9, -1.4], [2.5, -1.4], [2.2, -2.7]], "hair", 20.42);
  a.fill("head", ellipse(3.6, -0.6, 0.72, 0.5, -14, 10), "accent", 20.44);                                                   // eye
  a.inkFill("head", [[3.55, -1.05], [3.8, -0.6], [3.55, -0.15], [3.38, -0.6]], 20.45);                                       // slit pupil
  a.ink("head", [[[2.7, -1.35], [4.5, -0.9]]], 0.3, 20.46);                                                                  // glare
  a.inkFill("head", ellipse(6.55, 0.3, 0.36, 0.26, 0, 8), 20.45);                                                            // nose
  a.ink("head", [line([[4.8, 1.2], [6.0, 0.6]]), [[5.2, 0.5], [8.2, 0.1]], [[5.2, 0.9], [8.2, 1.1]]], 0.12, 20.46);          // whiskers
  a.ink("head", [[[0.6, -1.6], [1.8, 0.2]]], 0.16, 20.47);                                                                   // scar
  return { rig: a.rig("alley-cat", 21), shapes: a.shapes, clips: clips(), anatomy: a };
}

function clips(): Record<CompanionClip, Clip> {
  const fc = (c: CompanionClip, beats: readonly Beat[], lag: Rot, loop = false): Clip => framesClip(FRAMES, K, c, beats, lag, loop);
  const z = { head: 0, jaw: 0, ear: 0, tail1: 0, tail2: 0, tail3: 0 };
  const stride = (seq: readonly number[], head: Rot): Beat[] => [
    ...seq.map((n, i) => ({ t: i * 40, frame: n, rot: { ...z, ...head, head: (head.head ?? 0) + [0, 1, 2, 1, -1, -1][i]! } })),
    { t: 240, frame: seq[0]!, rot: { ...z, ...head } },
  ];
  const run = fc("run", stride(CAT_FRAME.trot, { head: 4, ear: -8 }), { tail2: 30, tail3: 50 }, true);
  const flee = fc("flee", stride(CAT_FRAME.gallop, { head: 10, ear: -50, jaw: 6 }), {}, true);
  const ST = CAT_FRAME.stand;
  const idle = fc("idle", [
    { t: 0, frame: ST, rot: z },
    { t: 600, frame: ST, rot: { ...z, head: -2, tail1: 6, tail2: 10, tail3: 18 }, scale: [1, 0.985], ease: "inOut" },
    { t: 700, frame: ST, rot: { ...z, head: -2, ear: -16, tail1: 6, tail2: 10, tail3: 18 }, ease: "out" },
    { t: 800, frame: ST, rot: { ...z, head: -1, tail1: 3, tail2: 5, tail3: 9 }, ease: "inOut" },
    { t: 1200, frame: ST, rot: z, scale: [1, 1], ease: "inOut" },
  ], { tail2: 40, tail3: 70, ear: 20 }, true);
  // the attack: it squares up with its back arched and hisses, then lunges with a swipe and a bite
  const attack = fc("attack", [
    { t: 0, frame: ST, rot: z },
    { t: 70, frame: CAT_FRAME.arch, rot: { ...z, head: -8, jaw: 30, ear: -50, tail1: 60 }, root: [-0.6, 0], ease: "out" },
    { t: 120, frame: CAT_FRAME.gallop[3]!, rot: { ...z, head: 4, jaw: 34, ear: -50 }, root: [2.4, 0], ease: "in" },
    { t: 150, frame: CAT_FRAME.gallop[4]!, rot: { ...z, head: 8, jaw: 0, ear: -50 }, root: [3.6, 0], ease: "out" },
    { t: 200, frame: CAT_FRAME.gallop[4]!, rot: { ...z, head: -6, jaw: 20, ear: -40 }, root: [3.6, 0] },
    { t: 280, frame: ST, rot: z, root: [0, 0], ease: "inOut" },
  ], {});
  const hit = fc("hit", [
    { t: 0, frame: ST, rot: z },
    { t: 60, frame: CAT_FRAME.arch, rot: { ...z, head: 22, jaw: 18, ear: -55, tail1: 40 }, root: [-1.6, 0.8], scale: [1.04, 0.95], ease: "inOut" },
    { t: 150, frame: ST, rot: { ...z, head: 10, jaw: 8, ear: -40 }, root: [-0.6, 0], scale: [1, 1], ease: "inOut" },
    { t: 300, frame: ST, rot: z, root: [0, 0], ease: "inOut" },
  ], { tail2: 40, tail3: 60, ear: 30 });
  const ko = fc("ko", [
    { t: 0, frame: ST, rot: z },
    { t: 90, frame: ST, rot: { ...z, head: -14, jaw: 12, ear: -40 }, root: [-0.8, 0.6], ease: "out" },
    { t: 240, frame: CAT_FRAME.gallop[4]!, rot: { ...z, head: 18, jaw: 10, ear: -50 }, ease: "in" },
    { t: 400, frame: CAT_FRAME.lie, rot: { ...z, head: 26, jaw: 8, ear: -50 }, scale: [1.06, 0.94], ease: "in" },
    { t: 470, frame: CAT_FRAME.lie, rot: { ...z, head: 20, jaw: 8, ear: -50 }, root: [0, 0.4], scale: [1, 1], ease: "out" },
    { t: 600, frame: CAT_FRAME.lie, rot: { ...z, head: 26, jaw: 6, ear: -50 }, ease: "inOut" },
  ], { tail2: 40, tail3: 60 });
  return { idle, run, flee, attack, hit, ko };
}
