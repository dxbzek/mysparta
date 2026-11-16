/**
 * Stage defects that the round-2 sim (versions 4 to 6) brought into real bouts, kept under test
 * here so they are not lost between lanes. The OPEN ones are written with `it.fails`: they pass
 * while the defect is there and turn red on the day the stage fixes it; that day, change `it.fails`
 * to `it`. (A pinned find-bout case can also turn red because a sim change moved the scene away:
 * then find a new case with the same check.)
 *  1. FIXED (round 2, third pass). A Move at a pet standing behind its owner (a Body Slam) ran the
 *     attacker past the owner: a swing at a pet had a step-out (the pet comes out in front, or the
 *     owner gives room), a Move had none (choreo/move.ts closeIn now uses both). Seen in find-bout
 *     level 30 n 2 under sim version 4; real bouts under sim version 6 are in spacing.test.ts.
 *  2. FIXED (round 2, third pass). A pet's dodge hop left the camera's bout frame (level 10 n 36
 *     under sim version 4, level 8 n 37 under sim version 5): the frame was set by a pet's idle
 *     reach and its run pose is wider (layout.PET_FRAME_REACH), the hop was clamped by reach and
 *     not by the drawn body, and a pet hit during its hop was knocked out of the frame. The real
 *     bouts are back in pets.test.ts.
 *  3. OPEN. A foot on the floor slides in a flinch (over 1 unit) or in footwork (over 0.5 units) in
 *     these sim-version-6 bouts: flinch in level 10 n 1 and level 30 n 5, 22, 32, 34, 37; footwork
 *     in level 30 n 5, 12, 29, 34, 36. feet.test.ts measures clean bouts; these are the dirty ones.
 */
import { describe, expect, it } from "vitest";
import type { ActorId, ActorInit, BoutLog, CompanionId, FighterSnapshot, Step } from "@rankzero/core";
import { COMPANION_IDS, REALM_SALT, combineSeed, rivalSnapshot, simulateFight } from "@rankzero/core";
import { l1Fists, l1Knife } from "@rankzero/core/fixtures";
import { contentPack, createRig, gatePack } from "@rankzero/rig";
import { drawnBox } from "../src/bounds";
import { frameSpan } from "../src/camera";
import type { StagePlayer } from "../src/createFightPlayer";
import { slides } from "./lib/feet";
import { playerFor } from "./lib/setup";

const FULL = createRig(gatePack, contentPack);
const FRAME_MS = 1000 / 60;
const snap = (base: FighterSnapshot, id: string): FighterSnapshot => ({ ...base, id });

function logOf(actors: ActorInit[], turns: Step[][]): BoutLog {
  const steps: Step[] = actors.map((a) => ({ t: "enter", turn: 0, actor: a.id }));
  turns.forEach((list, i) => { for (const s of list) steps.push({ ...s, turn: i + 1 } as Step); });
  steps.push({ t: "end", turn: turns.length + 1, winner: "a", reason: "cap" });
  return { logVersion: 2, rulesVersion: 1, seed: 1600, init: { actors, bag: { a: [], b: [] }, shield: { a: null, b: null } }, steps,
    result: { winner: "a", reason: "cap", turns: turns.length + 1, hpPct: { a: 100, b: 100 } } };
}

/** The frames in which the two scrappers stand on the wrong side of each other. */
function crossed(log: BoutLog): string[] {
  const p = playerFor(log, snap(l1Fists, "open-a"), snap(l1Knife, "open-b"), FULL);
  const side = Math.sign(p.tracks.byId.get("b0")!.home.x - p.tracks.byId.get("a0")!.home.x);
  const out: string[] = [];
  for (let t = 0; t <= p.timeline.durationMs; t += FRAME_MS) {
    const f = p.frame(t);
    const a = f.actors.find((x) => x.id === "a0");
    const b = f.actors.find((x) => x.id === "b0");
    if (a === undefined || b === undefined) continue;
    if (Math.sign(b.place.x - a.place.x) !== side) out.push(`${Math.round(t)} ms: a0 at ${a.place.x.toFixed(0)}, b0 at ${b.place.x.toFixed(0)}`);
  }
  return out;
}

/** a0 Body Slams the pet b1, which stands behind its owner b0. */
function slamAtPet(kind: CompanionId): BoutLog {
  const actors: ActorInit[] = [{ id: "a0", kind: "scrapper", maxHp: 900 }, { id: "b0", kind: "scrapper", maxHp: 900 },
    { id: "b1", kind, maxHp: 900 }];
  return logOf(actors, [[{ t: "move", turn: 0, actor: "a0", move: "body-slam", bagAfter: [], target: "b1",
    hits: [{ target: "b1", damage: 1, hpAfter: 899 }] }]]);
}

/** A find-bout bout (tools/find-bout.ts): candidate `n` at `level`, rivals 2n and 2n + 1. */
function foundPlayer(level: number, n: number): StagePlayer {
  const a = rivalSnapshot(REALM_SALT, level, 2 * n);
  const b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  return playerFor(simulateFight(combineSeed("find-bout", n), a, b, 1), a, b, FULL);
}

/** Every pet hop in a player that leaves the bout frame. */
function hopsOut(p: StagePlayer, name: string): { hops: number; out: string[] } {
  const hops = p.tracks.nudges.filter((n) => n.key === "hop" && p.tracks.byId.get(n.actor)!.rig !== "scrapper");
  const span = frameSpan(p.tracks);
  const out: string[] = [];
  for (const n of hops) {
    for (let t = n.from; t <= n.from + n.outMs + n.holdMs + n.backMs; t += FRAME_MS) {
      const x = p.frame(t).actors.find((q) => q.id === n.actor);
      if (x === undefined) continue;
      const box = drawnBox(FULL, FULL.samplePose(x.rig, x.clip, x.clipT, x.aim), x.dress, x.place);
      if (box.x0 < span.x0 - 0.5 || box.x1 > span.x1 + 0.5) {
        out.push(`${name} ${n.actor} at ${Math.round(t)} ms: ${box.x0.toFixed(1)} to ${box.x1.toFixed(1)} (frame ${span.x0.toFixed(1)} to ${span.x1.toFixed(1)})`);
        break;
      }
    }
  }
  return { hops: hops.length, out };
}

/** b0 swings at each pet of a0 in turn, and every pet dodges. */
function hopsOutOfFrame(kinds: readonly CompanionId[]): { hops: number; out: string[] } {
  const actors: ActorInit[] = [{ id: "a0", kind: "scrapper", maxHp: 900 },
    ...kinds.map((k, n) => ({ id: `a${n + 1}` as ActorId, kind: k, maxHp: 900 })), { id: "b0", kind: "scrapper", maxHp: 900 }];
  const log = logOf(actors, kinds.map((_, n): Step[] => [{ t: "attack", turn: 0, actor: "b0", target: `a${n + 1}` as ActorId,
    weapon: "fists", outcome: "evade", damage: 0, crit: false, hpAfter: 900, n: 0 }]));
  return hopsOut(playerFor(log, snap(l1Fists, "open-a"), snap(l1Knife, "open-b"), FULL), kinds.join("+"));
}

describe("stage defects from the round-2 sim (versions 4 to 6)", () => {
  it("a Body Slam at a pet behind its owner never runs the attacker past the owner, for every pet", () => {
    const out: string[] = [];
    for (const kind of COMPANION_IDS) out.push(...crossed(slamAtPet(kind)).slice(0, 1).map((x) => `${kind}: ${x}`));
    expect(out).toEqual([]);
  });

  it("a pet's dodge hop stays inside the bout frame in find-bout level 8 n 37 (it left it under sim version 5)", () => {
    const r = hopsOut(foundPlayer(8, 37), "L8 n37");
    expect(r.hops).toBeGreaterThan(0);
    expect(r.out).toEqual([]);
  });

  for (const [level, n, what] of [[10, 1, "flinch"], [30, 5, "flinch"], [30, 22, "flinch"], [30, 32, "flinch"], [30, 34, "flinch"],
    [30, 37, "flinch"], [30, 5, "footwork"], [30, 12, "footwork"], [30, 29, "footwork"], [30, 34, "footwork"], [30, 36, "footwork"]] as const) {
    it.fails(`no foot slides in a ${what} in find-bout level ${level} n ${n}`, () => {
      const p = foundPlayer(level, n);
      const bad = what === "flinch" ? slides(p, FULL, 1, { only: new Set(["hit-light", "hit-heavy"]) }) : slides(p, FULL);
      expect(bad).toEqual([]);
    });
  }

  it("a pet's dodge hop stays inside the bout frame in a built log, for every pet and every place in the line", () => {
    const out: string[] = [];
    let hops = 0;
    for (const kind of COMPANION_IDS) {
      for (const line of [[kind], [kind, kind === "raccoon" ? "crow" : "raccoon"], ["raccoon", "crow", kind]] as CompanionId[][]) {
        const r = hopsOutOfFrame(line);
        hops += r.hops;
        out.push(...r.out);
      }
    }
    expect(hops).toBeGreaterThan(10);
    expect(out).toEqual([]);
  });
});
