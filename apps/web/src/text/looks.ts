/**
 * The look editor's words (content v3 batch 4, plan 13.12): the part labels, every part's name in
 * the rig's order (content/looks: a part keeps its index, new parts at the end), and the buttons.
 * A part list here is exactly as long as LOOK_SPACE says (a test holds it).
 */
import type { LOOK_SPACE } from "@rankzero/core";

export type LookKey = keyof typeof LOOK_SPACE;
export type ShapeKey = "build" | "head" | "hair" | "face" | "top" | "bottom" | "shoes" | "accessory";
export type ColourKey = "skin" | "hairColor" | "palette";
export const SHAPE_KEYS: readonly ShapeKey[] = ["build", "head", "hair", "face", "top", "bottom", "shoes", "accessory"];
export const COLOUR_KEYS: readonly ColourKey[] = ["skin", "hairColor", "palette"];

export const LOOK_PART: Record<LookKey, string> = {
  build: "Build", head: "Head", hair: "Hair", face: "Face", top: "Top", bottom: "Bottoms", shoes: "Shoes",
  accessory: "Extra", skin: "Skin", hairColor: "Hair colour", palette: "Outfit colours",
};

/** Each shape part's name, by index. */
export const LOOK_NAMES: Record<ShapeKey, readonly string[]> = {
  build: ["Lean", "Stocky", "Tall", "Heavy", "Wiry"],
  head: ["Sharp jaw", "Square jaw", "Hawk nose", "Broad, flat nose", "Gaunt", "Thick neck", "Round and full", "Lantern jaw", "Boxer", "Young"],
  hair: ["Short crop", "Close crop", "Bald", "Buzz cut", "Mohawk", "Slicked back", "Bun", "Big curls", "Side part", "Short twists",
    "Long and loose", "Afro", "Locks", "Flat top", "Cornrows", "Undercut", "Ponytail", "Bald on top"],
  face: ["Steady", "Heavy brow", "Squint", "Scarred brow", "Lined", "Wide-eyed", "Squint and scar", "Broken nose",
    "Tired", "Scowl", "Stubble", "Black eye", "Stitched cheek", "Smirk"],
  top: ["Work jacket", "Vest top", "Tee", "Hoodie", "Track top", "Flannel shirt", "Leather jacket", "Long coat",
    "Zip hoodie", "Puffer vest", "Bomber jacket", "Tank top", "Work shirt", "Cut-off hoodie", "Anorak", "Short-sleeve work shirt"],
  bottom: ["Jeans", "Cargo trousers", "Track pants", "Shorts", "Work trousers", "Cargo shorts", "Baggy jeans", "Camo trousers",
    "Rolled chinos", "Carpenter trousers"],
  shoes: ["Boots", "Trainers", "High-tops", "Work shoes", "Runners", "Combat boots", "Slip-ons", "Chelsea boots"],
  accessory: ["None", "Beard", "Long beard", "Mutton chops", "Headband", "Neckerchief", "Cap", "Beanie", "Chain", "Dark glasses",
    "Headphones", "Neck tattoo", "Bandages", "Earring and scar"],
};

export const LOOK_WORDS = {
  title: "Look",
  open: "Change look",
  edit: "Pick each part",
  hide: "Hide the parts",
  save: "Save look",
  saved: "Look saved",
  undo: "Undo changes",
  shape: "Shape",
  colours: "Colours",
  gear: "Show gear",
  cosmetic: "Looks only: your stats still come from your name.",
  preview: (name: string) => `${name} in the chosen look`,
  prev: (part: string) => `Previous ${part.toLowerCase()}`,
  next: (part: string) => `Next ${part.toLowerCase()}`,
  count: (i: number, n: number) => `${i} of ${n}`,
  swatch: (part: string, i: number, n: number) => `${part} ${i} of ${n}`,
  editLabel: (name: string) => `Change ${name}'s look`,
};
