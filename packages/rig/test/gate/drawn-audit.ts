/**
 * The drawn-geometry audit (not a test; run with tsx from the repo root):
 *
 *   npx tsx packages/rig/test/gate/drawn-audit.ts report <dir>          numbers + worst 12 + sheet
 *   npx tsx packages/rig/test/gate/drawn-audit.ts sheet <frames.json> <out.png>   draw listed frames
 *
 * `report` sweeps every scrapper clip (gate, content and the per-weapon variants) with every
 * item kind of `drawn.ts`, three builds, both facings, every 60 fps frame, prints the worst of
 * each measure, writes `summary.json`, `worst.json` (the 12 worst frames, one per clip and kind)
 * and `worst.png` (those frames drawn at 4 px a unit, the faults ringed in red).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, Path2D } from "@napi-rs/canvas";
import type { HeldId } from "@rankzero/core";
import { WEAPON_META } from "@rankzero/core";
import type { DrawEnv, Dress, Place } from "../../src/contracts";
import { flightKindOf, makePath, pointAt } from "../../../stage/src/flight";
import { SCRAPPER_CLIPS } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { contentPack } from "../../src/content/pack";
import { VARIANTS } from "../../src/content/clips/use";
import { gatePack } from "../../src/gate/pack";
import type { Row } from "./drawn";
import { KINDS, LIMITS, dressOf, measureDrawn, sizeOf, sweep } from "./drawn";

const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);
export const ALL_CLIPS: readonly string[] = [...SCRAPPER_CLIPS, ...Object.keys(VARIANTS)];

interface Pick { clip: string; kind: string; build: number; facing: 1 | -1; t: number; note: string; aim?: "head" | "body" }

const TARGET: Dress = { look: { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 }, held: null, shield: null, scale: 1 };
function poseOf(p: Pick, dress: Dress) {
  return p.aim === undefined ? rig.samplePose("scrapper", p.clip, p.t) : rig.samplePose("scrapper", p.clip, p.t, { y: rig.hitPoint("scrapper", TARGET, p.aim).y, dress });
}
function sheet(picks: readonly Pick[], out: string, title: string): void {
  const cw = 170;
  const ch = 120;
  const cols = 4;
  const rows = Math.ceil(picks.length / cols);
  const k = 4;
  const canvas = createCanvas(cols * cw * k, rows * ch * k + 40);
  const c = canvas.getContext("2d");
  c.fillStyle = "#0A262C";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = "#F2E2C4";
  c.font = "bold 26px sans-serif";
  c.fillText(title, 16, 30);
  const cache = new Map<string, Path2D>();
  const env: DrawEnv = { ctx: c as unknown as DrawEnv["ctx"], path: (d: string) => { let p = cache.get(d); if (!p) { p = new Path2D(d); cache.set(d, p); } return p; } };
  picks.forEach((p, i) => {
    const kind = KINDS.find((x) => x.name === p.kind)!;
    const dress = dressOf(kind, p.build);
    const ox = (i % cols) * cw;
    const oy = Math.floor(i / cols) * ch;
    const at: Place = { x: ox + cw * (p.facing === 1 ? 0.62 : 0.38), y: oy + ch - 12, facing: p.facing };
    c.save();
    c.setTransform(k, 0, 0, k, 0, 40);
    c.beginPath();
    c.rect(ox, oy, cw, ch);
    c.clip();
    const pose = poseOf(p, dress);
    rig.drawActor(env, pose, dress, at);
    // ring the faults
    const m = measureDrawn(ins, pose, dress, at, sizeOf(dress));
    const joints = ins.joints(pose, dress, at);
    const names = ["root", "pelvis", "torso", "head", "armB.up", "armB.lo", "handB", "armF.up", "armF.lo", "handF"];
    c.strokeStyle = "#FF3B3B";
    c.lineWidth = 0.6;
    for (const f of m.faults) {
      const bone = f.where.startsWith("elbow") ? `arm${f.where.slice(-1)}.lo` : f.where.startsWith("wrist") ? `hand${f.where.slice(-1)}`
        : f.where.startsWith("shoulder") ? `arm${f.where.slice(-1)}.up` : names.includes(f.where) ? f.where : null;
      const i2 = bone === null ? -1 : names.indexOf(bone);
      if (i2 >= 0) { const [x, y] = joints[i2]!; c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.stroke(); }
    }
    c.restore();
    c.fillStyle = "#FFD23F";
    c.font = "bold 18px sans-serif";
    c.fillText(`${p.clip}${p.aim ? " @" + p.aim : ""} t${Math.round(p.t)} | ${p.kind} | b${p.build} ${p.facing === 1 ? "R" : "L"}`, ox * k + 8, oy * k + 40 + 22);
    c.fillStyle = "#F2E2C4";
    c.font = "16px sans-serif";
    c.fillText(p.note, ox * k + 8, oy * k + 40 + 44);
    c.strokeStyle = "#1E4A52";
    c.lineWidth = 2;
    c.strokeRect(ox * k, oy * k + 40, cw * k, ch * k);
  });
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`wrote ${out}`);
}

function describe(r: Row): string {
  const f = [...r.m.faults].sort((a, b) => b.value - a.value).slice(0, 3);
  return f.map((x) => `${x.kind} ${x.where} ${x.kind === "length" ? (x.value * 100).toFixed(1) + "%" : x.kind === "bend" || x.kind === "turn" ? x.value.toFixed(0) + "deg" : x.value.toFixed(2)}`).join(", ") || "clean";
}

/** Frame strips of the five throws with the item each is for, the item flying after the release
 *  (the stage's own flight path, from the hand anchor at the release, as `choreo/throw.ts`). */
function throwStrips(out: string): void {
  const rows: [string, HeldId][] = [["throw", "bricks"], ["throw", "paint-can"], ["throw-side", "boomerang"], ["throw-roll", "tyre"], ["throw-flick", "darts"], ["throw-heave", "sledgehammer"]];
  const cols = [0, 50, 95, 124, 152, 180, 215, 260];
  const cw = 70;
  const ch = 105;
  const k = 4;
  const W = cols.length * cw + 60;
  const canvas = createCanvas(W * k, rows.length * ch * k);
  const c = canvas.getContext("2d");
  c.fillStyle = "#0A262C";
  c.fillRect(0, 0, canvas.width, canvas.height);
  const cache = new Map<string, Path2D>();
  const env: DrawEnv = { ctx: c as unknown as DrawEnv["ctx"], path: (d: string) => { let p = cache.get(d); if (!p) { p = new Path2D(d); cache.set(d, p); } return p; } };
  rows.forEach(([clipName, item], r) => {
    const dress: Dress = { look: { build: r % 3, head: 0, hair: 0, face: 0, top: r % 2, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 }, held: item, shield: null, scale: 1 };
    const rel = rig.clipInfo("scrapper", clipName).events.find((e) => e.name === "release")!.t;
    const y = r * ch + ch - 10;
    cols.forEach((t, i) => {
      const x = i * cw + 34;
      const pose = rig.samplePose("scrapper", clipName, t);
      const after = t > rel;
      const keeps = item === "darts";
      c.save();
      c.setTransform(k, 0, 0, k, 0, 0);
      rig.drawActor(env, pose, after && !keeps ? { ...dress, held: null } : dress, { x, y, facing: 1 });
      if (after || t === rel) {
        const hand = rig.handAnchor(rig.samplePose("scrapper", clipName, rel), dress, { x, y, facing: 1 });
        const to = { x: x + 150, y: y - 45 };
        const path = makePath(flightKindOf(WEAPON_META[item]), hand.x, hand.y, to.x, to.y, 1, 300, hand.rot);
        for (let g = 0; g <= 12; g++) { const q = pointAt(path, g / 12); c.beginPath(); c.arc(q.x, q.y, 0.35, 0, Math.PI * 2); c.fillStyle = "#FFD23F"; c.fill(); }
        if (after) { const q = pointAt(path, (t - rel) / 300); rig.drawProp(env, item as Exclude<HeldId, "fists">, { x: q.x, y: q.y, facing: 1, rot: q.rot }); }
        c.beginPath(); c.arc(hand.x, hand.y, 1.2, 0, Math.PI * 2); c.strokeStyle = "#FF3B3B"; c.lineWidth = 0.35; c.stroke();
      }
      c.restore();
      c.fillStyle = t === rel ? "#FFD23F" : "#F2E2C4";
      c.font = "bold 22px sans-serif";
      c.fillText(`${t}${t === rel ? " release" : ""}`, (i * cw + 4) * k, (r * ch + 8) * k);
    });
    c.fillStyle = "#FFD23F";
    c.font = "bold 24px sans-serif";
    c.fillText(`${clipName}: ${item}`, 8 * k, (r * ch + 16) * k);
  });
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`wrote ${out}`);
}

const [mode, a1, a2] = process.argv.slice(2);
if (mode === "report") {
  const dir = resolve(a1 ?? ".review/joints");
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const rows = sweep(rig, ALL_CLIPS);
  const keys = ["apart", "open", "length", "socket", "grip", "bend", "turn"] as const;
  const summary: Record<string, unknown> = { frames: rows.length, ms: Date.now() - t0 };
  for (const k of keys) {
    const worst = rows.reduce((m, r) => (r.m[k] > m.m[k] ? r : m), rows[0]!);
    const limit = k === "socket" ? 0 : LIMITS[k];
    const bad = rows.filter((r) => r.m[k] > limit);
    const byClip: Record<string, number> = {};
    for (const r of bad) byClip[r.clip] = (byClip[r.clip] ?? 0) + 1;
    summary[k] = { worst: Number(worst.m[k].toFixed(3)), at: `${worst.clip} t${Math.round(worst.t)} ${worst.kind} b${worst.build} f${worst.facing}`, framesOver: bad.length, byClip };
    console.log(`${k.padEnd(7)} worst ${worst.m[k].toFixed(3)} at ${worst.clip} t${Math.round(worst.t)} ${worst.kind} b${worst.build} f${worst.facing}; ${bad.length} frames over (${Object.entries(byClip).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c} ${n}`).join(", ")})`);
  }
  const whereCount: Record<string, number> = {};
  for (const r of rows) for (const f of r.m.faults) { const key = `${f.kind} ${f.where}`; whereCount[key] = (whereCount[key] ?? 0) + 1; }
  summary.byWhere = whereCount;
  console.log("faults by joint:", Object.entries(whereCount).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(", "));
  console.log(`frames ${rows.length}, with any fault ${rows.filter((r) => r.m.faults.length > 0).length}, ${Date.now() - t0} ms`);
  const seen = new Set<string>();
  const picks: Pick[] = [];
  for (const r of [...rows].sort((a, b) => b.score - a.score)) {
    const key = `${r.clip}|${r.kind}`;
    if (seen.has(key) || picks.some((p) => p.clip === r.clip)) continue;
    seen.add(key);
    seen.add(r.clip);
    const pk: Pick = { clip: r.clip, kind: r.kind, build: r.build, facing: r.facing, t: r.t, note: describe(r) };
    if (r.aim !== undefined) pk.aim = r.aim;
    picks.push(pk);
    if (picks.length >= 12) break;
  }
  writeFileSync(resolve(dir, "summary.json"), JSON.stringify(summary, null, 1));
  writeFileSync(resolve(dir, "worst.json"), JSON.stringify(picks, null, 1));
  for (const p of picks) console.log(`  ${p.clip}${p.aim ? " @" + p.aim : ""} t${Math.round(p.t)} ${p.kind} b${p.build} f${p.facing}: ${p.note}`);
  sheet(picks, resolve(dir, "worst.png"), "Worst 12 drawn frames");
} else if (mode === "sheet") {
  const picks = (JSON.parse(readFileSync(resolve(a1!), "utf8")) as Pick[]).map((p) => {
    const kind = KINDS.find((x) => x.name === p.kind)!;
    const dress = dressOf(kind, p.build);
    const pose = poseOf(p, dress);
    const m = measureDrawn(ins, pose, dress, { x: 0, y: 0, facing: p.facing }, sizeOf(dress));
    return { ...p, note: describe({ ...p, m, score: 0 }).replace(/turn[^,]*,?/g, "") };
  });
  sheet(picks, resolve(a2!), process.argv[5] ?? "Same frames");
} else if (mode === "throws") {
  throwStrips(resolve(a1 ?? ".review/joints/throws.png"));
} else {
  console.log("modes: report <dir> | sheet <frames.json> <out.png> [title]");
}
