/**
 * Smoke test of the Node tool chain (work package 0). Run: pnpm smoke
 *
 * It settles three things before any lane depends on them:
 *   1. `tsx` runs a tool that imports the workspace's TypeScript packages.
 *   2. `@napi-rs/canvas` draws the rig through the contract's `Ctx2D` subset, paths included.
 *   3. `@napi-rs/canvas` registers a font, and a woff2 font in particular.
 *
 * It draws the capsule test double on the Yard and a strip of poses, and writes
 * .review/wp0/smoke.png. Open the picture: a number in a log is not evidence.
 *
 * About the font: the repo ships no font yet. The tool reads one from the operating system,
 * turns it into woff2 in memory with `subset-font`, and registers those bytes. Nothing from
 * that font is written to disk or committed.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import subsetFont from "subset-font";
import { WEAPON_META } from "@rankzero/core";
import { BOUT_FIXTURES, SNAPSHOTS } from "@rankzero/core/fixtures";
import { COMPANION_IDS } from "@rankzero/core";
import { SCRAPPER_CLIPS } from "@rankzero/rig";
import type { Dress, Place, RigId } from "@rankzero/rig";
import { capsuleRig as rig } from "@rankzero/rig/testing";
import { createSurface, registerFont, writePng } from "./lib/node-canvas.ts";

const OUT = ".review/wp0/smoke.png";
const SCALE = 3;
const STAGE_W = 360;
const STAGE_H = 240;
const STRIP_H = 150;
const FAMILY = "SmokeDisplay";

const SYSTEM_FONTS = [
  "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
];

async function loadFont(): Promise<string> {
  const file = SYSTEM_FONTS.find((f) => existsSync(f));
  if (file === undefined) return "no system font found; text uses the canvas default";
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;-+/()@%";
  try {
    const woff2 = await subsetFont(readFileSync(file), glyphs, { targetFormat: "woff2" });
    const magic = Buffer.from(woff2.subarray(0, 4)).toString("latin1");
    if (magic === "wOF2" && registerFont(woff2, FAMILY)) return `woff2 registered (${woff2.length} bytes, made in memory from a system font)`;
    if (registerFont(file, FAMILY)) return `woff2 was REFUSED (magic "${magic}"); the system ttf was registered instead`;
  } catch (error) {
    if (registerFont(file, FAMILY)) return `woff2 step failed (${String(error)}); the system ttf was registered instead`;
  }
  return "font registration FAILED; text uses the canvas default";
}

async function main(): Promise<void> {
  const fontNote = await loadFont();
  const s = createSurface(STAGE_W, STAGE_H + STRIP_H, SCALE, "#1B1E3F");
  const { env, raw } = s;

  // ---- the Yard with six actors, placed on the marks of the fight spec
  rig.drawYard(env, "back", 0);
  rig.drawYard(env, "floor", 0);

  const gate = BOUT_FIXTURES["bout-gate"];
  const reach = WEAPON_META.pipe.reach;
  interface Item { rig: RigId; clip: string; t: number; dress: Dress; at: Place }
  const items: Item[] = [
    { rig: "raccoon", clip: "idle", t: 300, dress: { held: null, door: false, scale: 1 }, at: { x: 40, y: 180, facing: 1 } },
    { rig: "goose", clip: "attack", t: 150, dress: { held: null, door: false, scale: 1 }, at: { x: 124, y: 206, facing: 1 } },
    { rig: "scrapper", clip: "win", t: 200, dress: { look: SNAPSHOTS.l20Thrower.look, held: "darts", door: true, scale: 1 }, at: { x: 70, y: 195, facing: 1 } },
    // the attacker stands where its dash stops: 26 + 10 x Reach units from the target
    { rig: "scrapper", clip: "swing", t: 150, dress: { look: gate.a.look, held: "pipe", door: false, scale: 1 }, at: { x: 290 - (26 + 10 * reach), y: 195, facing: 1 } },
    { rig: "scrapper", clip: "hit-light", t: 60, dress: { look: gate.b.look, held: "pocket-knife", door: false, scale: 1 }, at: { x: 290, y: 195, facing: -1 } },
    { rig: "boar", clip: "idle", t: 0, dress: { held: null, door: false, scale: 1 }, at: { x: 360 - 124, y: 206, facing: -1 } },
    { rig: "raccoon", clip: "ko", t: 600, dress: { held: null, door: false, scale: 1 }, at: { x: 360 - 40, y: 180, facing: -1 } },
  ];
  rig.drawProp(env, "bat", { x: 196, y: 222, facing: 1, rot: 8 });
  rig.drawProp(env, "car-door", { x: 22, y: 214, facing: 1, rot: -78 });
  for (const it of [...items].sort((p, q) => p.at.y - q.at.y)) {
    rig.drawActor(env, rig.samplePose(it.rig, it.clip, it.t), it.dress, it.at);
  }
  const hand = rig.handAnchor(rig.samplePose("scrapper", "swing", 150), items[3]!.at);
  rig.drawFx(env, "burst", 0.35, { x: 276, y: 150, facing: 1 }, 5);
  rig.drawFx(env, "whoosh", 0.5, { x: hand.x, y: hand.y, facing: 1 }, 5);
  rig.drawFx(env, "dust", 0.4, { x: 290, y: 195, facing: -1 }, 5);
  rig.drawFx(env, "plus", 0.3, { x: 124, y: 206, facing: 1 }, 5);

  // ---- text in the registered font
  raw.font = `22px ${FAMILY}`;
  raw.textBaseline = "top";
  raw.lineJoin = "round";
  raw.lineWidth = 4;
  raw.strokeStyle = "#14152B";
  raw.fillStyle = "#F4F5FA";
  raw.strokeText("RANK ZERO", 8, 6);
  raw.fillText("RANK ZERO", 8, 6);
  raw.font = `9px ${FAMILY}`;
  raw.fillStyle = "#FFD23F";
  raw.fillText("capsule rig smoke test: tsx + workspace packages + Node canvas", 8, 30);
  raw.fillStyle = "#14152B";
  raw.strokeStyle = "#F4F5FA";
  raw.lineWidth = 3;
  raw.strokeText("-13", 268, 112);
  raw.fillStyle = "#FF5A4E";
  raw.fillText("-13", 268, 112);

  // ---- a strip of poses, one per clip at its event time (or half way)
  raw.fillStyle = "#262A57";
  raw.fillRect(0, STAGE_H, STAGE_W, STRIP_H);
  const strip: (string | null)[] = ["idle", "dash", "brace", "punch", "flick", "swing", "smash", "thrust", "throw", "block", "evade", null, "ko-fall"];
  const cell = STAGE_W / strip.length;
  raw.font = `6.5px ${FAMILY}`;
  raw.textAlign = "center";
  strip.forEach((clip, i) => {
    if (clip === null) return;                            // room for the figure that lies down
    const info = rig.clipInfo("scrapper", clip);
    const t = clip === "ko-fall" ? info.durationMs : clip === "evade" ? info.durationMs / 2 : info.events[0]?.t ?? info.durationMs / 2;
    const x = cell * (i + 0.5);
    rig.drawActor(env, rig.samplePose("scrapper", clip, t),
      { look: SNAPSHOTS.l1Fists.look, held: clip === "swing" || clip === "smash" || clip === "thrust" ? "pipe" : null, door: false, scale: 0.62 },
      { x, y: STAGE_H + 86, facing: 1 });
    raw.fillStyle = "#F4F5FA";
    raw.fillText(clip, x, STAGE_H + 6);
    raw.fillStyle = "#C9CCE0";
    raw.fillText(`${Math.round(t)} ms`, x, STAGE_H + 14);
  });
  COMPANION_IDS.forEach((id, i) => {
    const x = 50 + i * 110;
    rig.drawActor(env, rig.samplePose(id, "run", 60), { held: null, door: false, scale: 0.6 }, { x, y: STAGE_H + 138, facing: 1 });
    raw.fillStyle = "#F4F5FA";
    raw.textAlign = "left";
    raw.fillText(`${id}: run`, x + 30, STAGE_H + 128);
  });
  raw.textAlign = "right";
  raw.fillStyle = "#C9CCE0";
  raw.fillText(`${SCRAPPER_CLIPS.length} scrapper clips in the contract`, STAGE_W - 6, STAGE_H + 140);

  // ---- write and check
  const file = writePng(s, OUT);
  const bytes = statSync(file).size;
  const data = raw.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
  const colours = new Set<number>();
  for (let i = 0; i < data.length; i += 4 * 97) colours.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
  console.log(`smoke: wrote ${file}`);
  console.log(`smoke: ${s.canvas.width} x ${s.canvas.height} px, ${bytes} bytes, ${colours.size} sampled colours`);
  console.log(`smoke: font: ${fontNote}`);
  if (bytes < 5000 || colours.size < 12) {
    console.error("smoke: the picture looks empty");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
