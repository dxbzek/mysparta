/**
 * Paints one frame through the `Ctx2D` subset: the arena, floor props, actors by depth,
 * flights, effects, numbers and stickers, ticket tape. The stage layer (everything but the
 * banners) moves with the camera shake. The 360 x 240 stage is fitted into the view and
 * centred; the backing store is `view.w x view.h x view.dpr` pixels.
 */
import type { DrawEnv, Pose, Rig } from "@rankzero/rig";
import type { PlayerOpts } from "./contracts";
import type { Frame, FrameText } from "./frame";
import { STAGE_H, STAGE_W } from "./layout";
import type { CameraView } from "./camera";
import { INK, STREAK } from "./palette";

/** Screen px of shake per unit of the tuning's shake size, under the camera. */
const SHAKE_PX = 2.4;
/** Contact bursts drawn this much bigger under the camera. */
const BIG_FX = { burst: 1.45, spark: 1.3, whoosh: 1.2 } as const;

export function fitView(view: { w: number; h: number; dpr: number }): { k: number; ox: number; oy: number } {
  const dpr = view.dpr > 0 ? view.dpr : 1;
  const k = Math.min(view.w / STAGE_W, view.h / STAGE_H) * dpr;
  return { k, ox: (view.w * dpr - STAGE_W * k) / 2, oy: (view.h * dpr - STAGE_H * k) / 2 };
}

function roundRect(env: DrawEnv, x: number, y: number, w: number, h: number, r: number): void {
  const c = env.ctx;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  c.lineTo(x + w, y + h - r);
  c.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  c.lineTo(x + r, y + h);
  c.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  c.lineTo(x, y + r);
  c.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  c.closePath();
}

/** Where a text is painted, in CSS px of the canvas, and its font size in px. */
interface Placed { x: number; y: number; size: number }

/** Text sizes on screen. Numbers and tags follow the camera up to a cap, so a close camera does
 *  not make a damage number cover a face; banners scale with the canvas width. */
const TEXT_K_MAX = { number: 3.1, tag: 2.5 } as const;
const BANNER_K = { perWidth: 1 / 225, max: 2.7 } as const;
const MARGIN = 6;
/** Numbers and tags stay below this band at the top of the canvas, where the host's controls sit. */
const TOP_BAND = 52;
/** Extra screen px a tag is lifted under the camera. */
const TAG_LIFT = 30;

function text(env: DrawEnv, t: FrameText, fonts: PlayerOpts["fonts"], at: Placed, view: { w: number; h: number }, dpr: number, topBand = 0): void {
  const c = env.ctx;
  c.save();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalAlpha = t.alpha < 0 ? 0 : t.alpha > 1 ? 1 : t.alpha;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  const size = at.size;
  c.font = `${size.toFixed(2)}px ${t.kind === "tag" ? fonts.body : fonts.display}`;
  const tw = c.measureText(t.text).width;
  const boxW = t.kind === "number" ? tw : tw + size * 0.9;
  const boxH = t.kind === "number" ? size : size * 1.35;
  // keep every word inside the canvas: a number rising over a tall head, a sticker near an edge
  const half = boxW / 2 + MARGIN;
  const x = view.w < 2 * half ? view.w / 2 : at.x < half ? half : at.x > view.w - half ? view.w - half : at.x;
  const top = boxH / 2 + MARGIN + topBand;
  const y = view.h < 2 * top ? view.h / 2 : at.y < top ? top : at.y > view.h - top ? view.h - top : at.y;
  if (t.kind === "number") {
    // a heavy comic number: a thick ink outline and a hard offset shadow
    c.lineWidth = Math.max(3, size * 0.26);
    c.strokeStyle = t.ink;
    c.fillStyle = t.ink;
    c.strokeText(t.text, x + size * 0.07, y + size * 0.09);
    c.fillText(t.text, x + size * 0.07, y + size * 0.09);
    c.strokeText(t.text, x, y);
    c.fillStyle = t.colour;
    c.fillText(t.text, x, y);
  } else {
    // a sticker: a filled tag with an ink outline and a hard shadow, slightly tilted
    c.translate(x, y);
    c.rotate(t.kind === "tag" ? -0.06 : t.kind === "banner" ? -0.04 : -0.03);
    const r = Math.min(5, boxH / 3);
    c.fillStyle = t.ink;
    roundRect(env, -boxW / 2 + size * 0.12, -boxH / 2 + size * 0.14, boxW, boxH, r);
    c.fill();
    roundRect(env, -boxW / 2, -boxH / 2, boxW, boxH, r);
    c.fillStyle = t.colour;
    c.fill();
    c.lineWidth = t.kind === "tag" ? 2 : 3;
    c.strokeStyle = t.ink;
    c.stroke();
    c.fillStyle = INK;
    c.fillText(t.text, 0, boxH * 0.04);
  }
  c.restore();
}

/** Speed lines behind a dashing actor: four streaks trailing its back, in stage units. */
function speedLines(env: DrawEnv, a: Frame["actors"][number], tall: number): void {
  const seg = a.seg;
  if (seg === null) return;
  const span = seg.to - seg.from;
  const u = span > 0 && span !== Infinity && seg.rate > 0 ? (a.clipT - seg.c0) / (span * seg.rate) : 0.5;
  const fade = u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
  if (fade <= 0.02) return;
  const c = env.ctx;
  c.save();
  c.globalAlpha = 0.75 * fade;
  c.strokeStyle = STREAK;
  const back = -a.place.facing;
  const rows = [0.22, 0.42, 0.6, 0.8];
  rows.forEach((r, i) => {
    const y = a.place.y - tall * r;
    const from = a.place.x + back * (10 + (i % 2) * 4);
    const len = (18 + ((i * 7) % 11)) * fade;
    c.lineWidth = i % 2 === 0 ? 1.6 : 1.1;
    c.beginPath();
    c.moveTo(from, y);
    c.lineTo(from + back * len, y);
    c.stroke();
  });
  c.restore();
}

export function drawFrame(env: DrawEnv, f: Frame, rig: Rig, opts: PlayerOpts, view: { w: number; h: number; dpr: number }, cam?: CameraView,
  pose?: (a: Frame["actors"][number]) => Pose): void {
  const c = env.ctx;
  const dpr = view.dpr > 0 ? view.dpr : 1;
  // without a camera (tools, tests) the whole stage is fitted and centred, as before
  const fit = fitView(view);
  const k = cam ? cam.k : fit.k / dpr;
  const ox = cam ? -cam.x0 * k : fit.ox / dpr;
  const oy = cam ? -cam.y0 * k : fit.oy / dpr;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, view.w * dpr, view.h * dpr);
  c.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr);
  c.save();
  c.beginPath();
  c.rect(0, 0, STAGE_W, STAGE_H);
  c.clip();
  c.save();
  // under the camera the shake is a screen distance: SHAKE_PX px per unit of the tuning's size
  const shakeK = cam ? SHAKE_PX / k : 1;
  c.translate(f.shake.x * shakeK, f.shake.y * shakeK);
  rig.drawStage(env, opts.stage, "back", f.crowd);
  rig.drawStage(env, opts.stage, "floor", f.crowd);
  for (const p of f.floor) {
    c.save();
    c.globalAlpha = p.alpha;
    rig.drawProp(env, p.item, { x: p.x, y: p.y, facing: p.facing, rot: p.rot });
    c.restore();
  }
  for (const a of f.actors) {
    if (cam && !opts.reducedMotion && a.clip === "dash") speedLines(env, a, a.rig === "scrapper" ? 80 : 30);
    rig.drawActor(env, pose ? pose(a) : rig.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
  }
  for (const p of f.flights) {
    c.save();
    c.globalAlpha = p.alpha;
    rig.drawProp(env, p.item, { x: p.x, y: p.y, facing: p.facing, rot: p.rot });
    c.restore();
  }
  for (const e of f.fx) {
    if (e.fx === "tape") continue;
    const big = (BIG_FX as Partial<Record<string, number>>)[e.fx];
    if (big !== undefined && cam) {
      // bigger, bolder contact bursts (owner: "have some energy")
      c.save();
      c.translate(e.at.x, e.at.y);
      c.scale(big, big);
      c.translate(-e.at.x, -e.at.y);
      rig.drawFx(env, e.fx, e.progress, e.at, e.seed);
      c.restore();
    } else rig.drawFx(env, e.fx, e.progress, e.at, e.seed);
  }
  c.restore();
  if (f.tape !== null) rig.drawFx(env, "tape", f.tape, { x: 0, y: 0, facing: 1 }, opts.cosmeticSeed);
  c.restore();
  c.restore();
  // words last, in screen space, so a close camera never pushes one off the canvas
  const css = { w: view.w, h: view.h };
  const sx = cam ? f.shake.x * SHAKE_PX : f.shake.x * k;
  const sy = cam ? f.shake.y * SHAKE_PX : f.shake.y * k;
  const bk = cam ? Math.min(view.w * BANNER_K.perWidth, BANNER_K.max) : k;
  for (const t of f.texts) {
    if (t.kind === "banner" && cam) {
      // stage-wide cards (FIGHT, the winner): centred on the canvas, a third of the way down
      text(env, t, opts.fonts, { x: view.w / 2 + (t.x - STAGE_W / 2) * bk, y: view.h * 0.34 + (t.y - 90) * bk, size: t.size * bk }, css, dpr);
      continue;
    }
    // Under the camera the host shows a Move as a big banner of its own (fight screen v2), so the
    // small Move sticker over the user is left out; the OVERTIME sticker stays.
    if (cam && t.kind === "sticker" && t.text !== opts.text.overtime) continue;
    const cap = t.kind === "number" ? TEXT_K_MAX.number : TEXT_K_MAX.tag;
    const tk = cam ? Math.min(k, cap) : k;
    const shaken = t.kind === "number" || t.kind === "tag";
    // a tag (CRIT, BLOCK, a skill) sits higher than at the old scale, clear of the number it labels
    const lift = cam && t.kind === "tag" ? TAG_LIFT : 0;
    text(env, t, opts.fonts, { x: t.x * k + ox + (shaken ? sx : 0), y: t.y * k + oy + (shaken ? sy : 0) - lift, size: t.size * tk }, css, dpr, cam ? TOP_BAND : 0);
  }
}
