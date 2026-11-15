/**
 * The owner's full graphic sheets of the content art (not a test; run with tsx):
 *
 *   npx tsx packages/rig/test/content/art-sheets.ts <outDir>
 *
 *   A Fighters  8 random looks at phone stage size, 2 at 4x, the 3 builds
 *   B Weapons   all 41 weapons and 6 shields, in the hand and as a 44 px icon, name and rarity
 *   C Pets      the 6 pets with a pin on every joint, name and rarity
 *   D Skills    the 39 skill icons at 64 and 32 px with names
 *   E Arenas    the 5 arenas full width, two fighters on each, and each at phone size
 *   F Icons     every icon at 64, 44 and 28 px, and as a black silhouette
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, loadImage, Path2D } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { CompanionId, HeldId, Look, PerkId, ShieldId, SkillId, StageId } from "@rankzero/core";
import { COMPANION_IDS, LOOK_SPACE, RARITY_OF, SHIELD_IDS, SKILL_IDS, STAGE_IDS, WEAPON_IDS } from "@rankzero/core";
import type { DrawEnv, Dress, IconArt, SvgArt } from "../../src/contracts";
import { createRig, inspectOf } from "../../src/engine/createRig";
import { iconArt } from "../../src/engine/svg";
import { gatePack } from "../../src/gate/pack";
import { hash01 } from "../../src/gate/vocab";
import { CONTENT_UI_ICONS, FRAME_PARTS, GATE_UI_ICONS_REDRAW, SHIELD_ICONS, STAT_ICONS_REDRAW, WEAPON_ICONS } from "../../src/content/icons";
import { contentPack } from "../../src/content/pack";

const OUT = resolve(process.argv[2] ?? ".review/wp6");
mkdirSync(OUT, { recursive: true });
const rig = createRig(gatePack, contentPack);
const ins = inspectOf(rig);

const BG = "#0B1416";
const PANEL = "#10201F";
const CREAM = "#F2E2C4";
const ORANGE = "#E8923E";
const MUTED = "#8FA3A0";
const RARITY_COLOUR: Record<string, string> = { common: "#B9B2A4", uncommon: "#5BD66F", rare: "#4CC9F0", epic: "#A78BFA", mythic: "#F2C200" };
const PHONE = 390 / 360;

function surface(w: number, h: number): { c: SKRSContext2D; env: DrawEnv; save: (name: string) => string } {
  const cv = createCanvas(w, h);
  const c = cv.getContext("2d");
  c.fillStyle = BG;
  c.fillRect(0, 0, w, h);
  // a little grain on the paper
  c.fillStyle = "#0E1A1C";
  for (let i = 0; i < (w * h) / 900; i++) c.fillRect(hash01(7, i) * w, hash01(8, i) * h, 1.4, 1.4);
  const cache = new Map<string, Path2D>();
  const env: DrawEnv = { ctx: c as never, path: (d) => { let p = cache.get(d); if (p === undefined) { p = new Path2D(d); cache.set(d, p); } return p; } };
  return { c, env, save: (name) => { const f = resolve(OUT, name); writeFileSync(f, cv.toBuffer("image/png")); return f; } };
}
function text(c: SKRSContext2D, t: string, x: number, y: number, size = 16, colour = CREAM, weight = "bold", align: "left" | "center" | "right" = "left"): void {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `${weight} ${size}px sans-serif`;
  c.fillStyle = colour;
  c.textAlign = align;
  c.fillText(t, x, y);
  c.restore();
}
function header(c: SKRSContext2D, w: number, title: string, sub: string): void {
  text(c, "RANK ZERO", 28, 58, 46, CREAM);
  text(c, title, 326, 56, 30, ORANGE);
  text(c, sub, w - 28, 54, 15, MUTED, "normal", "right");
  c.fillStyle = ORANGE;
  c.fillRect(28, 72, w - 56, 3);
}
function section(c: SKRSContext2D, label: string, x: number, y: number, note = ""): void {
  c.fillStyle = ORANGE;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + 22 + label.length * 14.5, y); c.lineTo(x + 12 + label.length * 14.5, y + 30); c.lineTo(x, y + 30); c.closePath(); c.fill();
  text(c, label, x + 10, y + 23, 21, "#14152B");
  if (note) text(c, note, x + 34 + label.length * 14.5, y + 21, 14, MUTED, "normal");
}
const panel = (c: SKRSContext2D, x: number, y: number, w: number, h: number): void => {
  c.fillStyle = PANEL; c.fillRect(x, y, w, h);
  c.strokeStyle = "#1E3634"; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};
const name = (id: string): string => id.split("-").map((s) => s[0]!.toUpperCase() + s.slice(1)).join(" ");

function svgOf(art: SvgArt, px: number, silhouette = false, skip = 0): string {
  const body = art.parts.slice(silhouette ? skip : 0).map((p) => {
    const fill = silhouette ? (p.fill === "none" ? "none" : "#000") : p.fill;
    const stroke = p.stroke ? ` stroke="${silhouette ? "#000" : p.stroke}" stroke-width="${p.strokeWidth ?? 1}" stroke-linejoin="round"` : "";
    return `<path d="${p.d}" fill="${fill}"${stroke}${p.transform ? ` transform="${p.transform}"` : ""}/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${art.viewBox}">${body}</svg>`;
}
async function drawSvg(c: SKRSContext2D, art: SvgArt, x: number, y: number, px: number, silhouette = false, skip = 0): Promise<void> {
  const img = await loadImage(Buffer.from(svgOf(art, px * 2, silhouette, skip)));
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(img, x, y, px, px); c.restore();
}
/** Draw with the canvas in stage units at `k` px per unit, origin at (ox, oy) px. */
function inUnits(c: SKRSContext2D, k: number, ox: number, oy: number, fn: () => void): void {
  c.save(); c.setTransform(k, 0, 0, k, ox, oy); fn(); c.restore();
}
const lookOf = (seed: number): Look => {
  const keys = Object.keys(LOOK_SPACE) as (keyof typeof LOOK_SPACE)[];
  return Object.fromEntries(keys.map((key, i) => [key, Math.floor(hash01(seed, i) * LOOK_SPACE[key])])) as unknown as Look;
};
const idle = (t = 0) => rig.samplePose("scrapper", "idle", t);
const dress = (look: Look, held: HeldId | null, shield: ShieldId | null = null): Dress => ({ look, held, shield, scale: 1 });

// ------------------------------------------------------------------------------- sheet A
async function sheetA(): Promise<string> {
  const W = 1800, H = 1040;
  const { c, env, save } = surface(W, H);
  header(c, W, "FIGHTERS", "style 13 · gritty comic, sodium streetlight");
  const held: (HeldId | null)[] = ["pipe", "bat", null, "machete", "frying-pan", "crowbar", "golf-club", "pocket-knife"];
  const looks = Array.from({ length: 8 }, (_, i) => ({ ...lookOf(300 + i * 17), build: i % 3 }));
  section(c, "8 RANDOM LOOKS", 28, 96, "at phone stage size (91 px tall), on the alley floor; build lean / stocky / tall cycles");
  panel(c, 28, 136, W - 56, 230);
  // on a strip of the yard floor at phone size
  inUnits(c, PHONE, 40, 140, () => {
    c.save(); c.beginPath(); c.rect(0, 0, (W - 80) / PHONE, 200); c.clip();
    c.translate(0, -60);
    for (let k = 0; k < 5; k++) { c.save(); c.translate(k * 360, 0); rig.drawStage(env, "yard", "floor", 0); c.restore(); }
    c.restore();
    looks.forEach((lk, i) => rig.drawActor(env, idle(i * 150), dress(lk, held[i]!), { x: 50 + i * 196, y: 140, facing: 1 }));
  });
  looks.forEach((lk, i) => text(c, `#${i + 1} ${["lean", "stocky", "tall"][lk.build]}`, 50 + i * 196 * PHONE - 10, 356, 13, MUTED, "normal"));

  section(c, "2 LOOKS AT 4X", 28, 392, "every part on its own pin; rough ink line, teal halftone shadow");
  panel(c, 28, 432, 1090, 590);
  const big = [{ ...lookOf(911), build: 1 }, { ...lookOf(977), build: 2 }];
  inUnits(c, 4.33, 0, 0, () => {
    rig.drawActor(env, idle(0), dress(big[0]!, "sledgehammer"), { x: 70, y: 226, facing: 1 });
    rig.drawActor(env, idle(500), dress(big[1]!, "machete", "bin-lid"), { x: 200, y: 226, facing: -1 });
  });
  text(c, "stocky · Sledgehammer", 120, 1006, 15, MUTED, "normal");
  text(c, "tall · Machete + Bin Lid", 720, 1006, 15, MUTED, "normal");

  section(c, "3 BUILDS", 1140, 392, "one look, lean / stocky / tall, 2.6x");
  panel(c, 1140, 432, 632, 590);
  const one = lookOf(1234);
  inUnits(c, 2.6, 0, 0, () => {
    for (let b = 0; b < 3; b++) rig.drawActor(env, idle(b * 200), dress({ ...one, build: b }, "pipe"), { x: 460 + b * 76, y: 370, facing: 1 });
  });
  ["lean", "stocky", "tall"].forEach((s, b) => text(c, s, 1196 + b * 198, 1006, 15, MUTED, "normal"));
  return save("A Fighters.png");
}

// ------------------------------------------------------------------------------- sheet B
async function sheetB(): Promise<string> {
  const ids: (HeldId | ShieldId)[] = [...WEAPON_IDS, ...SHIELD_IDS];
  const cols = 8, cw = 222, ch = 300;
  const rows = Math.ceil(ids.length / cols);
  const W = cols * cw + 56, H = 120 + rows * ch + 30;
  const { c, env, save } = surface(W, H);
  header(c, W, "WEAPONS + SHIELDS", "41 weapons · 6 shields · in the hand at 2x · 44 px icon (proposed set)");
  const look = { ...lookOf(42), build: 0, palette: 0 };
  for (const [i, id] of ids.entries()) {
    const x = 28 + (i % cols) * cw, y = 96 + Math.floor(i / cols) * ch;
    panel(c, x + 3, y + 3, cw - 6, ch - 6);
    const isShield = (SHIELD_IDS as readonly string[]).includes(id);
    inUnits(c, 2.0, 0, 0, () => {
      rig.drawActor(env, idle(0), dress(look, isShield ? "pipe" : (id as HeldId), isShield ? (id as ShieldId) : null), { x: (x + 70) / 2, y: (y + 232) / 2, facing: 1 });
    });
    // the 44 px icon
    const art = isShield ? iconArt(SHIELD_ICONS[id as ShieldId], id as PerkId) : iconArt(WEAPON_ICONS[id as HeldId], id as PerkId);
    c.fillStyle = "#081416"; c.fillRect(x + cw - 64, y + 14, 52, 52);
    await drawSvg(c, art, x + cw - 60, y + 18, 44);
    text(c, "44 px", x + cw - 38, y + 80, 11, MUTED, "normal", "center");
    const rarity = RARITY_OF[id as PerkId];
    text(c, name(id), x + 12, y + 262, 16, CREAM);
    text(c, rarity.toUpperCase(), x + 12, y + 283, 13, RARITY_COLOUR[rarity]!);
    text(c, isShield ? "shield" : `${i + 1}`, x + cw - 14, y + 283, 12, MUTED, "normal", "right");
  }
  return save("B Weapons.png");
}

// ------------------------------------------------------------------------------- sheet C
async function sheetC(): Promise<string> {
  const W = 1800, cw = 581, ch = 560;
  const H = 120 + 2 * ch + 30;
  const { c, env, save } = surface(W, H);
  header(c, W, "PETS", "jointed rigs · a pin on every joint · idle pose · with a fighter for scale");
  const look = { ...lookOf(77), build: 0 };
  for (const [i, id] of (COMPANION_IDS as readonly CompanionId[]).entries()) {
    const x = 28 + (i % 3) * (cw + 6), y = 96 + Math.floor(i / 3) * ch;
    panel(c, x, y, cw, ch - 10);
    const pose = rig.samplePose(id, "idle", 0);
    const def = ins.rigDef(id);
    const k = id === "boar" ? 5.2 : id === "goose" ? 6.6 : 8.4;
    const at = { x: (x + (id === "boar" ? 270 : 250)) / k, y: (y + 380) / k, facing: 1 as const };
    inUnits(c, k, 0, 0, () => {
      c.fillStyle = "#163A40"; c.fillRect(at.x - 30, at.y, 60, 0.4);
      rig.drawActor(env, pose, { held: null, shield: null, scale: 1 }, at);
    });
    const joints = ins.joints(pose, { held: null, shield: null, scale: 1 }, at);
    joints.forEach((p, j) => {
      if (j === 0) return;
      c.beginPath(); c.arc(p[0] * k, p[1] * k, 4.2, 0, Math.PI * 2);
      c.fillStyle = "#FFB45A"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = "#14152B"; c.stroke();
    });
    // to scale beside a fighter, small
    inUnits(c, 1.6, 0, 0, () => {
      rig.drawActor(env, idle(0), dress(look, null), { x: (x + cw - 64) / 1.6, y: (y + 470) / 1.6, facing: -1 });
      rig.drawActor(env, pose, { held: null, shield: null, scale: 1 }, { x: (x + cw - 150) / 1.6, y: (y + 470) / 1.6, facing: 1 });
    });
    text(c, "to scale", x + cw - 110, y + 492, 12, MUTED, "normal", "center");
    const r = RARITY_OF[id];
    text(c, name(id).toUpperCase(), x + 18, y + 40, 30, CREAM);
    text(c, r.toUpperCase(), x + cw - 18, y + 38, 18, RARITY_COLOUR[r]!, "bold", "right");
    text(c, `${def.bones.length - 1} bones · ${def.height} units tall`, x + 18, y + 64, 14, MUTED, "normal");
    const portrait = rig.companionPortrait(id);
    await drawSvg(c, portrait, x + 18, y + 440, 64);
    text(c, "portrait 64 px", x + 92, y + 478, 12, MUTED, "normal");
  }
  return save("C Pets.png");
}

// ------------------------------------------------------------------------------- sheet D
async function sheetD(): Promise<string> {
  const cols = 8, cw = 214, ch = 150;
  const rows = Math.ceil(SKILL_IDS.length / cols);
  const W = cols * cw + 56, H = 140 + rows * ch + 40;
  const { c, save } = surface(W, H);
  header(c, W, "SKILLS", "ink-stamped badge = passive / booster · torn sticker = Move · frame tone = rarity");
  for (const [i, id] of (SKILL_IDS as readonly SkillId[]).entries()) {
    const x = 28 + (i % cols) * cw, y = 100 + Math.floor(i / cols) * ch;
    panel(c, x + 3, y + 3, cw - 6, ch - 6);
    const art = rig.icon(id);
    await drawSvg(c, art, x + 16, y + 16, 64);
    await drawSvg(c, art, x + 92, y + 48, 32);
    text(c, "64", x + 48, y + 96, 11, MUTED, "normal", "center");
    text(c, "32", x + 108, y + 96, 11, MUTED, "normal", "center");
    text(c, name(id), x + 14, y + 120, 15, CREAM);
    const r = RARITY_OF[id];
    text(c, r.toUpperCase(), x + 14, y + 138, 12, RARITY_COLOUR[r]!);
  }
  return save("D Skills.png");
}

// ------------------------------------------------------------------------------- sheet E
async function sheetE(): Promise<string> {
  const k = 3.4, bw = 360 * k, bh = 240 * k;
  const pw = 390, ph = 260;
  const W = 28 + bw + 24 + pw + 28, H = 110 + STAGE_IDS.length * (bh + 60) + 20;
  const { c, env, save } = surface(W, H);
  header(c, W, "ARENAS", "five arenas · same floor line and marks · left at 3.4x, right at phone size (390 px)");
  const pair = (): void => {
    rig.drawActor(env, idle(0), dress({ ...lookOf(5), build: 0 }, "pipe"), { x: 120, y: 195, facing: 1 });
    rig.drawActor(env, idle(430), dress({ ...lookOf(6), build: 1 }, "bat", "car-door"), { x: 240, y: 195, facing: -1 });
    rig.drawActor(env, rig.samplePose("raccoon", "idle", 0), { held: null, shield: null, scale: 1 }, { x: 74, y: 203, facing: 1 });
  };
  for (const [i, id] of (STAGE_IDS as readonly StageId[]).entries()) {
    const y = 104 + i * (bh + 60);
    text(c, name(id).toUpperCase(), 28, y + 24, 24, CREAM);
    text(c, ["the alley (gate art)", "the alley after midnight, in the rain", "a tar roof under city lights", "a fenced backyard under a porch lamp", "a school gym under hall lights"][i]!, 220, y + 22, 15, MUTED, "normal");
    for (const [kk, ox, oy] of [[k, 28, y + 36], [PHONE, 28 + bw + 24, y + 36]] as const) {
      inUnits(c, kk, ox, oy, () => {
        c.beginPath(); c.rect(0, 0, 360, 240); c.clip();
        rig.drawStage(env, id, "back", 0);
        rig.drawStage(env, id, "floor", 0);
        pair();
      });
    }
    text(c, "phone size", 28 + bw + 24, y + 36 + ph + 22, 13, MUTED, "normal");
  }
  return save("E Arenas.png");
}

// ------------------------------------------------------------------------------- sheet F
async function sheetF(): Promise<string> {
  const groups: [string, string, [string, SvgArt][], number][] = [
    ["SKILLS", "passives and boosters: stamped badge · Moves: torn sticker · silhouettes show the pictogram alone", (SKILL_IDS as readonly SkillId[]).map((id) => [name(id), rig.icon(id)]), FRAME_PARTS],
    ["CONTENT UI", "", Object.entries(CONTENT_UI_ICONS).map(([id, a]) => [id.slice(3), iconArt(a, id as never)]), 0],
    ["STATS + CONTROLS (REDRAWN)", "offered to the rig lane for gate/icons.ts", [...Object.entries(STAT_ICONS_REDRAW), ...Object.entries(GATE_UI_ICONS_REDRAW)].map(([id, a]) => [id.split(":")[1]!, iconArt(a, id as never)]), 0],
    ["SHIELDS", "heater frame, tone = rarity (needs a contract key)", (SHIELD_IDS as readonly ShieldId[]).map((id) => [name(id), iconArt(SHIELD_ICONS[id], id)]), FRAME_PARTS],
    ["WEAPONS", "no frame: the object itself, cropped to its business end (proposed; needs wiring)", ([...WEAPON_IDS, "fists"] as HeldId[]).map((id) => [name(id), iconArt(WEAPON_ICONS[id], id)]), 0],
  ];
  const cols = 6, cw = 300, ch = 108;
  let rowsTotal = 0;
  for (const g of groups) rowsTotal += Math.ceil(g[2].length / cols);
  const W = cols * cw + 56, H = 110 + groups.length * 56 + rowsTotal * ch + 30;
  const { c, save } = surface(W, H);
  header(c, W, "ICON BOARD", "64 · 44 · 28 px and the black silhouette of each");
  let y = 96;
  for (const [label, note, items, skip] of groups) {
    section(c, label, 28, y, note);
    y += 44;
    for (const [i, [nm, art]] of items.entries()) {
      const x = 28 + (i % cols) * cw, yy = y + Math.floor(i / cols) * ch;
      panel(c, x + 3, yy + 3, cw - 6, ch - 6);
      await drawSvg(c, art, x + 12, yy + 12, 64);
      await drawSvg(c, art, x + 84, yy + 32, 44);
      await drawSvg(c, art, x + 136, yy + 48, 28);
      c.fillStyle = "#E9E2D2"; c.fillRect(x + 176, yy + 12, 64, 64);
      await drawSvg(c, art, x + 186, yy + 22, 44, true, skip);
      c.fillStyle = "#E9E2D2"; c.fillRect(x + 248, yy + 40, 36, 36);
      await drawSvg(c, art, x + 252, yy + 44, 28, true, skip);
      text(c, nm, x + 12, yy + 96, 13, CREAM, "normal");
    }
    y += Math.ceil(items.length / cols) * ch + 12;
  }
  return save("F Icons.png");
}

const which = process.argv[3] ?? "ABCDEF";
const jobs: [string, () => Promise<string>][] = [["A", sheetA], ["B", sheetB], ["C", sheetC], ["D", sheetD], ["E", sheetE], ["F", sheetF]];
for (const [k, fn] of jobs) if (which.includes(k)) console.log(await fn());
void ({} as IconArt);
