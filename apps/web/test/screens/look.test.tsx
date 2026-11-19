/**
 * The pick-your-look editor (content v3 batch 4, plan 13.12): every part named, every name list as
 * long as LOOK_SPACE, the editor steps and wraps each part, the swatches are the rig's own colours,
 * the Look screen renders the active scrapper's stored look, and setLook stores a look without
 * touching the stats.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOOK_SPACE, api } from "@rankzero/core";
import type { Look } from "@rankzero/core";
import { LOOK_SWATCHES, contentPack } from "@rankzero/rig";
import { GameContext } from "../../src/app/context";
import type { Game } from "../../src/app/context";
import { LocalRivalSource } from "../../src/state/opponents";
import { LookEditor, takeParts } from "../../src/screens/parts/LookEditor";
import { LookScreen } from "../../src/screens/Look/Look";
import { COLOUR_KEYS, LOOK_NAMES, LOOK_PART, SHAPE_KEYS } from "../../src/text/looks";
import { parseRoute, hrefOf } from "../../src/app/router";
import { memGame } from "../state/helpers";

const LOOK: Look = { build: 4, head: 9, hair: 17, face: 13, top: 15, bottom: 9, shoes: 7, accessory: 13, skin: 9, hairColor: 11, palette: 23 };

describe("the look editor's words", () => {
  it("names every shape part, a list as long as LOOK_SPACE, each name its own", () => {
    for (const k of SHAPE_KEYS) {
      expect(LOOK_NAMES[k].length, k).toBe(LOOK_SPACE[k]);
      expect(new Set(LOOK_NAMES[k]).size, k).toBe(LOOK_SPACE[k]);
    }
    expect([...SHAPE_KEYS, ...COLOUR_KEYS].sort()).toEqual(Object.keys(LOOK_SPACE).sort());
    for (const k of Object.keys(LOOK_SPACE)) expect(LOOK_PART[k as keyof typeof LOOK_SPACE]).toBeTruthy();
  });
  it("offers swatches that are the colours the rig paints with, as many as LOOK_SPACE", () => {
    expect(LOOK_SWATCHES.skin).toEqual(contentPack.looks.skin);
    expect(LOOK_SWATCHES.hairColor).toEqual(contentPack.looks.hairColor);
    expect(LOOK_SWATCHES.palettes).toEqual(contentPack.looks.palettes);
    expect([LOOK_SWATCHES.skin.length, LOOK_SWATCHES.hairColor.length, LOOK_SWATCHES.palettes.length]).toEqual([LOOK_SPACE.skin, LOOK_SPACE.hairColor, LOOK_SPACE.palette]);
  });
});

describe("the look editor", () => {
  it("shows every part's name and count, a previous and a next button per shape part, and a swatch per colour", () => {
    const out = renderToStaticMarkup(<LookEditor look={LOOK} onChange={() => undefined} />);
    for (const k of SHAPE_KEYS) {
      expect(out).toContain(`Previous ${LOOK_PART[k].toLowerCase()}`);
      expect(out).toContain(`Next ${LOOK_PART[k].toLowerCase()}`);
      expect(out).toContain(LOOK_NAMES[k][LOOK[k]]!.replace(/'/g, "&#x27;"));
      expect(out).toContain(`${LOOK[k] + 1} of ${LOOK_SPACE[k]}`);
    }
    for (const k of COLOUR_KEYS) expect((out.match(new RegExp(`data-testid="look-${k}-\\d+"`, "g")) ?? []).length, k).toBe(LOOK_SPACE[k]);
    expect((out.match(/aria-checked="true"/g) ?? []).length).toBe(3);
  });
  it("takes one half of a rolled look for a die, the other half kept", () => {
    const roll = api.rollLook(12345, 7, 9);
    const shape = takeParts(LOOK, roll, "shape");
    const colour = takeParts(LOOK, roll, "colour");
    for (const k of SHAPE_KEYS) { expect(shape[k]).toBe(roll[k]); expect(colour[k]).toBe(LOOK[k]); }
    for (const k of COLOUR_KEYS) { expect(shape[k]).toBe(LOOK[k]); expect(colour[k]).toBe(roll[k]); }
  });
  it("has its own route, #/look", () => {
    expect(parseRoute("#/look")).toEqual({ name: "look" });
    expect(hrefOf({ name: "look" })).toBe("#/look");
  });
});

describe("the Look screen and setLook", () => {
  it("opens on the active scrapper's stored look; setLook stores a new one and changes nothing else", async () => {
    const g = await memGame();
    const c = await g.actions.create("Marla", 0, 0, LOOK);
    if (!c.ok) throw new Error(c.error);
    expect(c.value.look).toEqual(LOOK);
    const game: Game = { store: g.store, actions: g.actions, clock: g.clock, core: api, opponents: new LocalRivalSource(), go: () => undefined, toast: () => undefined };
    const out = renderToStaticMarkup(<GameContext.Provider value={game}><LookScreen /></GameContext.Provider>);
    expect(out).toContain("Save look");
    expect(out).toContain(LOOK_NAMES.top[LOOK.top]!);
    const before = api.snapshotOf(g.store.doc.fighters[0]!);
    const next: Look = { ...LOOK, build: 3, hair: 11, palette: 0 };
    expect((await g.actions.setLook(c.value.id, next)).ok).toBe(true);
    const rec = g.store.doc.fighters[0]!;
    expect(rec.look).toEqual(next);
    expect({ ...api.snapshotOf(rec), look: before.look }).toEqual(before);
    expect(api.snapshotOf(rec).look).toEqual(next);
    expect((await g.actions.setLook("nobody", next)).ok).toBe(false);
  });
});
