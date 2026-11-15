/**
 * Findings 35 and 36: no skill name and no fighter name ends in "…" on the fight screen, at 320
 * and at 390 px. Layout is not measured here (no browser): what is checked is that no rule can cut
 * them (no ellipsis, no line clamp, no nowrap) and that long names step down a size. The real
 * measurement at 320 x 720 and 390 x 844 is `pnpm shots` (its "clipped text" check).
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SKILL_IDS, api } from "@rankzero/core";
import type { SkillId } from "@rankzero/core";
import { NAMES } from "../../src/text/names";
import { SKILL_TILES, nameSize } from "../../src/fight/FighterCard";

const CSS = readFileSync(new URL("../../src/fight/fight.module.css", import.meta.url), "utf8");

/** Every block for `selector`, at any width (base rules and both phone media queries). */
function blocks(selector: string): string[] {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...CSS.matchAll(new RegExp(`(^|[\\s,}])${esc}\\s*(,[^{]*)?\\{([^}]*)\\}`, "g"))].map((m) => m[3]!);
}

describe("skill names are never cut (finding 35)", () => {
  it("no rule for a skill name ellipsises, clamps or forbids wrapping", () => {
    const rules = blocks(".skillName").join("\n");
    expect(rules).not.toMatch(/-webkit-line-clamp/);
    expect(rules).not.toMatch(/white-space:\s*nowrap/);
    // the shared .weaponName,.skillName block sets ellipsis; the .skillName block must undo it
    const own = blocks(".skillName").at(-1) ?? "";
    expect(CSS).toMatch(/\.skillName \{[^}]*text-overflow: clip/);
    expect(own + rules).toMatch(/white-space:\s*normal/);
  });

  it("tiles are one per row (full card width) and the +N tile sits in its own column", () => {
    expect(CSS).toMatch(/\.skills \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/);
    expect(CSS).toMatch(/\.skillMore \{[^}]*grid-column: 2/);
    expect(SKILL_TILES).toBeLessThanOrEqual(3);
  });

  it("the longest skill name has a space to wrap at, or fits one 320 px tile line", () => {
    // a tile line at 320 px holds about 9 display letters at 11.5 px; longer names must wrap at a space
    for (const id of SKILL_IDS as readonly SkillId[]) {
      const words = NAMES[id].split(" ");
      expect(Math.max(...words.map((w) => w.length)), NAMES[id]).toBeLessThanOrEqual(13);
    }
  });
});

describe("the longest legal name fits the HUD and the cards (finding 36)", () => {
  it("long names step down a size", () => {
    expect(nameSize("Marla")).toBeUndefined();
    expect(nameSize("Rio Clamp X")).toBe("mid");
    expect(nameSize("Maximiliana Wo")).toBe("long");
    expect(CSS).toMatch(/\.tape\.nameLong \{ font-size: 13px; \}/);
    expect(CSS).toMatch(/\.cardName\[data-size="long"\] \{ font-size: 14px; \}/);
  });

  it("no rule for a name tape or card name ellipsises", () => {
    for (const sel of [".cardName", ".tape"]) {
      for (const b of blocks(sel)) expect(b, sel).not.toMatch(/text-overflow:\s*ellipsis/);
    }
    // the sticker's own nowrap + ellipsis is undone on the fight HUD
    expect(CSS).toMatch(/\.nameRow > \.tape \{[^}]*white-space: normal;[^}]*text-overflow: clip;/);
  });

  it("the card renders the size step for a 14-letter name", async () => {
    const { FighterCard } = await import("../../src/fight/FighterCard");
    const info = { side: "a" as const, name: "Maximiliana Wo", level: 1, look: api.rollLook(1, 0, 0), stats: { health: 1, strength: 1, agility: 1, speed: 1 }, skills: [], pets: [] };
    const frame = { hp: {} } as never;
    const html = renderToStaticMarkup(<FighterCard info={info} frame={frame} state={undefined} pets={[]} bag={[]} lit={new Map()} pulse={0} />);
    expect(html).toContain('data-size="long"');
    expect(html).toContain("Maximiliana Wo");
  });
});
