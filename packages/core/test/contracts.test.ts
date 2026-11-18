/**
 * Contract tests (work package 0, gate G0). They prove the frozen ids, the identity tables,
 * the reducer and the three fixtures. No lane edits this file.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  COMPANION_IDS, CONTRACT_REV, LOG_VERSION, LOOK_SPACE, MOVE_IDS, PERK_IDS, RARITY_OF, RARITY_WEIGHT,
  RIVALS_PER_LEVEL, RULES_VERSION, SHIELD_IDS, SHIELD_META, SKILL_IDS, STAGE_IDS, STEP_TYPES, WEAPON_IDS, WEAPON_META,
  checkLog, hpPercent, impactFamily, initialState, isCompanionId, isMoveId, isPerkId, isProcId, isShieldId, isSkillId,
  isStageId, isWeaponId, killStep, perkKind, reduce, resultOf, stageFor, stateAt,
} from "../src/index";
import type { BagItem, BoutLog, BoutState, FighterSnapshot, HeldId, Rarity, StageId, Step, StepType } from "../src/index";
import { BOUT_FIXTURES, SNAPSHOTS, allStepsA, allStepsB, boutAllSteps, boutCap, boutGate } from "../src/fixtures/index";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function deepFreeze<T>(v: T): T {
  if (v !== null && typeof v === "object") {
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
}
function countBy<T extends string>(list: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) out[x] = (out[x] ?? 0) + 1;
  return out;
}

describe("ids", () => {
  it("has 41 weapons, 39 skills, 12 Moves, 6 companions and 6 shields (content v2)", () => {
    expect(WEAPON_IDS.length).toBe(41);
    expect(SKILL_IDS.length).toBe(39);
    expect(MOVE_IDS.length).toBe(12);
    expect(COMPANION_IDS.length).toBe(6);
    expect(SHIELD_IDS.length).toBe(6);
    expect(WEAPON_IDS.filter((id) => WEAPON_META[id].tags.includes("thrown")).length).toBe(9);
    // The door and the lid moved: each is a shield now, and in no other list.
    expect(WEAPON_IDS as readonly string[]).not.toContain("bin-lid");
    expect(SKILL_IDS as readonly string[]).not.toContain("car-door");
    expect([...SHIELD_IDS]).toEqual(["car-door", "bin-lid", "wooden-pallet", "ironing-board", "skateboard", "riot-shield"]);
  });

  it("has no id in two lists and no id twice in one list", () => {
    const all: string[] = [...WEAPON_IDS, ...SKILL_IDS, ...COMPANION_IDS, ...SHIELD_IDS];
    expect(new Set(all).size).toBe(92);
    expect(new Set(SHIELD_IDS).size).toBe(SHIELD_IDS.length);
    expect(new Set(WEAPON_IDS).size).toBe(WEAPON_IDS.length);
    expect(new Set(SKILL_IDS).size).toBe(SKILL_IDS.length);
    expect(new Set(MOVE_IDS).size).toBe(MOVE_IDS.length);
    expect(new Set(COMPANION_IDS).size).toBe(COMPANION_IDS.length);
    expect(all).not.toContain("fists");
  });

  it("keeps MOVE_IDS inside SKILL_IDS, as the last twelve skills", () => {
    for (const id of MOVE_IDS) expect(SKILL_IDS).toContain(id);
    expect(SKILL_IDS.slice(-12)).toEqual([...MOVE_IDS]);
  });

  it("writes every id in lower-case words joined by hyphens", () => {
    for (const id of PERK_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("lists 92 perks and sorts each into its kind", () => {
    expect(PERK_IDS.length).toBe(92);
    expect(new Set(PERK_IDS).size).toBe(92);
    for (const id of SHIELD_IDS) { expect(perkKind(id)).toBe("shield"); expect(isShieldId(id)).toBe(true); expect(isProcId(id)).toBe(true); }
    for (const id of SKILL_IDS) expect(isProcId(id)).toBe(true);
    expect(isProcId("pipe")).toBe(false);
    for (const id of WEAPON_IDS) { expect(perkKind(id)).toBe("weapon"); expect(isWeaponId(id)).toBe(true); }
    for (const id of SKILL_IDS) { expect(perkKind(id)).toBe("skill"); expect(isSkillId(id)).toBe(true); }
    for (const id of COMPANION_IDS) { expect(perkKind(id)).toBe("companion"); expect(isCompanionId(id)).toBe(true); }
    for (const id of MOVE_IDS) expect(isMoveId(id)).toBe(true);
    expect(isMoveId("padding")).toBe(false);
    expect(isPerkId("fists")).toBe(false);
    expect(isPerkId("not-a-perk")).toBe(false);
  });

  it("is at contract rev 2 and log version 2; the rules version stays 1", () => {
    expect(RULES_VERSION).toBe(1);
    expect(LOG_VERSION).toBe(2);
    expect(CONTRACT_REV).toBe(5);
    expect(RIVALS_PER_LEVEL).toBe(240);
  });
});

describe("arenas", () => {
  it("are five, in the plan's order, with the yard first", () => {
    expect([...STAGE_IDS]).toEqual(["yard", "yard-night", "rooftop", "backyard", "gym"]);
    expect(new Set(STAGE_IDS).size).toBe(5);
    for (const id of STAGE_IDS) { expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/); expect(isStageId(id)).toBe(true); }
    expect(isStageId("car-park")).toBe(false);
    expect(PERK_IDS as readonly string[]).not.toContain("yard");
  });

  it("come from the bout seed alone: the same seed gives the same place", () => {
    for (const seed of [0, 1, 7, 1400, 2 ** 31, 2 ** 32 - 1, 123456789]) {
      const first = stageFor(seed);
      expect(STAGE_IDS).toContain(first);
      for (let k = 0; k < 3; k++) expect(stageFor(seed)).toBe(first);
    }
  });

  it("reach all five over seeds 0 to 999, 200 bouts each", () => {
    const count: Record<string, number> = {};
    for (let seed = 0; seed < 1000; seed++) count[stageFor(seed)] = (count[stageFor(seed)] ?? 0) + 1;
    expect(count).toEqual({ yard: 200, "yard-night": 200, rooftop: 200, backyard: 200, gym: 200 });
  });

  it("spread the high seeds too, and never throw on a bad one", () => {
    const seen = new Set<StageId>();
    for (let k = 0; k < 500; k++) seen.add(stageFor(4294967295 - k * 7919));
    expect(seen.size).toBe(5);
    for (const bad of [-1, -1400, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 40 + 3]) expect(STAGE_IDS).toContain(stageFor(bad));
    expect(stageFor(Number.NaN)).toBe("yard");
  });

  it("give each fixture a fixed place, and the gate bout the yard", () => {
    expect(stageFor(boutGate.seed)).toBe("yard");            // the one arena the gate pack draws
    expect(stageFor(boutAllSteps.seed)).toBe("rooftop");
    expect(stageFor(boutCap.seed)).toBe("backyard");
    expect([boutGate.seed, boutAllSteps.seed, boutCap.seed]).toEqual([1400, 1402, 1403]);
  });
});

describe("identity tables", () => {
  const rarities: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "mythic"];
  const counts = (ids: readonly (keyof typeof RARITY_OF)[]): number[] => {
    const c = countBy(ids.map((id) => RARITY_OF[id]));
    return rarities.map((r) => c[r] ?? 0);
  };

  it("WEAPON_META has 42 entries: the 41 weapons and fists", () => {
    expect(Object.keys(WEAPON_META).sort()).toEqual([...WEAPON_IDS, "fists"].sort());
  });

  it("RARITY_OF has 92 entries, one per perk", () => {
    expect(Object.keys(RARITY_OF).sort()).toEqual([...PERK_IDS].sort());
    for (const id of PERK_IDS) expect(rarities).toContain(RARITY_OF[id]);
  });

  it("has the rarity counts of content v2: weapons 9/12/11/6/3, skills 7/16/12/3/1, shields 1/2/2/1/0", () => {
    expect(counts(WEAPON_IDS)).toEqual([9, 12, 11, 6, 3]);
    expect(counts(SKILL_IDS)).toEqual([7, 16, 12, 3, 1]);
    expect(counts(SHIELD_IDS)).toEqual([1, 2, 2, 1, 0]);
    for (const id of SHIELD_IDS) expect(SHIELD_META[id].rarity).toBe(RARITY_OF[id]);
    expect(Object.keys(SHIELD_META).sort()).toEqual([...SHIELD_IDS].sort());
    expect(RARITY_OF["stray-dog"]).toBe("uncommon");
    expect(RARITY_OF.crow).toBe("rare");
    expect(RARITY_OF["alley-cat"]).toBe("rare");
    expect(RARITY_OF.raccoon).toBe("uncommon");
    expect(RARITY_OF.goose).toBe("epic");
    expect(RARITY_OF.boar).toBe("epic");
  });

  it("agrees with itself: a weapon has one rarity in both tables", () => {
    expect(WEAPON_META.fists.rarity).toBeNull();
    for (const id of WEAPON_IDS) expect(WEAPON_META[id].rarity).toBe(RARITY_OF[id]);
  });

  it("gives every weapon a clip, legal tags and a Reach from 0 to 4", () => {
    const clips = ["punch", "flick", "swing", "smash", "thrust", "throw"];
    const tags = ["light", "heavy", "pole", "thrown", "blade"];
    for (const id of [...WEAPON_IDS, "fists"] as const) {
      const m = WEAPON_META[id];
      expect(clips).toContain(m.clip);
      for (const t of m.tags) expect(tags).toContain(t);
      expect(new Set(m.tags).size).toBe(m.tags.length);
      expect(Number.isInteger(m.reach) && m.reach >= 0 && m.reach <= 4).toBe(true);
      // A Thrown weapon uses the throw clip and counts as Reach 0, and nothing else throws.
      expect(m.tags.includes("thrown")).toBe(m.clip === "throw");
      if (m.clip === "throw") expect(m.reach).toBe(0);
    }
    expect(countBy(WEAPON_IDS.map((id) => WEAPON_META[id].clip))).toEqual({ swing: 15, flick: 4, thrust: 5, smash: 7, throw: 9, punch: 1 });
  });

  it("matches spot rows of the brief's weapon table", () => {
    expect(WEAPON_META.fists).toMatchObject({ rarity: null, tags: [], clip: "punch", reach: 0 });
    expect(WEAPON_META.pipe).toMatchObject({ rarity: "common", tags: [], clip: "swing", reach: 1 });
    expect(WEAPON_META["pocket-knife"]).toMatchObject({ rarity: "common", tags: ["light", "blade"], clip: "flick", reach: 0 });
    expect(WEAPON_META.broom).toMatchObject({ rarity: "common", tags: ["pole"], clip: "thrust", reach: 3 });
    expect(WEAPON_META.sledgehammer).toMatchObject({ rarity: "uncommon", tags: ["heavy"], clip: "smash", reach: 1 });
    expect(WEAPON_META.darts).toMatchObject({ rarity: "uncommon", tags: ["thrown", "light"], clip: "throw", reach: 0 });
    expect(WEAPON_META["stop-sign"]).toMatchObject({ rarity: "rare", tags: ["pole", "heavy", "blade"], clip: "smash", reach: 3 });
    expect(WEAPON_META["bike-chain"].reach).toBe(4);
    expect(WEAPON_META["lawn-flamingo"]).toMatchObject({ rarity: "mythic", tags: ["pole"], clip: "thrust", reach: 4 });
  });

  const HELD: readonly HeldId[] = [...WEAPON_IDS, "fists"];

  it("holds no field it does not name (a typo in a row is not silently kept)", () => {
    const known = ["rarity", "tags", "clip", "reach", "hands", "pair", "use", "flight", "flex"];
    for (const id of HELD) for (const key of Object.keys(WEAPON_META[id])) expect(known, `${id}.${key}`).toContain(key);
  });

  it("says how many hands every held item takes: 18 on one shaft, 3 as a pair, 21 in one hand", () => {
    for (const id of HELD) expect([1, 2], id).toContain(WEAPON_META[id].hands);
    const two = HELD.filter((id) => WEAPON_META[id].hands === 2);
    const pair = HELD.filter((id) => WEAPON_META[id].pair === true);
    expect(pair).toEqual(["knuckle-dusters", "screwdrivers", "fists"]);
    for (const id of pair) expect(WEAPON_META[id].hands, id).toBe(2);
    for (const id of HELD) expect([undefined, true], id).toContain(WEAPON_META[id].pair);
    // Both hands on one shaft: the back hand is pinned to the art's second grip.
    expect(two.filter((id) => !pair.includes(id))).toEqual(["broom", "bat", "pitchfork", "shovel", "sledgehammer",
      "pickaxe", "rebar", "garden-shears", "stop-sign", "anvil", "ball-and-chain", "pool-cue", "lawn-flamingo",
      "golf-club", "hockey-stick", "folding-chair", "cricket-bat", "tyre"]);
    expect(HELD.filter((id) => WEAPON_META[id].hands === 1)).toEqual(["pipe", "pocket-knife", "machete", "hand-axe",
      "crowbar", "darts", "bike-chain", "monkey-wrench", "boomerang", "umbrella", "bricks", "rubber-chicken",
      "frying-pan", "tyre-iron", "wok", "plunger", "plastic-bottle", "rubber-ball", "paint-can", "traffic-cone", "hubcap"]);
  });

  it("gives every held item one plain line of use that ends with the part that hits", () => {
    const seen = new Set<string>();
    for (const id of HELD) {
      const use = WEAPON_META[id].use;
      expect(typeof use, id).toBe("string");
      expect(use.trim(), id).toBe(use);
      expect(use.length, id).toBeGreaterThanOrEqual(20);
      expect(use.length, id).toBeLessThanOrEqual(130);
      expect(use, id).toMatch(/^[a-z][a-z ,-]+; the [a-z ]+ hits?$/);
      seen.add(use);
    }
    expect(seen.size).toBe(42);
    // No glass and no blood, ever: the bottle is plastic and says so.
    expect(WEAPON_META["plastic-bottle"].use).toMatch(/plastic/);
    for (const id of HELD) expect(WEAPON_META[id].use, id).not.toMatch(/blood|glass bottle|broken glass/);
    expect(WEAPON_META.pipe.use).toBe("gripped near one end, side swing like a club; the far end hits");
  });

  it("sets a flight on exactly the nine Thrown weapons", () => {
    const flights = Object.fromEntries(HELD.filter((id) => WEAPON_META[id].flight !== undefined).map((id) => [id, WEAPON_META[id].flight]));
    expect(flights).toEqual({ darts: "straight", boomerang: "return", bricks: "tumble", "plastic-bottle": "tumble",
      "rubber-ball": "bounce", "paint-can": "tumble", "traffic-cone": "tumble", hubcap: "spin", tyre: "roll" });
    for (const id of HELD) {
      expect(WEAPON_META[id].flight !== undefined, id).toBe(WEAPON_META[id].tags.includes("thrown"));
      expect("flight" in WEAPON_META[id], id).toBe(WEAPON_META[id].tags.includes("thrown"));
    }
  });

  it("marks exactly the three weapons that bend, and none of them is a pair or Thrown", () => {
    const flex = HELD.filter((id) => WEAPON_META[id].flex === true);
    expect(flex).toEqual(["bike-chain", "ball-and-chain", "rubber-chicken"]);
    for (const id of flex) {
      expect(WEAPON_META[id].pair, id).toBeUndefined();
      expect(WEAPON_META[id].flight, id).toBeUndefined();
    }
  });

  it("gives every shield one plain line of how it is carried, ending with the part that blocks", () => {
    for (const id of SHIELD_IDS) expect(SHIELD_META[id].use, id).toMatch(/^[a-z][a-z ,-]+; the [a-z ]+ blocks?( and splinters?)?$/);
  });

  it("weights rarity 400 / 150 / 50 / 12 / 2", () => {
    expect(RARITY_WEIGHT).toEqual({ common: 400, uncommon: 150, rare: 50, epic: 12, mythic: 2 });
  });

  it("sorts held items into three sound families", () => {
    expect(impactFamily("fists")).toBe("fist");
    expect(impactFamily("knuckle-dusters")).toBe("fist");
    expect(impactFamily(null)).toBe("fist");
    expect(impactFamily("pocket-knife")).toBe("blade");
    expect(impactFamily("stop-sign")).toBe("blade");
    expect(impactFamily("pipe")).toBe("blunt");
    expect(impactFamily("umbrella")).toBe("blunt");
    const blades = WEAPON_IDS.filter((id) => impactFamily(id) === "blade");
    expect(blades).toEqual(["pocket-knife", "machete", "hand-axe", "garden-shears", "stop-sign"]);
  });
});

describe("step types", () => {
  it("lists all 17, once each", () => {
    expect(STEP_TYPES.length).toBe(17);
    expect(new Set(STEP_TYPES).size).toBe(17);
  });
});

/** Max HP by the rules of the brief: (30 + 7 x Health + 3 x level), minus the companion cost. */
function maxHpOf(s: FighterSnapshot): number {
  const health = Math.floor((s.stats.points.health * s.stats.mult.health) / 100);
  const cost = s.perks.reduce((sum, p) => sum + (p === "raccoon" ? 8 : p === "goose" ? 20 : p === "boar" ? 30 : 0), 0);   // the fixtures own no other pet
  return Math.floor(((30 + 7 * health + 3 * s.level) * (100 - cost)) / 100);
}
const COMPANION_HP = { raccoon: 14, goose: 22, boar: 80 } as const;

describe("fixture snapshots", () => {
  const six = Object.values(SNAPSHOTS);
  const every: FighterSnapshot[] = [...six, allStepsA, allStepsB];

  it("are six, in the plan's order", () => {
    expect(Object.keys(SNAPSHOTS)).toEqual(["l1Fists", "l1Pipe", "l1Knife", "l10Raccoon", "l10Boar", "l20Thrower"]);
    expect(six.map((s) => s.level)).toEqual([1, 1, 1, 10, 10, 20]);
    expect(new Set(every.map((s) => s.id)).size).toBe(every.length);
  });

  it("use only known ids and looks inside LOOK_SPACE", () => {
    for (const s of every) {
      expect(s.rulesVersion).toBe(1);
      for (const p of s.perks) expect(isPerkId(p), `${s.id}: ${p}`).toBe(true);
      expect(Object.keys(s.look).sort()).toEqual(Object.keys(LOOK_SPACE).sort());
      for (const k of Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[]) {
        expect(Number.isInteger(s.look[k]) && s.look[k] >= 0 && s.look[k] < LOOK_SPACE[k], `${s.id}: look.${k}`).toBe(true);
      }
      expect(s.name).toMatch(/^[A-Za-z0-9 -]{3,14}$/);
    }
  });

  it("obey the creation and level-up rules (the six that stand for real records)", () => {
    const pointBoosters = ["big-heart", "heavy-hands", "light-feet", "fast-twitch"];
    for (const s of six) {
      const pts = s.stats.points;
      const total = pts.health + pts.strength + pts.agility + pts.speed;
      const perkPicks = s.perks.length - 1;                 // the first perk is the starting perk
      const statPicks = s.level - 1 - perkPicks;
      expect(statPicks, `${s.id}: more perks than picks`).toBeGreaterThanOrEqual(0);
      const boosts = s.perks.filter((p) => pointBoosters.includes(p)).length;
      expect(total, `${s.id}: stat points`).toBe(14 + 2 * statPicks + 3 * boosts);
      // One copy of a perk only (two Raccoons would be the one exception).
      expect(new Set(s.perks).size).toBe(s.perks.length);
      // Whistle is never offered to a scrapper with no companion.
      if (s.perks.includes("whistle")) expect(s.perks.some((p) => isCompanionId(p))).toBe(true);
      expect(s.perks.includes("goose") && s.perks.includes("boar")).toBe(false);
    }
    for (const s of six.filter((x) => x.level === 1)) {
      expect(s.perks.length).toBe(1);
      for (const v of Object.values(s.stats.points)) expect(v >= 2 && v <= 5).toBe(true);
      for (const v of Object.values(s.stats.mult)) expect(v).toBe(100);
      expect(maxHpOf(s) >= 47 && maxHpOf(s) <= 68).toBe(true);
    }
    expect(SNAPSHOTS.l1Fists.perks.some((p) => isWeaponId(p))).toBe(false);
    expect(SNAPSHOTS.l1Pipe.perks).toEqual(["pipe"]);
    expect(SNAPSHOTS.l1Knife.perks).toEqual(["pocket-knife"]);
    expect(SNAPSHOTS.l10Raccoon.perks).toContain("raccoon");
    expect(SNAPSHOTS.l10Raccoon.stats.mult.strength).toBe(140);     // Heavy Hands is already in the stats
    expect(SNAPSHOTS.l10Boar.perks).toContain("boar");
    expect(SNAPSHOTS.l20Thrower.perks).toEqual(expect.arrayContaining(["darts", "car-door", "pitcher"]));
    expect(SNAPSHOTS.l20Thrower.stats.mult.agility).toBe(140);      // Light Feet
  });
});

describe.each(Object.values(BOUT_FIXTURES))("fixture $name", ({ name, log, a, b }) => {
  const final = stateAt(log, log.steps.length);

  it("is a well-formed log", () => {
    expect(checkLog(log)).toEqual([]);
    expect(log.logVersion).toBe(2);
    expect(log.rulesVersion).toBe(1);
  });

  it("reduces to its own result", () => {
    expect(resultOf(final)).toEqual(log.result);
    expect(final.ended).toEqual({ winner: log.result.winner, reason: log.result.reason });
    expect(final.i).toBe(log.steps.length);
  });

  it("seeks to the same state as playing step by step", () => {
    let s: BoutState = initialState(log.init);
    expect(stateAt(log, 0)).toEqual(s);
    for (let n = 0; n < log.steps.length; n++) {
      s = reduce(s, log.steps[n]!);
      expect(stateAt(log, n + 1)).toEqual(s);
    }
    expect(stateAt(log, log.steps.length + 5)).toEqual(s);
    expect(stateAt(log, -3)).toEqual(initialState(log.init));
  });

  it("never changes a state or a step it is given", () => {
    const frozen = deepFreeze(clone(log));
    let s = deepFreeze(initialState(frozen.init));
    for (const step of frozen.steps) s = deepFreeze(reduce(s, step));
    expect(resultOf(s)).toEqual(log.result);
  });

  it("keeps HP in range and every hit lowers it by its damage", () => {
    for (let n = 0; n <= log.steps.length; n++) {
      for (const actor of Object.values(stateAt(log, n).actors)) {
        expect(actor.hp >= 0 && actor.hp <= actor.maxHp).toBe(true);
      }
    }
  });

  it("names only weapons and Moves that are in the id lists", () => {
    const weapons: (string | null)[] = [];
    const moves: string[] = [];
    const bagIds = (bag: readonly BagItem[]): void => {
      for (const it of bag) (it.k === "weapon" ? weapons : moves).push(it.id);
    };
    bagIds(log.init.bag.a);
    bagIds(log.init.bag.b);
    for (const step of log.steps) {
      if ("bagAfter" in step) bagIds(step.bagAfter);
      if (step.t === "draw" || step.t === "disarm") weapons.push(step.weapon);
      if (step.t === "swap") weapons.push(step.dropped, step.weapon);
      if (step.t === "move") { moves.push(step.move); if (step.taken !== undefined) weapons.push(step.taken); }
      if (step.t === "attack" || step.t === "intercept" || step.t === "riposte" || step.t === "throw") weapons.push(step.weapon);
    }
    for (const id of weapons) expect(id === null || id === "fists" || isWeaponId(id), String(id)).toBe(true);
    for (const id of moves) expect(isMoveId(id), id).toBe(true);
  });

  it("starts from its two snapshots", () => {
    const sides = [["a", a], ["b", b]] as const;
    for (const [side, snap] of sides) {
      const bag = log.init.bag[side];
      expect(bag.filter((it) => it.k === "weapon").map((it) => it.id).sort()).toEqual(snap.perks.filter((p) => isWeaponId(p)).sort());
      expect(bag.filter((it) => it.k === "move").map((it) => it.id).sort()).toEqual(snap.perks.filter((p) => isMoveId(p)).sort());
      expect(log.init.shield[side]).toBe(snap.perks.find((p) => isShieldId(p)) ?? null);
      const mine = log.init.actors.filter((x) => x.id.startsWith(side));
      expect(mine.find((x) => x.id === `${side}0`)).toEqual({ id: `${side}0`, kind: "scrapper", maxHp: maxHpOf(snap) });
      const companions = mine.filter((x) => x.kind !== "scrapper");
      // Log rule 15: companions take 1, 2, 3 in the order they stand in the owner's perks.
      expect([...companions].sort((p, q) => p.id.localeCompare(q.id)).map((x) => x.kind)).toEqual(snap.perks.filter((p) => isCompanionId(p)));
      expect(companions.map((x) => x.id).sort()).toEqual(companions.map((_, n) => `${side}${n + 1}`));
      for (const c of companions) {
        if (c.kind === "scrapper") continue;
        expect(c.maxHp).toBe(Math.floor(((COMPANION_HP as Record<string, number>)[c.kind]! * (100 + 4 * (snap.level - 1))) / 100));
      }
    }
    expect(Object.keys(BOUT_FIXTURES)).toEqual(["bout-gate", "bout-all-steps", "bout-cap"]);
    expect(BOUT_FIXTURES[name].name).toBe(name);
  });

  it("plays in one of the five arenas", () => {
    expect(STAGE_IDS).toContain(stageFor(log.seed));
  });
});

describe("the gate bout", () => {
  const steps = boutGate.steps;
  const swings = steps.filter((s): s is Extract<Step, { t: "attack" }> => s.t === "attack");

  it("is 14 turns: staggered entry, two draws, a crit, an evade, a two-swing combo, the knockout", () => {
    expect(boutGate.result).toEqual({ winner: "a", reason: "ko", turns: 14, hpPct: { a: 6, b: 0 } });
    expect(new Set(steps.filter((s) => s.turn > 0).map((s) => s.turn)).size).toBe(14);
    expect(steps.slice(0, 2).map((s) => s.t)).toEqual(["enter", "enter"]);
    expect(steps.filter((s) => s.t === "draw").length).toBe(2);
    expect(swings.filter((s) => s.crit).length).toBe(1);
    expect(swings.filter((s) => s.outcome === "evade").length).toBe(1);
    expect(swings.filter((s) => s.why === "combo").length).toBe(1);
    expect(swings.filter((s) => s.outcome === "block").length).toBe(0);
    expect(steps.slice(-2).map((s) => s.t)).toEqual(["ko", "end"]);
    // Only step types the 13 gate clips can show.
    expect([...new Set(steps.map((s) => s.t))].sort()).toEqual(["attack", "draw", "end", "enter", "ko"]);
  });

  it("uses only damage values the rules can give at level 1 with Strength 3", () => {
    const range = { fists: [5, 8], "pocket-knife": [6, 9], pipe: [11, 14] } as const;
    for (const s of swings.filter((x) => x.outcome === "hit")) {
      const r = range[s.weapon as keyof typeof range];
      expect(r, String(s.weapon)).toBeDefined();
      const ok = s.crit
        ? [0, 1, 2, 3].some((k) => Math.floor(((r[0] + k) * 3) / 2) === s.damage && r[0] + k <= r[1])
        : s.damage >= r[0] && s.damage <= r[1];
      expect(ok, `${s.weapon} for ${s.damage}`).toBe(true);
    }
    expect(BOUT_FIXTURES["bout-gate"].a.stats.points.strength).toBe(3);
    expect(BOUT_FIXTURES["bout-gate"].b.stats.points.strength).toBe(3);
  });

  it("has its kill step at the last swing, and only the crit is a heavy hit", () => {
    const k = killStep(boutGate);
    expect(k).toBe(18);
    expect(steps[k]).toMatchObject({ t: "attack", actor: "a0", target: "b0", hpAfter: 0 });
    const heavy = swings.filter((s) => s.outcome === "hit" && (s.crit || s.damage * 4 >= (s.target === "a0" ? 68 : 61)));
    expect(heavy.length).toBe(1);
    expect(heavy[0]!.crit).toBe(true);
  });

  it("ends with the right hands, bags and floor", () => {
    const end = stateAt(boutGate, steps.length);
    expect(end.actors.a0).toMatchObject({ hp: 4, status: "up", held: "pipe" });
    expect(end.actors.b0).toMatchObject({ hp: 0, status: "ko", held: "pocket-knife" });
    expect(end.bag).toEqual({ a: [], b: [] });
    expect(end.floor).toEqual([]);
    expect(end.turn).toBe(14);
  });
});

describe("the all-steps bout", () => {
  const steps = boutAllSteps.steps;

  it("holds all 17 step types", () => {
    const seen = new Set<StepType>(steps.map((s) => s.t));
    for (const t of STEP_TYPES) expect(seen.has(t), t).toBe(true);
    expect(seen.size).toBe(17);
  });

  it("holds every Move at least once, written the way the log rules say", () => {
    const used = new Set(steps.filter((s): s is Extract<Step, { t: "move" }> => s.t === "move").map((s) => s.move));
    for (const id of MOVE_IDS) expect(used.has(id), id).toBe(true);
    const after = (move: string): Step[] => {
      const at = steps.findIndex((s) => s.t === "move" && s.move === move && !(s.move === "snatch" && s.taken === undefined));
      const turn = steps[at]!.turn;
      return steps.slice(at).filter((s) => s.turn === turn);
    };
    expect(after("energy-drink").map((s) => s.t)).toEqual(["move", "heal"]);
    expect(after("whistle").map((s) => s.t)).toEqual(["move", "heal"]);
    expect(after("tarp").map((s) => s.t)).toEqual(["move", "snare"]);
    expect(after("air-horn").map((s) => s.t)).toEqual(["move", "flee"]);
    expect(after("body-slam").map((s) => s.t)).toEqual(["move", "disarm", "shieldOff"]);
    expect(after("second-wind").map((s) => s.t)).toEqual(["move", "heal"]);
    expect(after("grapple").map((s) => s.t)).toEqual(["move", "snare"]);
    expect(after("grapple")[0]).toMatchObject({ target: "a0", hits: [{ target: "a0" }] });
    expect(after("sand-in-the-eyes").map((s) => s.t)).toEqual(["move"]);
    expect(after("sand-in-the-eyes")[0]).toMatchObject({ target: "a0" });
    expect(after("taunt").map((s) => s.t)).toEqual(["move"]);
    expect(after("firecrackers")[0]).toMatchObject({ hits: [{ target: "a0" }, { target: "a2" }] });
    expect(after("snatch")[0]).toMatchObject({ target: "b0", taken: "broom" });
    const hay = steps.findIndex((s) => s.t === "move" && s.move === "haymaker");
    const boosted = steps.slice(hay).find((s) => s.t === "attack");
    expect(boosted).toMatchObject({ boosted: true, actor: "a0" });
  });

  it("covers the variants the stage must stage", () => {
    const has = (pred: (s: Step) => boolean): boolean => steps.some(pred);
    expect(has((s) => s.t === "attack" && s.outcome === "block")).toBe(true);
    expect(has((s) => s.t === "attack" && s.outcome === "evade")).toBe(true);
    expect(has((s) => s.t === "attack" && s.crit)).toBe(true);
    expect(has((s) => s.t === "attack" && s.why === "combo")).toBe(true);
    expect(has((s) => s.t === "attack" && s.why === "stubborn")).toBe(true);
    expect(has((s) => s.t === "attack" && s.weapon === null)).toBe(true);
    for (const after of ["held", "bag", "gone"]) expect(has((s) => s.t === "throw" && s.after === after), after).toBe(true);
    expect(has((s) => s.t === "throw" && s.outcome === "evade")).toBe(true);
    for (const cause of ["hit", "slam"]) {
      expect(has((s) => s.t === "disarm" && s.cause === cause && s.resisted !== true), cause).toBe(true);
      expect(has((s) => s.t === "shieldOff" && s.cause === cause), cause).toBe(true);
    }
    expect(has((s) => s.t === "disarm" && s.resisted === true)).toBe(true);
    expect(has((s) => s.t === "move" && s.move === "snatch" && s.taken === undefined)).toBe(true);
    expect(has((s) => s.t === "ko" && s.actor === "a1")).toBe(true);
    expect(boutAllSteps.init.actors.length).toBe(6);
    const procs = steps.flatMap((s) => ("procs" in s && s.procs !== undefined ? s.procs.map((p) => p.skill) : []));
    expect([...new Set(procs)].sort()).toEqual(["anticipation", "bin-lid", "car-door", "firm-grip", "last-stand", "payback", "stubborn"]);
    // An intercept is never followed by an attack in the same turn.
    const ic = steps.findIndex((s) => s.t === "intercept");
    expect(steps.filter((s) => s.turn === steps[ic]!.turn).map((s) => s.t)).toEqual(["intercept", "disarm"]);
    // The skipped snared turn leaves a hole in the turn numbers.
    expect(steps.some((s) => s.turn === 17)).toBe(false);
  });

  it("ends one snare by a hit and one by its third skipped turn", () => {
    const frees = steps.filter((s): s is Extract<Step, { t: "free" }> => s.t === "free");
    expect(frees.map((s) => `${s.actor}:${s.cause}`)).toEqual(["a0:hit", "b1:timeout", "a0:timeout"]);
    // By a hit: the free comes straight after the swing that landed, in the same turn.
    const hit = steps.indexOf(frees[0]!);
    expect(steps[hit - 1]).toMatchObject({ t: "attack", target: "a0", outcome: "hit", turn: frees[0]!.turn });
    // By timeout: the free is the only step of its turn, and two turns before it have no step.
    const out = frees[1]!;
    expect(steps.filter((s) => s.turn === out.turn)).toEqual([out]);
    const snare = steps.find((s) => s.t === "snare" && s.target === "b1")!;
    expect(snare.turn).toBe(22);
    expect(out.turn).toBe(31);
    for (const skipped of [25, 28]) expect(steps.some((s) => s.turn === skipped)).toBe(false);
    // The Boar does nothing between the tarp and the timeout.
    expect(steps.some((s) => s.turn > 22 && s.turn < 31 && "actor" in s && s.actor === "b1")).toBe(false);
    expect(stateAt(boutAllSteps, steps.indexOf(snare) + 1).actors.b1!.snared).toBe(true);
    expect(stateAt(boutAllSteps, steps.indexOf(out) + 1).actors.b1!.snared).toBe(false);
  });

  it("holds a Last Stand save, and overtime then takes the last HP with nobody named", () => {
    const save = steps.find((s) => s.t === "attack" && s.procs?.some((p) => p.skill === "last-stand"));
    expect(save).toMatchObject({ target: "b0", outcome: "hit", damage: 87, hpAfter: 1, crit: true, boosted: true, procs: [{ by: "b0", skill: "last-stand" }] });
    expect(stateAt(boutAllSteps, steps.indexOf(save!)).actors.b0!.hp).toBe(74);      // 74 HP, 87 damage, 1 left
    expect(allStepsB.perks).toContain("last-stand");
    const k = killStep(boutAllSteps);
    expect(steps[k]).toEqual({ t: "overtime", turn: 53, actor: "b0", damage: 12, hpAfter: 0 });
    expect(steps[k + 1]).toEqual({ t: "ko", turn: 53, actor: "b0", by: null });
    expect(steps.filter((s) => s.t === "overtime").length).toBe(4);
  });

  it("puts a seventh item on the floor, so the oldest of six must fade", () => {
    let most = 0;
    let firstSeventh = -1;
    for (let n = 0; n <= steps.length; n++) {
      const count = stateAt(boutAllSteps, n).floor.length;
      if (count === 7 && firstSeventh < 0) firstSeventh = n - 1;
      most = Math.max(most, count);
    }
    expect(most).toBe(7);
    expect(steps[firstSeventh]).toMatchObject({ t: "swap", turn: 52, dropped: "broom" });
    expect(steps.filter((s) => s.t === "swap").length).toBe(2);
  });

  it("ends with the right hands, shields, bags and seven items on the floor", () => {
    const end = stateAt(boutAllSteps, steps.length);
    expect(end.actors.a0).toMatchObject({ hp: 46, status: "up", held: "hand-axe", shield: null, snared: false });
    expect(end.actors.a1).toMatchObject({ hp: 0, status: "ko" });
    expect(end.actors.a2).toMatchObject({ hp: 36, status: "fled" });
    expect(end.actors.b0).toMatchObject({ hp: 0, status: "ko", held: "fists", shield: null });
    expect(end.actors.b1).toMatchObject({ hp: 96, status: "up", snared: false });
    expect(end.actors.b2).toMatchObject({ hp: 3, status: "up" });
    expect(end.bag.a).toEqual([{ k: "move", id: "whistle", uses: 1 }]);
    expect(end.bag.b).toEqual([{ k: "move", id: "firecrackers", uses: 1 }]);
    expect(end.floor.map((f) => `${f.item}<${f.from}`)).toEqual(
      ["car-door<a0", "bat<a0", "monkey-wrench<b0", "bin-lid<b0", "pocket-knife<b0", "darts<a0", "broom<a0"]);
    for (const f of end.floor) expect(["swap", "disarm", "shieldOff", "throw"]).toContain(steps[f.i]!.t);
    expect(killStep(boutAllSteps)).toBe(steps.length - 3);       // overtime, ko, end
  });

  it("tracks a held weapon through draw, snatch, throw, disarm and swap", () => {
    const heldAfterTurn = (turn: number, id: "a0" | "b0"): string => {
      const n = steps.findIndex((s) => s.turn > turn);
      return stateAt(boutAllSteps, n < 0 ? steps.length : n).actors[id]!.held;
    };
    expect([2, 8, 10, 13, 20, 23, 52].map((t) => heldAfterTurn(t, "a0"))).toEqual(["bat", "fists", "broom", "fists", "darts", "broom", "hand-axe"]);
    expect([1, 10, 12, 13, 14, 21].map((t) => heldAfterTurn(t, "b0"))).toEqual(["broom", "fists", "monkey-wrench", "monkey-wrench", "fists", "fists"]);
  });
});

describe("fixtures are frozen", () => {
  it("throws when a test tries to change a shared fixture", () => {
    expect(Object.isFrozen(boutGate.steps)).toBe(true);
    expect(Object.isFrozen(boutAllSteps.init.bag.a)).toBe(true);
    expect(Object.isFrozen(SNAPSHOTS.l1Pipe.stats.points)).toBe(true);
    expect(() => { boutGate.steps.pop(); }).toThrow();
    expect(() => { (boutGate.result as { turns: number }).turns = 99; }).toThrow();
    expect(clone(boutGate)).toEqual(boutGate);
  });
});

describe("reducer", () => {
  it("starts everyone up, at full HP, bare-handed, with full bags", () => {
    const s = initialState(boutAllSteps.init);
    expect(s).toMatchObject({ i: 0, turn: 0, floor: [], ended: null });
    expect(Object.keys(s.actors).sort()).toEqual(["a0", "a1", "a2", "b0", "b1", "b2"]);
    for (const a of Object.values(s.actors)) expect(a).toMatchObject({ hp: a.maxHp, status: "up", held: "fists", snared: false });
    expect(s.actors.a0!.shield).toBe("car-door");
    expect(s.actors.b0!.shield).toBe("bin-lid");
    expect(s.actors.a1!.shield).toBeNull();
    expect(s.bag).toEqual(boutAllSteps.init.bag);
    expect(s.bag.a).not.toBe(boutAllSteps.init.bag.a);
    expect(resultOf(s)).toBeNull();
  });

  it("reports -1 as the kill step of a cap ending, and keeps the loser standing", () => {
    expect(checkLog(boutCap)).toEqual([]);
    expect(killStep(boutCap)).toBe(-1);
    const end = stateAt(boutCap, boutCap.steps.length);
    expect(resultOf(end)).toEqual(boutCap.result);
    expect(end.ended).toEqual({ winner: "a", reason: "cap" });
    expect(end.actors.a0).toMatchObject({ hp: 50, status: "up" });
    expect(end.actors.b0).toMatchObject({ hp: 45, status: "up", held: "pocket-knife" });
    expect(boutCap.steps.some((s) => s.t === "ko")).toBe(false);
    expect(boutCap.steps[boutCap.steps.length - 1]).toEqual({ t: "end", turn: 150, winner: "a", reason: "cap" });
    // The higher HP percentage wins: 82 against 74.
    expect(boutCap.result).toEqual({ winner: "a", reason: "cap", turns: 150, hpPct: { a: 82, b: 74 } });
  });

  it("takes the turn of a cap ending from the end step, also when the last turn was skipped", () => {
    // Log rule 4: the last turn before the stop may be a skipped snared turn with no step.
    const log = clone(boutCap);
    log.steps = log.steps.filter((s) => s.turn !== 150 || s.t === "end");
    log.result.hpPct.b = hpPercent(49, 61);
    expect(checkLog(log)).toEqual([]);
    expect(resultOf(stateAt(log, log.steps.length))).toMatchObject({ turns: 150, reason: "cap" });
  });

  it("finds a kill step made by overtime or by a Move", () => {
    const base = clone(boutGate);
    const overtime: Step = { t: "overtime", turn: 14, actor: "b0", damage: 9, hpAfter: 0 };
    base.steps[18] = overtime;
    expect(killStep(base)).toBe(18);
    const move: Step = { t: "move", turn: 14, actor: "a0", move: "firecrackers", bagAfter: [], hits: [{ target: "b0", damage: 15, hpAfter: 0 }] };
    base.steps[18] = move;
    expect(killStep(base)).toBe(18);
    // A companion at 0 HP is not a kill step: the Raccoon falls at turn 3, the kill step is at turn 53.
    expect(boutAllSteps.steps[killStep(boutAllSteps)]).toMatchObject({ t: "overtime", actor: "b0", turn: 53 });
  });

  it("rounds HP percentages up, so only 0 HP reads 0", () => {
    expect(hpPercent(0, 68)).toBe(0);
    expect(hpPercent(1, 200)).toBe(1);
    expect(hpPercent(4, 68)).toBe(6);
    expect(hpPercent(68, 68)).toBe(100);
    expect(hpPercent(75, 135)).toBe(56);
  });
});

describe("checkLog can fail (each line plants one fault in a copy of a fixture)", () => {
  const broken = (edit: (log: BoutLog) => void, from: BoutLog = boutGate): string[] => {
    const copy = clone(from);
    edit(copy);
    return checkLog(copy);
  };

  it("a wrong hpAfter", () => {
    expect(broken((l) => { (l.steps[3] as Extract<Step, { t: "attack" }>).hpAfter = 60; }).join("\n")).toMatch(/step 3 .*hpAfter is 60/);
  });
  it("a wrong result", () => {
    expect(broken((l) => { l.result.hpPct.a = 7; }).join("\n")).toMatch(/result is/);
    expect(broken((l) => { l.result.turns = 15; }).join("\n")).toMatch(/result is/);
  });
  it("a missing end, a second end, a step after the end", () => {
    expect(broken((l) => { l.steps.pop(); }).join("\n")).toMatch(/0 end steps/);
    expect(broken((l) => { l.steps.push(l.steps[l.steps.length - 1]!); }).join("\n")).toMatch(/2 end steps/);
    expect(broken((l) => { l.steps.push(l.steps[0]!); }).join("\n")).toMatch(/follows the end/);
  });
  it("a missing ko step", () => {
    expect(broken((l) => { l.steps.splice(19, 1); }).join("\n")).toMatch(/no ko step/);
  });
  it("a swing with a weapon that is not in the hand", () => {
    expect(broken((l) => { (l.steps[4] as Extract<Step, { t: "attack" }>).weapon = "pipe"; }).join("\n")).toMatch(/swings pipe but holds fists/);
  });
  it("a draw of a weapon that is not in the bag, and a wrong bagAfter", () => {
    expect(broken((l) => { (l.steps[2] as Extract<Step, { t: "draw" }>).weapon = "bat"; }).join("\n")).toMatch(/not in the bag/);
    expect(broken((l) => { (l.steps[2] as Extract<Step, { t: "draw" }>).bagAfter = [{ k: "weapon", id: "pocket-knife" }]; }).join("\n")).toMatch(/bagAfter does not match/);
  });
  it("a turn number that goes down, and an actor that never enters", () => {
    expect(broken((l) => { l.steps[5]!.turn = 1; }).join("\n")).toMatch(/turn number goes down/);
    expect(broken((l) => { l.steps.splice(1, 1); }).join("\n")).toMatch(/b0 never enters/);
  });
  it("an evade that deals damage, and an actor that acts after its knockout", () => {
    expect(broken((l) => { (l.steps[10] as Extract<Step, { t: "attack" }>).damage = 3; }).join("\n")).toMatch(/evade has damage 0/);
    expect(broken((l) => { l.steps.splice(14, 0, { t: "attack", turn: 3, actor: "a1", target: "b0", weapon: null, outcome: "hit", damage: 5, crit: false, hpAfter: 146, n: 0 }); }, boutAllSteps).join("\n")).toMatch(/actor a1 is ko/);
  });
  it("a Move with no use left, a heal past the max, a second snare", () => {
    expect(broken((l) => { const at = l.steps.findIndex((s) => s.t === "move" && s.move === "air-horn"); l.steps.splice(at, 0, l.steps[at]!); }, boutAllSteps).join("\n")).toMatch(/using air-horn is not in the bag/);
    expect(broken((l) => { const h = l.steps.find((s) => s.t === "heal")!; if (h.t === "heal") { h.amount = 25; h.hpAfter = 42; } }, boutAllSteps).join("\n")).toMatch(/cannot pass the max/);
    expect(broken((l) => { const at = l.steps.findIndex((s) => s.t === "snare"); l.steps.splice(at, 0, l.steps[at]!); }, boutAllSteps).join("\n")).toMatch(/already snared/);
  });

  // ---- the order of the steps (log rules 4, 5, 10, 11, 13, 15, 16 and 17)
  const at = (l: BoutLog, pred: (s: Step) => boolean): number => {
    const i = l.steps.findIndex(pred);
    if (i < 0) throw new Error("the fixture has no such step");
    return i;
  };
  type Attack = Extract<Step, { t: "attack" }>;

  it("rule 16: shieldOff before disarm, and a hit on a snared actor with no free", () => {
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "disarm" && s.cause === "slam");
      [l.steps[i], l.steps[i + 1]] = [l.steps[i + 1]!, l.steps[i]!];
    }, boutAllSteps).join("\n")).toMatch(/after one hit the order is disarm, shieldOff, free, ko/);
    expect(broken((l) => { l.steps.splice(at(l, (s) => s.t === "free" && s.cause === "hit"), 1); }, boutAllSteps).join("\n"))
      .toMatch(/the hit on snared a0 is not followed by its free step/);
  });
  it("rule 16: a free by hit with no hit before it, and a ko that is late", () => {
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "free" && s.cause === "hit");
      const [free] = l.steps.splice(i, 1);
      l.steps.splice(i - 1, 0, free!);                       // now before the swing that frees
    }, boutAllSteps).join("\n")).toMatch(/a free step must come straight after the step that caused it/);
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "ko" && s.actor === "a1");
      [l.steps[i], l.steps[i + 1]] = [l.steps[i + 1]!, l.steps[i]!];
      l.steps[i + 1]!.turn = 4;
    }, boutAllSteps).join("\n")).toMatch(/a1 was left at 0 HP with no ko step before this step/);
  });
  it("rule 16: a disarm with the wrong cause, the wrong target, or after a swing that missed", () => {
    expect(broken((l) => { const d = l.steps[at(l, (s) => s.t === "disarm")]!; if (d.t === "disarm") d.cause = "slam"; }, boutAllSteps).join("\n"))
      .toMatch(/after a swing the cause is "hit"/);
    expect(broken((l) => { const d = l.steps[at(l, (s) => s.t === "shieldOff")]!; if (d.t === "shieldOff") d.actor = "b1"; }, boutAllSteps).join("\n"))
      .toMatch(/must name the actor and the target of the step that caused it/);
    expect(broken((l) => { l.steps.splice(11, 0, { t: "disarm", turn: 6, actor: "a0", target: "b0", weapon: "pocket-knife", cause: "hit" }); }).join("\n"))
      .toMatch(/only a landed hit can disarm/);
    expect(broken((l) => { l.steps.splice(11, 0, { t: "shieldOff", turn: 6, actor: "a0", target: "b0", shield: "bin-lid", cause: "hit" }); }).join("\n"))
      .toMatch(/an evaded swing cannot knock a shield off/);
    expect(broken((l) => { const d = l.steps[at(l, (s) => s.t === "shieldOff")]!; if (d.t === "shieldOff") d.shield = "skateboard"; }, boutAllSteps).join(" "))
      .toMatch(/knocks off skateboard but the target carries car-door/);
    expect(broken((l) => { (l.init.shield as Record<string, string | null>).a = "car-door-x"; }).join(" "))
      .toMatch(/side a carries an unknown shield/);
  });
  it("rule 5: a ko that names the wrong actor, and a ko by overtime that names one", () => {
    expect(broken((l) => { const k = l.steps[19]!; if (k.t === "ko") k.by = "b0"; }).join("\n")).toMatch(/by is b0, but the step that took the last HP gives a0/);
    expect(broken((l) => { const k = l.steps[at(l, (s) => s.t === "ko" && s.actor === "b0")]!; if (k.t === "ko") k.by = "a0"; }, boutAllSteps).join("\n"))
      .toMatch(/by is a0, but the step that took the last HP gives null/);
  });
  it("rule 4: an end that is not straight after the ko", () => {
    expect(broken((l) => { l.steps[20]!.turn = 15; l.result.turns = 15; }).join("\n")).toMatch(/the end of a knockout comes straight after the ko step/);
  });
  it("rule 17: a wrong swing number, and a Stubborn swing after a hit or twice in a turn", () => {
    expect(broken((l) => { (l.steps[9] as Attack).n = 2; }).join("\n")).toMatch(/n is 2, but this is swing 1 of b0 in this turn/);
    expect(broken((l) => { (l.steps[9] as Attack).why = "stubborn"; }).join("\n")).toMatch(/a Stubborn swing follows a swing of the same actor that was evaded or blocked/);
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "attack" && s.why === "stubborn");
      const first = l.steps[i - 1] as Attack;
      l.steps.splice(i + 1, 0, { ...first, n: 2, why: "stubborn", hpAfter: 138, procs: [{ by: "a0", skill: "stubborn" }] });
      (l.steps[i] as Attack).outcome = "block";
      (l.steps[i] as Attack).damage = 0;
      (l.steps[i] as Attack).hpAfter = 151;
    }, boutAllSteps).join("\n")).toMatch(/Stubborn gives one extra swing a turn/);
  });
  it("rule 10: a swing by the actor that was intercepted", () => {
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "intercept");
      l.steps.splice(i + 2, 0, { t: "attack", turn: 8, actor: "a0", target: "b0", weapon: "fists", outcome: "evade", damage: 0, crit: false, hpAfter: 151, n: 0 });
    }, boutAllSteps).join("\n")).toMatch(/a0 was intercepted in this turn and makes no swing in it/);
  });
  it("rule 11: a snare that times out in the middle of a turn, or in a turn that is not skipped", () => {
    expect(broken((l) => { l.steps[at(l, (s) => s.t === "free" && s.cause === "timeout")]!.turn = 23; }, boutAllSteps).join("\n"))
      .toMatch(/a snare that times out is the first step of its turn/);
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "free" && s.cause === "timeout");
      l.steps.splice(i + 1, 0, { t: "attack", turn: 31, actor: "b1", target: "a0", weapon: null, outcome: "evade", damage: 0, crit: false, hpAfter: 85, n: 0 });
    }, boutAllSteps).join("\n")).toMatch(/the turn in which the snare of b1 timed out was skipped/);
  });
  it("rule 11: in overtime a skipped turn still writes the overtime loss, and the third one the free step first", () => {
    // Brisket is snared at turn 147 and nobody hits him. His skipped turns are 148, 149 and 150.
    const log: BoutLog = {
      ...clone(boutCap),
      init: { ...clone(boutCap.init), bag: { a: [{ k: "move", id: "tarp", uses: 1 }], b: [{ k: "weapon", id: "pocket-knife" }] } },
      steps: [
        ...clone(boutCap.steps.slice(0, 5)),
        { t: "move", turn: 147, actor: "a0", move: "tarp", bagAfter: [], target: "b0" },
        { t: "snare", turn: 147, actor: "a0", target: "b0" },
        { t: "overtime", turn: 147, actor: "a0", damage: 4, hpAfter: 50 },
        { t: "overtime", turn: 148, actor: "b0", damage: 4, hpAfter: 51 },
        { t: "overtime", turn: 149, actor: "b0", damage: 4, hpAfter: 47 },
        { t: "free", turn: 150, actor: "b0", cause: "timeout" },
        { t: "overtime", turn: 150, actor: "b0", damage: 4, hpAfter: 43 },
        { t: "end", turn: 150, winner: "a", reason: "cap" },
      ],
      result: { winner: "a", reason: "cap", turns: 150, hpPct: { a: hpPercent(50, 61), b: hpPercent(43, 61) } },
    };
    expect(checkLog(log)).toEqual([]);
    // The same turn with the two steps the other way round is not a skipped turn any more.
    const wrong = clone(log);
    [wrong.steps[10], wrong.steps[11]] = [wrong.steps[11]!, wrong.steps[10]!];
    expect(checkLog(wrong).join("\n")).toMatch(/a snare that times out is the first step of its turn/);
  });
  it("rule 13: a step after an overtime loss in the same turn", () => {
    expect(broken((l) => {
      const i = at(l, (s) => s.t === "overtime");
      [l.steps[i - 1], l.steps[i]] = [l.steps[i]!, l.steps[i - 1]!];
    }, boutAllSteps).join("\n")).toMatch(/only its own ko and the end may follow the overtime step of b0 in the same turn/);
  });
  it("rule 15: a gap in the companion ids", () => {
    expect(broken((l) => { l.init.actors.find((x) => x.id === "a1")!.id = "a3"; }, boutAllSteps))
      .toEqual(["init: the companions of side a must be a1 to a2 with no gap"]);
  });
});

describe("CoreApi (the shape the sim lane must fill)", () => {
  // Compile-time checks: a wrong or missing member fails `pnpm typecheck`, not this test.
  type Api = import("../src/index").CoreApi;
  type Sheet = import("../src/index").SnapshotSheet;
  const randomName: Api["randomName"] extends (n: number) => string ? true : false = true;
  const snapshotSheet: Api["snapshotSheet"] extends (s: FighterSnapshot) => Sheet ? true : false = true;
  const weapons: keyof Api["content"]["weapons"] extends HeldId ? (HeldId extends keyof Api["content"]["weapons"] ? true : false) : false = true;
  const tables: keyof Api["content"] extends "weapons" | "skills" | "companions" | "shields" ? true : false = true;
  const sheetKeys: keyof Sheet extends "maxHp" | "effective" | "derived" | "companionCostPct" ? true : false = true;

  it("reaches the content tables, a random name and the sheet of any snapshot", () => {
    expect([randomName, snapshotSheet, weapons, tables, sheetKeys]).toEqual([true, true, true, true, true]);
  });
});

describe("the pure packages compile with no Node and no browser types", () => {
  // The tests of core, rig and stage get Node types (tsconfig.test.json) so they can read files
  // and hash. Their src must not: tsconfig.json keeps `types: []` and the ES library only, so a
  // stray Node or browser call in src is a compile error. This compiles one probe file as if it
  // stood in each package's src folder, with that package's own tsconfig.json.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packages = ["core", "rig", "stage"] as const;
  const PROBE_NODE = 'import { readFileSync } from "node:fs";\nexport const a = readFileSync;\nexport const b = process.argv;\n';
  const PROBE_DOM = "export const c = document.body;\nexport const d = window.innerWidth;\n";
  const PROBE_PLAIN = "export const e: number = [1, 2, 3].reduce((s, x) => s + x, 0);\n";

  function compile(pkg: (typeof packages)[number], config: string, text: string): string[] {
    const dir = path.resolve(here, "../..", pkg);
    const parsed = ts.getParsedCommandLineOfConfigFile(path.join(dir, config), {}, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); },
    });
    if (parsed === undefined) throw new Error(`cannot read ${pkg}/${config}`);
    const probe = path.join(dir, "src", "__probe__.ts").split("\\").join("/");
    const host = ts.createCompilerHost(parsed.options);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (name, lang, onError, fresh) =>
      name.split("\\").join("/") === probe ? ts.createSourceFile(name, text, lang) : read(name, lang, onError, fresh);
    const exists = host.fileExists.bind(host);
    host.fileExists = (name) => name.split("\\").join("/") === probe || exists(name);
    // The probe plus the type files the config itself adds (the one console type).
    const extra = parsed.fileNames.filter((f) => f.endsWith(".d.ts"));
    const program = ts.createProgram([probe, ...extra], parsed.options, host);
    return ts.getPreEmitDiagnostics(program)
      .filter((d) => d.file !== undefined && d.file.fileName.split("\\").join("/") === probe)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
  }

  for (const pkg of packages) {
    it(`${pkg}: a Node import and a Node global in src fail, plain code passes`, () => {
      expect(compile(pkg, "tsconfig.json", PROBE_PLAIN)).toEqual([]);
      const node = compile(pkg, "tsconfig.json", PROBE_NODE);
      expect(node.some((m) => m.includes("node:fs")), node.join(" | ")).toBe(true);
      expect(node.some((m) => m.includes("'process'")), node.join(" | ")).toBe(true);
      const dom = compile(pkg, "tsconfig.json", PROBE_DOM);
      expect(dom.some((m) => m.includes("'document'")), dom.join(" | ")).toBe(true);
      expect(dom.some((m) => m.includes("'window'")), dom.join(" | ")).toBe(true);
      // Control: the same Node probe compiles under the test config, so the error above comes
      // from the src config and not from a broken probe.
      expect(compile(pkg, "tsconfig.test.json", PROBE_NODE)).toEqual([]);
    }, 120_000);
  }
});
