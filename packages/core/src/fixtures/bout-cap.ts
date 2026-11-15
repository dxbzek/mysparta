/**
 * FROZEN FIXTURE (work package 0). The cap ending: a bout that reaches the hard stop with both
 * scrappers standing. Nettle (bare hands, 61 HP) against Brisket (Pocket Knife, 61 HP), level 1.
 *
 * What it is for: `reason: "cap"` has no kill step and no `ko` step, so the stage must play the
 * loser's fall from the `end` step. The side with the higher HP percentage wins.
 *
 * Synthetic on purpose, and short: two opening turns, then the turn numbers jump to the last two
 * turns before the stop. A real bout cannot reach the cap this healthy, because overtime has
 * been taking 8% of max HP a turn since turn 50 (4 HP here). It is not a sample of bout length
 * or of pacing; use `bout-gate` for those.
 */
import type { BoutLog } from "../contracts/log";

export const boutCap: BoutLog = {
  logVersion: 2, rulesVersion: 1, seed: 1403,
  init: {
    actors: [
      { id: "a0", kind: "scrapper", maxHp: 61 },
      { id: "b0", kind: "scrapper", maxHp: 61 },
    ],
    bag: { a: [], b: [{ k: "weapon", id: "pocket-knife" }] },
    shield: { a: null, b: null },
  },
  steps: [
    { t: "enter", turn: 0, actor: "a0" },
    { t: "enter", turn: 0, actor: "b0" },
    // 1: Brisket draws the knife and lands it.
    { t: "draw", turn: 1, actor: "b0", weapon: "pocket-knife", bagAfter: [] },
    { t: "attack", turn: 1, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 7, crit: false, hpAfter: 54, n: 0 },
    // 2: Nettle punches back.
    { t: "attack", turn: 2, actor: "a0", target: "b0", weapon: "fists", outcome: "hit", damage: 6, crit: false, hpAfter: 55, n: 0 },
    // 149 (the jump from 2 is synthetic): a punch, then Nettle's overtime loss.
    { t: "attack", turn: 149, actor: "a0", target: "b0", weapon: "fists", outcome: "hit", damage: 6, crit: false, hpAfter: 49, n: 0 },
    { t: "overtime", turn: 149, actor: "a0", damage: 4, hpAfter: 50 },
    // 150: the last turn. Brisket's stab is blocked, then his overtime loss.
    { t: "attack", turn: 150, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "block", damage: 0, crit: false, hpAfter: 50, n: 0 },
    { t: "overtime", turn: 150, actor: "b0", damage: 4, hpAfter: 45 },
    // The stop. Nettle has 82% left and Brisket 74%, so side a wins. Nobody is knocked out.
    { t: "end", turn: 150, winner: "a", reason: "cap" },
  ],
  result: { winner: "a", reason: "cap", turns: 150, hpPct: { a: 82, b: 74 } },
};
