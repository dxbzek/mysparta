/**
 * The shipped sound sprites and fonts: sizes within budget (brief 3.16), the sprite map in step
 * with the stage contract's families and with the per-item sound map, licence files beside the
 * fonts.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, SHIELD_IDS, WEAPON_IDS } from "@rankzero/core";
import { SFX_VARIANTS } from "@rankzero/stage";
import type { Cue } from "@rankzero/stage";
import { BLOCK_SET, HIT_SET, VOICE_SET, itemSet, setsUsed } from "../../src/audio/soundMap";

const PUB = fileURLToPath(new URL("../../public/", import.meta.url));
const KB = 1024;

interface Entry { start: number; dur: number; f?: number }
const map = JSON.parse(readFileSync(`${PUB}audio/sfx.json`, "utf8")) as {
  version: number; files: string[]; sets: Record<string, Entry[]>; families: Record<string, string>;
  sources: { set: string; variant: number; files: string[] }[];
  credits: { pack: string; author: string; licence: string; page: string; fetched: string }[];
};

describe("audio sprites", () => {
  it("are two files, the core and the content, each 300 KB or less", () => {
    expect(map.version).toBe(2);
    expect(map.files).toEqual(["sfx.mp3", "sfx-content.mp3"]);
    for (const f of map.files) expect(statSync(`${PUB}audio/${f}`).size, f).toBeLessThanOrEqual(300 * KB);
  });

  it("give every stage family and app sound a set in the core sprite", () => {
    for (const name of [...Object.keys(SFX_VARIANTS), "ui-tap", "card-flip", "level-up"]) {
      const set = map.families[name];
      expect(set, name).toBeDefined();
      expect(map.sets[set!]?.length, `${name} -> ${set}`).toBeGreaterThan(0);
      for (const e of map.sets[set!]!) expect(e.f ?? 0, `${name} -> ${set}`).toBe(0);
    }
  });

  it("hold every set the per-item sound map uses", () => {
    for (const s of setsUsed()) expect(map.sets[s]?.length, s).toBeGreaterThan(0);
  });

  it("give each weapon, shield and pet its own sound, and a knife never sounds like a pipe", () => {
    for (const id of WEAPON_IDS) expect(HIT_SET[id], id).toBeDefined();
    for (const id of SHIELD_IDS) expect(BLOCK_SET[id], id).toBeDefined();
    for (const id of COMPANION_IDS) expect(VOICE_SET[id], id).toBeDefined();
    const hit = (item: Cue["item"], family: Cue["family"]) => itemSet({ family, item, on: "body" });
    expect(hit("pocket-knife", "blade")).toBe("hit-blade-small");
    expect(hit("pipe", "blunt")).toBe("hit-pipe");
    expect(hit("sledgehammer", "blunt")).not.toBe(hit("pipe", "blunt"));
    expect(hit("rubber-chicken", "blunt")).toBe("hit-squeak");
    expect(itemSet({ family: "block", item: "car-door", on: "shield" })).toBe("block-sheet");
    expect(itemSet({ family: "block", item: "riot-shield", on: "shield" })).not.toBe("block-sheet");
    expect(itemSet({ family: "companion", item: "goose" })).toBe("voice-goose");
  });

  it("credits every pack it uses, each with an allowed licence, a page and an author", () => {
    const allowed = new Set(["CC0 1.0", "CC BY 3.0", "CC BY 4.0"]);
    const packs = new Map(map.credits.map((c) => [c.pack, c]));
    for (const c of map.credits) {
      expect(allowed.has(c.licence), `${c.pack}: ${c.licence}`).toBe(true);
      expect(c.page, c.pack).toMatch(/^https:\/\//);
      expect(c.author.length, c.pack).toBeGreaterThan(0);
      expect(c.fetched, c.pack).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const s of map.sources) for (const f of s.files) expect(packs.has(f.split(":")[0]!), `${s.set}[${s.variant}] ${f}`).toBe(true);
    expect(map.sources).toHaveLength(Object.values(map.sets).flat().length);
  });

  it("sounds do not overlap inside a file and have length", () => {
    map.files.forEach((_, f) => {
      const all = Object.values(map.sets).flat().filter((e) => (e.f ?? 0) === f).sort((p, q) => p.start - q.start);
      for (let i = 0; i < all.length; i++) {
        expect(all[i]!.dur).toBeGreaterThan(20);
        if (i > 0) expect(all[i]!.start).toBeGreaterThanOrEqual(all[i - 1]!.start + all[i - 1]!.dur);
      }
    });
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
