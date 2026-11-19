/**
 * The talent tree (content v3, batch 3, plan 13.11). One test per node, named by its id: with the
 * node ranked and without it, the rule its card names changes by exactly rank x its table number,
 * and nothing else of the fight values changes. Plus the tree's own rules (points by level, tiers,
 * ranks, the free respec once a day, cleaning a stored tree), the snapshot carrying the ranks, the
 * rivals' rule, and real bouts in which every capstone fires and every log passes checkLog.
 */
import { describe, expect, it } from "vitest";
import type { DerivedValues, FighterSnapshot, ScrapperRecord, TalentRanks } from "../src/contracts/fighter";
import type { TalentId } from "../src/contracts/ids";
import { CAPSTONE_IDS, REALM_SALT, TALENT_BRANCHES, TALENT_IDS } from "../src/contracts/ids";
import { TALENT_META, TALENT_TIER_NEED } from "../src/contracts/content";
import type { Step } from "../src/contracts/log";
import { checkLog } from "../src/contracts/check";
import { TALENTS, branchNodes, tn } from "../src/content/talents";
import { api, createRecord, sheetOf, snapshotOf } from "../src/index";
import { buildSide, combatValues, valuesOf } from "../src/sim/combatant";
import type { Actor } from "../src/sim/combatant";
import { consequences, critPctOf, damageMult, damageSkill, evadeChance, meleeAttack } from "../src/sim/melee";
import { afterThrow, throwAttack, throwChance } from "../src/sim/thrown";
import { drawSlack, quickTurn, swapChance } from "../src/sim/turn";
import { knockChance, land, pickEnemy } from "../src/sim/bout";
import { companionCostPct } from "../src/progress/stats";
import { COMPANIONS, COMPANION_HP_GROWTH, companionScale } from "../src/content/companions";
import { rivalSeed, rivalSnapshot } from "../src/progress/rivals";
import { simulateFight } from "../src/sim/simulate";
import { branchBuild, branchFit, branchOrder, cleanRanks, rivalBranch, rivalTalents, statsWithTalents, talentPointsAt,
  talentsOf } from "../src/progress/talents";
import { fn, queue, scripted, setup, snap } from "./helpers";

const DERIVED = ["evade", "block", "aim", "pierce", "intercept", "riposte", "combo", "disarm", "crit", "armor", "grip", "soak"] as const;
const STATS = ["health", "strength", "agility", "speed", "toughness", "precision"] as const;
const one = (id: TalentId, r: number): TalentRanks => ({ [id]: r });
const withT = (s: FighterSnapshot, t: TalentRanks): FighterSnapshot => ({ ...s, talents: t });
const ranksOf = (id: TalentId): number[] => Array.from({ length: TALENT_META[id].max }, (_, i) => i + 1);

/** A derived-value node: with rank r its keys move by r x the table number, the rest stay. */
function derivedRule(id: TalentId, key: keyof DerivedValues, num: string, held: "fists" | "pipe" = "pipe"): void {
  const a = buildSide("a", snap(["pipe"])).actors[0]!;
  const x = combatValues(a.skills, held, a.shield, a.tou, a.pre, [], {});
  for (const r of ranksOf(id)) {
    const y = combatValues(a.skills, held, a.shield, a.tou, a.pre, [], one(id, r));
    expect(y[key] - x[key], `${id} rank ${r}`).toBe(r * tn(id, num));
    for (const k of DERIVED) if (k !== key) expect(y[k], `${id} ${k}`).toBe(x[k]);
  }
  expect(tn(id, num)).toBeGreaterThan(0);
}
/** A stat node: with rank r the snapshot's stat moves by r x the table number, the rest stay. */
function statRule(id: TalentId, key: (typeof STATS)[number]): void {
  const s = snap(["pipe"]).stats;
  for (const r of ranksOf(id)) {
    const t = statsWithTalents(s, one(id, r));
    for (const k of STATS) expect(t.points[k] - s.points[k], `${id} ${k}`).toBe(k === key ? r * tn(id, key) : 0);
    expect(t.mult).toEqual(s.mult);
  }
  // and the record's snapshot carries it
  const rec = recAt(10, { [id]: 1 });
  const bare = snapshotOf({ ...rec, talents: { ranks: {} } });
  expect(snapshotOf(rec).stats.points[key] - bare.stats.points[key]).toBe(tn(id, key));
}
/** A record at `level` (picks all "L") with these ranks stored. */
function recAt(level: number, ranks: TalentRanks): ScrapperRecord {
  const r = createRecord({ id: "T1", name: "Talent Test", realmSalt: REALM_SALT, lookSalt: 0, colourSalt: 0, today: "2026-11-18", nowMs: 0 });
  return { ...r, picks: Array.from({ length: level - 1 }, () => "L" as const), talents: { ranks } };
}
/** Side b's first companion for a side whose owner has these talents. */
function petOf(t: TalentRanks): Actor {
  return buildSide("b", withT(snap(["pipe", "raccoon"]), t)).actors[1]!;
}

describe("the tree: five branches of six nodes", () => {
  it("has two nodes of tier 0, two of tier 1, one of tier 2 and a one-rank capstone in each branch", () => {
    expect(TALENT_IDS.length).toBe(30);
    for (const branch of TALENT_BRANCHES) {
      const nodes = branchNodes(branch);
      expect(nodes.map((id) => TALENT_META[id].tier), branch).toEqual([0, 0, 1, 1, 2, 3]);
      expect(TALENT_META[nodes[5]!].max).toBe(1);
      expect(CAPSTONE_IDS).toContain(nodes[5]);
      for (const id of nodes.slice(0, 5)) expect(TALENT_META[id].max, id).toBeGreaterThanOrEqual(2);
    }
    for (const id of TALENT_IDS) {
      expect(TALENTS[id].branch).toBe(TALENT_META[id].branch);
      expect(Object.values(TALENTS[id].per).some((v) => v !== 0), id).toBe(true);
    }
    expect(TALENT_TIER_NEED).toEqual([0, 2, 4, 5]);
  });

  it("gives 1 point at level 3 and 1 every 3 levels after: 10 by level 30", () => {
    expect([1, 2, 3, 4, 5, 6, 8, 9, 12, 18, 29, 30, 33].map(talentPointsAt)).toEqual([0, 0, 1, 1, 1, 2, 2, 3, 4, 6, 9, 10, 11]);
    expect(api.talentPointsAt(30)).toBe(10);
  });

  it("opens a tier only after enough points in the lower tiers of its branch, ranks to the max, and spends only earned points", () => {
    let rec = recAt(18, {});                                        // 6 points
    expect(talentsOf(rec)).toMatchObject({ earned: 6, spent: 0, unspent: 6 });
    expect(api.talentBlock(rec, "follow-through")).toBe("locked");
    expect(api.talentBlock(rec, "knockdown")).toBe("locked");
    rec = api.spendTalent(rec, "iron-knuckles");
    expect(api.talentBlock(rec, "follow-through")).toBe("locked");
    rec = api.spendTalent(rec, "gym-rat");
    expect(api.talentBlock(rec, "follow-through")).toBeNull();       // 2 points in tier 0 open tier 1
    expect(api.spendTalent(rec, "bruiser")).toBe(rec);              // tier 2 needs 4
    rec = api.spendTalent(api.spendTalent(rec, "follow-through"), "stagger");
    rec = api.spendTalent(rec, "bruiser");
    expect(api.talentBlock(rec, "knockdown")).toBeNull();           // 5 points below the capstone
    rec = api.spendTalent(rec, "knockdown");
    expect(talentsOf(rec)).toMatchObject({ spent: 6, unspent: 0 });
    expect(api.talentBlock(rec, "iron-knuckles")).toBe("no-points");
    expect(api.talentBlock(rec, "knockdown")).toBe("maxed");
    expect(api.spendTalent(rec, "iron-knuckles")).toBe(rec);
    // a level-2 scrapper has nothing to spend
    expect(api.talentBlock(recAt(2, {}), "brace")).toBe("no-points");
    // ranks stop at the node's max
    let r3 = recAt(30, {});
    for (let i = 0; i < 5; i++) r3 = api.spendTalent(r3, "brace");
    expect(talentsOf(r3).ranks.brace).toBe(3);
  });

  it("gives one free respec a day: every point back, the day kept, a second one refused until tomorrow", () => {
    const rec = api.spendTalent(api.spendTalent(recAt(9, {}), "thick-skin"), "brace");
    expect(api.canRespec(recAt(9, {}), "2026-11-18")).toBe(false);  // nothing spent
    expect(api.canRespec(rec, "2026-11-18")).toBe(true);
    const back = api.respecTalents(rec, "2026-11-18");
    expect(talentsOf(back)).toMatchObject({ spent: 0, unspent: 3 });
    expect(back.talents?.respecDay).toBe("2026-11-18");
    const again = api.spendTalent(back, "brace");
    expect(again.talents?.respecDay).toBe("2026-11-18");            // spending keeps the day
    expect(api.canRespec(again, "2026-11-18")).toBe(false);
    expect(api.respecTalents(again, "2026-11-18")).toBe(again);
    expect(api.canRespec(again, "2026-11-19")).toBe(true);
  });

  it("reads a stored tree against the rules: unknown ids, bad ranks, closed tiers and unearned points are dropped", () => {
    expect(cleanRanks({ "brace": 9, "nope": 1, "thick-skin": 1.5, "turtle": 1 }, 10)).toEqual({ brace: 3 });
    // tier 2 with only 3 points below it is closed
    expect(cleanRanks({ brace: 2, "thick-skin": 1, turtle: 1 }, 10)).toEqual({ brace: 2, "thick-skin": 1 });
    // more ranks than earned: the highest tier comes off first, never closing a node
    expect(cleanRanks({ brace: 3, "thick-skin": 2, turtle: 1, unbreakable: 1 }, 5)).toEqual({ brace: 3, "thick-skin": 2 });
    expect(cleanRanks(null, 5)).toEqual({});
    expect(talentsOf({ ...recAt(5, {}), talents: { ranks: { brace: 3 } } })).toMatchObject({ earned: 1, spent: 1, ranks: { brace: 1 } });
  });

  it("puts the ranks in the bout's snapshot and on the sheet; a record with no tree has none", () => {
    const rec = api.spendTalent(recAt(6, {}), "brace");
    expect(snapshotOf(rec).talents).toEqual({ brace: 1 });
    expect(sheetOf(rec).talents).toEqual({ earned: 2, spent: 1, unspent: 1, ranks: { brace: 1 } });
    const plain = { ...rec };
    delete plain.talents;
    expect(snapshotOf(plain).talents).toEqual({});
    expect(sheetOf(plain).talents.unspent).toBe(2);
    // the sheet's derived values hold the talent (Brace: Block)
    expect(sheetOf(rec).derived.block - sheetOf(plain).derived.block).toBe(tn("brace", "block"));
  });
});

describe("rivals spend their points by a fixed rule", () => {
  it("every point down one branch that fits what the rival takes into the bout, in the branch's order", () => {
    expect(branchOrder("brawler")).toEqual(["gym-rat", "iron-knuckles", "follow-through", "stagger", "bruiser", "knockdown",
      "gym-rat", "iron-knuckles", "follow-through", "stagger", "bruiser", "gym-rat", "iron-knuckles", "follow-through"]);
    expect(branchBuild("pack", 6)).toEqual({ "good-boy": 1, "sharp-teeth": 1, "quick-paws": 1, "second-bowl": 1, "guard-dog": 1, "loyal-pack": 1 });
    expect(branchFit("pack", ["pipe"])).toBe(0);
    expect(branchFit("pack", ["pipe", "raccoon"])).toBe(3);
    expect(branchFit("thrower", ["pipe"])).toBe(0);
    expect(branchFit("thrower", ["darts"])).toBe(3);
    expect(branchFit("arsenal", ["darts"])).toBe(0);
    let packs = 0;
    for (let i = 0; i < 200; i++) {
      const s = rivalSnapshot(REALM_SALT, 30, i);
      expect(s.talents, s.id).toEqual(rivalTalents(rivalSeedOf(i), s.perks, 30));
      const branch = rivalBranch(rivalSeedOf(i), s.perks);
      expect(branchFit(branch, s.perks), s.id).toBeGreaterThan(0);
      if (branch === "pack") packs += 1;
      expect(Object.values(s.talents ?? {}).reduce((x, y) => x + y, 0)).toBe(10);
    }
    expect(packs).toBeGreaterThan(0);
    expect(rivalSnapshot(REALM_SALT, 2, 0).talents).toEqual({});
  });
});
const rivalSeedOf = (i: number): number => rivalSeed(REALM_SALT, 30, i);

/** The rule each node's test checks. */
const RULE: Record<TalentId, () => void> = {
  // ---------------------------------------------------------------- Brawler
  "iron-knuckles": () => {
    for (const r of ranksOf("iron-knuckles")) {
      const t = setup(withT(snap([]), one("iron-knuckles", r)), snap([]));
      const p = setup(snap([]), snap([]));
      expect(damageMult(t.A, false, false) - damageMult(p.A, false, false)).toBe(r * tn("iron-knuckles", "fistDmg"));
      t.A.held = "pipe"; p.A.held = "pipe";
      expect(damageMult(t.A, false, false)).toBe(damageMult(p.A, false, false));
      expect(damageMult(t.A, true, false)).toBe(damageMult(p.A, true, false));
    }
  },
  "gym-rat": () => statRule("gym-rat", "strength"),
  "follow-through": () => derivedRule("follow-through", "combo", "combo"),
  "stagger": () => {
    for (const r of ranksOf("stagger")) {
      const t = setup(withT(snap(["pipe"]), one("stagger", r)), snap(["pipe"]));
      const c0 = t.B.clock;
      consequences(t.bout, t.A, t.B, { outcome: "hit", damage: 1, crit: true, hpAfter: t.B.hp, procs: [], blocked: false });
      expect(t.B.clock - c0).toBe(r * tn("stagger", "stagger"));
      const c1 = t.B.clock;
      consequences(t.bout, t.A, t.B, { outcome: "hit", damage: 1, crit: false, hpAfter: t.B.hp, procs: [], blocked: false });
      expect(t.B.clock).toBe(c1);
    }
    const p = setup(snap(["pipe"]), snap(["pipe"]));
    consequences(p.bout, p.A, p.B, { outcome: "hit", damage: 1, crit: true, hpAfter: p.B.hp, procs: [], blocked: false });
    expect(p.B.clock).toBe(0);
  },
  "bruiser": () => derivedRule("bruiser", "crit", "crit"),
  "knockdown": () => {
    // swing 0 lands, two combos land; no crit roll passes (99)
    const hit = (): ReturnType<typeof queue> => queue([99, 99, 99, 99, 0, 99, 99, 99, 0, 99, 99, 99, 99, 99]);
    const run = (t: TalentRanks): { steps: Step[]; clock: number } => {
      const s = setup(withT(snap(["pipe"]), t), snap(["pipe"], { points: { health: 60 } }), scripted({ hit: hit(), disarm: fn((n) => n - 1) }));
      s.A.held = "pipe"; s.A.heldAttacked = true;
      meleeAttack(s.bout, s.A, s.B);
      return { steps: s.bout.steps, clock: s.B.clock };
    };
    const w = run(one("knockdown", 1));
    const wo = run({});
    const swings = (st: Step[]) => st.filter((x): x is Extract<Step, { t: "attack" }> => x.t === "attack");
    expect(swings(w.steps).map((x) => [x.n, x.outcome, x.crit])).toEqual([[0, "hit", false], [1, "hit", true], [2, "hit", false]]);
    expect(swings(w.steps)[1]!.procs).toEqual([{ by: "a0", skill: "knockdown" }]);
    expect(swings(wo.steps).map((x) => x.crit)).toEqual([false, false, false]);
    expect(w.clock - wo.clock).toBe(tn("knockdown", "knockClock"));
  },
  // ---------------------------------------------------------------- Arsenal
  "weapon-care": () => {
    for (const r of ranksOf("weapon-care")) {
      const t = setup(withT(snap(["pipe"]), one("weapon-care", r)), snap([]));
      const p = setup(snap(["pipe"]), snap([]));
      t.A.held = "pipe"; p.A.held = "pipe";
      expect(damageMult(t.A, false, false) - damageMult(p.A, false, false)).toBe(r * tn("weapon-care", "weaponDmg"));
      expect(damageMult(t.A, true, false)).toBe(damageMult(p.A, true, false));
      t.A.held = "fists"; p.A.held = "fists";
      expect(damageMult(t.A, false, false)).toBe(damageMult(p.A, false, false));
    }
  },
  "quick-hands": () => {
    const p = setup(snap(["pipe", "bat"]), snap([]));
    for (const r of ranksOf("quick-hands")) {
      const t = setup(withT(snap(["pipe", "bat"]), one("quick-hands", r)), snap([]));
      expect(drawSlack(p.A) - drawSlack(t.A)).toBe(r * tn("quick-hands", "drawEase"));
      expect(swapChance(t.A) - swapChance(p.A)).toBe(r * tn("quick-hands", "swap"));
    }
  },
  "hook": () => derivedRule("hook", "disarm", "disarm"),
  "fast-swap": () => {
    for (const r of ranksOf("fast-swap")) {
      const t = setup(withT(snap(["pipe"]), one("fast-swap", r)), snap([]));
      t.A.drew = true;
      expect(quickTurn(t.A, 200)).toBe(Math.floor((200 * (100 + r * tn("fast-swap", "swapTime"))) / 100));
      t.A.drew = false;
      expect(quickTurn(t.A, 200)).toBe(200);
    }
    const p = setup(snap(["pipe"]), snap([]));
    p.A.drew = true;
    expect(quickTurn(p.A, 200)).toBe(200);
  },
  "steel-guard": () => {
    derivedRule("steel-guard", "block", "block", "pipe");
    const a = buildSide("a", snap([])).actors[0]!;
    expect(combatValues(a.skills, "fists", null, 0, 3, [], one("steel-guard", 2))).toEqual(combatValues(a.skills, "fists", null, 0, 3, [], {}));
  },
  "fresh-steel": () => {
    // the defender's block roll passes (0)
    const run = (t: TalentRanks, attacked: boolean): Extract<Step, { t: "attack" }> => {
      const s = setup(withT(snap(["pipe"]), t), snap(["pipe"], { points: { health: 60 } }), scripted({ hit: queue([99, 99, 0, 99, 99, 99]), disarm: fn((n) => n - 1) }));
      s.A.held = "pipe"; s.A.heldAttacked = attacked;
      meleeAttack(s.bout, s.A, s.B);
      return s.bout.steps.find((x): x is Extract<Step, { t: "attack" }> => x.t === "attack")!;
    };
    expect(run({}, false).outcome).toBe("block");
    const fresh = run(one("fresh-steel", 1), false);
    expect(fresh.outcome).toBe("hit");
    expect(fresh.procs).toEqual([{ by: "a0", skill: "fresh-steel" }]);
    expect(run(one("fresh-steel", 1), true).outcome).toBe("block");      // only the first swing of a fresh weapon
    const t = setup(withT(snap(["pipe"]), one("fresh-steel", 1)), snap([]));
    t.A.held = "pipe";
    expect(damageMult(t.A, false, false, false, tn("fresh-steel", "freshDmg")) - damageMult(t.A, false, false)).toBe(tn("fresh-steel", "freshDmg"));
  },
  // ---------------------------------------------------------------- Thrower
  "strong-arm": () => {
    for (const r of ranksOf("strong-arm")) {
      const t = setup(withT(snap(["darts"]), one("strong-arm", r)), snap([]));
      const p = setup(snap(["darts"]), snap([]));
      t.A.held = "darts"; p.A.held = "darts";
      expect(damageMult(t.A, true, false) - damageMult(p.A, true, false)).toBe(r * tn("strong-arm", "thrownDmg"));
      t.A.held = "pipe"; p.A.held = "pipe";
      expect(damageMult(t.A, false, false)).toBe(damageMult(p.A, false, false));
    }
  },
  "sidearm": () => {
    const p = setup(snap(["pipe"]), snap([]));
    for (const r of ranksOf("sidearm")) {
      const t = setup(withT(snap(["pipe"]), one("sidearm", r)), snap([]));
      for (const bag of [true, false]) expect(throwChance(t.A, bag) - throwChance(p.A, bag)).toBe(r * tn("sidearm", "throwChance"));
    }
  },
  "dead-eye": () => {
    for (const r of ranksOf("dead-eye")) {
      const t = setup(withT(snap(["darts"]), one("dead-eye", r)), snap([], { points: { agility: 12 } }));
      t.A.held = "darts";
      const aim = r * tn("dead-eye", "thrownAim");
      // a throw: as if the thrower had that much more Aim, then halved; a swing: unchanged
      expect(evadeChance(t.A, t.B, 0, 0, true)).toBe(Math.floor(evadeChance(t.A, t.B, -aim, 0, false) / 2));
      expect(evadeChance(t.A, t.B, 0, 0, true)).toBeLessThan(Math.floor(evadeChance(t.A, t.B, 0, 0, false) / 2) + 1);
      const p = setup(snap(["darts"]), snap([], { points: { agility: 12 } }));
      p.A.held = "darts";
      expect(evadeChance(t.A, t.B, 0, 0, false)).toBe(evadeChance(p.A, p.B, 0, 0, false));
    }
  },
  "bank-shot": () => {
    // a dart lands (rolls 99), the bounce roll on the throw stream is 0, the target pick goes to the pet
    const run = (t: TalentRanks): Step[] => {
      const s = setup(withT(snap(["darts"]), t), snap(["pipe", "raccoon"], { points: { health: 60 } }),
        scripted({ hit: fn((n) => n - 1), throw: queue([0]), target: queue([2]), disarm: fn((n) => n - 1) }));
      s.A.held = "darts";
      throwAttack(s.bout, s.A, s.B);
      return s.bout.steps.filter((x) => x.t === "throw");
    };
    for (const r of ranksOf("bank-shot")) {
      const w = run(one("bank-shot", r));
      expect(w.map((x) => (x as { target: string }).target)).toEqual(["b0", "b1"]);
      expect((w[1] as { procs?: unknown }).procs).toBeUndefined();
    }
    expect(run({}).length).toBe(1);
    // the share is its rank x the table number: a roll at the share fails
    const s = setup(withT(snap(["darts"]), one("bank-shot", 1)), snap(["pipe", "raccoon"], { points: { health: 60 } }),
      scripted({ hit: fn((n) => n - 1), throw: queue([tn("bank-shot", "ricochet")]), target: queue([2]), disarm: fn((n) => n - 1) }));
    s.A.held = "darts";
    throwAttack(s.bout, s.A, s.B);
    expect(s.bout.steps.filter((x) => x.t === "throw").length).toBe(1);
  },
  "quick-catch": () => {
    for (const r of ranksOf("quick-catch")) {
      const share = r * tn("quick-catch", "catch");
      for (const [roll, want] of [[share - 1, "bag"], [share, "gone"]] as const) {
        const t = setup(withT(snap(["pipe"]), one("quick-catch", r)), snap([]), scripted({ throw: queue([roll]) }));
        expect(afterThrow(t.bout, t.A, "pipe", [])).toBe(want);
      }
    }
    const p = setup(snap(["pipe"]), snap([]), scripted({ throw: queue([0]) }));
    expect(afterThrow(p.bout, p.A, "pipe", [])).toBe("gone");
    const t = setup(withT(snap(["darts"]), one("quick-catch", 2)), snap([]));
    expect(afterThrow(t.bout, t.A, "darts", [])).toBe("held");
  },
  "bullseye": () => {
    const t = setup(withT(snap(["darts"]), one("bullseye", 1)), snap([]));
    const p = setup(snap(["darts"]), snap([]));
    t.A.held = "darts"; p.A.held = "darts";
    expect(critPctOf(t.B, t.A, true)).toBe(tn("bullseye", "critTo"));
    expect(critPctOf(t.B, t.A, false)).toBe(150);
    expect(critPctOf(p.B, p.A, true)).toBe(150);
    // a crit roll between the plain Crit and Crit + 20 crits only with it, and names it
    const base = valuesOf(t.A).crit;
    const roll = base + 5;
    const go = (s: typeof t): Extract<Step, { t: "throw" }> => {
      s.bout.r = scripted({ hit: queue([99, 99, roll, 99]), throw: fn((n) => n - 1), disarm: fn((n) => n - 1) });
      throwAttack(s.bout, s.A, s.B);
      return s.bout.steps.find((x): x is Extract<Step, { t: "throw" }> => x.t === "throw")!;
    };
    const w = go(t);
    expect([w.outcome, w.crit]).toEqual(["hit", true]);
    expect(w.procs).toEqual([{ by: "a0", skill: "bullseye" }]);
    expect(go(p).crit).toBe(false);
  },
  // ---------------------------------------------------------------- Pack
  "good-boy": () => {
    const hp = companionScale(COMPANIONS.raccoon.hp, 10, COMPANION_HP_GROWTH);
    for (const r of ranksOf("good-boy")) expect(petOf(one("good-boy", r)).maxHp).toBe(Math.floor((hp * (100 + r * tn("good-boy", "petHp"))) / 100));
    expect(petOf({}).maxHp).toBe(hp);
  },
  "sharp-teeth": () => {
    for (const r of ranksOf("sharp-teeth")) {
      const pet = petOf(one("sharp-teeth", r));
      expect(damageMult(pet, false, false) - damageMult(petOf({}), false, false)).toBe(r * tn("sharp-teeth", "petDmg"));
      expect(damageSkill(pet, false)).toBeNull();                       // no Pet Lover tag from a talent
    }
  },
  "quick-paws": () => {
    for (const r of ranksOf("quick-paws")) {
      const x = valuesOf(petOf({}));
      const y = valuesOf(petOf(one("quick-paws", r)));
      expect(y.evade - x.evade).toBe(r * tn("quick-paws", "petEvade"));
      for (const k of DERIVED) if (k !== "evade") expect(y[k]).toBe(x[k]);
    }
  },
  "second-bowl": () => {
    const perks = ["raccoon", "goose"] as const;
    const goose = COMPANIONS.goose.hpCostPct;
    const raccoon = COMPANIONS.raccoon.hpCostPct;
    expect(companionCostPct([...perks])).toBe(goose + raccoon);
    for (const r of ranksOf("second-bowl")) {
      const cut = Math.min(100, r * tn("second-bowl", "petCost"));
      const less = (c: number): number => Math.floor((c * (100 - cut)) / 100);
      expect(companionCostPct([...perks], one("second-bowl", r))).toBe(less(goose) + less(raccoon));
      expect(companionCostPct(["goose"], one("second-bowl", r))).toBe(less(goose));
    }
  },
  "guard-dog": () => {
    // side b: its scrapper (with Guard Dog) and a raccoon; the first pick lands on the scrapper
    for (const r of ranksOf("guard-dog")) {
      const share = r * tn("guard-dog", "guard");
      for (const [roll, want] of [[share - 1, "b1"], [share, "b0"]] as const) {
        const t = setup(snap(["pipe"]), withT(snap(["pipe", "raccoon"]), one("guard-dog", r)), scripted({ target: queue([0, roll, 0]) }));
        expect(pickEnemy(t.bout, t.A)!.id).toBe(want);
      }
    }
    const p = setup(snap(["pipe"]), snap(["pipe", "raccoon"]), scripted({ target: queue([0, 0, 0]) }));
    expect(pickEnemy(p.bout, p.A)!.id).toBe("b0");
  },
  "loyal-pack": () => {
    const t = setup(snap(["pipe"]), withT(snap(["pipe", "raccoon"]), one("loyal-pack", 1)));
    const procs: { by: string; skill: string }[] = [];
    expect(land(t.B, t.B.hp + 50, procs as never, t.bout)).toBe(1);
    expect(procs).toEqual([{ by: "b0", skill: "loyal-pack" }]);
    expect(land(t.B, 5, [], t.bout)).toBe(0);                          // once a bout
    // no companion standing: no save
    const n = setup(snap(["pipe"]), withT(snap(["pipe", "raccoon"]), one("loyal-pack", 1)));
    n.bout.actors.find((x) => x.id === "b1")!.status = "ko";
    expect(land(n.B, n.B.hp + 50, [], n.bout)).toBe(0);
    // without it: no save; with Last Stand too, Last Stand saves first and Loyal Pack after
    const p = setup(snap(["pipe"]), snap(["pipe", "raccoon"]));
    expect(land(p.B, p.B.hp + 50, [], p.bout)).toBe(0);
    const both = setup(snap(["pipe"]), withT(snap(["pipe", "raccoon", "last-stand"]), one("loyal-pack", 1)));
    const pr: { skill: string }[] = [];
    land(both.B, 999, pr as never, both.bout);
    land(both.B, 999, pr as never, both.bout);
    expect(pr.map((x) => x.skill)).toEqual(["last-stand", "loyal-pack"]);
    expect(land(both.B, 999, [], both.bout)).toBe(0);
  },
  // ---------------------------------------------------------------- Iron Wall
  "thick-skin": () => statRule("thick-skin", "toughness"),
  "brace": () => derivedRule("brace", "block", "block", "fists"),
  "shield-strap": () => {
    for (const r of ranksOf("shield-strap")) {
      const t = setup(snap(["monkey-wrench"]), withT(snap(["car-door"]), one("shield-strap", r)));
      const p = setup(snap(["monkey-wrench"]), snap(["car-door"]));
      t.A.held = "monkey-wrench"; p.A.held = "monkey-wrench";
      const plain = knockChance(p.A, "car-door", p.B);
      expect(knockChance(t.A, "car-door", t.B)).toBe(Math.max(0, plain - r * tn("shield-strap", "knockCut")));
      expect(plain).toBeGreaterThan(0);
    }
  },
  "counter": () => {
    for (const r of ranksOf("counter")) {
      const t0 = setup(snap(["pipe"]), withT(snap(["pipe"]), one("counter", r)));
      const base = Math.min(valuesOf(t0.B).riposte, 80);
      const roll = base + r * tn("counter", "blockRiposte") - 1;
      const run = (t: TalentRanks): boolean => {
        // swing 0 is blocked (0), no combo (99), then the riposte roll
        const s = setup(snap(["pipe"]), withT(snap(["pipe"]), t), scripted({ hit: queue([99, 99, 0, 99, roll, 99, 99, 99]), disarm: fn((n) => n - 1) }));
        s.A.held = "pipe"; s.A.heldAttacked = true;
        meleeAttack(s.bout, s.A, s.B);
        return s.bout.steps.some((x) => x.t === "riposte");
      };
      expect(run(one("counter", r)), `rank ${r}`).toBe(true);
      expect(run({}), `rank ${r}`).toBe(false);
    }
  },
  "turtle": () => derivedRule("turtle", "armor", "armor"),
  "unbreakable": () => {
    // swing 0 blocked, no combo, riposte roll 99 (fails without it), the riposte would be evaded (0)
    const run = (t: TalentRanks): Step | undefined => {
      const s = setup(snap(["pipe"]), withT(snap(["pipe"]), t), scripted({ hit: queue([99, 99, 0, 99, 99, 0, 0, 99]), disarm: fn((n) => n - 1) }));
      s.A.held = "pipe"; s.A.heldAttacked = true;
      meleeAttack(s.bout, s.A, s.B);
      return s.bout.steps.find((x) => x.t === "riposte");
    };
    const w = run(one("unbreakable", 1)) as Extract<Step, { t: "riposte" }>;
    expect(w).toBeDefined();
    expect(w.outcome).toBe("hit");
    expect(w.procs).toEqual([{ by: "b0", skill: "unbreakable" }]);
    expect(run({})).toBeUndefined();
  },
};

describe("one rule per talent node", () => {
  it.each([...TALENT_IDS])("%s", (id) => {
    RULE[id]();
  });
});

describe("real bouts with talents", () => {
  it("every capstone fires in level-30 pool bouts, and every log passes checkLog", async () => {
    const seen = new Set<string>();
    let bad = 0;
    for (const branch of TALENT_BRANCHES) {
      let n = 0;
      for (let i = 0; n < 60 && i < 4000; i++) {
        const a = rivalSnapshot(REALM_SALT, 30, i);
        if (branchFit(branch, a.perks) === 0) continue;
        const me: FighterSnapshot = { ...a, talents: branchBuild(branch, 10) };
        const b = rivalSnapshot(REALM_SALT, 30, 5000 + i);
        const log = simulateFight(1000 + i, me, b, 1);
        if (checkLog(log).length > 0) bad += 1;
        for (const s of log.steps) for (const p of ("procs" in s && s.procs) ? s.procs : []) seen.add(p.skill);
        n += 1;
        if (n % 20 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
    expect(bad).toBe(0);
    for (const c of CAPSTONE_IDS) expect(seen.has(c), c).toBe(true);
  });
});
