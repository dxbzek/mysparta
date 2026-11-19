/**
 * Stage geometry (brief 3.12): the 360 x 240 stage, the floor line, the home marks, where pets
 * stand and how big they are drawn, mirroring for side b, draw order by floor y, and where an attacker stops.
 * The same in every arena, so the choreography never changes with the place.
 */
import type { ActorId, ActorInit, CompanionId, Side } from "@rankzero/core";
import { sideOf } from "@rankzero/core";
import type { Dress, Offset, Rig, RigId } from "@rankzero/rig";

export const STAGE_W = 360;
export const STAGE_H = 240;
export const FLOOR_Y = 195;

export interface Mark { x: number; y: number }

/** The scrappers' marks for side a. Side b is the mirror: x becomes 360 - x.
 *  Owner amendment (fight screen v2, plan 13.7): the scrappers stand 80 units apart, not 220, so
 *  the phone camera can frame both of them large, the way the owner's style-13 sample does. Most
 *  strikes reach less than that, so the attacker lunges in; a long Pole thrust (up to about 92
 *  units) makes its user step back to its distance first, which reads as spacing. */
export const HOME: Readonly<Mark> = { x: 140, y: FLOOR_Y };

/**
 * Pets on stage (owner, 15 Nov 2026: "Animal covering all animals and model"). Until the pet
 * redraw lands, each pet is drawn no taller than this share of a fighter's height.
 */
export const PET_HEIGHT: Readonly<Record<CompanionId, number>> = {
  "stray-dog": 0.30, goose: 0.35, raccoon: 0.22, "alley-cat": 0.25, crow: 0.20, boar: 0.45,
};
/** The scale each pet's rig is drawn at (the stage passes it as `Dress.scale`, so every aim, stop,
 *  hit point and mouth follows it): `PET_HEIGHT` of the smallest fighter build's idle height
 *  (81.8 units), over the pet's own idle height, measured on the real art (src/bounds.ts) and
 *  rounded down. A test measures the art again and turns red when a redraw makes a pet taller. */
export const PET_SCALE: Readonly<Record<CompanionId, number>> = {
  "stray-dog": 0.86, goose: 0.75, raccoon: 0.69, "alley-cat": 0.81, crow: 0.59, boar: 0.77,
};

/** How far a drawn actor reaches from its place, for an actor facing the fight: `back` units
 *  behind, `front` ahead, `up` above its floor line, `down` below it (the shadow). */
export interface Reach { back: number; front: number; up: number; down: number }
const reach = (back: number, front: number, up: number, down: number): Reach => ({ back, front, up, down });
/** The idle loop's drawn reach on the real art, rounded up: a scrapper of the biggest build with
 *  empty hands, and each pet at its `PET_SCALE` (a test measures these again). A pet's entry is the
 *  larger of the real art and the capsule test rig's stand-in at that scale, so pets are spaced
 *  for whichever rig draws them (redraw of 15 Nov 2026). */
export const SCRAPPER_REACH: Readonly<Reach> = reach(23, 26, 88.5, 5.5);
export const PET_REACH: Readonly<Record<CompanionId, Reach>> = {
  raccoon: reach(20, 17, 18, 4.5), goose: reach(18, 18.5, 30, 4), boar: reach(26.5, 39, 38.5, 7),
  "stray-dog": reach(23, 24, 27, 5), crow: reach(12, 13, 17.5, 3.5), "alley-cat": reach(23, 20, 21.5, 5),
};
/** How far each pet's body reaches over its idle, run and hit poses (a pet runs in its dodge hop
 *  and is hit in place), `back` and `front` only, rounded up to half a unit: the larger of the real
 *  art and the capsule test rig. The camera frames a pet by it: framed by the idle reach, an Alley
 *  Cat's run reached 5 units past it and left the frame in its dodge hop (round 2, find-bout level
 *  8 n 37). A test measures these again. */
export const PET_FRAME_REACH: Readonly<Record<CompanionId, { back: number; front: number }>> = {
  raccoon: { back: 22, front: 17 }, goose: { back: 19, front: 25 }, boar: { back: 28, front: 40 },
  "stray-dog": { back: 27, front: 24.5 }, crow: { back: 12.5, front: 14 }, "alley-cat": { back: 28.5, front: 20 },
};

/** The reach of an actor of this kind. */
export const reachFor = (kind: "scrapper" | CompanionId): Reach => (kind === "scrapper" ? SCRAPPER_REACH : PET_REACH[kind]);

/**
 * Where pets stand. Beside their owner on his back side, a little toward the back of the stage
 * (a smaller floor y, so he draws over them), with clear floor between his body and the nearest
 * pet. Up to three pets make a small staggered group: each stands on one of the `rows`, never
 * closer than `gap` to his drawn box and never covering another pet's box by more than `overlap`
 * of the narrower one's width (a pet a full row behind another, their boxes not touching, may
 * share `row` of it). A crowded side that fits no other way tries the next, tighter `rules`
 * (the owner allows 15% between pets). Nothing at rest covers him.
 */
export const PET_MARKS = {
  /** Floor lines a pet may stand on, behind its owner's (195), nearest first. */
  rows: [189, 181, 174, 166, 158] as readonly number[],
  rules: [{ gap: 7, overlap: 0.08, row: 0.7 }, { gap: 5, overlap: 0.12, row: 1 }] as
    readonly { gap: number; overlap: number; row: number }[],
  /** Nearest a pet's box may come to the stage edge. */
  edge: 4,
} as const;

export function mirror(side: Side, m: Mark): Mark {
  return side === "a" ? { x: m.x, y: m.y } : { x: STAGE_W - m.x, y: m.y };
}
/** Side a faces right, side b faces left. */
export function homeFacing(side: Side): 1 | -1 { return side === "a" ? 1 : -1; }

export function rigOf(kind: "scrapper" | CompanionId): RigId { return kind; }

type Box1 = [x0: number, x1: number, y0: number, y1: number];
type Rules = (typeof PET_MARKS.rules)[number];

/** True when box `s` may stand next to every box of `on`. */
function clear(s: Box1, on: readonly Box1[], r: Rules): boolean {
  return on.every((q) => {
    const w = Math.min(s[1], q[1]) - Math.max(s[0], q[0]);
    const rows = Math.min(s[3], q[3]) <= Math.max(s[2], q[2]);
    return w <= (rows ? r.row : r.overlap) * Math.min(s[1] - s[0], q[1] - q[0]);
  });
}

/**
 * The home mark of every actor of a bout. `reach` gives how far each actor is drawn from its
 * place (`reachFor`). The scrappers stand on `HOME`. A side's pets stand as a group on their
 * owner's back side, placed in log order (a1, a2, a3), each in the free spot on its row nearest
 * him. Of every way to give each pet a row, the group that reaches least far from him wins; each
 * unit further back costs half a unit and a queue on one row 4 units, so the group stays close
 * and staggered and only a crowded side uses the back rows.
 */
export function homeMarks(actors: readonly ActorInit[], reach: (a: ActorInit) => Reach): Map<ActorId, Mark> {
  const out = new Map<ActorId, Mark>();
  const { rows, edge } = PET_MARKS;
  for (const side of ["a", "b"] as const) {
    const mine = actors.filter((a) => sideOf(a.id) === side).sort((p, q) => (p.id < q.id ? -1 : 1));
    const owner = mine.find((a) => a.kind === "scrapper");
    if (owner !== undefined) out.set(owner.id, mirror(side, HOME));
    const pets = mine.filter((a) => a.kind !== "scrapper");
    const n = pets.length;
    const back = HOME.x - (owner !== undefined ? reach(owner).back : 22);
    let best: Mark[] | null = null;
    let score = Infinity;
    for (const rule of PET_MARKS.rules) {
      for (let code = 0; code < rows.length ** n && n > 0; code++) {
        const marks: Mark[] = [];
        const boxes: Box1[] = [];
        let far = back;
        let cost = n > 1 ? 4 : 0;
        for (const [k, a] of pets.entries()) {
          const r = reach(a);
          const y = rows[Math.floor(code / rows.length ** k) % rows.length]!;
          // the free spot nearest the owner on its row: step out from his back
          let x = back - rule.gap - r.front;
          const box = (): Box1 => [x - r.back, x + r.front, y - r.up, y + r.down];
          while (x - r.back >= edge && !clear(box(), boxes, rule)) x -= 0.5;
          marks.push({ x, y });
          boxes.push(box());
          far = Math.min(far, x - r.back < edge ? -Infinity : x - r.back);
          cost += (rows[0]! - y) / 2;
        }
        // a queue on one row costs 4
        cost += back - far - (marks.some((m) => m.y !== marks[0]!.y) ? 4 : 0);
        if (cost < score) { score = cost; best = marks; }
      }
      if (best !== null) break;
    }
    // no way fits before the stage edge (not a rules case on the real art): each at the edge
    pets.forEach((a, k) => out.set(a.id, mirror(side, best?.[k] ?? { x: edge + reach(a).back, y: rows[0]! })));
  }
  return out;
}

/** Where a swing lands on its target: the head, the body, or (a pet biting a fighter) the legs. */
export type Zone = "head" | "body" | "legs";
/** The legs zone: the body's x, at this share of the head's height (about the knee). */
export const LEGS_SHARE = 0.3;

/** Where a swing aims on its target. A companion is always hit in the body. A pet goes for a
 *  fighter's legs (its size reaches them without a hop up to his chest). A fighter hits a fighter
 *  at the body or the head, by the parity of the step index: a pure function of the log, never of
 *  the cosmetic seed, because the zone moves the stop and so the timing. */
export function aimZone(attackerRig: RigId, targetRig: RigId, stepIndex: number): Zone {
  if (targetRig !== "scrapper") return "body";
  if (attackerRig !== "scrapper") return "legs";
  return stepIndex % 2 === 0 ? "body" : "head";
}

/** The hit point of a zone, as an `Offset` from the target's place (facing right). */
export function hitOffset(rig: Rig, target: RigId, dress: Dress, zone: Zone): Offset {
  const p = rig.hitPoint(target, dress, zone === "legs" ? "body" : zone);
  return zone === "legs" && target === "scrapper" ? { x: p.x, y: LEGS_SHARE * rig.hitPoint(target, dress, "head").y } : p;
}

/**
 * Room between bodies (review finding 1, 15 Nov 2026: fighters stopped inside each other).
 *  - `body`: the least distance between two scrappers' places at a swing's stop, times the larger
 *    drawn size (a bare-handed jab to the head stands 38 apart), so the torsos never merge and the legs never interleave.
 *    A swing aimed at the head that would stop nearer (an overhead smash with a short reach: the
 *    anvil, the ball and chain) aims at the body instead, which its arc meets further forward, so
 *    the arms reach out rather than the feet walking in.
 *  - `petClear`: a pet that is attacked while it stands behind its owner steps out in front of
 *    him, its box this far clear of his drawn front and its floor line `petDepth` behind his, so
 *    the attacker hits it from the near side of the owner and never walks through him.
 */
export const BODY_GAP = { body: 36, petClear: 4, petDepth: 0.5 } as const;

/**
 * The floor x where an attacker must stand so that its aimed strike point lands on the target's
 * hit point, and the aim to pass to `samplePose`. Both actors stand on the same floor y (the
 * attacker walks to the target's depth). `targetX` and `targetFacing` are the target's place at
 * the contact time.
 */
export function stopFor(rig: Rig, a: { rig: RigId; dress: Dress; clip: string; facing: 1 | -1 },
  t: { rig: RigId; dress: Dress; x: number; facing: 1 | -1 }, zone: Zone): { x: number; aimY: number; strike: Offset; hit: Offset } {
  const hit = hitOffset(rig, t.rig, t.dress, zone);
  const strike = rig.strikePoint(a.rig, a.clip, a.dress, hit.y);
  const hitX = t.x + t.facing * hit.x;
  return { x: hitX - a.facing * strike.x, aimY: hit.y, strike, hit };
}
