/**
 * Timeline audit (stage lane). Run: pnpm audit [--fixture bout-gate] [--rig capsule|capsule-gate] [--reduced]
 *
 * Prints, as text: every step with its start and end on the fight clock, every gap between busy
 * beats from the first action to the kill step (a gap over 400 ms is dead air and is flagged),
 * and every contact with each effect's start MEASURED from sampled frames next to the contact
 * time. Exits non-zero when a measured start differs from its contact time, an effect is
 * present before it, or dead air is found.
 */
import { BOUT_FIXTURES } from "@rankzero/core/fixtures";
import type { BoutFixtureName } from "@rankzero/core/fixtures";
import { stageFor } from "@rankzero/core";
import type { Rig } from "@rankzero/rig";
import { capsuleGateRig, capsuleRig } from "@rankzero/rig/testing";
import { buildPlayer } from "../packages/stage/src/createFightPlayer.ts";
import type { PlayerOpts } from "../packages/stage/src/contracts.ts";
import { EFFECT_KEYS, measureStarts } from "../packages/stage/test/lib/measure.ts";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const fixtureName = (arg("fixture") ?? "bout-gate") as BoutFixtureName;
const rigName = arg("rig") ?? "capsule";
const reduced = process.argv.includes("--reduced");
const fixture = BOUT_FIXTURES[fixtureName];
if (fixture === undefined) {
  console.error(`audit: no fixture "${fixtureName}". Known: ${Object.keys(BOUT_FIXTURES).join(", ")}`);
  process.exit(2);
}
const rigs: Record<string, Rig> = { capsule: capsuleRig, "capsule-gate": capsuleGateRig };
const rig = rigs[rigName];
if (rig === undefined) {
  console.error(`audit: rig "${rigName}" is not available here. Known: ${Object.keys(rigs).join(", ")}`);
  process.exit(2);
}
const opts: PlayerOpts = {
  reducedMotion: reduced, cosmeticSeed: 7, stage: stageFor(fixture.log.seed),
  text: { fight: "FIGHT", wins: (n) => `${n.toUpperCase()} WINS`, block: "BLOCK", miss: "MISS", crit: "CRIT", overtime: "OVERTIME",
    moveName: (id) => id.replace(/-/g, " "), skillName: (id) => id.replace(/-/g, " ") },
  fonts: { display: "sans-serif", body: "sans-serif" },
};
const player = buildPlayer(fixture.log, fixture.a, fixture.b, rig, opts);
const tl = player.timeline;
const ms = (v: number): string => (v === Infinity ? "inf" : `${Math.round(v)}`.padStart(6));
let bad = 0;

console.log(`timeline audit: ${fixtureName} on ${rigName}${reduced ? ", reduced motion" : ""}`);
console.log(`length ${Math.round(tl.durationMs)} ms, first action ${tl.firstActionAt}, result card ${Math.round(tl.resultAt)}, kill step ${tl.killStep}`);
console.log("\nsteps (start, end):");
fixture.log.steps.forEach((s, i) => {
  const who = "actor" in s ? s.actor : "";
  console.log(`  ${String(i).padStart(3)} ${s.t.padEnd(9)} turn ${String(s.turn).padStart(3)} ${String(who).padEnd(3)} ${ms(tl.stepAt[i]!)} ${ms(tl.stepEnd[i]!)}`);
});

// dead air: the union of busy spans from the first action to the kill step (or the end)
const until = tl.killStep >= 0 ? tl.stepAt[tl.killStep]! : tl.stepAt[tl.stepAt.length - 1]!;
const spans = tl.busy.filter(([f, t]) => t > tl.firstActionAt && f < until).map(([f, t]) => [Math.max(f, tl.firstActionAt), Math.min(t, until)] as const);
let reach = tl.firstActionAt;
const gaps: [number, number][] = [];
for (const [f, t] of spans) {
  if (f > reach) gaps.push([reach, f]);
  if (t > reach) reach = t;
}
if (until > reach) gaps.push([reach, until]);
console.log(`\ngaps between busy beats from ${tl.firstActionAt} to ${Math.round(until)}:`);
if (gaps.length === 0) console.log("  none");
for (const [f, t] of gaps) {
  const flag = t - f > 400 ? "  DEAD AIR" : "";
  if (flag) bad += 1;
  console.log(`  ${ms(f)} to ${ms(t)}: ${Math.round(t - f)} ms${flag}`);
}

console.log("\ncontacts (each effect's start measured from sampled frames, minus the contact time; '-' = not shown):");
console.log(`  ${"#".padStart(3)} step ${"at".padStart(6)}  ${EFFECT_KEYS.map((k) => k.padStart(9)).join("")}`);
tl.contacts.forEach((c, ci) => {
  const m = measureStarts(player, ci);
  const cells = EFFECT_KEYS.map((k) => {
    const v = m[k];
    if (v === null) return (c.starts[k] === null ? "-" : "MISSING").padStart(9);
    const d = Math.round(v - c.at);
    if (d !== 0) bad += 1;
    if (c.starts[k] === null) bad += 1;
    return (d === 0 ? "0" : `${d > 0 ? "+" : ""}${d} BAD`).padStart(9);
  });
  for (const k of EFFECT_KEYS) if (m[k] === null && c.starts[k] !== null) bad += 1;
  const s = fixture.log.steps[c.step]!;
  console.log(`  ${String(ci).padStart(3)} ${String(c.step).padStart(4)} ${ms(c.at)}  ${cells.join("")}   ${s.t}`);
});
console.log(`\ncues: ${tl.cues.length}`);
if (bad > 0) {
  console.error(`\naudit FAILED: ${bad} problem${bad === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log("\naudit ok");
