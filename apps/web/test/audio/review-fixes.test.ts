/**
 * Review findings 9, 29-33, 42, 56, 59, 75: what each item sounds like, the pet voices in the
 * core sprite, loudness and onsets measured by the build, the app sounds and the credits.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPANION_IDS, WEAPON_IDS } from "@rankzero/core";
import type { Cue } from "@rankzero/stage";
import { soundFor } from "../../src/audio/cues";
import { DROP_SET, HIT_SET, THROW_SET, VOICE_SET, itemSet } from "../../src/audio/soundMap";
import { playUiSounds, uiSoundFor } from "../../src/audio/uiSounds";
import { UI } from "../../src/text/ui";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const PUB = fileURLToPath(new URL("../../public/", import.meta.url));
interface Entry { start: number; dur: number; f?: number }
const map = JSON.parse(readFileSync(`${PUB}audio/sfx.json`, "utf8")) as {
  sets: Record<string, Entry[]>; families: Record<string, string>;
  sources: { set: string; variant: number; files: string[]; loud: number; onset: number; peakAt: number }[];
  credits: { pack: string; name: string; author: string; licence: string; page: string }[];
};
const filesOf = (set: string): string[] => map.sources.filter((s) => s.set === set).flatMap((s) => s.files.map((f) => f.split(":").slice(1).join(":")));
const loudOf = (set: string): number[] => map.sources.filter((s) => s.set === set).map((s) => s.loud);

describe("what each item sounds like", () => {
  it("9: the steel folding chair hits with metal, never a wood knock", () => {
    const set = HIT_SET["folding-chair"];
    expect(set).not.toBe("hit-wood");
    expect(filesOf(set).some((f) => /metal/.test(f))).toBe(true);
    expect(filesOf(set).some((f) => /wood/.test(f))).toBe(false);
  });

  it("32: the pickaxe lands heavy, the pitchfork stabs, bricks drop like stone", () => {
    expect(HIT_SET.pickaxe).toBe("hit-heavy");
    expect(HIT_SET.pitchfork).toBe("hit-stab");
    expect(filesOf("hit-stab").some((f) => /blade|knife/i.test(f))).toBe(true);
    expect(DROP_SET.bricks).toBe("drop-stone");
    expect(filesOf("drop-stone").some((f) => /rock|stone/.test(f))).toBe(true);
  });

  it("30: every held item has a throw sound, and no throw (with or without an item) plays a sword", () => {
    for (const id of [...WEAPON_IDS, "fists" as const]) expect(THROW_SET[id], id).toBeDefined();
    for (const id of ["plastic-bottle", "rubber-ball", "traffic-cone", "broom"] as const) {
      expect(itemSet({ family: "throw", item: id }), id).not.toBeNull();
    }
    const throwSets = new Set([...Object.values(THROW_SET), map.families.throw!]);
    for (const set of throwSets) {
      if (set === "swish-light" || set === "swish-whip") continue;     // small blades and the chain keep their own swish
      expect(filesOf(set).some((f) => /sword/.test(f)), set).toBe(false);
    }
    // a Move's throw names no item: it plays the family's plain whoosh
    const moveThrow: Cue = { at: 0, step: 0, family: "throw", variant: 0 };
    const s = soundFor(moveThrow, (n) => map.sets[n]?.length ?? 0);
    expect(s?.name).toBe("throw");
    expect(filesOf(map.families.throw!).some((f) => /sword/.test(f))).toBe(false);
  });

  it("31: a pet's bite, peck or swipe is its own sound, never a human punch", () => {
    for (const id of COMPANION_IDS) {
      expect(HIT_SET[id], id).not.toBe("hit-fist");
      expect(map.sets[HIT_SET[id]]?.length, id).toBeGreaterThan(0);
    }
    expect(HIT_SET["stray-dog"]).not.toBe(HIT_SET.crow);
    expect(HIT_SET["alley-cat"]).not.toBe(HIT_SET.goose);
  });

  it("33: the knife hit is within 2 dB of a punch and has a body thud under it", () => {
    const punch = Math.max(...loudOf("hit-fist"));
    for (const l of loudOf("hit-blade-small")) expect(l).toBeGreaterThanOrEqual(punch - 2);
    expect(map.sources.filter((s) => s.set === "hit-blade-small").every((s) => s.files.some((f) => /Punch/.test(f)))).toBe(true);
  });
});

describe("pet voices", () => {
  it("29: every pet's voice is in the core sprite, so no pet borrows the dog's bark while the content loads", () => {
    for (const id of COMPANION_IDS) {
      const set = VOICE_SET[id];
      expect(map.sets[set]?.length, id).toBeGreaterThan(0);
      for (const e of map.sets[set]!) expect(e.f ?? 0, `${id} -> ${set}`).toBe(0);
      const cue: Cue = { at: 0, step: 0, family: "companion", variant: 0, item: id };
      // only the core is in: the pet's own voice still plays
      const coreOnly = (n: string): number => (map.sets[n]?.every((e) => (e.f ?? 0) === 0) ? map.sets[n]!.length : 0);
      expect(soundFor(cue, coreOnly)?.name, id).toBe(set);
    }
  });

  it("56: every pet voice is plainly heard within 15 ms of its cue", () => {
    for (const s of map.sources.filter((x) => x.set.startsWith("voice-"))) {
      expect(s.onset, `${s.set}[${s.variant}]`).toBeLessThanOrEqual(15);
    }
  });
});

describe("app sounds (59)", () => {
  const btn = (attrs: Record<string, string> = {}, quiet = false) => ({
    closest: (sel: string) => {
      if (sel === "[data-sfx-quiet]") return quiet ? {} : null;
      return { getAttribute: (n: string) => attrs[n] ?? null };
    },
  });

  it("a button taps, a level-up card flips, the fight screen stays quiet", () => {
    expect(uiSoundFor(btn())).toBe("ui-tap");
    expect(uiSoundFor(btn({ "data-sfx": "card-flip" }))).toBe("card-flip");
    expect(uiSoundFor(btn({}, true))).toBeNull();
    expect(uiSoundFor({ closest: () => null })).toBeNull();
    expect(uiSoundFor(null)).toBeNull();
  });

  it("clicks under the root play through the engine; the remover stops it", () => {
    const heard: string[] = [];
    let handler: ((e: Event) => void) | null = null;
    const root = { addEventListener: (_: string, f: (e: Event) => void) => { handler = f; }, removeEventListener: () => { handler = null; } };
    const off = playUiSounds({ play: (n) => { heard.push(n); return true; } }, root as unknown as EventTarget);
    handler!({ target: btn({ "data-sfx": "card-flip" }) } as unknown as Event);
    handler!({ target: btn() } as unknown as Event);
    expect(heard).toEqual(["card-flip", "ui-tap"]);
    off();
    expect(handler).toBeNull();
  });

  it("the three app sounds are in the core sprite", () => {
    for (const n of ["ui-tap", "card-flip", "level-up"]) {
      expect(map.sets[map.families[n]!]?.every((e) => (e.f ?? 0) === 0), n).toBe(true);
    }
  });
});

describe("credits", () => {
  const inApp = UI.settings.creditsLines.join("\n");

  it("42: the in-app credits name every sound author, and every CC BY or Envato pack with its licence", () => {
    for (const c of map.credits) {
      expect(inApp, c.author).toContain(c.author.replace(/ \(submitted by .*\)$/, ""));
      if (c.licence !== "CC0 1.0") {
        expect(inApp, c.licence).toContain(c.licence);
        expect(inApp, c.name).toContain(c.name.replace(/ \(.*\)$/, ""));
      }
    }
    expect(inApp).not.toMatch(/Kenney sound packs, CC0\.$/m);
  });

  it("75: CREDITS.md lists both fonts and every sound file the sprite uses", () => {
    const md = readFileSync(`${ROOT}CREDITS.md`, "utf8");
    expect(md).not.toContain("No font is in the repo yet");
    for (const f of ["display.woff2", "body.woff2", "OFL-BigShouldersDisplay.txt", "OFL-Inter.txt"]) expect(md, f).toContain(f);
    for (const s of map.sources) for (const f of s.files) {
      const name = f.split(":").slice(1).join(":").split("/").pop()!;
      expect(md, f).toContain(name);
    }
  });
});
