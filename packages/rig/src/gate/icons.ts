/**
 * Gate icons in a 24-unit box: the six stats (each in its own colour, slot "self", with its own
 * shape so colour is never the only signal) and the eight playback controls. Flat shapes with
 * the ink outline the SVG side adds; checked by eye at 28 and 44 px on the A1 sheet.
 */
import type { GateUi, IconArt } from "../contracts";
import type { StatKey } from "@rankzero/core";
import type { Pt } from "./vocab";
import { dPoly, dPolys, ellipsePoly, inkLine, quad, roundRect } from "./vocab";

const heart: Pt[] = [...quad([12, 20.5], [3, 14], [4.2, 8]), ...quad([4.2, 8], [6, 3.6], [12, 7.6]).slice(1),
  ...quad([12, 7.6], [18, 3.6], [19.8, 8]).slice(1), ...quad([19.8, 8], [21, 14], [12, 20.5]).slice(1, -1)];
const fist: Pt[] = [[5, 9], [8, 6.2], [17.4, 6], [19.6, 8.4], [19.6, 15.6], [17, 19], [9, 19], [5.6, 16.4]];
const feather: Pt[] = [[4.5, 20.5], [6, 15], [10, 8.6], [15.6, 4.2], [20, 3.6], [19.4, 8], [16, 13.6], [10.6, 17.6]];
const rock: Pt[] = [[3.8, 10.6], [7.4, 5.4], [13, 4], [18.6, 5.8], [20.8, 11.2], [19.6, 17], [14.2, 20], [7.4, 19.6], [3.4, 15.6]];
const chevrons = (x: number): Pt[] => [[x, 5], [x + 5, 5], [x + 11, 12], [x + 5, 19], [x, 19], [x + 6, 12]];

const ICON_STATS: Record<`stat:${StatKey}`, IconArt> = {
  "stat:health": { shapes: [{ d: dPoly(heart), slot: "self" }, { d: dPoly(inkLine([[8.2, 9.6], [7.2, 12.4]], 1.1)), slot: "white" }] },
  "stat:strength": { shapes: [{ d: dPoly(fist), slot: "self" }, { d: dPolys([inkLine([[10.2, 6.4], [10.2, 11]], 0.9, false), inkLine([[13.4, 6.2], [13.4, 11]], 0.9, false), inkLine([[16.4, 6.2], [16.4, 11]], 0.9, false)]), slot: "ink" },
    { d: dPoly([[5.4, 12], [12.4, 11.4], [13.4, 13.4], [6, 15]]), slot: "self" }] },
  "stat:agility": { shapes: [{ d: dPoly(feather), slot: "self" }, { d: dPoly(inkLine([[5.4, 19.6], [11, 12], [18.6, 5]], 0.9)), slot: "ink" }] },
  "stat:speed": { shapes: [{ d: dPolys([chevrons(2), chevrons(10)]), slot: "self" }] },
  // content v3: Toughness a cracked block of stone, Precision a target with its crosshair
  "stat:toughness": { shapes: [{ d: dPoly(rock), slot: "self" }, { d: dPolys([inkLine([[9.2, 5.2], [11.2, 9.8], [9.6, 13.6]], 0.9, false),
    inkLine([[15.2, 12.4], [17.6, 15.8]], 0.9, false)]), slot: "ink" }] },
  "stat:precision": { shapes: [{ d: dPoly(ellipsePoly(12, 12, 8.2, 8.2, 28)), slot: "self" }, { d: dPoly(ellipsePoly(12, 12, 4.9, 4.9, 24)), slot: "white" },
    { d: dPoly(ellipsePoly(12, 12, 2.3, 2.3, 16)), slot: "self" },
    { d: dPolys([inkLine([[12, 1.4], [12, 6.4]], 1.1, false), inkLine([[12, 17.6], [12, 22.6]], 1.1, false), inkLine([[1.4, 12], [6.4, 12]], 1.1, false),
      inkLine([[17.6, 12], [22.6, 12]], 1.1, false)]), slot: "ink" }] },
};

const tri = (x0: number, x1: number, y0: number, y1: number): Pt[] => [[x0, y0], [x1, (y0 + y1) / 2], [x0, y1]];
const speaker: Pt[] = [[3, 9], [7, 9], [12, 4.5], [12, 19.5], [7, 15], [3, 15]];
/** "1" and "2" as block glyphs, then a small "x". */
const one: Pt[] = [[6.6, 6.4], [10.2, 4.4], [12, 4.4], [12, 19.6], [9.2, 19.6], [9.2, 8.6], [6.6, 9.6]];
const two: Pt[] = [[4.6, 8], [6.4, 4.8], [11.6, 4.4], [13.6, 7.4], [12.6, 11], [8.4, 16.6], [13.8, 16.6], [13.8, 19.6], [4.8, 19.6], [4.8, 17.4], [10, 10.6], [10.2, 8.2], [7.6, 7.8], [7, 9]];
const ex: Pt[][] = [inkLine([[15, 12.6], [20.6, 19.4]], 2.2, false), inkLine([[20.6, 12.6], [15, 19.4]], 2.2, false)];
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, w: number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 14; i++) { const a = a0 + ((a1 - a0) * i) / 14; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return inkLine(pts, w, false);
};

const ICON_UI: Record<`ui:${GateUi}`, IconArt> = {
  "ui:pause": { shapes: [{ d: dPolys([roundRect(5.5, 4.5, 4.6, 15, 1), roundRect(13.9, 4.5, 4.6, 15, 1)]), slot: "self" }] },
  "ui:play": { shapes: [{ d: dPoly(tri(6.5, 19.5, 4, 20)), slot: "self" }] },
  "ui:speed1": { shapes: [{ d: dPolys([one.map(([x, y]) => [x - 1, y] as Pt), ...ex]), slot: "self" }] },
  "ui:speed2": { shapes: [{ d: dPolys([two.map(([x, y]) => [x - 1.4, y] as Pt), ...ex]), slot: "self" }] },
  "ui:skip": { shapes: [{ d: dPolys([tri(3.5, 11.5, 5, 19), tri(10.5, 18.5, 5, 19), roundRect(18.5, 5, 2.8, 14, 0.8)]), slot: "self" }] },
  "ui:sound": { shapes: [{ d: dPolys([speaker, arc(12, 12, 4.6, -0.9, 0.9, 1.7), arc(12, 12, 8.4, -0.9, 0.9, 1.7)]), slot: "self" }] },
  "ui:mute": { shapes: [{ d: dPolys([speaker, inkLine([[14.6, 8.6], [21, 15.4]], 2.2, false), inkLine([[21, 8.6], [14.6, 15.4]], 2.2, false)]), slot: "self" }] },
  "ui:replay": { shapes: [{ d: dPolys([arc(12, 12.6, 7, -2.6, 2.4, 2.6), [[2.2, 6.4], [9.4, 5.6], [5.4, 11.6]]]), slot: "self" }] },
};

export const GATE_ICONS = { ...ICON_STATS, ...ICON_UI };
export { ellipsePoly };
