/** Body Slams at a fighter with pets on stage, and the pets that pass a fighter around them (round 2,
 *  the merge of the stage and sim lanes: a pet that ran clear of the landing ran through both
 *  fighters). Shared by open-defects.test.ts and the sweep. */
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import type { Rig } from "@rankzero/rig";
import type { StagePlayer } from "../../src/createFightPlayer";
import { playerFor } from "./setup";

export interface Found { n: number; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot }

/** A find-bout bout at level 30 (rivals 2n and 2n + 1). */
export function found30(n: number): Found {
  const a = rivalSnapshot(REALM_SALT, 30, 2 * n);
  const b = rivalSnapshot(REALM_SALT, 30, 2 * n + 1);
  return { n, log: simulateFight(combineSeed("find-bout", n), a, b, 1), a, b };
}

/** Whether a bout has a Body Slam at a fighter while a pet is on stage. */
export function hasSlamWithPets(f: Found): boolean {
  return f.log.init.actors.some((x) => x.kind !== "scrapper")
    && f.log.steps.some((s) => s.t === "move" && s.move === "body-slam" && s.target !== undefined && s.target.endsWith("0"));
}

/** The times a pet is on its own bite: from the start of its run in to the end of its run home
 *  after it. By design it passes behind its owner then (he draws over it). */
function biting(p: StagePlayer, id: string): [number, number][] {
  const tr = p.tracks.byId.get(id as never)!;
  return tr.attacks.map((w) => {
    const home = tr.moves.find((m) => m.from >= w.to - 1);
    return [w.from, home === undefined ? Infinity : home.to] as [number, number];
  });
}

/** Every time a pet passes a fighter's place, from each Body Slam at a fighter to 1.5 s after the
 *  slammed one is up, outside the pet's own bites, and not counting a pet that passes behind its own
 *  standing owner (the stage's step-out): the pets that ran clear of the landing, or with
 *  `onlyRanClear` false every pet. */
export function slamCrossings(p: StagePlayer, log: BoutLog, onlyRanClear = true): string[] {
  const out: string[] = [];
  const bites = new Map<string, [number, number][]>();
  const onBite = (id: string, t: number): boolean => {
    if (!bites.has(id)) bites.set(id, biting(p, id));
    return bites.get(id)!.some(([a, b]) => t >= a && t <= b);
  };
  log.steps.forEach((s, i) => {
    if (s.t !== "move" || s.move !== "body-slam" || s.target === undefined || !s.target.endsWith("0")) return;
    const from = p.timeline.stepAt[i]!;
    const seg = p.tracks.actors.find((x) => x.id === s.target)!.segs.find((g) => g.clip === "slammed" && g.from >= from);
    if (seg === undefined) return;
    // the pets that ran clear of the landing: they move between the step's start and the landing
    const at = p.tracks.sigs.find((g) => g.kind === "body-slam" && g.from >= from)?.at ?? seg.to;
    const ran = new Set(p.tracks.actors.filter((x) => x.rig !== "scrapper" && x.moves.some((m) => m.from >= from && m.from < at)).map((x) => x.id as string));
    const side = new Map<string, number>();
    for (let t = from; t <= seg.to + 1500; t += 20) {
      const g = p.frame(t);
      // (a knocked-out pet lies on the floor: a fighter walking over it is not a pet passing him)
      for (const pet of g.actors.filter((x) => x.rig !== "scrapper" && x.clip !== "ko" && !onBite(x.id, t) && (!onlyRanClear || ran.has(x.id)))) {
        for (const fi of g.actors.filter((x) => x.rig === "scrapper")) {
          const key = `${pet.id}/${fi.id}`;
          const now = Math.sign(pet.place.x - fi.place.x);
          const was = side.get(key);
          // by design a pet passes behind its own standing owner (he draws over it): when it steps
          // out in front of him to meet an attacker, and on its bites
          const behindOwner = fi.id[0] === pet.id[0] && fi.clip !== "ko-fall" && pet.floorY < fi.floorY - 0.25;
          if (was !== undefined && now !== 0 && was !== 0 && now !== was && !behindOwner) out.push(`step ${i} ${Math.round(t)} ms: ${pet.id} passes ${fi.id}`);
          if (now !== 0) side.set(key, now);
        }
      }
    }
  });
  return out;
}

export function slamPlayer(f: Found, rig: Rig): StagePlayer { return playerFor(f.log, f.a, f.b, rig); }
