/**
 * The gear sheet (content v3, batch 2): all 30 pieces of body equipment worn on a fighter, facing
 * right and facing left, at 2x and at fight size (91 px for a standing fighter, the phone stage),
 * with the 28 and 44 px icons. Run: pnpm gear-sheet [--out <file>] (default .review/gear-sheet.png)
 * [--build <0-4>] (every piece on that build: 3 heavy, 4 wiry) [--new] (worn over the batch-4 look
 * parts: new heads, hair, tops, bottoms, shoes and accessories, so a hat over an afro or boots over
 * runners can be checked).
 */
import { resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { GearId, Look } from "@rankzero/core";
import { GEAR_IDS, GEAR_META, RARITY_OF } from "@rankzero/core";
import { contentPack } from "../packages/rig/src/content/pack.ts";
import type { DrawEnv, Dress, SvgArt } from "../packages/rig/src/contracts.ts";
import { createRig } from "../packages/rig/src/engine/createRig.ts";
import { REPO_ROOT } from "./lib/node-canvas.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Path2D } from "@napi-rs/canvas";
import { gatePack } from "../packages/rig/src/gate/pack.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--out");
const OUT = resolve(REPO_ROOT, at >= 0 ? args[at + 1]! : ".review/gear-sheet.png");
const rig = createRig(gatePack, contentPack);

async function svgImage(art: SvgArt, px: number) {
  const body = art.parts.map((p) => `<path d="${p.d}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth ?? 1}" stroke-linejoin="round"` : ""}${p.transform ? ` transform="${p.transform}"` : ""}/>`).join("");
  return loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${art.viewBox}">${body}</svg>`));
}

const bi = args.indexOf("--build");
const BUILD = bi >= 0 ? Number(args[bi + 1]) : null;
const NEW = args.includes("--new");
const LOOKS0: Look[] = NEW ? [
  { build: 3, head: 6, hair: 11, face: 10, top: 9, bottom: 6, shoes: 4, accessory: 6, skin: 8, hairColor: 9, palette: 14 },
  { build: 4, head: 8, hair: 12, face: 11, top: 11, bottom: 5, shoes: 5, accessory: 9, skin: 9, hairColor: 10, palette: 18 },
] : [
  { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 },
  { build: 1, head: 1, hair: 1, face: 1, top: 1, bottom: 1, shoes: 1, accessory: 0, skin: 1, hairColor: 2, palette: 2 },
];
const LOOKS: Look[] = BUILD === null ? LOOKS0 : LOOKS0.map((l) => ({ ...l, build: BUILD }));
const CELL_W = 330;
const CELL_H = 300;
const COLS = 6;
const ROWS = 5;
const W = CELL_W * COLS;
const H = CELL_H * ROWS + 60;
const canvas = createCanvas(W, H);
const c = canvas.getContext("2d");
c.fillStyle = "#0A262C";
c.fillRect(0, 0, W, H);
const cache = new Map<string, Path2D>();
const env: DrawEnv = { ctx: c as never, path: (d) => { let p = cache.get(d); if (p === undefined) { p = new Path2D(d); cache.set(d, p); } return p; } };

function fighter(gear: GearId, x: number, y: number, k: number, facing: 1 | -1, look: Look, clip = "idle", t = 0, held: Dress["held"] = null): void {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  const dress: Dress = { look, held, shield: null, scale: 1, gear: { [GEAR_META[gear].slot]: gear } };
  rig.drawActor(env, rig.samplePose("scrapper", clip, t), dress, { x: 0, y: 0, facing });
  c.restore();
}

c.fillStyle = "#F4F2EC";
c.font = "bold 22px sans-serif";
c.fillText(`Rank Zero gear sheet: 30 pieces, facing right and left at 2x, at fight size (91 px), and the 28 / 44 px icons${BUILD !== null ? `, on the ${["lean", "stocky", "tall", "heavy", "wiry"][BUILD]} build` : ""}${NEW ? ", over batch-4 parts" : ""}`, 16, 36);
for (let i = 0; i < GEAR_IDS.length; i++) {
  const id = GEAR_IDS[i]!;
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x0 = col * CELL_W;
  const y0 = 60 + row * CELL_H;
  c.strokeStyle = "#1B5560";
  c.strokeRect(x0 + 2, y0 + 2, CELL_W - 4, CELL_H - 4);
  const look = LOOKS[i % 2]!;
  fighter(id, x0 + 70, y0 + 240, 2.2, 1, look, "idle", 0, id.includes("glove") || id === "taped-fists" || id === "oven-mitts" ? null : "pipe");
  fighter(id, x0 + 200, y0 + 240, 2.2, -1, look, "brace", 120);
  fighter(id, x0 + 290, y0 + 240, 91 / 84, 1, look);
  const art = rig.icon(id);
  c.drawImage(await svgImage(art, 44), x0 + CELL_W - 52, y0 + 8, 44, 44);
  c.drawImage(await svgImage(art, 28), x0 + CELL_W - 86, y0 + 16, 28, 28);
  c.fillStyle = "#F4F2EC";
  c.font = "bold 16px sans-serif";
  c.fillText(id, x0 + 10, y0 + 24);
  c.font = "13px sans-serif";
  c.fillStyle = "#B9A27A";
  c.fillText(`${GEAR_META[id].slot} / ${RARITY_OF[id]}`, x0 + 10, y0 + 42);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, canvas.toBuffer("image/png"));
console.log(`written: ${OUT}`);
