/**
 * Plan 13.4: every card line is built from the content tables. No number on a card may be typed
 * by hand: every number a card prints is one of its own table row's numbers, and every number of
 * the row that the rules act on is printed.
 */
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, PERK_IDS, RARITY_OF, SHIELD_IDS, SKILL_IDS, WEAPON_IDS, api } from "@rankzero/core";
import type { CompanionId, PerkId, ShieldId, SkillId, WeaponId } from "@rankzero/core";
import { WEAPON_BONUS_KEYS, needsLine, perkKindWord, perkNumbers, perkText } from "../../src/text/perks";

const c = api.content;
const numbersIn = (s: string): number[] => (s.match(/\d+/g) ?? []).map(Number);

/** The numbers of a perk's own row, as positive values. */
function rowNumbers(id: PerkId): Set<number> {
  const out = new Set<number>();
  const add = (v: unknown): void => {
    if (typeof v === "number") out.add(Math.abs(v));
  };
  if ((WEAPON_IDS as readonly string[]).includes(id)) Object.values(c.weapons[id as WeaponId].tiers[0]).forEach(add);
  else if ((COMPANION_IDS as readonly string[]).includes(id)) Object.values(c.companions[id as CompanionId]).forEach(add);
  else if ((SHIELD_IDS as readonly string[]).includes(id)) Object.values(c.shields[id as ShieldId].tiers[0]).forEach(add);
  else {
    const s = c.skills[id as SkillId];
    Object.values(s.tiers[0]).forEach(add);
    if (s.move) add(s.move.uses);
  }
  return out;
}

/** Numbers of the skill row a card must print (time costs are shown on stage, not on the card). */
const NOT_PRINTED = new Set(["cost", "costPct", "extraCost", "saves"]);

describe("perk cards", () => {
  it("covers all 92 perks with a name, a kind, a rarity word and an effect", () => {
    expect(PERK_IDS).toHaveLength(92);
    for (const id of PERK_IDS) {
      const t = perkText(id);
      expect(t.name.length, id).toBeGreaterThan(1);
      expect(t.effect.length, id).toBeGreaterThan(10);
      expect(t.rarity, id).toBe(RARITY_OF[id]);
      expect(["Common", "Uncommon", "Rare", "Epic", "Mythic"]).toContain(t.rarityWord);
      expect(t.effect, id).not.toMatch(/undefined|NaN|null/);
      for (const cost of t.costs) expect(cost, id).not.toMatch(/undefined|NaN|null/);
    }
  });

  it.each(PERK_IDS.map((id) => [id]))("%s prints only numbers from its own table row", (id) => {
    const t = perkText(id as PerkId);
    const allowed = rowNumbers(id as PerkId);
    for (const n of numbersIn([t.effect, ...t.costs].join(" "))) expect(allowed, `${id}: ${n} in "${t.effect} ${t.costs.join(" ")}"`).toContain(n);
  });

  it.each(SKILL_IDS.map((id) => [id]))("%s prints every number of its row that the rules act on", (id) => {
    const t = perkText(id);
    const printed = new Set(numbersIn([t.effect, ...t.costs].join(" ")));
    const row = c.skills[id].tiers[0];
    for (const [k, v] of Object.entries(row)) {
      if (NOT_PRINTED.has(k) || v === 0) continue;
      expect(printed, `${id}.${k} = ${v}`).toContain(Math.abs(v));
    }
    if (c.skills[id].move && c.skills[id].move!.uses > 1) expect(printed).toContain(c.skills[id].move!.uses);
  });

  it.each(WEAPON_IDS.map((id) => [id]))("%s shows damage and every minus as a cost", (id) => {
    const n = c.weapons[id].tiers[0];
    const t = perkText(id);
    expect(numbersIn(t.effect)).toContain(n.dmg);
    const minus = WEAPON_BONUS_KEYS.filter((k) => n[k] < 0);
    for (const k of minus) expect(t.costs.join(" ")).toContain(`${n[k]}`);
    if (minus.length === 0) expect(t.costs).toEqual([]);
  });

  it.each(SHIELD_IDS.map((id) => [id]))("%s prints every number of its shield row that is not 0", (id) => {
    const t = perkText(id);
    expect(t.kind).toBe("Shield");
    const printed = new Set(numbersIn([t.effect, ...t.costs].join(" ")));
    for (const [k, v] of Object.entries(c.shields[id].tiers[0])) if (v !== 0) expect(printed, `${id}.${k} = ${v}`).toContain(Math.abs(v));
    expect(perkNumbers(id).find((r) => r.label === "Block")?.value).toBe(`+${c.shields[id].tiers[0].block}`);
  });

  it("pet cards say who the pet fights for and how many you can own (finding 66)", () => {
    for (const id of COMPANION_IDS) {
      const e = perkText(id).effect;
      expect(e).toContain("fights beside your scrapper");
      expect(e).not.toMatch(/beside it:/);
      if (c.companions[id].limit > 1) expect(e).toContain(`You can own up to ${c.companions[id].limit}.`);
    }
  });

  it("companion cards print the max HP cost in the cost line", () => {
    for (const id of COMPANION_IDS) expect(perkText(id).costs).toEqual([`-${c.companions[id].hpCostPct}% max HP`]);
  });

  it("would catch a hand-typed number (planted fault)", () => {
    const allowed = rowNumbers("padding");
    expect(numbersIn("Armor +12 for good.").every((n) => allowed.has(n))).toBe(false);
  });

  it("kind words and the detail numbers", () => {
    expect(perkKindWord("pipe")).toBe("Weapon");
    expect(perkKindWord("big-heart")).toBe("Booster");
    expect(perkKindWord("padding")).toBe("Passive");
    expect(perkKindWord("tarp")).toBe("Move");
    expect(perkKindWord("goose")).toBe("Pet");
    expect(perkKindWord("bin-lid")).toBe("Shield");
    const pipe = perkNumbers("pipe");
    expect(pipe.find((r) => r.label === "Damage")?.value).toBe(String(c.weapons.pipe.tiers[0].dmg));
    expect(perkNumbers("darts").find((r) => r.label === "Reach")?.value).toBe("Thrown");
  });

  it("says when a perk waits on something the kit does not hold", () => {
    expect(needsLine("sharpening-stone", ["pipe"])).toBe("No Blade weapon yet.");
    expect(needsLine("sharpening-stone", ["machete"])).toBeNull();
    expect(needsLine("heavy-lifter", ["pocket-knife"])).toBe("No Heavy weapon yet.");
    expect(needsLine("heavy-lifter", ["anvil"])).toBeNull();
    expect(needsLine("whistle", [])).toBe("No pet yet.");
    expect(needsLine("pet-lover", [])).toBe("No pet yet.");
    expect(needsLine("pet-lover", ["crow"])).toBeNull();
    expect(needsLine("trick-shot", ["pipe"])).toBe("No Thrown weapon yet.");
    expect(needsLine("trick-shot", ["hubcap"])).toBeNull();
    expect(needsLine("riot-shield", ["car-door"])).toBe("Already carries a shield.");
    expect(needsLine("padding", [])).toBeNull();
  });
});
