/**
 * The gate pack's appearance set: two complete looks in three builds. Every list wraps (the
 * contract allows lists shorter than LOOK_SPACE in the gate pack), so a look roll of any index
 * draws one of these. The content pack's set starts with these entries.
 */
import type { AppearanceSet } from "../../contracts";
import { BUILDS } from "../skeleton";
import { HAIR_COLOUR, PALETTES, SKIN } from "../style";
import { BOTTOMS, SHOES, TOPS } from "./clothes";
import { HANDS } from "./hands";
import { ACCESSORIES, FACES, HAIR, HEADS } from "./head";

export const GATE_LOOKS: AppearanceSet = {
  builds: BUILDS,
  heads: HEADS,
  hair: HAIR,
  faces: FACES,
  tops: TOPS,
  bottoms: BOTTOMS,
  shoes: SHOES,
  accessories: ACCESSORIES,
  hands: HANDS,
  skin: SKIN,
  hairColor: HAIR_COLOUR,
  palettes: PALETTES,
};

export { BODY_CENTRE } from "./clothes";
export { HEAD_CENTRE } from "./head";
export { KNUCKLES } from "./hands";
