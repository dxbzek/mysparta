import { describe, expect, it } from "vitest";
import { api } from "@rankzero/core";
import type { RouteCard } from "@rankzero/core";
import { chipRow, previewSheet } from "../../src/screens/LevelUp/chips";
import { memGame, playUntilLevelUp } from "../state/helpers";

describe("level-up chip row (review r2: strip stayed frozen after Take it)", () => {
  it("after taking a card the row reads the live record and marks what moved", async () => {
    const g = await memGame();
    const c = await g.actions.create("Marla", 0, 0);
    if (!c.ok) throw new Error(c.error);
    await playUntilLevelUp(g, c.value.id);
    const rec = g.store.doc.fighters[0]!;
    const before = api.sheetOf(rec);
    const offer = api.routeNode(rec.seed, rec.picks);
    const side = offer.left.kind !== "perk" ? "L" : "R";
    const card: RouteCard = side === "L" ? offer.left : offer.right;
    const r = await g.actions.takeLevelUp(rec.id, side);
    expect(r.ok).toBe(true);
    const live = api.sheetOf(g.store.doc.fighters[0]!);
    const row = chipRow(before, live);
    if (card.kind === "stat") {
      const chip = row.find((x) => x.key === card.stat)!;
      expect(chip.from).toBe(before.effective[card.stat]);
      expect(chip.to).toBe(live.effective[card.stat]);
      expect(chip.changed).toBe(true);
    }
    expect(row[0]!.to).toBe(live.maxHp);
    // The preview of the same card agrees with what taking it gave.
    const preview = previewSheet(api, api.snapshotOf(rec), card);
    if (preview) expect(chipRow(before, preview).map((x) => x.to)).toEqual(row.map((x) => x.to));
  });

  it("with nothing chosen nothing is marked, and a perk card has no preview", async () => {
    const g = await memGame();
    const c = await g.actions.create("Cora", 0, 0);
    if (!c.ok) throw new Error(c.error);
    const s = api.sheetOf(g.store.doc.fighters[0]!);
    expect(chipRow(s, null).every((x) => !x.changed && x.from === x.to)).toBe(true);
    expect(previewSheet(api, api.snapshotOf(g.store.doc.fighters[0]!), { kind: "perk", perk: s.perks[0]! } as RouteCard)).toBeNull();
  });
});

describe("the Max HP chip stays readable while a card previews it (checker r2)", () => {
  it("keeps its dark face and light text under the preview state", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const cssText = readFileSync(fileURLToPath(new URL("../../src/screens/LevelUp/LevelUp.module.css", import.meta.url)), "utf8");
    const rule = /\.hpChip\.chipPreview\s*\{([^}]*)\}/.exec(cssText);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/background:\s*var\(--c-dark\)/);
    expect(rule![1]).toMatch(/color:\s*var\(--t-on-dark\)/);
    // and it comes after the plain preview rule, which sets the light face
    expect(cssText.indexOf(".hpChip.chipPreview")).toBeGreaterThan(cssText.indexOf("\n.chipPreview {"));
  });
});
