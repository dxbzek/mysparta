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
import { BAG_SHOWN, BagStrip, SideBag, bagView } from "../../src/fight/BagStrip";
import { beatsOf, litAt } from "../../src/fight/beats";
import { FighterCard, cardInfo } from "../../src/fight/FighterCard";
import { Hud, hitGlow } from "../../src/fight/Hud";
import { LiveLine, stripParts, stripSteps } from "../../src/fight/LogStrip";
import { StageOverlay } from "../../src/fight/StageOverlay";
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

  it("labels the two HP numbers in their side colours with an HP divider, so they never read as a score (review r2)", () => {
    const html = renderToStaticMarkup(<Hud frame={player.hud(0)} sides={sides} actors={log.init.actors} />);
    expect(html).toMatch(/class="[^"]*hpNumA[^"]*"[^>]*data-hp=/);
    expect(html).toMatch(/class="[^"]*hpNumB[^"]*"[^>]*data-hp=/);
    expect(html).toMatch(/data-hp="\d+">\d+<\/span><span class="[^"]*hpSep[^"]*" aria-hidden="true">HP<\/span>/);
    expect(html).toContain(`aria-label="${a.name} ${Math.round(player.hud(0).hp.a0!.now)} HP, ${b.name} ${Math.round(player.hud(0).hp.b0!.now)} HP"`);
  });

  it("slaps the name stickers on with namesIn, not a timer", () => {
    const at = (namesIn: number) => renderToStaticMarkup(<Hud frame={{ ...player.hud(0), namesIn }} sides={sides} actors={log.init.actors} />);
    expect(at(0)).toContain("opacity:0");
    expect(at(1)).not.toContain("opacity");
  });

  it("shows the turn badge and lights a bar that was just hit, which never shakes (calm fight)", () => {
    const frame: HudFrame = { hp: { a0: { now: 30, trail: 45, max: 60 }, b0: { now: 50, trail: 50, max: 50 } }, bag: { a: [], b: [] },
      stepsShown: 0, phase: "bout", winner: null, namesIn: 1, resultIn: 0 };
    const actors = [{ id: "a0" as const, kind: "scrapper" as const, maxHp: 60 }, { id: "b0" as const, kind: "scrapper" as const, maxHp: 50 }];
    const html = renderToStaticMarkup(<Hud frame={frame} sides={sides} actors={actors} t={100} turn={7} />);
    expect(html).toContain("Turn 7");
    expect(html).not.toContain("translateX(");
    expect(html).not.toContain("scale(");
    expect(html).toContain("opacity:");
    expect(renderToStaticMarkup(<Hud frame={frame} sides={sides} actors={actors} t={100} turn={7} reduced />)).not.toContain("translateX(");
    expect(hitGlow(30, 45, 60)).toBe(1);
    expect(hitGlow(50, 50, 50)).toBe(0);
  });
});

describe("FighterCard", () => {
  const cards = { a: cardInfo("a", a, log.init.actors), b: cardInfo("b", b, log.init.actors) };
  const pets = log.init.actors.filter((x) => x.kind !== "scrapper");

  it.each([0, 2000, 9000, player.timeline.durationMs])("shows the frame's HP and every pet's own HP bar at t = %i", (t) => {
    const frame = player.hud(t);
    const state = player.state(t);
    for (const side of ["a", "b"] as const) {
      const html = renderToStaticMarkup(<FighterCard info={cards[side]} frame={frame} state={state.actors[`${side}0`]}
        pets={cards[side].pets.map((p) => state.actors[p.id])} bag={frame.bag[side]} lit={new Map()} pulse={0} />);
      expect(html).toContain(`data-card-hp="${Math.max(0, Math.round(frame.hp[`${side}0`]!.now))}"`);
      expect(count(html, /role="meter"/g)).toBe(cards[side].pets.length);
      for (const p of cards[side].pets) expect(html).toContain(`aria-valuenow="${Math.max(0, Math.round(frame.hp[p.id]!.now))}"`);
      expect(html).toContain(`data-count="${frame.bag[side].length}"`);
    }
    expect(pets.length).toBeGreaterThan(0);
  });

  it("lights a skill tile only when the beats say it fired", () => {
    const id = cards.a.skills[0] ?? cards.b.skills[0];
    const side = cards.a.skills[0] ? "a" : "b";
    expect(id).toBeDefined();
    const frame = player.hud(5000);
    const props = { info: cards[side], frame, state: undefined, pets: [], bag: [] as BagItem[], pulse: 1 };
    expect(renderToStaticMarkup(<FighterCard {...props} lit={new Map()} />)).not.toContain('data-lit="1"');
    expect(renderToStaticMarkup(<FighterCard {...props} lit={new Map([[`${side}:${id!}`, 1]])} />)).toContain('data-lit="1"');
  });
});

describe("beats", () => {
  const beats = beatsOf(log, player.timeline);
  it("finds every Move and skill that fires, in time order", () => {
    const moves = log.steps.filter((s) => s.t === "move").length;
    expect(beats.fires.filter((f) => f.kind === "move")).toHaveLength(moves);
    for (let i = 1; i < beats.fires.length; i++) expect(beats.fires[i]!.at).toBeGreaterThanOrEqual(beats.fires[i - 1]!.at);
  });
  it("the overlay is a pure function of t", () => {
    const at = (t: number) => renderToStaticMarkup(<StageOverlay beats={beats} t={t} reduced={false} />);
    for (const t of [0, 3000, 9000, player.timeline.durationMs]) expect(at(t)).toBe(at(t));
    // a Move has no banner (owner: "It should just show"): its name is a small tag on the stage
    // and its tile lights on the card
    for (const f of beats.fires.filter((x) => x.kind === "move")) {
      for (const d of [0, 40, 300, 900]) {
        expect(at(f.at + d)).not.toContain("data-move");
        expect(at(f.at + d)).not.toContain('role="img"');
      }
      expect(litAt(beats, f.at + 300).get(`${f.side}:${f.id}`) ?? 0).toBeGreaterThan(0);
    }
    if (beats.koAt !== null) expect(at(beats.koAt + 600)).toContain("K.O.");
  });
});

describe("BagStrip and the card's bag", () => {
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

  // Finding 60: the chip used to share nine equal cells and "+43" was cut to "+4"; it now gets the
  // width its number needs, after eight equal icon cells.
  it("the card's bag shows 8 icons and a +4 chip sized to its number, so it never overflows", () => {
    const twelve: BagItem[] = [
      ...(["pipe", "bat", "crowbar", "shovel", "darts", "bricks", "rebar", "umbrella", "broom"] as const).map((id) => ({ k: "weapon" as const, id })),
      { k: "move", id: "tarp", uses: 1 }, { k: "move", id: "firecrackers", uses: 2 }, { k: "move", id: "haymaker", uses: 1 },
    ];
    const html = renderToStaticMarkup(<SideBag side="a" bag={twelve} owner="A" compact />);
    expect(count(html, /role="img"/g)).toBe(8);
    expect(html).toContain('data-more="4"');
    const css = readFileSync(new URL("../../src/fight/fight.module.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.cardBag \{[^}]*grid-template-columns: repeat\(8, minmax\(0, 1fr\)\) auto/);
    expect(css).toMatch(/\.cardBag \.chip \{[^}]*width: auto/);
    expect(css).toMatch(/\.cardBag > \* \{[^}]*width: 100%/);
  });

  it("fits 8 icons and the chip in half of a 390 px screen (the strip)", () => {
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

describe("LiveLine (the log's live region; nothing of the log shows under the stage since 19 Nov 2026)", () => {
  it.each([0, 1, 5, 20, log.steps.length])("reads the newest of the first %i steps, visually hidden", (n) => {
    const html = renderToStaticMarkup(<LiveLine steps={log.steps} stepsShown={n} names={names} live />);
    expect(stripSteps(log.steps, n)).toHaveLength(Math.min(2, n));
    expect(html).toMatch(/^<p class="rz-visually-hidden" aria-live="polite" aria-atomic="true"/);
    if (n > 0) expect(html).toContain(stripParts(log.steps[n - 1]!, names).map((p) => p.text).join("").slice(0, 12).replace(/'/g, "&#x27;"));
  });
  it("is silent when the setting is off", () => {
    expect(renderToStaticMarkup(<LiveLine steps={log.steps} stepsShown={3} names={names} live={false} />)).toContain('aria-live="off"');
  });
});

describe("the HUD over the stage opens a fighter's card", () => {
  it("each side's name and HP bar is one button naming the fighter, when the host passes onCard", () => {
    const html = renderToStaticMarkup(<Hud frame={player.hud(0)} sides={sides} actors={log.init.actors} onCard={() => undefined} />);
    expect(count(html, /<button type="button"[^>]*data-side="[ab]"/g)).toBe(2);
    expect(html).toContain(`aria-label="${a.name}, LV ${a.level}, `);
    expect(html).toContain("Open the fighter card.");
    // the meters are still there for the HP check
    expect(count(html, /role="meter"/g)).toBe(2);
  });
  it("without onCard the HUD is plain (the debug page)", () => {
    expect(renderToStaticMarkup(<Hud frame={player.hud(0)} sides={sides} actors={log.init.actors} />)).not.toContain("<button");
  });
});

describe("the HUD parts read no clock of their own", () => {
  it.each(["Hud.tsx", "BagStrip.tsx", "TextLog.tsx", "ResultCard.tsx", "FighterCard.tsx", "LogStrip.tsx", "StageOverlay.tsx", "beats.ts"])("%s", (file) => {
    const src = readFileSync(new URL(`../../src/fight/${file}`, import.meta.url), "utf8");
    expect(src).not.toMatch(/performance\.now|Date\.|new Date|requestAnimationFrame|useState|useEffect|setTimeout|setInterval/);
  });
});
