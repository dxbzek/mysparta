/**
 * The shipped sound sprite and fonts: sizes within budget (brief 3.16), the sprite map in step
 * with the stage contract's variant table, licence files beside the fonts.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SFX_VARIANTS } from "@rankzero/stage";

const PUB = fileURLToPath(new URL("../../public/", import.meta.url));
const KB = 1024;

describe("audio sprite", () => {
  const map = JSON.parse(readFileSync(`${PUB}audio/sfx.json`, "utf8")) as { families: Record<string, { start: number; dur: number }[]> };

  it("is 300 KB or less", () => {
    expect(statSync(`${PUB}audio/sfx.mp3`).size).toBeLessThanOrEqual(300 * KB);
  });

  it("has exactly SFX_VARIANTS sounds per fight family, plus the three app sounds", () => {
    for (const [family, n] of Object.entries(SFX_VARIANTS)) expect(map.families[family], family).toHaveLength(n);
    expect(map.families["ui-tap"]).toHaveLength(2);
    expect(map.families["card-flip"]).toHaveLength(1);
    expect(map.families["level-up"]).toHaveLength(1);
  });

  it("sounds do not overlap and have length", () => {
    const all = Object.values(map.families).flat().sort((p, q) => p.start - q.start);
    for (let i = 0; i < all.length; i++) {
      expect(all[i]!.dur).toBeGreaterThan(20);
      if (i > 0) expect(all[i]!.start).toBeGreaterThanOrEqual(all[i - 1]!.start + all[i - 1]!.dur);
    }
  });
});

describe("fonts", () => {
  it("two woff2 files, 60 KB or less together", () => {
    const total = statSync(`${PUB}fonts/display.woff2`).size + statSync(`${PUB}fonts/body.woff2`).size;
    expect(total).toBeLessThanOrEqual(60 * KB);
  });
  it("ship their licence files", () => {
    for (const f of ["OFL-BigShouldersDisplay.txt", "OFL-Inter.txt"]) {
      expect(existsSync(`${PUB}fonts/${f}`), f).toBe(true);
      expect(readFileSync(`${PUB}fonts/${f}`, "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
  });
});
