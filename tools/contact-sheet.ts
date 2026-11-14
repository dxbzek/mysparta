/**
 * Contact sheets of the rig, in Node (no browser). Any rig id, any clip, either pack.
 *
 *   pnpm sheet --mode frames --rig scrapper --clip swing --held pipe
 *   pnpm sheet --mode all --clip all                     (A2 + A3 for every gate clip)
 *   pnpm sheet --mode a1                                 (the A1 still-look sheet)
 *   pnpm sheet --mode joints                             (pins on every joint)
 *   pnpm sheet --mode frames --pack probe --rig goose --clip attack   (the 6-bone probe rig)
 *
 * Modes:
 *   a1       both looks in all builds at 91 px, 168 px and 4x; weapons in the hand and as 28 and
 *            44 px icons; the pair on the arena at 390 x 260
 *   joints   the neutral pose with a pin dot on every joint
 *   keys     A2: key poses as black silhouettes at 91 px (sheet A, unlabelled), and in colour with
 *            the line of action (sheet B)
 *   frames   A3: every 60 fps frame of the clip
 *   onion    A3: all frames of the clip over each other, real size and 3x
 *   video    A3: the clip looped (three times) as MP4 at real size and 3x (ffmpeg)
 *   use      the use strip of each gate weapon: wind-up, contact on a target, follow-through
 *   all      keys, frames, onion and video
 * Flags: --rig <RigId> (scrapper), --clip <name|all> (idle), --pack gate|probe (gate),
 *        --held <HeldId> (by clip: punch fists, flick pocket-knife, else pipe), --look 0|1,
 *        --out <dir> (.review/wp2), --scale <px per unit> (91/84).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, Path2D } from "@napi-rs/canvas";
import type { HeldId, Look } from "@rankzero/core";
import { COMPANION_CLIPS, GATE_CLIPS, toStage } from "../packages/rig/src/contracts.ts";
import type { ContentPack, DrawEnv, Dress, Place, Pose, Rig, RigId, SvgArt } from "../packages/rig/src/contracts.ts";
import { createRig } from "../packages/rig/src/engine/createRig.ts";
import { frames, modelOf } from "../packages/rig/src/engine/pose.ts";
import { probePack } from "../packages/rig/src/engine/probe.ts";
import { gatePack } from "../packages/rig/src/gate/pack.ts";
import { THROW } from "../packages/rig/src/gate/clips/throw.ts";
import { inspectOf } from "../packages/rig/src/engine/createRig.ts";
import { REPO_ROOT, createSurface, writePng } from "./lib/node-canvas.ts";
import type { Surface } from "./lib/node-canvas.ts";

export const PHONE = 91 / 84;            // px per unit on a 390 px phone (brief 3.12)
export const LOOKS: readonly Look[] = [
  { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 },
  { build: 1, head: 1, hair: 1, face: 1, top: 1, bottom: 1, shoes: 1, accessory: 1, skin: 1, hairColor: 1, palette: 1 },
];
const BG = "#0A262C";

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export function rigFor(pack: string): Rig {
  if (pack === "probe") return createRig(gatePack, probePack as ContentPack);
  if (pack === "gate") return createRig(gatePack);
  if (pack === "throw") return createRig(gatePack, { clips: { throw: THROW } } as unknown as ContentPack);
  throw new Error(`unknown --pack ${pack}: gate, throw or probe`);
}
export function heldFor(clip: string, given?: string): HeldId | null {
  if (given !== undefined) return given === "none" ? null : (given as HeldId);
  return clip === "punch" ? "fists" : clip === "flick" ? "pocket-knife" : "pipe";
}
export function dressOf(rigId: RigId, clip: string, look: number, held?: string): Dress {
  if (rigId !== "scrapper") return { held: null, door: false, scale: 1 };
  return { look: LOOKS[look % 2]!, held: heldFor(clip, held), door: false, scale: 1 };
}
export function clipsOf(rigId: RigId, which: string, pack = "gate"): string[] {
  if (which !== "all") return [which];
  if (rigId === "scrapper") return pack === "throw" ? [...GATE_CLIPS, "throw"] : [...GATE_CLIPS];
  return [...COMPANION_CLIPS];
}
/** Sample times of a clip at 60 fps, both ends included. */
export function frameTimes(rig: Rig, rigId: RigId, clip: string): number[] {
  const d = rig.clipInfo(rigId, clip).durationMs;
  const n = Math.round((d * 60) / 1000);
  return Array.from({ length: n + 1 }, (_, i) => (i * d) / n);
}
function label(s: Surface, text: string, x: number, y: number, size = 11, colour = "#F2E2C4"): void {
  const c = s.raw;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `${size}px sans-serif`;
  c.fillStyle = colour;
  c.fillText(text, x, y);
  c.restore();
}

/** A figure in a cell: `cellW x cellH` units, feet at `floor`. */
function drawCell(rig: Rig, env: DrawEnv, pose: Pose, dress: Dress, at: Place, floorColour = "#163A40"): void {
  const c = env.ctx;
  c.save();
  c.fillStyle = floorColour;
  c.fillRect(at.x - 60, at.y, 120, 1.2);
  c.restore();
  rig.drawActor(env, pose, dress, at);
}

// ------------------------------------------------------------------------------- A1 sheet
async function svgImage(art: SvgArt, px: number): Promise<Awaited<ReturnType<typeof loadImage>>> {
  const body = art.parts.map((p) => `<path d="${p.d}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth ?? 1}" stroke-linejoin="round"` : ""}${p.transform ? ` transform="${p.transform}"` : ""}/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${art.viewBox}">${body}</svg>`;
  return loadImage(Buffer.from(svg));
}
async function sheetA1(rig: Rig, out: string): Promise<string> {
  const W = 1560;
  const H = 1500;
  const canvas = createCanvas(W, H);
  const c = canvas.getContext("2d");
  c.fillStyle = "#0B1416";
  c.fillRect(0, 0, W, H);
  const cache = new Map<string, Path2D>();
  const env: DrawEnv = { ctx: c, path: (d) => { let p = cache.get(d); if (!p) { p = new Path2D(d); cache.set(d, p); } return p; } };
  const text = (t: string, x: number, y: number, size = 15): void => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = `bold ${size}px sans-serif`; c.fillStyle = "#F2E2C4"; c.fillText(t, x, y); c.restore(); };
  const idle = (held: HeldId | null, look: Look, scale = 1): { pose: Pose; dress: Dress } =>
    ({ pose: rig.samplePose("scrapper", "idle", 0), dress: { look, held, door: false, scale } });
  text("A1  style 13 - gritty comic, sodium streetlight. Both looks x 3 builds (lean, stocky, tall).", 20, 30, 18);
  // row 1: 91 px
  const row = (y: number, pxPerUnit: number, title: string, gap: number): void => {
    text(title, 20, y - 6);
    let x = 40;
    for (const [li, look0] of LOOKS.entries()) {
      for (let b = 0; b < 3; b++) {
        const look = { ...look0, build: b };
        const { pose, dress } = idle(li === 0 ? "pipe" : "pocket-knife", look);
        c.save();
        c.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
        const at = { x: (x + 30 * pxPerUnit) / pxPerUnit, y: (y + 96 * pxPerUnit) / pxPerUnit, facing: 1 as const };
        drawCell(rig, env, pose, dress, at);
        c.restore();
        x += gap;
      }
    }
  };
  row(60, PHONE, "91 px (phone stage size)", 90);
  row(200, 2, "168 px", 150);
  c.save();
  text("4x (364 px), both looks", 20, 420);
  for (const [li, look] of LOOKS.entries()) {
    const { pose, dress } = idle(li === 0 ? "pipe" : "pocket-knife", look);
    c.setTransform(4.33, 0, 0, 4.33, 0, 0);
    drawCell(rig, env, pose, dress, { x: (60 + li * 300) / 4.33 + 25, y: (430 + 380) / 4.33, facing: 1 });
  }
  c.restore();
  // weapons in hand (4x) and icons
  text("Weapons in the hand (swing / flick / punch at contact) and as 28 and 44 px icons", 680, 420);
  const atk: [string, HeldId, number][] = [["swing", "pipe", 0], ["flick", "pocket-knife", 1], ["punch", "fists", 0]];
  atk.forEach(([clip, held, li], i) => {
    const t = rig.clipInfo("scrapper", clip).events.find((e) => e.name === "contact")!.t;
    c.save();
    c.setTransform(2.6, 0, 0, 2.6, 0, 0);
    drawCell(rig, env, rig.samplePose("scrapper", clip, t), { look: LOOKS[li]!, held, door: false, scale: 1 }, { x: (680 + i * 290) / 2.6 + 18, y: 820 / 2.6, facing: 1 });
    c.restore();
  });
  let ix = 700;
  for (const ref of ["fists", "pipe", "pocket-knife", "stat:health", "stat:strength", "stat:agility", "stat:speed",
    "ui:pause", "ui:play", "ui:speed1", "ui:speed2", "ui:skip", "ui:sound", "ui:mute", "ui:replay"] as const) {
    const art = rig.icon(ref);
    c.fillStyle = "#13262A";
    c.fillRect(ix - 4, 846, 52, 92);
    c.drawImage(await svgImage(art, 28), ix, 850, 28, 28);
    c.drawImage(await svgImage(art, 44), ix, 886, 44, 44);
    ix += 56;
  }
  // the pair on the arena, 390 x 260, twice (the second at 2x for reading)
  text("On the arena at phone size (390 x 260) and the same at 2x", 20, 970);
  for (const [k, ox, oy] of [[390 / 360, 20, 980], [2, 430, 980]] as const) {
    c.save();
    c.setTransform(k, 0, 0, k, ox, oy);
    c.beginPath(); c.rect(0, 0, 360, 240); c.clip();
    rig.drawStage(env, "yard", "back", 0);
    rig.drawStage(env, "yard", "floor", 0);
    rig.drawActor(env, rig.samplePose("scrapper", "idle", 0), { look: LOOKS[0]!, held: "pipe", door: false, scale: 1 }, { x: 70, y: 195, facing: 1 });
    rig.drawActor(env, rig.samplePose("scrapper", "idle", 430), { look: LOOKS[1]!, held: "pocket-knife", door: false, scale: 1 }, { x: 290, y: 195, facing: -1 });
    c.restore();
    if (k === 2) break;
  }
  const file = resolve(out, "A1-still-look.png");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, canvas.toBuffer("image/png"));
  return file;
}

// ---------------------------------------------------------------------------- joints sheet
function sheetJoints(rig: Rig, rigId: RigId, pack: string, out: string): string {
  const k = 5;
  const s = createSurface(240, 120, k, BG);
  const dress = dressOf(rigId, "idle", 0);
  const pose = rig.samplePose(rigId, "idle", 0);
  const def = rigId === "scrapper" ? gatePack.scrapper : ((pack === "probe" ? probePack : null)?.companions?.[rigId]?.rig ?? gatePack.scrapper);
  const m = modelOf(def);
  // a neutral pose: every bone at 0 except what keeps it standing
  const neutral: Pose = { ...pose, rot: pose.rot.map(() => 0), root: { x: 0, y: 0, sx: 1, sy: 1 }, face: "neutral", lift: 0 };
  const places: [Pose, number][] = [[neutral, 60], [pose, 170]];
  for (const [p, x] of places) {
    const at: Place = { x, y: 106, facing: 1 };
    rig.drawActor(s.env, p, dress, at);
    const fr = frames(m, p.rot, p.root.x, p.root.y);
    const sc = (dress.scale) * (rigId === "scrapper" ? 1 : 1);
    const c = s.raw;
    fr.forEach((f, i) => {
      if (i === 0) return;
      const px = at.x + sc * f.e;
      const py = at.y + sc * f.f;
      c.beginPath(); c.arc(px, py, 1.15, 0, Math.PI * 2); c.fillStyle = "#FF3B30"; c.fill();
      c.lineWidth = 0.35; c.strokeStyle = "#FFFFFF"; c.stroke();
      label(s, m.def.bones[i]!.id, px * k + 7, py * k + 4, 11, "#FFFFFF");
    });
  }
  label(s, `${rigId}: every bone is its own piece on its own pin (left: all bones at 0; right: idle)`, 10, 18, 14);
  return writePng(s, resolve(out, `joints-${rigId}${pack === "probe" ? "-probe" : ""}.png`));
}

// ------------------------------------------------------------------------------ A2 sheets
function keyTimes(rig: Rig, rigId: RigId, clip: string): number[] {
  return [...new Set(inspectOf(rig).clip(rigId, clip).keys.map((k) => k.t))];
}
function sheetKeys(rig: Rig, rigId: RigId, clips: string[], pack: string, out: string, look: number): string[] {
  const cellW = 110;
  const cellH = 100;
  const items = clips.flatMap((clip) => keyTimes(rig, rigId, clip).map((t) => ({ clip, t })));
  const cols = 10;
  const rows = Math.ceil(items.length / cols);
  const files: string[] = [];
  for (const kind of ["A-silhouettes", "B-colour"] as const) {
    const s = createSurface(cols * cellW, rows * cellH, PHONE * (kind === "A-silhouettes" ? 1 : 2), kind === "A-silhouettes" ? "#F4F2EC" : BG);
    items.forEach((it, i) => {
      const x = (i % cols) * cellW + cellW / 2;
      const y = Math.floor(i / cols) * cellH + cellH - 8;
      const dress = dressOf(rigId, it.clip, look);
      const pose = rig.samplePose(rigId, it.clip, it.t);
      if (kind === "A-silhouettes") {
        // draw in white-flash mode onto a scratch surface, then stamp it black
        const tmp = createSurface(cellW, cellH, s.scale);
        rig.drawActor(tmp.env, pose, { ...dress, tint: "white" }, { x: cellW / 2, y: cellH - 8, facing: 1 });
        const img = tmp.raw.getImageData(0, 0, tmp.canvas.width, tmp.canvas.height);
        for (let p = 0; p < img.data.length; p += 4) {
          const a = img.data[p + 3]!;
          img.data[p] = 0; img.data[p + 1] = 0; img.data[p + 2] = 0; img.data[p + 3] = a > 40 ? 255 : 0;
        }
        tmp.raw.putImageData(img, 0, 0);
        s.raw.save(); s.raw.setTransform(1, 0, 0, 1, 0, 0);
        s.raw.drawImage(tmp.canvas, (x - cellW / 2) * s.scale, (y - cellH + 8) * s.scale);
        s.raw.restore();
      } else {
        rig.drawActor(s.env, pose, dress, { x, y, facing: 1 });
        // line of action: hip to neck to head, and the strike point
        const sp = rig.strikePoint(rigId, it.clip, dress);
        const hp = rig.hitPoint(rigId, dress, "head");
        void hp;
        label(s, `${it.clip} @${Math.round(it.t)}`, (x - cellW / 2 + 3) * s.scale, (y - cellH + 22) * s.scale, 12);
        if (rigId === "scrapper") {
          const def = gatePack.scrapper;
          const fr = frames(modelOf(def), pose.rot, pose.root.x, pose.root.y);
          const pts = [fr[11]!, fr[1]!, fr[3]!].map((f) => [x + f.e * pose.root.sx, y + f.f * pose.root.sy] as const);
          const head = fr[3]!;
          const top = [x + head.e + Math.sin((pose.rot.slice(0, 4).reduce((a, b) => a + b, 0)) * Math.PI / 180) * 12, y + head.f - 12] as const;
          const c = s.raw;
          c.save();
          c.strokeStyle = "#FFD23F"; c.lineWidth = 0.8; c.setLineDash([2, 1.5]);
          c.beginPath(); c.moveTo(pts[0]![0], pts[0]![1]);
          for (const p of [...pts.slice(1), top]) c.lineTo(p[0], p[1]);
          c.stroke(); c.restore();
        }
        if (rig.clipInfo(rigId, it.clip).events.some((e) => e.name === "contact" && Math.abs(e.t - it.t) < 1)) {
          const p = toStage({ x, y, facing: 1 }, sp);
          s.raw.beginPath(); s.raw.arc(p.x, p.y, 1.2, 0, Math.PI * 2); s.raw.fillStyle = "#FF3B30"; s.raw.fill();
        }
      }
    });
    files.push(writePng(s, resolve(out, `A2-${kind}${rigId === "scrapper" ? "" : "-" + rigId}${pack === "probe" ? "-probe" : ""}.png`)));
  }
  return files;
}

// ------------------------------------------------------------------------------ A3 sheets
function sheetFrames(rig: Rig, rigId: RigId, clip: string, pack: string, out: string, look: number, held?: string): string {
  const times = frameTimes(rig, rigId, clip);
  const cellW = 96;
  const cellH = 100;
  const cols = Math.min(10, times.length);
  const rows = Math.ceil(times.length / cols);
  const s = createSurface(cols * cellW, rows * cellH, PHONE * 2, BG);
  const dress = dressOf(rigId, clip, look, held);
  const info = rig.clipInfo(rigId, clip);
  times.forEach((t, i) => {
    const x = (i % cols) * cellW + cellW / 2 - 6;
    const y = Math.floor(i / cols) * cellH + cellH - 8;
    drawCell(rig, s.env, rig.samplePose(rigId, clip, t), dress, { x, y, facing: 1 });
    const ev = info.events.filter((e) => Math.abs(e.t - t) < 8.4).map((e) => e.name).join(" ");
    label(s, `${Math.round(t)}${ev ? " " + ev : ""}`, (x - cellW / 2 + 8) * s.scale, (y - cellH + 20) * s.scale, 12, ev ? "#FFD23F" : "#F2E2C4");
  });
  return writePng(s, resolve(out, `A3-frames-${rigId}-${clip}${pack === "probe" ? "-probe" : ""}.png`));
}
function sheetOnion(rig: Rig, rigId: RigId, clip: string, pack: string, out: string, look: number, held?: string): string {
  const times = frameTimes(rig, rigId, clip);
  const dress = dressOf(rigId, clip, look, held);
  const W = 170;
  const H = 120;
  const s = createSurface(W * 2 + W * 3, H * 3, 1, BG);
  // real size (left) and 3x (right)
  for (const [k, ox] of [[PHONE * 1, 0], [PHONE * 3, W * 1.1]] as const) {
    s.raw.save();
    s.raw.setTransform(k, 0, 0, k, ox * PHONE, 0);
    times.forEach((t, i) => {
      s.raw.globalAlpha = i === times.length - 1 || i === 0 ? 1 : 0.22;
      rig.drawActor(s.env, rig.samplePose(rigId, clip, t), dress, { x: 60, y: 100, facing: 1 });
    });
    s.raw.restore();
  }
  label(s, `${rigId} ${clip}: ${times.length} frames over each other (real size, 3x)`, 8, 16, 13);
  return writePng(s, resolve(out, `A3-onion-${rigId}-${clip}${pack === "probe" ? "-probe" : ""}.png`));
}
function video(rig: Rig, rigId: RigId, clip: string, pack: string, out: string, look: number, held?: string): string[] {
  const dress = dressOf(rigId, clip, look, held);
  const d = rig.clipInfo(rigId, clip).durationMs;
  const loops = rig.clipInfo(rigId, clip).loop ? 4 : 3;
  const n = Math.round((d * 60) / 1000);
  const files: string[] = [];
  for (const k of [1, 3]) {
    const dir = resolve(REPO_ROOT, ".review/wp2/.frames", `${clip}-${k}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let f = 0;
    for (let l = 0; l < loops; l++) {
      for (let i = 0; i < n + (rig.clipInfo(rigId, clip).loop ? 0 : 18); i++) {
        const t = Math.min(i, n) * (d / n);
        const s = createSurface(130, 110, PHONE * k, BG);
        drawCell(rig, s.env, rig.samplePose(rigId, clip, t), dress, { x: 55, y: 100, facing: 1 });
        writeFileSync(resolve(dir, `f${String(f++).padStart(5, "0")}.png`), s.canvas.toBuffer("image/png"));
      }
    }
    const file = resolve(out, `A3-loop-${rigId}-${clip}-${k}x${pack === "probe" ? "-probe" : ""}.mp4`);
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "60", "-i", resolve(dir, "f%05d.png"),
      "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", file], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${file}`);
    rmSync(dir, { recursive: true, force: true });
    files.push(file);
  }
  return files;
}

// --------------------------------------------------------------------------- use strips
function sheetUse(rig: Rig, out: string): string {
  const uses: [HeldId, string, number][] = [["fists", "punch", 0], ["pipe", "swing", 0], ["pocket-knife", "flick", 1]];
  const cellW = 130;
  const cellH = 110;
  const s = createSurface(cellW * 3, cellH * 3, PHONE * 2.4, BG);
  uses.forEach(([held, clip, look], r) => {
    const dress: Dress = { look: LOOKS[look]!, held, door: false, scale: 1 };
    const target: Dress = { look: LOOKS[1 - look]!, held: null, door: false, scale: 1 };
    const info = rig.clipInfo("scrapper", clip);
    const tc = info.events.find((e) => e.name === "contact")!.t;
    const head = rig.hitPoint("scrapper", target, "head");
    ["wind-up", "contact", "follow-through"].forEach((_, col) => {
      const t = col === 0 ? tc - 65 : col === 1 ? tc : tc + 45;
      const x0 = col * cellW;
      const y = r * cellH + cellH - 8;
      const sp = rig.strikePoint("scrapper", clip, dress, head.y);
      const ax = x0 + 32;
      const tx = ax + sp.x + head.x;       // the target stands where the aimed tip meets its head
      rig.drawActor(s.env, rig.samplePose("scrapper", "brace", 120), target, { x: tx, y, facing: -1 });
      rig.drawActor(s.env, rig.samplePose("scrapper", clip, t, { y: head.y, dress }), dress, { x: ax, y, facing: 1 });
      if (col === 1) {
        s.raw.beginPath(); s.raw.arc(ax + sp.x, y + sp.y, 2.2, 0, Math.PI * 2);
        s.raw.strokeStyle = "#FF3B30"; s.raw.lineWidth = 0.7; s.raw.stroke();
      }
    });
  });
  label(s, "Use strips (wind-up, contact, follow-through), each aimed at the target's head; red ring = the striking end at contact", 8, 16, 13);
  return writePng(s, resolve(out, "use-strips-gate-weapons.png"));
}

// ---------------------------------------------------------------------------------- main
async function main(): Promise<void> {
  const mode = arg("mode") ?? "frames";
  const pack = arg("pack") ?? "gate";
  const rigId = (arg("rig") ?? (pack === "probe" ? "goose" : "scrapper")) as RigId;
  const look = Number(arg("look") ?? 0);
  const held = arg("held");
  const out = resolve(REPO_ROOT, arg("out") ?? ".review/wp2");
  const rig = rigFor(pack);
  const clips = clipsOf(rigId, arg("clip") ?? (mode === "keys" || mode === "all" ? "all" : "idle"), pack);
  const wrote: string[] = [];
  if (mode === "a1") wrote.push(await sheetA1(rig, out));
  if (mode === "joints") wrote.push(sheetJoints(rig, rigId, pack, out));
  if (mode === "use") wrote.push(sheetUse(rig, out));
  if (mode === "keys" || mode === "all") wrote.push(...sheetKeys(rig, rigId, clips, pack, out, look));
  for (const clip of clips) {
    if (mode === "frames" || mode === "all") wrote.push(sheetFrames(rig, rigId, clip, pack, out, look, held));
    if (mode === "onion" || mode === "all") wrote.push(sheetOnion(rig, rigId, clip, pack, out, look, held));
    if (mode === "video" || mode === "all") wrote.push(...video(rig, rigId, clip, pack, out, look, held));
  }
  for (const f of wrote) console.log(`sheet: wrote ${f}`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
