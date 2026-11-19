/**
 * The rank ladder (plan 13.10 item 1): the ten bosses are legal, fixed snapshots; the gates; who may
 * fight which boss; a win moves one rank up and a loss does not; the boss prize joins the kit at the
 * picks it was taken after, so the Route's next cards are the ones the kit really walks; boss bouts
 * pass the log checker.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PerkId } from "../src/contracts/ids";
import { GEAR_IDS, isGearId, perkKind } from "../src/contracts/ids";
import { RARITY_OF } from "../src/contracts/content";
import { LADDER_RUNGS, LOOK_SPACE } from "../src/contracts/fighter";
import type { ScrapperRecord } from "../src/contracts/fighter";
import { checkLog } from "../src/contracts/check";
import { BOSSES } from "../src/content/bosses";
import { gearSlot } from "../src/content/gear";
import { api, canonical } from "../src/index";
import { fits } from "../src/progress/perks";
import { branchBuild, cleanRanks, talentPointsAt } from "../src/progress/talents";
import { ENERGY_MAX } from "../src/progress/energy";

const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");
const T0 = 1_700_000_000_000;

function rec(name = "Ladder Kid", picks = 0): ScrapperRecord {
  const r = api.createRecord({ id: `id-${name}`, name, realmSalt: "yard-1", lookSalt: 0, colourSalt: 0, today: "2026-11-19", nowMs: T0 });
  return { ...r, picks: Array.from({ length: picks }, (_, i) => (i % 2 === 0 ? "L" : "R")) };
}

describe("the bosses", () => {
  it("are ten, one per rung, bottom up, with names that fit and looks inside LOOK_SPACE", () => {
    expect(BOSSES.map((b) => b.rung)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(LADDER_RUNGS).toBe(10);
    expect(new Set(BOSSES.map((b) => b.name)).size).toBe(10);
    for (const b of BOSSES) {
      expect(api.checkName(b.name)).toEqual({ ok: true, name: b.name });
      for (const [k, n] of Object.entries(b.look)) expect(n, `${b.name} ${k}`).toBeLessThan(LOOK_SPACE[k as keyof typeof LOOK_SPACE]);
      expect(b.level, b.name).toBeGreaterThan(api.bossGate(b.rung));
    }
    // the builds differ rung to rung: the five builds all show up
    expect(new Set(BOSSES.map((b) => b.look.build)).size).toBe(5);
  });

  it("follow a kit's rules: every perk fits the rest, at most 5 weapons, one shield, one piece of gear per slot", () => {
    for (const b of BOSSES) {
      b.perks.forEach((p, i) => {
        const rest: PerkId[] = b.perks.filter((_, j) => j !== i);
        expect(fits(p, rest), `${b.name}: ${p}`).toBe(true);
      });
      const slots = b.perks.filter(isGearId).map(gearSlot);
      expect(new Set(slots).size, b.name).toBe(slots.length);
    }
  });

  it("take every perk into the bout and spend exactly their level's talent points down their branch", () => {
    for (const b of BOSSES) {
      const s = api.bossSnapshot(b.rung);
      expect([...s.perks].sort(), b.name).toEqual([...b.perks].sort());
      expect(s.talents).toEqual(branchBuild(b.branch, talentPointsAt(b.level)));
      expect(cleanRanks(s.talents, talentPointsAt(b.level))).toEqual(s.talents);
      expect(s.id).toBe(`boss:${b.rung}`);
    }
  });

  it("are fixed snapshots: the same on every call, and pinned by a digest", () => {
    const all = BOSSES.map((b) => api.bossSnapshot(b.rung));
    expect(BOSSES.map((b) => api.bossSnapshot(b.rung))).toEqual(all);
    expect(sha(JSON.stringify(all))).toBe(BOSS_DIGEST);
    expect(() => api.bossSnapshot(0)).toThrow();
    expect(() => api.bossSnapshot(11)).toThrow();
  });

  it("fight real bouts that pass the log checker, the same log for the same seed", () => {
    for (const b of BOSSES) {
      const me = api.rivalSnapshot("ladder-test", api.bossGate(b.rung), 3);
      const log = api.simulateFight(1234 + b.rung, me, api.bossSnapshot(b.rung), 1);
      expect(checkLog(log), b.name).toEqual([]);
      expect(canonical(api.simulateFight(1234 + b.rung, me, api.bossSnapshot(b.rung), 1))).toBe(canonical(log));
    }
  });
});

/** Changes only when a boss is retuned on purpose: update it in the same commit. */
const BOSS_DIGEST = "959c404d55ef8b7f06fded28c316378914a310b8cd45931400e6fb1c2aa45aff";

describe("gates and who may fight which boss", () => {
  it("puts the gates every 3 levels from 3 to 30", () => {
    expect(Array.from({ length: 10 }, (_, i) => api.bossGate(i + 1))).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  });

  it("opens only the next rung up, at or over its gate", () => {
    const r1 = rec("Low", 1);                               // level 2
    expect(api.ladderOf(r1)).toEqual({ rank: 0, prizeWaiting: false });
    expect(api.bossBlock(r1, 1)).toBe("level");
    const r3 = rec("Gate", 2);                              // level 3
    expect(api.bossBlock(r3, 1)).toBeNull();
    expect(api.bossBlock(r3, 2)).toBe("rank");
    const won = api.afterBoss(r3, 1, true, 2, T0);
    expect(api.bossBlock(won, 1)).toBe("beaten");
    expect(api.bossBlock(won, 2)).toBe("level");
    expect(api.bossBlock({ ...won, picks: [...won.picks, "L", "L", "L"] }, 2)).toBeNull();
  });
});

describe("rank up", () => {
  it("a win over the next boss is one rank up; it costs one energy and gives its XP like a bout", () => {
    const r = rec("Climber", 2);
    const won = api.afterBoss(r, 1, true, 2, T0);
    expect(api.ladderOf(won)).toEqual({ rank: 1, prizeWaiting: true });
    expect(api.energyNow(won, T0)).toBe(ENERGY_MAX - 1);
    expect(won.xp).toBe(r.xp + 2);
    expect(won.lifetimeBouts).toBe(r.lifetimeBouts + 1);
  });

  it("a loss costs the energy and nothing more; a win over any other rung moves nothing", () => {
    const r = rec("Loser", 2);
    const lost = api.afterBoss(r, 1, false, 1, T0);
    expect(api.ladderOf(lost)).toEqual({ rank: 0, prizeWaiting: false });
    expect(api.energyNow(lost, T0)).toBe(ENERGY_MAX - 1);
    expect(api.ladderOf(api.afterBoss(r, 2, true, 2, T0)).rank).toBe(0);
  });

  it("a damaged stored ladder is read inside its bounds", () => {
    const r = { ...rec("Odd", 2), ladder: { rank: 99, prizes: [] } };
    expect(api.ladderOf(r).rank).toBe(LADDER_RUNGS);
    expect(api.ladderOf({ ...r, ladder: { rank: -3, prizes: [] } }).rank).toBe(0);
  });
});

describe("the boss prize", () => {
  const won = api.afterBoss(rec("Prize Kid", 2), 1, true, 2, T0);

  it("offers a piece of gear and a Rare or better weapon, skill, shield or pet the kit may own", () => {
    const offer = api.prizeOffer(won)!;
    expect(offer).not.toBeNull();
    const owned = api.sheetOf(won).perks;
    expect(offer.left.kind).toBe("perk");
    expect(offer.right.kind).toBe("perk");
    if (offer.left.kind !== "perk" || offer.right.kind !== "perk") return;
    expect(GEAR_IDS as readonly string[]).toContain(offer.left.perk);
    expect(["rare", "epic", "mythic"]).toContain(RARITY_OF[offer.left.perk]);
    expect(perkKind(offer.right.perk)).not.toBe("gear");
    expect(["rare", "epic", "mythic"]).toContain(RARITY_OF[offer.right.perk]);
    expect(fits(offer.left.perk, owned) && fits(offer.right.perk, owned)).toBe(true);
    expect(api.prizeOffer(won)).toEqual(offer);              // pure: never rerolls
  });

  it("is taken once: the kit owns it, the sheet and the snapshot show it, and nothing waits after", () => {
    const offer = api.prizeOffer(won)!;
    const took = api.takePrize(won, "R");
    expect(api.ladderOf(took)).toEqual({ rank: 1, prizeWaiting: false });
    expect(took.ladder!.prizes).toEqual([{ at: won.picks.length, card: offer.right }]);
    if (offer.right.kind === "perk") {
      expect(api.sheetOf(took).perks).toContain(offer.right.perk);
      expect(api.snapshotOf(took).perks).toContain(offer.right.perk);
    }
    expect(api.prizeOffer(took)).toBeNull();
    expect(api.takePrize(took, "L")).toBe(took);
  });

  it("joins the Route where it was taken: the next level-up's cards are the ones the kit walks", () => {
    let r = api.takePrize(won, "L");
    for (let i = 0; i < 6; i++) {
      r = { ...r, xp: api.xpToNext(api.sheetOf(r).level) };
      const shown = api.routeNode(r.seed, r.picks, r.base, r.gearFrom, r.ladder!.prizes);
      const next = api.afterPick(r, "R");
      const node = api.route(next).at(-1)!;
      expect({ left: node.left, right: node.right }).toEqual(shown);
      r = next;
    }
    // and the prize stays in the kit as the picks go on
    const offer = api.prizeOffer(won)!;
    if (offer.left.kind === "perk") expect(api.sheetOf(r).perks).toContain(offer.left.perk);
  });

  it("a record with no ladder walks as before (an old save's kit is unchanged)", () => {
    const r = rec("Plain", 4);
    const withEmpty = { ...r, ladder: { rank: 0, prizes: [] } };
    expect(api.sheetOf(withEmpty)).toEqual(api.sheetOf(r));
    expect(api.route(withEmpty)).toEqual(api.route(r));
  });
});
