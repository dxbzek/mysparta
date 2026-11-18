/**
 * Talent text (content v3, batch 3): every node is named, and every number in its line is read from
 * the core's talent table, at the rank shown (13.4: no number typed by hand).
 */
import { describe, expect, it } from "vitest";
import { CAPSTONE_IDS, TALENT_BRANCHES, TALENT_IDS, TALENT_META, api } from "@rankzero/core";
import { BRANCH_LINES, BRANCH_NAMES, TALENT_NAMES, procName, talentLine } from "../../src/text/talents";
import { STAGE_TEXT } from "../../src/text/stage";

describe("talent text", () => {
  it("names every node and branch", () => {
    for (const id of TALENT_IDS) expect(TALENT_NAMES[id].length, id).toBeGreaterThan(2);
    for (const b of TALENT_BRANCHES) expect(BRANCH_NAMES[b] && BRANCH_LINES[b]).toBeTruthy();
    expect(new Set(Object.values(TALENT_NAMES)).size).toBe(30);
  });
  it.each([...TALENT_IDS])("%s: its line holds rank x each table number at every rank", (id) => {
    for (let r = 1; r <= TALENT_META[id].max; r++) {
      const line = talentLine(api.content, id, r);
      for (const [k, v] of Object.entries(api.content.talents[id].per)) {
        if (k === "loyal" || k === "sureRiposte") continue;
        const want = k === "critTo" ? String(v / 100) : String(Math.min(Math.abs(v * r), k === "petCost" ? 100 : Infinity));
        expect(line, `${id} rank ${r} ${k}`).toContain(want);
      }
    }
  });
  it("a capstone's tag on stage is its name", () => {
    for (const id of CAPSTONE_IDS) expect(STAGE_TEXT.skillName(id)).toBe(TALENT_NAMES[id].toUpperCase());
    expect(procName("parry")).toBe("Parry");
  });
});
