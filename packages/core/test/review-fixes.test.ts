/**
 * The sim findings of the 15 November 2026 review (pet pass): pet growth, the starting perk, the
 * perk reroll, what a perk needs before it is offered, Air Horn's fallback, Haymaker with a Thrown
 * weapon, the sure redraw after a throw, and the Draw weights of rare weapons.
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
import { rivalSnapshot } from "../src/progress/rivals";
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
