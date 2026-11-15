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

  it("credits every pack it uses, each with an allowed licence, a page and an author", () => {
    const full = JSON.parse(readFileSync(`${PUB}audio/sfx.json`, "utf8")) as {
      sources: { family: string; variant: number; files: string[] }[];
      credits: { pack: string; author: string; licence: string; page: string; fetched: string }[];
    };
    const allowed = new Set(["CC0 1.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 4.0"]);
    const packs = new Map(full.credits.map((c) => [c.pack, c]));
    for (const c of full.credits) {
      expect(allowed.has(c.licence), `${c.pack}: ${c.licence}`).toBe(true);
      expect(c.page, c.pack).toMatch(/^https:\/\//);
      expect(c.author.length, c.pack).toBeGreaterThan(0);
      expect(c.fetched, c.pack).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const s of full.sources) for (const f of s.files) expect(packs.has(f.split(":")[0]!), `${s.family}[${s.variant}] ${f}`).toBe(true);
    const n = Object.values(SFX_VARIANTS).reduce((a, b) => a + b, 0) + 4;
    expect(full.sources).toHaveLength(n);
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
