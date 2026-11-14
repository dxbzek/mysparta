/**
 * The probe: a 6-bone rig that is not a scrapper (a one-legged wading bird), used only to prove
 * that the engine takes any `RigDef` (plan WP2 gate, critic line): it samples, draws, plants its
 * foot by two-bone IK and mirrors with no engine change. The tests and the sheet tools load it as
 * a companion of a small content pack (`probePack`). Never drawn in a bout.
 */
import type { Clip, CompanionClip, ContentPack, Key, RigDef, Shape } from "../contracts";
import { PLACEHOLDER_COMPANION_CLIPS } from "../contracts";
import { PLACEHOLDER_COMPANIONS } from "../gate/placeholders";
import { dPoly, ellipsePoly, limb } from "../gate/vocab";

export const PROBE_RIG: RigDef = {
  id: "goose", height: 40, bones: [
    { id: "root", parent: -1, x: 0, y: 0 },
    { id: "body", parent: 0, x: 0, y: -26 },
    { id: "head", parent: 1, x: 8, y: -3, limit: [-80, 80] },
    { id: "leg.up", parent: 1, x: 0, y: 4, limit: [-90, 60] },
    { id: "leg.lo", parent: 3, x: 0, y: 11, limit: [-150, 2] },
    { id: "foot", parent: 4, x: 0, y: 11 },
  ],
};
export const PROBE_SHAPES: Shape[] = [
  { bone: "leg.up", d: dPoly(limb(11, [[0, 1.6, 1.6], [1, 1.0, 1.0]])), slot: "accent", z: 10 },
  { bone: "leg.lo", d: dPoly(limb(11, [[0, 1.0, 1.0], [1, 0.8, 0.8]])), slot: "accent", z: 10.1 },
  { bone: "foot", d: dPoly([[-3, 0], [6, -0.5], [7, 1.2], [-3, 1.2]]), slot: "accent", z: 11 },
  { bone: "body", d: dPoly(ellipsePoly(0, 0, 10, 6.5, 20)), slot: "skin", z: 20 },
  { bone: "head", d: dPoly([[-1.6, 1.4], [1.6, 1.4], [3.6, -10], [0.2, -10.6]]), slot: "skin", z: 30 },
  { bone: "head", d: dPoly(ellipsePoly(2.4, -11.6, 3, 2.6, 12)), slot: "skin", z: 30.1 },
  { bone: "head", d: dPoly([[4.6, -12.6], [12, -11.2], [4.8, -10.2]]), slot: "accent", z: 31 },
  { bone: "head", d: dPoly(ellipsePoly(3, -12.4, 0.7, 0.7, 8)), slot: "ink", z: 31.1 },
];
const k = (t: number, rot: Record<string, number>, o: Partial<Key> = {}): Key => ({ t, rot, ...o });
const STAND = { body: 0, head: 0, "leg.up": -10, "leg.lo": -20, foot: 30 };
const P = PLACEHOLDER_COMPANION_CLIPS;
export const PROBE_CLIPS: Record<CompanionClip, Clip> = {
  idle: { duration: P.idle.durationMs, loop: true, events: P.idle.events, plant: ["foot"],
    keys: [k(0, STAND, { root: [0, 0] }), k(600, { ...STAND, body: -8, head: 14 }, { root: [1.5, 2], ease: "inOut" }), k(1200, STAND, { root: [0, 0], ease: "inOut" })] },
  run: { ...PLACEHOLDER_COMPANIONS.goose.clips.run, keys: [k(0, STAND), k(120, { ...STAND, "leg.up": -40 }), k(240, STAND)] },
  attack: { duration: P.attack.durationMs, loop: false, events: P.attack.events, plant: ["foot"],
    keys: [k(0, STAND), k(90, { ...STAND, body: -14, head: -30 }, { root: [-2, 1], ease: "out" }),
      k(150, { ...STAND, body: 24, head: 50 }, { root: [3, 3], ease: "in" }), k(200, { ...STAND, body: 28, head: 56 }, { root: [3, 3], ease: "out" }),
      k(280, STAND, { ease: "inOut" })] },
  hit: { duration: P.hit.durationMs, loop: false, events: P.hit.events, plant: ["foot"], keys: [k(0, STAND), k(60, { ...STAND, body: -16, head: -30 }), k(300, STAND)] },
  ko: { duration: P.ko.durationMs, loop: false, events: P.ko.events, keys: [k(0, STAND), k(400, { ...STAND, root: -90, body: 0 }, { ease: "in" }), k(600, { ...STAND, root: -90 })] },
  flee: { ...PLACEHOLDER_COMPANIONS.goose.clips.flee, keys: [k(0, STAND), k(120, { ...STAND, "leg.up": -40 }), k(240, STAND)] },
};
/** A content pack with only the probe as its goose. Every other field is left empty on purpose. */
export const probePack = { companions: { ...PLACEHOLDER_COMPANIONS, goose: { rig: PROBE_RIG, shapes: PROBE_SHAPES, clips: PROBE_CLIPS } } } as unknown as ContentPack;
