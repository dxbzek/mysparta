/**
 * The app screens render from a real save, show what the brief asks of them, and use only the
 * tokens of tokens.css for colour.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PERK_IDS, api } from "@rankzero/core";
import { GameContext } from "../../src/app/context";
import type { Game } from "../../src/app/context";
import { LocalRivalSource } from "../../src/state/opponents";
import { KitScreen } from "../../src/screens/Kit/Kit";
import { LevelUpScreen } from "../../src/screens/LevelUp/LevelUp";
import { LockerScreen } from "../../src/screens/Locker/Locker";
import { BoutsScreen } from "../../src/screens/Bouts/Bouts";
import { CreateScreen } from "../../src/screens/Create/Create";
import { perkText } from "../../src/text/perks";
import { DERIVED_NAME } from "../../src/text/stats";
import { memGame, playUntilLevelUp } from "../state/helpers";

async function setup() {
  const g = await memGame();
  const c = await g.actions.create("Marla", 0, 0);
  if (!c.ok) throw new Error(c.error);
  const game: Game = { store: g.store, actions: g.actions, clock: g.clock, core: api, opponents: new LocalRivalSource(),
    go: () => undefined, toast: () => undefined };
  const html = (node: React.ReactNode): string => renderToStaticMarkup(<GameContext.Provider value={game}>{node}</GameContext.Provider>);
  return { g, id: c.value.id, html };
}

describe("screens", () => {
  it("Create shows the plain labels and the three lines", async () => {
    const { html } = await setup();
    const out = html(<CreateScreen />);
    for (const s of ["Step into the Yard", "Shape", "Colours", "Random name", "Your name decides your scrapper."]) expect(out).toContain(s);
  });

  it("the name field stops at 14 characters and counts them live; an empty field previews the placeholder it submits (findings 64, 65)", async () => {
    const { html } = await setup();
    const out = html(<CreateScreen />);
    expect(out).toMatch(/id="rz-name"[^>]*maxLength="14"|maxLength="14"[^>]*id="rz-name"/i);
    expect(out).toContain("0 / 14");
    const placeholder = /placeholder="([^"]+)"/.exec(out)![1]!;
    expect(out).toContain(`aria-label="${placeholder}, idling under the lights"`);
    expect(api.checkName(placeholder).ok).toBe(true);
  });

  it("the Kit shows every owned perk with its name, rarity word and table-built line", async () => {
    const { g, id, html } = await setup();
    const perks = api.sheetOf(g.store.doc.fighters[0]!).perks;
    const out = html(<KitScreen tab="kit" />);
    for (const p of perks) {
      const t = perkText(p);
      expect(out).toContain(t.name);
      expect(out).toContain(t.rarityWord);
      expect(out).toContain(t.effect.replace(/'/g, "&#x27;"));
    }
    expect(out).toContain(`Found ${perks.length} of ${PERK_IDS.length}`);
    for (const s of ["Weapons", "Skills", "Pets", "Level path", "Retire this scrapper"]) expect(out).toContain(s);
    void id;
  });

  it("the Stats tab shows max HP, the four stats and all ten fight values", async () => {
    const { g, html } = await setup();
    const sheet = api.sheetOf(g.store.doc.fighters[0]!);
    const out = html(<KitScreen tab="stats" />);
    expect(out).toContain(`>${sheet.maxHp}<`);
    for (const s of ["Health", "Strength", "Agility", "Speed"]) expect(out).toContain(s);
    for (const name of Object.values(DERIVED_NAME)) expect(out).toContain(`>${name}<`);
    expect(out).toContain("How bouts work");
  });

  it("the Level path shows Start and, after a level-up, the taken and the not-taken card", async () => {
    const { g, id, html } = await setup();
    await playUntilLevelUp(g, id);
    await g.actions.takeLevelUp(id, "L");
    const out = html(<KitScreen tab="route" />);
    expect(out).toContain(">Start<");
    expect(out).toContain("aria-label=\"Taken:");
    expect(out).toContain("aria-label=\"Not taken:");
  });

  it("the level-up screen offers two cards and Take it, and the Locker says Level up!", async () => {
    const { g, id, html } = await setup();
    await playUntilLevelUp(g, id);
    expect(html(<LockerScreen />)).toContain("Level up!");
    const out = html(<LevelUpScreen />);
    expect((out.match(/Select this card\./g) ?? []).length).toBe(2);
    expect(out).toContain("Take it");
    expect(html(<BoutsScreen />)).toMatch(/Replay the bout with/);
  });

  it("a History row puts the rival's level in its own unbreakable chip (review r2: 'LEVEL' / '3' orphan)", async () => {
    const { g, id, html } = await setup();
    await playUntilLevelUp(g, id);
    const out = html(<BoutsScreen />);
    expect(out).toMatch(/aria-label="[^"]+, level \d+"/);
    expect(out).toMatch(/class="[^"]*_lv_[^"]*" aria-hidden="true">LV \d+</);
  });
});

describe("colours only from tokens.css", () => {
  const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
  const files = ["app", "screens"].flatMap((d) => walk(join(SRC, d))).filter((f) => /\.(css|tsx?)$/.test(f));
  it.each(files.map((f) => [f.slice(SRC.length)]))("%s has no colour literal", (rel) => {
    const lines = readFileSync(join(SRC, rel), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && COLOUR.test(l));
    expect(lines).toEqual([]);
  });
});
