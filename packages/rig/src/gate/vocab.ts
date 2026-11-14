/**
 * The parts vocabulary. Every body part, weapon, prop and icon of both art packs is made with
 * these functions, so the content lane imports this file and never copies it.
 *
 * A part is a flat polygon in its bone's own frame (origin on the joint, y down, a limb hanging
 * straight along +y at rest). Its SVG path is absolute "M x y L x y ... Z" only: the engine reads
 * the points back to make the rough ink line, the halftone and the lit / shadow cut, so curves
 * are flattened here, never written as C or A commands.
 *
 * The two shared rules:
 *  - the outline rule: every part gets a rough Night Ink outline drawn under its group's fills
 *    (`engine/draw.ts`), one weight per kind (`LINE` in style.ts);
 *  - the one cel-shade rule: a part has its lit colour and one teal shadow, cut by the fixed
 *    world light; the optional `Shape.shade` path adds a fixed shadow shape (under a jaw, a fold).
 */

export type Pt = readonly [number, number];
export type Poly = readonly Pt[];

const r2 = (v: number): string => {
  const n = Math.round(v * 100) / 100;
  return Object.is(n, -0) ? "0" : String(n);
};

/** A closed polygon as an absolute SVG path. */
export function dPoly(pts: Poly): string {
  return "M" + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join("L") + "Z";
}
/** Several closed polygons as one path. */
export function dPolys(list: readonly Poly[]): string {
  return list.map(dPoly).join("");
}
/** Reads an absolute M/L/Z path back into polygons (what this file writes). */
export function parsePolys(d: string): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] | null = null;
  const re = /([MLZ])\s*([^MLZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]!.toUpperCase();
    const nums = (m[2] ?? "").trim().split(/[\s,]+/).filter((s) => s.length > 0).map(Number);
    if (cmd === "M") {
      cur = [];
      out.push(cur);
    }
    if (cmd === "Z") { cur = null; continue; }
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (cur === null) { cur = []; out.push(cur); }
      cur.push([nums[i]!, nums[i + 1]!]);
    }
  }
  return out.filter((p) => p.length >= 2);
}

export const DEG = Math.PI / 180;
export function rotPt(p: Pt, deg: number): Pt {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}
export function scalePoly(pts: Poly, k: number, ky = k): Pt[] {
  return pts.map((p) => [p[0] * k, p[1] * ky] as Pt);
}
export function movePoly(pts: Poly, dx: number, dy: number): Pt[] {
  return pts.map((p) => [p[0] + dx, p[1] + dy] as Pt);
}
export function mapPoly(pts: Poly, f: (p: Pt) => Pt): Pt[] {
  return pts.map(f);
}

/**
 * A limb segment hanging from its joint along +y: `len` long, half-widths from a profile
 * `[t, front, back]` (t 0 at the joint, 1 at the far end; front is the +x side). Both ends are
 * rounded with `ends` points, so two segments overlap into a round joint.
 */
export function limb(len: number, prof: readonly (readonly [number, number, number])[], k = 1, ends = 5): Pt[] {
  const side1 = prof.map(([t, f]) => [f * k, t * len] as Pt);
  const side2 = prof.map(([t, , b]) => [-b * k, t * len] as Pt).reverse();
  const first = prof[0]!;
  const last = prof[prof.length - 1]!;
  const cap = (cy: number, wf: number, wb: number, down: boolean): Pt[] => {
    const out: Pt[] = [];
    const r = (wf + wb) / 2;
    const cx = (wf - wb) / 2;
    for (let j = 1; j < ends; j++) {
      const g = (Math.PI * j) / ends;
      const x = cx + r * Math.cos(g) * (down ? 1 : -1);
      const y = cy + r * Math.sin(g) * 0.75 * (down ? 1 : -1);
      out.push([x, y]);
    }
    return out;
  };
  return [...side1, ...cap(len, last[1] * k, last[2] * k, true), ...side2, ...cap(0, first[1] * k, first[2] * k, false)];
}

/** A thin filled stroke along a polyline (ink lines inside a part: seams, brows, knuckles). */
export function inkLine(pts: Poly, w: number, taper = true): Pt[] {
  if (pts.length < 2) return [];
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const t = pts.length === 1 ? 0.5 : i / (pts.length - 1);
    const hw = (w / 2) * (taper ? 0.45 + 0.55 * Math.sin(Math.PI * (0.12 + 0.76 * t)) : 1);
    const p = pts[i]!;
    left.push([p[0] + nx * hw, p[1] + ny * hw]);
    right.push([p[0] - nx * hw, p[1] - ny * hw]);
  }
  return [...left, ...right.reverse()];
}

/** A closed outline of a circle or ellipse as a polygon. */
export function ellipsePoly(cx: number, cy: number, rx: number, ry: number, n = 16, rotDeg = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = rotPt([Math.cos(a) * rx, Math.sin(a) * ry], rotDeg);
    out.push([cx + p[0], cy + p[1]]);
  }
  return out;
}

/** Corner-rounded rectangle polygon. */
export function roundRect(x: number, y: number, w: number, h: number, r: number, n = 3): Pt[] {
  const out: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (90 * i) / n) * DEG;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -90);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, 90);
  corner(x + r, y + r, 180);
  return out;
}

/** A quadratic curve flattened to points (for hair locks, blades). */
export function quad(a: Pt, c: Pt, b: Pt, n = 6): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

// ------------------------------------------------------------------- derived data (engine side)

/** A stable 0..1 number from two integers. */
export function hash01(seed: number, n: number): number {
  let h = (seed | 0) ^ Math.imul(n + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** A stable seed from a string. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

export function polyArea(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    const r = p[(i + 1) % p.length]!;
    a += q[0] * r[1] - r[0] * q[1];
  }
  return Math.abs(a / 2);
}
export function polyPerimeter(p: Poly): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    const r = p[(i + 1) % p.length]!;
    s += Math.hypot(r[0] - q[0], r[1] - q[1]);
  }
  return s;
}
/** About how thick a part is (twice its mean half-width). */
export function thickness(p: Poly): number {
  const per = polyPerimeter(p);
  return per > 0 ? (4 * polyArea(p)) / per : 0;
}

/**
 * The rough ink line: the outline cut into short pieces and each point pushed in or out a little
 * by a smooth seeded wobble. Deterministic: the same polygon always gives the same line.
 */
export function roughPoly(p: Poly, seed: number, amp: number, seg: number): Pt[] {
  const out: Pt[] = [];
  let k = 0;
  // signed area tells which side is outside
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!;
    const r = p[(i + 1) % p.length]!;
    area += q[0] * r[1] - r[0] * q[1];
  }
  const outSign = area >= 0 ? -1 : 1;
  const ph1 = hash01(seed, 1) * 6.283;
  const ph2 = hash01(seed, 2) * 6.283;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(l / seg));
    const nx = l > 0 ? (outSign * dy) / l : 0;
    const ny = l > 0 ? (-outSign * dx) / l : 0;
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const w = Math.sin(k * 0.9 + ph1) * 0.6 + Math.sin(k * 2.3 + ph2) * 0.4 + (hash01(seed, k + 10) - 0.5) * 0.5;
      const o = amp * (0.35 + w);
      out.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
      k += 1;
    }
  }
  return out;
}

/** Halftone dots on a turned grid covering a box, as one path of small diamonds-ish octagons. */
export function halftone(minX: number, minY: number, maxX: number, maxY: number, step: number, r: number, angleDeg: number): string {
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const R = Math.hypot(maxX - minX, maxY - minY) / 2 + step;
  const n = Math.ceil(R / step);
  let d = "";
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const off = (j & 1) === 0 ? 0 : step / 2;
      const p = rotPt([i * step + off, j * step * 0.866], angleDeg);
      const x = cx + p[0];
      const y = cy + p[1];
      if (x < minX - r || x > maxX + r || y < minY - r || y > maxY + r) continue;
      d += `M${r2(x + r)} ${r2(y)}L${r2(x + r * 0.5)} ${r2(y + r * 0.87)}L${r2(x - r * 0.5)} ${r2(y + r * 0.87)}L${r2(x - r)} ${r2(y)}L${r2(x - r * 0.5)} ${r2(y - r * 0.87)}L${r2(x + r * 0.5)} ${r2(y - r * 0.87)}Z`;
    }
  }
  return d;
}

export function bbox(polys: readonly Poly[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of polys) for (const q of p) {
    if (q[0] < x0) x0 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[0] > x1) x1 = q[0];
    if (q[1] > y1) y1 = q[1];
  }
  return [x0, y0, x1, y1];
}
