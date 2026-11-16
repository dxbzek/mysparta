/**
 * Balance report (work package 1). Run: pnpm balance [--out <file>] [--quick]
 *
 * Runs the two blocking balance tests of the rules, at levels 2, 3, 5, 10 and 30 (level 2 since
 * round 2: Snatch won 75% of level-2 bouts and the gate never looked):
 *   Ownership test     40,000 random pairs of same-level rivals per level. For each perk, the bouts
 *                      where exactly one side owns it, and how often that side won. Limits, only for
 *                      perks with 1,000 or more such bouts: no Common or Uncommon perk and no Raccoon
 *                      above 62%; no perk below 40%.
 *   With-and-without   For each perk, 4,000 bouts per level of a random rival against a copy of
 *                      itself that also owns the perk, sides swapped every bout. No perk below 47%,
 *                      and none above the upper limit of its rarity (WW_MAX); companions 65%.
 *                      A perk is added only where the Route could offer it (`fits`): Whistle and
 *                      Pet Lover need a companion, a weapon passive a weapon it works with. A kit
 *                      with 5 weapons gets a weapon as its 5th (its last one is left at home).
 *   Level-up policy   At levels 10 and 30, a player who always takes the perk card (or the split
 *                      that replaced it) against the level pool, 2,000 seeds x 3 rivals: within
 *                      50 +/- 5% (round 2: it won 27.5% at level 30). Always-stat and the rivals'
 *                      own 65% policy are reported beside it, not limited.
 * Also reported, not limited: win rate by starting weapon and by starting skill at level 1, and
 * bout length.
 *
 * The sample sizes are part of the gate: with fewer bouts a correct perk fails by chance.
 * `--quick` divides them by 10 for tuning runs only; a quick run never counts as the gate.
 * Exits 1 when a limit is broken. The output file is the evidence.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FighterSnapshot, PerkId, Rarity } from "../packages/core/src/index";
import { PERK_IDS, REALM_SALT, RARITY_OF, isCompanionId, makeRng, combineSeed, perkKind } from "../packages/core/src/index";
import { MAX_WEAPONS, fits, weaponsOf } from "../packages/core/src/progress/perks";
import { rivalSnapshot } from "../packages/core/src/progress/rivals";
import { simulateFight } from "../packages/core/src/sim/simulate";
import { applyPerkToStats, draftOf, freeze } from "../packages/core/src/progress/stats";
import { walk, walkWith } from "../packages/core/src/progress/route";

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
const LEVELS = (opt("--levels") ?? "2,3,5,10,30").split(",").map(Number);
const POLICY_LEVELS = (opt("--policy-levels") ?? "10,30").split(",").filter((x) => x !== "").map(Number);
const POLICY_SEEDS = Math.floor(Number(opt("--policy-seeds") ?? 2000) / div);
const POLICY_BAND = 5;
const ONLY = opt("--perks")?.split(",") as PerkId[] | undefined;
const OUT = resolve(ROOT, opt("--out") ?? ".review/wp1/balance-report.md");
const POOL = 1_000_000;

const OWN_MAX = 62;
const OWN_MIN = 40;
const OWN_MIN_BOUTS = 1000;
const WW_MIN = 47;
/** Upper limit of the with-and-without test, by rarity (pet pass, 15 November 2026). A pet is held
 *  to its own, tighter limit: before this gate, pets won 85-93% at level 3 and every row said ok. */
const WW_MAX: Readonly<Record<Rarity, number>> = { common: 80, uncommon: 80, rare: 82, epic: 85, mythic: 88 };
const WW_MAX_COMPANION = 65;

/** The kit a perk is added to. A weapon goes to a kit with room for it: a kit that owns MAX_WEAPONS
 *  weapons (nearly every level-30 kit, round 2) is measured with its last weapon left at home, so
 *  the test is the choice the Route can really offer, a 5th weapon, and never a 6th. */
function baseFor(s: FighterSnapshot, perk: PerkId): FighterSnapshot {
  const owned = weaponsOf(s.perks);
  if (perkKind(perk) !== "weapon" || owned.length < MAX_WEAPONS || owned.includes(perk as never)) return s;
  const last = owned[owned.length - 1]!;
  return { ...s, id: `${s.id}-${last}`, perks: s.perks.filter((p) => p !== last) };
}

/** Whether `perk` can be added to a kit: the Route's own rule without the booster roll. Bare
 *  Knuckle's weapon-count rule of round 2 (under 3 weapons) is left out, or it could not be
 *  measured from level 10 up. */
function canAdd(s: FighterSnapshot, perk: PerkId): boolean {
  return fits(perk, s.perks, perk !== "bare-knuckle");
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
  const bySkill = new Map<string, { w: number; n: number }>();
  const turns: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rivalSnapshot(REALM_SALT, 1, rng.int(POOL));
    const b = rivalSnapshot(REALM_SALT, 1, rng.int(POOL));
    const log = simulateFight(rng.int(2 ** 31), a, b, 1);
    turns.push(log.result.turns);
    for (const [s, side] of [[a, "a"], [b, "b"]] as const) {
      for (const [map, k] of [[byStart, s.perks[0]!], [bySkill, s.perks[1]]] as const) {
        if (k === undefined) continue;
        const e = map.get(k) ?? { w: 0, n: 0 };
        e.n += 1;
        if (log.result.winner === side) e.w += 1;
        map.set(k, e);
      }
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
  say(`| Starting skill | Rarity | Bouts | Win % |`);
  say(`|---|---|---|---|`);
  const skillRows = [...bySkill.entries()].sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n);
  for (const [k, e] of skillRows) say(`| ${k} | ${RARITY_OF[k as PerkId]} | ${e.n} | ${pct(e.w, e.n)} |`);
  say();
}

// ---- Level-up policy (limited for always-perk).
if (POLICY_LEVELS.length > 0) {
  say(`## Level-up policy`);
  say();
  say(`${POLICY_SEEDS} player seeds x 3 pool rivals per level. Always-perk must win ${50 - POLICY_BAND} to ${50 + POLICY_BAND}%.`);
  say();
  say(`| Level | Always perk % | Always stat % | 65% perk % | Verdict |`);
  say(`|---|---|---|---|---|`);
  for (const level of POLICY_LEVELS) {
    const rate: Record<string, number> = {};
    for (const pol of ["perk", "stat", "mix"] as const) {
      let w = 0;
      let n = 0;
      for (let i = 0; i < POLICY_SEEDS; i++) {
        const seed = combineSeed("balance", "policy", i);
        const prng = makeRng(combineSeed(seed, pol, level));
        const picks = walkWith(seed, level - 1, (c) => {
          const perkSide = c.left.kind === "stat" ? "R" : "L";
          const statSide = perkSide === "L" ? "R" : "L";
          if (pol === "perk") return perkSide;
          if (pol === "stat") return statSide;
          return prng.int(100) < 65 ? perkSide : statSide;
        });
        const kit = walk(seed, picks);
        const me: FighterSnapshot = { id: `policy:${pol}:${i}`, name: "Policy", look: rivalSnapshot(REALM_SALT, 1, 0).look,
          level, stats: kit.stats, perks: kit.perks, rulesVersion: 1 };
        for (let j = 0; j < 3; j++) {
          const swap = j === 1;
          const foe = rivalSnapshot(REALM_SALT, level, prng.int(POOL));
          const log = simulateFight(prng.int(2 ** 31), swap ? foe : me, swap ? me : foe, 1);
          if (log.result.winner === (swap ? "b" : "a")) w += 1;
          n += 1;
        }
      }
      rate[pol] = (100 * w) / n;
    }
    const notes: string[] = [];
    if (Math.abs(rate.perk! - 50) > POLICY_BAND) notes.push(`always-perk ${rate.perk!.toFixed(1)}% outside 50 +/- ${POLICY_BAND}`);
    for (const note of notes) failures.push(`level ${level} policy: ${note}`);
    say(`| ${level} | ${rate.perk!.toFixed(1)} | ${rate.stat!.toFixed(1)} | ${rate.mix!.toFixed(1)} | ${notes.length === 0 ? "ok" : notes.join("; ")} |`);
  }
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
      const base = baseFor(rivalSnapshot(REALM_SALT, level, r2.int(POOL)), perk);
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
    const max = isCompanionId(p) ? WW_MAX_COMPANION : WW_MAX[rar];
    if (x.n > 0 && (100 * x.w) / x.n > max) notes.push(`with-and-without ${pct(x.w, x.n)}% > ${max}%`);
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
