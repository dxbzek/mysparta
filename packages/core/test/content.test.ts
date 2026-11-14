/**
 * The content tables (work package 1): totals, counts and spot values against the rules.
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "../src/contracts/ids";
import { COMPANION_IDS, MOVE_IDS, SKILL_IDS, WEAPON_IDS } from "../src/contracts/ids";
import { WEAPON_META } from "../src/contracts/content";
import { api } from "../src/api";
import { COMPANIONS, companionScale } from "../src/content/companions";
import { SKILLS } from "../src/content/skills";
import { WEAPONS } from "../src/content/weapons";

describe("content tables", () => {
  it("are total Records, reached through the api", () => {
    expect(Object.keys(api.content.weapons).sort()).toEqual(["fists", ...WEAPON_IDS].sort());
    expect(Object.keys(api.content.skills).sort()).toEqual([...SKILL_IDS].sort());
    expect(Object.keys(api.content.companions).sort()).toEqual([...COMPANION_IDS].sort());
  });

  it("weapons agree with the frozen WEAPON_META on rarity, tags, clip and Reach for all 29 ids", () => {
    for (const id of Object.keys(WEAPON_META) as HeldId[]) {
      const w = WEAPONS[id];
      const m = WEAPON_META[id];
      expect([w.rarity, w.tags, w.clip], id).toEqual([m.rarity, m.tags, m.clip]);
      expect(w.tiers[0].reach ?? 0, id).toBe(m.reach);
    }
    expect(Object.keys(WEAPON_META)).toHaveLength(29);
  });

  it("skills count 6 Common, 13 Uncommon, 9 Rare, 3 Epic, 1 Mythic, in 6 boosters, 18 passives and 8 Moves", () => {
    const rar: Record<string, number> = {};
    const kind: Record<string, number> = {};
    for (const id of SKILL_IDS) {
      rar[SKILLS[id].rarity] = (rar[SKILLS[id].rarity] ?? 0) + 1;
      kind[SKILLS[id].kind] = (kind[SKILLS[id].kind] ?? 0) + 1;
    }
    expect(rar).toEqual({ common: 6, uncommon: 13, rare: 9, epic: 3, mythic: 1 });
    expect(kind).toEqual({ booster: 6, passive: 18, move: 8 });
    for (const m of MOVE_IDS) expect(SKILLS[m].move).toBeDefined();
  });

  it("matches spot values of the skill table", () => {
    expect(SKILLS["big-heart"].tiers[0]).toEqual({ health: 3, healthMult: 40 });
    expect(SKILLS.mountain.tiers[0]).toMatchObject({ healthMult: 150, agilityMult: -20, speedMult: -20, startClock: 150 });
    expect(SKILLS.parry.tiers[0]).toEqual({ block: 10, riposteAfterBlock: 80 });
    expect(SKILLS.haymaker.move).toEqual({ weight: 5, uses: 1 });
    expect(SKILLS["body-slam"].tiers[0]).toMatchObject({ base: 16, perStrength: 3, extraCost: 100 });
    expect(SKILLS.whistle.move).toEqual({ weight: 6, uses: 2 });
  });

  it("matches the companion table and its scaling", () => {
    expect(COMPANIONS.raccoon).toMatchObject({ weight: 90, limit: 2, hpCostPct: 8, hp: 14, strength: 4, startClock: 10 });
    expect(COMPANIONS.goose).toMatchObject({ weight: 5, limit: 1, excludes: ["boar"], hpCostPct: 20, combo: 50, evade: 25 });
    expect(COMPANIONS.boar).toMatchObject({ weight: 5, limit: 1, excludes: ["goose"], hpCostPct: 30, hp: 80, strength: 16, startClock: 250 });
    expect(companionScale(80, 1)).toBe(80);
    expect(companionScale(80, 11)).toBe(112);
  });
});
