/**
 * One-hand and two-hand swing weapons: blades, clubs, bars and kitchen things.
 * Item units (a scrapper is 84 tall, so 1 unit is about 2.1 cm of a real man); every object is
 * drawn as the real thing, 20 to 60% larger than life so it reads on a phone. The grip is the
 * origin, +x runs along the object, y is down. In a downward or side swing the item turns
 * clockwise, so the leading face of a chopping or knocking head is its +y side.
 * `tip` is the part brief 11 says hits; `grip2` is the back hand of a two-hand weapon.
 */
import type { WeaponArt } from "../../contracts";
import type { Pt } from "../kit";
import { arcPts, band, bar, barAB, blob, ellipsePoly, fillOf, line, lines, quad, ringPoly, rod, roundRect, scuffs, wraps } from "../kit";
import { weapon } from "./make";

/** Machete: a long, wide, slightly curved blade, riveted wooden scales; diagonal slash, the edge hits. */
export const MACHETE: WeaponArt = weapon([
  fillOf(bar(-5.4, 4.6, [[0, 1.55], [0.12, 1.2], [0.6, 1.15], [1, 1.3]], 0.6), "wood", 0),
  fillOf([[4, -1.35], [20, -1.45], [30, -1.25], [34.6, -0.7], [35.4, 0.2], [33.2, 1.6], [27, 2.75], [18, 2.7], [8, 2.3], [4, 2.05]], "metal", 1),
  fillOf([[6, 1.35], [18, 1.75], [27, 1.85], [33, 1.0], [33.4, 1.5], [27, 2.55], [18, 2.5], [6, 1.95]], "white", 2),
  line([[5.5, -0.2], [20, -0.35], [31, -0.3]], 0.22, 3),
  blob(-2.6, 0, 0.42, 0.42, 3, 8), blob(1.6, 0, 0.42, 0.42, 3, 8),
  lines([[[13, 2.3], [13.6, 1.7]], [[22.5, 2.4], [23, 1.9]]], 0.25, 3),
  scuffs(101, 6, 9, 30, -1, 1, 3),
  line([[4.2, -1.3], [4.2, 2.0]], 0.3, 3, false),
], [26, 2.6]);

/** Hand Axe: a short haft with a bearded head; short overhead chop, the head's edge (+y) hits. */
export const HAND_AXE: WeaponArt = weapon([
  fillOf(bar(-5.5, 22.5, [[0, 1.45], [0.1, 1.1], [0.7, 1.05], [1, 1.3]], 0.6), "wood", 0),
  fillOf([[17, -2.9], [23.3, -2.9], [23.6, 1.4], [26.2, 5.8], [27.6, 9.8], [24, 10.6], [19.6, 10.2], [18.5, 7.4], [18.9, 3.6], [17, 1.4]], "metal", 1),
  fillOf([[19.8, 9.0], [24, 9.5], [27.2, 8.7], [27.6, 9.8], [24, 10.6], [19.6, 10.2]], "white", 2),
  line([[18, -2.0], [22.6, -2.0]], 0.3, 3, false),
  line([[20.2, -1.6], [20.2, 1.0]], 0.35, 3, false),
  lines([[[2, -0.4], [9, -0.5]], [[11, 0.5], [16, 0.4]]], 0.2, 3),
  scuffs(102, 4, 19.5, 26, 3, 8, 3),
], [23.6, 10.3]);

/** Bat: taped handle, knob, a long barrel; both hands at the knob, the barrel hits. */
export const BAT: WeaponArt = weapon([
  fillOf(bar(-8.2, 35, [[0, 0.9], [0.3, 1.0], [0.55, 1.75], [0.8, 2.6], [1, 2.75]], 0.9), "wood", 0),
  fillOf(ellipsePoly(-8.7, 0, 0.95, 1.8, 14), "wood", 1),
  fillOf(rod(-7.6, 5.2, 1.08, 0.2), "accent", 2),
  wraps(-7.6, 5.2, 1.08, 1.5, 3),
  lines([[[9, -0.7], [20, -1.3], [31, -1.9]], [[14, 0.9], [26, 1.6]], [[21, -0.1], [30, 0.1]]], 0.2, 3),
  scuffs(103, 7, 22, 33, -2, 2, 3, 0.26),
  line([[-8.7, -1.2], [-8.7, 1.2]], 0.25, 3, false),
], [30, 0], { grip2: [-5.2, 0] });

/** Crowbar: a hex bar, chisel at one end, a claw hook at the other, red paint worn off; side
 *  swing hook first, the hook's outer curve hits. */
export const CROWBAR: WeaponArt = weapon([
  fillOf([[-8.2, -0.5], [-7.2, -1.0], [27, -1.0], [27, 1.0], [-7.2, 1.0], [-8.2, 0.3]], "metal", 0),
  fillOf(rod(6, 27.5, 1.05, 0), "wood", 1),
  fillOf(band([[27, 0], [30.6, 0.2], [32.8, 2.4], [32.4, 5.2], [29.6, 7.0], [27.4, 6.6]], 2.0), "wood", 1.1),
  line([[28.4, 6.6], [27.2, 5.6]], 0.35, 3, false),
  blob(14, -0.2, 0.7, 0.45, 3, 8), blob(21.5, 0.4, 0.9, 0.5, 3, 8),
  fillOf(ellipsePoly(11.5, 0.1, 1.1, 0.6, 8), "metal", 2), fillOf(ellipsePoly(24, -0.3, 0.9, 0.55, 8), "metal", 2),
  line([[-6, 0.4], [5, 0.4]], 0.2, 3),
], [32.6, 3.4]);

/** Monkey Wrench: a steel wrench with wooden grip scales; side swing or a knock, the jaw end hits. */
export const MONKEY_WRENCH: WeaponArt = weapon([
  fillOf(bar(-6.4, 17.5, [[0, 1.35], [1, 1.2]], 0.5), "metal", 0),
  fillOf(rod(-5.6, 9.4, 1.6, 0.4), "wood", 1),
  fillOf([[16.6, -3.1], [23.2, -3.1], [27.9, -3.1], [28.2, -1.4], [23.8, -1.0], [23.4, 1.0], [27.3, 1.1], [27.6, 3.3], [22.8, 3.5], [19, 3.3], [16.6, 1.5]], "metal", 2),
  lines([[[17.6, 1.6], [17.6, 3.0]], [[18.4, 1.6], [18.4, 3.0]], [[19.2, 1.6], [19.2, 3.0]], [[20, 1.6], [20, 3.0]]], 0.24, 3, false),
  line([[16.8, -2.3], [27.5, -2.3]], 0.22, 3),
  blob(-3.6, 0, 0.42, 0.42, 3, 8), blob(6.6, 0, 0.42, 0.42, 3, 8),
  line([[-5, -0.3], [8.8, -0.4]], 0.18, 3),
], [27.6, -2.0]);

/** Frying Pan: a heavy pan seen from below, black grip; forehand swing, the flat base hits. */
export const FRYING_PAN: WeaponArt = weapon([
  fillOf(bar(-6.5, 10, [[0, 1.2], [1, 0.95]], 0.8), "hair", 0),
  fillOf(rod(9, 12.5, 1.05, 0.2), "metal", 1),
  fillOf(ellipsePoly(20.5, 0, 9.2, 9.2, 30), "metal", 2),
  fillOf(ringPoly(20.5, 0, 6.6, 7.2, 30), "ink", 3),
  fillOf(ringPoly(20.5, 0, 3.4, 3.8, 24), "ink", 3),
  blob(-5.3, 0, 0.55, 0.55, 3, 8),
  scuffs(104, 7, 14, 27, -6, 6, 3, 0.24),
  line([[11.4, -0.9], [11.4, 0.9]], 0.25, 3, false),
], [26, 0]);

/** Tyre Iron: a four-way cross wrench, gripped at the long arm; a downward knock, the socket hits. */
export const TYRE_IRON: WeaponArt = weapon([
  fillOf(rod(-5, 26, 0.85, 0.3), "metal", 0),
  fillOf(barAB([20.5, -9.6], [20.5, 9.6], 0.85, 0.85, 0.3), "metal", 0.5),
  fillOf(rod(25.4, 29.2, 1.6, 0.15), "metal", 1),
  fillOf(rod(-7.8, -4.2, 1.45, 0.15), "metal", 1),
  fillOf(barAB([20.5, -12.2], [20.5, -8.8], 1.4, 1.4, 0.15), "metal", 1),
  fillOf(barAB([20.5, 8.8], [20.5, 12.2], 1.5, 1.5, 0.15), "metal", 1),
  fillOf(ellipsePoly(20.5, 0, 1.6, 1.6, 10), "metal", 1.5),
  lines([[[26.5, -1.4], [26.5, 1.4]], [[-6.6, -1.2], [-6.6, 1.2]]], 0.25, 3, false),
  scuffs(105, 5, 2, 18, -0.6, 0.6, 3, 0.2),
], [29.2, 0]);

/** Golf Club: a rubber grip, a thin steel shaft and an iron head below the line; full golf
 *  swing low to high, the club head hits. */
export const GOLF_CLUB: WeaponArt = weapon([
  fillOf(bar(-6.6, 5.5, [[0, 1.05], [1, 0.75]], 0.6), "hair", 0),
  fillOf(rod(5, 40.5, 0.42, 0.2), "metal", 1),
  fillOf([[39.0, -0.7], [41.6, -0.9], [43.8, 3.0], [44.4, 5.6], [43, 6.4], [38.4, 6.2], [38.2, 4.8], [39.8, 2.0]], "metal", 2),
  lines([[[39.6, 3.6], [43.2, 3.6]], [[39.2, 4.6], [43.6, 4.6]], [[39, 5.5], [43.8, 5.5]]], 0.18, 3, false),
  lines([[[-5.6, -0.8], [-5.6, 0.8]], [[-3.6, -0.8], [-3.6, 0.8]], [[-1.6, -0.8], [-1.6, 0.8]], [[0.4, -0.8], [0.4, 0.8]], [[2.4, -0.7], [2.4, 0.7]]], 0.2, 3, false),
], [42.2, 5.2], { grip2: [-4.6, 0] });

/** Hockey Stick: a wooden shaft with tape at the top and on a hooked blade; low sweeping slap
 *  shot, both hands apart, the blade hits. */
export const HOCKEY_STICK: WeaponArt = weapon([
  fillOf(bar(-16.2, 34, [[0, 1.1], [1, 1.05]], 0.4), "wood", 0),
  fillOf(band(quad([32.6, -0.4], [34.2, 5.4], [43.4, 6.4], 8), 2.8), "wood", 1),
  fillOf(rod(-16.2, -12.4, 1.22, 0.4), "accent", 2),
  wraps(-16.2, -12.4, 1.22, 1.2, 3),
  fillOf(band(quad([34.2, 3.2], [35.6, 6.0], [42.6, 6.4], 6), 2.2), "accent", 2),
  lines([[[-8, -0.4], [30, -0.4]], [[-4, 0.5], [12, 0.5]]], 0.2, 3),
  scuffs(106, 4, 36, 42, 5.2, 7, 3),
], [41.2, 6.2], { grip2: [-10, 0] });

/** Cricket Bat: a rubber-gripped handle and a wide pale willow blade seen face on; a driving
 *  swing from the shoulder, the flat face hits. */
export const CRICKET_BAT: WeaponArt = weapon([
  fillOf(bar(-8.4, 6.5, [[0, 1.0], [1, 1.0]], 0.7), "accent", 0),
  wraps(-8, 5.5, 1.0, 1.0, 1, 0.2),
  fillOf([[5, -1.1], [6.6, -2.5], [32, -2.7], [33.6, -1.9], [33.6, 1.9], [32, 2.7], [6.6, 2.5], [5, 1.1]], "white", 2),
  fillOf(roundRect(10, -1.6, 4.2, 3.2, 0.4), "wood", 3),
  lines([[[7.5, -1.8], [31, -1.9]], [[8, 1.6], [31.5, 1.7]], [[15, -0.5], [31, -0.6]], [[16, 0.6], [30, 0.7]]], 0.15, 4),
  scuffs(107, 6, 20, 33, -2, 2, 4, 0.24),
  line([[5.6, -1.0], [5.6, 1.0]], 0.25, 4, false),
], [27, 0], { grip2: [-5.4, 0] });

/** Wok: a carbon-steel wok on a long wooden handle, seen from the side, its sooty round base
 *  below; swung flat from the side, the round base hits. */
const WOK_BOWL: Pt[] = [...arcPts(26.5, -1.2, 12.5, 8.6, 0, 180, 18)];
export const WOK: WeaponArt = weapon([
  fillOf(bar(-7.5, 12.4, [[0, 1.15], [1, 0.95]], 0.8), "wood", 0),
  fillOf(rod(11.6, 15.2, 0.9, 0.2), "metal", 1),
  fillOf(WOK_BOWL, "metal", 2),
  fillOf(ellipsePoly(26.5, 4.2, 6.6, 3.0, 18), "hair", 3),
  fillOf(ellipsePoly(26.5, -1.2, 12.5, 1.5, 24), "ink", 3.5),
  fillOf(band(arcPts(39.8, -1.6, 2.2, 2.0, 200, 340, 8), 0.8), "metal", 1.5),
  blob(-6.4, 0, 0.5, 0.5, 4, 8),
  scuffs(108, 6, 17, 36, 0, 5, 4),
], [26.5, 7.3]);

/** Umbrella: a closed black umbrella, a crook handle, a steel ferrule; a fencing lunge, the
 *  ferrule tip hits. */
export const UMBRELLA: WeaponArt = weapon([
  fillOf(band([[1.5, 0], [-3.5, 0], [-6.2, 1.2], [-6.8, 3.6], [-5.2, 5.2], [-3, 5.0]], 1.8), "wood", 0),
  fillOf(rod(-1, 7, 0.45, 0.2), "metal", 0.5),
  fillOf([[5, -0.8], [8, -2.2], [14, -2.7], [22, -1.6], [27.4, -0.5], [27.4, 0.5], [22, 1.6], [14, 2.7], [8, 2.2], [5, 0.8]], "hair", 1),
  lines([[[8, -1.4], [22, -0.8]], [[9, 1.0], [24, 0.6]], [[11, -0.2], [26, 0]]], 0.22, 2),
  fillOf(roundRect(12.8, -2.9, 2.2, 5.8, 0.6), "accent", 2.5),
  fillOf(bar(27, 31.4, [[0, 0.42], [1, 0.22]], 0.6), "metal", 3),
], [31.4, 0]);

/** Plunger: a wooden stick and a black rubber cup; a straight fencing jab cup first, the cup hits. */
export const PLUNGER: WeaponArt = weapon([
  fillOf(rod(-8.5, 25, 0.9, 0.6), "wood", 0),
  fillOf([[23.6, -1.1], [26, -3.7], [30, -5.5], [33.2, -5.7], [33.8, -4], [33.8, 4], [33.2, 5.7], [30, 5.5], [26, 3.7], [23.6, 1.1]], "hair", 1),
  lines([[[26.4, -3.2], [26.4, 3.2]], [[30.4, -4.8], [30.4, 4.8]]], 0.22, 2, false),
  line([[33.2, -5.2], [33.2, 5.2]], 0.3, 2, false),
  lines([[[-6, -0.3], [8, -0.4]], [[10, 0.3], [21, 0.3]]], 0.18, 2),
  blob(-7.6, 0, 0.4, 0.4, 2, 8),
], [33.8, 0]);

/** Rebar: a rusty ribbed steel bar with a slight bend; heavy two-hand side swing, the far third hits. */
const REBAR_LINE: Pt[] = [[-14.5, 0], [0, 0.15], [12, 0.4], [26, 0.2], [40.5, -0.9]];
export const REBAR: WeaponArt = weapon([
  fillOf(band(REBAR_LINE, 1.6), "wood", 0),
  lines(Array.from({ length: 30 }, (_, i) => {
    const x = -13.4 + i * 1.82;
    const y = x < 26 ? 0.15 + 0.25 * Math.sin((x + 14) / 26 * Math.PI) : 0.2 - (x - 26) * 0.075;
    return [[x - 0.35, y + 0.75], [x + 0.35, y - 0.75]] as Pt[];
  }), 0.22, 1, false),
  scuffs(109, 8, -12, 38, -0.6, 0.6, 2, 0.2),
], [33, -0.3], { grip2: [-9, 0.05] });
