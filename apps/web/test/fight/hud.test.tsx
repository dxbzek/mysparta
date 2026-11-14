/**
 * The HUD, the bag strip and the text log render from `hud(t)` only (plan, WP4 gate).
 * Rendered to markup in Node with a real player on the capsule rig, at many times: every number
 * on screen is the frame's number. Plus the 12-item bag: 8 icons and "+4".
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stageFor } from "@rankzero/core";
import type { BagItem } from "@rankzero/core";
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import { capsuleRig } from "@rankzero/rig/testing";
import { createFightPlayer } from "@rankzero/stage";
import type { HudFrame } from "@rankzero/stage";
import { BAG_SHOWN, BagStrip, bagView } from "../../src/fight/BagStrip";
import { Hud } from "../../src/fight/Hud";
import { TextLog, logLines } from "../../src/fight/TextLog";
import { actorNames } from "../../src/text/log";
import { STAGE_TEXT } from "../../src/text/stage";
import { STAGE_FONTS } from "../../src/ui/fonts";

const { log, a, b } = BOUT_FIXTURES["bout-all-steps"];
const player = createFightPlayer(log, a, b, capsuleRig, { reducedMotion: false, cosmeticSeed: log.seed, stage: stageFor(log.seed), text: STAGE_TEXT, fonts: STAGE_FONTS });
const sides = { a: { name: a.name, level: a.level }, b: { name: b.name, level: b.level } };
const names = actorNames(log.init, a, b);
const count = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

describe("Hud", () => {
  const times = Array.from({ length: 40 }, (_, i) => Math.round((i / 39) * player.timeline.durationMs));

  it.each(times)("shows the frame's HP at t = %i", (t) => {
    const frame = player.hud(t);
    const html = renderToStaticMarkup(<Hud frame={frame} sides={sides} actors={log.init.actors} />);
    for (const side of ["a", "b"] as const) {
      const hp = frame.hp[`${side}0`]!;
      expect(html).toContain(`data-hp="${Math.max(0, Math.round(hp.now))}"`);
      expect(html).toContain(`aria-valuemax="${hp.max}"`);
    }
  });

  it("is a pure function of the frame: a made-up frame shows made-up values", () => {
    const frame: HudFrame = { hp: { a0: { now: 12.4, trail: 30, max: 60 }, b0: { now: 0, trail: 0, max: 50 } }, bag: { a: [], b: [] },
      stepsShown: 0, phase: "bout", winner: null, namesIn: 1, resultIn: 0 };
    const html = renderToStaticMarkup(<Hud frame={frame} sides={sides} actors={[{ id: "a0", kind: "scrapper", maxHp: 60 }, { id: "b0", kind: "scrapper", maxHp: 50 }]} />);
    expect(html).toContain('data-hp="12"');
    expect(html).toContain('data-hp="0"');
    expect(html).toContain("width:20.67%");   // 12.4 of 60
    expect(html).toContain("width:50.00%");   // the trail, 30 of 60
  });

  it("slaps the name stickers on with namesIn, not a timer", () => {
    const at = (namesIn: number) => renderToStaticMarkup(<Hud frame={{ ...player.hud(0), namesIn }} sides={sides} actors={log.init.actors} />);
    expect(at(0)).toContain("opacity:0");
    expect(at(1)).not.toContain("opacity");
  });

  it("shows small HP bars for companions", () => {
    const html = renderToStaticMarkup(<Hud frame={player.hud(2000)} sides={sides} actors={log.init.actors} />);
    const pets = log.init.actors.filter((x) => x.kind !== "scrapper").length;
    expect(pets).toBeGreaterThan(0);
    expect(count(html, /role="meter"/g)).toBe(2 + pets);
  });
});

describe("BagStrip", () => {
  it.each([0, 3000, 8000, player.timeline.durationMs])("shows the frame's bag at t = %i", (t) => {
    const frame = player.hud(t);
    const html = renderToStaticMarkup(<BagStrip bag={frame.bag} names={{ a: a.name, b: b.name }} />);
    expect(html).toContain(`data-count="${frame.bag.a.length}"`);
    expect(html).toContain(`data-count="${frame.bag.b.length}"`);
  });

  it("a 12-item bag shows 8 icons and a +4 chip", () => {
    const twelve: BagItem[] = [
      ...(["pipe", "bat", "crowbar", "shovel", "darts", "bricks", "rebar", "umbrella", "broom"] as const).map((id) => ({ k: "weapon" as const, id })),
      { k: "move", id: "tarp", uses: 1 }, { k: "move", id: "firecrackers", uses: 2 }, { k: "move", id: "haymaker", uses: 1 },
    ];
    expect(bagView(twelve).shown).toHaveLength(BAG_SHOWN);
    expect(bagView(twelve).more).toBe(4);
    const html = renderToStaticMarkup(<BagStrip bag={{ a: twelve, b: [] }} names={{ a: "A", b: "B" }} />);
    const sideA = html.slice(html.indexOf('data-side="a"'), html.indexOf('data-side="b"'));
    expect(count(sideA, /role="img"/g)).toBe(8);
    expect(sideA).toContain('data-more="4"');
    expect(sideA).toContain(">+4<");
  });

  it("fits 8 icons and the chip in half of a 390 px screen", () => {
    // fight.module.css: icons 20 px, 1 px gaps, chip 21 px + 2 px margin, strip padding 3 px a side
    const half = (390 - 2 * 3) / 2;
    expect(8 * 20 + 8 * 1 + 21 + 2).toBeLessThanOrEqual(half);
    const css = readFileSync(new URL("../../src/fight/fight.module.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.bag \{[^}]*padding: 0 3px/);
    expect(css).toMatch(/\.bagSide \{[^}]*gap: 1px/);
    expect(css).toMatch(/\.chip \{[^}]*width: 21px[^}]*margin: 0 1px/);
  });
});

describe("TextLog", () => {
  it.each([0, 1, 5, 20, log.steps.length])("shows exactly the first %i steps, newest first", (n) => {
    const lines = logLines(log.steps, n, names);
    expect(lines).toHaveLength(n);
    if (n > 0) expect(lines[0]).toBe(logLines(log.steps, n, names)[0]);
    const html = renderToStaticMarkup(<TextLog steps={log.steps} stepsShown={n} names={names} live />);
    expect(count(html, /<li /g)).toBe(n);
  });

  it("follows hud(t).stepsShown and nothing else", () => {
    for (const t of [0, 1600, 5000, 12000, player.timeline.durationMs]) {
      const shown = player.hud(t).stepsShown;
      const html = renderToStaticMarkup(<TextLog steps={log.steps} stepsShown={shown} names={names} live={false} />);
      expect(count(html, /<li /g)).toBe(shown);
      expect(html).toContain('aria-live="off"');
    }
  });
});

describe("the HUD parts read no clock of their own", () => {
  it.each(["Hud.tsx", "BagStrip.tsx", "TextLog.tsx", "ResultCard.tsx"])("%s", (file) => {
    const src = readFileSync(new URL(`../../src/fight/${file}`, import.meta.url), "utf8");
    expect(src).not.toMatch(/performance\.now|Date\.|new Date|requestAnimationFrame|useState|useEffect|setTimeout|setInterval/);
  });
});
