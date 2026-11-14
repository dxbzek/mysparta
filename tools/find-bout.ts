/**
 * Bout finder (work package 1). Run: pnpm find-bout [options]
 *
 * Searches seeds for a real sim bout with the beats you want, so a recording shows the game and
 * not a hand-written log. Candidate n is reproducible: side a is rival 2n and side b rival 2n + 1
 * at the given level (re-kitted when --kit is given), and the bout seed is hash("find-bout", n).
 *
 *   --level <n>           level of both sides (default 1)
 *   --kit <a>,<b>         each side holds only this weapon ("fists" for none); boosters are kept,
 *                         every other perk is removed. Without it the rivals keep their own kits.
 *   --want <list>         beat types that must all appear: hit, miss (or evade), block, crit, combo,
 *                         draw, swap, throw, disarm, intercept, riposte, move, companion-ko,
 *                         plus ko, cap, overtime
 *   --min-turns <n>       fewest turns (default 0)    --max-turns <n>   most turns (default 149)
 *   --gate-only           only beats the 13 gate clips can show: no blocks, throws, Moves,
 *                         companions, doors, snares, overtime or skill tags; weapons fists, pipe,
 *                         pocket-knife only. A crit is allowed (the gate rig shows it with the light flinch).
 *   --from <n>            first candidate (default 0)     --tries <n>   candidates to try (default 200000)
 *   --count <n>           how many to report (default 1)
 *   --out <file>          writes the first match as JSON: { n, seed, a, b, log }
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BoutLog, FighterSnapshot, PerkId } from "../packages/core/src/index";
import { REALM_SALT, combineSeed, isWeaponId } from "../packages/core/src/index";
import { rivalSnapshot } from "../packages/core/src/progress/rivals";
import { isBooster } from "../packages/core/src/progress/perks";
import { simulateFight } from "../packages/core/src/sim/simulate";
import { beatsOf } from "../packages/core/src/sim/beats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const num = (name: string, d: number): number => {
  const v = opt(name);
  return v === undefined ? d : Number(v);
};

const level = num("--level", 1);
const kit = opt("--kit")?.split(",");
const want = (opt("--want")?.split(",") ?? []).map((w) => (w === "evade" ? "miss" : w.trim())).filter(Boolean);
const minTurns = num("--min-turns", 0);
const maxTurns = num("--max-turns", 149);
const gateOnly = args.includes("--gate-only");
const from = num("--from", 0);
const tries = num("--tries", 200000);
const count = num("--count", 1);
const out = opt("--out");

const KNOWN = ["hit", "miss", "block", "crit", "combo", "draw", "swap", "throw", "disarm", "intercept", "riposte",
  "move", "companion-ko", "ko", "cap", "overtime"];
for (const w of want) if (!KNOWN.includes(w)) { console.error(`unknown beat "${w}". Known: ${KNOWN.join(", ")}`); process.exit(2); }
if (kit !== undefined) {
  if (kit.length !== 2) { console.error("--kit takes two ids: <a>,<b>"); process.exit(2); }
  for (const k of kit) if (k !== "fists" && !isWeaponId(k)) { console.error(`--kit: "${k}" is not a weapon id`); process.exit(2); }
}

const GATE_WEAPONS = new Set(["fists", "pipe", "pocket-knife"]);
const GATE_STEPS = new Set(["enter", "draw", "swap", "attack", "intercept", "riposte", "disarm", "ko", "end"]);

function rekit(s: FighterSnapshot, weapon: string): FighterSnapshot {
  const keep: PerkId[] = s.perks.filter((p) => isBooster(p));
  if (weapon !== "fists") keep.push(weapon as PerkId);
  return { ...s, id: `${s.id}:${weapon}`, perks: keep };
}

/** Why a log is not gate-only, or null when it is. */
function notGate(log: BoutLog): string | null {
  for (const s of log.steps) {
    if (!GATE_STEPS.has(s.t)) return s.t;
    if (s.t === "attack" || s.t === "intercept" || s.t === "riposte") {
      if (s.outcome === "block") return "block";
      if (s.weapon === null || !GATE_WEAPONS.has(s.weapon)) return `weapon ${String(s.weapon)}`;
      if (s.procs !== undefined) return "skill tag";
      if (s.t === "attack" && s.boosted === true) return "boosted";
    }
    if ((s.t === "draw" || s.t === "swap") && !GATE_WEAPONS.has(s.weapon)) return `weapon ${s.weapon}`;
    if (s.t === "end" && s.reason !== "ko") return "cap";
    if ("actor" in s && s.actor !== "a0" && s.actor !== "b0") return "companion";
  }
  return null;
}

function matches(log: BoutLog): boolean {
  if (log.result.turns < minTurns || log.result.turns > maxTurns) return false;
  if (gateOnly && notGate(log) !== null) return false;
  const beats = beatsOf(log) as Set<string>;
  if (log.result.reason === "ko") beats.add("ko");
  if (log.result.reason === "cap") beats.add("cap");
  if (log.steps.some((s) => s.t === "overtime")) beats.add("overtime");
  return want.every((w) => beats.has(w));
}

const found: { n: number; seed: number; a: FighterSnapshot; b: FighterSnapshot; log: BoutLog }[] = [];
for (let n = from; n < from + tries && found.length < count; n++) {
  let a = rivalSnapshot(REALM_SALT, level, 2 * n);
  let b = rivalSnapshot(REALM_SALT, level, 2 * n + 1);
  if (kit !== undefined) { a = rekit(a, kit[0]!); b = rekit(b, kit[1]!); }
  const seed = combineSeed("find-bout", n);
  const log = simulateFight(seed, a, b, 1);
  if (matches(log)) found.push({ n, seed, a, b, log });
}

if (found.length === 0) {
  console.error(`no bout found in candidates ${from} to ${from + tries - 1}`);
  process.exit(1);
}
for (const f of found) {
  const beats = [...beatsOf(f.log)].join(",");
  console.log(`n=${f.n} seed=${f.seed} turns=${f.log.result.turns} winner=${f.log.result.winner} a=${f.a.id} [${f.a.perks.join(",")}] b=${f.b.id} [${f.b.perks.join(",")}] beats=${beats}`);
}
if (out !== undefined) {
  const file = resolve(ROOT, out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(found[0], null, 2) + "\n");
  console.log(`written: ${file}`);
}
