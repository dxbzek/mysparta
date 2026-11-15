/**
 * Balance report (work package 1). Run: pnpm balance [--out <file>] [--quick]
 *
 * Runs the two blocking balance tests of the rules, at levels 10 and 30:
 *   Ownership test     40,000 random pairs of same-level rivals per level. For each perk, the bouts
 *                      where exactly one side owns it, and how often that side won. Limits, only for
 *                      perks with 1,000 or more such bouts: no Common or Uncommon perk and no Raccoon
 *                      above 62%; no perk below 40%.
 *   With-and-without   For each perk, 4,000 bouts per level of a random rival against a copy of
 *                      itself that also owns the perk, sides swapped every bout. No perk below 47%.
 *                      Whistle is tested only on rivals that own a companion.
 * Also reported, not limited: win rate by starting perk at level 1, and bout length.
 *
 * The sample sizes are part of the gate: with fewer bouts a correct perk fails by chance.
 * `--quick` divides them by 10 for tuning runs only; a quick run never counts as the gate.
 * Exits 1 when a limit is broken. The output file is the evidence.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FighterSnapshot, PerkId } from "../packages/core/src/index";
import { PERK_IDS, REALM_SALT, RARITY_OF, isCompanionId, isShieldId, makeRng, combineSeed } from "../packages/core/src/index";
import { rivalSnapshot } from "../packages/core/src/progress/rivals";
import { simulateFight } from "../packages/core/src/sim/simulate";
import { applyPerkToStats, draftOf, freeze } from "../packages/core/src/progress/stats";
import { COMPANIONS } from "../packages/core/src/content/companions";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const quick = args.includes("--quick");
const div = quick ? 10 : 1;
const PAIRS = Math.floor(Number(opt("--pairs") ?? 40000) / div);
const PER_PERK = Math.floor(Number(opt("--per-perk") ?? 4000) / div);
const LEVELS = (opt("--levels") ?? "10,30").split(",").map(Number);
const ONLY = opt("--perks")?.split(",") as PerkId[] | undefined;
const OUT = resolve(ROOT, opt("--out") ?? ".review/wp1/balance-report.md");
const POOL = 1_000_000;

const OWN_MAX = 62;
const OWN_MIN = 40;
const OWN_MIN_BOUTS = 1000;
const WW_MIN = 47;

/** Whether `perk` can be added to a kit: not owned (Raccoon up to two), companion limits and three pets at most,
 *  one shield at most, Whistle needs a companion. */
function canAdd(s: FighterSnapshot, perk: PerkId): boolean {
  if (isCompanionId(perk)) {
    const def = COMPANIONS[perk];
    if (s.perks.filter((p) => p === perk).length >= def.limit) return false;
    if (s.perks.filter((p) => isCompanionId(p)).length >= 3) return false;
    return !def.excludes.some((x) => s.perks.includes(x));
  }
  if (s.perks.includes(perk)) return false;
  if (isShieldId(perk) && s.perks.some((p) => isShieldId(p))) return false;
  if (perk === "whistle") return s.perks.some((p) => isCompanionId(p));
  return true;
}

function withPerk(s: FighterSnapshot, perk: PerkId): FighterSnapshot {
  const d = draftOf(s.stats);
  applyPerkToStats(d, perk);
  return { ...s, id: `${s.id}+${perk}`, stats: freeze(d), perks: [...s.perks, perk] };
}

const lines: string[] = [];
const say = (l = ""): void => { lines.push(l); console.log(l); };
const failures: string[] = [];
const pct = (w: number, n: number): string => (n === 0 ? "-" : ((100 * w) / n).toFixed(1));

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1] ?? 0;
}

const started = Date.now();
say(`# Balance report`);
say();
say(`Sample: ${PAIRS} pairs per level, ${PER_PERK} bouts per perk per level${quick ? " (QUICK RUN: not the gate)" : ""}.`);
say();

// ---- Level 1, reported only.
{
  const rng = makeRng(combineSeed("balance", "l1"));
  const n = Math.floor(20000 / div);
  const byStart = new Map<string, { w: number; n: number }>();
  const turns: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rivalSnapshot(REALM_SALT, 1, rng.int(POOL));
    const b = rivalSnapshot(REALM_SALT, 1, rng.int(POOL));
    const log = simulateFight(rng.int(2 ** 31), a, b, 1);
    turns.push(log.result.turns);
    for (const [s, side] of [[a, "a"], [b, "b"]] as const) {
      const k = s.perks[0]!;
      const e = byStart.get(k) ?? { w: 0, n: 0 };
      e.n += 1;
      if (log.result.winner === side) e.w += 1;
      byStart.set(k, e);
    }
  }
  say(`## Level 1 (reported, not limited)`);
  say();
  say(`${n} random bouts. Median turns ${median(turns)}.`);
  say();
  say(`| Starting perk | Rarity | Bouts | Win % |`);
  say(`|---|---|---|---|`);
  const rows = [...byStart.entries()].sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n);
  for (const [k, e] of rows) say(`| ${k} | ${RARITY_OF[k as PerkId]} | ${e.n} | ${pct(e.w, e.n)} |`);
  say();
}

for (const level of LEVELS) {
  // ---- Ownership test.
  const rng = makeRng(combineSeed("balance", "own", level));
  const own = new Map<PerkId, { w: number; n: number }>();
  const turns: number[] = [];
  let overtime = 0;
  for (let i = 0; i < PAIRS; i++) {
    const a = rivalSnapshot(REALM_SALT, level, rng.int(POOL));
    const b = rivalSnapshot(REALM_SALT, level, rng.int(POOL));
    const log = simulateFight(rng.int(2 ** 31), a, b, 1);
    turns.push(log.result.turns);
    if (log.steps.some((s) => s.t === "overtime")) overtime += 1;
    const sa = new Set(a.perks);
    const sb = new Set(b.perks);
    for (const p of PERK_IDS) {
      const inA = sa.has(p);
      const inB = sb.has(p);
      if (inA === inB) continue;
      const e = own.get(p) ?? { w: 0, n: 0 };
      e.n += 1;
      if ((inA && log.result.winner === "a") || (inB && log.result.winner === "b")) e.w += 1;
      own.set(p, e);
    }
  }
  say(`## Level ${level}`);
  say();
  say(`Ownership sample: ${PAIRS} bouts, median ${median(turns)} turns, overtime in ${pct(overtime, PAIRS)}%.`);
  say();

  // ---- With-and-without test.
  const ww = new Map<PerkId, { w: number; n: number }>();
  for (const perk of ONLY ?? PERK_IDS) {
    const r2 = makeRng(combineSeed("balance", "ww", level, perk));
    let w = 0;
    let n = 0;
    let tries = 0;
    while (n < PER_PERK && tries < PER_PERK * 200) {
      tries += 1;
      const base = rivalSnapshot(REALM_SALT, level, r2.int(POOL));
      if (!canAdd(base, perk)) continue;
      const plus = withPerk(base, perk);
      const swap = n % 2 === 1;
      const log = simulateFight(r2.int(2 ** 31), swap ? base : plus, swap ? plus : base, 1);
      if (log.result.winner === (swap ? "b" : "a")) w += 1;
      n += 1;
    }
    ww.set(perk, { w, n });
  }

  say(`| Perk | Rarity | Owner bouts | Owner win % | With-and-without % | Verdict |`);
  say(`|---|---|---|---|---|---|`);
  for (const p of ONLY ?? PERK_IDS) {
    const o = own.get(p) ?? { w: 0, n: 0 };
    const x = ww.get(p) ?? { w: 0, n: 0 };
    const rar = RARITY_OF[p];
    const notes: string[] = [];
    if (o.n >= OWN_MIN_BOUTS) {
      const r = (100 * o.w) / o.n;
      const capped = rar === "common" || rar === "uncommon" || p === "raccoon";
      if (capped && r > OWN_MAX) notes.push(`ownership ${r.toFixed(1)}% > ${OWN_MAX}%`);
      if (r < OWN_MIN) notes.push(`ownership ${r.toFixed(1)}% < ${OWN_MIN}%`);
    }
    if (x.n > 0 && (100 * x.w) / x.n < WW_MIN) notes.push(`with-and-without ${pct(x.w, x.n)}% < ${WW_MIN}%`);
    if (x.n < PER_PERK) notes.push(`only ${x.n} with-and-without bouts`);
    for (const note of notes) failures.push(`level ${level} ${p}: ${note}`);
    say(`| ${p} | ${rar} | ${o.n} | ${pct(o.w, o.n)} | ${pct(x.w, x.n)} | ${notes.length === 0 ? "ok" : notes.join("; ")} |`);
  }
  say();
}

say(`## Verdict`);
say();
if (failures.length === 0) say(`PASS: no limit broken.`);
else {
  say(`FAIL: ${failures.length} limit(s) broken.`);
  for (const f of failures) say(`- ${f}`);
}
say();
say(`Run time ${Math.round((Date.now() - started) / 1000)} s.`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`\nwritten: ${OUT}`);
process.exit(failures.length === 0 ? 0 : 1);
