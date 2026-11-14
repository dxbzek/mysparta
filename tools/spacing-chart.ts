/**
 * Spacing chart of a clip, in Node: the path of the striking end (weapon tip, fist, a companion's
 * mouth; the hand for clips with no strike) at every 60 fps frame, drawn over the first and the
 * strike pose, with a bar per frame of how far it travelled. Even bars = no ease, which reads
 * as stiff; a strike should show small bars, then a few long ones into the contact.
 *
 *   pnpm spacing --rig scrapper --clip swing --held pipe
 *   pnpm spacing --clip all                              (every gate clip)
 *   pnpm spacing --pack probe --rig goose --clip attack  (the 6-bone probe rig)
 * Flags as `pnpm sheet`: --rig, --clip, --pack gate|probe|throw, --held, --look, --out.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Place, Rig, RigId } from "../packages/rig/src/contracts.ts";
import { strikeTime } from "../packages/rig/src/contracts.ts";
import { inspectOf } from "../packages/rig/src/engine/createRig.ts";
import { PHONE, arg, clipsOf, dressOf, frameTimes, rigFor } from "./contact-sheet.ts";
import { REPO_ROOT, createSurface, writePng } from "./lib/node-canvas.ts";

function chart(rig: Rig, rigId: RigId, clip: string, pack: string, out: string, look: number, held?: string): string {
  const ins = inspectOf(rig);
  const dress = dressOf(rigId, clip, look, held);
  const ts = frameTimes(rig, rigId, clip);
  const info = rig.clipInfo(rigId, clip);
  const strike = strikeTime(info);
  const at: Place = { x: 70, y: 150, facing: 1 };
  const k = PHONE * 3;
  const W = 230;
  const H = 230;
  const s = createSurface(W, H, k, "#0A262C");
  const c = s.raw;
  // the first pose faint, the strike pose solid
  c.save(); c.globalAlpha = 0.35;
  rig.drawActor(s.env, rig.samplePose(rigId, clip, 0), dress, at);
  c.restore();
  if (strike !== null) rig.drawActor(s.env, rig.samplePose(rigId, clip, strike), dress, at);
  else rig.drawActor(s.env, rig.samplePose(rigId, clip, ts[Math.floor(ts.length / 2)]!), dress, at);
  const name = strike !== null ? clip : "";
  const pts = ts.map((t) => ins.strikeEnd(rig.samplePose(rigId, clip, t), dress, at, name || "throw"));
  // path and frame dots
  c.strokeStyle = "#FFD23F"; c.lineWidth = 0.5; c.beginPath();
  pts.forEach((p, i) => (i === 0 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1])));
  c.stroke();
  pts.forEach((p, i) => {
    const t = ts[i]!;
    c.beginPath(); c.arc(p[0], p[1], 0.9, 0, Math.PI * 2);
    c.fillStyle = strike !== null && Math.abs(t - strike) < 8.4 ? "#FF3B30" : "#FFFFFF"; c.fill();
  });
  // per-frame travel bars along the bottom
  const steps = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const max = Math.max(1, ...steps);
  const bw = (W - 20) / Math.max(1, steps.length);
  steps.forEach((d, i) => {
    const h = (d / max) * 34;
    const t = ts[i + 1]!;
    c.fillStyle = strike !== null && t <= strike ? "#FF9E3D" : "#4CC9F0";
    c.fillRect(10 + i * bw, H - 6 - h, Math.max(0.6, bw - 0.6), h);
  });
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = "13px sans-serif"; c.fillStyle = "#F2E2C4";
  c.fillText(`${rigId} ${clip}: path of the striking end at 60 fps (red = strike frame); bars = travel per frame, max ${max.toFixed(1)} units (orange before the strike)`, 8, 16);
  c.restore();
  return writePng(s, resolve(out, `A3-spacing-${rigId}-${clip}${pack === "gate" ? "" : "-" + pack}.png`));
}

function main(): void {
  const pack = arg("pack") ?? "gate";
  const rigId = (arg("rig") ?? (pack === "probe" ? "goose" : "scrapper")) as RigId;
  const rig = rigFor(pack);
  const out = resolve(REPO_ROOT, arg("out") ?? ".review/wp2");
  for (const clip of clipsOf(rigId, arg("clip") ?? "all", pack)) {
    console.log(`spacing: wrote ${chart(rig, rigId, clip, pack, out, Number(arg("look") ?? 0), arg("held"))}`);
  }
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
