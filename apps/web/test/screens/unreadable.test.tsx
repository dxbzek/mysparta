/** Review r2: the unreadable-save screen showed a developer key, had an unlabelled paste box, and
 *  "Start a new save" was the one-tap primary action. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { api } from "@rankzero/core";
import { GameContext } from "../../src/app/context";
import type { Game } from "../../src/app/context";
import { LocalRivalSource } from "../../src/state/opponents";
import { Unreadable } from "../../src/screens/Settings/Unreadable";
import { memGame } from "../state/helpers";

async function html(node: React.ReactNode): Promise<string> {
  const g = await memGame();
  const game: Game = { store: g.store, actions: g.actions, clock: g.clock, core: api, opponents: new LocalRivalSource(), go: () => undefined, toast: () => undefined };
  return renderToStaticMarkup(<GameContext.Provider value={game}>{node}</GameContext.Provider>);
}

describe("unreadable save screen", () => {
  it("speaks in plain words, never the storage key", async () => {
    const out = await html(<Unreadable backupKey="rankzero.backup.0" />);
    expect(out).not.toContain("rankzero.backup");
    expect(out).toContain("A copy of the damaged save is kept on this device.");
    // Settings > Backups lists only readable saves, so the damaged copy is never promised there
    expect(out).not.toContain("Settings");
  });
  it("the paste box has a visible label and a placeholder", async () => {
    const out = await html(<Unreadable backupKey="rankzero.backup.0" />);
    expect(out).toMatch(/<label[^>]*for="rz-recover-code"[^>]*>Paste a save code<\/label>/);
    expect(out).toMatch(/<textarea[^>]*id="rz-recover-code"/);
    expect(out).toMatch(/<textarea[^>]*placeholder="[^"]+"/);
  });
  it("starting over is not the primary action and asks first", async () => {
    const out = await html(<Unreadable backupKey="rankzero.backup.0" />);
    expect(out).not.toMatch(/_primary_[^"]*"[^>]*>Start a new save</);
    expect(out).toMatch(/_primary_[^"]*"[^>]*>Reload</);
  });
});
