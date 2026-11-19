/**
 * The Ladder screen, the Locker's rank and Ladder button, and the boss prize screen render from a
 * real save (the ladder, plan 13.10 item 1).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { api } from "@rankzero/core";
import { GameContext } from "../../src/app/context";
import type { Game } from "../../src/app/context";
import { LocalRivalSource } from "../../src/state/opponents";
import { LadderScreen } from "../../src/screens/Ladder/Ladder";
import { LockerScreen } from "../../src/screens/Locker/Locker";
import { PrizeScreen } from "../../src/screens/Prize/Prize";
import { BOSS_LINES, RUNG_TITLE, rankLabel, rankTitle } from "../../src/text/ladder";
import { memGame } from "../state/helpers";

async function setup(picks: number, ladder?: { rank: number; prizes: [] }) {
  const g = await memGame();
  const c = await g.actions.create("Marla", 0, 0);
  if (!c.ok) throw new Error(c.error);
  await g.store.commit((doc) => ({ doc: { ...doc, fighters: doc.fighters.map((f) => ({ ...f, picks: Array.from({ length: picks }, () => "L" as const), xp: 0,
    ...(ladder !== undefined ? { ladder } : {}) })) }, value: undefined }));
  const game: Game = { store: g.store, actions: g.actions, clock: g.clock, core: api, opponents: new LocalRivalSource(),
    go: () => undefined, toast: () => undefined };
  const html = (node: React.ReactNode): string => renderToStaticMarkup(<GameContext.Provider value={game}>{node}</GameContext.Provider>);
  return { g, html };
}

describe("the ladder screens", () => {
  it("the Ladder lists the ten bosses, Rank 1 on top, with gates, and marks the first one ready at its gate", async () => {
    const { html } = await setup(2);
    const out = html(<LadderScreen />);
    const rungs = [...out.matchAll(/data-rung="(\d+)" data-state="(\w+)"/g)].map((m) => [Number(m[1]), m[2]]);
    expect(rungs.map((r) => r[0])).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(rungs.find((r) => r[0] === 1)![1]).toBe("ready");
    expect(rungs.filter((r) => r[1] === "locked").length).toBe(9);
    for (let rung = 1; rung <= 10; rung++) {
      expect(out).toContain(api.bossSnapshot(rung).name);
      expect(out).toContain(RUNG_TITLE[rung]!);
      expect(out).toContain(`Level ${api.bossGate(rung)}`);
    }
    expect(out).toContain("You: Rank Zero");
  });

  it("under the gate every boss is locked", async () => {
    const { html } = await setup(1);
    expect(html(<LadderScreen />)).not.toContain('data-state="ready"');
  });

  it("the Locker shows the rank under the name and the Ladder button with the next boss", async () => {
    const { html } = await setup(2);
    const out = html(<LockerScreen />);
    expect(out).toContain(`aria-label="${rankLabel(0)}, ${rankTitle(0)}"`);
    expect(out).toContain('data-testid="ladder-button"');
    expect(out).toContain(`Next: ${api.bossSnapshot(1).name}`);
  });

  it("with a prize waiting the Locker's main button is Claim prize and the prize screen deals two cards", async () => {
    const { html } = await setup(2, { rank: 1, prizes: [] });
    expect(html(<LockerScreen />)).toContain('data-primary="prize"');
    const out = html(<PrizeScreen />);
    expect(out).toContain("Boss prize");
    expect([...out.matchAll(/aria-pressed="false"/g)].length).toBe(2);
    expect(out).toContain("Rank 10");
  });

  it("every boss has its three lines", () => {
    for (let rung = 1; rung <= 10; rung++) {
      const l = BOSS_LINES[rung]!;
      expect(l.taunt.length * l.beaten.length * l.gloat.length).toBeGreaterThan(0);
    }
  });
});
