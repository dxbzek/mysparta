/**
 * Stand-ins a gate-only rig draws for what the gate pack has no art for (the contract's
 * "Gate-only rig" rule). Never shipped: the content pack replaces every one of them.
 *  - a weapon outside the gate: a straight bar `placeholderLength(reach)` long, gripped at one
 *    end, its tip at the far end;
 *  - a shield (content v2): a `SHIELD_PLACEHOLDER` slab of its own size held at its inner edge;
 *  - companions: a plain body at the rules' size on a 6-bone rig, with the clip times of
 *    `PLACEHOLDER_COMPANION_CLIPS` (idle, run, attack, hit, ko, flee).
 * They are drawn by the same engine and painter as everything else, so they prove the engine
 * takes a rig that is not a scrapper.
 */
import type { CompanionId, HeldId, ShieldId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import type { Clip, CompanionClip, Key, RigDef, Shape, WeaponArt } from "../contracts";
import { PLACEHOLDER_COMPANION_CLIPS, SHIELD_PLACEHOLDER, placeholderLength } from "../contracts";
import { GRIP_ROT } from "./skeleton";
import { dPoly, ellipsePoly, inkLine, limb, roundRect } from "./vocab";

/** A straight bar from the grip to the tip, `len` long, with a 2-unit butt behind the grip. */
export function placeholderWeapon(id: HeldId): WeaponArt {
  const meta = WEAPON_META[id];
  const len = placeholderLength(meta === undefined ? 1 : meta.reach);
  const art: WeaponArt = {
    shapes: [{ d: dPoly([[-2, -1.4], [len - 3, -1.4], [len, 0], [len - 3, 1.4], [-2, 1.4]]), slot: "metal", z: 0 }],
    grip: { x: 0, y: 0, rot: GRIP_ROT },
    length: len + 2,
    tip: { x: len, y: 0 },
  };
  return meta?.pair === true ? { ...art, offhand: true } : art;
}

/** The stand-in for a shield: a slab of its `SHIELD_PLACEHOLDER` size, held at its inner edge
 *  (the grip) on the back forearm. The Car Door keeps its window. */
export function shieldStandIn(id: ShieldId): WeaponArt {
  const { w, h } = SHIELD_PLACEHOLDER[id];
  const shapes: WeaponArt["shapes"][number][] = [{ d: dPoly(roundRect(-4, 6 - h, w, h, 1.5)), slot: "accent", z: 0 }];
  if (id === "car-door") shapes.push({ d: dPoly(roundRect(0, -23, 14, 10, 1)), slot: "white", z: 1 });
  return { shapes, grip: { x: 0, y: 0, rot: 8 }, length: w, tip: { x: w - 4, y: 6 - h / 2 } };
}
/** The Car Door stand-in, as before content v2. */
export const DOOR_STAND_IN: WeaponArt = shieldStandIn("car-door");

// --------------------------------------------------------------------------- companions

interface Beast { leg: number; rx: number; ry: number; head: number; neck: number; tail: number; snout: number }
/** Raccoon 26 units tall, Goose 40, Boar 52 tall and 70 long (brief 3.12). */
const BEASTS: Record<CompanionId, Beast> = {
  raccoon: { leg: 9.5, rx: 12, ry: 6.5, head: 5.4, neck: 0, tail: 12, snout: 4 },
  goose: { leg: 13, rx: 11, ry: 7.5, head: 4.2, neck: 13, tail: 5, snout: 5 },
  boar: { leg: 16, rx: 31, ry: 14.5, head: 10, neck: 0, tail: 7, snout: 7 },
  // content v2 pets (stand-ins until the content pack draws them)
  "stray-dog": { leg: 12, rx: 15, ry: 7.5, head: 6, neck: 0, tail: 11, snout: 5 },
  crow: { leg: 9, rx: 7, ry: 7, head: 3.5, neck: 5, tail: 8, snout: 4 },
  "alley-cat": { leg: 10, rx: 12, ry: 5, head: 5, neck: 0, tail: 15, snout: 2 },
};
const HEIGHT: Record<CompanionId, number> = { raccoon: 26, goose: 40, boar: 52, "stray-dog": 34, crow: 26, "alley-cat": 26 };

function beastRig(id: CompanionId): RigDef {
  const b = BEASTS[id];
  const bodyY = -(b.leg + b.ry * 0.62);
  return {
    id, height: HEIGHT[id], bones: [
      { id: "root", parent: -1, x: 0, y: 0 },
      { id: "body", parent: 0, x: 0, y: bodyY },
      { id: "head", parent: 1, x: b.rx * 0.82, y: -b.ry * 0.35, limit: [-70, 70] },
      { id: "legF", parent: 1, x: b.rx * 0.55, y: b.ry * 0.62, limit: [-70, 70] },
      { id: "legB", parent: 1, x: -b.rx * 0.55, y: b.ry * 0.62, limit: [-70, 70] },
      { id: "tail", parent: 1, x: -b.rx * 0.92, y: -b.ry * 0.2 },
    ],
  };
}

function beastShapes(id: CompanionId): Shape[] {
  const b = BEASTS[id];
  const out: Shape[] = [];
  const leg = (bone: string, z: number): void => {
    out.push({ bone, d: dPoly(limb(b.leg, [[0, 2.2, 2.2], [1, 1.5, 1.5]], id === "goose" ? 0.55 : id === "boar" ? 1.8 : 1, 4)), slot: id === "goose" ? "accent" : "skin", z });
  };
  leg("legB", 10);
  out.push({ bone: "tail", d: dPoly(limb(b.tail, [[0, 2.4, 2.4], [1, 1.2, 1.2]], id === "raccoon" ? 1.3 : 0.8, 4).map(([x, y]) => [-y * 0.85, -y * 0.5 + x] as [number, number])), slot: "hair", z: 11 });
  out.push({ bone: "body", d: dPoly(ellipsePoly(0, 0, b.rx, b.ry, 22)), slot: "skin", z: 20 });
  if (id === "raccoon") for (let i = 0; i < 3; i++) out.push({ bone: "tail", d: dPoly(inkLine([[-3 - i * 3.4, -2.5 - i * 1.4], [-2 - i * 3.4, 1.2 - i * 1.4]], 1.2, false)), slot: "ink", z: 11.2 });
  // head with the neck, the snout or beak (the strike end), an eye and an ear
  const neckLen = b.neck;
  const hx = b.head * 0.5 + neckLen * 0.35;
  const hy = -(b.head * 0.4 + neckLen);
  if (neckLen > 0) out.push({ bone: "head", d: dPoly([[-2.2, 1.5], [2.2, 1.5], [hx + 1.6, hy + 1.5], [hx - 2, hy]]), slot: "skin", z: 30 });
  out.push({ bone: "head", d: dPoly(ellipsePoly(hx, hy, b.head, b.head * 0.88, 16)), slot: "skin", z: 30.1 });
  out.push({ bone: "head", d: dPoly([[hx + b.head * 0.6, hy - b.head * 0.35], [hx + b.head + b.snout, hy + b.head * 0.12], [hx + b.head * 0.6, hy + b.head * 0.55]]), slot: id === "goose" ? "accent" : "hair", z: 31 });
  out.push({ bone: "head", d: dPoly(ellipsePoly(hx + b.head * 0.2, hy - b.head * 0.25, 0.9 + b.head * 0.05, 0.9 + b.head * 0.05, 8)), slot: "ink", z: 31.1 });
  if (id === "raccoon") out.push({ bone: "head", d: dPoly([[hx - 2.5, hy - 2.8], [hx + 4.2, hy - 2.2], [hx + 4, hy + 0.6], [hx - 2.4, hy + 0.2]]), slot: "ink", z: 31.05 });
  if (id === "boar") out.push({ bone: "head", d: dPoly([[hx + b.head * 0.9, hy + b.head * 0.3], [hx + b.head + 3.5, hy - 1.6], [hx + b.head * 1.1, hy + b.head * 0.55]]), slot: "white", z: 31.2 });
  leg("legF", 40);
  return out;
}

const k = (t: number, rot: Record<string, number>, o: Partial<Key> = {}): Key => ({ t, rot, ...o });
const I = { body: 0, head: 0, legF: 0, legB: 0, tail: 0 };
function beastClips(): Record<CompanionClip, Clip> {
  const P = PLACEHOLDER_COMPANION_CLIPS;
  const runA = { body: -3, head: -6, legF: -34, legB: 30, tail: -18 };
  const runB = { body: 3, head: 4, legF: 30, legB: -34, tail: 10 };
  return {
    idle: { duration: P.idle.durationMs, loop: true, events: P.idle.events,
      keys: [k(0, { ...I, tail: 8 }), k(600, { ...I, body: -2, head: 6, tail: -12 }, { scale: [1, 0.97], ease: "inOut" }), k(1200, { ...I, tail: 8 }, { ease: "inOut" })] },
    run: { duration: P.run.durationMs, loop: true, events: P.run.events,
      keys: [k(0, runA), k(120, runB, { ease: "inOut" }), k(240, runA, { ease: "inOut" })] },
    attack: { duration: P.attack.durationMs, loop: false, events: P.attack.events,
      keys: [k(0, I), k(90, { body: -12, head: -16, legF: -12, legB: 18, tail: 30 }, { root: [-4, 0], face: "grit", ease: "out" }),
        k(150, { body: 12, head: 22, legF: -32, legB: 30, tail: -28 }, { root: [10, 0], face: "shout", ease: "in" }),
        k(190, { body: 15, head: 26, legF: -34, legB: 32, tail: -32 }, { root: [11, 0], face: "shout", ease: "out" }),
        k(280, I, { ease: "inOut" })] },
    hit: { duration: P.hit.durationMs, loop: false, events: P.hit.events,
      keys: [k(0, I, { face: "dazed" }), k(60, { body: -16, head: -24, legF: 14, legB: -10, tail: 40 }, { root: [-5, 0], face: "dazed", ease: "out" }), k(300, I, { ease: "inOut" })] },
    ko: { duration: P.ko.durationMs, loop: false, events: P.ko.events,
      keys: [k(0, { body: -14, head: -20 }, { face: "dazed" }),
        k(200, { body: -60, head: -30, legF: -40, legB: -30 }, { root: [-4, -6], face: "dazed", ease: "out" }),
        k(400, { root: -180, body: 0, head: -10, legF: 20, legB: -20, tail: -20 }, { root: [-8, 0], scale: [1.08, 0.9], face: "dazed", ease: "in" }),
        k(600, { root: -180, body: 0, head: -8, legF: 24, legB: -24, tail: -24 }, { root: [-8, 0], face: "dazed", ease: "out" })] },
    flee: { duration: P.flee.durationMs, loop: true, events: P.flee.events,
      keys: [k(0, runA, { face: "dazed" }), k(120, runB, { face: "dazed", ease: "inOut" }), k(240, runA, { face: "dazed", ease: "inOut" })] },
  };
}

export interface CompanionArt { rig: RigDef; shapes: readonly Shape[]; clips: Record<CompanionClip, Clip> }
const CLIPS = beastClips();
export const PLACEHOLDER_COMPANIONS: Record<CompanionId, CompanionArt> = {
  raccoon: { rig: beastRig("raccoon"), shapes: beastShapes("raccoon"), clips: CLIPS },
  goose: { rig: beastRig("goose"), shapes: beastShapes("goose"), clips: CLIPS },
  boar: { rig: beastRig("boar"), shapes: beastShapes("boar"), clips: CLIPS },
  "stray-dog": { rig: beastRig("stray-dog"), shapes: beastShapes("stray-dog"), clips: CLIPS },
  crow: { rig: beastRig("crow"), shapes: beastShapes("crow"), clips: CLIPS },
  "alley-cat": { rig: beastRig("alley-cat"), shapes: beastShapes("alley-cat"), clips: CLIPS },
};
