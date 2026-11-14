/**
 * Render a bout in Node (stage lane). Run:
 *   pnpm render-bout --fixture bout-gate --rig capsule
 *   pnpm render-bout --fixture bout-all-steps --rig capsule-gate --reduced
 *   pnpm render-bout --seed 1234 --rig gate              (needs the sim and the gate pack: after I1)
 *
 * Writes to .review/wp3/<name>-<rig>[-reduced]/ :
 *   stage.mp4             the stage at 60 fps, 2x (720 x 480), with a plain HP strip on top
 *   storyboard-<n>.png    the whole bout at 10 fps, 64 frames to a page, each frame labelled with its time
 *   contacts-<n>.png      for every moment of contact, frames -6 to +10 at 60 fps around it, cropped
 *                         on the target, the contact frame boxed in red, with the measured strike
 *                         point (red dot) and the target's hit point (white ring) on it
 * Flags: --rig capsule | capsule-gate | gate | full, --out <dir>, --no-video, --reduced, --seed-a/--seed-b
 * snapshot names for --seed. The arena is stageFor(log.seed), as the host passes it.
 *
 * Open the storyboards and the contact strips before calling a render done: a number in a log
 * is not evidence.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import * as core from "@rankzero/core";
import type { BoutLog, FighterSnapshot } from "@rankzero/core";
import { stageFor } from "@rankzero/core";
import { BOUT_FIXTURES, SNAPSHOTS } from "@rankzero/core/fixtures";
import type { BoutFixtureName } from "@rankzero/core/fixtures";
import * as rigPkg from "@rankzero/rig";
import type { Rig } from "@rankzero/rig";
import { toStage } from "@rankzero/rig";
import { capsuleGateRig, capsuleRig } from "@rankzero/rig/testing";
import type { PlayerOpts } from "../packages/stage/src/contracts.ts";
import { buildPlayer } from "../packages/stage/src/createFightPlayer.ts";
import type { StagePlayer } from "../packages/stage/src/createFightPlayer.ts";
import { REPO_ROOT, createSurface, registerFont, writePng } from "./lib/node-canvas.ts";
import type { Surface } from "./lib/node-canvas.ts";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);
const fail = (msg: string): never => {
  console.error(`render-bout: ${msg}`);
  process.exit(2);
};

const W = 360;
const H = 240;
const HUD_H = 26;
const FPS = 60;
const SCALE = 2;
const FONT_FILES = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"];

// ------------------------------------------------------------------ inputs

function pickRig(name: string): Rig {
  if (name === "capsule") return capsuleRig;
  if (name === "capsule-gate") return capsuleGateRig;
  const mod = rigPkg as unknown as Record<string, unknown>;
  const createRig = mod["createRig"] as ((g: unknown, c?: unknown) => Rig) | undefined;
  if (createRig === undefined || mod["gatePack"] === undefined) {
    return fail(`--rig ${name} needs createRig and gatePack from @rankzero/rig (the first integration); use capsule or capsule-gate`);
  }
  if (name === "gate") return createRig(mod["gatePack"]);
  if (name === "full") {
    if (mod["contentPack"] === undefined) return fail("--rig full needs contentPack from @rankzero/rig (the content merge)");
    return createRig(mod["gatePack"], mod["contentPack"]);
  }
  return fail(`unknown --rig "${name}": capsule, capsule-gate, gate or full`);
}

function pickBout(): { name: string; log: BoutLog; a: FighterSnapshot; b: FighterSnapshot } {
  const seed = arg("seed");
  if (seed !== undefined) {
    const sim = (core as unknown as Record<string, unknown>)["simulateFight"] as
      ((s: number, a: FighterSnapshot, b: FighterSnapshot, v: 1) => BoutLog) | undefined;
    if (sim === undefined) return fail("--seed needs simulateFight from @rankzero/core (the sim lane, after I1); use --fixture");
    const snaps = SNAPSHOTS as Record<string, FighterSnapshot>;
    const a = snaps[arg("seed-a") ?? "l1Pipe"] ?? fail("unknown --seed-a snapshot");
    const b = snaps[arg("seed-b") ?? "l1Knife"] ?? fail("unknown --seed-b snapshot");
    return { name: `seed-${seed}`, log: sim(Number(seed), a, b, 1), a, b };
  }
  const name = (arg("fixture") ?? "bout-gate") as BoutFixtureName;
  const fx = BOUT_FIXTURES[name] ?? fail(`unknown --fixture "${name}": ${Object.keys(BOUT_FIXTURES).join(", ")}`);
  return { name, log: fx.log, a: fx.a, b: fx.b };
}

// ------------------------------------------------------------------ drawing helpers

function hudStrip(raw: SKRSContext2D, player: StagePlayer, t: number, bout: { a: FighterSnapshot; b: FighterSnapshot }, font: string): void {
  const hud = player.hud(t);
  raw.save();
  raw.fillStyle = "#14152B";
  raw.fillRect(0, 0, W, HUD_H);
  const bar = (x: number, y: number, w: number, h: number, v: { now: number; trail: number; max: number }, right: boolean): void => {
    raw.fillStyle = "#3A3F7A";
    raw.fillRect(x, y, w, h);
    const tw = (w * Math.max(0, v.trail)) / v.max;
    const nw = (w * Math.max(0, v.now)) / v.max;
    raw.fillStyle = "#FF5A4E";
    raw.fillRect(right ? x + w - tw : x, y, tw, h);
    raw.fillStyle = "#22D3B6";
    raw.fillRect(right ? x + w - nw : x, y, nw, h);
  };
  const a0 = hud.hp.a0;
  const b0 = hud.hp.b0;
  if (a0 !== undefined) bar(6, 5, 130, 7, a0, false);
  if (b0 !== undefined) bar(W - 136, 5, 130, 7, b0, true);
  let ax = 6;
  let bx = W - 6;
  for (const id of ["a1", "a2", "a3", "b1", "b2", "b3"] as const) {
    const v = hud.hp[id];
    if (v === undefined) continue;
    if (id.startsWith("a")) { bar(ax, 15, 38, 4, v, false); ax += 42; } else { bx -= 38; bar(bx, 15, 38, 4, v, true); bx -= 4; }
  }
  raw.fillStyle = "#F4F5FA";
  raw.font = `7px ${font}`;
  raw.textBaseline = "top";
  raw.textAlign = "center";
  const names = hud.namesIn > 0 ? `${bout.a.name}  vs  ${bout.b.name}` : "";
  raw.fillText(`${(t / 1000).toFixed(2)} s  ${hud.phase}${hud.winner !== null ? ` (${hud.winner} wins)` : ""}  ${names}`, W / 2, 15);
  raw.restore();
}

/** One full frame (HUD strip + stage) at `scale`. The stage is drawn by the player on a surface
 *  of its own (the player sets its own transform) and copied under the strip. */
const stages = new Map<number, Surface>();
function frameSurface(player: StagePlayer, t: number, bout: { a: FighterSnapshot; b: FighterSnapshot }, scale: number, font: string, s?: Surface): Surface {
  const surf = s ?? createSurface(W, H + HUD_H, scale);
  let stage = stages.get(scale);
  if (stage === undefined) {
    stage = createSurface(W, H, scale);
    stages.set(scale, stage);
  }
  player.draw(stage.env, t, { w: W * scale, h: H * scale, dpr: 1 });
  const raw = surf.raw;
  raw.setTransform(1, 0, 0, 1, 0, 0);
  raw.drawImage(stage.canvas, 0, HUD_H * scale);
  raw.setTransform(scale, 0, 0, scale, 0, 0);
  hudStrip(raw, player, t, bout, font);
  return surf;
}

// ------------------------------------------------------------------ outputs

async function writeVideo(player: StagePlayer, bout: { a: FighterSnapshot; b: FighterSnapshot }, file: string, font: string): Promise<number> {
  const surf = createSurface(W, H + HUD_H, SCALE);
  const w = surf.canvas.width;
  const h = surf.canvas.height;
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-r", String(FPS),
    "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise<number>((res, rej) => { ff.on("error", rej); ff.on("close", (code) => res(code ?? 1)); });
  const frames = Math.ceil((player.timeline.durationMs / 1000) * FPS) + 1;
  for (let n = 0; n < frames; n++) {
    frameSurface(player, (n * 1000) / FPS, bout, SCALE, font, surf);
    const px = surf.raw.getImageData(0, 0, w, h).data;
    if (!ff.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) {
      await new Promise<void>((r) => ff.stdin.once("drain", () => r()));
    }
  }
  ff.stdin.end();
  const code = await done;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  return frames;
}

function writeStoryboard(player: StagePlayer, bout: { a: FighterSnapshot; b: FighterSnapshot }, dir: string, font: string): string[] {
  const cols = 8;
  const rows = 8;
  const thumb = 0.65;
  const cw = Math.round(W * thumb);
  const ch = Math.round((H + HUD_H) * thumb);
  const label = 14;
  const per = cols * rows;
  const times: number[] = [];
  for (let t = 0; t <= player.timeline.durationMs; t += 100) times.push(t);
  const files: string[] = [];
  const frame = createSurface(W, H + HUD_H, thumb);
  for (let page = 0; page * per < times.length; page++) {
    const slice = times.slice(page * per, (page + 1) * per);
    const sheet = createCanvas(cols * cw, Math.ceil(slice.length / cols) * (ch + label));
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#0B0C1A";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    slice.forEach((t, k) => {
      frameSurface(player, t, bout, thumb, font, frame);
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * (ch + label);
      sc.drawImage(frame.canvas, x, y + label);
      sc.fillStyle = "#F4F5FA";
      sc.font = `11px ${font}`;
      sc.textBaseline = "top";
      const step = player.hud(t).stepsShown;
      sc.fillText(`${(t / 1000).toFixed(1)} s  step<${step}`, x + 4, y + 1);
    });
    const out = resolve(dir, `storyboard-${page + 1}.png`);
    writePng({ canvas: sheet } as unknown as Surface, out);
    files.push(out);
  }
  return files;
}

function writeContacts(player: StagePlayer, rig: Rig, log: BoutLog, bout: { a: FighterSnapshot; b: FighterSnapshot }, dir: string, font: string): string[] {
  const scale = 2;
  const cropW = 150;
  const cropH = 112;
  const cell = { w: 180, h: 134 };
  const per = 9;
  const label = 16;
  const offsets: number[] = [];
  for (let k = -6; k <= 10; k++) offsets.push(k);
  const contacts = player.timeline.contacts;
  const perPage = 4;
  const rowsPer = 2;
  const files: string[] = [];
  const full = createSurface(W, H + HUD_H, scale);
  for (let page = 0; page * perPage < contacts.length; page++) {
    const list = contacts.slice(page * perPage, (page + 1) * perPage);
    const sheet = createCanvas(per * cell.w, list.length * (rowsPer * cell.h + label + 6));
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#0B0C1A";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    list.forEach((c, row) => {
      const ci = page * perPage + row;
      const step = log.steps[c.step]!;
      const target = step.t === "move" && step.hits !== undefined && step.hits.length > 0 ? step.hits[0]!.target
        : "target" in step && step.target !== undefined ? step.target : "actor" in step ? step.actor : "a0";
      const at0 = player.frame(c.at);
      const tg = at0.actors.find((a) => a.id === target);
      const centre = tg !== undefined ? { x: tg.place.x - tg.place.facing * 20, y: tg.place.y - 40 } : { x: 180, y: 150 };
      const cx = Math.max(cropW / 2, Math.min(W - cropW / 2, centre.x));
      const cy = Math.max(cropH / 2, Math.min(H - cropH / 2, centre.y));
      const y0 = row * (rowsPer * cell.h + label + 6);
      sc.fillStyle = "#F4F5FA";
      sc.font = `12px ${font}`;
      sc.textBaseline = "top";
      const what = `${step.t}${"outcome" in step ? ` ${step.outcome}` : ""}${"weapon" in step && step.weapon !== undefined ? ` ${String(step.weapon)}` : ""}`;
      sc.fillText(`contact ${ci}: step ${c.step} (${what}) at ${Math.round(c.at)} ms. Frames -6 to +10 at 60 fps; red box = contact frame`, 4, y0 + 2);
      offsets.forEach((k, n) => {
        const t = c.at + (k * 1000) / FPS;
        frameSurface(player, t, bout, scale, font, full);
        const f = player.frame(t);
        const x = (n % per) * cell.w;
        const y = y0 + label + Math.floor(n / per) * cell.h;
        sc.drawImage(full.canvas, (cx - cropW / 2) * scale, (cy - cropH / 2 + HUD_H) * scale, cropW * scale, cropH * scale, x, y, cell.w, cell.h - 12);
        const k2 = cell.w / cropW;
        const map = (p: { x: number; y: number }): [number, number] => [x + (p.x - (cx - cropW / 2)) * k2, y + (p.y - (cy - cropH / 2)) * k2];
        if (k === 0) {
          const a = f.actors.find((q) => q.seg?.strikes === ci);
          const tgt = f.actors.find((q) => q.id === target);
          if (a !== undefined) {
            const [sx, sy] = map(toStage(a.place, rig.strikePoint(a.rig, a.clip, a.dress, a.aim?.y)));
            sc.fillStyle = "#FF2E2E";
            sc.beginPath(); sc.arc(sx, sy, 3, 0, Math.PI * 2); sc.fill();
          }
          if (tgt !== undefined) {
            for (const zone of tgt.rig === "scrapper" ? (["head", "body"] as const) : (["body"] as const)) {
              const [hx, hy] = map(toStage(tgt.place, rig.hitPoint(tgt.rig, tgt.dress, zone)));
              sc.strokeStyle = "#FFFFFF";
              sc.lineWidth = 1.5;
              sc.beginPath(); sc.arc(hx, hy, 5, 0, Math.PI * 2); sc.stroke();
            }
          }
          sc.strokeStyle = "#FF2E2E";
          sc.lineWidth = 3;
          sc.strokeRect(x + 1.5, y + 1.5, cell.w - 3, cell.h - 15);
        }
        sc.fillStyle = k === 0 ? "#FF8080" : "#C9CCE0";
        sc.font = `10px ${font}`;
        sc.fillText(`${k >= 0 ? "+" : ""}${k}  ${Math.round(t)}`, x + 3, y + cell.h - 11);
      });
    });
    const out = resolve(dir, `contacts-${page + 1}.png`);
    writePng({ canvas: sheet } as unknown as Surface, out);
    files.push(out);
  }
  return files;
}

// ------------------------------------------------------------------ main

async function main(): Promise<void> {
  const rigName = arg("rig") ?? "capsule";
  const rig = pickRig(rigName);
  const bout = pickBout();
  const reduced = flag("reduced");
  let font = "sans-serif";
  const file = FONT_FILES.find((f) => existsSync(f));
  if (file !== undefined && registerFont(file, "RZDisplay")) font = "RZDisplay";
  else console.log("render-bout: no system font registered; text uses the canvas default");
  const opts: PlayerOpts = {
    reducedMotion: reduced, cosmeticSeed: 7, stage: stageFor(bout.log.seed),
    text: { fight: "FIGHT!", wins: (n) => `${n.toUpperCase()} WINS`, block: "BLOCK", miss: "MISS", crit: "CRIT",
      overtime: "OVERTIME", moveName: (id) => id.replace(/-/g, " "), skillName: (id) => id.replace(/-/g, " ") },
    fonts: { display: font, body: font },
  };
  const player = buildPlayer(bout.log, bout.a, bout.b, rig, opts);
  const dir = resolve(REPO_ROOT, arg("out") ?? `.review/wp3/${bout.name}-${rigName}${reduced ? "-reduced" : ""}`);
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (/^(storyboard|contacts)-\d+\.png$|^stage\.mp4$/.test(f)) rmSync(resolve(dir, f));
  mkdirSync(dir, { recursive: true });
  console.log(`render-bout: ${bout.name} on the ${rigName} rig, arena "${opts.stage}"${reduced ? ", reduced motion" : ""}`);
  console.log(`render-bout: ${Math.round(player.timeline.durationMs)} ms, ${player.timeline.contacts.length} contacts, ${player.timeline.cues.length} cues`);
  for (const f of writeStoryboard(player, bout, dir, font)) console.log(`render-bout: wrote ${f}`);
  for (const f of writeContacts(player, rig, bout.log, bout, dir, font)) console.log(`render-bout: wrote ${f}`);
  if (!flag("no-video")) {
    const video = resolve(dir, "stage.mp4");
    const n = await writeVideo(player, bout, video, font);
    console.log(`render-bout: wrote ${video} (${n} frames at ${FPS} fps)`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
