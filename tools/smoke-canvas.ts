/**
 * Smoke test of the Node tool chain (work package 0). Run: pnpm smoke
 *
 * It settles three things before any lane depends on them, and it FAILS when one is not so:
 *   1. `tsx` runs a tool that imports the workspace's TypeScript packages.
 *   2. `@napi-rs/canvas` draws the rig through the contract's `Ctx2D` subset, paths included.
 *      Proof: every one of the seven actors changes the pixels where it stands, the weapon
 *      tip is painted where `strikePoint` says it is, the target is painted where `hitPoint`
 *      says it is, and the five arenas come out in five different colours.
 *   3. `@napi-rs/canvas` registers a woff2 font. No woff2, no pass.
 *
 * It draws the capsule test double on the arena of the gate bout, a strip of poses and the
 * five arenas, and writes .review/wp0/smoke.png. Open the picture: a number in a log is not
 * evidence. The red dots are strike points and the white rings are hit points.
 *
 * About the font: the repo ships no font yet. The tool reads one from the operating system,
 * turns it into woff2 in memory with `subset-font`, and registers those bytes. Nothing from
 * that font is written to disk or committed. On a machine with no system font, run
 * `pnpm smoke --no-font`: the font step is then skipped and said so; everything else still runs.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import subsetFont from "subset-font";
import { COMPANION_IDS, STAGE_IDS, WEAPON_META, stageFor } from "@rankzero/core";
import type { HeldId } from "@rankzero/core";
import { BOUT_FIXTURES, SNAPSHOTS } from "@rankzero/core/fixtures";
import { SCRAPPER_CLIPS, strikeTime, toStage } from "@rankzero/rig";
import type { Dress, Place, RigId } from "@rankzero/rig";
import { capsuleRig as rig } from "@rankzero/rig/testing";
import { createSurface, registerFont, writePng } from "./lib/node-canvas.ts";
import type { Surface } from "./lib/node-canvas.ts";

const OUT = ".review/wp0/smoke.png";
const SCALE = 3;
const STAGE_W = 360;
const STAGE_H = 240;
const STRIP_H = 150;
const ARENAS_H = 66;
const FAMILY = "SmokeDisplay";
const NO_FONT = process.argv.includes("--no-font");

const SYSTEM_FONTS = [
  "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
];

const failures: string[] = [];

/** Registers woff2 bytes made in memory. Anything short of that is a failure, unless --no-font. */
async function loadFont(): Promise<string> {
  if (NO_FONT) return "SKIPPED (--no-font): no font was registered, text uses the canvas default";
  const file = SYSTEM_FONTS.find((f) => existsSync(f));
  if (file === undefined) {
    failures.push("font: no system font found to make a woff2 from (run with --no-font on a machine without one)");
    return "no system font found";
  }
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;-+/()@%";
  try {
    const woff2 = await subsetFont(readFileSync(file), glyphs, { targetFormat: "woff2" });
    const magic = Buffer.from(woff2.subarray(0, 4)).toString("latin1");
    if (magic !== "wOF2") {
      failures.push(`font: the subset is not woff2 (it starts with "${magic}")`);
      return "the woff2 step did not give woff2";
    }
    if (!registerFont(woff2, FAMILY)) {
      failures.push(`font: the canvas refused ${woff2.length} bytes of woff2`);
      return "woff2 was REFUSED by the canvas";
    }
    return `woff2 registered (${woff2.length} bytes, made in memory from a system font)`;
  } catch (error) {
    failures.push(`font: the woff2 step threw: ${String(error)}`);
    return "the woff2 step failed";
  }
}

interface Item { name: string; rig: RigId; clip: string; t: number; dress: Dress; at: Place }
/** Half width, height and the least count of changed pixels (at 1 px per unit) for each kind. */
const SIZE: Record<RigId, { half: number; tall: number; least: number }> = {
  scrapper: { half: 24, tall: 96, least: 280 },
  raccoon: { half: 24, tall: 32, least: 130 },
  goose: { half: 22, tall: 48, least: 130 },
  boar: { half: 44, tall: 60, least: 450 },
  "stray-dog": { half: 30, tall: 40, least: 160 },          // content v2 pets
  crow: { half: 18, tall: 34, least: 70 },
  "alley-cat": { half: 28, tall: 32, least: 110 },
};

/** How many pixels differ between two surfaces inside a box given in stage units. */
function changed(a: Surface, b: Surface, x0: number, y0: number, x1: number, y1: number): number {
  const px = Math.max(0, Math.floor(x0 * SCALE));
  const py = Math.max(0, Math.floor(y0 * SCALE));
  const w = Math.min(STAGE_W * SCALE, Math.ceil(x1 * SCALE)) - px;
  const h = Math.min(STAGE_H * SCALE, Math.ceil(y1 * SCALE)) - py;
  if (w <= 0 || h <= 0) return 0;
  const da = a.raw.getImageData(px, py, w, h).data;
  const db = b.raw.getImageData(px, py, w, h).data;
  let n = 0;
  for (let i = 0; i < da.length; i += 4) {
    if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) n += 1;
  }
  return n;
}
function boxOf(it: Item): [number, number, number, number] {
  const size = SIZE[it.rig];
  return [it.at.x - size.half, it.at.y - size.tall, it.at.x + size.half, it.at.y + 3];
}
function dot(s: Surface, p: { x: number; y: number }, colour: string, ring: boolean): void {
  const raw = s.raw;
  raw.beginPath();
  raw.arc(p.x, p.y, ring ? 3 : 1.6, 0, Math.PI * 2);
  if (ring) { raw.strokeStyle = colour; raw.lineWidth = 0.9; raw.stroke(); } else { raw.fillStyle = colour; raw.fill(); }
}

async function main(): Promise<void> {
  const fontNote = await loadFont();
  const gate = BOUT_FIXTURES["bout-gate"];
  const arena = stageFor(gate.log.seed);
  const drawArena = (s: Surface): void => {
    rig.drawStage(s.env, arena, "back", 0);
    rig.drawStage(s.env, arena, "floor", 0);
  };

  // ---- the actors, on the marks of the fight spec
  const target: Item = { name: "scrapper hit by the pipe", rig: "scrapper", clip: "hit-light", t: 0,
    dress: { look: gate.b.look, held: "pocket-knife", shield: null, scale: 1 }, at: { x: 290, y: 195, facing: -1 } };
  const swingDress: Dress = { look: gate.a.look, held: "pipe", shield: null, scale: 1 };
  // The attacker stops where its strike point meets the target's hit point. No constant.
  const hit = toStage(target.at, rig.hitPoint("scrapper", target.dress, "body"));
  const reach = rig.strikePoint("scrapper", "swing", swingDress);
  const attacker: Item = { name: "scrapper swinging the pipe", rig: "scrapper", clip: "swing", t: strikeTime(rig.clipInfo("scrapper", "swing")) ?? 0,
    dress: swingDress, at: { x: hit.x - reach.x, y: 195, facing: 1 } };
  const strike = toStage(attacker.at, reach);
  const items: Item[] = [
    { name: "raccoon idle", rig: "raccoon", clip: "idle", t: 300, dress: { held: null, shield: null, scale: 1 }, at: { x: 40, y: 180, facing: 1 } },
    { name: "goose attacking", rig: "goose", clip: "attack", t: 150, dress: { held: null, shield: null, scale: 1 }, at: { x: 124, y: 206, facing: 1 } },
    { name: "scrapper with a shield, winning", rig: "scrapper", clip: "win", t: 200, dress: { look: SNAPSHOTS.l20Thrower.look, held: "darts", shield: "car-door", scale: 1 }, at: { x: 70, y: 195, facing: 1 } },
    attacker,
    target,
    { name: "boar idle", rig: "boar", clip: "idle", t: 0, dress: { held: null, shield: null, scale: 1 }, at: { x: 360 - 124, y: 206, facing: -1 } },
    { name: "raccoon knocked out", rig: "raccoon", clip: "ko", t: 600, dress: { held: null, shield: null, scale: 1 }, at: { x: 360 - 40, y: 180, facing: -1 } },
  ];
  const drawItem = (s: Surface, it: Item): void => rig.drawActor(s.env, rig.samplePose(it.rig, it.clip, it.t), it.dress, it.at);

  // ---- probes on separate surfaces: the arena alone, then the arena with one actor
  const empty = createSurface(STAGE_W, STAGE_H, SCALE, "#1B1E3F");
  drawArena(empty);
  for (const it of items) {
    const alone = createSurface(STAGE_W, STAGE_H, SCALE, "#1B1E3F");
    drawArena(alone);
    drawItem(alone, it);
    const least = SIZE[it.rig].least * SCALE * SCALE;
    const n = changed(empty, alone, ...boxOf(it));
    if (n < least) failures.push(`actor: "${it.name}" changed ${n} pixels where it stands, fewer than ${least}`);
    if (it === attacker) {
      // The weapon tip is painted where strikePoint says the striking end is.
      const near = changed(empty, alone, strike.x - 2.5, strike.y - 1.5, strike.x + 0.5, strike.y + 1.5);
      const past = changed(empty, alone, strike.x + 1.5, strike.y - 1.5, strike.x + 4.5, strike.y + 1.5);
      if (near < 12) failures.push(`strike point: only ${near} painted pixels just behind the tip at ${strike.x.toFixed(1)}, ${strike.y.toFixed(1)}`);
      if (past > 0) failures.push(`strike point: ${past} painted pixels beyond the tip, so the weapon is longer than strikePoint says`);
    }
    if (it === target) {
      const on = changed(empty, alone, hit.x - 1, hit.y - 1, hit.x + 1, hit.y + 1);
      if (on < 30) failures.push(`hit point: the target has only ${on} painted pixels at its body hit point`);
    }
  }
  if (Math.abs(strike.x - hit.x) > 1e-6) failures.push(`placement: the strike point is ${Math.abs(strike.x - hit.x).toFixed(3)} units from the hit point in x`);

  // ---- the picture
  const s = createSurface(STAGE_W, STAGE_H + STRIP_H + ARENAS_H, SCALE, "#1B1E3F");
  const { env, raw } = s;
  drawArena(s);
  rig.drawProp(env, "bat", { x: 196, y: 220, facing: 1, rot: 8 });
  rig.drawProp(env, "car-door", { x: 22, y: 214, facing: 1, rot: -78 });
  for (const it of [...items].sort((p, q) => p.at.y - q.at.y)) drawItem(s, it);
  for (const it of items) {
    const least = SIZE[it.rig].least * SCALE * SCALE;
    const n = changed(empty, s, ...boxOf(it));
    if (n < least) failures.push(`picture: "${it.name}" is missing from the final picture (${n} changed pixels, fewer than ${least})`);
  }
  const hand = rig.handAnchor(rig.samplePose("scrapper", "swing", attacker.t), attacker.dress, attacker.at);
  rig.drawFx(env, "whoosh", 0.5, { x: hand.x, y: hand.y, facing: 1 }, 5);
  rig.drawFx(env, "dust", 0.4, { x: 290, y: 195, facing: -1 }, 5);
  rig.drawFx(env, "plus", 0.3, { x: 124, y: 206, facing: 1 }, 5);
  dot(s, hit, "#FFFFFF", true);
  dot(s, strike, "#FF2E2E", false);

  // ---- text in the registered font
  const family = NO_FONT ? "sans-serif" : FAMILY;
  raw.font = `22px ${family}`;
  raw.textBaseline = "top";
  raw.lineJoin = "round";
  raw.lineWidth = 4;
  raw.strokeStyle = "#14152B";
  raw.fillStyle = "#F4F5FA";
  raw.strokeText("RANK ZERO", 8, 6);
  raw.fillText("RANK ZERO", 8, 6);
  raw.font = `9px ${family}`;
  raw.fillStyle = "#FFD23F";
  raw.fillText(`capsule rig smoke test: tsx + workspace packages + Node canvas, arena "${arena}"`, 8, 30);
  raw.lineWidth = 3;
  raw.strokeStyle = "#F4F5FA";
  raw.strokeText("-13", hit.x - 8, hit.y - 34);
  raw.fillStyle = "#FF5A4E";
  raw.fillText("-13", hit.x - 8, hit.y - 34);

  // ---- a strip of poses: each weapon on its own clip at its strike, with the strike point
  raw.fillStyle = "#262A57";
  raw.fillRect(0, STAGE_H, STAGE_W, STRIP_H);
  const strip: ([clip: string, held: HeldId | null] | null)[] = [["idle", null], ["dash", null], ["punch", "fists"],
    ["flick", "pocket-knife"], ["swing", "pipe"], ["swing", "bike-chain"], ["smash", "sledgehammer"], ["thrust", "broom"],
    ["throw", "darts"], ["block", null], ["evade", null], null, ["ko-fall", null]];
  const cell = STAGE_W / strip.length;
  const shrink = 0.6;
  raw.textAlign = "center";
  strip.forEach((entry, i) => {
    if (entry === null) return;                           // room for the figure that lies down
    const [clip, held] = entry;
    const info = rig.clipInfo("scrapper", clip);
    const t = clip === "ko-fall" ? info.durationMs : clip === "evade" ? info.durationMs / 2 : strikeTime(info) ?? info.durationMs / 2;
    const x = cell * (i + 0.5) - (held !== null && WEAPON_META[held].reach > 1 ? 6 : 0);
    const dress: Dress = { look: SNAPSHOTS.l1Fists.look, held, shield: null, scale: 1 };
    // The whole figure is made smaller by the canvas, not by `Dress.scale`: a weapon keeps its size.
    raw.save();
    raw.translate(x, STAGE_H + 88);
    raw.scale(shrink, shrink);
    rig.drawActor(env, rig.samplePose("scrapper", clip, t), dress, { x: 0, y: 0, facing: 1 });
    if (strikeTime(info) !== null) {
      const p = rig.strikePoint("scrapper", clip, dress);
      raw.beginPath();
      raw.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      raw.fillStyle = "#FF2E2E";
      raw.fill();
    }
    raw.restore();
    raw.font = `6px ${family}`;
    raw.fillStyle = "#F4F5FA";
    raw.fillText(clip, cell * (i + 0.5), STAGE_H + 5);
    raw.fillStyle = "#C9CCE0";
    // Two label rows, so long weapon names in neighbouring cells do not run into each other.
    raw.fillText(held === null ? `${Math.round(t)} ms` : held, cell * (i + 0.5), STAGE_H + 13 + (i % 2) * 7);
  });
  COMPANION_IDS.forEach((id, i) => {
    const x = 50 + i * 110;
    raw.save();
    raw.translate(x, STAGE_H + 140);
    raw.scale(shrink, shrink);
    rig.drawActor(env, rig.samplePose(id, "attack", 150), { held: null, shield: null, scale: 1 }, { x: 0, y: 0, facing: 1 });
    const p = rig.strikePoint(id, "attack", { held: null, shield: null, scale: 1 });
    raw.beginPath();
    raw.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    raw.fillStyle = "#FF2E2E";
    raw.fill();
    raw.restore();
    raw.fillStyle = "#F4F5FA";
    raw.textAlign = "left";
    raw.fillText(`${id}: attack`, x + 44, STAGE_H + 130);
  });
  raw.textAlign = "right";
  raw.fillStyle = "#C9CCE0";
  raw.fillText(`${SCRAPPER_CLIPS.length} scrapper clips in the contract`, STAGE_W - 6, STAGE_H + 142);

  // ---- the five arenas, small
  const top = STAGE_H + STRIP_H;
  raw.fillStyle = "#14152B";
  raw.fillRect(0, top, STAGE_W, ARENAS_H);
  const thumb = 0.19;
  const walls = new Set<string>();
  const floors = new Set<string>();
  STAGE_IDS.forEach((id, i) => {
    const x = 3 + i * (STAGE_W - 6) / STAGE_IDS.length;
    raw.save();
    raw.translate(x, top + 4);
    raw.scale(thumb, thumb);
    rig.drawStage(env, id, "back", 0);
    rig.drawStage(env, id, "floor", 0);
    rig.drawActor(env, rig.samplePose("scrapper", "idle", 0), { look: gate.a.look, held: "pipe", shield: null, scale: 1 }, { x: 70, y: 195, facing: 1 });
    rig.drawActor(env, rig.samplePose("scrapper", "idle", 500), { look: gate.b.look, held: "pocket-knife", shield: null, scale: 1 }, { x: 290, y: 195, facing: -1 });
    raw.restore();
    const pixel = (ux: number, uy: number): string => {
      const d = raw.getImageData(Math.round((x + ux * thumb) * SCALE), Math.round((top + 4 + uy * thumb) * SCALE), 1, 1).data;
      return `${d[0]},${d[1]},${d[2]}`;
    };
    walls.add(pixel(10, 12));
    floors.add(pixel(10, 230));
    raw.font = `6px ${family}`;
    raw.textAlign = "left";
    raw.fillStyle = "#F4F5FA";
    raw.fillText(id, x, top + 54);
  });
  if (walls.size !== STAGE_IDS.length || floors.size !== STAGE_IDS.length) {
    failures.push(`arenas: ${walls.size} wall colours and ${floors.size} floor colours for ${STAGE_IDS.length} arenas`);
  }

  // ---- write and report
  const file = writePng(s, OUT);
  const bytes = statSync(file).size;
  console.log(`smoke: wrote ${file}`);
  console.log(`smoke: ${s.canvas.width} x ${s.canvas.height} px, ${bytes} bytes`);
  console.log(`smoke: font: ${fontNote}`);
  console.log(`smoke: probes: ${items.length} actors alone and in the picture, the strike point, the hit point, ${STAGE_IDS.length} arenas`);
  if (bytes < 5000) failures.push(`file: the PNG is only ${bytes} bytes`);
  if (failures.length > 0) {
    console.error(`smoke FAILED: ${failures.length} check${failures.length === 1 ? "" : "s"}\n` + failures.map((f) => "  " + f).join("\n"));
    process.exit(1);
  }
  console.log("smoke ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
