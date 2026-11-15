/**
 * Icons, 24-unit box (owner: "Improve icons please"). One rule set for all of them:
 *  - one bold silhouette per icon that still reads at 28 px and as a black silhouette;
 *  - one frame per kind: passives and boosters an ink-stamped round badge, Moves a torn square
 *    sticker turned a little (so the active skills stand out), shields a heater-shield frame,
 *    UI controls no frame (a plain bold glyph);
 *  - rarity is the frame's tone. The icon slots the engine has (`ColourSlot`, coloured by
 *    `svg.ts`) hold no green, blue or purple, so rarity is a ladder of tones from dull to bright:
 *    common "bottom" (dull brown), uncommon "wood" (red-brown), rare "metal" (gold), epic "top"
 *    (hot orange), mythic "white" (cream). The DOM card still shows the rarity word and colour;
 *  - the gritty finish: every filled shape gets the engine's ink outline, and the pictogram one
 *    teal shadow (`shade`) on its far side from the lamp (lower right); at most three shapes and
 *    one ink detail, nothing finer than about 1.2 units.
 */
import type { CompanionId, Rarity, ShieldId, SkillId, StatKey } from "@rankzero/core";
import { RARITY_OF } from "@rankzero/core";
import type { ColourSlot, ContentUi, GateUi, IconArt, WeaponArt } from "../contracts";
import type { Poly, Pt } from "../gate/vocab";
import { dPoly, dPolys, ellipsePoly, hash01, inkLine, parsePolys, quad, rotPt, roundRect } from "../gate/vocab";

type Slot = ColourSlot | "self";
type IconShape = IconArt["shapes"][number];

export const RARITY_TONE: Readonly<Record<Rarity, ColourSlot>> = { common: "bottom", uncommon: "wood", rare: "metal", epic: "top", mythic: "white" };

// ------------------------------------------------------------------------------- geometry
/** The part of a polygon on the far side from the lamp (lower right): Sutherland-Hodgman against
 *  one half plane, keeping the last `share` of its extent along the light. */
function farSide(p: Poly, share = 0.42): Pt[] {
  const dx = 0.72;
  const dy = 0.62;
  const proj = (q: Pt): number => q[0] * dx + q[1] * dy;
  const vals = p.map(proj);
  const k = Math.max(...vals) - share * (Math.max(...vals) - Math.min(...vals));
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const ia = proj(a) >= k;
    const ib = proj(b) >= k;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (k - proj(a)) / (proj(b) - proj(a));
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
/** A filled shape with its far-side teal shadow. */
function solid(polys: readonly Poly[], slot: Slot, shade = true, share = 0.3): IconShape {
  const s: IconShape = { d: dPolys(polys), slot };
  if (shade) {
    const sh = polys.map((p) => farSide(p, share)).filter((p) => p.length >= 3);
    if (sh.length > 0) s.shade = dPolys(sh);
  }
  return s;
}
const flat = (polys: readonly Poly[], slot: Slot): IconShape => ({ d: dPolys(polys), slot });
const inkOf = (list: readonly Poly[], w: number, taper = false): IconShape => ({ d: dPolys(list.map((p) => inkLine(p, w, taper))), slot: "ink" });
const circ = (cx: number, cy: number, r: number, n = 20, ry = r): Pt[] => ellipsePoly(cx, cy, r, ry, n);
const tr = (p: Poly, dx: number, dy: number, k = 1, rot = 0, cx = 12, cy = 12): Pt[] =>
  p.map(([x, y]) => { const r = rotPt([(x - cx) * k, (y - cy) * k], rot); return [cx + r[0] + dx, cy + r[1] + dy] as Pt; });
/** A thick band along a curve, flat ends. */
const band = (pts: Poly, w: number): Pt[] => inkLine(pts, w, false);
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 12): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * Math.PI / 180; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
};

// ---------------------------------------------------------------------------------- frames
/** Ink-stamped round badge: a slightly uneven rim in the rarity tone around a dark disc. */
function roundBadge(seed: number, tone: ColourSlot): IconShape[] {
  const rim: Pt[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = 11.5 - hash01(seed, i) * 0.6;
    rim.push([12 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
  }
  return [flat([rim], tone), flat([circ(12, 12, 8.4, 26)], "hair")];
}
/** Torn sticker (Moves): a square turned 7 degrees with torn, jagged edges. */
function sticker(seed: number, tone: ColourSlot): IconShape[] {
  const pts: Pt[] = [];
  const side = (a: Pt, b: Pt, n: number, s: number): void => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const j = (hash01(seed, s * 20 + i) - 0.5) * 1.1;
      const nx = -(b[1] - a[1]);
      const ny = b[0] - a[0];
      const l = Math.hypot(nx, ny);
      pts.push([a[0] + (b[0] - a[0]) * t + (nx / l) * j, a[1] + (b[1] - a[1]) * t + (ny / l) * j]);
    }
  };
  const c: Pt[] = [[1.6, 1.8], [22.4, 1.4], [22.6, 22.4], [1.4, 22.6]];
  side(c[0]!, c[1]!, 9, 0); side(c[1]!, c[2]!, 9, 1); side(c[2]!, c[3]!, 9, 2); side(c[3]!, c[0]!, 9, 3);
  // a torn-off corner (top right)
  const rim = tr(pts, 0, 0, 1, 7).map((p, i) => (i === 9 ? [p[0] - 2.2, p[1] + 2.0] as Pt : p));
  return [flat([rim], tone), flat([tr(roundRect(4.2, 4.2, 15.6, 15.6, 2.2), 0, 0, 1, 7)], "hair")];
}
/** Heater-shield frame for shields. */
function shieldFrame(tone: ColourSlot): IconShape[] {
  const outer: Pt[] = [[2.6, 2.4], [21.4, 2.4], [21.4, 11], ...quad([21.4, 11], [20.6, 18.6], [12, 22.6], 6).slice(1), ...quad([12, 22.6], [3.4, 18.6], [2.6, 11], 6).slice(1)];
  const inner = tr(outer, 0, -0.3, 0.8);
  return [flat([outer], tone), flat([inner], "hair")];
}

// ------------------------------------------------------------------------------ pictograms
// Each pictogram is drawn to sit inside the badge disc (radius about 8, centre 12, 12).
const P = {
  heart: [...quad([12, 19.4], [4.6, 14], [5.4, 9]), ...quad([5.4, 9], [6.6, 4.8], [12, 8.2]).slice(1), ...quad([12, 8.2], [17.4, 4.8], [18.6, 9]).slice(1), ...quad([18.6, 9], [19.4, 14], [12, 19.4]).slice(1, -1)] as Pt[],
  fist: [[6.4, 9.4], [8.6, 6.6], [16.6, 6.4], [18.4, 8.4], [18.4, 14.6], [16.2, 17.8], [9.4, 17.8], [6.8, 15.4]] as Pt[],
  bolt: [[12.8, 3.6], [5.6, 13.6], [10.8, 13.6], [8.6, 20.8], [18.4, 9.8], [13.2, 9.8], [16.2, 3.6]] as Pt[],
};

interface Pic { shapes: IconShape[] }
const pic = (...s: IconShape[]): Pic => ({ shapes: s });
const knuckles = (y0: number, y1: number): IconShape => inkOf([[[10.4, y0], [10.4, y1]], [[13.2, y0], [13.2, y1]], [[15.9, y0], [15.9, y1]]], 0.9);

const PICS: Record<SkillId, Pic> = {
  // boosters
  "big-heart": pic(solid([P.heart], "top"), inkOf([[[8.4, 9.6], [7.8, 12]]], 1.1, true)),
  "heavy-hands": pic(solid([roundRect(3.2, 6.4, 4.2, 11.2, 1.2), roundRect(16.6, 6.4, 4.2, 11.2, 1.2), roundRect(6.8, 10.6, 10.4, 2.8, 0.6)], "metal"),
    flat([roundRect(1.8, 9.4, 1.8, 5.2, 0.6), roundRect(20.4, 9.4, 1.8, 5.2, 0.6)], "metal")),
  "light-feet": pic(solid([[[4.6, 15.6], [6, 11], [10, 10.4], [12.6, 7.4], [15.6, 7.6], [16.4, 11.4], [19.4, 13], [19.6, 16.6], [5, 16.8]]], "white"),
    flat([[[4.4, 16.4], [19.8, 16.4], [19.6, 18.4], [4.6, 18.4]]], "top"), inkOf([[[2.6, 8.6], [6.4, 8.6]], [[2.2, 11.2], [4.8, 11.2]]], 1.0)),
  "fast-twitch": pic(solid([P.bolt], "metal")),
  "glass-cannon": pic(solid([[[4.6, 14.4], [15.8, 7.4], [18.2, 10.8], [8.2, 17.4]]], "white"), solid([circ(8.2, 17.6, 3.0, 14)], "wood"),
    inkOf([[[11, 10.4], [12.2, 12.6], [11.2, 13.4], [12.6, 15.4]]], 0.9)),
  mountain: pic(solid([[[3.6, 18.6], [10, 6.4], [13.2, 11.4], [15.2, 8.8], [20.4, 18.6]]], "bottom"), flat([[[8.2, 9.8], [10, 6.4], [11.8, 9.6], [10.8, 10.6], [10, 9.6], [9, 10.6]]], "white")),
  // passives
  padding: pic(solid([[[4.2, 4.6], ...quad([4.2, 4.6], [12, 7.4], [19.8, 4.6], 6).slice(1), ...quad([19.8, 4.6], [17, 12], [19.8, 19.4], 6).slice(1), ...quad([19.8, 19.4], [12, 16.6], [4.2, 19.4], 6).slice(1), ...quad([4.2, 19.4], [7, 12], [4.2, 4.6], 6).slice(1, -1)]], "white"),
    flat([circ(12, 12, 1.4, 10)], "ink")),
  anticipation: pic(solid([[...quad([3.6, 12], [12, 4.2], [20.4, 12], 8), ...quad([20.4, 12], [12, 19.8], [3.6, 12], 8).slice(1, -1)]], "white"), flat([circ(12, 12, 3.6, 14)], "ink")),
  "sharpening-stone": pic(solid([[[4.2, 15.2], [17.4, 12.6], [19.6, 15.8], [6.4, 18.6]]], "bottom"), solid([[[5.6, 12.4], [16.6, 4.8], [18.6, 6.2], [8.4, 13.6]]], "metal")),
  "bare-knuckle": pic(solid([[[5.6, 10], ...arc(8.2, 7.6, 2.0, 180, 360, 5), ...arc(12.2, 6.8, 2.0, 180, 360, 5), ...arc(16.2, 7.6, 2.0, 180, 360, 5), [18.4, 10.4], [18.6, 15], [16.4, 18.4], [8.6, 18.4], [5.8, 15.6]]], "skin"),
    flat([[[5.8, 12.6], [18.6, 12], [18.6, 14.6], [6.2, 15.4]]], "white")),
  payback: pic(solid([band([[17, 16.8], [17, 9.4], [15.4, 6.6], [12, 6], [8.6, 6.8], [7.4, 10]], 3.0), [[3.8, 9.4], [7.4, 14.2], [11, 9.2]]], "top")),
  flurry: pic(solid([tr(starPoly(8, 9.8, 2.9), 0, 0, 1, 10, 9.4, 13.4).map(([x, y]) => [x - 1.4, y + 0.6] as Pt)], "metal"),
    solid([starPoly(8, 6.0, 2.2).map(([x, y]) => [x + 4.6, y - 3.0] as Pt)], "top")),
  "firm-grip": pic(solid([roundRect(3.2, 10.6, 17.6, 2.8, 1)], "metal"), solid([[[7.6, 8.6], [16.2, 8.2], [17.4, 10.6], [17.4, 15.6], [15.6, 17.6], [8.6, 17.6], [6.8, 15.4]]], "skin"),
    inkOf([[[10.4, 13.6], [10.4, 17]], [[13.2, 13.6], [13.2, 17]]], 0.85)),
  "head-start": pic(solid([roundRect(5.8, 4.2, 1.9, 16.4, 0.8)], "metal"), solid([[[7.6, 4.8], [19.2, 5.8], [16.4, 9.4], [19.4, 13.2], [7.6, 12.8]]], "white"),
    flat([roundRect(10.6, 5.4, 2.8, 3.4, 0.2), roundRect(13.4, 8.8, 2.8, 3.4, 0.2)], "ink")),
  "sharp-eye": pic(flat([ringOf(12, 12, 4.6, 6.8)], "top"), flat([roundRect(11, 3.4, 2, 5.2, 0.4), roundRect(11, 15.4, 2, 5.2, 0.4), roundRect(3.4, 11, 5.2, 2, 0.4), roundRect(15.4, 11, 5.2, 2, 0.4)], "white"), flat([circ(12, 12, 1.6, 10)], "white")),
  parry: pic(solid([[[3.6, 6.4], [6.4, 3.6], [20.4, 17.6], [17.6, 20.4]]], "metal"), solid([[[20.4, 6.4], [17.6, 3.6], [3.6, 17.6], [6.4, 20.4]]], "white")),
  "heavy-lifter": pic(solid([[[6.4, 19.4], [5.4, 13.6], [7.4, 10.4], [16.6, 10.4], [18.6, 13.6], [17.6, 19.4]], band([[8.6, 10.6], [8.6, 6.2], [15.4, 6.2], [15.4, 10.6]], 2.4)], "bottom")),
  pitcher: pic(solid([circ(16, 9, 3.8, 16)], "white"), flat([band(arc(14, 15, 8.6, 160, 250, 10), 2.0)], "top"), inkOf([[[14, 7.4], [15.4, 10.8]], [[17.4, 7.0], [18.2, 9.2]]], 0.7, true)),
  "plate-vest": pic(solid([[[6.4, 4.6], [9.6, 4.6], [12, 7.4], [14.4, 4.6], [17.6, 4.6], [19.2, 9], [18.6, 19.4], [5.4, 19.4], [4.8, 9]]], "metal"),
    inkOf([[[7.2, 13.4], [16.8, 13.4]]], 1.0)),
  "knock-loose": pic(solid([tr(roundRect(4, 11, 15, 2.6, 1.0), 1.4, -1.8, 1, -38)], "metal"), solid([[[3.8, 19.6], [5.4, 15.4], [9.6, 15.0], [10.8, 18.2], [9.4, 20.4]]], "skin"),
    inkOf([[[14.6, 15.6], [18.6, 17.4]], [[16, 13.4], [19.8, 14.0]]], 1.0)),
  "last-stand": pic(solid([P.heart.map(([x, y]) => [x, y] as Pt)], "white"), inkOf([[[12, 8.4], [10.6, 11.4], [13.2, 13.2], [11.4, 16.4]]], 1.3)),
  stubborn: pic(solid([[[4.4, 7.2], [19.6, 7.2], [19.6, 9.6], [15.4, 11.4], [15, 15.2], [18.6, 18.6], [5.4, 18.6], [9, 15.2], [8.6, 11.4], [4.4, 9.4]]], "bottom")),
  slippery: pic(solid([[[12, 12.6], [5.4, 18.4], [4.2, 15.8], [9.4, 11], [6.6, 4.8], [9.6, 4.4], [12.2, 10], [14.6, 4.4], [17.6, 4.8], [14.8, 11], [19.8, 15.8], [18.6, 18.4]]], "metal"),
    flat([roundRect(11, 11.2, 2, 8.4, 0.8)], "wood")),
  "quick-swap": pic(solid([([[4.2, 9.2], [14.6, 9.2], [14.6, 6], [19.8, 10.6], [14.6, 15.2], [14.6, 12]] as Pt[]).map(([x, y]) => [x, y - 2.4] as Pt)], "white"),
    solid([([[19.8, 14.8], [9.4, 14.8], [9.4, 18], [4.2, 13.4], [9.4, 8.8], [9.4, 12]] as Pt[]).map(([x, y]) => [x, y + 2.4] as Pt)], "top")),
  "pet-lover": pic(solid([[[7.6, 14.6], [10, 11.6], [14, 11.6], [16.4, 14.6], [16, 18.2], [12, 17.4], [8, 18.2]]], "white"),
    solid([circ(6.6, 10.2, 1.9, 10), circ(10, 7.0, 1.9, 10), circ(14, 7.0, 1.9, 10), circ(17.4, 10.2, 1.9, 10)], "white")),
  "junk-collector": pic(solid([tr(roundRect(14, 1.6, 2.4, 10, 0.8), 0, 0, 1, 25), circ(8.4, 7.6, 3.0, 14)], "metal"),
    solid([[[5.4, 10.2], [18.6, 10.2], [20.4, 18.4], [17.4, 20.4], [6.6, 20.4], [3.6, 18.4]]], "wood"), inkOf([[[6.4, 12.6], [17.6, 12.6]]], 1.0)),
  "trick-shot": pic(solid([band([[2.8, 5.2], [9.6, 17.0], [14.0, 8.6]], 2.4), [[11.8, 7.4], [16.6, 6.2], [15.2, 11.0]]], "top"), solid([circ(17.2, 15.6, 3.4, 16)], "white"),
    flat([roundRect(6.4, 18.4, 7, 1.8, 0.6)], "metal")),
  // Moves
  haymaker: pic(solid([tr(P.fist, 1.6, 0, 1.0)], "skin"), flat([band(arc(12, 12, 9.0, 120, 200, 8), 2.2)], "top"), knuckles(6.6, 10.6)),
  "energy-drink": pic(solid([roundRect(8, 4.6, 8, 15, 1.6)], "metal"), flat([roundRect(8, 9, 8, 6, 0.4)], "top"), inkOf([[[10.2, 5.8], [13.8, 5.8]]], 0.9)),
  tarp: pic(solid([[[4.2, 6], [19.8, 6], [18.6, 17.4], [15.6, 15.6], [12, 18.6], [8.4, 15.6], [5.4, 17.4]]], "metal"), flat([circ(6.6, 8.2, 1.0, 8), circ(17.4, 8.2, 1.0, 8)], "ink")),
  whistle: pic(solid([[[4.2, 8.6], [13.4, 8.6], [15.4, 10.6], ...arc(14.4, 14.4, 4.6, -40, 200, 10).slice(1), [7.6, 12.2], [4.2, 12.2]]], "metal"),
    flat([circ(14.4, 14.4, 1.5, 10)], "ink"), flat([band(arc(14.4, 14.4, 7.6, -110, -60, 4), 1.2)], "white")),
  firecrackers: pic(solid([tr(roundRect(6.4, 8.6, 4.4, 11.6, 1.0), 0, 0, 1, -14), tr(roundRect(12.8, 8.6, 4.4, 11.6, 1.0), 0, 0, 1, 12)], "top"),
    flat([starPoly(7, 3.4, 1.4).map(([x, y]) => [x + 0.2, y - 6.4] as Pt)], "white")),
  snatch: pic(solid([[[5.6, 19.4], [6.2, 12], [4.4, 7.8], [6.4, 7.0], [8.4, 10.4], [8.4, 5.0], [10.6, 4.6], [11.4, 9.6], [12.4, 4.2], [14.6, 4.6], [14.4, 9.8], [16, 5.6], [18, 6.2], [16.8, 12.6], [16.2, 19.4]]], "skin")),
  "air-horn": pic(solid([roundRect(4.4, 9.4, 6.4, 9.6, 1.2)], "top"), solid([[[10.6, 11.4], [14, 11.4], [19.8, 6.2], [19.8, 19.6], [14, 15.2], [10.6, 15.2]]], "metal"),
    flat([roundRect(5.6, 6.4, 4, 3.2, 0.6)], "white")),
  "body-slam": pic(solid([[[9, 3.8], [15, 3.8], [15, 10.8], [19.2, 10.8], [12, 17.4], [4.8, 10.8], [9, 10.8]]], "white"), flat([[[3.6, 19], [20.4, 19], [20.4, 20.8], [3.6, 20.8]]], "top"),
    inkOf([[[3.8, 16.8], [6.4, 18.2]], [[20.2, 16.8], [17.6, 18.2]]], 1.0)),
  "sand-in-the-eyes": pic(solid([[...quad([3.6, 10.4], [12, 17.8], [20.4, 10.4], 8), ...quad([20.4, 10.4], [12, 14.0], [3.6, 10.4], 8).slice(1, -1)]], "white"),
    flat([circ(7.4, 5.4, 1.3, 8), circ(12, 4.2, 1.3, 8), circ(16.6, 5.4, 1.3, 8)], "metal"), inkOf([[[6.6, 14.2], [5.6, 16.2]], [[12, 15.6], [12, 17.8]], [[17.4, 14.2], [18.4, 16.2]]], 0.8)),
  taunt: pic(solid([[[4.2, 5.4], [19.8, 5.4], [19.8, 15.6], [11.4, 15.6], [6.6, 19.6], [7.6, 15.6], [4.2, 15.6]]], "white"),
    flat([roundRect(11, 7.0, 2.2, 5.0, 0.8), circ(12.1, 13.6, 1.2, 8)], "ink")),
  "second-wind": pic(solid([band([[3, 9.4], [13.6, 9.4], ...arc(13.6, 6.6, 2.8, 90, -150, 6).slice(1)], 2.2), band([[3, 14.2], [17, 14.2], ...arc(17, 17.0, 2.8, -90, 150, 6).slice(1)], 2.2), band([[5, 19.0], [11, 19.0]], 2.0)], "white"),
    solid([[[17.4, 2.6], [19.6, 2.6], [19.6, 5.2], [22.2, 5.2], [22.2, 7.4], [19.6, 7.4], [19.6, 10], [17.4, 10], [17.4, 7.4], [14.8, 7.4], [14.8, 5.2], [17.4, 5.2]]], "top")),
  grapple: pic(solid([band([[12, 3.6], [12, 15.4]], 2.2), band([...arc(12, 13, 6.4, 20, 160, 10)], 2.2), [[17.2, 14.0], [19.4, 10.6], [20.2, 15.4]], [[6.8, 14.0], [4.6, 10.6], [3.8, 15.4]]], "metal"),
    flat([circ(12, 4.4, 1.8, 10)], "white")),
};

function starPoly(points: number, r: number, ri: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? r : ri;
    out.push([12 + Math.cos(a) * rr, 12 + Math.sin(a) * rr]);
  }
  return out;
}
function ringOf(cx: number, cy: number, r0: number, r1: number): Pt[] {
  return [...arc(cx, cy, r1, -89, 269, 22), ...arc(cx, cy, r0, 269, -89, 22)];
}

const KIND: Record<SkillId, "badge" | "sticker"> = Object.fromEntries(([
  "haymaker", "energy-drink", "tarp", "whistle", "firecrackers", "snatch", "air-horn", "body-slam", "sand-in-the-eyes", "taunt", "second-wind", "grapple",
] as const).map((m) => [m, "sticker"])) as Record<SkillId, "badge" | "sticker">;

/** A pictogram grown about the badge centre, so it fills the badge like a stamp. */
function scaleShape(s: IconShape, k: number): IconShape {
  const grow = (d: string): string => dPolys(parsePolys(d).map((p) => p.map(([x, y]) => [12 + (x - 12) * k, 12 + (y - 12) * k] as Pt)));
  return s.shade === undefined ? { ...s, d: grow(s.d) } : { ...s, d: grow(s.d), shade: grow(s.shade) };
}
/** How many leading shapes of a framed icon are the frame (the art sheet's silhouette test
 *  looks at the pictogram alone). */
export const FRAME_PARTS = 2;

function skillIcon(id: SkillId, seed: number): IconArt {
  const tone = RARITY_TONE[RARITY_OF[id]];
  const frame = KIND[id] === "sticker" ? sticker(seed, tone) : roundBadge(seed, tone);
  // a pictogram in the frame's own tone would vanish: swap a clashing slot for cream
  const k = KIND[id] === "sticker" ? 1.2 : 1.24;
  const shapes = PICS[id].shapes.map((s) => {
    const big = scaleShape(s, k);
    return big.slot === tone ? { ...big, slot: (tone === "white" ? "metal" : "white") as Slot } : big;
  });
  return { shapes: [...frame, ...shapes] };
}

export const SKILL_ICONS = Object.fromEntries((Object.keys(PICS) as SkillId[]).map((id, i) => [id, skillIcon(id, 911 + i * 37)])) as Record<SkillId, IconArt>;

// ------------------------------------------------------------------------------- UI icons
const G = (polys: readonly Poly[], extra: IconShape[] = []): IconArt => ({ shapes: [solid(polys, "self"), ...extra] });
const gear = (): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * 360;
    out.push(...arc(12, 12, 9.4, a0 - 11, a0 + 11, 2), ...arc(12, 12, 6.8, a0 + 17, a0 + 34, 2));
  }
  return out;
};
export const CONTENT_UI_ICONS: Record<`ui:${ContentUi}`, IconArt> = {
  "ui:gear": G([gear()], [flat([circ(12, 12, 3.0, 14)], "ink")]),
  "ui:back": G([[[3.6, 12], [11.4, 4.4], [11.4, 9.2], [20.4, 9.2], [20.4, 14.8], [11.4, 14.8], [11.4, 19.6]]]),
  "ui:dice": G([tr(roundRect(4.4, 4.4, 15.2, 15.2, 3), 0, 0, 1, 8)], [flat([circ(8.6, 8.4, 1.5, 10), circ(12, 12, 1.5, 10), circ(15.4, 15.6, 1.5, 10)], "ink")]),
  "ui:plus": G([[[9.6, 3.6], [14.4, 3.6], [14.4, 9.6], [20.4, 9.6], [20.4, 14.4], [14.4, 14.4], [14.4, 20.4], [9.6, 20.4], [9.6, 14.4], [3.6, 14.4], [3.6, 9.6], [9.6, 9.6]]]),
  "ui:locker": G([roundRect(3.4, 2.6, 8.2, 18.8, 1), roundRect(12.4, 2.6, 8.2, 18.8, 1)], [inkOf([[[5.2, 5.4], [9.8, 5.4]], [[5.2, 7.6], [9.8, 7.6]], [[14.2, 5.4], [18.8, 5.4]], [[14.2, 7.6], [18.8, 7.6]]], 1.0), flat([roundRect(9, 12, 1.4, 3.6, 0.5), roundRect(13.6, 12, 1.4, 3.6, 0.5)], "ink")]),
  "ui:kit": G([[[3.6, 9.4], [20.4, 9.4], [20.4, 18.6], [3.6, 18.6]], band([[8.6, 9.6], [8.6, 6.0], [15.4, 6.0], [15.4, 9.6]], 2.0)], [inkOf([[[3.8, 13.2], [20.2, 13.2]]], 1.0)]),
  "ui:bouts": G([[[1.8, 9.2], [3.6, 7.2], [10.6, 7.2], [11.4, 9], [11.4, 15.6], [10.4, 17.2], [3.4, 17.2], [1.8, 15.2]], [[22.2, 9.2], [20.4, 7.2], [13.4, 7.2], [12.6, 9], [12.6, 15.6], [13.6, 17.2], [20.6, 17.2], [22.2, 15.2]]],
    [inkOf([[[11, 9.6], [8.2, 9.6]], [[11, 12.4], [8.2, 12.4]], [[13, 9.6], [15.8, 9.6]], [[13, 12.4], [15.8, 12.4]]], 0.9), flat([[[10.6, 2.4], [13.4, 2.4], [12, 5.6]], [[10.6, 21.6], [13.4, 21.6], [12, 18.4]]], "ink")]),
  "ui:close": G([band([[5, 5], [19, 19]], 4.2), band([[19, 5], [5, 19]], 4.2)]),
};

// ----------------------------------------- redraws of the gate's stat and control icons
/**
 * The 4 stat icons and the 8 playback controls, redrawn to the same standard. The contract's
 * `ContentPack.icons` has no `stat:*` or gate `ui:*` keys, so these are NOT in the content pack:
 * they are offered to the rig lane to replace `ICON_STATS` / `ICON_UI` in `gate/icons.ts`.
 * Each stat keeps its own shape and colour ("self": health green, strength red, agility purple,
 * speed blue), so colour is never the only signal.
 */
const feather: Pt[] = [[4.4, 20], [6.4, 14.4], [10.6, 8.2], [16, 4], [20.2, 3.6], [19.6, 8], [16.2, 13.4], [10.6, 17.4]];
export const STAT_ICONS_REDRAW: Record<`stat:${StatKey}`, IconArt> = {
  "stat:health": { shapes: [solid([P.heart.map(([x, y]) => [x, y - 0.4] as Pt)], "self"), inkOf([[[8.4, 9.2], [7.8, 11.8]]], 1.2, true)] },
  "stat:strength": { shapes: [solid([[[2.6, 14.2], [5.6, 11.2], [9.4, 9.0], [12.6, 9.8], [13.8, 11.8], [13.4, 8.4], [12.2, 5.6], [12.4, 3.0], [15.6, 2.0], [19.2, 3.0], [19.8, 6.4], [17.8, 8.2], [19.4, 12.8], [20.6, 16.6], [19.0, 19.8], [2.6, 19.8]]], "self"),
    inkOf([[[6.4, 13.6], [9.6, 12.4], [12.4, 13.4]], [[14.6, 3.6], [15, 6.2]], [[17, 3.4], [17.2, 6.0]]], 0.9)] },
  "stat:agility": { shapes: [solid([feather], "self"), inkOf([[[5.2, 19.4], [11, 12], [18.4, 5]]], 1.0)] },
  "stat:speed": { shapes: [solid([[[2.6, 4.6], [8.6, 4.6], [14.8, 12], [8.6, 19.4], [2.6, 19.4], [8.8, 12]], [[10.6, 4.6], [16.6, 4.6], [22.2, 12], [16.6, 19.4], [10.6, 19.4], [16.4, 12]]], "self")] },
};
const tri = (x0: number, x1: number, y0: number, y1: number): Pt[] => [[x0, y0], [x1, (y0 + y1) / 2], [x0, y1]];
const speaker: Pt[] = [[2.8, 8.6], [7.2, 8.6], [12.6, 3.8], [12.6, 20.2], [7.2, 15.4], [2.8, 15.4]];
const one: Pt[] = [[5.4, 7.2], [9.6, 4.2], [12.2, 4.2], [12.2, 19.8], [8.6, 19.8], [8.6, 9.2], [5.4, 10.4]];
const two: Pt[] = [[3.6, 8.2], [5.8, 4.6], [11.8, 4.2], [14, 7.4], [13, 11.2], [8.8, 16.4], [14.2, 16.4], [14.2, 19.8], [3.8, 19.8], [3.8, 17.2], [9.8, 10.4], [10, 8.2], [7.6, 7.8], [7, 9.2]];
const ex: Pt[][] = [band([[15.2, 12.4], [21, 19.6]], 2.6), band([[21, 12.4], [15.2, 19.6]], 2.6)];
export const GATE_UI_ICONS_REDRAW: Record<`ui:${GateUi}`, IconArt> = {
  "ui:pause": G([roundRect(5, 4, 5.2, 16, 1.2), roundRect(13.8, 4, 5.2, 16, 1.2)]),
  "ui:play": G([tri(6, 20.4, 3.6, 20.4)]),
  "ui:speed1": G([one, ...ex]),
  "ui:speed2": G([two, ...ex]),
  "ui:skip": G([tri(2.6, 11, 4.4, 19.6), tri(10, 18.4, 4.4, 19.6), roundRect(18.4, 4.4, 3.2, 15.2, 0.8)]),
  "ui:sound": G([speaker, band(arc(12.6, 12, 5, -50, 50, 8), 2.0), band(arc(12.6, 12, 8.8, -50, 50, 10), 2.0)]),
  "ui:mute": G([speaker, band([[14.8, 8.2], [21.2, 15.8]], 2.6), band([[21.2, 8.2], [14.8, 15.8]], 2.6)]),
  "ui:replay": G([band(arc(12, 12.8, 7, -150, 140, 16), 3.0), [[1.8, 5.6], [10.2, 4.8], [5.6, 11.6]]]),
};

// ------------------------------------------------------------------------- shield icons
/**
 * Shield icons in the heater-shield frame. The contract has no icon key for a shield
 * (`ContentPack.icons` is skills and content UI; `rig.icon(shieldId)` gives the plain ring), so
 * these are offered for a contract change; the art sheet shows them.
 */
const SHIELD_PICS: Record<ShieldId, IconShape[]> = {
  "car-door": [solid([[[5.6, 6.4], [15.4, 6.4], [18.6, 11.4], [18.6, 18.6], [5.6, 18.6]]], "wood"), flat([[[7, 7.6], [14.8, 7.6], [16.8, 11.2], [7, 11.2]]], "ink"), flat([roundRect(13, 13.4, 3.6, 1.4, 0.6)], "metal")],
  "bin-lid": [solid([circ(12, 12.4, 6.8, 22)], "metal"), flat([roundRect(9.4, 11.2, 5.2, 2.4, 1)], "white")],
  "wooden-pallet": [solid([roundRect(5.4, 5.6, 13.2, 3.2, 0.4), roundRect(5.4, 10.4, 13.2, 3.2, 0.4), roundRect(5.4, 15.2, 13.2, 3.2, 0.4)], "wood"), flat([roundRect(7, 5.2, 1.6, 13.6, 0.3), roundRect(15.4, 5.2, 1.6, 13.6, 0.3)], "bottom")],
  "ironing-board": [solid([[[9.4, 20], [9.4, 7.6], [12, 3.6], [14.6, 7.6], [14.6, 20]]], "white"), flat([circ(12, 10, 0.9, 8), circ(12, 14.4, 0.9, 8)], "wood")],
  skateboard: [solid([tr(roundRect(9.2, 3.6, 5.6, 17, 2.8), 0, 0, 1, 20)], "wood"), flat([tr(roundRect(7.6, 6.4, 8.8, 1.8, 0.6), 0, 0, 1, 20), tr(roundRect(7.6, 15.8, 8.8, 1.8, 0.6), 0, 0, 1, 20)], "white")],
  "riot-shield": [solid([roundRect(6.6, 4.2, 10.8, 15.4, 1.6)], "white"), flat([roundRect(7.8, 6, 8.4, 3.2, 0.6)], "metal")],
};
export const SHIELD_ICONS = Object.fromEntries((Object.keys(SHIELD_PICS) as ShieldId[]).map((id) =>
  [id, { shapes: [...shieldFrame(RARITY_TONE[RARITY_OF[id]]), ...SHIELD_PICS[id].map((s) => (s.slot === RARITY_TONE[RARITY_OF[id]] ? { ...s, slot: "white" as Slot } : s))] }])) as unknown as Record<ShieldId, IconArt>;

export type { CompanionId };
export { dPoly };

// ------------------------------------------------------------------------- weapon icons
/**
 * Weapon icons: no frame, the object itself turned 35 degrees up, filling the box. The engine's
 * own weapon icon scales the whole drawing into the box, so a long pole becomes a hairline and a
 * weapon that bends (drawn as links) comes out empty; these are made for 28 px instead:
 *  - a long weapon is cropped to its business end (the last 30 units: the head and some shaft);
 *  - a bending weapon is laid out straight from its links;
 *  - details smaller than about a unit at icon size are dropped, the big fills get the teal shadow.
 * The contract has no icon key for a weapon (`rig.icon(weaponId)` draws the engine's), so these
 * are offered for the lead to wire (see the WP6 handoff).
 */
const clipLeft = (p: Poly, x0: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const ia = a[0] >= x0;
    const ib = b[0] >= x0;
    if (ia) out.push([a[0], a[1]]);
    if (ia !== ib) { const t = (x0 - a[0]) / (b[0] - a[0]); out.push([x0, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
};
function perimeterOf(p: Poly): number { let l = 0; for (let i = 0; i < p.length; i++) { const q = p[i]!; const r = p[(i + 1) % p.length]!; l += Math.hypot(r[0] - q[0], r[1] - q[1]); } return l || 1; }
function polyAreaOf(p: Poly): number { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i]!; const r = p[(i + 1) % p.length]!; a += q[0] * r[1] - r[0] * q[1]; } return Math.abs(a / 2); }
export function weaponIcon(art: WeaponArt, crop = 30, angle = -35): IconArt {
  // the drawing as plain (polys, slot) in item units, links laid straight
  let parts: { polys: Pt[][]; slot: ColourSlot }[] = [];
  if (art.segments !== undefined && art.segments.length > 0) {
    let x = 0;
    for (const sg of art.segments) { for (const s of sg.shapes) parts.push({ polys: parsePolys(s.d).map((p) => p.map(([px, py]) => [px + x, py] as Pt)), slot: s.slot }); x += sg.length; }
  } else parts = [...art.shapes].sort((a, b) => a.z - b.z).map((s) => ({ polys: parsePolys(s.d), slot: s.slot }));
  const xs = parts.flatMap((p) => p.polys.flat().map((q) => q[0]));
  const x1 = Math.max(...xs);
  const x0 = Math.min(...xs);
  const cut = x1 - x0 > crop * 1.15 ? x1 - crop : -Infinity;
  parts = parts.map((p) => ({ ...p, polys: p.polys.map((q) => (cut === -Infinity ? q.map((v) => [v[0], v[1]] as Pt) : clipLeft(q, cut))).filter((q) => q.length >= 3) })).filter((p) => p.polys.length > 0);
  // thicken across the object so its thinnest main part is at least 2.8 icon units thick (the
  // icon outline is 1.6 wide and would swallow a thinner shaft)
  const fills = parts.filter((p) => p.slot !== "ink").flatMap((p) => p.polys).filter((q) => polyAreaOf(q) > 1.5);
  const thin = Math.max(0.3, Math.min(...fills.map((q) => (2 * polyAreaOf(q)) / perimeterOf(q))));
  const fit = (ky: number): { turned: typeof parts; k: number; box: number[] } => {
    const turned = parts.map((p) => ({ ...p, polys: p.polys.map((q) => q.map((v) => rotPt([v[0], v[1] * ky], angle))) }));
    const all = turned.flatMap((p) => p.polys.flat());
    const box = [Math.min(...all.map((q) => q[0])), Math.max(...all.map((q) => q[0])), Math.min(...all.map((q) => q[1])), Math.max(...all.map((q) => q[1]))];
    return { turned, k: 20 / Math.max(box[1]! - box[0]!, box[3]! - box[2]!), box };
  };
  let f = fit(1);
  const long = (Math.max(...parts.flatMap((p) => p.polys.flat().map((q) => q[0]))) - Math.max(cut, x0)) / Math.max(1, Math.max(...parts.flatMap((p) => p.polys.flat().map((q) => Math.abs(q[1])))) * 2) > 2.4;
  if (long) for (let n = 0; n < 2; n++) f = fit(Math.min(2.6, Math.max(1, 3.4 / (thin * f.k))));
  const { turned, k } = f;
  const [bx0, bx1, by0, by1] = f.box as [number, number, number, number];
  const place = (q: Pt): Pt => [12 + (q[0] - (bx0 + bx1) / 2) * k, 12 + (q[1] - (by0 + by1) / 2) * k];
  const shapes: IconShape[] = [];
  for (const p of turned) {
    const polys = p.polys.map((q) => q.map(place));
    const area = polys.reduce((s, q) => s + polyAreaOf(q), 0);
    if (p.slot === "ink" ? area < 0.9 : area < 0.4) continue;
    // black rubber reads as a hole on a dark card: icons lift it to the dull brown
    shapes.push(p.slot === "ink" ? flat(polys, "ink") : solid(polys, p.slot === "hair" ? "bottom" : p.slot, area > 6, 0.3));
  }
  return { shapes };
}

import { FISTS } from "../gate/weapons/fists";
import { PIPE } from "../gate/weapons/pipe";
import { POCKET_KNIFE } from "../gate/weapons/pocket-knife";
import { CONTENT_WEAPONS } from "./weapons";
import type { HeldId } from "@rankzero/core";
export const WEAPON_ICONS = Object.fromEntries(
  Object.entries({ fists: FISTS, pipe: PIPE, "pocket-knife": POCKET_KNIFE, ...CONTENT_WEAPONS } as Record<HeldId, WeaponArt>).map(([id, art]) => [id, weaponIcon(art, 30, id === "fists" ? 0 : -35)]),
) as unknown as Record<HeldId, IconArt>;
