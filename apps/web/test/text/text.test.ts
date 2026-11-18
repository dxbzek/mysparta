/** Stats words, result lines and the plain-label rule (brief 3.1, 3.3, 3.11). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// The sim's caps are not in the package's public face; read them from the sim's own file.
import { CAP } from "../../../../packages/core/src/sim/combatant";
import { DERIVED_CAP, DERIVED_KEYS, DERIVED_LINE, DERIVED_NAME, STAT_LINE, STAT_NAME } from "../../src/text/stats";
import { LOSS_LINES, WIN_LINES, resultLine } from "../../src/text/results";
import { LOCKER_WORDS, NAV, UI } from "../../src/text/ui";

describe("stats words", () => {
  it("names and explains every stat and every derived value", () => {
    for (const k of ["health", "strength", "agility", "speed", "toughness", "precision"] as const) {
      expect(STAT_NAME[k].length).toBeGreaterThan(2);
      expect(STAT_LINE[k].length).toBeGreaterThan(10);
    }
    expect(DERIVED_KEYS).toHaveLength(12);
    for (const k of DERIVED_KEYS) {
      expect(DERIVED_NAME[k]).toMatch(/^[A-Z][a-z]+$/);
      expect(DERIVED_LINE[k]).toMatch(/\.$/);
    }
  });
  it("the caps are the sim's caps", () => {
    for (const k of DERIVED_KEYS) expect(DERIVED_CAP[k], k).toBe((CAP as Record<string, number>)[k] ?? null);
  });
});

describe("result lines", () => {
  it("has at least 20 for wins and 20 for losses, all different", () => {
    expect(WIN_LINES.length).toBeGreaterThanOrEqual(20);
    expect(LOSS_LINES.length).toBeGreaterThanOrEqual(20);
    expect(new Set([...WIN_LINES, ...LOSS_LINES]).size).toBe(WIN_LINES.length + LOSS_LINES.length);
  });
  it("takes the names as parameters and never names a sim unit", () => {
    for (const l of [...WIN_LINES, ...LOSS_LINES]) {
      expect(l).toMatch(/\{me\}/);
      expect(l).not.toMatch(/\d|\b(HP|XP|damage|beats?|turns?)\b/i);
    }
    expect(resultLine(0, true, "Dez", "Marla")).toBe("Dez folded Marla like a deckchair.");
    expect(resultLine(1000 + 3, false, "Tug", "Dez")).not.toContain("{");
    expect(resultLine(-1, false, "Tug", "Dez")).not.toContain("{");
  });
});

describe("plain labels", () => {
  it("the navigation strings are the plain words of brief 3.1", () => {
    expect(Object.values(NAV)).toEqual(["Home", "Kit", "History", "Inventory", "Pick a rival", "Tonight's Card", "Level path", "Route",
      "Fight", "Level up", "Skills", "Weapons", "Pets"]);
    expect(LOCKER_WORDS.tabs).toEqual({ home: "Home", kit: "Kit", inventory: "Inventory", history: "History" });
    expect(UI.kit.tabs).toEqual({ kit: "Kit", loadout: "Bag", gear: "Gear", route: "Level path", stats: "Stats" });
    expect(UI.card.heading).toBe("Pick a rival");
    expect(UI.card.title).toBe("Tonight's Card");
    expect(LOCKER_WORDS.levelUp).toBe("Level up!");
    // content v3: the energy bar beside it says how many bouts are left
    expect(LOCKER_WORDS.fight(4)).toBe("Fight");
    expect(UI.energy).toMatchObject({ label: "Energy", full: "Full" });
    expect(UI.energy.next("12:04")).toBe("+1 in 12:04");
  });

  it("no screen types a navigation label itself: tabs, headings and buttons come from text/ui.ts", () => {
    const screens = ["Locker/Locker.tsx", "Kit/Kit.tsx", "Inventory/Inventory.tsx", "Card/Card.tsx", "LevelUp/LevelUp.tsx", "Bouts/Bouts.tsx", "Create/Create.tsx"];
    for (const f of screens) {
      const text = readFileSync(fileURLToPath(new URL(`../../src/screens/${f}`, import.meta.url)), "utf8");
      for (const label of ["Home", "History", "Inventory", "Pick a rival", "Level path", "Weapons", "Pets", "Skills"]) {
        expect(text, `${f} types "${label}"`).not.toMatch(new RegExp(`>\\s*${label}\\s*<|"${label}"`));
      }
    }
  });
});
