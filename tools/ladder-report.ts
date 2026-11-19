/**
 * Ladder report (plan 13.10 item 1). Run: pnpm ladder [--n 2000] [--out <file>] [--tune]
 *
 * For each of the ten bosses: how often a typical scrapper beats it at the rung's gate level and two
 * levels later. A typical scrapper is a pool rival (`rivalSnapshot`, the same code and the same
 * level-up policy as Tonight's Card) of a realm of its own, so the test never reuses the player's
 * real rivals; it is side a, as the player always is. Targets: 30 to 45% at the gate, 55 to 70% two
 * levels later. Also reported: the same scrappers against same-level rivals (50% by design), so
 * "harder than a rival" is a number.
 *
 * --tune: for each boss, the flat number of stat points (added to or taken from its biggest stats
 * first) that puts the middle of the two win rates nearest 50% with the gate rate at 45% or under, with the win rates it gives, for copying into
 * packages/core/src/content/bosses.ts by hand. Exits 1 when a rate is off target (not with --tune).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { FighterSnapshot, StatKey } from "../packages/core/src/index";
import { BOSSES, LADDER_RUNGS, bossGate, bossSnapshot, combineSeed, rivalSnapshot } from "../packages/core/src/index";
import { simulateFight } from "../packages/core/src/sim/simulate";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const N = Number(opt("--n") ?? 2000);
const SALT = "ladder-test";
const KEYS: readonly StatKey[] = ["health", "strength", "agility", "speed", "toughness", "precision"];

function winRate(boss: FighterSnapshot, level: number, n: number, rung: number): number {
  let won = 0;
  for (let i = 0; i < n; i++) {
    const me = rivalSnapshot(SALT, level, i % 240);
    const log = simulateFight(combineSeed("ladder", rung, level, i), me, boss, 1);
    if (log.result.winner === "a") won++;
  }
  return won / n;
}

/** The boss with `k` stat points more (or fewer), biggest stats first, never below 2. */
function shifted(boss: FighterSnapshot, k: number): FighterSnapshot {
  const points = { ...boss.stats.points } as Record<StatKey, number>;
  const order = [...KEYS].sort((a, b) => points[b] - points[a]);
  let left = Math.abs(k);
  for (let i = 0; left > 0 && i < 1000; i++) {
    const s = order[i % order.length]!;
    if (k > 0) { points[s] += 1; left--; } else if (points[s] > 2) { points[s] -= 1; left--; }
  }
  return { ...boss, stats: { points, mult: { ...boss.stats.mult } } };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const lines: string[] = [`Ladder report, ${N} bouts per cell (typical scrapper = pool rival of realm "${SALT}", side a)`, ""];
lines.push("rung | boss         | lv | gate | win at gate | win at gate+2 | target");
let bad = 0;
const tune = args.includes("--tune");
for (let rung = 1; rung <= LADDER_RUNGS; rung++) {
  const boss = bossSnapshot(rung);
  const gate = bossGate(rung);
  if (tune) {
    // the middle of the two rates nearest 50%, with the gate rate held at 45% or under
    const n = Math.min(N, 800);
    const rate = (k: number): { at: number; after: number } => {
      const b = shifted(boss, k);
      return { at: winRate(b, gate, n, rung), after: winRate(b, gate + 2, n, rung) };
    };
    let best = { k: 0, d: Infinity };
    let lo = -25;
    let hi = 30;
    while (lo <= hi) {
      const k = Math.round((lo + hi) / 2);
      const r = rate(k);
      const mid = (r.at + r.after) / 2;
      const d = Math.abs(mid - 0.5) + (r.at > 0.45 ? r.at - 0.45 : 0) * 4;
      if (d < best.d) best = { k, d };
      if (mid > 0.5 || r.at > 0.45) lo = k + 1; else hi = k - 1;
    }
    const b2 = shifted(boss, best.k);
    const at = winRate(b2, gate, N, rung);
    const after = winRate(b2, gate + 2, N, rung);
    const p = b2.stats.points;
    const base = BOSSES[rung - 1]!.points;
    const raw = KEYS.map((s) => base[s] + (p[s] - boss.stats.points[s]));
    lines.push(`${rung} ${boss.name}: k=${best.k} gate ${pct(at)} +2 ${pct(after)}  points: pts(${raw.join(", ")})`);
    console.log(lines[lines.length - 1]);
    continue;
  }
  const at = winRate(boss, gate, N, rung);
  const after = winRate(boss, gate + 2, N, rung);
  const ok = at >= 0.3 && at <= 0.45 && after >= 0.55 && after <= 0.7;
  if (!ok) bad++;
  lines.push(`${String(rung).padStart(4)} | ${boss.name.padEnd(12)} | ${String(boss.level).padStart(2)} | ${String(gate).padStart(4)} | ${pct(at).padStart(11)} | ${pct(after).padStart(13)} | ${ok ? "ok" : "OFF"}`);
  console.log(lines[lines.length - 1]);
}
const out = opt("--out");
if (out) {
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${lines.join("\n")}\n`);
}
if (!tune && bad > 0) {
  console.log(`${bad} boss(es) off target`);
  process.exitCode = 1;
}
