/**
 * Paints one frame through the `Ctx2D` subset: the arena, floor props, actors by depth,
 * flights, effects, numbers and stickers, ticket tape. The stage layer (everything but the
 * banners) moves with the camera shake. The 360 x 240 stage is fitted into the view and
 * centred; the backing store is `view.w x view.h x view.dpr` pixels.
 */
import type { DrawEnv, Pose, Rig, SvgArt } from "@rankzero/rig";
import type { PlayerOpts } from "./contracts";
import type { Frame, FrameText } from "./frame";
import { STAGE_H, STAGE_W } from "./layout";
import type { CameraView } from "./camera";
import { MARGIN, STICKER_H, TOP_BAND, fitView, layoutLabels, layoutNumbers, screenOf } from "./labels";
export { MARGIN, STICKER_H, TOP_BAND, fitView };
import type { NumSpot, Spot } from "./labels";
import { INK, VOID } from "./palette";
import { drawSig } from "./sigs";

/** Screen px of shake per unit of the tuning's shake size, under the camera: the tuning's shake
 *  is in CSS px (calm camera). */
const SHAKE_PX = 1;
/** Contact bursts drawn a little bigger under the camera: a short local burst at the contact. */
const BIG_FX = { burst: 1.1, spark: 1.1 } as const;


/** The stage seen on a canvas of another shape (owner, 19 Nov 2026: the fight screen is the stage
 *  only, in portrait and in landscape). A tall canvas shows more than the stage's 240 units: below
 *  the stage the floor goes on toward the viewer (its last `mirror.floor` units drawn again,
 *  mirrored and stretched, so the ground meets itself at the edge), above it the wall goes up into
 *  the night (its top `mirror.wall` units, the same way), and both sink into the night in flat
 *  steps (the rig's style: flat shapes with alpha, no gradient). A canvas wider than the stage (a
 *  very wide screen) has plain night at the sides, the stage's edge fading into it. */
export const EDGE = { mirror: { floor: 44, wall: 30 }, sink: [0.3, 0.46, 0.6, 0.72, 0.82, 0.9, 0.95], fade: 22,
  steps: [0.82, 0.6, 0.4, 0.22, 0.1] } as const;

/** The part of the stage a camera shows on a `view` canvas, in stage units. */
export function viewRect(cam: CameraView, view: { w: number; h: number }): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: cam.x0, y0: cam.y0, x1: cam.x0 + view.w / cam.k, y1: cam.y0 + view.h / cam.k };
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

/** The ground and the wall past the stage's top and bottom edges (see EDGE). */
function drawBeyond(env: DrawEnv, rig: Rig, opts: PlayerOpts, r: Rect, crowd: number): void {
  const c = env.ctx;
  c.fillStyle = VOID;
  c.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  const x0 = Math.max(0, r.x0);
  const x1 = Math.min(STAGE_W, r.x1);
  const sink = (from: number, to: number): void => {
    // bands from the edge (`from`) outward (`to`): each a little darker
    const n = EDGE.sink.length;
    const d = (to - from) / n;
    c.fillStyle = VOID;
    EDGE.sink.forEach((a, i) => {
      c.globalAlpha = a;
      const y = from + i * d;
      c.fillRect(x0, Math.min(y, y + d), x1 - x0, Math.abs(d));
    });
    c.globalAlpha = 1;
  };
  if (r.y1 > STAGE_H) {
    const depth = r.y1 - STAGE_H;
    const k = depth / EDGE.mirror.floor;
    c.save();
    c.beginPath();
    c.rect(x0, STAGE_H, x1 - x0, depth);
    c.clip();
    // y' = STAGE_H + (STAGE_H - y) k: the floor's last units, mirrored down and stretched
    c.transform(1, 0, 0, -k, 0, STAGE_H * (1 + k));
    rig.drawStage(env, opts.stage, "floor", crowd);
    c.restore();
    c.save();
    sink(STAGE_H, r.y1);
    c.restore();
  }
  if (r.y0 < 0) {
    const depth = -r.y0;
    const k = depth / EDGE.mirror.wall;
    c.save();
    c.beginPath();
    c.rect(x0, r.y0, x1 - x0, depth);
    c.clip();
    // y' = -y k: the wall's top units, mirrored up and stretched
    c.transform(1, 0, 0, -k, 0, 0);
    rig.drawStage(env, opts.stage, "back", crowd);
    c.restore();
    c.save();
    sink(0, r.y0);
    c.restore();
  }
}

/** A wide canvas: the stage's left and right edges fade into the night beside them. */
function fadeSides(env: DrawEnv, r: Rect): void {
  if (r.x0 >= 0 && r.x1 <= STAGE_W) return;
  const c = env.ctx;
  const d = EDGE.fade / EDGE.steps.length;
  c.save();
  c.fillStyle = VOID;
  EDGE.steps.forEach((a, i) => {
    c.globalAlpha = a;
    if (r.x0 < 0) c.fillRect(i * d, 0, d, STAGE_H);
    if (r.x1 > STAGE_W) c.fillRect(STAGE_W - (i + 1) * d, 0, d, STAGE_H);
  });
  c.restore();
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

/** Banner text scales with the canvas width (tags and numbers: labels.ts). */
export const BANNER_K = { perWidth: 1 / 225, max: 2.7 } as const;
/** The banner in the top band shrinks to fit above the standing heads, down to this (CSS px). */
export const BANNER_MIN_PX = 14;
/** Room kept above a head's hit point (figure units, times the drawn size: the head's radius and
 *  a taller win pose), and screen px under the banner's tilted box. */
const HEAD_ROOM = 22;
const BANNER_GAP = 8;

/**
 * The winner's banner text size in CSS px on a `view` canvas under the camera `cam`: its width
 * scale, shrunk so the box in the top band ends above every standing fighter's head (review
 * finding 52: on the app's 390 x 260 phone canvas the 52 px band and a 35 px banner reached 40%
 * down the view, over the winner's head).
 */
export function bannerPx(f: Frame, rig: Rig, cam: CameraView, view: { w: number; h: number }, size: number): number {
  const want = size * Math.min(view.w * BANNER_K.perWidth, BANNER_K.max);
  let head = Infinity;
  for (const a of f.actors) {
    if (a.rig !== "scrapper" || a.clip.startsWith("ko")) continue;
    const y = a.floorY + rig.hitPoint("scrapper", a.dress, "head").y - HEAD_ROOM * (a.dress.scale > 0 ? a.dress.scale : 1);
    head = Math.min(head, (y - cam.y0) * cam.k);
  }
  if (head === Infinity) return want;
  const fit = (head - TOP_BAND - MARGIN - BANNER_GAP) / STICKER_H;
  return Math.max(BANNER_MIN_PX, Math.min(want, fit));
}

function text(env: DrawEnv, t: FrameText, fonts: PlayerOpts["fonts"], at: Placed, view: { w: number; h: number }, dpr: number, topBand = 0,
  icon: SvgArt | null = null): void {
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
  // a skill's icon sits at the left of the words, inside the sticker
  const iconW = icon !== null && t.kind !== "number" ? size * 1.25 : 0;
  const boxW = t.kind === "number" ? tw : tw + size * 0.9 + iconW;
  const boxH = t.kind === "number" ? size : size * STICKER_H;
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
    c.fillText(t.text, iconW / 2, boxH * 0.04);
    if (icon !== null && iconW > 0) {
      const k = (size * 1.1) / 24;
      c.translate(-boxW / 2 + size * 0.3, -size * 0.55);
      c.scale(k, k);
      for (const p of icon.parts) {
        if (p.transform !== undefined) continue;
        const path = env.path(p.d);
        if (p.stroke !== undefined) {
          c.strokeStyle = p.stroke;
          c.lineWidth = (p.strokeWidth ?? 1) * 1.4;
          c.stroke(path);
        }
        c.fillStyle = p.fill;
        c.fill(path);
      }
    }
  }
  c.restore();
}

/** A glow round an actor (Second Wind's breath, the Energy Drink kicking in), drawn behind it:
 *  stepped flat ellipses (the rig's style: glow is stepped flat shapes with alpha, no gradient)
 *  and a bright rim. No dim, no floor ring. */
function auraBehind(env: DrawEnv, s: Frame["auras"][number]): void {
  const c = env.ctx;
  c.save();
  c.fillStyle = s.colour;
  c.strokeStyle = s.colour;
  for (const [k, a] of [[1.25, 0.16], [1, 0.22], [0.74, 0.3]] as const) {
    c.globalAlpha = a * s.glow;
    c.beginPath();
    c.ellipse(s.x, s.floorY - 42, 26 * k, 50 * k, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 0.9 * s.glow;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(s.x, s.floorY - 42, 26, 50, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/** What an actor put aside for a Move hangs on its back, behind the body, so the gesture reads
 *  and the item is still there (a shield strapped across the back, a long item slung). */
function drawSlung(env: DrawEnv, rig: Rig, a: Frame["actors"][number]): void {
  if (a.slung === undefined) return;
  const s = a.dress.scale > 0 ? a.dress.scale : 1;
  a.slung.forEach((item, k) => {
    rig.drawProp(env, item, { x: a.place.x - a.place.facing * (6 + 3 * k) * s, y: a.place.y - (58 - 6 * k) * s, facing: a.place.facing,
      rot: k === 0 ? 100 : 128 });
  });
}

export function drawFrame(env: DrawEnv, f: Frame, rig: Rig, opts: PlayerOpts, view: { w: number; h: number; dpr: number }, cam?: CameraView,
  pose?: (a: Frame["actors"][number]) => Pose, spots?: ReadonlyMap<number, Spot>, numSpots?: ReadonlyMap<number, NumSpot>): void {
  const poseOf = (a: Frame["actors"][number]): Pose => (pose ? pose(a) : rig.samplePose(a.rig, a.clip, a.clipT, a.aim));
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
  // a canvas taller (or wider) than the stage: the night round it
  const shown = cam ? viewRect(cam, view) : null;
  const beyond = shown !== null && (shown.y0 < 0 || shown.y1 > STAGE_H || shown.x0 < 0 || shown.x1 > STAGE_W);
  if (beyond) drawBeyond(env, rig, opts, shown, f.crowd);
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
  if (beyond) fadeSides(env, shown);
  for (const p of f.floor) {
    c.save();
    c.globalAlpha = p.alpha;
    if (p.squash !== undefined && p.floorY !== undefined) {
      // a fallen shield lies flat on the floor line
      c.translate(0, p.floorY);
      c.scale(1, p.squash);
      c.translate(0, -p.floorY);
    }
    rig.drawProp(env, p.item, { x: p.x, y: p.y, facing: p.facing, rot: p.rot });
    c.restore();
  }
  for (const s of f.auras) auraBehind(env, s);
  for (const e of f.fx) if (e.behind === true) rig.drawFx(env, e.fx, e.progress, e.at, e.seed, e.size);
  for (const a of f.actors) {
    // under a tarp only the sheet shows: the body, what it holds and what hangs on it are under it
    if (a.covered !== true) {
      drawSlung(env, rig, a);
      rig.drawActor(env, poseOf(a), a.dress, a.place);
    }
    // a tarp over an actor goes with it: a fighter in front of it stays in front

    for (const e of f.fx) if (e.under === a.id) rig.drawFx(env, e.fx, e.progress, e.at, e.seed, e.size);
  }
  for (const p of f.flights) {
    c.save();
    c.globalAlpha = p.alpha;
    rig.drawProp(env, p.item, { x: p.x, y: p.y, facing: p.facing, rot: p.rot });
    c.restore();
  }
  for (const e of f.fx) {
    if (e.fx === "tape" || e.under !== undefined || e.behind === true) continue;

    const big = (BIG_FX as Partial<Record<string, number>>)[e.fx];
    if (big !== undefined && cam) {
      // bigger, bolder contact bursts (owner: "have some energy")
      c.save();
      c.translate(e.at.x, e.at.y);
      c.scale(big, big);
      c.translate(-e.at.x, -e.at.y);
      rig.drawFx(env, e.fx, e.progress, e.at, e.seed, e.size);
      c.restore();
    } else rig.drawFx(env, e.fx, e.progress, e.at, e.seed, e.size);
  }
  // each skill's own picture, over the actors (sigs.ts)
  for (const s of f.sigs) drawSig(env, s, rig, poseOf);
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
    if (t.kind !== "banner") continue;
    if (cam) {
      // stage-wide cards: centred on the canvas, a third of the way down (FIGHT), or held in the
      // top band clear of the heads (the winner's banner, review finding 52: it covered his head)
      const top = t.band === "top";
      text(env, t, opts.fonts, { x: view.w / 2 + (t.x - STAGE_W / 2) * bk, y: top ? 0 : view.h * 0.34 + (t.y - 90) * bk,
        size: top ? bannerPx(f, rig, cam, css, t.size) : t.size * bk },
        css, dpr, top ? TOP_BAND : 0);
    } else text(env, t, opts.fonts, { x: t.x * k + ox, y: t.y * k + oy, size: t.size * k }, css, dpr, 0);
  }
  // tags and stickers: laid out so no two overlap (labels.ts), each riding on its actor
  const scr = screenOf(css, cam);
  const labels = layoutLabels(f, scr, spots);
  for (const l of labels) {
    const shaken = l.t.kind === "tag";
    const icon = l.t.icon !== undefined ? rig.icon(l.t.icon) : null;
    const pop = l.t.size0 !== undefined && l.t.size0 > 0 ? l.t.size / l.t.size0 : 1;
    text(env, l.t, opts.fonts, { x: l.x + (shaken ? sx : 0), y: l.y + (shaken ? sy : 0), size: l.size * pop }, css, dpr, cam ? TOP_BAND : 0, icon);
  }
  // numbers last, beside the tags, never on one (labels.ts)
  for (const n of layoutNumbers(f, scr, labels, numSpots)) {
    text(env, n.t, opts.fonts, { x: n.x + sx, y: n.y + sy, size: n.size }, css, dpr, cam ? TOP_BAND : 0);
  }
}
