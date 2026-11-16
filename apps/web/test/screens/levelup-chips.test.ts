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
