/**
 * Contract tests (work package 0, gate G0). They prove the frozen ids, the identity tables,
 * the reducer and the three fixtures. No lane edits this file.
 */
import { describe, expect, it } from "vitest";
import {
  COMPANION_IDS, CONTRACT_REV, LOG_VERSION, LOOK_SPACE, MOVE_IDS, PERK_IDS, RARITY_OF, RARITY_WEIGHT,
  RIVALS_PER_LEVEL, RULES_VERSION, SKILL_IDS, STEP_TYPES, WEAPON_IDS, WEAPON_META,
  checkLog, hpPercent, impactFamily, initialState, isCompanionId, isMoveId, isPerkId, isSkillId,
  isWeaponId, killStep, perkKind, reduce, resultOf, stateAt,
} from "../src/index";
import type { BagItem, BoutLog, BoutState, FighterSnapshot, Rarity, Step, StepType } from "../src/index";
import { BOUT_FIXTURES, SNAPSHOTS, allStepsA, allStepsB, boutAllSteps, boutGate } from "../src/fixtures/index";

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
  it("has 28 weapons, 32 skills, 8 Moves and 3 companions", () => {
    expect(WEAPON_IDS.length).toBe(28);
    expect(SKILL_IDS.length).toBe(32);
    expect(MOVE_IDS.length).toBe(8);
    expect(COMPANION_IDS.length).toBe(3);
  });

  it("has no id in two lists and no id twice in one list", () => {
    const all: string[] = [...WEAPON_IDS, ...SKILL_IDS, ...COMPANION_IDS];
    expect(new Set(all).size).toBe(63);
    expect(new Set(WEAPON_IDS).size).toBe(WEAPON_IDS.length);
    expect(new Set(SKILL_IDS).size).toBe(SKILL_IDS.length);
    expect(new Set(MOVE_IDS).size).toBe(MOVE_IDS.length);
    expect(new Set(COMPANION_IDS).size).toBe(COMPANION_IDS.length);
    expect(all).not.toContain("fists");
  });

  it("keeps MOVE_IDS inside SKILL_IDS, as the last eight skills", () => {
    for (const id of MOVE_IDS) expect(SKILL_IDS).toContain(id);
    expect(SKILL_IDS.slice(-8)).toEqual([...MOVE_IDS]);
  });

  it("writes every id in lower-case words joined by hyphens", () => {
    for (const id of PERK_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("lists 63 perks and sorts each into its kind", () => {
    expect(PERK_IDS.length).toBe(63);
    expect(new Set(PERK_IDS).size).toBe(63);
    for (const id of WEAPON_IDS) { expect(perkKind(id)).toBe("weapon"); expect(isWeaponId(id)).toBe(true); }
    for (const id of SKILL_IDS) { expect(perkKind(id)).toBe("skill"); expect(isSkillId(id)).toBe(true); }
    for (const id of COMPANION_IDS) { expect(perkKind(id)).toBe("companion"); expect(isCompanionId(id)).toBe(true); }
    for (const id of MOVE_IDS) expect(isMoveId(id)).toBe(true);
    expect(isMoveId("padding")).toBe(false);
    expect(isPerkId("fists")).toBe(false);
    expect(isPerkId("not-a-perk")).toBe(false);
  });

  it("starts every version at 1", () => {
    expect(RULES_VERSION).toBe(1);
    expect(LOG_VERSION).toBe(1);
    expect(CONTRACT_REV).toBe(1);
    expect(RIVALS_PER_LEVEL).toBe(240);
  });
});

describe("identity tables", () => {
  const rarities: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "mythic"];
  const counts = (ids: readonly (keyof typeof RARITY_OF)[]): number[] => {
    const c = countBy(ids.map((id) => RARITY_OF[id]));
    return rarities.map((r) => c[r] ?? 0);
  };

  it("WEAPON_META has 29 entries: the 28 weapons and fists", () => {
    expect(Object.keys(WEAPON_META).sort()).toEqual([...WEAPON_IDS, "fists"].sort());
  });

  it("RARITY_OF has 63 entries, one per perk", () => {
    expect(Object.keys(RARITY_OF).sort()).toEqual([...PERK_IDS].sort());
    for (const id of PERK_IDS) expect(rarities).toContain(RARITY_OF[id]);
  });

  it("has the rarity counts of the brief: weapons 5/8/8/5/2, skills 6/13/9/3/1", () => {
    expect(counts(WEAPON_IDS)).toEqual([5, 8, 8, 5, 2]);
    expect(counts(SKILL_IDS)).toEqual([6, 13, 9, 3, 1]);
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
    expect(countBy(WEAPON_IDS.map((id) => WEAPON_META[id].clip))).toEqual({ swing: 10, flick: 4, thrust: 4, smash: 6, throw: 3, punch: 1 });
  });

  it("matches spot rows of the brief's weapon table", () => {
    expect(WEAPON_META.fists).toEqual({ rarity: null, tags: [], clip: "punch", reach: 0 });
    expect(WEAPON_META.pipe).toEqual({ rarity: "common", tags: [], clip: "swing", reach: 1 });
    expect(WEAPON_META["pocket-knife"]).toEqual({ rarity: "common", tags: ["light", "blade"], clip: "flick", reach: 0 });
    expect(WEAPON_META.broom).toEqual({ rarity: "common", tags: ["pole"], clip: "thrust", reach: 3 });
    expect(WEAPON_META.sledgehammer).toEqual({ rarity: "uncommon", tags: ["heavy"], clip: "smash", reach: 1 });
    expect(WEAPON_META.darts).toEqual({ rarity: "uncommon", tags: ["thrown", "light"], clip: "throw", reach: 0 });
    expect(WEAPON_META["stop-sign"]).toEqual({ rarity: "rare", tags: ["pole", "heavy", "blade"], clip: "smash", reach: 3 });
    expect(WEAPON_META["bike-chain"].reach).toBe(4);
    expect(WEAPON_META["lawn-flamingo"]).toEqual({ rarity: "mythic", tags: ["pole"], clip: "thrust", reach: 4 });
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
  const cost = s.perks.reduce((sum, p) => sum + (p === "raccoon" ? 8 : p === "goose" ? 20 : p === "boar" ? 30 : 0), 0);
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
    expect(log.logVersion).toBe(1);
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
      expect(log.init.door[side]).toBe(snap.perks.includes("car-door"));
      const mine = log.init.actors.filter((x) => x.id.startsWith(side));
      expect(mine.find((x) => x.id === `${side}0`)).toEqual({ id: `${side}0`, kind: "scrapper", maxHp: maxHpOf(snap) });
      const companions = mine.filter((x) => x.kind !== "scrapper");
      expect(companions.map((x) => x.kind).sort()).toEqual(snap.perks.filter((p) => isCompanionId(p)).sort());
      for (const c of companions) {
        if (c.kind === "scrapper") continue;
        expect(c.maxHp).toBe(Math.floor((COMPANION_HP[c.kind] * (100 + 4 * (snap.level - 1))) / 100));
      }
    }
    expect(name === "bout-gate" || name === "bout-all-steps").toBe(true);
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
    expect(after("body-slam").map((s) => s.t)).toEqual(["move", "disarm", "doorOff"]);
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
      expect(has((s) => s.t === "doorOff" && s.cause === cause), cause).toBe(true);
    }
    expect(has((s) => s.t === "disarm" && s.resisted === true)).toBe(true);
    expect(has((s) => s.t === "move" && s.move === "snatch" && s.taken === undefined)).toBe(true);
    expect(has((s) => s.t === "ko" && s.actor === "a1")).toBe(true);
    expect(boutAllSteps.init.actors.length).toBe(6);
    const procs = steps.flatMap((s) => ("procs" in s && s.procs !== undefined ? s.procs.map((p) => p.skill) : []));
    expect([...new Set(procs)].sort()).toEqual(["anticipation", "car-door", "firm-grip", "payback", "stubborn"]);
    // An intercept is never followed by an attack in the same turn.
    const ic = steps.findIndex((s) => s.t === "intercept");
    expect(steps.filter((s) => s.turn === steps[ic]!.turn).map((s) => s.t)).toEqual(["intercept", "disarm"]);
    // The skipped snared turn leaves a hole in the turn numbers.
    expect(steps.some((s) => s.turn === 17)).toBe(false);
  });

  it("ends with the right hands, doors, bags and six items on the floor", () => {
    const end = stateAt(boutAllSteps, steps.length);
    expect(end.actors.a0).toMatchObject({ hp: 75, status: "up", held: "hand-axe", door: false, snared: false });
    expect(end.actors.a1).toMatchObject({ hp: 0, status: "ko" });
    expect(end.actors.a2).toMatchObject({ hp: 36, status: "fled" });
    expect(end.actors.b0).toMatchObject({ hp: 0, status: "ko", held: "fists", door: false });
    expect(end.actors.b1).toMatchObject({ hp: 96, status: "up" });
    expect(end.actors.b2).toMatchObject({ hp: 3, status: "up" });
    expect(end.bag.a).toEqual([{ k: "move", id: "whistle", uses: 1 }, { k: "weapon", id: "broom" }]);
    expect(end.bag.b).toEqual([{ k: "move", id: "firecrackers", uses: 1 }]);
    expect(end.floor.map((f) => `${f.item}<${f.from}`)).toEqual(
      ["car-door<a0", "bat<a0", "monkey-wrench<b0", "car-door<b0", "pocket-knife<b0", "darts<a0"]);
    for (const f of end.floor) expect(["swap", "disarm", "doorOff", "throw"]).toContain(steps[f.i]!.t);
    expect(killStep(boutAllSteps)).toBe(steps.length - 3);
  });

  it("tracks a held weapon through draw, snatch, throw, disarm and swap", () => {
    const heldAfterTurn = (turn: number, id: "a0" | "b0"): string => {
      const n = steps.findIndex((s) => s.turn > turn);
      return stateAt(boutAllSteps, n < 0 ? steps.length : n).actors[id]!.held;
    };
    expect([2, 8, 10, 13, 20, 52].map((t) => heldAfterTurn(t, "a0"))).toEqual(["bat", "fists", "broom", "fists", "darts", "hand-axe"]);
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
    expect(s.actors.a0!.door).toBe(true);
    expect(s.actors.a1!.door).toBe(false);
    expect(s.bag).toEqual(boutAllSteps.init.bag);
    expect(s.bag.a).not.toBe(boutAllSteps.init.bag.a);
    expect(resultOf(s)).toBeNull();
  });

  it("reports -1 as the kill step of a cap ending, and keeps the loser standing", () => {
    const cap: BoutLog = {
      logVersion: 1, rulesVersion: 1, seed: 7,
      init: { actors: [{ id: "a0", kind: "scrapper", maxHp: 50 }, { id: "b0", kind: "scrapper", maxHp: 60 }],
        bag: { a: [], b: [] }, door: { a: false, b: false } },
      steps: [
        { t: "enter", turn: 0, actor: "a0" }, { t: "enter", turn: 0, actor: "b0" },
        { t: "attack", turn: 149, actor: "a0", target: "b0", weapon: "fists", outcome: "hit", damage: 6, crit: false, hpAfter: 54, n: 0 },
        { t: "overtime", turn: 149, actor: "a0", damage: 4, hpAfter: 46 },
        { t: "attack", turn: 150, actor: "b0", target: "a0", weapon: "fists", outcome: "block", damage: 0, crit: false, hpAfter: 46, n: 0 },
        { t: "overtime", turn: 150, actor: "b0", damage: 4, hpAfter: 50 },
        { t: "end", turn: 150, winner: "a", reason: "cap" },
      ],
      result: { winner: "a", reason: "cap", turns: 150, hpPct: { a: 92, b: 84 } },
    };
    expect(checkLog(cap)).toEqual([]);
    expect(killStep(cap)).toBe(-1);
    const end = stateAt(cap, cap.steps.length);
    expect(resultOf(end)).toEqual(cap.result);
    expect(end.actors.b0!.status).toBe("up");
  });

  it("finds a kill step made by overtime or by a Move", () => {
    const base = clone(boutGate);
    const overtime: Step = { t: "overtime", turn: 14, actor: "b0", damage: 9, hpAfter: 0 };
    base.steps[18] = overtime;
    expect(killStep(base)).toBe(18);
    const move: Step = { t: "move", turn: 14, actor: "a0", move: "firecrackers", bagAfter: [], hits: [{ target: "b0", damage: 15, hpAfter: 0 }] };
    base.steps[18] = move;
    expect(killStep(base)).toBe(18);
    // A companion at 0 HP is not a kill step.
    expect(boutAllSteps.steps[killStep(boutAllSteps)]).toMatchObject({ target: "b0" });
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
});
