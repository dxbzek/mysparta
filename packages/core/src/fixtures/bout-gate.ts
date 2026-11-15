/**
 * FROZEN FIXTURE (work package 0). The gate bout: a hand-written 14-turn log.
 * Cuff (lean, Pipe, 68 HP) against Brisket (stocky, Pocket Knife, 61 HP), both level 1 with
 * Strength 3. It shows a staggered entry, two draws, plain hits, one crit, one evade, one
 * two-swing combo, the knockout and the end, and uses all 13 gate clips.
 *
 * It is written by hand, not by the sim, so it must not flatter. Every damage value is one
 * the rules can give at Strength 3: fists 5 to 8, Pocket Knife 6 to 9, Pipe 11 to 14, and the
 * crit is 12 x 1.5 = 18. The turn order is one the two clocks can give (Speed 4 with the Pipe
 * against Speed 2 with the Pocket Knife: six turns to eight).
 *
 * The crit takes 18 of 61 HP (29%), so it is a heavy flinch; every other hit is a light one.
 * `hit-heavy` is not a gate clip, so on the gate rig the crit falls back to `hit-light`.
 *
 * The seed is 1400 on purpose: `stageFor(1400)` is "yard", the one arena the gate pack draws,
 * so the gate bout needs no arena fallback.
 */
import type { BoutLog } from "../contracts/log";

export const boutGate: BoutLog = {
  logVersion: 2, rulesVersion: 1, seed: 1400,
  init: {
    actors: [
      { id: "a0", kind: "scrapper", maxHp: 68 },
      { id: "b0", kind: "scrapper", maxHp: 61 },
    ],
    bag: { a: [{ k: "weapon", id: "pipe" }], b: [{ k: "weapon", id: "pocket-knife" }] },
    shield: { a: null, b: null },
  },
  steps: [
    { t: "enter", turn: 0, actor: "a0" },
    { t: "enter", turn: 0, actor: "b0" },
    // 1: Brisket draws at once and opens with the knife.
    { t: "draw", turn: 1, actor: "b0", weapon: "pocket-knife", bagAfter: [] },
    { t: "attack", turn: 1, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 7, crit: false, hpAfter: 61, n: 0 },
    // 2: Cuff does not draw yet and punches.
    { t: "attack", turn: 2, actor: "a0", target: "b0", weapon: "fists", outcome: "hit", damage: 7, crit: false, hpAfter: 54, n: 0 },
    { t: "attack", turn: 3, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 8, crit: false, hpAfter: 53, n: 0 },
    // 4: the Pipe comes out.
    { t: "draw", turn: 4, actor: "a0", weapon: "pipe", bagAfter: [] },
    { t: "attack", turn: 4, actor: "a0", target: "b0", weapon: "pipe", outcome: "hit", damage: 13, crit: false, hpAfter: 41, n: 0 },
    // 5: the two-swing combo.
    { t: "attack", turn: 5, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 6, crit: false, hpAfter: 47, n: 0 },
    { t: "attack", turn: 5, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 7, crit: false, hpAfter: 40, n: 1, why: "combo" },
    // 6: the evade.
    { t: "attack", turn: 6, actor: "a0", target: "b0", weapon: "pipe", outcome: "evade", damage: 0, crit: false, hpAfter: 41, n: 0 },
    { t: "attack", turn: 7, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 9, crit: false, hpAfter: 31, n: 0 },
    { t: "attack", turn: 8, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 6, crit: false, hpAfter: 25, n: 0 },
    // 9: the crit.
    { t: "attack", turn: 9, actor: "a0", target: "b0", weapon: "pipe", outcome: "hit", damage: 18, crit: true, hpAfter: 23, n: 0 },
    { t: "attack", turn: 10, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 8, crit: false, hpAfter: 17, n: 0 },
    { t: "attack", turn: 11, actor: "a0", target: "b0", weapon: "pipe", outcome: "hit", damage: 14, crit: false, hpAfter: 9, n: 0 },
    { t: "attack", turn: 12, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 7, crit: false, hpAfter: 10, n: 0 },
    { t: "attack", turn: 13, actor: "b0", target: "a0", weapon: "pocket-knife", outcome: "hit", damage: 6, crit: false, hpAfter: 4, n: 0 },
    // 14: the knockout. Step 18 is the kill step.
    { t: "attack", turn: 14, actor: "a0", target: "b0", weapon: "pipe", outcome: "hit", damage: 12, crit: false, hpAfter: 0, n: 0 },
    { t: "ko", turn: 14, actor: "b0", by: "a0" },
    { t: "end", turn: 14, winner: "a", reason: "ko" },
  ],
  result: { winner: "a", reason: "ko", turns: 14, hpPct: { a: 6, b: 0 } },
};
