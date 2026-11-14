/**
 * The Node side of `DrawEnv`, shared by every tool that draws without a browser
 * (smoke test, contact sheets, spacing charts, bout renders). Run tools with `tsx`.
 *
 *   const s = createSurface(360, 240, 2);        // stage units and a pixel scale
 *   rig.drawYard(s.env, "back", 0);              // draw in stage units
 *   writePng(s, ".review/wp2/sheet.png");
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, Path2D, createCanvas } from "@napi-rs/canvas";
import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import type { Ctx2D, DrawEnv } from "@rankzero/rig";

/** The repo root, so a tool writes to the same place from any working directory. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface Surface {
  canvas: Canvas;
  /** The full Node context, for the tool's own labels and frames. */
  raw: SKRSContext2D;
  /** What the rig and the stage draw through. */
  env: DrawEnv;
  widthUnits: number;
  heightUnits: number;
  scale: number;
}

/** A canvas of `widthUnits x heightUnits` stage units at `scale` pixels per unit. */
export function createSurface(widthUnits: number, heightUnits: number, scale = 1, background?: string): Surface {
  const canvas = createCanvas(Math.round(widthUnits * scale), Math.round(heightUnits * scale));
  const raw = canvas.getContext("2d");
  raw.setTransform(scale, 0, 0, scale, 0, 0);
  if (background !== undefined) {
    raw.fillStyle = background;
    raw.fillRect(0, 0, widthUnits, heightUnits);
  }
  const cache = new Map<string, Path2D>();
  const ctx: Ctx2D = raw;
  const env: DrawEnv = {
    ctx,
    path(d: string): Path2D {
      let p = cache.get(d);
      if (p === undefined) {
        p = new Path2D(d);
        cache.set(d, p);
      }
      return p;
    },
  };
  return { canvas, raw, env, widthUnits, heightUnits, scale };
}

/** Writes the surface as a PNG and returns the absolute path. A relative path starts at the repo root. */
export function writePng(surface: Surface, file: string): string {
  const out = resolve(REPO_ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, surface.canvas.toBuffer("image/png"));
  return out;
}

/** Registers a font file (ttf, otf, woff, woff2) or its bytes under a family name. False when the canvas refuses it. */
export function registerFont(source: string | Uint8Array, family: string): boolean {
  try {
    const key = typeof source === "string"
      ? GlobalFonts.registerFromPath(resolve(REPO_ROOT, source), family)
      : GlobalFonts.register(Buffer.from(source), family);
    return Boolean(key) && GlobalFonts.has(family);
  } catch {
    return false;
  }
}
