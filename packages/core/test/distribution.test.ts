import { describe, expect, it } from "vitest";
import { applyDraft, createChampion, generateDraft } from "../src/index.js";
import type { FateOffer } from "../src/index.js";

describe("draft distribution audit", () => {
  it("offers a healthy mix of stats, weapons, skills and beasts", () => {
    const tally: Record<FateOffer["kind"], number> = { stat3: 0, stat21: 0, weapon: 0, skill: 0, beast: 0 };
    const picksTally: Record<FateOffer["kind"], number> = { stat3: 0, stat21: 0, weapon: 0, skill: 0, beast: 0 };
    let drafts = 0;

    for (let i = 0; i < 200; i++) {
      const c = createChampion(`AuditChamp${i}`);
      for (let level = 2; level <= 30; level++) {
        const offers = generateDraft(c, level, 0);
        drafts++;
        for (const o of offers) tally[o.kind]++;
        // pick pseudo-randomly but deterministically, favouring variety
        const pick = (i + level) % 3;
        picksTally[offers[pick]!.kind]++;
        applyDraft(c, offers, pick, false);
      }
    }

    const total = drafts * 3;
    const pct = Object.fromEntries(
      Object.entries(tally).map(([k, v]) => [k, Math.round((v / total) * 1000) / 10]),
    );
    // eslint-disable-next-line no-console
    console.log(`drafts=${drafts} offers=${total} → offered %:`, pct, "| taken:", picksTally);

    // Every category genuinely appears, at plausible rates.
    expect(tally.stat3).toBeGreaterThan(total * 0.15);
    expect(tally.stat21).toBeGreaterThan(total * 0.15);
    expect(tally.weapon).toBeGreaterThan(total * 0.1);
    expect(tally.skill).toBeGreaterThan(total * 0.08);
    expect(tally.beast).toBeGreaterThan(total * 0.02);
  });
});
