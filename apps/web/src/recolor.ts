/**
 * Appearance recolouring — real hair / face / clothes customization on the
 * hand-animated sheets. Each fighter has three safe colour channels found by
 * palette analysis (hue/saturation windows that never touch outlines or
 * skin). Recolouring replaces hue and blends saturation while keeping
 * luminance, so every hand-drawn shade and highlight survives.
 *
 * Runs once per (fighter, sheet, tint) on an offscreen canvas and caches
 * the result as a data URL.
 */

export interface TintChoice {
  hair: number;
  face: number;
  clothes: number;
}

export interface TintOption {
  name: string;
  /** target hue (0-360); -1 = keep the original art untouched */
  h: number;
  s: number;
  /** swatch colour for the picker */
  css: string;
}

const opt = (name: string, h: number, s = 0.62, l = 46): TintOption => ({
  name,
  h,
  s,
  css: h < 0 ? "#b9a888" : `hsl(${h} ${Math.round(s * 100)}% ${l}%)`,
});

export const HAIR_TINTS: TintOption[] = [
  opt("Natural", -1),
  opt("Crimson", 350),
  opt("Amber", 32),
  opt("Gold", 48),
  opt("Emerald", 140),
  opt("Teal", 175),
  opt("Azure", 210),
  opt("Violet", 270),
  opt("Magenta", 310),
  opt("Rose", 330),
];

export const FACE_TINTS: TintOption[] = [
  opt("Natural", -1),
  opt("Crimson", 352),
  opt("Gold", 45),
  opt("Emerald", 145),
  opt("Azure", 205),
  opt("Violet", 268),
  opt("Rose", 335),
  opt("Onyx", 255, 0.18, 30),
];

export const CLOTH_TINTS: TintOption[] = [
  opt("Natural", -1),
  opt("Charcoal", 250, 0.14, 32),
  opt("Crimson", 355),
  opt("Rust", 20),
  opt("Gold", 44),
  opt("Moss", 95),
  opt("Emerald", 150),
  opt("Teal", 178),
  opt("Azure", 212),
  opt("Indigo", 245),
  opt("Violet", 275),
  opt("Rose", 330),
];

interface Channel {
  hueMin: number;
  hueMax: number; // window may wrap past 360
  satMin: number;
  satMax: number;
  lumMin: number;
  lumMax: number;
}

/** Per-fighter channel windows (from palette analysis of the sheets). */
const CHANNELS: Record<number, { hair: Channel; face: Channel; clothes: Channel }> = {
  // Ronin: crimson plume / purple face-scarf / plum robe
  0: {
    hair: { hueMin: 315, hueMax: 375, satMin: 0.5, satMax: 1, lumMin: 0.1, lumMax: 0.9 },
    face: { hueMin: 235, hueMax: 295, satMin: 0.12, satMax: 1, lumMin: 0.1, lumMax: 0.9 },
    clothes: { hueMin: 295, hueMax: 352, satMin: 0.1, satMax: 0.48, lumMin: 0.1, lumMax: 0.92 },
  },
  // Shinobi: gray wraps / red mask / blue garb
  1: {
    hair: { hueMin: 0, hueMax: 360, satMin: 0, satMax: 0.15, lumMin: 0.16, lumMax: 0.88 },
    face: { hueMin: 318, hueMax: 380, satMin: 0.4, satMax: 1, lumMin: 0.1, lumMax: 0.9 },
    clothes: { hueMin: 195, hueMax: 265, satMin: 0.16, satMax: 1, lumMin: 0.1, lumMax: 0.92 },
  },
};

function inWindow(h: number, s: number, l: number, c: Channel): boolean {
  if (s < c.satMin || s > c.satMax || l < c.lumMin || l > c.lumMax) return false;
  const max = c.hueMax > 360 ? c.hueMax - 360 : c.hueMax;
  if (c.hueMax > 360) return h >= c.hueMin || h <= max;
  return h >= c.hueMin && h <= c.hueMax;
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, s, l];
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/**
 * Produce a recoloured copy of a sheet for the given fighter + tint.
 * Resolves to a data URL; results are cached forever (small pixel art).
 */
export function tintedSheet(src: string, fighter: number, tint: TintChoice): Promise<string> {
  const noop =
    HAIR_TINTS[tint.hair]!.h < 0 && FACE_TINTS[tint.face]!.h < 0 && CLOTH_TINTS[tint.clothes]!.h < 0;
  if (noop) return Promise.resolve(src);
  const key = `${fighter}:${tint.hair}:${tint.face}:${tint.clothes}:${src.slice(-40)}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const p = new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        const ch = CHANNELS[fighter % 2]!;
        const jobs: Array<[Channel, TintOption]> = [];
        if (HAIR_TINTS[tint.hair]!.h >= 0) jobs.push([ch.hair, HAIR_TINTS[tint.hair]!]);
        if (FACE_TINTS[tint.face]!.h >= 0) jobs.push([ch.face, FACE_TINTS[tint.face]!]);
        if (CLOTH_TINTS[tint.clothes]!.h >= 0) jobs.push([ch.clothes, CLOTH_TINTS[tint.clothes]!]);
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3]! < 40) continue;
          const [h, s, l] = rgb2hsl(px[i]!, px[i + 1]!, px[i + 2]!);
          for (const [win, target] of jobs) {
            if (!inWindow(h, s, l, win)) continue;
            const ns = win.satMax <= 0.15 ? target.s * 0.55 : Math.max(s * 0.85, target.s * 0.7);
            const [r, g, b] = hsl2rgb(target.h, Math.min(1, ns), l);
            px[i] = r; px[i + 1] = g; px[i + 2] = b;
            break;
          }
        }
        ctx.putImageData(data, 0, 0);
        const url = canvas.toDataURL("image/png");
        cache.set(key, url);
        resolve(url);
      } catch {
        resolve(src); // canvas unavailable — ship the original art
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  }).finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}
