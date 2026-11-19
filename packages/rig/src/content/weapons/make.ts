/** The one way a content weapon is put together, so every weapon states grip, tip and grip2 alike. */
import type { WeaponArt, WeaponSegment } from "../../contracts";
import { GRIP_ROT } from "../../gate/skeleton";
import { bbox, parsePolys } from "../../gate/vocab";
import type { ItemShape, Pt } from "../kit";

export interface WeaponOpts { rot?: number; grip2?: Pt; offhand?: true }

/** A rigid weapon: shapes in item units, the grip at the origin, `tip` the striking end. */
export function weapon(shapes: readonly ItemShape[], tip: Pt, o: WeaponOpts = {}): WeaponArt {
  const [x0, , x1] = bbox(shapes.flatMap((s) => parsePolys(s.d)));
  const art: WeaponArt = { shapes, grip: { x: 0, y: 0, rot: o.rot ?? GRIP_ROT }, length: Math.round((x1 - x0) * 100) / 100, tip: { x: tip[0], y: tip[1] } };
  if (o.grip2 !== undefined) art.grip2 = { x: o.grip2[0], y: o.grip2[1] };
  if (o.offhand === true) art.offhand = true;
  return art;
}

/** A weapon that bends: links from the grip, no shapes of its own, `tip` its far end lying straight. */
export function flexWeapon(segments: readonly WeaponSegment[], o: WeaponOpts = {}): WeaponArt {
  const len = segments.reduce((s, g) => s + g.length, 0);
  const art: WeaponArt = { shapes: [], segments, grip: { x: 0, y: 0, rot: o.rot ?? GRIP_ROT }, length: len, tip: { x: len, y: 0 } };
  if (o.grip2 !== undefined) art.grip2 = { x: o.grip2[0], y: o.grip2[1] };
  return art;
}
