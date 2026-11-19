/**
 * The look sheets (content v3, batch 4, plan 13.9): every look part, old and new, worn on a fighter.
 * Run: pnpm look-sheet [--out <dir>] (default .review/looks). It writes:
 *   looks-random.png    24 random looks of today's roll at the phone stage size (91 px tall) on the
 *                       alley floor, then the same 24 at 2x
 *   looks-builds.png    the 5 builds in the idle, at a swing's contact (Pipe) and knocked out (KO)
 *   looks-<part>.png    each part of the list (head, hair, face, top, bottom, shoes, accessory) on
 *                       all 5 builds at 2x, a close-up for the head parts; new parts are marked
 *   looks-colours.png   every skin, hair colour and outfit palette on a fighter
 * Open every sheet after a change to a look part.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, Path2D } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { HeldId, Look } from "@rankzero/core";
import { LOOK_SPACE, LOOK_SPACE_V1, combineSeed, rollLook } from "@rankzero/core";
import { contentPack } from "../packages/rig/src/content/pack.ts";
import type { DrawEnv, Dress } from "../packages/rig/src/contracts.ts";
import { createRig } from "../packages/rig/src/engine/createRig.ts";
import { gatePack } from "../packages/rig/src/gate/pack.ts";
import { REPO_ROOT } from "./lib/node-canvas.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--out");
const OUT = resolve(REPO_ROOT, at >= 0 ? args[at + 1]! : ".review/looks");
const only = args.indexOf("--only") >= 0 ? args[args.indexOf("--only") + 1]! : null;
mkdirSync(OUT, { recursive: true });
const rig = createRig(gatePack, contentPack);
const BUILD_NAMES = ["lean", "stocky", "tall", "heavy", "wiry"];
const BG = "#0B1416";
const CREAM = "#F2E2C4";
const MUTED = "#8FA3A0";
const ORANGE = "#E8923E";

function surface(w: number, h: number) {
  const cv = createCanvas(w, h);
  const c = cv.getContext("2d");
  c.fillStyle = BG;
  c.fillRect(0, 0, w, h);
  const cache = new Map<string, Path2D>();
  const env: DrawEnv = { ctx: c as never, path: (d) => { let p = cache.get(d); if (p === undefined) { p = new Path2D(d); cache.set(d, p); } return p; } };
  const save = (name: string): void => {
    const f = resolve(OUT, name);
    writeFileSync(f, cv.toBuffer("image/png"));
    console.log(`written: ${f}`);
  };
  return { c, env, save };
}
function label(c: SKRSContext2D, t: string, x: number, y: number, size = 14, colour = CREAM, align: "left" | "center" = "left"): void {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `bold ${size}px sans-serif`;
  c.fillStyle = colour;
  c.textAlign = align;
  c.fillText(t, x, y);
  c.restore();
}
function fighter(env: DrawEnv, c: SKRSContext2D, look: Look, x: number, y: number, k: number, opts: { clip?: string; t?: number; held?: HeldId | null; facing?: 1 | -1 } = {}): void {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  const dress: Dress = { look, held: opts.held ?? null, shield: null, scale: 1 };
  rig.drawActor(env, rig.samplePose("scrapper", opts.clip ?? "idle", opts.t ?? 0), dress, { x: 0, y: 0, facing: opts.facing ?? 1 });
  c.restore();
}
/** The floor strip of the yard under a row of fighters. */
function floor(env: DrawEnv, c: SKRSContext2D, x: number, y: number, w: number, k: number): void {
  c.save();
  c.beginPath();
  c.rect(x, y - 110 * k, w, 130 * k);
  c.clip();
  c.translate(x, y - 195 * k);
  c.scale(k, k);
  for (let i = 0; i * 360 * k < w; i++) {
    c.save();
    c.translate(i * 360, 0);
    rig.drawStage(env, "yard", "floor", 0);
    c.restore();
  }
  c.restore();
}

const BASE: Look = { build: 0, head: 0, hair: 0, face: 0, top: 0, bottom: 0, shoes: 0, accessory: 0, skin: 0, hairColor: 0, palette: 0 };
const PHONE = 91 / 84;

function randomSheet(): void {
  const looks = Array.from({ length: 24 }, (_, i) => rollLook(combineSeed("look-sheet", i), 0, 0));
  const helds: (HeldId | null)[] = [null, "pipe", "bat", "pocket-knife", null, "frying-pan", "crowbar", "golf-club"];
  const W = 1900;
  const { c, env, save } = surface(W, 1660);
  label(c, "Rank Zero looks: 24 random looks (today's roll) at the phone stage size, 91 px tall, then at 2x", 20, 32, 20);
  for (let row = 0; row < 2; row++) {
    const y = 190 + row * 150;
    floor(env, c, 20, y, W - 40, PHONE);
    for (let i = 0; i < 12; i++) {
      const n = row * 12 + i;
      fighter(env, c, looks[n]!, 70 + i * 152, y, PHONE, { t: n * 90, held: helds[n % helds.length]!, facing: n % 2 === 0 ? 1 : -1 });
      label(c, `#${n + 1} ${BUILD_NAMES[looks[n]!.build]}`, 40 + i * 152, y + 26, 12, MUTED);
    }
  }
  for (let row = 0; row < 4; row++) {
    const y = 640 + row * 255;
    for (let i = 0; i < 6; i++) {
      const n = row * 6 + i;
      fighter(env, c, looks[n]!, 120 + i * 300, y, 2.2, { t: n * 90, held: helds[n % helds.length]!, facing: 1 });
      const l = looks[n]!;
      label(c, `#${n + 1} ${BUILD_NAMES[l.build]} h${l.head} hr${l.hair} f${l.face} t${l.top} b${l.bottom} s${l.shoes} a${l.accessory}`, 30 + i * 300, y + 30, 12, MUTED);
    }
  }
  save("looks-random.png");
}

function buildsSheet(): void {
  const W = 1700;
  const { c, env, save } = surface(W, 960);
  label(c, "Rank Zero builds: lean, stocky, tall, heavy (new), wiry (new): idle, a Pipe swing at its contact, knocked out", 20, 32, 20);
  const swing = rig.clipInfo("scrapper", "swing");
  const contact = swing.events.find((e) => e.name === "contact")?.t ?? 150;
  const ko = rig.clipInfo("scrapper", "ko-fall").durationMs;
  const looks = [0, 1, 2, 3, 4].map((b) => ({ ...rollLook(combineSeed("builds", b), 0, 0), build: b }));
  for (let b = 0; b < 5; b++) {
    const x = 40 + b * 330;
    label(c, `${BUILD_NAMES[b]}${b >= 3 ? " (new)" : ""}`, x, 70, 18, b >= 3 ? ORANGE : CREAM);
    fighter(env, c, looks[b]!, x + 80, 300, 2.3, {});
    fighter(env, c, looks[b]!, x + 80, 590, 2.3, { clip: "swing", t: contact, held: "pipe" });
    fighter(env, c, looks[b]!, x + 110, 900, 2.3, { clip: "ko-fall", t: ko });
    // the same look in the plain gate look, so the build reads without clothes changing
    fighter(env, c, { ...BASE, build: b }, x + 250, 300, 1.4, {});
  }
  label(c, "idle", 6, 300, 13, MUTED);
  label(c, "swing", 6, 590, 13, MUTED);
  label(c, "KO", 6, 900, 13, MUTED);
  save("looks-builds.png");
}

type PartKey = "head" | "hair" | "face" | "top" | "bottom" | "shoes" | "accessory";
const PARTS: readonly PartKey[] = ["head", "hair", "face", "top", "bottom", "shoes", "accessory"];
const HEADY = new Set<PartKey>(["head", "hair", "face", "accessory"]);

/** One page per 4 parts: each part on the 5 builds at 3x (a close-up of the head at 7x for the
 *  head parts), so a page opens at a size where every line can be checked. */
function partSheet(part: PartKey, from = 0): void {
  const n = LOOK_SPACE[part];
  const parts = Array.from({ length: n }, (_, i) => i).filter((i) => i >= from);
  const pages = Math.ceil(parts.length / 4);
  for (let pg = 0; pg < pages; pg++) {
    const list = parts.slice(pg * 4, pg * 4 + 4);
    const rowH = 300;
    const W = 1300;
    const { c, env, save } = surface(W, 50 + list.length * rowH);
    label(c, `${part}s ${list[0]}-${list[list.length - 1]} of ${n} (${LOOK_SPACE_V1[part]} before batch 4; new in orange): lean, stocky, tall, heavy, wiry at 3x`, 12, 30, 18);
    list.forEach((i, r) => {
      const y0 = 50 + r * rowH;
      c.strokeStyle = "#1B3A3E";
      c.strokeRect(3, y0 + 3, W - 6, rowH - 6);
      const isNew = i >= LOOK_SPACE_V1[part];
      label(c, `${part} ${i}${isNew ? " NEW" : ""}`, 12, y0 + 24, 16, isNew ? ORANGE : CREAM);
      const look: Look = { ...BASE, palette: 4 + (i % 8), skin: i % 10, hairColor: i % 12, ...(part === "accessory" || part === "face" ? { hair: 1 } : {}), [part]: i };
      const step = HEADY.has(part) ? 150 : 205;
      for (let b = 0; b < 5; b++) fighter(env, c, { ...look, build: b }, 70 + b * step, y0 + rowH - 16, 3, { t: b * 100, facing: 1 });
      if (HEADY.has(part)) {
        c.save();
        c.beginPath();
        c.rect(800, y0 + 6, 490, rowH - 12);
        c.clip();
        fighter(env, c, look, 930, y0 + 670, 7.5, { facing: 1 });
        fighter(env, c, look, 1190, y0 + 560, 5.6, { facing: -1, clip: "hit-light", t: 90 });
        c.restore();
      }
    });
    save(`looks-${part}-${pg + 1}.png`);
  }
}

function coloursSheet(): void {
  const W = 1900;
  const { c, env, save } = surface(W, 900);
  label(c, "Rank Zero looks: 10 skins, 12 hair colours, 24 outfit palettes (new ones in orange)", 16, 34, 20);
  for (let i = 0; i < LOOK_SPACE.skin; i++) {
    fighter(env, c, { ...BASE, top: 1, skin: i }, 60 + i * 120, 230, 1.9, {});
    label(c, `skin ${i}`, 30 + i * 120, 252, 13, i >= LOOK_SPACE_V1.skin ? ORANGE : MUTED);
  }
  for (let i = 0; i < LOOK_SPACE.hairColor; i++) {
    fighter(env, c, { ...BASE, hair: 11, accessory: 1, hairColor: i }, 60 + i * 150, 480, 1.9, {});
    label(c, `hair colour ${i}`, 20 + i * 150, 502, 13, i >= LOOK_SPACE_V1.hairColor ? ORANGE : MUTED);
  }
  for (let i = 0; i < LOOK_SPACE.palette; i++) {
    fighter(env, c, { ...BASE, top: i % 2 === 0 ? 2 : 9, bottom: 3, shoes: 2, palette: i }, 40 + i * 77, 770, 1.45, {});
    label(c, `${i}`, 40 + i * 77, 790, 13, i >= LOOK_SPACE_V1.palette ? ORANGE : MUTED);
  }
  save("looks-colours.png");
}

if (only === null || only === "random") randomSheet();
if (only === null || only === "builds") buildsSheet();
const fromNew = args.includes("--new");
for (const p of PARTS) if (only === null || only === p) partSheet(p, fromNew ? LOOK_SPACE_V1[p] : 0);
if (only === null || only === "colours") coloursSheet();
