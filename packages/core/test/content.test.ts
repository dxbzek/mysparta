/**
 * The content tables (work package 1): totals, counts and spot values against the rules.
 */
import { describe, expect, it } from "vitest";
import type { HeldId } from "../src/contracts/ids";
import { COMPANION_IDS, MOVE_IDS, SHIELD_IDS, SKILL_IDS, WEAPON_IDS } from "../src/contracts/ids";
import { WEAPON_META } from "../src/contracts/content";
import { api } from "../src/api";
import { COMPANIONS, COMPANION_HP_GROWTH, COMPANION_STR_GROWTH, companionScale } from "../src/content/companions";
import { SKILLS } from "../src/content/skills";
import { WEAPONS } from "../src/content/weapons";

describe("content tables", () => {
  it("are total Records, reached through the api", () => {
    expect(Object.keys(api.content.weapons).sort()).toEqual(["fists", ...WEAPON_IDS].sort());
    expect(Object.keys(api.content.skills).sort()).toEqual([...SKILL_IDS].sort());
    expect(Object.keys(api.content.companions).sort()).toEqual([...COMPANION_IDS].sort());
    expect(Object.keys(api.content.shields).sort()).toEqual([...SHIELD_IDS].sort());
  });

  it("weapons agree with the frozen WEAPON_META on rarity, tags, clip and Reach for all 42 ids", () => {
    for (const id of Object.keys(WEAPON_META) as HeldId[]) {
      const w = WEAPONS[id];
      const m = WEAPON_META[id];
      expect([w.rarity, w.tags, w.clip], id).toEqual([m.rarity, m.tags, m.clip]);
      expect(w.tiers[0].reach ?? 0, id).toBe(m.reach);
    }
    expect(Object.keys(WEAPON_META)).toHaveLength(42);
  });

  it("skills count 7 Common, 16 Uncommon, 12 Rare, 3 Epic, 1 Mythic, in 6 boosters, 21 passives and 12 Moves", () => {
    const rar: Record<string, number> = {};
    const kind: Record<string, number> = {};
    for (const id of SKILL_IDS) {
      rar[SKILLS[id].rarity] = (rar[SKILLS[id].rarity] ?? 0) + 1;
      kind[SKILLS[id].kind] = (kind[SKILLS[id].kind] ?? 0) + 1;
    }
    expect(rar).toEqual({ common: 7, uncommon: 16, rare: 12, epic: 3, mythic: 1 });
    expect(kind).toEqual({ booster: 6, passive: 21, move: 12 });
    for (const m of MOVE_IDS) expect(SKILLS[m].move).toBeDefined();
  });

  it("matches spot values of the skill table", () => {
    expect(SKILLS["big-heart"].tiers[0]).toEqual({ health: 2, healthMult: 35 });
    expect(SKILLS.mountain.tiers[0]).toMatchObject({ healthMult: 150, agilityMult: -20, speedMult: -20, startClock: 150 });
    expect(SKILLS.parry.tiers[0]).toEqual({ block: 10, riposteAfterBlock: 80 });
    expect(SKILLS.haymaker.move).toEqual({ weight: 5, uses: 1 });
    expect(SKILLS["body-slam"].tiers[0]).toMatchObject({ base: 19, perStrength: 4, extraCost: 40 });
    expect(SKILLS.whistle.move).toEqual({ weight: 20, uses: 2 });
    expect(SKILLS.whistle.tiers[0]).toMatchObject({ belowHpPct: 90 });
  });

  it("matches the companion table and its scaling", () => {
    // Pet pass (15 November 2026): level-1 values, grown by COMPANION_HP_GROWTH / COMPANION_STR_GROWTH.
    expect(COMPANIONS.raccoon).toMatchObject({ weight: 90, limit: 2, hpCostPct: 11, hp: 3, strength: 1, startClock: 10 });
    expect(COMPANIONS.goose).toMatchObject({ weight: 5, limit: 1, excludes: ["boar"], hpCostPct: 20, combo: 30, evade: 25 });
    expect(COMPANIONS.boar).toMatchObject({ weight: 5, limit: 1, excludes: ["goose"], hpCostPct: 22, hp: 7, strength: 2, startClock: 150 });
    expect(COMPANIONS["stray-dog"]).toMatchObject({ limit: 1, excludes: ["alley-cat"], swings: 1, flies: false });
    expect(COMPANIONS.crow).toMatchObject({ limit: 1, swings: 1, flies: true });
    expect(COMPANIONS["alley-cat"]).toMatchObject({ limit: 1, excludes: ["stray-dog"], swings: 2, flies: false });
    expect(companionScale(80, 1, COMPANION_HP_GROWTH)).toBe(80);
    expect(companionScale(80, 11, COMPANION_HP_GROWTH)).toBe(200);
    expect(companionScale(5, 11, COMPANION_STR_GROWTH)).toBe(35);
  });
});
