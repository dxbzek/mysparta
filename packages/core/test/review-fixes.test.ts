/**
 * The sim findings of the 15 November 2026 review (pet pass): pet growth, the starting perk, the
 * perk reroll, what a perk needs before it is offered, Air Horn's fallback, Haymaker with a Thrown
 * weapon, the sure redraw after a throw, the Draw weights of rare weapons, the level-1 start
 * spread, and the easy cards of levels 1 to 3.
 */
import { describe, expect, it } from "vitest";
import type { PerkId } from "../src/contracts/ids";
import { REALM_SALT, WEAPON_IDS, isCompanionId, perkKind } from "../src/contracts/ids";
import { RARITY_OF } from "../src/contracts/content";
import { COMPANIONS, COMPANION_HP_GROWTH, COMPANION_STR_GROWTH, companionScale } from "../src/content/companions";
import { sk } from "../src/content/skills";
import { hasTag, weaponNumbers } from "../src/content/weapons";
import { fighterSeed, randomName, startPerk } from "../src/progress/create";
import { fits } from "../src/progress/perks";
import { walkWith } from "../src/progress/route";
import { EASY_POINTS, cardIndices, rivalSnapshot } from "../src/progress/rivals";
import { simulateFight } from "../src/sim/simulate";
import { combineSeed, makeRng } from "../src/prng";
import { api } from "../src/api";
import type { Pick as Side2, ScrapperRecord } from "../src/contracts/fighter";
import { moveReady, playMove } from "../src/sim/moves";
import { takeTurn } from "../src/sim/turn";
import { queue, scripted, setup, snap } from "./helpers";

describe("pets grow with their owner (finding 2)", () => {
  it("HP grows 15% and Strength 60% of the level-1 value per level", () => {
    expect([COMPANION_HP_GROWTH, COMPANION_STR_GROWTH]).toEqual([15, 60]);
    expect(companionScale(10, 1, COMPANION_HP_GROWTH)).toBe(10);
    expect(companionScale(10, 3, COMPANION_HP_GROWTH)).toBe(13);
    expect(companionScale(10, 30, COMPANION_HP_GROWTH)).toBe(53);
    expect(companionScale(1, 30, COMPANION_STR_GROWTH)).toBe(18);
  });
  it("a pet costs its owner at least 10% of max HP, and no pet starts with more than 10 HP", () => {
    for (const def of Object.values(COMPANIONS)) {
      expect(def.hpCostPct, def.id).toBeGreaterThanOrEqual(10);
      expect(def.hp, def.id).toBeLessThanOrEqual(10);
    }
  });
});

describe("the starting perk (finding 12)", () => {
  it("is always a weapon, never a pet or a skill that needs a kit", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const id = startPerk(fighterSeed(REALM_SALT, randomName(i)));
      expect(perkKind(id), id).toBe("weapon");
      seen.add(id);
    }
    // Still a random weapon: most of the common and uncommon ones show up.
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe("what a perk needs before it is offered (findings 14 and 15)", () => {
  it("Pet Lover and Whistle need a companion", () => {
    expect(fits("pet-lover", ["pipe"])).toBe(false);
    expect(fits("whistle", ["pipe"])).toBe(false);
    expect(fits("pet-lover", ["pipe", "crow"])).toBe(true);
  });
  it("a weapon passive needs a weapon it works with", () => {
    expect(fits("sharpening-stone", ["pipe"])).toBe(false);
    expect(fits("sharpening-stone", ["machete"])).toBe(true);
    expect(fits("heavy-lifter", ["pipe"])).toBe(false);
    expect(fits("heavy-lifter", ["crowbar"])).toBe(true);
    expect(fits("trick-shot", ["pipe"])).toBe(false);
    expect(fits("trick-shot", ["darts"])).toBe(true);
    expect(fits("junk-collector", ["darts"])).toBe(false);
    expect(fits("junk-collector", ["darts", "pipe"])).toBe(true);
    expect(fits("junk-collector", ["pipe"])).toBe(false);
    for (const p of ["pitcher", "firm-grip", "quick-swap"] as const) {
      expect(fits(p, []), p).toBe(false);
      expect(fits(p, ["pipe"]), p).toBe(true);
    }
  });
  it("in 240 rival kits at level 30, every such perk was taken when the kit already held what it needs", () => {
    const need: Partial<Record<PerkId, (owned: readonly PerkId[]) => boolean>> = {
      "pet-lover": (o) => o.some(isCompanionId),
      "whistle": (o) => o.some(isCompanionId),
      "sharpening-stone": (o) => o.some((p) => perkKind(p) === "weapon" && hasTag(p as never, "blade")),
      "heavy-lifter": (o) => o.some((p) => perkKind(p) === "weapon" && hasTag(p as never, "heavy")),
      "trick-shot": (o) => o.some((p) => perkKind(p) === "weapon" && hasTag(p as never, "thrown")),
    };
    let checked = 0;
    for (let i = 0; i < 240; i++) {
      const perks = rivalSnapshot(REALM_SALT, 30, i).perks;
      perks.forEach((p, at) => {
        const test = need[p];
        if (test === undefined) return;
        checked += 1;
        expect(test(perks.slice(0, at)), `rival ${i} ${p}`).toBe(true);
      });
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe("the perk card is rolled again before it turns into a split (finding 13)", () => {
  it("at most 12% of perk cards are splits by level 30 (was 38%)", () => {
    let perkSide = 0;
    let splits = 0;
    for (let i = 0; i < 300; i++) {
      walkWith(fighterSeed(REALM_SALT, `split-${i}`), 29, (cards) => {
        const card = cards.left.kind === "stat" ? cards.right : cards.left;
        perkSide += 1;
        if (card.kind === "split") splits += 1;
        return cards.left.kind === "stat" ? "R" : "L";
      });
    }
    expect(splits / perkSide).toBeLessThan(0.12);
  });
});

describe("Air Horn with no enemy pet (finding 15)", () => {
  it("can fire, and pushes the enemy scrapper back 60 beats", () => {
    const t = setup(snap(["air-horn"]), snap([]));
    expect(moveReady(t.bout, t.A, "air-horn")).toBe(true);
    const before = t.B.clock;
    playMove(t.bout, t.A, "air-horn");
    expect(t.B.clock - before).toBe(sk("air-horn", "clockPushNoPet"));
    expect(sk("air-horn", "clockPushNoPet")).toBe(60);
  });
  it("with an enemy pet it pushes 40 and the pet may run", () => {
    const t = setup(snap(["air-horn"]), snap(["raccoon"]), scripted({ move: queue([0]) }));
    const before = t.B.clock;
    playMove(t.bout, t.A, "air-horn");
    expect(t.B.clock - before).toBe(sk("air-horn", "clockPush"));
    expect(t.bout.steps.some((s) => s.t === "flee")).toBe(true);
  });
});

describe("Haymaker and Thrown weapons (finding 49)", () => {
  it("is not called while a Thrown weapon is in the hand, so its charge is never stuck", () => {
    const t = setup(snap(["haymaker", "darts", "pipe"]), snap([]));
    t.A.held = "darts";
    expect(moveReady(t.bout, t.A, "haymaker")).toBe(false);
    t.A.held = "pipe";
    expect(moveReady(t.bout, t.A, "haymaker")).toBe(true);
    t.A.held = "fists";
    expect(moveReady(t.bout, t.A, "haymaker")).toBe(true);
  });
});

describe("the sure redraw after a throw (finding 51)", () => {
  it("the turn after a weapon left the hand draws, and no Move is rolled in it", () => {
    // Every Move roll would fire the Taunt (the move stream answers 0).
    const t = setup(snap(["taunt", "pipe"]), snap([]), scripted({ move: queue([0, 0, 0]) }));
    t.A.reload = true;
    takeTurn(t.bout, t.A);
    expect(t.bout.steps[0]?.t).toBe("draw");
    expect(t.bout.steps.some((s) => s.t === "move")).toBe(false);
    // The turn after it may roll the Move again.
    takeTurn(t.bout, t.A);
    expect(t.bout.steps.some((s) => s.t === "move")).toBe(true);
  });
});

describe("Draw weights (finding 50)", () => {
  it("an Epic weapon is drawn at least as often as a Common one, a Mythic more often", () => {
    const common = Math.max(...WEAPON_IDS.filter((w) => RARITY_OF[w] === "common").map((w) => weaponNumbers(w).draw));
    for (const w of WEAPON_IDS) {
      if (RARITY_OF[w] === "epic") expect(weaponNumbers(w).draw, w).toBeGreaterThan(common);
      if (RARITY_OF[w] === "mythic") expect(weaponNumbers(w).draw, w).toBeGreaterThan(common + 1);
    }
  });
});

/** Level-1 bouts of random rivals, scored by each side's starting weapon. */
function rec(name: string, picks: Side2[]): ScrapperRecord {
  return { ...api.createRecord({ id: `id-${name}`, name, realmSalt: REALM_SALT, lookSalt: 0, colourSalt: 0, today: "2026-11-15", nowMs: 0 }), picks };
}

function startTable(n: number): Map<string, { w: number; n: number }> {
  const rng = makeRng(combineSeed("review-fixes", "start-table"));
  const by = new Map<string, { w: number; n: number }>();
  for (let i = 0; i < n; i++) {
    const a = rivalSnapshot(REALM_SALT, 1, rng.int(1_000_000));
    const b = rivalSnapshot(REALM_SALT, 1, rng.int(1_000_000));
    const log = simulateFight(rng.int(2 ** 31), a, b, 1);
    for (const [s, side] of [[a, "a"], [b, "b"]] as const) {
      const e = by.get(s.perks[0]!) ?? { w: 0, n: 0 };
      e.n += 1;
      if (log.result.winner === side) e.w += 1;
      by.set(s.perks[0]!, e);
    }
  }
  return by;
}

describe("the starting weapon does not decide level-1 bouts (findings 12 and 48)", () => {
  const table = startTable(6000);
  const rate = (id: string): number => { const e = table.get(id)!; return (100 * e.w) / e.n; };
  const common = [...table.keys()].filter((id) => RARITY_OF[id as PerkId] === "common");
  it("every Common and Uncommon start wins 40-62% of its level-1 bouts (was 37.7-64.2)", () => {
    for (const [id, e] of table) {
      const r = RARITY_OF[id as PerkId];
      if ((r === "common" || r === "uncommon") && e.n >= 200) {
        expect(rate(id), id).toBeGreaterThanOrEqual(40);
        expect(rate(id), id).toBeLessThanOrEqual(62);
      }
    }
  });
  it("a Common throw beats the best Common melee start by at most 4 points (was 9.8)", () => {
    const melee = Math.max(...common.filter((id) => !hasTag(id as never, "thrown")).map(rate));
    for (const id of common.filter((x) => hasTag(x as never, "thrown"))) expect(rate(id) - melee, id).toBeLessThanOrEqual(4);
  });
});

describe("the easy card of levels 1 to 3 (fair-card rule, round 2)", () => {
  it("is the last card, armed, its rival's perks with 3 fewer stat points, and a random scrapper beats it 55-75%", () => {
    const rng = makeRng(combineSeed("review-fixes", "easy-cards"));
    let w = 0;
    let n = 0;
    for (let i = 0; i < 300; i++) {
      for (const lvl of [1, 2, 3]) {
        const r = rec(randomName(i), Array.from({ length: lvl - 1 }, () => "L" as Side2));
        const card = api.tonightsCard(r, REALM_SALT, "2026-11-15");
        const idx = cardIndices(r, REALM_SALT, "2026-11-15");
        for (const [slot, s] of card.entries()) {
          const full = rivalSnapshot(REALM_SALT, lvl, idx[slot]!);
          if (slot < 5) { expect(s).toEqual(full); continue; }
          expect(s.perks).toEqual(full.perks);
          expect(s.perks.some((p) => perkKind(p) === "weapon")).toBe(true);
          const sum = (x: typeof s): number => Object.values(x.stats.points).reduce((a, b) => a + b, 0);
          expect(sum(full) - sum(s)).toBe(EASY_POINTS);
          const me = rivalSnapshot(REALM_SALT, lvl, 10_000 + rng.int(1_000_000));
          if (simulateFight(rng.int(2 ** 31), me, s, 1).result.winner === "a") w += 1;
          n += 1;
        }
      }
    }
    expect((100 * w) / n).toBeGreaterThanOrEqual(55);
    expect((100 * w) / n).toBeLessThanOrEqual(75);
  });
  it("level 4 and up has no easy card", () => {
    const r = rec("Marla", ["L", "L", "L"]);
    const card = api.tonightsCard(r, REALM_SALT, "2026-11-15");
    expect(card.every((s) => !s.id.includes(":easy:"))).toBe(true);
  });
});
