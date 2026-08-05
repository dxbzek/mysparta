/**
 * Balance report — the designer's dashboard, not a pass/fail gate.
 *
 *   BALANCE_REPORT=1 pnpm --filter @agoge/core test balance
 *
 * Prints win rates against the daily board by level and the fights-per-level
 * pacing table. Skipped in normal runs so the suite stays fast; the numbers
 * that led to the level-<3 board tune (28% day-one winrate) came from here.
 */
import { it } from "vitest";
import {
  applyDraft,
  arenaBoard,
  costToNext,
  createChampion,
  generateDraft,
  simulateFight,
  snapshot,
} from "../src/index.js";
import { combineSeed, makeRng } from "../src/prng.js";
import type { BattlePlan, Champion } from "../src/types.js";

const PLAN: BattlePlan = { stance: "measured", gambit: "close_the_gap" };

function grown(name: string, level: number): Champion {
  const c = createChampion(name);
  for (let l = 1; l < level; l++) {
    const offers = generateDraft(c, l + 1, 0);
    applyDraft(c, offers, makeRng(combineSeed(c.seed, l)).int(offers.length), false);
  }
  return c;
}

// Read process off globalThis: core's tsconfig has no node types, on purpose,
// and vitest only mirrors VITE_-prefixed vars into import.meta.env.
const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

it.runIf(ENV.BALANCE_REPORT)("balance report", () => {
  for (const lvl of [1, 3, 5, 10, 15, 20, 30]) {
    let wins = 0;
    let fights = 0;
    let ticks = 0;
    for (let p = 0; p < 20; p++) {
      const me = grown("Hunter" + p, lvl);
      for (const rival of arenaBoard(me, `2026-08-0${(p % 7) + 1}`, 0)) {
        const r = simulateFight({
          seed: combineSeed(p, lvl, rival.snapshot.name),
          attacker: snapshot(me, PLAN),
          defender: rival.snapshot,
        });
        if (r.winner === 0) wins++;
        ticks += r.ticks;
        fights++;
      }
    }
    console.log(
      `lvl ${String(lvl).padStart(2)}: ${((100 * wins) / fights).toFixed(1)}% winrate vs board, avg fight ${(ticks / fights).toFixed(0)} ticks`,
    );
  }

  let cumulative = 0;
  for (let l = 1; l < 50; l++) {
    cumulative += costToNext(l) / 1.6; // ~1.6 xp per fight at a mixed record
    if ([2, 5, 10, 15, 20, 30, 40, 50].includes(l + 1)) {
      console.log(
        `to lvl ${l + 1}: ~${cumulative.toFixed(0)} fights (~${(cumulative / 6).toFixed(1)} days at 6/day)`,
      );
    }
  }
});
