/**
 * The six pets (companions), each drawn from life in `pets/` (15 Nov 2026; owner: "Animals look
 * shit and inaccurate"): smooth overlapping body masses on a skeleton whose joints bend the
 * animal's way, feet placed on the floor by the clips, gaits from Muybridge's Animal Locomotion
 * (1887). Facing right, stage units, y down, the floor at 0, each at its share of a fighter's
 * height (raccoon 22%, goose 34%, boar 40%, dog 30%, crow 20%, cat 25%). Bone names the engine
 * reads: "body" (the hit point, the aim bend) and "head" (its frontmost point is the mouth, beak or
 * tusk: the striking end). Colour slots of a pet (engine): "skin" and "top" its body colour, "hair"
 * its dark colour, "accent" its light colour, plus "white" and "ink". The rules are in docs/ART.md.
 */
import type { CompanionId } from "@rankzero/core";
import type { PetArt } from "./pets/kind";
import { dPolys, parsePolys } from "../gate/vocab";
import { LINE } from "../gate/style";
import { alleyCat } from "./pets/alley-cat";
import { boar } from "./pets/boar";
import { crow } from "./pets/crow";
import { goose } from "./pets/goose";
import { raccoon } from "./pets/raccoon";
import { strayDog } from "./pets/stray-dog";

export type { PetArt };

/**
 * Drawing units per stage unit of each pet's art. The art is drawn at its share of a fighter;
 * the stage then draws every pet at `layout.PET_SCALE`, a table measured on the real art and
 * also applied to the capsule test rig's stand-ins, which are drawn larger. So each pet is
 * handed over this much larger than drawn (no stand-in outgrows it) and PET_SCALE brings it back
 * to its share: the stage's numbers stay below 1 for every rig.
 */
export const PET_UNIT: Readonly<Record<CompanionId, number>> = {
  raccoon: 1.11, goose: 1.3, boar: 1.31, "stray-dog": 1.09, crow: 1.56, "alley-cat": 1.08,
};
/** A pet's art scaled by k: bone offsets, shapes, the rig height and the clips' root travel. */
/** Each pet's share of a fighter's height (owner, 15 Nov 2026). */
const SHARE: Readonly<Record<CompanionId, number>> = { raccoon: 0.22, goose: 0.35, boar: 0.4, "stray-dog": 0.3, crow: 0.2, "alley-cat": 0.25 };
/** A pet's ink line in its art units: a fighter's line times the square root of the pet's share of
 *  his height (never under half of it), so a small animal is not drowned in ink; the stage's scale
 *  of about 1 / PET_UNIT brings it back to stage units. */
const lineOf = (id: CompanionId): number => (LINE.figure * Math.max(0.5, Math.sqrt(SHARE[id]))) / PET_UNIT[id];
function scaled(art: PetArt, k: number): PetArt {
  const shape = (d: string): string => dPolys(parsePolys(d).map((poly) => poly.map(([x, y]) => [x * k, y * k] as const)));
  const clips = Object.fromEntries(Object.entries(art.clips).map(([n, c]) => [n, {
    ...c, keys: c.keys.map((key) => (key.root === undefined ? key : { ...key, root: [key.root[0] * k, key.root[1] * k] as const })),
  }])) as unknown as PetArt["clips"];
  return {
    rig: { ...art.rig, height: Math.round(art.rig.height * k * 10) / 10, bones: art.rig.bones.map((b) => ({ ...b, x: b.x * k, y: b.y * k })) },
    shapes: art.shapes.map((sh) => ({ ...sh, d: shape(sh.d), ...(sh.shade === undefined ? {} : { shade: shape(sh.shade) }) })),
    clips,
  };
}
const withLine = (id: CompanionId, art: PetArt): PetArt => ({ ...art, line: lineOf(id) });
const ART = { raccoon: raccoon(), goose: goose(), boar: boar(), "stray-dog": strayDog(), crow: crow(), "alley-cat": alleyCat() } as const;
export const PET_ART: Record<CompanionId, PetArt> = Object.fromEntries((Object.keys(ART) as CompanionId[]).map((id) =>
  [id, withLine(id, scaled(ART[id], PET_UNIT[id]))])) as Record<CompanionId, PetArt>;
