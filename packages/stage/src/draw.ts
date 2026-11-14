/**
 * Paints one frame through the `Ctx2D` subset: the arena, floor props, actors by depth,
 * flights, effects, numbers and stickers, ticket tape. The stage layer (everything but the
 * banners) moves with the camera shake. The 360 x 240 stage is fitted into the view and
 * centred; the backing store is `view.w x view.h x view.dpr` pixels.
 */
import type { DrawEnv, Rig } from "@rankzero/rig";
import type { PlayerOpts } from "./contracts";
import type { Frame, FrameText } from "./frame";
import { STAGE_H, STAGE_W } from "./layout";
import { INK } from "./palette";

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

function text(env: DrawEnv, t: FrameText, fonts: PlayerOpts["fonts"]): void {
  const c = env.ctx;
  c.save();
  c.globalAlpha = t.alpha < 0 ? 0 : t.alpha > 1 ? 1 : t.alpha;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.font = `${t.size.toFixed(2)}px ${t.kind === "tag" ? fonts.body : fonts.display}`;
  if (t.kind === "number") {
    c.lineWidth = Math.max(2, t.size * 0.24);
    c.strokeStyle = t.ink;
    c.strokeText(t.text, t.x, t.y);
    c.fillStyle = t.colour;
    c.fillText(t.text, t.x, t.y);
  } else {
    // a sticker: a filled tag with an ink outline, slightly tilted
    const w = c.measureText(t.text).width + t.size * 0.9;
    const h = t.size * 1.35;
    c.translate(t.x, t.y);
    c.rotate(t.kind === "tag" ? -0.06 : -0.03);
    roundRect(env, -w / 2, -h / 2, w, h, Math.min(5, h / 3));
    c.fillStyle = t.colour;
    c.fill();
    c.lineWidth = t.kind === "tag" ? 1.2 : 2;
    c.strokeStyle = t.ink;
    c.stroke();
    c.fillStyle = INK;
    c.fillText(t.text, 0, h * 0.04);
  }
  c.restore();
}

export function drawFrame(env: DrawEnv, f: Frame, rig: Rig, opts: PlayerOpts, view: { w: number; h: number; dpr: number }): void {
  const c = env.ctx;
  const { k, ox, oy } = fitView(view);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, view.w * (view.dpr > 0 ? view.dpr : 1), view.h * (view.dpr > 0 ? view.dpr : 1));
  c.setTransform(k, 0, 0, k, ox, oy);
  c.save();
  c.beginPath();
  c.rect(0, 0, STAGE_W, STAGE_H);
  c.clip();
  c.save();
  c.translate(f.shake.x, f.shake.y);
  rig.drawStage(env, opts.stage, "back", f.crowd);
  rig.drawStage(env, opts.stage, "floor", f.crowd);
  for (const p of f.floor) {
    c.save();
    c.globalAlpha = p.alpha;
    rig.drawProp(env, p.item, { x: p.x, y: p.y, facing: p.facing, rot: p.rot });
    c.restore();
  }
  for (const a of f.actors) {
    rig.drawActor(env, rig.samplePose(a.rig, a.clip, a.clipT, a.aim), a.dress, a.place);
  }
  for (const p of f.flights) {
    c.save();
    c.globalAlpha = p.alpha;
    rig.drawProp(env, p.item, { x: p.x, y: p.y, facing: p.facing, rot: p.rot });
    c.restore();
  }
  for (const e of f.fx) {
    if (e.fx === "tape") continue;
    rig.drawFx(env, e.fx, e.progress, e.at, e.seed);
  }
  for (const t of f.texts) if (t.kind === "number" || t.kind === "tag") text(env, t, opts.fonts);
  c.restore();
  if (f.tape !== null) rig.drawFx(env, "tape", f.tape, { x: 0, y: 0, facing: 1 }, opts.cosmeticSeed);
  for (const t of f.texts) if (t.kind === "banner" || t.kind === "sticker") text(env, t, opts.fonts);
  c.restore();
  c.restore();
}
