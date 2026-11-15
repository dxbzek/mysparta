/**
 * Replay of a bout with no stored log (15 November review, finding 70): it is played again only
 * when the rebuilt result equals the stored one, so a bout made by an older sim is refused instead
 * of showing a different fight.
 */
import { describe, expect, it, vi } from "vitest";
import { api } from "@rankzero/core";
import { l1Knife, l1Pipe } from "@rankzero/core/fixtures";
import type { BoutRecord } from "../../src/contracts";
import { replayLog } from "../../src/screens/Replay/Replay";

function row(over: Partial<BoutRecord>): BoutRecord {
  const log = api.simulateFight(77, l1Pipe, l1Knife, 1);
  return { id: "b1", at: 5, seed: 77, rulesVersion: 1, logVersion: 2, snapshotA: l1Pipe, snapshotB: l1Knife,
    result: log.result, role: "attacker", fighterId: "f1", xp: 2, lineId: 0, watched: true,
    before: { xp: 0, boutsUsed: 0 }, ...over };
}

describe("replayLog", () => {
  it("uses the stored log when there is one", () => {
    const log = api.simulateFight(78, l1Pipe, l1Knife, 1);
    expect(replayLog(api, row({ log }))).toBe(log);
  });
  it("plays the bout again when the result comes out as stored", () => {
    const r = row({});
    expect(replayLog(api, r)?.result).toEqual(r.result);
  });
  it("refuses a bout whose stored result the current sim does not give (an older sim)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = row({});
    const flipped = { ...r.result, winner: r.result.winner === "a" ? "b" as const : "a" as const };
    expect(replayLog(api, { ...r, result: flipped })).toBeNull();
    expect(replayLog(api, { ...r, result: { ...r.result, turns: r.result.turns + 1 } })).toBeNull();
  });
});
