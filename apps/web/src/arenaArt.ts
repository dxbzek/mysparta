/**
 * Arena art — every location is a real painted scene, not a filtered photo.
 *
 * Scenes are drawn as pixel art at the stage's NATIVE resolution (roughly
 * 280x132 px) and blown up by an integer factor, so the backdrop sits on the
 * exact same pixel grid as the fighters. Nothing is stretched or resampled,
 * which is what keeps the whole stage crisp.
 *
 * Each arena is a declarative spec (sky, skyline, ground, props); one painter
 * renders any spec, so the locations differ by real geography — mountains,
 * ruined towers, colosseum tiers, dunes, crystal spires — rather than by hue.
 */

import { makeRng, type Rng } from "@agoge/core";

export type RGB = [number, number, number];

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const shade = (c: RGB, f: number): RGB => [
  Math.max(0, Math.min(255, Math.round(c[0] * f))),
  Math.max(0, Math.min(255, Math.round(c[1] * f))),
  Math.max(0, Math.min(255, Math.round(c[2] * f))),
];

/** A native-resolution pixel buffer with integer-only drawing. */
class Px {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGB, a = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (a >= 1) {
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      return;
    }
    // blend over what is already there (layers paint back to front)
    const inv = 1 - a;
    d[i] = c[0] * a + d[i]! * inv;
    d[i + 1] = c[1] * a + d[i + 1]! * inv;
    d[i + 2] = c[2] * a + d[i + 2]! * inv;
    d[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c, a);
  }

  /** Fill a column from y0 down to y1 (inclusive). */
  col(x: number, y0: number, y1: number, c: RGB, a = 1): void {
    for (let y = y0; y <= y1; y++) this.set(x, y, c, a);
  }
}

/* ---------------- skyline profiles ---------------- */

export type SkylineKind =
  | "mountains"
  | "forest"
  | "pines"
  | "towers"
  | "dunes"
  | "spires"
  | "volcano"
  | "stands"
  | "cliffs"
  | "torii";

/** Returns the top y of the silhouette for every column. */
function profile(kind: SkylineKind, w: number, base: number, amp: number, rng: Rng): number[] {
  const top = new Array<number>(w).fill(base);

  switch (kind) {
    case "mountains": {
      // midpoint displacement — jagged ridges
      const pts: number[] = [];
      const steps = 8;
      for (let i = 0; i <= steps; i++) pts.push(base - rng.roll(Math.round(amp * 0.35), amp));
      for (let x = 0; x < w; x++) {
        const t = (x / (w - 1)) * steps;
        const i = Math.min(steps - 1, Math.floor(t));
        const f = t - i;
        top[x] = Math.round(pts[i]! + (pts[i + 1]! - pts[i]!) * f);
      }
      break;
    }
    case "cliffs": {
      let x = 0;
      while (x < w) {
        const seg = rng.roll(14, 34);
        const y = base - rng.roll(Math.round(amp * 0.3), amp);
        for (let i = 0; i < seg && x + i < w; i++) top[x + i] = y;
        x += seg;
      }
      break;
    }
    case "dunes": {
      const p1 = rng.roll(40, 90), p2 = rng.roll(17, 33), ph = rng.raw() * 6.28;
      for (let x = 0; x < w; x++) {
        const v = Math.sin((x / p1) * 6.28 + ph) * 0.6 + Math.sin((x / p2) * 6.28) * 0.4;
        top[x] = Math.round(base - amp * 0.5 - (v * amp) / 3);
      }
      break;
    }
    case "pines": {
      for (let x = 0; x < w; x++) top[x] = base;
      let x = -4;
      while (x < w + 4) {
        const rad = rng.roll(4, 8);
        const hgt = rng.roll(Math.round(amp * 0.5), amp);
        for (let i = -rad; i <= rad; i++) {
          const xx = x + i;
          if (xx < 0 || xx >= w) continue;
          const yTop = base - Math.round(hgt * (1 - Math.abs(i) / (rad + 1)));
          if (yTop < top[xx]!) top[xx] = yTop;
        }
        x += rng.roll(7, 14);
      }
      break;
    }
    case "forest": {
      // Broadleaf canopy: wide, shallow crowns sitting on trunks of varying
      // height. Wide-and-low is what separates a treeline from a ridgeline.
      for (let x = 0; x < w; x++) top[x] = base;
      // two passes so the canopy has depth rather than one even row of blobs
      for (let pass = 0; pass < 2; pass++) {
        const lift = pass === 0 ? 0 : Math.round(amp * 0.3);
        let x = -8;
        while (x < w + 8) {
          const rad = rng.roll(7, 15);
          const trunk = rng.roll(Math.round(amp * 0.2), Math.round(amp * 0.5)) + lift;
          const crownTop = base - trunk - Math.round(rad * 0.95);
          for (let i = -rad; i <= rad; i++) {
            const xx = x + i;
            if (xx < 0 || xx >= w) continue;
            const f = Math.abs(i) / (rad + 1);
            // circular crown — the arc keeps its rounded read at any scale
            const yTop = crownTop + Math.round(rad * 0.95 * (1 - Math.sqrt(1 - f * f)));
            if (yTop < top[xx]!) top[xx] = yTop;
          }
          x += rng.roll(9, 18);
        }
      }
      break;
    }
    case "towers": {
      let x = 0;
      while (x < w) {
        const tw = rng.roll(7, 18);
        const th = rng.roll(Math.round(amp * 0.25), amp);
        const y = base - th;
        const broken = rng.pct(45);
        for (let i = 0; i < tw && x + i < w; i++) {
          // ruined towers lose their top on one side
          const dip = broken && i > tw - 4 ? rng.roll(2, 7) : 0;
          top[x + i] = y + dip;
        }
        x += tw + rng.roll(2, 7);
      }
      break;
    }
    case "spires": {
      for (let x = 0; x < w; x++) top[x] = base;
      let x = 0;
      while (x < w) {
        const half = rng.roll(3, 9);
        const hgt = rng.roll(Math.round(amp * 0.4), amp);
        for (let i = -half; i <= half; i++) {
          const xx = x + i;
          if (xx < 0 || xx >= w) continue;
          const yTop = base - Math.round(hgt * (1 - Math.abs(i) / (half + 1)));
          if (yTop < top[xx]!) top[xx] = yTop;
        }
        x += rng.roll(9, 22);
      }
      break;
    }
    case "volcano": {
      const cx = Math.round(w * (0.34 + rng.raw() * 0.32));
      const half = Math.round(w * 0.3);
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x - cx) / half;
        // straight flanks (not a dome) are what make a cone read as a volcano
        const hgt = d >= 1 ? 0 : Math.round(amp * (1 - d) ** 0.85);
        top[x] = base - hgt;
      }
      // blow the crater open
      for (let i = -4; i <= 4; i++) {
        const xx = cx + i;
        if (xx >= 0 && xx < w) top[xx] = top[xx]! + (4 - Math.abs(i));
      }
      break;
    }
    case "stands": {
      // colosseum tiers stepping up toward the back
      const tiers = 3;
      for (let x = 0; x < w; x++) top[x] = base - amp;
      for (let t = 0; t < tiers; t++) {
        const y = base - amp + t * Math.round(amp / (tiers + 1));
        const from = Math.round((w * t) / (tiers * 2));
        for (let x = from; x < w - from; x++) if (y > top[x]!) top[x] = y;
      }
      break;
    }
    case "torii": {
      for (let x = 0; x < w; x++) top[x] = base;
      break;
    }
  }
  return top;
}

/* ---------------- ground ---------------- */

export type GroundKind =
  | "dirt"
  | "grass"
  | "snow"
  | "sand"
  | "stone"
  | "lava"
  | "water"
  | "ash";

export type PropKind = "grass" | "rocks" | "bones" | "torches" | "pillars" | "banners" | "crystals";

export interface ArenaSpec {
  name: string;
  /** sky colours, top → horizon */
  sky: [string, string];
  /** ground line as a fraction of scene height */
  horizon: number;
  far: { kind: SkylineKind; color: string; amp: number };
  mid?: { kind: SkylineKind; color: string; amp: number };
  ground: { kind: GroundKind; color: string };
  celestial?: { kind: "sun" | "moon"; x: number; r: number; color: string; glow?: string };
  stars?: number;
  clouds?: { count: number; color: string };
  /** haze band sitting on the horizon */
  fog?: string;
  props?: PropKind;
  /** subtle light wash over the finished painting (CSS gradient) */
  overlay?: string;
  weather?: string;
}

/* ---------------- the painter ---------------- */

function paintSky(px: Px, spec: ArenaSpec, groundY: number, rng: Rng): void {
  const top = hex(spec.sky[0]);
  const bot = hex(spec.sky[1]);
  const bands = 9;
  for (let y = 0; y < groundY; y++) {
    const t = groundY <= 1 ? 0 : y / (groundY - 1);
    const f = t * (bands - 1);
    const i = Math.min(bands - 2, Math.floor(f));
    const frac = f - i;
    const c0 = mix(top, bot, i / (bands - 1));
    const c1 = mix(top, bot, (i + 1) / (bands - 1));
    for (let x = 0; x < px.w; x++) {
      // ordered dither so the banding reads as deliberate pixel art
      const d = (((x & 1) + (y & 1) * 2) % 4) / 4;
      px.set(x, y, frac > d ? c1 : c0);
    }
  }

  if (spec.stars) {
    const starC: RGB = [235, 240, 255];
    for (let i = 0; i < spec.stars; i++) {
      const x = rng.int(px.w);
      const y = rng.int(Math.max(1, Math.round(groundY * 0.72)));
      px.set(x, y, starC, rng.pct(50) ? 1 : 0.55);
    }
  }

  if (spec.clouds) {
    const c = hex(spec.clouds.color);
    const lit = mix(c, [255, 255, 255], 0.4);
    for (let i = 0; i < spec.clouds.count; i++) {
      const cy = rng.roll(6, Math.max(8, Math.round(groundY * 0.55)));
      const cx = rng.int(px.w);
      const span = rng.roll(16, 40);
      const lumps = rng.roll(3, 5);
      // per-column top, so the cloud gets one continuous lit edge
      const tops = new Map<number, number>();
      for (let l = 0; l < lumps; l++) {
        const lx = cx + Math.round((l / (lumps - 1) - 0.5) * span);
        const lr = rng.roll(4, 9);
        for (let x = -lr; x <= lr; x++) {
          // flat-bottomed cumulus: a half-ellipse sitting on the base line
          const dy = Math.round(Math.sqrt(Math.max(0, 1 - (x / lr) ** 2)) * lr * 0.72);
          const top = cy - dy;
          const at = tops.get(lx + x);
          if (at === undefined || top < at) tops.set(lx + x, top);
        }
      }
      for (const [x, top] of tops) {
        for (let y = top; y <= cy; y++) px.set(x, y, c, 0.92);
        px.set(x, top, lit, 0.9);
      }
    }
  }

  if (spec.celestial) {
    const c = spec.celestial;
    const cx = Math.round(px.w * c.x);
    const cy = Math.round(groundY * 0.3);
    const body = hex(c.color);
    const glow = c.glow ? hex(c.glow) : null;
    if (glow) {
      const gr = c.r * 3;
      for (let y = cy - gr; y <= cy + gr; y++) {
        for (let x = cx - gr; x <= cx + gr; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > gr || d <= c.r) continue;
          px.set(x, y, glow, 0.32 * (1 - d / gr));
        }
      }
    }
    for (let y = cy - c.r; y <= cy + c.r; y++) {
      for (let x = cx - c.r; x <= cx + c.r; x++) {
        if (Math.hypot(x - cx, y - cy) > c.r) continue;
        px.set(x, y, body);
      }
    }
    if (c.kind === "moon") {
      // bite a crescent out of one side
      const ox = cx + Math.round(c.r * 0.55);
      for (let y = cy - c.r; y <= cy + c.r; y++) {
        for (let x = cx - c.r; x <= cx + c.r; x++) {
          if (Math.hypot(x - cx, y - cy) > c.r) continue;
          if (Math.hypot(x - ox, y - cy + 1) <= c.r * 0.92) {
            const t = mix(hex(spec.sky[0]), hex(spec.sky[1]), 0.3);
            px.set(x, y, t);
          }
        }
      }
    }
  }
}

function paintSkyline(
  px: Px,
  kind: SkylineKind,
  color: RGB,
  amp: number,
  groundY: number,
  rng: Rng,
  detail: boolean,
): void {
  const top = profile(kind, px.w, groundY, amp, rng);
  const rim = mix(color, [255, 255, 255], 0.12);
  for (let x = 0; x < px.w; x++) {
    const y0 = Math.max(0, top[x]!);
    px.col(x, y0, groundY - 1, color);
    // Lit top edge — only where the silhouette actually stands up, otherwise
    // a flat stretch draws a stray 1px wire along the horizon.
    if (y0 < groundY - 3) px.set(x, y0, rim);
  }

  // trunks read the canopy as trees rather than one solid green mass
  if (kind === "forest" && detail) {
    const trunk = shade(color, 0.72);
    for (let x = rng.roll(4, 12); x < px.w; x += rng.roll(11, 22)) {
      const canopy = top[x]!;
      if (canopy > groundY - 8) continue;
      px.col(x, groundY - Math.round((groundY - canopy) * 0.42), groundY - 1, trunk);
    }
  }

  if (!detail) return;

  if (kind === "cliffs" || kind === "towers" || kind === "stands") {
    // shade the face after each step down so blocks read as solid volumes
    const face = shade(color, 0.82);
    for (let x = 1; x < px.w; x++) {
      if (top[x]! <= top[x - 1]!) continue;
      for (let d = 0; d < 2 && x + d < px.w; d++) {
        px.col(x + d, top[x]! + 1, Math.min(groundY - 1, top[x]! + 9), face);
      }
    }
  }

  if (kind === "towers") {
    // lit windows scattered through the ruins
    const win = mix(color, [255, 214, 140], 0.75);
    for (let i = 0; i < Math.round(px.w / 14); i++) {
      const x = rng.int(px.w);
      const y = rng.roll(top[x]! + 3, groundY - 4);
      if (y <= top[x]! + 1) continue;
      px.rect(x, y, 1, 2, win);
    }
  }
  if (kind === "stands") {
    // arch openings and a speckled crowd
    const dark = shade(color, 0.55);
    const crowd = mix(color, [255, 230, 200], 0.45);
    for (let x = 4; x < px.w - 4; x += 9) {
      const y = top[x]! + 4;
      if (y > groundY - 6) continue;
      px.rect(x, y, 5, 6, dark);
      px.rect(x + 1, y - 1, 3, 1, dark);
    }
    for (let i = 0; i < px.w; i++) {
      const x = rng.int(px.w);
      const y = rng.roll(top[x]! + 1, top[x]! + 3);
      px.set(x, y, crowd, 0.8);
    }
  }
  if (kind === "volcano") {
    // a molten channel running from the crater down the flank, plus its glow
    let cx = 0;
    let best = groundY;
    for (let x = 0; x < px.w; x++) if (top[x]! < best) { best = top[x]!; cx = x; }
    const lava = hex("#ff7a2a");
    const hot = hex("#ffd27a");
    for (let i = -5; i <= 5; i++) px.set(cx + i, best + 1, lava, 0.85 - Math.abs(i) / 8);
    for (let y = best - 4; y < best + 3; y++) {
      for (let x = cx - 9; x <= cx + 9; x++) {
        const d = Math.hypot((x - cx) / 2.2, y - best);
        if (d < 5) px.set(x, y, hot, 0.16 * (1 - d / 5));
      }
    }
    let x = cx;
    for (let y = best + 1; y < groundY; y++) {
      px.col(x, y, y, lava, 0.9);
      px.set(x + 1, y, hot, 0.4);
      if (rng.pct(45)) x += rng.pct(50) ? 1 : -1;
    }
  }
  if (kind === "torii") {
    // a shrine gate straddling the back of the arena
    const gx = Math.round(px.w * 0.5);
    const gh = Math.round(amp * 1.15);
    const gw = Math.round(amp * 0.9);
    const post = color;
    const cap = mix(color, [255, 255, 255], 0.18);
    const yTop = groundY - gh;
    px.rect(gx - gw, yTop, 4, gh, post);
    px.rect(gx + gw - 4, yTop, 4, gh, post);
    px.rect(gx - gw - 6, yTop, gw * 2 + 12, 4, post);
    px.rect(gx - gw - 6, yTop, gw * 2 + 12, 1, cap);
    px.rect(gx - gw - 3, yTop + 7, gw * 2 + 6, 3, post);
  }
}

function paintGround(px: Px, spec: ArenaSpec, groundY: number, rng: Rng): void {
  const base = hex(spec.ground.color);
  const kind = spec.ground.kind;
  const lip = mix(base, [255, 255, 255], 0.3);

  for (let y = groundY; y < px.h; y++) {
    // the floor darkens toward the viewer so the plane reads as depth
    const t = (y - groundY) / Math.max(1, px.h - groundY);
    const row = shade(base, 1 - t * 0.42);
    for (let x = 0; x < px.w; x++) px.set(x, y, row);
  }
  px.rect(0, groundY, px.w, 1, lip);
  // the backdrop's own shadow, so the silhouettes sit ON the floor
  for (let i = 1; i <= 4; i++) px.rect(0, groundY + i, px.w, 1, [8, 10, 18], 0.2 - i * 0.04);

  const dark = shade(base, 0.7);
  const light = mix(base, [255, 255, 255], 0.2);

  switch (kind) {
    case "dirt":
    case "ash": {
      for (let i = 0; i < px.w * 2; i++) {
        const x = rng.int(px.w);
        const y = rng.roll(groundY + 2, px.h - 1);
        px.set(x, y, rng.pct(50) ? dark : light, 0.5);
      }
      break;
    }
    case "grass": {
      for (let x = 0; x < px.w; x++) {
        if (rng.pct(55)) px.set(x, groundY - 1, mix(base, [120, 200, 90], 0.5));
        if (rng.pct(22)) px.set(x, groundY - 2, mix(base, [120, 200, 90], 0.35));
      }
      for (let i = 0; i < px.w; i++) px.set(rng.int(px.w), rng.roll(groundY + 2, px.h - 1), dark, 0.45);
      break;
    }
    case "snow": {
      for (let i = 0; i < px.w * 1.5; i++) {
        px.set(rng.int(px.w), rng.roll(groundY + 1, px.h - 1), light, 0.5);
      }
      for (let i = 0; i < 5; i++) {
        const y = rng.roll(groundY + 3, px.h - 2);
        const x = rng.int(px.w);
        px.rect(x, y, rng.roll(6, 18), 1, light, 0.6);
      }
      break;
    }
    case "sand": {
      for (let y = groundY + 2; y < px.h; y += 3) {
        const off = rng.int(px.w);
        for (let x = 0; x < px.w; x++) {
          if ((x + off) % rng.roll(9, 14) < 4) px.set(x, y, light, 0.35);
        }
      }
      break;
    }
    case "stone": {
      // rows widen toward the viewer — cheap, convincing floor perspective
      const seam = shade(base, 0.62);
      let y = groundY + 3;
      let step = 4;
      let row = 0;
      while (y < px.h) {
        px.rect(0, y, px.w, 1, seam, 0.7);
        const cell = 10 + row * 4;
        const stagger = row % 2 ? cell >> 1 : 0;
        for (let x = stagger; x < px.w; x += cell) px.rect(x, y - step + 1, 1, step - 1, seam, 0.5);
        y += step;
        step += 2;
        row++;
      }
      break;
    }
    case "lava": {
      const glow = hex("#ff8a3d");
      for (let i = 0; i < 7; i++) {
        let x = rng.int(px.w);
        let y = rng.roll(groundY + 2, px.h - 2);
        for (let s = 0; s < rng.roll(8, 26); s++) {
          px.set(x, y, glow, 0.8);
          px.set(x, y + 1, mix(glow, [255, 230, 120], 0.6), 0.5);
          x += rng.pct(50) ? 1 : rng.pct(50) ? 0 : -1;
          y += rng.pct(28) ? 1 : 0;
          if (x < 0 || x >= px.w || y >= px.h) break;
        }
      }
      break;
    }
    case "water": {
      // ripples lengthen and spread as the surface comes toward the viewer
      let y = groundY + 1;
      let step = 2;
      while (y < px.h) {
        const len = 2 + Math.round((y - groundY) / 6);
        for (let x = rng.int(len * 3); x < px.w; x += rng.roll(len * 2, len * 5)) {
          px.rect(x, y, len, 1, light, 0.55);
        }
        y += step;
        if ((y - groundY) % 10 === 0) step++;
      }
      break;
    }
  }

  // Near-field debris: features grow as the floor approaches the viewer, which
  // is what stops a flat colour field from reading as a painted wall.
  if (kind !== "water" && kind !== "lava") {
    const spec = kind === "snow" ? light : dark;
    for (let i = 0; i < px.w * 0.8; i++) {
      const t = Math.pow(rng.raw(), 0.55);
      const y = groundY + 3 + Math.round(t * (px.h - groundY - 4));
      const x = rng.int(px.w);
      const s = 1 + Math.round(t * 2);
      px.rect(x, y, s, Math.max(1, s - 1), spec, 0.3 + t * 0.25);
      if (s > 2) px.rect(x, y, s, 1, mix(spec, [255, 255, 255], 0.3), 0.25);
    }
  }
}

function paintProps(px: Px, kind: PropKind, groundY: number, rng: Rng, accent: RGB): void {
  // Props frame the scene at the edges and centre — the two zones where a
  // fighter is not standing when the bout opens.
  const spots: number[] = [];
  const lanes = [0.02, 0.09, 0.44, 0.55, 0.91, 0.98];
  for (const l of lanes) if (rng.pct(76)) spots.push(Math.round(px.w * l));

  for (const x of spots) {
    switch (kind) {
      case "grass": {
        const c = mix(accent, [130, 205, 100], 0.55);
        for (let i = -2; i <= 2; i++) px.col(x + i, groundY - rng.roll(1, 4), groundY - 1, c);
        break;
      }
      case "rocks": {
        const c = accent;
        const w = rng.roll(3, 7);
        const h = rng.roll(2, 5);
        px.rect(x, groundY - h, w, h, c);
        px.rect(x, groundY - h, w, 1, mix(c, [255, 255, 255], 0.25));
        break;
      }
      case "bones": {
        const c: RGB = [214, 208, 190];
        px.rect(x, groundY - 1, rng.roll(4, 9), 1, c);
        px.rect(x + 1, groundY - 3, 1, 2, c);
        break;
      }
      case "crystals": {
        const c = accent;
        const h = rng.roll(5, 13);
        for (let i = 0; i < h; i++) {
          const half = Math.max(0, Math.round((1 - i / h) * 3));
          for (let d = -half; d <= half; d++) px.set(x + d, groundY - 1 - i, c, 0.92);
        }
        px.col(x, groundY - h, groundY - 1, mix(c, [255, 255, 255], 0.4), 0.7);
        break;
      }
      case "torches": {
        const post: RGB = [70, 54, 40];
        const h = rng.roll(16, 24);
        px.rect(x, groundY - h, 3, h, post);
        const flame = hex("#ffb347");
        px.rect(x, groundY - h - 4, 3, 4, flame);
        px.rect(x, groundY - h - 6, 2, 2, mix(flame, [255, 255, 200], 0.6));
        break;
      }
      case "pillars": {
        const c = accent;
        const h = rng.roll(22, 38);
        px.rect(x, groundY - h, 7, h, c);
        px.rect(x + 5, groundY - h, 2, h, shade(c, 0.82)); // shaded face
        px.rect(x - 2, groundY - h, 11, 3, mix(c, [255, 255, 255], 0.22));
        px.rect(x - 2, groundY - 3, 11, 3, shade(c, 0.85));
        break;
      }
      case "banners": {
        const pole: RGB = [64, 52, 44];
        const h = rng.roll(16, 26);
        px.rect(x, groundY - h, 1, h, pole);
        px.rect(x + 1, groundY - h + 2, 5, rng.roll(7, 12), accent);
        break;
      }
    }
  }
}

/** Paint one arena scene at native resolution and return it as a data URL. */
function render(spec: ArenaSpec, w: number, h: number): string {
  const rng = makeRng(
    // stable per arena + size, so a scene never re-rolls between renders
    [...spec.name].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, w * 7919 + h),
  );
  const px = new Px(w, h);
  const groundY = Math.round(h * spec.horizon);

  paintSky(px, spec, groundY, rng);

  const skyBottom = hex(spec.sky[1]);
  // Atmospheric perspective: distant layers wash toward the sky — but only
  // enough to sit back, never so much that the silhouette stops reading.
  paintSkyline(px, spec.far.kind, mix(hex(spec.far.color), skyBottom, 0.24), spec.far.amp, groundY, rng, true);
  if (spec.mid) {
    paintSkyline(px, spec.mid.kind, mix(hex(spec.mid.color), skyBottom, 0.07), spec.mid.amp, groundY, rng, true);
  }

  if (spec.fog) {
    const f = hex(spec.fog);
    for (let y = groundY - 8; y < groundY; y++) {
      const a = 0.42 * (1 - (groundY - y) / 9);
      for (let x = 0; x < w; x++) px.set(x, y, f, a);
    }
  }

  paintGround(px, spec, groundY, rng);
  if (spec.props) paintProps(px, spec.props, groundY, rng, hex(spec.mid?.color ?? spec.far.color));

  // Vignette — darkens the frame edges so fighters and HP bars stay readable.
  // The falloff is smoothstepped: a linear ramp leaves a visible seam where it
  // reaches zero, which reads as a band across a pale sky.
  const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let y = 0; y < h; y++) {
    const ey = smooth(1 - y / (h * 0.42));
    for (let x = 0; x < w; x++) {
      const ex = smooth(1 - Math.min(x, w - 1 - x) / (w * 0.34));
      const a = Math.min(0.34, ex * 0.24 + ey * 0.18);
      if (a > 0.004) px.set(x, y, [6, 8, 16], a);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  img.data.set(px.data);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

const cache = new Map<string, string>();

/** Cached scene for an arena at a given native size. */
export function arenaScene(spec: ArenaSpec, w: number, h: number): string {
  const key = `${spec.name}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let url: string;
  try {
    url = render(spec, w, h);
  } catch {
    url = ""; // canvas unavailable — the CSS gradient fallback shows instead
  }
  cache.set(key, url);
  return url;
}
